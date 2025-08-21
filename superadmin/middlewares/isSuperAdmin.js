// Checks either env allowlist or a platformRole on the user document.
const SUPERADMINS = (process.env.SUPERADMINS || "").split(/[;, ]/).map(s => s.trim().toLowerCase()).filter(Boolean);

module.exports = function requireSuperAdmin(req, res, next) {
    const email = (req.user?.email || "").toLowerCase();
    const role = req.user?.platformRole || req.user?.role;
    if (SUPERADMINS.includes(email) || role === "superadmin") return next();
    return res.status(403).json({ error: "Forbidden" });
};
