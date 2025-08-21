const router = require("express").Router();
const ctrl = require("../controllers/auth.controller.js");

router.post("/login", ctrl.login);

module.exports = router;
