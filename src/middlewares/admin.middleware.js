const { timingSafeEqual } = require("node:crypto");
const { error } = require("../utils/response");

module.exports = (req, res, next) => {
  const key = process.env.ADMIN_KEY;
  if (!key) return error(res, { statusCode: 403, message: "Admin access disabled" });

  const provided = req.get("X-Admin-Key") || req.body?.adminKey;
  if (typeof provided !== "string" || Buffer.byteLength(provided) !== Buffer.byteLength(key) ||
      !timingSafeEqual(Buffer.from(provided), Buffer.from(key))) {
    return error(res, { statusCode: 401, message: "Unauthorized" });
  }
  next();
};
