// controllers/crm.controller.js
const Contact = require("../models/Contact.model.js");
const { contactsToCsv, parseContactsCsv } = require("../utils/csv.js");

/** Build Mongo filter from query */
const buildFilter = (companyId, q) => {
    const {
        type,
        country,
        tags,
        search,
        from,
        to,
    } = q;

    const filter = { companyId };
    if (type) filter.type = type; // 'dealer'|'customer'
    if (country) filter.country = country;

    // tags[]=... (array) or tags=... (single)
    const tagsArr = Array.isArray(tags) ? tags : (tags ? [tags] : []);
    if (tagsArr.length) filter.tags = { $in: tagsArr };

    // date range on lastContactedAt OR createdAt
    if (from || to) {
        const gte = from ? new Date(from) : undefined;
        const lte = to ? new Date(to) : undefined;
        filter.$or = [
            { lastContactedAt: { ...(gte ? { $gte: gte } : {}), ...(lte ? { $lte: lte } : {}) } },
            { createdAt: { ...(gte ? { $gte: gte } : {}), ...(lte ? { $lte: lte } : {}) } },
        ];
    }

    // search across fields
    if (search) {
        const rx = new RegExp(escapeRegex(search), "i");
        filter.$and = (filter.$and || []).concat([{
            $or: [
                { companyName: rx },
                { fullName: rx },
                { contactPerson: rx },
                { whatsapp: rx },
                { phone: rx },
                { email: rx },
                { city: rx },
            ],
        }]);
    }

    return filter;
};

const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

exports.listContacts = async (req, res, next) => {
    try {
        const companyId = req.user.companyId;
        const {
            page = 1,
            limit = 10,
            sort = "createdAt",
            order = "desc",
        } = req.query;

        const filter = buildFilter(companyId, req.query);
        const sortDir = String(order).toLowerCase() === "asc" ? 1 : -1;
        const sortObj = { [sort]: sortDir, _id: sortDir }; // stable tiebreaker

        const [data, total] = await Promise.all([
            Contact.find(filter)
                .sort(sortObj)
                .skip((Number(page) - 1) * Number(limit))
                .limit(Number(limit))
                .lean(),
            Contact.countDocuments(filter),
        ]);

        res.json({ data, total });
    } catch (err) {
        console.log('error list contact ==>', err.message)
        next(err);
    }
}

exports.getContact = async (req, res, next) => {
    try {
        const doc = await Contact.findOne({
            _id: req.params.id,
            companyId: req.user.companyId,
        }).lean();
        if (!doc) return res.status(404).json({ message: "Not found" });
        res.json(doc);
    } catch (err) {
        next(err);
    }
}

exports.createContact = async (req, res, next) => {
    try {
        const companyId = req.user.companyId;
        const payload = sanitizePayload(req.body);
        if (!payload.type || !["dealer", "customer"].includes(payload.type)) {
            return res.status(400).json({ message: "type must be dealer|customer" });
        }
        const created = await Contact.create({ ...payload, companyId });
        res.status(201).json(created);
    } catch (err) {
        next(err);
    }
}

exports.updateContact = async (req, res, next) => {
    try {
        const payload = sanitizePayload(req.body);
        const updated = await Contact.findOneAndUpdate(
            { _id: req.params.id, companyId: req.user.companyId },
            { $set: payload },
            { new: true }
        );
        if (!updated) return res.status(404).json({ message: "Not found" });
        res.json(updated);
    } catch (err) {
        next(err);
    }
}

exports.deleteContact = async (req, res, next) => {
    try {
        const result = await Contact.findOneAndDelete({
            _id: req.params.id,
            companyId: req.user.companyId,
        });
        if (!result) return res.status(404).json({ message: "Not found" });
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
}

exports.importContacts = async (req, res, next) => {
    try {
        if (!req.file?.buffer) {
            return res.status(400).json({ message: "No file uploaded" });
        }
        const rows = parseContactsCsv(req.file.buffer);

        let inserted = 0;
        let updated = 0;
        const errors = [];

        for (const [i, row] of rows.entries()) {
            try {
                const payload = sanitizePayload(row);
                if (!payload.type) payload.type = payload.companyName ? "dealer" : "customer";
                if (!["dealer", "customer"].includes(payload.type)) {
                    throw new Error("Invalid type");
                }
                payload.companyId = req.user.companyId;
                // upsert by email or whatsapp (prefer email)
                const key = payload.email ? { email: payload.email } : (payload.whatsapp ? { whatsapp: payload.whatsapp } : null);
                if (!key) throw new Error("Missing identifier (email or whatsapp)");

                const resUp = await Contact.findOneAndUpdate(
                    { companyId: req.user.companyId, ...key },
                    { $set: payload },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
                if (resUp && resUp.createdAt && resUp.updatedAt && resUp.createdAt.getTime() === resUp.updatedAt.getTime()) {
                    inserted += 1;
                } else {
                    updated += 1;
                }
            } catch (e) {
                errors.push({ row: i + 1, error: e.message });
            }
        }

        res.json({ inserted, updated, errors });
    } catch (err) {
        next(err);
    }
}

exports.exportContacts = async (req, res, next) => {
    try {
        const companyId = req.user.companyId;
        const filter = buildFilter(companyId, req.query);
        const rows = await Contact.find(filter).sort({ createdAt: -1 }).lean();
        const csv = contactsToCsv(rows);

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", "attachment; filename=\"contacts.csv\"");
        res.send(csv);
    } catch (err) {
        next(err);
    }
}

/** allowlist fields from body */
function sanitizePayload(b = {}) {
    const allowed = [
        "type",
        "companyName",
        "fullName",
        "contactPerson",
        "whatsapp",
        "phone",
        "email",
        "country",
        "city",
        "defaultCurrency",
        "tags",
        "notes",
        "lastContactedAt",
        "lifetimeValue",
    ];
    const out = {};
    for (const k of allowed) {
        if (b[k] !== undefined) out[k] = b[k];
    }
    // normalize
    if (out.tags && typeof out.tags === "string") {
        out.tags = out.tags.split(",").map(s => s.trim()).filter(Boolean);
    }
    if (out.lastContactedAt && typeof out.lastContactedAt === "string") {
        const d = new Date(out.lastContactedAt);
        if (!isNaN(d)) out.lastContactedAt = d;
    }
    return out;
}
