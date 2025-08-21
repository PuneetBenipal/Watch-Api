const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Subscription = require('../models/Subscription');
const Company = require('../models/Company.model');

class StripeService {
  constructor() {
    this.stripe = stripe;
  }

  async createCustomer(email, name, metadata = {}) {
    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
        metadata: {
          ...metadata,
          source: 'watchdealerhub'
        }
      });

      return customer;
    } catch (error) {
      console.error('Stripe customer creation error:', error);
      throw error;
    }
  }

  async createSubscription(customerId, priceId, metadata = {}) {
    try {
      const subscription = await this.stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata
      });

      return subscription;
    } catch (error) {
      console.error('Stripe subscription creation error:', error);
      throw error;
    }
  }

  async createPaymentIntent(amount, currency, customerId, metadata = {}) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount,
        currency,
        customer: customerId,
        automatic_payment_methods: {
          enabled: true,
        },
        metadata
      });

      return paymentIntent;
    } catch (error) {
      console.error('Stripe payment intent creation error:', error);
      throw error;
    }
  }

  async createInvoice(customerId, items, metadata = {}) {
    try {
      const invoice = await this.stripe.invoices.create({
        customer: customerId,
        collection_method: 'charge_automatically',
        metadata
      });

      // Add invoice items
      for (const item of items) {
        await this.stripe.invoiceItems.create({
          customer: customerId,
          invoice: invoice.id,
          amount: item.amount,
          currency: item.currency,
          description: item.description
        });
      }

      // Finalize and send invoice
      const finalizedInvoice = await this.stripe.invoices.finalizeInvoice(invoice.id);
      await this.stripe.invoices.sendInvoice(finalizedInvoice.id);

      return finalizedInvoice;
    } catch (error) {
      console.error('Stripe invoice creation error:', error);
      throw error;
    }
  }

  async cancelSubscription(subscriptionId) {
    try {
      const subscription = await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });

      return subscription;
    } catch (error) {
      console.error('Stripe subscription cancellation error:', error);
      throw error;
    }
  }

  async reactivateSubscription(subscriptionId) {
    try {
      const subscription = await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false
      });

      return subscription;
    } catch (error) {
      console.error('Stripe subscription reactivation error:', error);
      throw error;
    }
  }

  async updateSubscription(subscriptionId, newPriceId) {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);

      // Update the subscription item
      await this.stripe.subscriptionItems.update(subscription.items.data[0].id, {
        price: newPriceId
      });

      return await this.stripe.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      console.error('Stripe subscription update error:', error);
      throw error;
    }
  }

  async createRefund(paymentIntentId, amount, reason = 'requested_by_customer') {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount,
        reason
      });

      return refund;
    } catch (error) {
      console.error('Stripe refund creation error:', error);
      throw error;
    }
  }

  async getCustomerInvoices(customerId, limit = 10) {
    try {
      const invoices = await this.stripe.invoices.list({
        customer: customerId,
        limit
      });

      return invoices;
    } catch (error) {
      console.error('Stripe get customer invoices error:', error);
      throw error;
    }
  }

  async getSubscriptionUsage(subscriptionId) {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['data.usage_records']
      });

      return subscription;
    } catch (error) {
      console.error('Stripe get subscription usage error:', error);
      throw error;
    }
  }

  async createUsageRecord(subscriptionItemId, quantity, timestamp = Math.floor(Date.now() / 1000)) {
    try {
      const usageRecord = await this.stripe.subscriptionItems.createUsageRecord(
        subscriptionItemId,
        {
          quantity,
          timestamp,
          action: 'increment'
        }
      );

      return usageRecord;
    } catch (error) {
      console.error('Stripe create usage record error:', error);
      throw error;
    }
  }

  async handleWebhook(event) {
    try {
      switch (event.type) {
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object);
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;
        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event.data.object);
          break;
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object);
          break;
        default:
          console.log(`Unhandled webhook event: ${event.type}`);
      }
    } catch (error) {
      console.error('Webhook handling error:', error);
      throw error;
    }
  }

  async handleSubscriptionCreated(subscription) {
    try {
      const subscriptionDoc = await Subscription.findOne({
        stripeSubscriptionId: subscription.id
      });

      if (subscriptionDoc) {
        subscriptionDoc.status = subscription.status;
        subscriptionDoc.currentPeriodStart = new Date(subscription.current_period_start * 1000);
        subscriptionDoc.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
        await subscriptionDoc.save();
      }
    } catch (error) {
      console.error('Handle subscription created error:', error);
    }
  }

  async handleSubscriptionUpdated(subscription) {
    try {
      const subscriptionDoc = await Subscription.findOne({
        stripeSubscriptionId: subscription.id
      });

      if (subscriptionDoc) {
        subscriptionDoc.status = subscription.status;
        subscriptionDoc.cancelAtPeriodEnd = subscription.cancel_at_period_end;
        await subscriptionDoc.save();
      }
    } catch (error) {
      console.error('Handle subscription updated error:', error);
    }
  }

  async handleSubscriptionDeleted(subscription) {
    try {
      const subscriptionDoc = await Subscription.findOne({
        stripeSubscriptionId: subscription.id
      });

      if (subscriptionDoc) {
        subscriptionDoc.status = 'canceled';
        await subscriptionDoc.save();
      }
    } catch (error) {
      console.error('Handle subscription deleted error:', error);
    }
  }

  async handleInvoicePaymentSucceeded(invoice) {
    try {
      // Update subscription status if needed
      if (invoice.subscription) {
        const subscriptionDoc = await Subscription.findOne({
          stripeSubscriptionId: invoice.subscription
        });

        if (subscriptionDoc) {
          subscriptionDoc.status = 'active';
          await subscriptionDoc.save();
        }
      }
    } catch (error) {
      console.error('Handle invoice payment succeeded error:', error);
    }
  }

  async handleInvoicePaymentFailed(invoice) {
    try {
      // Update subscription status if needed
      if (invoice.subscription) {
        const subscriptionDoc = await Subscription.findOne({
          stripeSubscriptionId: invoice.subscription
        });

        if (subscriptionDoc) {
          subscriptionDoc.status = 'past_due';
          await subscriptionDoc.save();
        }
      }
    } catch (error) {
      console.error('Handle invoice payment failed error:', error);
    }
  }

  async getPlanPricing() {
    try {
      const prices = await this.stripe.prices.list({
        active: true,
        expand: ['data.product']
      });

      const plans = {
        Basic: prices.data.find(p => p.product.name === 'Basic Plan'),
        Pro: prices.data.find(p => p.product.name === 'Pro Plan'),
        Premium: prices.data.find(p => p.product.name === 'Premium Plan')
      };

      return plans;
    } catch (error) {
      console.error('Get plan pricing error:', error);
      throw error;
    }
  }
}

module.exports = StripeService; 