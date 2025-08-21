const mongoose = require("mongoose");

const PlanCardSchema = new mongoose.Schema({
    title: String,
    code: String,
    description: String,
    currency: String,
    priceMonthly: Number,
    priceYearly: Number,
    stripePriceIdMonthly: String,
    stripePriceIdYearly: String,
    status: String,
    isPublic: Boolean,
    sortOrder: Number,
    trialDays: Number,

    limits: {
        whatsapp_queries_per_month: Number,
        inventory_items: Number,
        invoices_per_month: Number,
        seats: Number,
    },
    whatsapp_queries_per_month: Number,


    modules: [
        { slug: String, included: Boolean },
    ],

    baseKey: String,

    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
})

const PlanCard = mongoose.model("PlanCard", PlanCardSchema);

module.exports = PlanCard;