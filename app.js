#!/usr/bin/env node
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("node:path");
const paymentRoutes = require("./src/routes/payment.routes");
const rateLimit = require("express-rate-limit");
const requestLogger = require("./src/middlewares/requestLogger.middleware");
const logger = require("./src/utils/logger");

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

app.use(helmet());

// Trust proxy for rate limiting behind reverse proxy (nginx, cloudflare, etc)
app.set("trust proxy", process.env.TRUSTED_PROXY || false);

// Swagger UI (Only in Development)
if (process.env.NODE_ENV !== "production") {
  const swaggerUi = require("swagger-ui-express");
  const YAML = require("yamljs");
  const swaggerDocument = YAML.load(path.join(__dirname, "docs/openapi.yaml"));
  
  // Inject dynamic server URL based on environment
  const host = process.env.SWAGGER_HOST;
  if (host) {
    const protocol = process.env.SWAGGER_PROTOCOL || "http";
    const serverUrl = host.includes(":") ? `${protocol}://${host}` : `${protocol}://${host}:${PORT}`;
    swaggerDocument.servers = [{ url: serverUrl, description: "Configured server" }];
  }
  
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  logger.info("Swagger UI enabled on /api-docs");
}


const corsOrigin = process.env.CORS_ORIGIN || "*";
app.use(
  cors({
    origin: corsOrigin.includes(",")
      ? corsOrigin.split(",").map((o) => o.trim())
      : corsOrigin,
    methods: ["GET", "POST"],
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please try again later" },
});
app.use(globalLimiter);
app.use(requestLogger);

app.get("/", (req, res) => {
  const isDev = process.env.NODE_ENV !== "production";
  const pkg = require("./package.json");

  const base = {
    success: true,
    name: "Qrisaw",
    version: pkg.version,
    description: pkg.description || "Unofficial Saweria QRIS API Wrapper",
    serverTime: new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }),
    license: pkg.license,
    repository: pkg.repository ? pkg.repository.url || pkg.repository : null,
  };

  if (isDev) {
    return res.json({
      ...base,
      environment: "development",
      endpoints: {
        payments: {
          createQRIS: "POST /api/payments/qris",
          checkStatus: "GET /api/payments/:id/status",
          balance: "GET /api/payments/balance",
          availableBalance: "GET /api/payments/balance/available",
          transactions: "GET /api/payments/transactions",
        },
        users: "GET /api/users",
        health: "GET /health",
        docs: "GET /api-docs",
      },
    });
  }

  res.json({
    ...base,
    environment: "production",
    endpoints: {
      payments: "POST /api/payments/qris",
      health: "GET /health",
    },
  });
});

app.use("/api/payments", paymentRoutes);
app.use("/api/users", require("./src/routes/user.routes"));
app.use("/health", require("./src/routes/health.routes"));

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Not found",
  });
});

app.use((err, req, res, next) => {
  logger.error("Unhandled error", {
    error: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
  });

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

const authService = require("./src/services/auth.service");

(async () => {
  try {
    logger.info("Starting server...");
    
    // 1. Try to load existing valid session from file
    const sessionLoaded = await authService.init();

    if (sessionLoaded) {
      logger.info("Using existing session, skipping login");
    } else if (process.env.SAWERIA_EMAIL && process.env.SAWERIA_PASSWORD) {
      logger.info("No valid session found, attempting login via browser solver...");
      authService.login().then(() => {
        logger.info("Background login successful");
      }).catch((err) => {
        logger.error("Background login failed", { error: err.message });
      });
    } else {
      logger.warn("No credentials set. Set SAWERIA_EMAIL and SAWERIA_PASSWORD in .env to authenticate.");
    }

    app.listen(PORT, HOST, () => {
      logger.info(`Server running on http://${HOST}:${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start server", {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
})();
