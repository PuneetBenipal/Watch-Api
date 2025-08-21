const Features = require("../models/Features.model")
const User = require("../models/User.model");
const PlanCard = require("../models/PlanCards.model");

const FEATURES_SEED = [
    {
        name: "WhatsApp Engine",
        slug: "whatsapp_engine",
        type: "core",
        category: "Core",
        shortDesc: "Core WhatsApp ingestion & automation",
        description:
            "Scrape, parse, and search WhatsApp listings. Powers ingestion, normalization, and internal search.",
        priceMonthly: 20,
        priceYearly: 200,
        currency: "USD",
        trialDays: 3,
        featured: true,
        status: "active",
        sortOrder: 101,
        baseKey: "whatsapp",
        hasLimit: true,
    },
    {
        name: "Add team mate",
        slug: "team_mate",
        type: "core",
        category: "Core",
        shortDesc: "Dealer invite team member.",
        description: "Add you team mate to scale you business",
        priceMonthly: 50,
        priceYearly: 500,
        currency: "USD",
        trialDays: 3,
        featured: true,
        status: "active",
        sortOrder: 102,
        baseKey: "inventory",
        hasLimit: true,
    },
    {
        name: "Inventory",
        slug: "inventory",
        type: "addon",
        category: "Core",
        shortDesc: "Dealer inventory & multi-currency",
        description:
            "Manage watch stock, variants, and availability with multi-currency display and bulk tools.",
        priceMonthly: 20,
        priceYearly: 200,
        currency: "USD",
        trialDays: 3,
        featured: true,
        status: "active",
        sortOrder: 102,
        baseKey: "inventory",
        hasLimit: false,
    },
    {
        name: "Invoicing",
        slug: "invoicing",
        type: "addon",
        category: "Core",
        shortDesc: "Invoices, payments & bookkeeping",
        description:
            "Issue invoices, record payments, export to accounting, and generate PDFs.",
        priceMonthly: 20,
        priceYearly: 200,
        currency: "USD",
        trialDays: 3,
        featured: true,
        status: "active",
        sortOrder: 103,
        baseKey: "invoice",
        hasLimit: false,
    },

    // === AI ===
    {
        name: "AI Insights",
        slug: "ai_insights",
        type: "addon",
        category: "AI",
        shortDesc: "Alerts & market intelligence",
        description:
            "AI-powered alerts on pricing trends, demand signals, and suggested actions.",
        priceMonthly: 20,
        priceYearly: 200,
        currency: "USD",
        trialDays: 3,
        featured: true,
        status: "active",
        sortOrder: 201,
        baseKey: "insight",
        hasLimit: false,
    },
    {
        name: "AI Pricing",
        slug: "ai_pricing",
        type: "addon",
        category: "AI",
        shortDesc: "Auto repricing suggestions",
        description:
            "Suggests competitive prices based on sales velocity, comps, and market signals.",
        priceMonthly: 20,
        priceYearly: 200,
        currency: "USD",
        trialDays: 3,
        featured: false,
        status: "active",
        sortOrder: 202,
        baseKey: "price",
        hasLimit: false,
    },

    // === Premium ===
    {
        name: "Escrow",
        slug: "escrow",
        type: "premium",
        category: "Premium",
        shortDesc: "Secure escrow workflow",
        description:
            "Escrow initiation, status tracking, audit trail and notifications for high-value deals.",
        priceMonthly: 20,
        priceYearly: 200,
        currency: "USD",
        trialDays: 3,
        featured: false,
        status: "active",
        sortOrder: 301,
        baseKey: "escrow",
        hasLimit: false,
    },
    {
        name: "Disputes",
        slug: "disputes",
        type: "premium",
        category: "Premium",
        shortDesc: "Dispute logging & resolution",
        description:
            "Record disputes, attach evidence, manage statuses and outcomes for compliance.",
        priceMonthly: 20,
        priceYearly: 200,
        currency: "USD",
        trialDays: 3,
        featured: false,
        status: "active",
        sortOrder: 302,
        baseKey: "disputes",
        hasLimit: false,
    },
    {
        name: "Rolex Check",
        slug: "rolex_check",
        type: "premium",
        category: "Premium",
        shortDesc: "External verification check",
        description:
            "API-based verification to reduce fraud and increase buyer confidence.",
        priceMonthly: 20,
        priceYearly: 200,
        currency: "USD",
        trialDays: 3,
        featured: false,
        status: "active",
        sortOrder: 303,
        baseKey: "rolex",
        hasLimit: false,
    },

    // === Branding ===
    {
        name: "Custom Domain",
        slug: "custom_domain",
        type: "premium",
        category: "Branding",
        shortDesc: "Use your own domain",
        description:
            "Map your own domain for storefront and shared assets with SSL management.",
        priceMonthly: 20,
        priceYearly: 200,
        currency: "USD",
        trialDays: 3,
        featured: false,
        status: "active",
        sortOrder: 401,
        baseKey: "domain",
        hasLimit: false,
    },
    {
        name: "Branded Invoices",
        slug: "branded_invoices",
        type: "premium",
        category: "Branding",
        shortDesc: "Custom invoice themes",
        description:
            "Brandable PDF templates with logo, colors, and layout presets.",
        priceMonthly: 20,
        priceYearly: 200,
        currency: "USD",
        trialDays: 3,
        featured: false,
        status: "active",
        sortOrder: 402,
        baseKey: "branded",
        hasLimit: false,
    },
];

const superAdmin = {
    email: "superadmin@watchdealerhub.com",
    passwordHash: "superadmin123!@#",
    fullName: "Super Admin",
    role: "superadmin",
    userKind: "admin"
}

const FREE_PLAN = {
    title: "Free",
    code: "FREE",
    description: "Starter plan for evaluation with limited usage.",
    currency: "USD",
    priceMonthly: 0,
    priceYearly: 0,
    stripePriceIdMonthly: null,
    stripePriceIdYearly: null,
    status: "active",
    isPublic: true,
    sortOrder: 0,
    trialDays: 0,

    // Global limits for this plan
    limits: {
        whatsapp_queries_per_month: 100,
        inventory_items: 50,
        invoices_per_month: 5,
        seats: 1,
    },

    // Which modules are included by default for this plan
    modules: [
        { slug: "whatsapp_engine", included: true },
        { slug: "inventory", included: true },
        { slug: "invoicing", included: true },

        { slug: "ai_insights", included: false },
        { slug: "ai_pricing", included: false },
        { slug: "escrow", included: false },
        { slug: "disputes", included: false },
        { slug: "rolex_check", included: false },
        { slug: "custom_domain", included: false },
        { slug: "branded_invoices", included: false }
    ],

    baseKey: "default",

    createdAt: new Date(),
    updatedAt: new Date()
};


const initModules = async () => {
    for (const seed of FEATURES_SEED) {
        let exists = await Features.findOne({ baseKey: seed.baseKey })
        if (!!exists) continue;
        const feature = new Features(seed);
        await feature.save();
    }
}

const initSuperAdmin = async () => {
    const isexists = await User.findOne({ role: "superadmin" });

    if (!isexists) {
        const admin = new User(superAdmin);
        await admin.save();
    }
}

const initFrePlan = async () => {
    let exists = await PlanCard.findOne({ baseKey: FREE_PLAN.baseKey })

    if (exists) return;
    const freePlanCard = new PlanCard(FREE_PLAN);
    freePlanCard.save();
}

module.exports = {
    initModules,
    initSuperAdmin,
    initFrePlan
}