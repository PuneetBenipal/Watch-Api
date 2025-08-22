const mongoose = require("mongoose");
const { Schema } = mongoose;

const EscrowSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    buyer: { name: String, email: String, phone: String },
    seller: { name: String, email: String, phone: String },
    amount: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    relatedInvoiceId: { type: Schema.Types.ObjectId, ref: "Invoice" },
    relatedInventoryId: { type: Schema.Types.ObjectId, ref: "Inventory" },
    status: {
      type: String,
      enum: ["initiated", "funded", "released", "canceled"],
      default: "initiated",
      index: true,
    },
    provider: { type: String, default: "internal" },
    providerRef: { type: String },
    timeline: [
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

EscrowSchema.index({ companyId: 1, createdAt: -1 });

module.exports = mongoose.model("Escrow", EscrowSchema);
