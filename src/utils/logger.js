const { createLogger, format, transports } = require("winston");

const isProd = process.env.NODE_ENV === "production";

const logger = createLogger({
  level: "info",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.errors({ stack: true }),
    isProd
      ? format.json()
      : format.combine(
          format.colorize(),
          format.printf(({ level, message, timestamp, ...meta }) => {
            const extra = Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
            return `${timestamp} ${level}: ${message}${extra}`;
          }),
        ),
  ),
  transports: [new transports.Console()],
});

module.exports = logger;
