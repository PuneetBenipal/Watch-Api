const router = require("express").Router();
const ctrl = require("../controllers/companies.controller");

router.get("/", ctrl.list);
router.get("/:id", ctrl.detail);
router.patch("/:id/billing", ctrl.updateBilling);
router.patch("/:id/modules", ctrl.updateModules);

module.exports = router;
