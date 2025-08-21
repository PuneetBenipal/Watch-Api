const mongoose = require("mongoose")

const DiscountSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    itemKey: {
        type: String,
        enum: ["PERCENT_OFF_ONCE", "PERCENT_OFF_FIRST_N_MONTHS", "AMOUNT_OFF_ONCE", "TRIAL_DAYS"],
        required: true
    },


    autoApply: { type: Boolean, default: true },
    priority: { type: Number, defautl: 100 },
    stackable: { type: Boolean, default: false },

    appliesToPriceIds: { type: [String], default: [] },

    percentOff: { type: Number, default: null },
    amountOff: { type: Number, default: null },
    currency: { type: String, default: null },
    firstNMonths: { type: Number, default: null },
    trialDays: { type: Number, default: null },

    eligibility: {
        newCustomerOnly: { type: Boolean, default: false },
        companyAllowList: { type: [mongoose.Schema.Types.ObjectId], default: [] },
        minQty: { type: Number, default: 1 },
        maxQty: { type: Number, default: null },
    },

    maxRedemptionsGlobal: { type: Number, default: null },
    maxRedemptionsPerCustomer: { type: Number, default: 1 },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    active: { type: Boolean, default: true },

    stripeCouponId: { type: String, default: null },
    stripePromotionCodeId: { type: String, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

DiscountSchema.pre("save", function (next) {
    const d = this;
    switch (d.itemKey) {
        case "PERCENT_OFF_ONCE":
            if (d.percentOff == null) return next(new Error("PercentOff required"));
            break;
        case 'PERCENT_OFF_FIRST_N_MONTHS':
            if (d.percentOff == null || d.firstNMonths == null)
                return next(new Error('percentOff & firstNMonths required'));
            break;
        case 'AMOUNT_OFF_ONCE':
            if (d.amountOff == null || !d.currency)
                return next(new Error('amountOff & currency required'));
            break;
        case 'TRIAL_DAYS':
            if (d.trialDays == null) return next(new Error('trialDays required'));
            break;
    }
    next();
})

DiscountSchema.index({ active: 1, startsAt: 1, endsAt: 1, priority: 1 });
DiscountSchema.index({ appliesToPriceIds: 1 });

module.exports = mongoose.model("Discount", DiscountSchema);