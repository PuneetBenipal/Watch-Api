const router = require('express').Router();
const ctrl = require('../controllers/webhook.ctrl');
router.post('/stripe', ctrl.handle);
module.exports = router;
