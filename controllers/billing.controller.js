const Subscription = require('../models/Subscription');
const User = require('../models/User.model');
const Company = require('../models/Company.model');
const StripeService = require('../services/stripeService');
const { asyncHandler } = require('../middlewares/error.middleware');

exports.savePlanSnapshot = async (req, res) => {
  try {
    const { companyId } = req.user; // from auth
    const {
      planId, planStatus, renewalDate,
      seats, entitlements, featureFlags
    } = req.body;

    const doc = await Company.findByIdAndUpdate(
      companyId,
      {
        $set: {
          planId,
          planStatus,
          renewalDate,
          seats,            // { purchased, used }
          entitlements,     // [{ feature, enabled, limits, usage }]
          featureFlags      // { ai_pricing, rolex_verification, escrow, disputes }
        }
      },
      { new: true }
    );

    res.json({ state: 'success', data });
  } catch (error) {
    console.log("error.message", error.message)
    res.json({ state: "error", msg: error.message })
  }
}

// Get user subscription
const getSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ userId: req.user._id })
      .populate('userId', 'name email');

    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    res.json({ subscription });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
};

// Create subscription
const createSubscription = async (req, res) => {
  try {
    const { plan, paymentMethodId } = req.body;

    // Check if user already has a subscription
    const existingSubscription = await Subscription.findOne({ userId: req.user._id });
    if (existingSubscription) {
      return res.status(400).json({ error: 'User already has a subscription' });
    }

    const stripeService = new StripeService();

    // Create Stripe customer if not exists
    let customer;
    if (!req.user.stripeCustomerId) {
      customer = await stripeService.createCustomer({
        email: req.user.email,
        name: req.user.name,
        metadata: {
          userId: req.user._id.toString(),
          companyId: req.user.companyId?.toString() || ''
        }
      });

      // Update user with Stripe customer ID
      req.user.stripeCustomerId = customer.id;
      await req.user.save();
    } else {
      customer = { id: req.user.stripeCustomerId };
    }

    // Create subscription in Stripe
    const stripeSubscription = await stripeService.createSubscription({
      customerId: customer.id,
      plan,
      paymentMethodId
    });

    // Create subscription in database
    const subscription = new Subscription({
      userId: req.user._id,
      stripeCustomerId: customer.id,
      stripeSubscriptionId: stripeSubscription.id,
      plan,
      status: stripeSubscription.status,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
      usage: {
        whatsappQueries: 0,
        invoices: 0,
        inventoryItems: 0,
        alerts: 0
      },
      limits: getPlanLimits(plan)
    });

    await subscription.save();

    res.status(201).json({
      message: 'Subscription created successfully',
      subscription
    });
  } catch (error) {
    console.error('Create subscription error:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
};

// Cancel subscription
const cancelSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ userId: req.user._id });
    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    const stripeService = new StripeService();
    await stripeService.cancelSubscription(subscription.stripeSubscriptionId);

    // Update subscription status
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
};

// Reactivate subscription
const reactivateSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ userId: req.user._id });
    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    const stripeService = new StripeService();
    await stripeService.reactivateSubscription(subscription.stripeSubscriptionId);

    // Update subscription status
    subscription.status = 'active';
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
};

// Update subscription
const updateSubscription = async (req, res) => {
  try {
    const { plan } = req.body;

    const subscription = await Subscription.findOne({ userId: req.user._id });
    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    const stripeService = new StripeService();
    await stripeService.updateSubscription(subscription.stripeSubscriptionId, plan);

    // Update subscription in database
    subscription.plan = plan;
    subscription.limits = getPlanLimits(plan);
    await subscription.save();

    res.json({
      message: 'Subscription updated successfully',
      subscription
    });
  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
};

// Create payment intent
const createPaymentIntent = async (req, res) => {
  try {
    const { amount, currency = 'usd', paymentMethodId } = req.body;

    const stripeService = new StripeService();
    const paymentIntent = await stripeService.createPaymentIntent({
      amount,
      currency,
      customerId: req.user.stripeCustomerId,
      paymentMethodId
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntent
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
};

// Get invoice history
const getInvoiceHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const subscription = await Subscription.findOne({ userId: req.user._id });
    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    const stripeService = new StripeService();
    const invoices = await stripeService.getCustomerInvoices(subscription.stripeCustomerId);

    const paginatedInvoices = invoices.slice(skip, skip + parseInt(limit));

    res.json({
      invoices: paginatedInvoices,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(invoices.length / limit),
        totalItems: invoices.length
      }
    });
  } catch (error) {
    console.error('Get invoice history error:', error);
    res.status(500).json({ error: 'Failed to get invoice history' });
  }
};

// Get plan pricing
const getPlanPricing = async (req, res) => {
  try {
    const stripeService = new StripeService();
    const pricing = await stripeService.getPlanPricing();

    res.json({ pricing });
  } catch (error) {
    console.error('Get plan pricing error:', error);
    res.status(500).json({ error: 'Failed to get plan pricing' });
  }
};

// Stripe webhook handler
const handleWebhook = async (req, res) => {
  try {
    const stripeService = new StripeService();
    const event = await stripeService.handleWebhook(req.body, req.headers['stripe-signature']);

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: 'Webhook signature verification failed' });
  }
};

// Get usage statistics
const getUsageStats = async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ userId: req.user._id });
    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    const stripeService = new StripeService();
    const usage = await stripeService.getSubscriptionUsage(subscription.stripeSubscriptionId);

    res.json({
      usage: subscription.usage,
      limits: subscription.limits,
      stripeUsage: usage
    });
  } catch (error) {
    console.error('Get usage stats error:', error);
    res.status(500).json({ error: 'Failed to get usage statistics' });
  }
};

// Increment usage
const incrementUsage = async (req, res) => {
  try {
    const { type, amount = 1 } = req.body;

    const subscription = await Subscription.findOne({ userId: req.user._id });
    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    // Check if usage is within limits
    if (!subscription.isWithinLimits(type, amount)) {
      return res.status(403).json({ error: 'Usage limit exceeded' });
    }

    // Increment usage
    await subscription.incrementUsage(type, amount);

    res.json({
      message: 'Usage incremented successfully',
      usage: subscription.usage
    });
  } catch (error) {
    console.error('Increment usage error:', error);
    res.status(500).json({ error: 'Failed to increment usage' });
  }
};

// Helper function to get plan limits
const getPlanLimits = (plan) => {
  const limits = {
    Basic: {
      whatsappQueries: 100,
      invoices: 50,
      inventoryItems: 100,
      alerts: 5
    },
    Pro: {
      whatsappQueries: 500,
      invoices: 200,
      inventoryItems: 500,
      alerts: 20
    },
    Premium: {
      whatsappQueries: 2000,
      invoices: 1000,
      inventoryItems: 2000,
      alerts: 100
    }
  };

  return limits[plan] || limits.Basic;
};

module.exports = {
  getSubscription,
  createSubscription,
  cancelSubscription,
  reactivateSubscription,
  updateSubscription,
  createPaymentIntent,
  getInvoiceHistory,
  getPlanPricing,
  handleWebhook,
  getUsageStats,
  incrementUsage
}; 