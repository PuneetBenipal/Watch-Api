const router = require("express").Router();
const ctrl = require("../controllers/metrics.controller");

router.get("/", ctrl.overview);

module.exports = router;
