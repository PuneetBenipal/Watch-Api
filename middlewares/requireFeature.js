const Entitlement = require("../models/entitlement.model");

module.exports = function requireFeature(feature) {
  return async function (req, res, next) {
    try {
      // In your real auth, resolve accountId from JWT/session.
      // For now support X-Account-Id header to test.
      const accountId = req.user?.accountId || req.headers["x-account-id"];
      if (!accountId)
        return res.status(401).json({ error: "Account not resolved" });

      const ent = await Entitlement.findOne({
        accountId,
        feature,
        status: "active",
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      });
      if (!ent)
        return res
          .status(403)
          .json({ error: `Feature ${feature} not enabled` });

      return next();
    } catch (e) {
      return res
        .status(500)
        .json({ error: "Feature check failed", detail: e.message });
    }
  };
};
