const router = require("express").Router();

router.use("/auth", require("./auth.routes"));
router.use("/users", require("./users.routes"));
router.use("/companies", require("./companies.routes"));
router.use("/billing", require("./billing.routes"));
router.use("/support", require("./support.routes"));
router.use("/logs", require("./logs.routes"));        // <—
router.use("/metrics", require("./metrics.routes"));
router.use("/modules", require("./modules.routes"))
router.use("/discounts", require("./discounts.routes"))
router.use("/plans", require("./planCard.routes"));


module.exports = router;
