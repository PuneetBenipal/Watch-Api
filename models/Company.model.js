const mongoose = require("mongoose");
const { Schema } = mongoose;

const dailyReportSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["pending", "forwarded"],
      required: true,
    },
    product_name: {
      type: String,
      required: true,
      trim: true,
    },
    product_name_type: {
      type: String,
      enum: ["totally", "some", "never"],
      required: true,
    },
    min_price: {
      type: Number,
      min: 0,
      max: 10000,
    },
    max_price: {
      type: Number,
      min: 0,
      max: 10000,
    },
  },
  {
    timestamps: true,
  }
);

const SeatSchema = new Schema(
  {
    purchased: { type: Number, default: 1 },
    used: { type: Number, default: 1 },
  },
  { _id: true }
);

const EntitlementSchema = new Schema(
  {
    feature: {
      type: String,
      required: true,
      enum: ["whatsapp_search", "inventory"],
    }, // e.g., "whatsapp_search",  "inventory"
    // how to count the feature usage.
    // inventory by date and whatsapp search by count
    // inventory: buy the days to use
    // whatsapp search: buy query
    limits: { type: Number, default: 0 }, // { queriesPerMonth: 500 } etc.
    usage: { type: Number, default: 0 }, // mirrors reports/usage card
    isTrial: { type: Boolean, default: false }, // item to delete
    createdAt: { type: Date, default: Date.now }, // item to delte
    updatedAt: { type: Date, default: Date.now }, // item to delte
    endsAt: { type: Date, default: Date.now }, // item to delete
    enabled: Boolean,
  },
  { _id: true }
);

const FeatureFlagsSchema = new Schema(
  {
    whatsapp_search: { type: Boolean, default: false },
    whatsapp: { type: Boolean, default: false },
    inventory: { type: Boolean, default: false },
    invoicing: { type: Boolean, default: false },
    ai_insights: { type: Boolean, default: false },
    ai_pricing: { type: Boolean, default: false },
    escrow: { type: Boolean, default: false },
    disputes: { type: Boolean, default: false },
    rolex_verification: { type: Boolean, default: false },
    custom_domain: { type: Boolean, default: false },
    branded_invoices: { type: Boolean, default: false },
    api_access: { type: Boolean, default: false },
    integrations_chrono24: { type: Boolean, default: false },
    integrations_shopify: { type: Boolean, default: false },
  },
  { _id: true }
);

const CompanySchema = new Schema(
  {
    name: { type: String, trim: true },
    logoUrl: { type: String, trim: true },

    // Billing (Stripe)
    stripeCustomerId: { type: String, trim: true },
    stripeSubscriptionId: { type: String, trim: true },

    // commercial plan identifier in your app (e.g., "base"|"pro"|"premium")
    planId: {
      type: String,
      enum: ["Basic", "Pro", "Premium"],
      default: "Basic",
    },

    // mirror Stripe subscription status exactly: "trialing"|"active"|"past_due"|"canceled"|"incomplete" etc.
    planStatus: {
      type: String,
      enum: ["trialing", "active", "suspended"],
      default: "trialing",
    },

    // billing cadence (mirror Stripe Price): "month"|"year"
    billingInterval: {
      type: String,
      enum: ["month", "year"],
      default: "month",
    },

    // period window (mirror Stripe subscription.current_period_start/end)
    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date }, // <-- use this instead of/alongside renewalDate

    // legacy/compat: keep if you already reference it in UI; set equal to currentPeriodEnd
    renewalDate: { type: Date },

    // trials & cancellation semantics (mirror Stripe)
    trialStart: { type: Date, default: Date.now() },
    trialEnd: { type: Date },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    canceledAt: { type: Date },

    // usage resets for entitlements (helpful server-side)
    lastUsageResetAt: { type: Date },
    nextUsageResetAt: { type: Date },

    // Seats & entitlements
    seats: SeatSchema,
    entitlements: [EntitlementSchema], // per-feature rules (queries, modules)

    // Feature flags for optional add‑ons/modules
    featureFlags: FeatureFlagsSchema,
    branding: {
      primaryColor: { type: String, default: "#1890ff" },
      secondaryColor: { type: String, default: "#111827" },
      accentColor: { type: String, default: "#10b981" },
      invoiceTemplate: {
        type: String,
        enum: ["classic", "modern"],
        default: "classic",
      },
      headerLogoUrl: { type: String, trim: true },
      footerText: { type: String, trim: true },
      address: { type: String, trim: true },
      enabled: { type: Boolean, default: false },
    },

    // Locale / defaults
    defaultCurrency: { type: String, default: "USD" },
    country: { type: String },
    timezone: { type: String, default: "UTC" },

    purchaseHistory: [
      {
        feature: String,
        amountPaid: String,
        currency: String,
        paidAt: { type: Date, defualt: Date.now },
      },
    ],
    dailyreport: [dailyReportSchema],

    teamMates: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ], // team mates max: seats
  },
  { timestamps: true }
);

CompanySchema.pre("save", function (next) {
  if (!this.trialEnd) {
    this.trialEnd = new Date(this.trialStart);
    this.trialEnd.setDate(this.trialEnd.getDate() + 7);
  }
  next();
});

const Company = mongoose.model("Company", CompanySchema);

module.exports = Company;
