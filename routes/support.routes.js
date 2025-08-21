const express = require("express");
const multer = require("multer");

const router = express.Router();
const upload = multer({ dest: "uploads/" }); // swap with S3 later
const authenticateToken = require("../middleware/auth.js");
const supportCtrl = require("../controllers/support.ctrl.js")
const { Message, Ticket } = require("../models/Support.js")

const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"];
const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"];

router.post("/tickets", authenticateToken, async (req, res) => {
    const { subject, body, category, priority = "medium" } = req.body || {};
    if (!subject || !body) return res.status(400).json({ error: "subject_and_body_required" });

    const t = await Ticket.create({
        subject,
        category,
        priority,
        requester: { id: req.user._id, fullName: req.user?.fullName, email: req.user?.email },
        accountId: req.user._id,
        lastMessageAt: new Date(),
        messagesCount: 1,
        status: "open",
        channel: "web",
    });

    await Message.create({
        ticketId: t._id,
        type: "public",
        author: { id: req.user.id, fullName: req.user.fullName, role: "user" },
        body,
    });

    res.json({ ok: true, id: t._id });
});

// List my tickets (scoped to accountId)
router.get("/my-tickets", authenticateToken, async (req, res) => {
    const { q, status, page = 1, limit = 20 } = req.query;
    const filter = { accountId: req.user._id };
    if (status) filter.status = status;
    if (q) filter.$or = [
        { subject: new RegExp(q, "i") },
        { "requester.email": new RegExp(q, "i") },
        { tags: q },
    ];
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
        Ticket.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(Number(limit)).lean(),
        Ticket.countDocuments(filter),
    ]);
    res.json({ items, total });
});

// Get one ticket (public messages only)
router.get("/tickets/:id", authenticateToken, async (req, res) => {
    // if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "bad_id" });
    const t = await Ticket.findOne({ _id: req.params.id, accountId: req.user._id }).lean();
    if (!t) return res.status(404).json({ error: "not_found" });
    const messages = await Message.find({ ticketId: t._id, type: "public" }).sort({ createdAt: 1 }).lean();
    res.json({ ...t, messages });
});

// Dealer reply (public). Optional: reopen.
router.post("/tickets/:id/replies", authenticateToken, async (req, res) => {
    const { body } = req.body || {};
    if (!body) return res.status(400).json({ error: "body_required" });
    const t = await Ticket.findOne({ _id: req.params.id, accountId: req.user._id });
    if (!t) return res.status(404).json({ error: "not_found" });

    await Message.create({
        ticketId: t._id,
        type: "public",
        author: req.user._id,
        body,
    });

    t.messagesCount += 1;
    t.lastMessageAt = new Date();
    // keep your status model; uncomment if you use "open"/"pending"
    // if (["pending","solved"].includes(t.status)) t.status = "open";
    await t.save();

    res.json({ ok: true });
});



router.get("/docs", supportCtrl.getDocs);

// Public: get by slug
router.get("/docs/:slug", supportCtrl.getDocsSlug);

// Admin: create/update doc
router.post("/docs", authenticateToken, supportCtrl.addDocs);

router.put("/docs/:slug", authenticateToken, supportCtrl.changeDocs);

router.delete("/docs/:slug", authenticateToken, supportCtrl.deleteDocs);


module.exports = router;