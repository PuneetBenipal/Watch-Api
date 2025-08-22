const Router = require("express").Router();
const authenticateToken = require("../middleware/auth");
const Dispute = require("../models/Dispute");
const requireCompanyFlag = require("../middlewares/requireCompanyFlag");

Router.use(authenticateToken);
Router.use(requireCompanyFlag("disputes"));

// Create
Router.post("/", async (req, res) => {
  try {
    const payload = req.body || {};
    const doc = await Dispute.create({
      companyId: req.user.companyId,
      createdBy: req.user._id,
      ...payload,
    });
    res.status(201).json({ dispute: doc });
  } catch (e) {
    res
      .status(500)
      .json({ error: "Failed to create dispute", detail: e.message });
  }
});

// List
Router.get("/", async (req, res) => {
  try {
    const { q = "", status, limit = 20, page = 1 } = req.query;
    const find = { companyId: req.user.companyId };
    if (status) find.status = status;
    if (q) find.title = { $regex: q, $options: "i" };
    const docs = await Dispute.find(find)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));
    const total = await Dispute.countDocuments(find);
    res.json({ disputes: docs, total });
  } catch (e) {
    res
      .status(500)
      .json({ error: "Failed to list disputes", detail: e.message });
  }
});

// Get one
Router.get("/:id", async (req, res) => {
  try {
    const doc = await Dispute.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json({ dispute: doc });
  } catch (e) {
    res.status(500).json({ error: "Failed to get dispute", detail: e.message });
  }
});

// Update
Router.put("/:id", async (req, res) => {
  try {
    const update = req.body || {};
    update.$push = update.$push || {};
    if (update.status) {
      update.$push.activity = {
        at: new Date(),
        actorId: req.user._id,
        note: update.note || `Status changed to ${update.status}`,
        status: update.status,
      };
    }
    const doc = await Dispute.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user.companyId },
      update,
      { new: true }
    );
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json({ dispute: doc });
  } catch (e) {
    res
      .status(500)
      .json({ error: "Failed to update dispute", detail: e.message });
  }
});

// Delete
Router.delete("/:id", async (req, res) => {
  try {
    const r = await Dispute.deleteOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });
    if (!r.deletedCount) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (e) {
    res
      .status(500)
      .json({ error: "Failed to delete dispute", detail: e.message });
  }
});

module.exports = Router;
