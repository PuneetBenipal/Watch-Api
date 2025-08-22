const { stripe } = require("../config/stripe");
const Discount = require("../models/Discount");
const Redemption = require("../models/Redemption");

exports.handle = async (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (error) {
        return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const s = event.data.object;
                const customerId = s.metadata?.customer_id || "unknown";
                const discountId = s.metadata?.applied_discount_id || null;
                const itemKey = s.metadata.applied_item_key || null;

                if (itemKey === "TRIAL_DAYS" && discountId) {
                    await Redemption.create({
                        discountId,
                        customerId,
                        appliedTo: "checkout",
                        stripe: {
                            customerId: s.customer || null,
                            sessionId: s.id,
                            subscriptionId: s.subscription || null,
                        },
                        priceId: s.line_items?.[0].price?.id || null,
                        quantity: s.line_items?.[0]?.quantity || null,
                        amounts: {
                            currency: s.currency || null,
                            subtotal: 0,
                            discount: 0,
                            total: 0
                        },
                        ruleSnapshot: {
                            itemKey: "TRIAL_DAYS",
                            trialDays: Number(s.subscription_data?.trial_period_days) || null,
                        },
                        sourceEvent: event.type
                    })
                }
                break;
            }
            case "invoice.payment_succeeded": {
                const invoice = event.data.object;
                const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id || null;
                const stripeCustomerId = invoice.customer;

                let customerId = invoice.metadata?.customer_id || null;
                let discountId = invoice.metadata?.applied_discount_id || null

                const currency = invoice.currency;
                const subtotal = invoice.amount_subtotal ?? 0;
                const total = invoice.amount_due ?? invoice.amount_total ?? 0;

                let discountAmount = 0;
                if (Array.isArray(invoice.total_discount_amounts)) {
                    for (const d of invoice.total_discount_amounts) discountAmount += d.amount || 0;
                }

                const prev = await Redemption.countDocuments({ discountId, customerId });
                const monthIndex = prev + 1;

                if (discountId && customerId) {
                    const discountDoc = await Discount.findById(discountId);
                    await Redemption.create({
                        discountId,
                        customerId,
                        appliedTo: "invoice",
                        stripe: {
                            customerId: stripeCustomerId,
                            invoiceId: invoice.id,
                            subscriptionId: subId,
                            couponId: invoice.discount?.coupon?.id || null
                        },
                        priceId: invoice.lines?.data?.[0]?.price?.id || null,
                        quantity: invoice.lines?.data?.[0]?.quantity || null,
                        amounts: { currency, subtotal, discount: discountAmount, total },
                        ruleSnapshot: {
                            itemKey: discountDoc?.itemKey || null,
                            percentOff: discountDoc?.percentOff ?? null,
                            amountOff: discountDoc?.percentOff ?? null,
                            currency: discountDoc?.currency ?? null,
                            firstNMonths: discountDoc?.firstNMonths ?? null,
                            trialDays: discountDoc?.trialDays ?? null
                        },
                        period: {
                            start: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
                            end: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
                            monthIndex
                        },
                        sourceEvent: event.type
                    });
                }
                break;
            }
            default:
                break;
        }
        res.json({ received: true });
    } catch (error) {
        console.error('Webhook handler error:', error.message);
        res.status(500).json({ error: 'Webhook handling failed' });
    }
}