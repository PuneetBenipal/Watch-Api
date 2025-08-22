// backend/routes/invoices.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Invoice = require("../models/Invoice.model");
const authenticateToken = require("../middleware/auth");
const PDFDocument = require("pdfkit");

//Inventory date filter
const { Inventory } = require("../models/inventory");
const ObjectId = require("mongoose").Types.ObjectId;

function InvoiceNocreate() {
  const year = new Date().getFullYear();
  const timestamp = Date.now();
  return `INV-${year}-${timestamp}`;
}

router.use(authenticateToken);

const OID = mongoose.Types.ObjectId;

// Supported payment methods (align with model enum)
const VALID_METHODS = ["CASH", "WIRE", "CRYPTO", "ESCROW", "CREDIT CARD"];

// replace with real auth/tenant resolution
function tenantId(req) {
  return new OID(req.user.companyId);
}

// Issue (create) invoice
router.post("/", async (req, res) => {
  try {
    const {
      customer_name,
      customer_email,
      customer_phone,
      customer_adress,
      items = [],
      currency = "USD",
      tax_rate = 0,
      notes,
      inventory_watch_id,
      payment_method = "CASH",
      dueDate,

      // --- NEW Premium Fields -------------------------
      premium = false,
      premium_features = [],
      // ------------------------------------------------
    } = req.body || {};

    const pm = String(payment_method).toUpperCase();
    if (!VALID_METHODS.includes(pm))
      return res
        .status(400)
        .json({ error: "payment_method must be one of: CASH, WIRE, CRYPTO, ESCROW, CREDIT CARD" });

    // compute totals server-side
    const computed = items.map((it) => {
      const qty = Number(it.qty);
      const unit_price = Number(it.unit_price);
      return { ...it, qty, unit_price, line_total: qty * unit_price };
    });
    const subtotal = computed.reduce(
      (s, it) => s + Number(it.line_total || 0),
      0
    );
    const taxAmount = Number(((tax_rate || 0) * subtotal).toFixed(2));
    const total = Number((subtotal + taxAmount).toFixed(2));

    // naive invoice numbering (swap for an atomic counter in prod)
    const invoice_want_add = await InvoiceNocreate();

    const doc = await Invoice.create({
      companyId: tenantId(req),
      invoice_no: invoice_want_add,
      customer_name,
      customer_email,
      customer_phone,
      customer_adress,
      dueDate,
      items: computed,
      currency,
      subtotal,
      tax_rate,
      tax_amount: taxAmount,
      total,
      payment_method: pm,
      status: "SENT", // "issued" as per requirement
      inventory_watch_id: inventory_watch_id
        ? new OID(inventory_watch_id)
        : undefined,
      notes,

      // --- Save premium fields -------------------------
      premium,
      premium_features,
      // -------------------------------------------------
    });

    res.status(201).json({
      message: "success",
      id: doc._id,
      invoice_want_add,
      pdf_url: `/api/invoices/pdf/${doc._id}`,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to issue invoice" });
  }
});

// List (with Cash/Wire separation)
router.get("/", async (req, res) => {
  try {
    const company = tenantId(req);

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      200,
      Math.max(1, parseInt(req.query.limit, 10) || 10)
    );
    const skip = (page - 1) * limit;

    const statusFilter = (req.query.status || "").toUpperCase();
    const paymentFilter = (req.query.paymentMethod || "").toUpperCase();
    const searchText = (req.query.search || "").trim();

    const q = { companyId: company };

    const VALID_STATUSES = ["DRAFT", "SENT", "PAID", "PARTIAL", "VOID"];
    if (VALID_STATUSES.includes(statusFilter)) {
      q.status = statusFilter;
    }

    if (VALID_METHODS.includes(paymentFilter)) {
      q.payment_method = paymentFilter;
    }

    if (searchText) {
      const esc = searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(esc, "i");
      q.$or = [
        { invoice_no: rx },
        { customer_name: rx },
        { customer_email: rx },
        { customer_phone: rx },
      ];
    }

    // Run queries
    const [invoices, total] = await Promise.all([
      Invoice.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Invoice.countDocuments(q),
    ]);

    res.json({
      invoices,
      total,
      page,
      limit,
      hasMore: skip + invoices.length < total,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load invoices" });
  }
});

// Summary for tabs
router.get("/summary", async (req, res) => {
  try {
    const companyId = tenantId(req);
    const agg = await Invoice.aggregate([
      { $match: { companyId } },
      { $group: { _id: "$payment_method", c: { $sum: 1 } } },
    ]);
    const by = Object.fromEntries(agg.map((a) => [a._id, a.c]));
    const cash = by.CASH || 0;
    const wire = by.WIRE || 0;
    res.json({ all: cash + wire, cash, wire });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load summary" });
  }
});

// Record a payment (manual reconciliation)
router.post("/:id/pay", async (req, res) => {
  try {
    const { amount, method, note } = req.body || {};
    if (!amount || amount <= 0)
      return res.status(400).json({ error: "amount > 0 required" });
    const m = String(method || "").toUpperCase();
    if (!["CASH", "WIRE"].includes(m))
      return res.status(400).json({ error: "method must be CASH or WIRE" });

    const inv = await Invoice.findOne({
      _id: req.params.id,
      companyId: tenantId(req),
    });
    if (!inv) return res.status(404).json({ error: "not found" });

    inv.payments.push({ amount: Number(amount), method: m, note });
    inv.paid_amount = Number(
      (Number(inv.paid_amount || 0) + Number(amount)).toFixed(2)
    );
    inv.status =
      inv.paid_amount >= inv.total
        ? "PAID"
        : inv.paid_amount > 0
          ? "PARTIAL"
          : inv.status;
    await inv.save();

    res.json({ ok: true, status: inv.status, paid_amount: inv.paid_amount });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to record payment" });
  }
});

router.get("/pdf/:id", async (req, res) => {
  const inv = await Invoice.findOne({
    _id: req.params.id,
    companyId: tenantId(req),
  }).lean();

  if (!inv) return res.status(404).end();

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${inv.invoice_no}.pdf"`
  );

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  doc.pipe(res);

  // Header / branding
  doc
    .fontSize(18)
    .text("INVOICE", { continued: true })
    .fontSize(12)
    .text(`  ${inv.invoice_no}`);
  doc.moveDown(0.5);
  doc.text(`Payment Method: ${inv.payment_method}`);
  doc.text(`Customer: ${inv.customer_name || inv.customer_phone}`);
  doc.moveDown();

  // Line items
  doc.fontSize(11);
  inv.items.forEach((it) => {
    doc.text(
      `${it.qty} x ${it.description} @ ${inv.currency} ${Number(it.unit_price).toFixed(2)} = ${inv.currency} ${Number(it.line_total).toFixed(2)}`
    );
  });
  doc.moveDown();

  // Totals
  doc.text(`Subtotal: ${inv.currency} ${Number(inv.subtotal).toFixed(2)}`);
  if (inv.tax_rate)
    doc.text(
      `Tax (${(inv.tax_rate * 100).toFixed(2)}%): ${inv.currency} ${Number(inv.tax_amount).toFixed(2)}`
    );
  doc.text(`Total: ${inv.currency} ${Number(inv.total).toFixed(2)}`);
  doc.moveDown();
  doc.text(
    `Status: ${inv.status}  •  Paid: ${inv.currency} ${Number(inv.paid_amount || 0).toFixed(2)}`
  );

  // --- Show Premium fields if applicable -----------------
  if (inv.premium) {
    doc.moveDown();
    doc.fontSize(12).fillColor("blue").text("Premium Invoice Features:");
    inv.premium_features?.forEach((f) => {
      doc
        .fontSize(10)
        .fillColor("black")
        .text(`- ${f.feature_name}: ${f.feature_value}`);
    });
  }
  // -------------------------------------------------------

  // Footer
  doc.moveDown(2);
  doc
    .fontSize(9)
    .fillOpacity(0.6)
    .text("Your Company • Branded PDF • WatchDealerHub", { align: "center" });

  doc.end();
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const company = tenantId(req);

    const invoice = await Invoice.findOne({
      _id: id,
      companyId: company,
    }).lean();

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    // Add a convenient PDF URL (your existing /pdf/:id route)
    invoice.pdf_url = `/api/invoices/pdf/${invoice._id}`;

    return res.json({ invoice });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to load invoice" });
  }
});

//Inventory value filter
router.post("/somedata", async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ message: "Invalid items array" });
    }

    const inventoryData = await Promise.all(
      items.map(async (item) => {
        if (!ObjectId.isValid(item.sku)) {
          return { ...item, inventoryInfo: null, error: "Invalid SKU format" };
        }

        const skuObjectId = new ObjectId(item.sku);
        const data = await Inventory.findById(skuObjectId);

        return {
          ...item,
          inventoryInfo: data,
        };
      })
    );

    res.json({ inventoryData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
