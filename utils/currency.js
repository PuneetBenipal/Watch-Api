const ExchangeRate = require("../models/ExchangeRate");

// Supported ISO codes in app context
const SUPPORTED = ["USD", "EUR", "GBP", "AED", "HKD", "JPY"];

function ensureCode(code) {
  const c = String(code || "USD").toUpperCase();
  return SUPPORTED.includes(c) ? c : "USD";
}

async function getLatestRates() {
  return ExchangeRate.getLatest();
}

// Converts amount between currencies using USD as pivot
async function convertAmount(amount, fromCode, toCode) {
  const from = ensureCode(fromCode);
  const to = ensureCode(toCode);
  if (from === to) return Number(amount || 0);

  const rates = await getLatestRates();
  const usdMap = {
    USD: 1,
    EUR: 1 / (rates.usdToEur || 1),
    GBP: 1 / (rates.usdToGbp || 1),
    AED: 1 / (rates.usdToAed || 1),
    HKD: 1 / (rates.usdToHkd || 1),
    JPY: 1 / (rates.usdToJpy || 1),
  };

  const toMap = {
    USD: 1,
    EUR: rates.usdToEur || 1,
    GBP: rates.usdToGbp || 1,
    AED: rates.usdToAed || 1,
    HKD: rates.usdToHkd || 1,
    JPY: rates.usdToJpy || 1,
  };

  const asUsd = Number(amount || 0) * (usdMap[from] || 1);
  const out = asUsd * (toMap[to] || 1);
  return Number(out);
}

async function buildDisplayPrice(amount, fromCode, targetCode) {
  const converted = await convertAmount(amount, fromCode, targetCode);
  return {
    amount: Number(converted.toFixed(2)),
    currency: ensureCode(targetCode),
    original: {
      amount: Number(Number(amount || 0).toFixed(2)),
      currency: ensureCode(fromCode),
    },
  };
}

module.exports = {
  ensureCode,
  getLatestRates,
  convertAmount,
  buildDisplayPrice,
};
