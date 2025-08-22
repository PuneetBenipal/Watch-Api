const Router = require("express").Router();
const authenticateToken = require("../middleware/auth");
const Escrow = require("../models/Escrow");
const requireCompanyFlag = require("../middlewares/requireCompanyFlag");

Router.use(authenticateToken);
Router.use(requireCompanyFlag("escrow"));

// Create escrow
Router.post("/", async (req, res) => {
  try {
    const payload = req.body || {};
    const doc = await Escrow.create({
      companyId: req.user.companyId,
      createdBy: req.user._id,
      ...payload,
      timeline: [
        {
          actorId: req.user._id,
          note: "Escrow initiated",
          status: "initiated",
        },
      ],
    });
    res.status(201).json({ escrow: doc });
  } catch (e) {
    res
      .status(500)
      .json({ error: "Failed to create escrow", detail: e.message });
  }
});

// List escrows
Router.get("/", async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const find = { companyId: req.user.companyId };
    if (status) find.status = status;
    const docs = await Escrow.find(find)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));
    const total = await Escrow.countDocuments(find);
    res.json({ escrows: docs, total });
  } catch (e) {
    res
      .status(500)
      .json({ error: "Failed to list escrows", detail: e.message });
  }
});

// Update status
Router.post("/:id/status", async (req, res) => {
  try {
    const { status, note } = req.body || {};
    const doc = await Escrow.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user.companyId },
      {
        status,
        $push: {
          timeline: {
            at: new Date(),
            actorId: req.user._id,
            note: note || `Status changed to ${status}`,
            status,
          },
        },
      },
      { new: true }
    );
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json({ escrow: doc });
  } catch (e) {
    res
      .status(500)
      .json({ error: "Failed to update escrow", detail: e.message });
  }
});

module.exports = Router;
