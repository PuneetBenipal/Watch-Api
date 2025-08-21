const express = require('express');
const Router = express.Router();
const { isAuth } = require('../middlewares/auth.middleware');
const authenticateToken = require('../middleware/auth');
const StripeService = require('../services/stripeService');
const Subscription = require('../models/Subscription');
const Company = require('../models/Company.model');
const stripe = require("stripe")

// All routes require authentication
Router.use(isAuth);

const stripeService = new StripeService();



// Get user's subscription
Router.get('/subscription', async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ userId: req.user._id });

    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    res.json({ subscription });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
});

// Create subscription
Router.post('/subscription', async (req, res) => {
  try {
    const { priceId } = req.body;

    // Get or create Stripe customer
    let subscription = await Subscription.findOne({ userId: req.user._id });

    if (!subscription) {
      // Create new subscription
      const customer = await stripeService.createCustomer(req.user.email, req.user.name);

      subscription = new Subscription({
        userId: req.user._id,
        stripeCustomerId: customer.id,
        plan: 'Basic', // Will be updated based on priceId
        status: 'active'
      });
    }

    // Create Stripe subscription
    const stripeSubscription = await stripeService.createSubscription(
      subscription.stripeCustomerId,
      priceId
    );

    // Update subscription details
    subscription.stripeSubscriptionId = stripeSubscription.id;
    subscription.currentPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
    subscription.currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
    subscription.status = stripeSubscription.status;

    await subscription.save();

    res.json({
      message: 'Subscription created successfully',
      subscription,
      clientSecret: stripeSubscription.latest_invoice.payment_intent.client_secret
    });
  } catch (error) {
    console.error('Create subscription error:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// Cancel subscription
Router.post('/subscription/cancel', async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ userId: req.user._id });

    if (!subscription || !subscription.stripeSubscriptionId) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    await stripeService.cancelSubscription(subscription.stripeSubscriptionId);

    subscription.status = 'canceled';
    subscription.cancelAtPeriodEnd = true;
    await subscription.save();

    res.json({
      message: 'Subscription canceled successfully',
      subscription
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Reactivate subscription
Router.post('/subscription/reactivate', async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ userId: req.user._id });

    if (!subscription || !subscription.stripeSubscriptionId) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    await stripeService.reactivateSubscription(subscription.stripeSubscriptionId);

    subscription.cancelAtPeriodEnd = false;
    await subscription.save();

    res.json({
      message: 'Subscription reactivated successfully',
      subscription
    });
  } catch (error) {
    console.error('Reactivate subscription error:', error);
    res.status(500).json({ error: 'Failed to reactivate subscription' });
  }
});

// Update subscription
Router.put('/subscription', async (req, res) => {
  try {
    const { priceId } = req.body;

    const subscription = await Subscription.findOne({ userId: req.user._id });

    if (!subscription || !subscription.stripeSubscriptionId) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    const updatedSubscription = await stripeService.updateSubscription(
      subscription.stripeSubscriptionId,
      priceId
    );

    // Update local subscription
    subscription.currentPeriodStart = new Date(updatedSubscription.current_period_start * 1000);
    subscription.currentPeriodEnd = new Date(updatedSubscription.current_period_end * 1000);
    await subscription.save();

    res.json({
      message: 'Subscription updated successfully',
      subscription
    });
  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

// Create payment intent
Router.post('/payment-intent', async (req, res) => {
  try {
    const { amount, currency = 'usd' } = req.body;

    const subscription = await Subscription.findOne({ userId: req.user._id });

    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    const paymentIntent = await stripeService.createPaymentIntent(
      amount,
      currency,
      subscription.stripeCustomerId
    );

    res.json({
      clientSecret: paymentIntent.client_secret
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

// Get invoice history
Router.get('/invoices', async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ userId: req.user._id });

    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    const invoices = await stripeService.getCustomerInvoices(subscription.stripeCustomerId);

    res.json({ invoices: invoices.data });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ error: 'Failed to get invoices' });
  }
});

// Get plan pricing
Router.get('/plans', async (req, res) => {
  try {
    const plans = await stripeService.getPlanPricing();

    res.json({ plans });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ error: 'Failed to get plans' });
  }
});

// Webhook handler
Router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  try {
    const event = stripeService.stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    await stripeService.handleWebhook(event);

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: 'Webhook signature verification failed' });
  }
});

// Get usage statistics
Router.get('/usage', async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ userId: req.user._id });

    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    res.json({
      usage: subscription.usage,
      limits: subscription.limits,
      isWithinLimits: {
        whatsappQueries: subscription.isWithinLimits('whatsappQueries'),
        invoices: subscription.isWithinLimits('invoices'),
        inventoryItems: subscription.isWithinLimits('inventoryItems'),
        alerts: subscription.isWithinLimits('alerts')
      }
    });
  } catch (error) {
    console.error('Get usage error:', error);
    res.status(500).json({ error: 'Failed to get usage statistics' });
  }
});

// Increment usage
Router.post('/usage/increment', async (req, res) => {
  try {
    const { feature, amount = 1 } = req.body;

    const subscription = await Subscription.findOne({ userId: req.user._id });

    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    await subscription.incrementUsage(feature, amount);

    res.json({
      message: 'Usage incremented successfully',
      usage: subscription.usage
    });
  } catch (error) {
    console.error('Increment usage error:', error);
    res.status(500).json({ error: 'Failed to increment usage' });
  }
});

module.exports = Router; 