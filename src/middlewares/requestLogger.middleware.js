const logger = require("../utils/logger");

module.exports = (req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const level = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";

    logger[level]("HTTP Request", {
      method: req.method,
      path: req.originalUrl,
      statusCode,
      durationMs: duration,
      ip: req.ip,
    });
  });

  next();
};
