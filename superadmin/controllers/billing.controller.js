const paginate = require("../services/paginate");
const Invoice = require("../../models/Invoice.model");   // adjust paths if needed
const Company = require("../../models/Company.model");
const Payment = require("../../models/Payment.model");   // or Transaction model

const INVOICE_STATUSES = new Set(["open", "paid", "past_due", "void"]);

function dateRangeFilter(field, start, end) {
    const f = {};
    if (start) f.$gte = new Date(start);
    if (end) f.$lte = new Date(end);
    return Object.keys(f).length ? { [field]: f } : {};
}

/** GET /superadmin/billing/invoices */
exports.listInvoices = async (req, res, next) => {
    try {
        const { q, status, companyId, start, end, page, limit } = req.query;

        const filter = { ...dateRangeFilter("createdAt", start, end) };
        if (status) filter.status = status;
        if (companyId) filter.companyId = companyId;
        if (q) filter.invoiceNo = { $regex: q, $options: "i" }; // search by invoice #

        const result = await paginate(Invoice, {
            filter,
            select: "invoiceNo companyId total currency status issuedAt dueDate",
            sort: { createdAt: -1 },
            page, limit,
            lean: true,
            populate: [{ path: "companyId", select: "name" }],
        });

        // add companyName convenience field
        result.data = result.data.map((d) => ({
            ...d,
            companyName: d.companyName || d?.companyId?.name || d.company,
        }));

        res.json(result);
    } catch (e) { next(e); }
};

/** PATCH /superadmin/billing/invoices/:id  { status } */
exports.updateInvoiceStatus = async (req, res, next) => {
    try {
        const { status } = req.body || {};
        if (!status || !INVOICE_STATUSES.has(status))
            return res.status(400).json({ error: "invalid status" });

        const doc = await Invoice.findByIdAndUpdate(
            req.params.id,
            { $set: { status } },
            { new: true, runValidators: true }
        )
            .select("number companyId amount currency status createdAt dueDate")
            .populate({ path: "companyId", select: "name" })
            .lean();

        if (!doc) return res.status(404).json({ error: "Invoice not found" });

        res.json({ ...doc, companyName: doc?.companyId?.name || doc.company });
    } catch (e) { next(e); }
};

/** GET /superadmin/billing/payments */
exports.listPayments = async (req, res, next) => {
    try {
        const { q, method, status, companyId, start, end, page, limit } = req.query;

        const filter = { ...dateRangeFilter("createdAt", start, end) };
        if (status) filter.status = status;      // e.g., "succeeded" | "pending" | "failed"
        if (method) filter.method = method;      // e.g., "stripe" | "card" | "wire" | "crypto"
        if (companyId) filter.companyId = companyId;
        if (q) filter.$or = [
            { id: { $regex: q, $options: "i" } },       // gateway payment id
            { reference: { $regex: q, $options: "i" } },// your internal ref
        ];

        const result = await paginate(Payment, {
            filter,
            select: "id companyId amount feature currency method status createdAt",
            sort: { createdAt: -1 },
            page, limit,
            lean: true,
            populate: [{ path: "companyId", select: "name" }],
        });

        result.data = result.data.map((d) => ({
            ...d,
            companyName: d.companyName || d?.companyId?.name || d.company,
        }));

        res.json(result);
    } catch (e) { next(e); }
};
