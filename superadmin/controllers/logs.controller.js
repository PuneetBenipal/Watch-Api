const paginate = require("../services/paginate");
const AuditLog = require("../../models/AuditLog");

exports.list = async (req, res, next) => {
    try {
        const { q, level, companyId, actorEmail, start, end, page, limit } = req.query;

        const filter = {};
        if (level) filter.level = level;
        if (companyId) filter.companyId = companyId;
        if (actorEmail) filter.actorEmail = new RegExp(actorEmail, "i");
        if (start || end) {
            filter.ts = {};
            if (start) filter.ts.$gte = new Date(start);
            if (end) filter.ts.$lte = new Date(end);
        }
        if (q) {
            filter.$or = [
                { action: { $regex: q, $options: "i" } },
                { message: { $regex: q, $options: "i" } },
                { targetId: { $regex: q, $options: "i" } },
            ];
        }

        const result = await paginate(AuditLog, {
            filter,
            sort: { ts: -1 },
            page, limit,
            lean: true,
            populate: [{ path: "companyId", select: "name" }, { path: "actorUserId", select: "email" }],
        });

        // present a friendly companyName
        result.data = result.data.map(x => ({ ...x, companyName: x.companyId?.name || null }));
        res.json(result);
    } catch (e) { next(e); }
};
