const DocArticle = require("../models/DocArticle.model");
const SupportTicket = require("../models/Support")
const slugify = require("slugify");

exports.addTickets = async (req, res) => {
    const { subject, body, category, priority = "medium", requester } = req.body;
    const t = await Ticket.create({
        subject, category, priority,
        requester, accountId: requester?.accountId,
        lastMessageAt: new Date(), messagesCount: 1,
    });
    await Message.create({
        ticketId: t._id, type: "public",
        author: { id: requester?.id, name: requester?.name || "User", role: "user" },
        body,
    });
    res.json({ ok: true, id: t._id });
}

exports.getTickets = async (req, res) => {
    try {
        const { status, q } = req.query;
        const filter = { companyId: req.user.companyId };
        if (status) filter.status = status;
        if (q) filter.subject = { $regex: q, $options: "i" };
        const rows = await SupportTicket.find(filter).sort({ createdAt: -1 }).limit(200);
        res.json({ ok: true, data: rows });
    } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
    }
}

exports.getTicket = async (req, res) => {
    try {
        const row = await SupportTicket.findOne({ _id: req.params.id, companyId: req.user.companyId });
        if (!row) return res.status(404).json({ ok: false, error: "Not found" });
        res.json({ ok: true, data: row });
    } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
    }
}

exports.replyTicket = async (req, res) => {
    try {
        const { body } = req.body;
        const row = await SupportTicket.findOne({ _id: req.params.id, companyId: req.user.companyId });
        if (!row) return res.status(404).json({ ok: false, error: "Not found" });
        row.messages.push({ authorId: req.user._id, authorRole: "user", body });
        await row.save();
        res.json({ ok: true, data: row });
    } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
    }
}

exports.close = async (req, res) => {
    try {
        const row = await SupportTicket.findOneAndUpdate(
            { _id: req.params.id, companyId: req.user.companyId },
            { status: "closed", closedAt: new Date() },
            { new: true }
        );
        if (!row) return res.status(404).json({ ok: false, error: "Not found" });
        res.json({ ok: true, data: row });
    } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
    }
}

exports.getDocs = async (req, res) => {
    try {
        const { category, q } = req.query;
        const filter = { isPublished: true };
        if (category) filter.category = category;
        if (q) filter.$or = [
            { title: { $regex: q, $options: "i" } },
            { content: { $regex: q, $options: "i" } },
            { tags: { $in: [new RegExp(q, "i")] } },
        ];
        const rows = await DocArticle.find(filter).sort({ updatedAt: -1 }).limit(200);
        res.json({ ok: true, data: rows });
    } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
    }
}

exports.getDocsSlug = async (req, res) => {
    try {
        const row = await DocArticle.findOne({ slug: req.params.slug, isPublished: true });
        if (!row) return res.status(404).json({ ok: false, error: "Not found" });
        // count view
        row.views += 1; await row.save();
        res.json({ ok: true, data: row });
    } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
    }
}

exports.addDocs = async (req, res) => {
    try {
        const { title, content, category, tags = [], isPublished = true } = req.body;
        const slug = slugify(title, { lower: true, strict: true });
        const doc = await DocArticle.create({
            title, slug, content, category, tags, isPublished,
            updatedBy: req.user._id,
        });
        res.json({ ok: true, data: doc });
    } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
    }
}

exports.changeDocs = async (req, res) => {
    try {
        const updates = { ...req.body, updatedBy: req.user._id };
        if (updates.title) updates.slug = slugify(updates.title, { lower: true, strict: true });
        const doc = await DocArticle.findOneAndUpdate({ slug: req.params.slug }, updates, { new: true });
        if (!doc) return res.status(404).json({ ok: false, error: "Not found" });
        res.json({ ok: true, data: doc });
    } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
    }
}

exports.deleteDocs = async (req, res) => {
    try {
        const doc = await DocArticle.findOneAndDelete({ slug: req.params.slug });
        if (!doc) return res.status(404).json({ ok: false, error: "Not found" });
        res.json({ ok: true, data: true });
    } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
    }
}