const router = require("express").Router();
const ctrl = require("../controllers/billing.controller");

router.get("/invoices", ctrl.listInvoices);
router.patch("/invoices/:id", ctrl.updateInvoiceStatus);
router.get("/payments", ctrl.listPayments);

module.exports = router;
