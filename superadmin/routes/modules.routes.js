const router = require("express").Router();
const ctrl = require("../controllers/modules.controller");

router.get("/", ctrl.listModules);
router.post("/", ctrl.createModule);
router.patch("/:id", ctrl.updateModule);
router.delete("/:id", ctrl.deleteModule);

module.exports = router;
