const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  stripeCustomerId: { type: String, required: true },
  plan: {
    type: String,
    enum: ['Basic', 'Pro', 'Premium'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'trialing', 'canceled', 'past_due', 'unpaid'],
    default: 'active'
  },
  usage: {
    whatsappQueries: { type: Number, default: 0 },
    invoices: { type: Number, default: 0 },
    inventoryItems: { type: Number, default: 0 },
    alerts: { type: Number, default: 0 }
  },
  limits: {
    whatsappQueries: { type: Number, default: 100 },
    invoices: { type: Number, default: 50 },
    inventoryItems: { type: Number, default: 100 },
    alerts: { type: Number, default: 10 }
  },
  stripeSubscriptionId: { type: String },
  currentPeriodStart: { type: Date },
  currentPeriodEnd: { type: Date },
  cancelAtPeriodEnd: { type: Boolean, default: false },
  trialEnd: { type: Date },
  metadata: {
    source: {
      type: String,
      default: 'watchdealerhub'
    }
  }
}, {
  timestamps: true
});

// Index for efficient queries
subscriptionSchema.index({ userId: 1 });
subscriptionSchema.index({ stripeCustomerId: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ 'usage.whatsappQueries': 1 });

// Method to check if usage is within limits
subscriptionSchema.methods.isWithinLimits = function (feature) {
  const currentUsage = this.usage[feature] || 0;
  const limit = this.limits[feature] || 0;
  return currentUsage < limit;
};

// Method to increment usage
subscriptionSchema.methods.incrementUsage = function (feature, amount = 1) {
  this.usage[feature] = (this.usage[feature] || 0) + amount;
  return this.save();
};

const Subscription = mongoose.model('Subscription', subscriptionSchema);

module.exports = Subscription; 