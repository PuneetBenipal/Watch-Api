const router = require("express").Router();
const ctrl = require("../controllers/users.controller");

router.get("/", ctrl.list);
router.patch("/:id", ctrl.update);
router.delete("/:id", ctrl.remove);

router.post("/invite", ctrl.invite);
router.post("/:id/reset-password", ctrl.resetPassword);
router.post("/:id/impersonate", ctrl.impersonate);

module.exports = router;
