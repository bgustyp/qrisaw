const saweria = require("../configs/saweria.config");
const authService = require("./auth.service");

const getUserInfo = async () => {
  authService.requireUserId();
  const res = await saweria.get("/users");
  return res.data.data ?? res.data;
};

module.exports = {
  getUserInfo,
};
