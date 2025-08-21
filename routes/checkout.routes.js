const router = require('express').Router();

const ctrl = require('../controllers/checkout.ctrl');

router.post('/subscription', ctrl.createSubscriptionCheckout);

router.post('/preview', ctrl.previewSubscription);

module.exports = router;