const express = require('express');
const router = express.Router();
const stripeCtrl = require('../controllers/stripe.ctrl');

// Use raw body for Stripe signature verification
router.post('/stripe', express.raw({ type: 'application/json' }), stripeCtrl.webhookHandler);

module.exports = router;
