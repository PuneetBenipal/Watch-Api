const { stripe } = require("../config/stripe")
const Discount = require("../models/Discount");
const Redemption = require("../models/Redemption")
const { DISCOUNT_ITEMS } = require('../config/discount-items');

function isActive(d) {
    const now = new Date();
    if (!d.active) return false;
    if (d.startsAt && now < d.startsAt) return false;
    if (d.endsAt && now > d.endsAt) return false;
    return true;
}

async function customerUsageCount(discountId, customerId) {
    return Redemption.countDocuments({ discountId, customerId });
}

function computeSavingsCents(discount, unitAmountCents, qty) {
    const subtotal = unitAmountCents * qty;
    switch (discount.itemKey) {
        case 'PERCENT_OFF_ONCE':
            return Math.floor((subtotal * discount.percentOff) / 100);
        case 'PERCENT_OFF_FIRST_N_MONTHS':
            // First charge (month 1) discount amount; months 2..N will be recorded on invoices.
            return Math.floor((subtotal * discount.percentOff) / 100);
        case 'AMOUNT_OFF_ONCE':
            return Math.min(discount.amountOff, subtotal);
        case 'TRIAL_DAYS':
            return 0; // handled via trial, no immediate money off
        default:
            return 0;
    }
}

/** Ensure a Stripe coupon exists (auto-apply path uses coupons, not promotion codes) */
async function ensureStripeCoupon(discount) {
    if (discount.itemKey === 'TRIAL_DAYS') return discount; // no coupon needed
    if (discount.stripeCouponId) return discount;

    let couponParams = {};
    if (discount.itemKey === 'PERCENT_OFF_ONCE') {
        couponParams = { percent_off: discount.percentOff, duration: 'once' };
    } else if (discount.itemKey === 'PERCENT_OFF_FIRST_N_MONTHS') {
        couponParams = { percent_off: discount.percentOff, duration: 'repeating', duration_in_months: discount.firstNMonths };
    } else if (discount.itemKey === 'AMOUNT_OFF_ONCE') {
        couponParams = { amount_off: discount.amountOff, currency: discount.currency, duration: 'once' };
    } else {
        throw new Error('Unsupported itemKey for coupon');
    }

    const c = await stripe.coupons.create(couponParams);
    discount.stripeCouponId = c.id;
    await discount.save();
    return discount;
}

/** Pick the best eligible auto-apply discount for this request */
async function selectAutoDiscount({ customerId, priceId, quantity, unitAmountCents }) {
    const candidates = await Discount.find({
        autoApply: true,
        $or: [{ appliesToPriceIds: [] }, { appliesToPriceIds: priceId }]
    }).sort({ priority: 1, createdAt: -1 });

    let best = null;
    let bestSavings = 0;

    for (const d of candidates) {
        if (!isActive(d)) continue;

        // Quantity gates
        const { eligibility = {} } = d;
        if (eligibility.minQty && quantity < eligibility.minQty) continue;
        if (eligibility.maxQty && quantity > eligibility.maxQty) continue;

        // Allowlist gate
        if (eligibility.companyAllowlist?.length) {
            const ok = eligibility.companyAllowlist.some(id => String(id) === String(customerId));
            if (!ok) continue;
        }

        // Per-customer cap
        if (d.maxRedemptionsPerCustomer) {
            const used = await customerUsageCount(d._id, customerId);
            if (used >= d.maxRedemptionsPerCustomer) continue;
        }

        // Compute savings for ranking (TRIAL_DAYS = 0 immediate)
        const savings = computeSavingsCents(d, unitAmountCents, quantity);
        if (savings > bestSavings) {
            best = d;
            bestSavings = savings;
        } else if (savings === bestSavings && best && d.priority < best.priority) {
            best = d; // tie-break on priority
        }
    }

    // Ensure coupon for non-trial
    if (best && best.itemKey !== 'TRIAL_DAYS') {
        best = await ensureStripeCoupon(best);
    }

    return best; // may be null
}

function ensureAllowedItemKey(itemKey) {
    const ok = DISCOUNT_ITEMS.some(i => i.key === itemKey);
    if (!ok) throw new Error('Item key not allowed');
}

function resolveStripeCouponPayload(discount) {
    // Build the Stripe coupon from our internal definition
    // NOTE: Currency only required for amount_off
    switch (discount.itemKey) {
        case 'PERCENT_OFF_ONCE':
            if (!discount.percentOff) throw new Error('percentOff required');
            return { percent_off: discount.percentOff, duration: 'once' };

        case 'PERCENT_OFF_FIRST_N_MONTHS':
            if (!discount.percentOff || !discount.firstNMonths) throw new Error('percentOff & firstNMonths required');
            return { percent_off: discount.percentOff, duration: 'repeating', duration_in_months: discount.firstNMonths };

        case 'AMOUNT_OFF_ONCE':
            if (!discount.amountOff || !discount.currency) throw new Error('amountOff & currency required');
            return { amount_off: discount.amountOff, currency: discount.currency, duration: 'once' };

        case 'TRIAL_DAYS':
            if (!discount.trialDays) throw new Error('trialDays required');
            // Stripe: create a 100% off repeating coupon for N months OR rely on trial
            // Easiest: use Stripe's subscription trial at checkout instead of a coupon.
            // So for TRIAL_DAYS we may not create a coupon; we store intent and apply `subscription_trial_period_days` later.
            return null;

        default:
            throw new Error('Unsupported itemKey');
    }
}

async function syncStripeArtifacts(discount) {
    ensureAllowedItemKey(discount.itemKey);

    // Create/Update coupon if applicable
    let couponId = discount.stripeCouponId || null;
    const couponPayload = resolveStripeCouponPayload(discount);

    if (couponPayload) {
        if (!couponId) {
            const created = await stripe.coupons.create(couponPayload);
            couponId = created.id;
        } else {
            // Stripe coupons are mostly immutable; safer path: create a new one if changes are needed.
            // For simplicity we won’t update existing coupons here.
        }
    }

    let promoId = discount.stripePromotionCodeId || null;
    if (couponId) {
        if (!promoId) {
            const params = {
                coupon: couponId,
                code: discount.code,
                active: discount.active,
            };
            if (discount.maxRedemptionsGlobal) params.max_redemptions = discount.maxRedemptionsGlobal;
            if (discount.startsAt) params.expires_at = Math.floor(new Date(discount.endsAt || discount.startsAt).getTime() / 1000); // optional
            if (discount.appliesToPriceIds?.length) {
                params.restrictions = { applies_to: { prices: discount.appliesToPriceIds } };
            }
            const pc = await stripe.promotionCodes.create(params);
            promoId = pc.id;
        } else {
            await stripe.promotionCodes.update(promoId, { active: discount.active });
        }
    }

    discount.stripeCouponId = couponId;
    discount.stripePromotionCodeId = promoId;
    return discount.save();
}



module.exports = {
    selectAutoDiscount,
    ensureStripeCoupon,
    computeSavingsCents,
    syncStripeArtifacts
}