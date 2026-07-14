const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const authService = require("../services/auth.service");
const { success, error } = require("../utils/response");

const safeCompare = (a, b) => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

router.get("/", (req, res) => {
  const authStatus = authService.getAuthStatus();
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    auth: {
      authenticated: authStatus.isAuthenticated,
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

router.post("/session", (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (adminKey) {
    const provided = req.headers["x-admin-key"] || req.body?.adminKey;
    if (!provided || !safeCompare(provided, adminKey)) {
      return error(res, { statusCode: 401, message: "Unauthorized" });
    }
  }
  const { authToken, userId } = req.body || {};
  if (!authToken || !userId) {
    return error(res, { statusCode: 400, message: "authToken and userId are required" });
  }
  authService.setSession(authToken, userId);
  success(res, "Session set successfully", { userId });
});

module.exports = router;
