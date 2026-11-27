const saweria = require("../configs/saweria.config");
const authService = require("./auth.service");

const getUserInfo = async () => {
  const userId = authService.requireUserId();
  const res = await saweria.get(`/users/${userId}`);
  return res.data.data ?? res.data;
};

module.exports = {
  getUserInfo,
};
