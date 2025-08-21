const mongoose = require("mongoose");

let egCategory = ['general', 'analytics', 'communication', 'security', 'integration'];

const FeaturesSchema = new mongoose.Schema({
    name: String,
    slug: String,
    type: String,
    category: String,
    shortDesc: String,
    description: String,
    priceMonthly: Number,
    limitMonthly: Number,
    priceYearly: Number,
    limitYearly: Number,
    currency: String,
    trialDays: Number,
    featured: Boolean,
    status: String,
    sortOrder: Number,
    isActive: Boolean,
    baseKey: String,

    hasLimit: Boolean,

    updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

const Features = mongoose.model("Feature", FeaturesSchema)

module.exports = Features;
