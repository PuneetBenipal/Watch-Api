const router = require("express").Router();
const Entitlement = require("../models/entitlement.model");
const adminAuth = require("../middlewares/adminAuth");

router.post("/grant", adminAuth, async (req, res) => {
  const { accountId, feature, expiresAt, notes } = req.body;
  const ent = await Entitlement.findOneAndUpdate(
    { accountId, feature },
    {
      $set: {
        status: "active",
        expiresAt: expiresAt || null,
        notes,
        source: "admin",
      },
    },
    { upsert: true, new: true }
  );
  res.json(ent);
});

router.post("/revoke", adminAuth, async (req, res) => {
  const { accountId, feature } = req.body;
  const ent = await Entitlement.findOneAndUpdate(
    { accountId, feature },
    { $set: { status: "inactive" } },
    { new: true }
  );
  res.json(ent || { ok: true, message: "already inactive" });
});

router.get("/mine", async (req, res) => {
  const accountId = req.user?.accountId || req.headers["x-account-id"];
  if (!accountId)
    return res.status(401).json({ error: "Account not resolved" });
  const ents = await Entitlement.find({ accountId, status: "active" });
  res.json(ents);
});

module.exports = router;
