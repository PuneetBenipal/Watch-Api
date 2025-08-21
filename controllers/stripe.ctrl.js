const Stripe = require("stripe");
const Company = require("../models/Company.model");
const Payment = require("../models/Payment.model");
const User = require("../models/User.model");
let stripe = null;
function getStripeClient() {
  if (stripe) return stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    const msg = "Stripe not configured: missing STRIPE_SECRET_KEY env var";
    console.error(msg);
    throw new Error(msg);
  }
  stripe = new Stripe(key);
  return stripe;
}

const PRICE_LOOKUP = {
  Basic: "price_1Ru4NKFfKeYC8TsCtMRmjzHZ",
  Pro: "price_1RtbRwFfKeYC8TsCDbj7DQGC",
  Premium: "price_1Ru4LYFfKeYC8TsClmmosGBG",
  whatsapp: "price_1RuKoAFfKeYC8TsC4LIAFgpI", // whatsapp query
  price_2: "price_1RuKoaFfKeYC8TsCQJH9Aphx", // addtional user
  price_3: "price_1RuKouFfKeYC8TsCARQq8FXh", // inventory system
  test: "price_1RuM8eFfKeYC8TsCyIBffk1I",
  twenty_five: "price_1RuQuXFfKeYC8TsCmPPpaZ8a",
};

const stripeCtrl = {
  createCheckoutSession: async (req, res) => {
    try {
      const { items = [], mode = "payment", plan } = req.body;

      let planId = PRICE_LOOKUP[plan];

      if (!planId) {
        const line_items = items.map((item) => {
          const base = {
            price_data: {
              currency: "usd",
              unit_amount: Math.round(item.unitUsd * 100),
              product_data: { name: item.name, metadata: { sku: item.sku } },
            },
            quantity: item.qty,
          };
          if (mode === "subscription") {
            base.price_data.recurring = {
              interval: "month",
              interval_count: 1,
            };
          }
          return base;
        });

        const params = {
          mode,
          line_items,
          success_url: `${process.env.USER_CLIENT_URL}/account/billing`,
          cancel_url: `${process.env.USER_CLIENT_URL}/account/plan`,
        };

        // If this is a subscription without a predefined price, attach metadata to the subscription created
        if (mode === "subscription") {
          params.subscription_data = {
            metadata: {
              companyId: req.user?.companyId?.toString(),
              userId: req.user?._id?.toString(),
              feature: "custom_subscription",
            },
          };
        }

        const session =
          await getStripeClient().checkout.sessions.create(params);

        res.json({ url: session.url });
      } else {
        // Map plan key to feature (used in entitlements update)
        const planKey = plan;
        let feature = undefined;
        if (planKey === "whatsapp") feature = "whatsapp_search";
        if (planKey === "price_2") feature = "team_mate";
        if (planKey === "price_3") feature = "inventory";

        const session = await getStripeClient().checkout.sessions.create({
          mode: "subscription",
          payment_method_types: ["card"],
          line_items: [{ price: planId, quantity: 1 }],
          success_url: `${process.env.USER_CLIENT_URL}/account/billing`,
          cancel_url: `${process.env.USER_CLIENT_URL}/account/plan`,
          subscription_data: {
            metadata: {
              companyId: req.user?.companyId.toString(),
              userId: req.user?._id?.toString(),
              planId: planId,
              ...(feature ? { feature } : {}),
            },
          },
        });

        res.json({ url: session.url });
      }
    } catch (err) {
      console.error("createCheckoutSession", err.message);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  },

  webhookHandler: async (req, res) => {
    let event;

    try {
      event = getStripeClient().webhooks.constructEvent(
        req.body, // raw body
        req.headers["stripe-signature"],
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.log("err.message", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;

          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription?.id;
          if (!subId) break; // not a subscription checkout
          const sub = await getStripeClient().subscriptions.retrieve(subId);
          const { companyId, feature } = sub.metadata || {};

          break;
        }

        // Prefer this event name (more common) over invoice.paid
        case "invoice.payment_succeeded": {
          const invoice = event.data.object; // <-- NOT a session
          const amount = invoice.amount_paid / 100; // minor units
          const currency = (invoice.currency || "USD").toUpperCase();
          const paymentId = event.data.object.payment_intent;

          console.log("invoice == >", invoice);

          // Guard: only proceed if this invoice belongs to a subscription
          const subId =
            typeof invoice.subscription === "string"
              ? invoice.subscription
              : invoice.subscription?.id;

          if (!subId) break;

          const sub = await getStripeClient().subscriptions.retrieve(subId);
          const { companyId, userId, planId, feature } = sub.metadata || {};

          console.log("paymentId", paymentId);

          let payment = new Payment({
            companyId: companyId,
            paymentId: paymentId,
            amount: amount,
            currency: currency,
            method: "card",
            status: "paid",
            feature: planId ? feature + "Plan" : feature,
            paidAt: Date.now(),
            createdAt: Date.now(),
          });
          await payment.save();

          const company = await Company.findOne({ _id: companyId });
          const user = await User.findOne({ _id: userId });

          if (!company)
            throw new Error("Company error, We can't find your company.");

          company.purchaseHistory.push({
            feature,
            amountPaid: amount,
            currency,
            paidAt: Date.now(),
          });

          // if (!!planId) {

          // } else {

          // }

          // if (feature == "team_mate") {
          //     company.seats.purchased += 1;
          // }

          // console.log("feature", feature, typeof currency, currency)

          let updatedEntitlements = company.entitlements.map((entitlement) => {
            if (entitlement.feature == feature) {
              switch (feature) {
                case "whatsapp_search":
                  if (amount == 95) {
                    user.whatsappStatus.limit = 500;
                    user.whatsappStatus.paidAt = Date.now();
                    entitlement.limits += 500;
                    entitlement.updatedAt = Date.now();
                  } else if (amount == 20) {
                    entitlement.limits += 100;
                    entitlement.updatedAt = Date.now();
                  }
                  break;
                case "team_mate":
                  if (amount == 25) {
                    entitlement.limits += 1;
                    entitlement.updatedAt = Date.now();
                  }
                  break;
                case "inventory":
                  if (amount == 50) {
                    entitlement.isTrial = false;
                    entitlement.updatedAt = Date.now();
                    let nextEndsAt =
                      new Date(entitlement.endsAt).getTime() +
                      30 * 24 * 60 * 60 * 1000;

                    entitlement.endsAt = new Date(nextEndsAt);
                  }
              }
            }
            return entitlement;
          });

          company.entitlements = updatedEntitlements;

          console.log("payment ", companyId, amount, currency, feature);
          await company.save();
          await user.save();
          break;
        }
      }

      res.json({ received: true });
    } catch (err) {
      console.error("Webhook handler error", err);
      console.error("Webhook handler error", err.message);
      res.status(500).send("Webhook handler failed");
    }
  },
};

module.exports = stripeCtrl;
