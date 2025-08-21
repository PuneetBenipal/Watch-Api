const AuditLog = require("../../models/AuditLog");

function safeCut(obj, keys = [], max = 1000) {
    if (!obj) return undefined;
    const out = {};
    keys.forEach(k => { if (obj[k] !== undefined) out[k] = obj[k]; });
    return JSON.stringify(out).length > max ? undefined : out;
}

exports.log = async function log(req, {
    action, targetType, targetId, before, after, message, level = "info", companyId, meta
}) {
    try {
        await AuditLog.create({
            ts: new Date(),
            actorUserId: req.user?._id || null,
            actorEmail: req.user?.email || null,
            ip: req.ip,
            ua: req.headers["user-agent"],

            companyId: companyId || req.body?.companyId || null,

            action, targetType, targetId,
            message,
            before: safeCut(before, ["name", "email", "role", "status", "planId", "planStatus", "renewalDate"]),
            after: safeCut(after, ["name", "email", "role", "status", "planId", "planStatus", "renewalDate"]),
            meta,
            level,
        });
    } catch (e) {
        // never throw from logger
        console.error("Audit log write failed:", e.message);
    }
};
