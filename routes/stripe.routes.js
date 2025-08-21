const express = require('express');
const Router = express.Router();
const authenticateToken = require('../middleware/auth');
const stripeCtrl = require("../controllers/stripe.ctrl");

// Create checkout session
Router.post('/create-checkout-session', authenticateToken, stripeCtrl.createCheckoutSession);

module.exports = Router; 