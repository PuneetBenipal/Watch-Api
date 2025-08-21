const { stripe } = require("../config/stripe");
const { selectAutoDiscount, computeSavingsCents } = require('../services/discountService');

exports.createSubscriptionCheckout = async (req, res, next) => {
    try {
        const { priceId, quantity = 1, successUrl, cancelUrl, customerId, unitAmountCents } = req.body;

        if (!priceId || !successUrl || !cancelUrl || !customerId) {
            return res.status(400).json({ error: 'priceId, successUrl, cancelUrl, customerId required' });
        }

        if (typeof unitAmountCents !== 'number') {
            return res.status(400).json({ error: 'unitAmountCents required for auto-discount ranking' });
        }

        const discount = await selectAutoDiscount({ customerId, priceId, quantity, unitAmountCents });

        const params = {
            mode: "subscription",
            success_url: successUrl,
            cancel_url: cancelUrl,
            line_items: [{ price: priceId, quantity }],
            metadata: {
                customer_id: String(customerId),
                applied_discount_id: discount ? String(discount._id) : "",
                applied_item_key: discount? discount.itemKey: ""
            }
        }

        if (discount) {
            if (discount.itemKey == "TRIAL_DAYS") {
                params.subscription_data = { trial_period_days: discount.trialDays };
            } else if (discount.stripeCouponId) {
                params.discounts = [{ coupon: discount.stripeCouponId }];
            }
        }

        const session = await stripe.checkout.session.create(params);
        res.json({ id: session.id, url: session.url });
    } catch (error) {
        console.log("createSubscriptionCheckout", error.message);
        next(error);
    }
}

exports.previewSubscription = async (req, res, next) => {
    try {
        const { priceId, quantity = 1, customerId, unitAmountCents, currency = 'usd' } = req.body;
        if (!priceId || !customerId || typeof unitAmountCents !== 'number') {
            return res.status(400).json({ error: 'priceId, customerId, unitAmountCents required' });
        }

        const discount = await selectAutoDiscount({ customerId, priceId, quantity, unitAmountCents });
        console.log("discount", discount, priceId)
        const subtotal = unitAmountCents * quantity;
        let discountAmount = 0;
        let trialDays = null;

        if (discount) {
            if (discount.itemKey === 'TRIAL_DAYS') {
                trialDays = discount.trialDays;
            } else {
                discountAmount = computeSavingsCents(discount, unitAmountCents, quantity);
            }
        }

        const total = Math.max(0, subtotal - discountAmount);

        res.json({
            discount: discount ? {
                _id: String(discount._id),
                name: discount.name,
                itemKey: discount.itemKey,
                percentOff: discount.percentOff ?? null,
                amountOff: discount.amountOff ?? null,
                currency: discount.currency ?? null,
                firstNMonths: discount.firstNMonths ?? null,
                trialDays: discount.trialDays ?? null
            } : null,
            pricing: { currency, subtotal, discount: discountAmount, total },
            apply: discount
                ? (discount.itemKey === 'TRIAL_DAYS'
                    ? { trialDays }
                    : { couponId: discount.stripeCouponId })
                : null
        });
    } catch (err) { next(err); }
};
