const Router = require("express").Router();
const authenticateToken = require("../middleware/auth");
const requireCompanyFlag = require("../middlewares/requireCompanyFlag");
const RepricingRule = require("../models/RepricingRule");
const { Inventory } = require("../models/inventory");

Router.use(authenticateToken);
Router.use(requireCompanyFlag("ai_pricing"));

// CRUD rules
Router.post("/rules", async (req, res) => {
  try {
    const rule = await RepricingRule.create({
      companyId: req.user.companyId,
      ...req.body,
    });
    res.status(201).json({ rule });
  } catch (e) {
    res.status(500).json({ error: "Failed to create rule", detail: e.message });
  }
});

Router.get("/rules", async (req, res) => {
  try {
    const rules = await RepricingRule.find({
      companyId: req.user.companyId,
    }).sort({ createdAt: -1 });
    res.json({ rules });
  } catch (e) {
    res.status(500).json({ error: "Failed to list rules", detail: e.message });
  }
});

Router.put("/rules/:id", async (req, res) => {
  try {
    const rule = await RepricingRule.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user.companyId },
      req.body,
      { new: true }
    );
    if (!rule) return res.status(404).json({ error: "Not found" });
    res.json({ rule });
  } catch (e) {
    res.status(500).json({ error: "Failed to update rule", detail: e.message });
  }
});

Router.delete("/rules/:id", async (req, res) => {
  try {
    const r = await RepricingRule.deleteOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });
    if (!r.deletedCount) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete rule", detail: e.message });
  }
});

// Preview changes for a rule without applying
Router.post("/rules/:id/preview", async (req, res) => {
  try {
    const rule = await RepricingRule.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });
    if (!rule) return res.status(404).json({ error: "Not found" });
    const items = await queryInventoryForRule(
      req.user.companyId,
      rule.conditions
    );
    const changes = items.map((it) => ({
      id: it._id,
      from: it.priceListed,
      to: computeNewPrice(it.priceListed, rule.actions),
    }));
    res.json({ items: items.length, changes });
  } catch (e) {
    res.status(500).json({ error: "Failed to preview", detail: e.message });
  }
});

// Apply a rule
Router.post("/rules/:id/apply", async (req, res) => {
  try {
    const rule = await RepricingRule.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });
    if (!rule) return res.status(404).json({ error: "Not found" });
    const items = await queryInventoryForRule(
      req.user.companyId,
      rule.conditions
    );
    let updated = 0;
    for (const it of items) {
      const newPrice = computeNewPrice(it.priceListed, rule.actions);
      await Inventory.updateOne(
        { _id: it._id },
        { $set: { priceListed: newPrice } }
      );
      updated += 1;
    }
    rule.schedule.lastRunAt = new Date();
    await rule.save();
    res.json({ updated });
  } catch (e) {
    res.status(500).json({ error: "Failed to apply", detail: e.message });
  }
});

function matchesBrand(it, regex) {
  if (!regex) return true;
  try {
    const r = new RegExp(regex, "i");
    return r.test(it.brand || "");
  } catch {
    return true;
  }
}

async function queryInventoryForRule(companyId, c = {}) {
  const find = { companyId };
  if (c.statusIn?.length) find.status = { $in: c.statusIn };
  if (c.currency) find.currency = c.currency;
  if (c.minPrice != null || c.maxPrice != null) {
    find.priceListed = {};
    if (c.minPrice != null) find.priceListed.$gte = c.minPrice;
    if (c.maxPrice != null) find.priceListed.$lte = c.maxPrice;
  }
  let items = await Inventory.find(find).limit(500);
  if (c.brandRegex)
    items = items.filter((it) => matchesBrand(it, c.brandRegex));
  return items;
}

function computeNewPrice(from, a = {}) {
  let p = Number(from || 0);
  if (a.percentChange) p = p * (1 + a.percentChange / 100);
  if (a.absoluteChange) p = p + a.absoluteChange;
  if (a.floorPrice != null) p = Math.max(p, a.floorPrice);
  if (a.ceilingPrice != null) p = Math.min(p, a.ceilingPrice);
  if (a.roundTo) p = Math.round(p / a.roundTo) * a.roundTo;
  return Math.max(0, Math.round(p));
}

module.exports = Router;
