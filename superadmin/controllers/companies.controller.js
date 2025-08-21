const paginate = require("../services/paginate");
const Company = require("../../models/Company.model"); // adjust path to your model
const { features } = require("../config");

// Map/normalize inputs if your DB uses different enums/paths
const ALLOWED_PLAN_STATUS = new Set(["active", "past_due", "canceled", "trialing"]);

exports.list = async (req, res, next) => {
    try {
        const { q, status, plan, page, limit } = req.query;
        const filter = {};
        if (q) {
            filter.$or = [
                { name: { $regex: q, $options: "i" } },
                { planId: { $regex: q, $options: "i" } },
                { planStatus: { $regex: q, $options: "i" } },
            ];
        }
        if (status) filter.planStatus = status;
        if (plan) filter.planId = plan;

        const result = await paginate(Company, {
            filter,
            select: "name planId planStatus renewalDate seats featureFlags createdAt teamMates",
            sort: { createdAt: -1 },
            page,
            limit,
            populate: [{ path: "teamMates", select: "fullName email role" }],
            lean: true,
        });
        res.json(result);
    } catch (e) { next(e); }
};

exports.detail = async (req, res, next) => {
    try {
        const doc = await Company.findById(req.params.id)
            .select("fullName planId planStatus renewalDate seats featureFlags entitlements createdAt")
            .lean();
        if (!doc) return res.status(404).json({ error: "Company not found" });
        res.json(doc);
    } catch (e) { next(e); }
};

// PATCH /:id/billing
exports.updateBilling = async (req, res, next) => {
    try {
        const { planId, planStatus, renewalDate, seatsPurchased } = req.body || {};
        const $set = {};
        if (planId != null) $set.planId = String(planId);
        if (planStatus != null) {
            const v = String(planStatus);
            if (!ALLOWED_PLAN_STATUS.has(v)) return res.status(400).json({ error: "invalid planStatus" });
            $set.planStatus = v;
        }
        if (renewalDate != null) $set.renewalDate = renewalDate ? new Date(renewalDate) : null;
        if (seatsPurchased != null) $set["seats.purchased"] = Number(seatsPurchased);

        if (!Object.keys($set).length) return res.status(400).json({ error: "no fields to update" });

        const doc = await Company.findByIdAndUpdate(req.params.id, { $set }, { new: true, runValidators: true })
            .select("fullName planId planStatus renewalDate seats featureFlags")
            .lean();

        if (!doc) return res.status(404).json({ error: "Company not found" });
        res.json(doc);
    } catch (e) { next(e); }
};

// PATCH /:id/modules
// body example:
// { inventory: true, rolex_verification: false, whatsapp_search: true, whatsapp_search_limit: 500 }
exports.updateModules = async (req, res, next) => {
    try {
        const body = req.body || {};
        const ffPath = "featureFlags";
        const entPath = "entitlements.limits";

        const patch = {};

        // toggle known flags (add more if you have them)
        features.forEach((k) => {
            if (body[k] != null) patch[`${ffPath}.${k}`] = !!body[k];
        });
        console.log(req.body)
        // optional per-feature limits (example: queries per month)
        if (body.whatsapp_search_limit != null) {
            patch[`${entPath}.whatsapp_search.queriesPerMonth`] = Number(body.whatsapp_search_limit);
        }
        console.log(' == = = + + + >', patch)
        if (!Object.keys(patch).length) return res.status(400).json({ error: "no fields to update" });


        const doc = await Company.findByIdAndUpdate(req.params.id, { $set: patch })
            .select("fullName planId planStatus renewalDate seats featureFlags entitlements")
            .lean();

        if (!doc) return res.status(404).json({ error: "Company not found" });
        res.json(doc);
    } catch (e) {
        console.log('===', e.message)
        next(e);
    }
};
