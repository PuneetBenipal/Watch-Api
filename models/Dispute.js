const mongoose = require("mongoose");
const { Schema } = mongoose;

const DisputeSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    counterparty: {
      name: String,
      email: String,
      phone: String,
    },
    relatedInvoiceId: { type: Schema.Types.ObjectId, ref: "Invoice" },
    relatedInventoryId: { type: Schema.Types.ObjectId, ref: "Inventory" },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    status: {
      type: String,
      enum: ["open", "in_review", "resolved", "rejected"],
      default: "open",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    evidence: [
      {
        label: String,
        fileUrl: String,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    activity: [
      {
        at: { type: Date, default: Date.now },
        actorId: { type: Schema.Types.ObjectId, ref: "User" },
        note: String,
        status: String,
      },
    ],
  },
  { timestamps: true }
);

DisputeSchema.index({ companyId: 1, createdAt: -1 });

module.exports = mongoose.model("Dispute", DisputeSchema);
