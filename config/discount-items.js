// Only allow creating codes for these item types.
// Keep this list fixed at dev-time (your “predefined items”).
module.exports.DISCOUNT_ITEMS = [
    // 1) % off, applied once (e.g., first purchase)
    { key: 'PERCENT_OFF_ONCE', label: 'Percent off (once)' },

    // // 2) % off for first N months of a subscription
    // { key: 'PERCENT_OFF_FIRST_N_MONTHS', label: 'Percent off (first N months)' },

    // // 3) Fixed amount off once
    // { key: 'AMOUNT_OFF_ONCE', label: 'Amount off (once)' },

    // // 4) Free trial days (subscription only)
    // { key: 'TRIAL_DAYS', label: 'Free trial days' }
];
