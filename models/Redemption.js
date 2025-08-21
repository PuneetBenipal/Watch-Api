const mongoose = require("mongoose");
const { Schema } = mongoose;

const RedemptionSchema = new mongoose.Schema({
    discountId: { type: mongoose.Schema.Types.ObjectId, ref: "Discount", required: true },
    customerId: { type: String, required: true },

    stripeCustomerId: { type: String, default: null },
    appliedTo: {
        type: String,
        enum: ["checkout", "invoice", "subscription"],
        default: "checkout"
    },

    stripe: {
        customerId: { type: String, default: null },
        sessionId: { type: String, default: null },        // checkout.session id
        invoiceId: { type: String, default: null },        // invoice id (for recurring)
        subscriptionId: { type: String, default: null },   // subscription id
        couponId: { type: String, default: null },         // coupon actually applied
        promotionCodeId: { type: String, default: null }   // if you ever use codes
    },    

    priceId: { type: String, default: null },            // Stripe price used
    quantity: { type: Number, default: 1 },

    amounts: {
        currency: { type: String, default: null },
        subtotal: { type: Number, default: 0 },            // before discounts/tax
        discount: { type: Number, default: 0 },            // total discount applied
        total: { type: Number, default: 0 }                // after discount (before tax, if you prefer)
    },

    ruleSnapshot: {
        itemKey: { type: String },                         // e.g. PERCENT_OFF_ONCE
        percentOff: { type: Number, default: null },
        amountOff: { type: Number, default: null },
        currency: { type: String, default: null },
        firstNMonths: { type: Number, default: null },
        trialDays: { type: Number, default: null }
    },

    period: {
        start: { type: Date, default: null },              // invoice/charge period start
        end: { type: Date, default: null },                // invoice/charge period end
        monthIndex: { type: Number, default: null }        // 1..N for "first N months"
    },

    sourceEvent: { type: String, default: null },        // e.g., 'checkout.session.completed'
    meta: { type: Schema.Types.Mixed, default: {} }

})

RedemptionSchema.index({ discountId: 1, customerId: 1, createdAt: -1 });

RedemptionSchema.index({ 'stripe.sessionId': 1 }, { unique: true, sparse: true });
RedemptionSchema.index({ 'stripe.invoiceId': 1 }, { unique: true, sparse: true });

RedemptionSchema.index(
    { discountId: 1, customerId: 1, 'period.monthIndex': 1 },
    { unique: true, sparse: true }
);

module.exports = mongoose.model('Redemption', RedemptionSchema);