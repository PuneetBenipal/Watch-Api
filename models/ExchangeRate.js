const mongoose = require("mongoose");
const fetch = require("node-fetch");

const exchangeRateSchema = new mongoose.Schema(
  {
    usdToEur: {
      type: Number,
      required: true,
      default: 0.85,
      min: 0,
    },
    usdToGbp: {
      type: Number,
      required: true,
      default: 0.73,
      min: 0,
    },
    usdToAed: {
      type: Number,
      required: true,
      default: 3.67,
      min: 0,
    },
    usdToHkd: {
      type: Number,
      required: true,
      default: 7.8,
      min: 0,
    },
    usdToJpy: {
      type: Number,
      required: true,
      default: 110.0,
      min: 0,
    },
    globalTaxRate: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    defaultCurrency: {
      type: String,
      required: true,
      default: "USD",
      enum: ["USD", "EUR", "GBP", "JPY"],
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    autoUpdate: {
      type: Boolean,
      default: true,
    },
    source: {
      type: String,
      default: "manual",
      enum: ["manual", "api", "scheduled"],
    },
  },
  {
    timestamps: true,
  }
);

// Static method to get the latest exchange rates
exchangeRateSchema.statics.getLatest = async function () {
  let rates = await this.findOne().sort({ createdAt: -1 });

  if (!rates) {
    // Create default rates if none exist
    rates = new this({
      usdToEur: 0.85,
      usdToGbp: 0.73,
      usdToJpy: 110.0,
      globalTaxRate: 0,
      defaultCurrency: "USD",
      source: "manual",
    });
    await rates.save();
  }

  return rates;
};

// Static method to update rates from external API
exchangeRateSchema.statics.updateFromAPI = async function () {
  try {
    // Using a free exchange rate API (you can replace with your preferred API)
    const response = await fetch(
      "https://api.exchangerate-api.com/v4/latest/USD"
    );
    const data = await response.json();

    if (data && data.rates) {
      const newRates = new this({
        usdToEur: data.rates.EUR || 0.85,
        usdToGbp: data.rates.GBP || 0.73,
        usdToAed: data.rates.AED || 3.67,
        usdToHkd: data.rates.HKD || 7.8,
        usdToJpy: data.rates.JPY || 110.0,
        globalTaxRate: 0, // Keep existing tax rate
        defaultCurrency: "USD",
        source: "api",
        lastUpdated: new Date(),
      });

      await newRates.save();
      console.log("✅ Exchange rates updated from API");
      return newRates;
    }
  } catch (error) {
    console.error("❌ Failed to update exchange rates from API:", error);
    throw error;
  }
};

// Method to format rates for frontend
exchangeRateSchema.methods.toFrontendFormat = function () {
  return {
    usdToEur: this.usdToEur,
    usdToGbp: this.usdToGbp,
    usdToAed: this.usdToAed,
    usdToHkd: this.usdToHkd,
    usdToJpy: this.usdToJpy,
    globalTaxRate: this.globalTaxRate,
    defaultCurrency: this.defaultCurrency,
    lastUpdated: this.lastUpdated,
    autoUpdate: this.autoUpdate,
    source: this.source,
  };
};

module.exports = mongoose.model("ExchangeRate", exchangeRateSchema);
