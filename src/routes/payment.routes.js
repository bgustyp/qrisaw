const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const PaymentController = require("../controllers/payment.controller");
const requireAdmin = require("../middlewares/admin.middleware");

const qrisLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { success: false, message: "Too many requests, please try again later" },
});

router.get("/transactions", requireAdmin, PaymentController.transactions);
router.get("/balance", requireAdmin, PaymentController.balance);
router.get("/balance/available", requireAdmin, PaymentController.availableBalance);
router.post("/qris", qrisLimiter, PaymentController.createQris);
router.get("/:id/status", PaymentController.status);

module.exports = router;
