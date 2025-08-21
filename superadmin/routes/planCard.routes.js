const router = require("express").Router();
const ctrl = require("../controllers/planCard.controller");

router.get("/", ctrl.list);
router.post("/", ctrl.create);
router.put("/:id", ctrl.update)
router.delete("/:id", ctrl.delete);

module.exports = router;
 