const router = require("express").Router();
const { Message, Ticket } = require("../../models/Support")
const { isAuth } = require("../../middlewares/auth.middleware")

// list & detail
router.get("/tickets", isAuth, async (req, res) => {
    const { q, status, priority, assignee, category, page = 1, limit = 20, sort = "updatedAt:-1" } = req.query;
    const [sf, so] = sort.split(":"); const sortObj = { [sf]: Number(so) || -1 };

    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignee) filter["assignee.id"] = assignee === "me" ? req.user.id : assignee;
    if (category) filter.category = category;
    if (q) {
        // simple OR search
        filter.$or = [
            { subject: new RegExp(q, "i") },
            { "requester.email": new RegExp(q, "i") },
            { tags: q },
        ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
        Ticket.find(filter).sort(sortObj).skip(skip).limit(Number(limit)).lean(),
        Ticket.countDocuments(filter),
    ]);
    res.json({ items, total });
});


router.get("/tickets/:id", isAuth, async (req, res) => {
    const t = await Ticket.findById(req.params.id).lean();
    if (!t) return res.status(404).json({ error: "not_found" });
    const messages = await Message.find({ ticketId: t._id }).sort({ createdAt: 1 }).lean();
    res.json({ ...t, messages });
});


// create & update
router.patch("/tickets/:id", isAuth, async (req, res) => {
    const { status, priority, assigneeId, tags, category } = req.body;
    const update = {};
    if (status) update.status = status;
    if (priority) update.priority = priority;
    if (category) update.category = category;
    if (tags) update.tags = tags;
    if (assigneeId) update.assignee = { id: assigneeId, name: assigneeId === "me" ? "Me" : "Agent" };
    const t = await Ticket.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json(t);
});

router.post("/tickets/bulk", isAuth, async (req, res) => {
    const { ids = [], action, payload = {} } = req.body;
    if (!ids.length) return res.json({ ok: true, updated: 0 });

    if (action === "status") {
        const r = await Ticket.updateMany({ _id: { $in: ids } }, { $set: { status: payload.status } });
        return res.json({ ok: true, updated: r.modifiedCount });
    }
    if (action === "assignee") {
        const assignee = { id: payload.assigneeId, name: payload.assigneeId === "me" ? "Me" : "Agent" };
        const r = await Ticket.updateMany({ _id: { $in: ids } }, { $set: { assignee } });
        return res.json({ ok: true, updated: r.modifiedCount });
    }
    if (action === "close") {
        const r = await Ticket.updateMany({ _id: { $in: ids } }, { $set: { status: "closed" } });
        return res.json({ ok: true, updated: r.modifiedCount });
    }
    res.json({ ok: true, updated: 0 });
});


// replies (message timeline)
router.post("/tickets/:id/replies", isAuth, async (req, res) => {
    const { type = "public", body } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: "not_found" });

    await Message.create({
        ticketId: ticket._id, type,
        author: { id: req.user._id, role: req.user.role === "super_admin" ? "admin" : "agent" },
        body,
    });

    ticket.messagesCount += 1;
    ticket.lastMessageAt = new Date();
    if (type === "public" && ticket.status === "open") ticket.status = "pending";
    await ticket.save();

    res.json({ ok: true });
});


module.exports = router;
