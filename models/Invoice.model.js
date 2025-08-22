const mongoose = require("mongoose");
const { Schema } = mongoose;

const PAY_METHODS = ["CASH", "WIRE", "CRYPTO", "ESCROW", "CREDIT CARD"];
module.exports.PAY_METHODS = PAY_METHODS;

const LineSchema = new Schema(
  {
    sku: String,
    description: { type: String, required: true },
    qty: { type: Number, min: 1, required: true },
    unit_price: { type: Number, min: 0, required: true },
    line_total: { type: Number, min: 0, required: true }, // qty * unit_price
  },
  { _id: false }
);

// Payment record subdocument
const PaymentSchema = new Schema(
  {
    amount: { type: Number, min: 0, required: true },
    method: { type: String, enum: PAY_METHODS },
    note: { type: String },
    paidAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const InvoiceSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, required: true }, // tenant
    invoice_no: { type: String, required: true, unique: true },

    // Customer
    customer_name: String,
    customer_email: { type: String, required: true },
    customer_phone: { type: String, required: true },
    customer_adress: String,

    // Links
    inventory_watch_id: { type: Schema.Types.ObjectId },

    // Money
    currency: { type: String, default: "USD" },
    items: { type: [LineSchema], default: [] },
    subtotal: { type: Number, required: true },
    tax_rate: { type: Number, default: 0 }, // optional VAT
    tax_amount: { type: Number, default: 0 },
    total: { type: Number, required: true },

    // Payment tracking
    payment_method: { type: String, enum: PAY_METHODS },
    status: {
      type: String,
      enum: ["DRAFT", "SENT", "PAID", "PARTIAL", "VOID"],
      default: "DRAFT",
      index: true,
    },
    paid_amount: { type: Number, default: 0 },
    payments: { type: [PaymentSchema], default: [] },

    // Integrations
    quickbooks_invoice_id: { type: String },
    notes: String,

    // Premium Feature (NEW) ------------------------------
    premium: { type: Boolean, default: false }, // Marks if invoice is for premium customers
    premium_features: [
      {
        feature_name: { type: String }, // e.g. "Priority Support"
        feature_value: { type: String }, // e.g. "Yes / No" or custom value
      },
    ],
    // ---------------------------------------------------

    //endDate: Date,
    dueDate: Date,
  },
  { timestamps: true }
);

// Fast tab loads: tenant + method + recency
InvoiceSchema.index({ companyId: 1, payment_method: 1, createdAt: -1 });

module.exports =
  mongoose.models.Invoice || mongoose.model("Invoice", InvoiceSchema);
