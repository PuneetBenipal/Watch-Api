const jwt = require("jsonwebtoken");
const paginate = require("../services/paginate");
const User = require("../../models/User.model"); // adjust path if different
const { log } = require("../services/audit");
// map frontend terms to DB if needed
const NORMALIZE = {
    status: (s) => s,     // e.g., "active" | "suspended"
    role: (r) => r,     // e.g., "admin"  | "agent"
};

exports.list = async (req, res, next) => {
    try {
        const { page, limit, q, status, role } = req.query;
        const filter = { role: { $ne: "superadmin" } };
        // const filter = {  };
        if (q) filter.$or = [
            { name: { $regex: q, $options: "i" } },
            { email: { $regex: q, $options: "i" } },
            { company: { $regex: q, $options: "i" } },
        ];
        if (status) filter.status = status;
        if (role) filter.role = role;

        const result = await paginate(User, {
            filter,
            select: "fullName email role userKind status companyId createdAt whatsappStatus",
            page, limit,
            sort: { createdAt: -1 },
            lean: true,
            populate: [{ path: "companyId", select: "name" }]
        });
        result.data = result.data.map((item) => {
            item["company"] = item.companyId?.name;
            item["name"] = item.fullName;
            return item;
        })
        res.json(result);
    } catch (e) { next(e); }
};

exports.update = async (req, res, next) => {
    try {
        const id = req.params.id;
        const patch = {};
        ["name", "company", "role", "status", "userKind"].forEach(k => {
            if (req.body[k] != null) patch[k] = NORMALIZE[k] ? NORMALIZE[k](req.body[k]) : req.body[k];
        });
        console.log('====>', req.body, patch)

        const doc = await User.findByIdAndUpdate(id, patch, { new: true, runValidators: true })
            .select("fullName email role userKind status company createdAt").lean();
        if (!doc) return res.status(404).json({ error: "User not found" });
        res.json(doc);
    } catch (e) { next(e); }
};

exports.remove = async (req, res, next) => {
    try {
        const id = req.params.id;
        const del = await User.findByIdAndDelete(id);
        if (!del) return res.status(404).json({ error: "User not found" });
        res.json({ ok: true, id });
    } catch (e) { next(e); }
};

exports.invite = async (req, res, next) => {
    try {
        const { email, name, company, role = "agent" } = req.body || {};
        if (!email) return res.status(400).json({ error: "email required" });

        const exists = await User.findOne({ email: { $regex: `^${email}$`, $options: "i" } }).lean();
        if (exists) return res.status(400).json({ error: "email already exists" });

        // You can generate a temp password or a signup token; here we create a dormant user.
        const user = await User.create({
            email, name: name || email.split("@")[0],
            company: company || "Unassigned",
            role: NORMALIZE.role(role),
            status: "active",
        });

        // TODO: send invite email with magic link or reset token
        // await mailer.sendInvite(email, {...});

        res.status(201).json({
            _id: user._id, name: user.name, email: user.email,
            role: user.role, status: user.status, company: user.company, createdAt: user.createdAt,
        });
    } catch (e) { next(e); }
};

exports.resetPassword = async (req, res, next) => {
    try {
        const id = req.params.id;
        const user = await User.findById(id).select("email").lean();
        if (!user) return res.status(404).json({ error: "User not found" });

        // Generate a reset token you already use in your app, or a one-off
        const token = jwt.sign({ sub: user._id, typ: "pwd_reset" }, process.env.JWT_SECRET, { expiresIn: "15m" });
        // TODO: send email with link containing token
        // await mailer.sendReset(user.email, token);

        res.json({ ok: true });
    } catch (e) { next(e); }
};

exports.impersonate = async (req, res, next) => {
    try {
        const id = req.params.id;
        const target = await User.findById(id).select("email name role company").lean();
        if (!target) return res.status(404).json({ error: "User not found" });

        // short-lived impersonation token
        const token = jwt.sign(
            { sub: target._id, imp: true, by: req.user?._id, scope: "user" },
            process.env.JWT_SECRET,
            { expiresIn: "15m" }
        );

        res.json({ token, user: target });
    } catch (e) { next(e); }
};
