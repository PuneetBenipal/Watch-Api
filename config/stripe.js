const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const createCustomer = async (email, name, metadata) => {
  try {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        source: 'watchdealerhub',
        ...metadata
      }
    });
    return customer;
  } catch (error) {
    throw error;
  }
};

const createSubscription = async (customerId, priceId) => {
  try {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });
    return subscription;
  } catch (error) {
    throw error;
  }
};

const createPaymentIntent = async (amount, currency, customerId) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      customer: customerId,
      automatic_payment_methods: {
        enabled: true,
      },
    });
    return paymentIntent;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  stripe,
  createCustomer,
  createSubscription,
  createPaymentIntent
}; 