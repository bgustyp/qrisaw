const { browserLogin } = require("../browser/login");
const logger = require("../utils/logger");
const sessionUtils = require("../utils/session");

let authToken = null;
let userId = null;
let pendingLogin = null;
let sandboxError = null;
let refreshTimer = null;

const REFRESH_MARGIN_MS = 10 * 60 * 1000; // re-login 10 minutes before expiry
const REFRESH_RETRY_MS = 60 * 1000; // retry proactive refresh 1 minute after a failure

const runProactiveRefresh = async () => {
  logger.info("Proactive token refresh triggered");
  try {
    // On success, login() persists the session and re-arms scheduleRefresh.
    await login();
  } catch (err) {
    if (sandboxError) return;
    logger.error("Proactive token refresh failed, retrying soon", {
      error: err.message,
    });
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(runProactiveRefresh, REFRESH_RETRY_MS);
    refreshTimer.unref();
  }
};

const scheduleRefresh = (token) => {
  if (refreshTimer) clearTimeout(refreshTimer);
  if (sandboxError || !process.env.SAWERIA_EMAIL || !process.env.SAWERIA_PASSWORD) return;
  const remaining = sessionUtils.getTokenTimeRemaining(token);
  if (!remaining || remaining <= 0) return;
  const delay = Math.max(remaining - REFRESH_MARGIN_MS, 0);
  logger.info(`Token refresh scheduled in ${Math.round(delay / 1000 / 60)}m`);
  refreshTimer = setTimeout(runProactiveRefresh, delay);
  refreshTimer.unref();
};

const init = async () => {
  const session = sessionUtils.loadSession();
  if (session && session.authToken && session.userId) {
    authToken = session.authToken;
    userId = session.userId;
    logger.info(`Session loaded from file. User ID: ${userId}`);
    scheduleRefresh(authToken);
    return true;
  }
  return false;
};

const login = () => {
  // Prevent concurrent login attempts
  if (sandboxError) return Promise.reject(sandboxError);
  if (pendingLogin) return pendingLogin;
  logger.info("Starting login process...");
  pendingLogin = browserLogin().then((result) => {
    authToken = result.authToken;
    userId = result.userId;

    sessionUtils.saveSession({ authToken, userId });
    scheduleRefresh(authToken);

    return { authToken, userId };
  }).catch((error) => {
    if (error.code === "CHROMIUM_SANDBOX_UNAVAILABLE") sandboxError = error;
    logger.error("Login failed", { message: error.message, stack: error.stack });
    throw error;
  }).finally(() => {
    pendingLogin = null;
  });
  return pendingLogin;
};

const getToken = () => authToken;
const getUserId = () => userId;
const requireUserId = () => {
  if (userId) return userId;
  throw sandboxError || Object.assign(new Error("Saweria session unavailable"), { statusCode: 503 });
};

const getAuthStatus = () => ({
  isAuthenticated: Boolean(authToken && userId),
  browserLoginError: sandboxError?.code ?? null,
  tokenValid: authToken ? sessionUtils.isTokenValid(authToken) : false,
  tokenExpiresIn: authToken ? sessionUtils.getTokenTimeRemaining(authToken) : null,
});

const setSession = (token, id) => {
  authToken = token;
  userId = id;
  sessionUtils.saveSession({ authToken, userId });
  scheduleRefresh(authToken);
  logger.info(`Session set manually. User ID: ${userId}`);
};

module.exports = {
  init,
  login,
  getToken,
  getUserId,
  requireUserId,
  getAuthStatus,
  setSession,
};
