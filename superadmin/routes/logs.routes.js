const router = require("express").Router();
const ctrl = require("../controllers/logs.controller");

router.get("/", ctrl.list);

module.exports = router;
