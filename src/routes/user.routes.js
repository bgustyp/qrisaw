const express = require("express");
const router = express.Router();
const UserController = require("../controllers/user.controller");
const requireAdmin = require("../middlewares/admin.middleware");

router.get("/", requireAdmin, UserController.getUser);

module.exports = router;
