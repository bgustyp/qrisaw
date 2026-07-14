const saweria = require("../configs/saweria.config");
const authService = require("./auth.service");

const getUserInfo = async () => {
  const userId = authService.getUserId();
  if (!userId) throw new Error("User ID not available. Please login first.");
  const res = await saweria.get(`/users/${userId}`);
  return res.data.data ?? res.data;
};

module.exports = {
  getUserInfo,
};
