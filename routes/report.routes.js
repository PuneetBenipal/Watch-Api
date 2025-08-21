const router = require('express').Router();
const ctrl = require('../controllers/reports.ctrl');
const authenticateToken = require("../middleware/auth");

// All under /reports
router.get('/sales', authenticateToken, ctrl.sales);
router.get('/aging', authenticateToken, ctrl.aging);
router.get('/whatsapp', authenticateToken, ctrl.whatsapp);
router.get('/profit', authenticateToken, ctrl.profit);

module.exports = router;