const PDFDocument = require("pdfkit");
const Entitlement = require("../models/entitlement.model");
const Account = require("../models/account.model");
const { BRANDED_INVOICE_TEMPLATES } = require("../utils/features");

async function hasBranding(accountId) {
  const ent = await Entitlement.findOne({
    accountId,
    feature: BRANDED_INVOICE_TEMPLATES,
    status: "active",
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  });
  return !!ent;
}

function currencyFmt(n, c) {
  return `${c || ""}${(n || 0).toFixed(2)}`;
}

async function generateInvoicePDF({ accountId, invoice }) {
  const branded = await hasBranding(accountId);
  const account = await Account.findById(accountId);
  const brand = account?.brand || {};

  const doc = new PDFDocument({ margin: 40 });
  const chunks = [];
  doc.on("data", (d) => chunks.push(d));
  const done = new Promise((res) =>
    doc.on("end", () => res(Buffer.concat(chunks)))
  );

  // Header
  if (branded && brand.logoUrl) {
    try {
      doc.image(brand.logoUrl, 40, 30, { width: 120 });
    } catch {}
  }
  doc.fontSize(18).text(brand.companyName || "Invoice", 40, branded ? 160 : 40);

  // Colors
  const accent =
    branded && /^#?[0-9A-F]{6}$/i.test(brand.primaryColor)
      ? brand.primaryColor
      : "#222222";

  // Parties
  doc.moveDown().fontSize(10);
  doc.fillColor("#555").text("Seller");
  doc.fillColor("#000").text(invoice.seller?.name || account?.name || "Seller");
  if (invoice.seller?.address) doc.text(invoice.seller.address);

  doc.moveDown().fillColor("#555").text("Buyer");
  doc.fillColor("#000").text(invoice.buyer?.name || "Buyer");
  if (invoice.buyer?.address) doc.text(invoice.buyer.address);

  doc
    .moveDown()
    .moveTo(40, doc.y + 5)
    .lineTo(555, doc.y + 5)
    .strokeColor(accent)
    .stroke();

  // Lines
  doc.moveDown().fontSize(11).fillColor("#000");
  let y = doc.y;
  doc.text("Description", 40, y);
  doc.text("Qty", 300, y);
  doc.text("Unit", 360, y);
  doc.text("Amount", 430, y);
  doc
    .moveTo(40, y + 15)
    .lineTo(555, y + 15)
    .strokeColor("#ccc")
    .stroke();

  let subtotal = 0;
  (invoice.lines || []).forEach((ln, i) => {
    const lineY = doc.y + 10;
    const amount = (ln.qty || 0) * (ln.unitPrice || 0);
    subtotal += amount;
    doc.text(ln.description || "-", 40, lineY);
    doc.text(String(ln.qty || 0), 300, lineY);
    doc.text(currencyFmt(ln.unitPrice, ""), 360, lineY);
    doc.text(currencyFmt(amount, ""), 430, lineY);
    doc.moveDown();
  });

  const tax = invoice.totals?.tax ?? 0;
  const grand = invoice.totals?.grandTotal ?? subtotal + tax;
  const cur = invoice.totals?.currency || "USD";

  doc.moveDown();
  doc.text(`Subtotal: ${currencyFmt(subtotal, "")}`, 430);
  doc.text(`Tax: ${currencyFmt(tax, "")}`, 430);
  doc
    .fontSize(12)
    .fillColor(accent)
    .text(`Total: ${currencyFmt(grand, "")} ${cur}`, 430);

  // Footer
  doc
    .moveDown()
    .moveTo(40, doc.y + 15)
    .lineTo(555, doc.y + 15)
    .strokeColor("#eee")
    .stroke();
  doc
    .fontSize(9)
    .fillColor("#444")
    .text(
      branded
        ? brand.footerNote || "Thank you for your business."
        : "Upgrade to Branded Invoice Templates to add your logo and colors.",
      40,
      doc.y + 10
    );

  doc.end();
  return done;
}

module.exports = { generateInvoicePDF };
