const { browserLogin } = require("./captcha.service");
const logger = require("../utils/logger");
const sessionUtils = require("../utils/session");

let authToken = null;
let userId = null;
let isLoggingIn = false;
let refreshTimer = null;

const REFRESH_MARGIN_MS = 10 * 60 * 1000; // re-login 10 minutes before expiry
const REFRESH_RETRY_MS = 60 * 1000; // retry proactive refresh 1 minute after a failure

const runProactiveRefresh = async () => {
  logger.info("Proactive token refresh triggered");
  try {
    // On success, login() persists the session and re-arms scheduleRefresh.
    await login();
  } catch (err) {
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

const login = async () => {
  // Prevent concurrent login attempts
  if (isLoggingIn) {
    logger.info("Login already in progress, waiting...");
    while (isLoggingIn) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (authToken && userId) {
      return { authToken, userId };
    }
    throw new Error("Login was in progress but failed. Retry explicitly.");
  }

  try {
    isLoggingIn = true;
    logger.info("Starting login process...");

    sessionUtils.clearSession();
    authToken = null;
    userId = null;

    const result = await browserLogin();
    authToken = result.authToken;
    userId = result.userId;

    sessionUtils.saveSession({ authToken, userId });
    scheduleRefresh(authToken);

    return { authToken, userId };
  } catch (error) {
    logger.error("Login failed", { message: error.message, stack: error.stack });
    throw error;
  } finally {
    isLoggingIn = false;
  }
};

const getToken = () => authToken;
const getUserId = () => userId;

const getAuthStatus = () => ({
  isAuthenticated: Boolean(authToken && userId),
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
  getAuthStatus,
  setSession,
};
