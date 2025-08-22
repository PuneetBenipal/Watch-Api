const mongoose = require("mongoose");

const EntitlementSchema = new mongoose.Schema(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    feature: { type: String, required: true, index: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    notes: String,
    source: {
      type: String,
      enum: ["admin", "stripe", "trial"],
      default: "admin",
    },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

EntitlementSchema.index({ accountId: 1, feature: 1 }, { unique: true });

module.exports = mongoose.model("Entitlement", EntitlementSchema);
