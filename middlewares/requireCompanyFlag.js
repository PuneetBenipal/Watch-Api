const Company = require("../models/Company.model");

module.exports = function requireCompanyFlag(flagKey) {
  return async function (req, res, next) {
    try {
      const company = await Company.findById(req.user?.companyId).lean();
      if (!company)
        return res.status(401).json({ error: "Company not resolved" });
      if (company.featureFlags?.[flagKey]) return next();
      return res
        .status(403)
        .json({ error: `Feature flag '${flagKey}' not enabled` });
    } catch (e) {
      return res
        .status(500)
        .json({ error: "Feature flag check failed", detail: e.message });
    }
  };
};
