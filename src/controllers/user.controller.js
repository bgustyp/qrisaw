const service = require("../services/user.service");
const { success, error } = require("../utils/response");

const getUser = async (req, res) => {
  try {
    const data = await service.getUserInfo();
    success(res, "User info retrieved", data);
  } catch (e) {
    error(res, e);
  }
};

module.exports = {
  getUser,
};
