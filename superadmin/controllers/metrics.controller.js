const mongoose = require("mongoose");
const Company = require("../../models/Company.model"); // adjust paths
const User = require("../../models/User.model");
const Invoice = require("../../models/Invoice.model");

function parseRange(range = "30d") {
    const now = new Date();
    const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); // today 00:00 UTC
    start.setUTCDate(start.getUTCDate() - (days - 1));
    return { days, start, end: now };
}
function dayKey(d) { // MM/DD
    const x = new Date(d);
    return `${x.getUTCMonth() + 1}/${x.getUTCDate()}`;
}
function makeZeroSeries(days, start) {
    const arr = [];
    for (let i = 0; i < days; i++) {
        const d = new Date(start);
        d.setUTCDate(start.getUTCDate() + i);
        arr.push({ date: dayKey(d), value: 0 });
    }
    return arr;
}
function mergeSeries(base, aggMap) {
    return base.map(pt => ({ ...pt, value: aggMap.get(pt.date) ?? 0 }));
}
function pctDelta(curr, prev) {
    if (!prev) return curr ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
}

exports.overview = async (req, res, next) => {
    try {
        const range = String(req.query.range || "30d").toLowerCase();
        const { days, start, end } = parseRange(range);

        // ---------- KPIs ----------
        // Totals
        const [companiesTotal, usersActiveTotal, invoicesPastDueTotal] = await Promise.all([
            Company.countDocuments({}),
            // consider "active" when status missing or explicitly active
            User.countDocuments({ $or: [{ status: "active" }, { status: { $exists: false } }] }),
            Invoice.countDocuments({
                $or: [
                    { status: "past_due" },
                    { status: "open", dueDate: { $lt: new Date() } }
                ]
            })
        ]);

        // MRR (approx) = sum of PAID invoices in window
        const [{ _id: _null1, total: mrrCurr } = { total: 0 }] = await Invoice.aggregate([
            { $match: { status: "paid", createdAt: { $gte: start, $lte: end } } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);

        // For deltas, compare to previous window of equal length
        const prevStart = new Date(start); prevStart.setUTCDate(start.getUTCDate() - days);
        const prevEnd = new Date(start); prevEnd.setUTCDate(start.getUTCDate() - 1);

        const [
            companiesPrevWindow, usersPrevWindow, [{ total: mrrPrev } = { total: 0 }]
        ] = await Promise.all([
            Company.countDocuments({ createdAt: { $gte: prevStart, $lte: prevEnd } }),
            User.countDocuments({ createdAt: { $gte: prevStart, $lte: prevEnd } }),
            Invoice.aggregate([
                { $match: { status: "paid", createdAt: { $gte: prevStart, $lte: prevEnd } } },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ])
        ]);

        const companiesCurrWindow = await Company.countDocuments({ createdAt: { $gte: start, $lte: end } });
        const usersCurrWindow = await User.countDocuments({ createdAt: { $gte: start, $lte: end } });

        // ---------- Time series ----------
        // MRR daily
        const mrrAgg = await Invoice.aggregate([
            { $match: { status: "paid", createdAt: { $gte: start, $lte: end } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%m/%d", date: "$createdAt", timezone: "UTC" } },
                    v: { $sum: "$amount" }
                }
            }
        ]);
        const mrrMap = new Map(mrrAgg.map(x => [x._id, x.v]));

        // New users daily
        const usersAgg = await User.aggregate([
            { $match: { createdAt: { $gte: start, $lte: end } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%m/%d", date: "$createdAt", timezone: "UTC" } },
                    v: { $sum: 1 }
                }
            }
        ]);
        const usersMap = new Map(usersAgg.map(x => [x._id, x.v]));

        const baseSeries = makeZeroSeries(days, start);
        const mrrDaily = mergeSeries(baseSeries, mrrMap);
        const newUsersDaily = mergeSeries(baseSeries, usersMap);

        // ---------- Tables ----------
        // Recent invoices with companyName
        const recentInvoices = await Invoice.aggregate([
            { $sort: { createdAt: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: mongoose.model("Company").collection.name,
                    localField: "companyId",
                    foreignField: "_id",
                    as: "companyDoc"
                }
            },
            {
                $project: {
                    number: 1, amount: 1, currency: 1, status: 1, createdAt: 1, dueDate: 1,
                    companyId: 1,
                    companyName: {
                        $ifNull: [{ $arrayElemAt: ["$companyDoc.name", 0] }, "$companyName"]
                    }
                }
            }
        ]);

        // Top companies by seats.used (fallback 0)
        const topCompanies = await Company.aggregate([
            {
                $addFields: {
                    seatsUsed: { $ifNull: ["$seats.used", 0] },
                    seatsPurchased: { $ifNull: ["$seats.purchased", 0] }
                }
            },
            { $sort: { seatsUsed: -1, createdAt: -1 } },
            { $limit: 5 },
            {
                $project: {
                    name: 1, planId: 1, planStatus: 1,
                    seats: { used: "$seatsUsed", purchased: "$seatsPurchased" }
                }
            }
        ]);

        res.json({
            kpi: {
                companies: companiesTotal,
                usersActive: usersActiveTotal,
                mrr: mrrCurr || 0,
                invoicesPastDue: invoicesPastDueTotal,
                companiesDelta: pctDelta(companiesCurrWindow, companiesPrevWindow),
                usersDelta: pctDelta(usersCurrWindow, usersPrevWindow),
                mrrDelta: pctDelta(mrrCurr || 0, mrrPrev || 0),
                invoicesDelta: 0 // can compute window deltas similarly if you want
            },
            timeseries: { mrrDaily, newUsersDaily },
            tables: { recentInvoices, topCompanies }
        });
    } catch (e) {
        next(e);
    }
};
