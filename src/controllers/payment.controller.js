const service = require("../services/payment.service.js");
const { success, error } = require("../utils/response.js");

const transactions = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 15;
    const data = await service.getTransactions(page, limit);
    success(res, "Transactions retrieved", data);
  } catch (e) {
    error(res, e);
  }
};

const balance = async (_, res) => {
  try {
    const data = await service.getBalance();
    success(res, "Balance retrieved", data);
  } catch (e) {
    error(res, e);
  }
};

const availableBalance = async (_, res) => {
  try {
    const data = await service.getAvailableBalance();
    success(res, "Available balance retrieved", data);
  } catch (e) {
    error(res, e);
  }
};

const createQris = async (req, res) => {
  try {
    const { amount, message, customer, customer_info, agree = true, notUnderage = true } = req.body ?? {};
    if (agree !== true || notUnderage !== true) {
      return error(res, { statusCode: 400, message: "Both age and terms confirmations are required" });
    }
    const payer = customer_info ?? customer;
    const name = customer_info != null ? payer.first_name : payer?.name;

    // Validate amount
    const parsedAmount = Number(amount);
    const MIN_AMOUNT = 1000;
    const MAX_AMOUNT = 100000000; // 100 million IDR
    
    if (!amount || !Number.isFinite(parsedAmount) || Math.floor(parsedAmount) !== parsedAmount || String(amount).includes(".")) {
      return error(res, {
        statusCode: 400,
        message: "Invalid amount: must be an integer",
      });
    }
    
    if (parsedAmount < MIN_AMOUNT) {
      return error(res, {
        statusCode: 400,
        message: `Amount too low: minimum is ${MIN_AMOUNT} IDR`,
      });
    }
    
    if (parsedAmount > MAX_AMOUNT) {
      return error(res, {
        statusCode: 400,
        message: `Amount too high: maximum is ${MAX_AMOUNT} IDR`,
      });
    }

    if (!payer || typeof payer !== "object") {
      return error(res, {
        statusCode: 400,
        message: "Missing required field: customer_info or customer",
      });
    }
    
    if (typeof payer.email !== "string" || !payer.email.includes("@")) {
      return error(res, {
        statusCode: 400,
        message: "Invalid customer email",
      });
    }
    
    if (typeof name !== "string" || name.trim().length === 0) {
      return error(res, {
        statusCode: 400,
        message: "Invalid customer name",
      });
    }

    const result = await service.createQrisPayment({
      amount: parsedAmount,
      message: message || "",
      customer_info: {
        first_name: name,
        email: payer.email,
        phone: payer.phone || "",
      },
    });

    success(
      res,
      "QR payment created",
      {
        payment_id: result.id,
        amount: result?.etc?.amount_to_display ?? result.amount,
        total_amount: result.amount,
        qr_string: result.qr_string,
        status: result.status,
      },
      201,
    );
  } catch (e) {
    error(res, e);
  }
};

const status = async (req, res) => {
  try {
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(req.params.id)) {
      return error(res, { statusCode: 400, message: "Invalid payment ID" });
    }
    const data = await service.checkPaymentStatus(req.params.id);
    success(res, "Payment status retrieved", {
      payment_id: data.id,
      amount: data.amount_raw,
      status: (data.transaction_status || "UNKNOWN").toUpperCase(),
      created_at: data.created_at,
    });
  } catch (e) {
    error(res, e);
  }
};

module.exports = {
  transactions,
  balance,
  availableBalance,
  createQris,
  status,
};
