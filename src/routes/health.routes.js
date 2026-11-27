const express = require("express");
const requireAdmin = require("../middlewares/admin.middleware");
const { isTokenValid } = require("../utils/session");
const router = express.Router();
const authService = require("../services/auth.service");
const { success, error } = require("../utils/response");

router.get("/", (req, res) => {
  const authStatus = authService.getAuthStatus();
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    auth: {
      authenticated: authStatus.isAuthenticated,
      browserLoginError: authStatus.browserLoginError,
      tokenValid: authStatus.tokenValid,
      tokenExpiresIn: authStatus.tokenExpiresIn
        ? `${Math.floor(authStatus.tokenExpiresIn / 1000 / 60)}m`
        : null,
    },
    memory: {
      heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
    },
  };

  success(res, "Health check", health);
});

router.post("/session", requireAdmin, (req, res) => {
  const { authToken, userId } = req.body || {};
  if (!isTokenValid(authToken) || typeof userId !== "string" || !/^[\w-]+$/.test(userId)) {
    return error(res, { statusCode: 400, message: "Expected an unexpired token and a valid userId" });
  }
  authService.setSession(authToken, userId);
  success(res, "Session set successfully", { userId });
});

module.exports = router;
