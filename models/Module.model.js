const mongoose = require("mongoose");

let egCategory = ['general', 'analytics', 'communication', 'security', 'integration'];

const ModuleSchema = new mongoose.Schema({
    name: String,
    slug: String,
    type: String,
    category: String,
    shortDesc: String,
    description: String,
    priceMonthly: Number,
    priceYearly: Number,
    currency: String,
    trialDays: Number,
    featured: Boolean,
    status: String,
    sortOrder: Number,
    iconUrl: String,
    updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

const Module = mongoose.model("Module", ModuleSchema)

module.exports = Module;
