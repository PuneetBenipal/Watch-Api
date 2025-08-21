const Company = require("../models/Company.model.js");
const User = require("../models/User.model.js");
const Payment = require("../models/Payment.model.js");

const PLAN_BASE = {
    basic: { baseSeats: 1, baseQueries: 200 },
    pro: { baseSeats: 3, baseQueries: 500 },
    premium: { baseSeats: 5, baseQueries: 1500 },
};

function sanitizeUser(u) {
    // Minimal fields for table
    return {
        _id: u._id,
        fullName: u.fullName || u.name || "",
        email: u.email,
        role: u.role,
        status: u.status,
        whatsappConnected: u.whatsappConnected,
        isVerified: u.isVerified,
        lastLogin: u.lastLogin,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
    };
}

async function getCompany(companyId) {
    const company = await Company.findById(companyId);
    if (!company) throw new Error("Company not found");
    return company;
}

exports.getPlanSnapshot = async (req, res) => {
    const company = await Company.findById(req.user.companyId).lean();

    // seats
    const seats = company.seats || { purchased: 1, used: 1 };

    // entitlements normalized
    const entitlements = (company.entitlements || []).map(e => ({
        feature: e.feature,
        enabled: e.enabled ?? true,
        limits: typeof e.limits === 'number' ? { queriesPerMonth: e.limits } : (e.limits || {}),
        usedThisPeriod: e.usedThisPeriod ?? e.usage ?? 0,
        isTrial: e.isTrial ?? false,
        endsAt: e.endsAt
    }));

    // pick whatsapp entitlement (for convenience usage block)
    const eWhats = entitlements.find(e => e.feature === 'whatsapp_search');
    const usage = {
        dealer: {
            queriesUsed: eWhats?.usedThisPeriod || 0,
            queriesLimit: eWhats?.limits?.queriesPerMonth || 0
        }
    };

    res.json({
        company: {
            planId: company.planId,
            planStatus: company.planStatus,
            currentPeriodEnd: company.currentPeriodEnd || company.renewalDate || null,
            currentPeriodStart: company.currentPeriodStart,
            renewalDate: company.renewalDate
        },
        seats,
        entitlements,
        usage
    });
}

exports.getPaymentHistory = async (req, res) => {
    const payment = await Payment.find({ companyId: req.user.companyId }).lean();

    res.json({ history: payment })
}

exports.updatePlan = async (req, res) => {
    const { companyId } = req.user;
    const { action, planId, addonDraft = {} } = req.body;

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });

    if (action === "select_plan" && planId) {
        company.planId = planId;
        company.planStatus = "active";                // in real flow, Stripe webhook sets this
        company.renewalDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // placeholder next month
    }

    // Compute seats & entitlements based on current (or newly selected) plan + draft
    const base = PLAN_BASE[company.planId] || PLAN_BASE.pro;

    const extraPacks = Math.max(0, Number(addonDraft.extra_queries_100 ?? 0));
    const addSeats = Math.max(0, Number(addonDraft.additional_seat ?? 0));

    company.seats = {
        purchased: base.baseSeats + addSeats,
        used: Math.min(company.seats?.used || 1, base.baseSeats + addSeats),
    };

    // Build entitlements
    const ents = [];

    // Whatsapp search entitlement: carry usage forward if present
    const existingWA = company.entitlements?.find(e => e.feature === "whatsapp_search");
    ents.push({
        feature: "whatsapp_search",
        enabled: true,
        limits: { queriesPerMonth: base.baseQueries + extraPacks * 100, extraPacks },
        usage: existingWA?.usage || 0,
    });

    // Inventory module (toggle)
    if ((addonDraft.inventory ?? 0) > 0) {
        ents.push({ feature: "inventory", enabled: true, limits: {} });
    }

    company.entitlements = ents;

    // Feature flags (toggles)
    company.featureFlags = {
        ai_pricing: (addonDraft.ai_pricing ?? 0) > 0,
        rolex_verification: (addonDraft.rolex_verification ?? 0) > 0,
        escrow: (addonDraft.escrow ?? 0) > 0,
        disputes: (addonDraft.disputes ?? 0) > 0,
    };

    await company.save();

    res.json({ ok: true, company });
}

exports.getTeam = async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const users = await User.find({
            companyId,
            role: { $ne: "superadmin" },
        }).sort({ createdAt: -1 });

        const company = await Company.findById(companyId).lean();
        const seats = company?.seats || { purchased: 1, used: 1 };

        res.json({
            data: users.map(sanitizeUser),
            seats,
            entitlements: company?.entitlements || [],
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

exports.addTeam = async (req, res) => {
    try {
        const { fullName, email, password, role = "member" } = req.body || {};
        if (!email || !password) return res.status(400).json({ error: "email & password required" });

        const company = await getCompany(req.user.companyId);

        // seat check
        const seats = company.seats || { purchased: 1, used: 0 };
        if ((seats.used || 0) >= (seats.purchased || 1)) {
            return res.status(402).json({ error: "No available seats. Purchase more to add teammates." });
        }

        // create user
        const user = new User({
            fullName: fullName || email.split("@")[0],
            email,
            passwordHash: password, // will hash in pre-save
            role,                   // "user" | "dealer" | "admin" | "superadmin" (we’ll not use superadmin here)
            companyId: company._id,
            defaultCurrency: company.defaultCurrency || "USD",
            region: company.country || "UAE",
            status: "active",
        });

        await user.save();

        // increment used seats
        company.seats = {
            purchased: seats.purchased || 1,
            used: (seats.used || 0) + 1,
        };

        // Optional: keep a list of user ids in teamMates
        if (Array.isArray(company.teamMates)) {
            if (!company.teamMates.some((id) => String(id) === String(user._id))) {
                company.teamMates.push(user._id);
            }
        }

        await company.save();

        res.status(201).json({ data: sanitizeUser(user), seats: company.seats, password });
    } catch (e) {
        // handle duplicate email/etc.
        if (e.code === 11000) {
            return res.status(409).json({ error: "Email already exists" });
        }
        res.status(500).json({ error: e.message });
    }
}

exports.updateTeam = async (req, res) => {
    try {
        const { role, status } = req.body || {};
        const companyId = req.user.companyId;
        const _id = req.params.id;

        // only allow users in same company
        const user = await User.findOne({ _id, companyId });
        if (!user) return res.status(404).json({ error: "User not found" });

        // prevent escalating to superadmin here
        if (role && role === "superadmin") {
            return res.status(400).json({ error: "Cannot set role to superadmin" });
        }

        if (role) user.role = role;
        if (status) user.status = status;

        await user.save();
        res.json({ data: sanitizeUser(user) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

exports.delteTeam = async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const _id = req.params.id;

        if (String(_id) === String(req.user._id)) {
            return res.status(400).json({ error: "You cannot remove yourself" });
        }

        const user = await User.findOne({ _id, companyId });
        if (!user) return res.status(404).json({ error: "User not found" });

        // delete user
        await User.deleteOne({ _id });

        // decrement seats.used (not below 1 if owner is counted; adjust to your rules)
        const company = await Company.findById(companyId);
        if (company) {
            const seats = company.seats || { purchased: 1, used: 1 };
            company.seats = {
                purchased: seats.purchased || 1,
                used: Math.max(0, (seats.used || 0) - 1),
            };
            if (Array.isArray(company.teamMates)) {
                company.teamMates = company.teamMates.filter((id) => String(id) !== String(_id));
            }
            await company.save();
        }

        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}