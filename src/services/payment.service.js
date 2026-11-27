const saweria = require("../configs/saweria.config.js");
const authService = require("../services/auth.service");

const getTransactions = async (page, limit) => {
  authService.requireUserId();
  const res = await saweria.get("/transactions", {
    params: { page, page_size: limit },
  });
  return res.data.data;
};

const getBalance = async () => {
  authService.requireUserId();
  const res = await saweria.get("/donations/balance");
  return res.data.data;
};

const getAvailableBalance = async () => {
  authService.requireUserId();
  const res = await saweria.get("/donations/available-balance");
  return {
    available_balance: res.data.data.available_balance,
    currency: res.data.data.currency,
  };
};

const createQrisPayment = async (payload) => {
  const userId = authService.requireUserId();

  const res = await saweria.post(`/donations/snap/${userId}`, {
    agree: true,
    notUnderage: true,
    payment_type: "qris",
    vote: "",
    currency: "IDR",
    ...payload,
  });
  return res.data.data;
};

const checkPaymentStatus = async (paymentId) => {
  const res = await saweria.get(`/donations/qris/snap/${paymentId}`);
  return res.data.data;
};

module.exports = {
  getTransactions,
  getBalance,
  getAvailableBalance,
  createQrisPayment,
  checkPaymentStatus,
};
