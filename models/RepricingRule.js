const mongoose = require("mongoose");
const { Schema } = mongoose;

const RepricingRuleSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true },
    conditions: {
      brandRegex: { type: String },
      statusIn: [{ type: String }],
      minPrice: { type: Number },
      maxPrice: { type: Number },
      currency: { type: String },
    },
    actions: {
      percentChange: { type: Number, default: 0 }, // e.g., +5 => increase by 5%
      absoluteChange: { type: Number, default: 0 }, // e.g., -100 => minus $100
      floorPrice: { type: Number },
      ceilingPrice: { type: Number },
      roundTo: { type: Number }, // e.g., 10 => round to nearest 10
    },
    schedule: {
      cadence: { type: String, enum: ["manual", "daily"], default: "manual" },
      lastRunAt: { type: Date },
    },
  },
  { timestamps: true }
);

RepricingRuleSchema.index({ companyId: 1, createdAt: -1 });

module.exports = mongoose.model("RepricingRule", RepricingRuleSchema);
