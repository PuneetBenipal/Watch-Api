const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const Invoice = require("../models/Invoice.model.js");
const { Inventory } = require("../models/inventory");

class PDFGenerator {
  constructor() {
    this.doc = null;
  }

  async generateInvoicePDF(invoiceId) {
    try {
      const invoice = await Invoice.findById(invoiceId)
        .populate("sellerId", "name email")
        .populate("items");
      const Company = require("../models/Company.model");

      if (!invoice) {
        throw new Error("Invoice not found");
      }

      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
      });

      this.doc = doc;

      // Generate filename
      const filename = `invoice-${invoice.invoiceNo}-${Date.now()}.pdf`;
      const filepath = path.join(__dirname, "../public/invoices", filename);

      // Ensure directory exists
      const dir = path.dirname(filepath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // Generate PDF content
      // Branding (if enabled)
      const company = invoice.companyId
        ? await Company.findById(invoice.companyId).lean()
        : null;
      const branding = company?.branding?.enabled ? company.branding : null;

      this.generateHeader(invoice, branding);
      this.generateCustomerInfo(invoice);
      this.generateInvoiceDetails(invoice);
      this.generateItemsTable(invoice);
      this.generateTotals(invoice);
      this.generateFooter(invoice, branding);

      // Finalize PDF
      doc.end();

      return new Promise((resolve, reject) => {
        stream.on("finish", () => {
          // Update invoice with PDF URL
          const pdfUrl = `/invoices/${filename}`;
          Invoice.findByIdAndUpdate(invoiceId, { pdfUrl }, { new: true })
            .then(() => resolve(pdfUrl))
            .catch(reject);
        });
        stream.on("error", reject);
      });
    } catch (error) {
      console.error("PDF generation error:", error);
      throw error;
    }
  }

  generateHeader(invoice, branding) {
    const doc = this.doc;

    // Company logo and info
    if (branding?.headerLogoUrl) {
      try {
        doc.image(branding.headerLogoUrl, 50, 45, { width: 120 });
      } catch {}
    }

    doc.moveDown(branding?.headerLogoUrl ? 2 : 0);
    doc
      .fillColor(branding?.primaryColor || "#000000")
      .fontSize(20)
      .font("Helvetica-Bold")
      .text("WatchDealerHub", { align: "left" })
      .fillColor("#000000");

    doc
      .fontSize(10)
      .font("Helvetica")
      .text("Professional Watch Trading Platform", { align: "left" })
      .moveDown(0.5);

    doc
      .fontSize(8)
      .text("Dubai, UAE", { align: "left" })
      .text("Email: support@watchdealerhub.com", { align: "left" })
      .text("Phone: +971 50 123 4567", { align: "left" })
      .moveDown(2);

    // Invoice title
    doc
      .fontSize(24)
      .font("Helvetica-Bold")
      .text("INVOICE", { align: "center" })
      .moveDown(1);
  }

  generateCustomerInfo(invoice) {
    const doc = this.doc;

    // Bill to section
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("Bill To:", { align: "left" })
      .moveDown(0.5);

    doc
      .fontSize(10)
      .font("Helvetica")
      .text(invoice.buyer.name, { align: "left" });

    if (invoice.buyer.email) {
      doc.text(`Email: ${invoice.buyer.email}`, { align: "left" });
    }

    if (invoice.buyer.phone) {
      doc.text(`Phone: ${invoice.buyer.phone}`, { align: "left" });
    }

    if (invoice.buyer.address) {
      const address = invoice.buyer.address;
      const addressLines = [];
      if (address.street) addressLines.push(address.street);
      if (address.city) addressLines.push(address.city);
      if (address.state) addressLines.push(address.state);
      if (address.country) addressLines.push(address.country);
      if (address.zipCode) addressLines.push(address.zipCode);

      if (addressLines.length > 0) {
        doc.text(addressLines.join(", "), { align: "left" });
      }
    }

    doc.moveDown(2);
  }

  generateInvoiceDetails(invoice) {
    const doc = this.doc;

    // Invoice details table
    const tableTop = doc.y;
    const tableLeft = 300;
    const colWidth = 100;

    // Headers
    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("Invoice No:", tableLeft, tableTop)
      .text("Date:", tableLeft, tableTop + 20)
      .text("Due Date:", tableLeft, tableTop + 40)
      .text("Payment Method:", tableLeft, tableTop + 60)
      .text("Status:", tableLeft, tableTop + 80);

    // Values
    doc
      .fontSize(10)
      .font("Helvetica")
      .text(invoice.invoiceNo, tableLeft + colWidth, tableTop)
      .text(
        new Date(invoice.createdAt).toLocaleDateString(),
        tableLeft + colWidth,
        tableTop + 20
      )
      .text(
        new Date(invoice.dueDate).toLocaleDateString(),
        tableLeft + colWidth,
        tableTop + 40
      )
      .text(invoice.paymentMethod, tableLeft + colWidth, tableTop + 60)
      .text(invoice.status, tableLeft + colWidth, tableTop + 80);

    doc.moveDown(4);
  }

  generateItemsTable(invoice) {
    const doc = this.doc;
    const tableTop = doc.y;
    const tableLeft = 50;
    const colWidths = [50, 200, 100, 100, 100]; // Qty, Description, Price, Total

    // Table headers
    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("#", tableLeft, tableTop)
      .text("Description", tableLeft + colWidths[0], tableTop)
      .text("Brand/Model", tableLeft + colWidths[0] + colWidths[1], tableTop)
      .text(
        "Price",
        tableLeft + colWidths[0] + colWidths[1] + colWidths[2],
        tableTop
      )
      .text(
        "Total",
        tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
        tableTop
      );

    // Draw header line
    doc
      .moveTo(tableLeft, tableTop + 15)
      .lineTo(tableLeft + 500, tableTop + 15)
      .stroke();

    let currentY = tableTop + 25;

    // Table rows
    for (let i = 0; i < invoice.items.length; i++) {
      const item = invoice.items[i];

      doc
        .fontSize(9)
        .font("Helvetica")
        .text((i + 1).toString(), tableLeft, currentY)
        .text(item.brand + " " + item.model, tableLeft + colWidths[0], currentY)
        .text(item.refNo, tableLeft + colWidths[0] + colWidths[1], currentY)
        .text(
          `${invoice.currency} ${item.priceListed.toLocaleString()}`,
          tableLeft + colWidths[0] + colWidths[1] + colWidths[2],
          currentY
        )
        .text(
          `${invoice.currency} ${item.priceListed.toLocaleString()}`,
          tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
          currentY
        );

      currentY += 20;
    }

    // Draw bottom line
    doc
      .moveTo(tableLeft, currentY)
      .lineTo(tableLeft + 500, currentY)
      .stroke();

    doc.moveDown(2);
  }

  generateTotals(invoice) {
    const doc = this.doc;
    const totalsLeft = 400;
    const totalsTop = doc.y;

    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("Subtotal:", totalsLeft, totalsTop)
      .text("Tax:", totalsLeft, totalsTop + 20)
      .text("Discount:", totalsLeft, totalsTop + 40)
      .text("Total:", totalsLeft, totalsTop + 60);

    doc
      .fontSize(10)
      .font("Helvetica")
      .text(
        `${invoice.currency} ${invoice.subtotal.toLocaleString()}`,
        totalsLeft + 100,
        totalsTop
      )
      .text(
        `${invoice.currency} ${invoice.tax.toLocaleString()}`,
        totalsLeft + 100,
        totalsTop + 20
      )
      .text(
        `${invoice.currency} ${invoice.discount.toLocaleString()}`,
        totalsLeft + 100,
        totalsTop + 40
      )
      .text(
        `${invoice.currency} ${invoice.total.toLocaleString()}`,
        totalsLeft + 100,
        totalsTop + 60
      );

    // Draw total line
    doc
      .moveTo(totalsLeft, totalsTop + 70)
      .lineTo(totalsLeft + 150, totalsTop + 70)
      .stroke();

    doc.moveDown(3);
  }

  generateFooter(invoice, branding) {
    const doc = this.doc;

    doc
      .fontSize(8)
      .font("Helvetica")
      .text(branding?.footerText || "Thank you for your business!", {
        align: "center",
      })
      .moveDown(0.5)
      .text("This is a computer-generated invoice. No signature required.", {
        align: "center",
      })
      .moveDown(0.5)
      .text(`Generated on ${new Date().toLocaleString()}`, { align: "center" });

    // Terms and conditions
    if (invoice.notes) {
      doc
        .moveDown(2)
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("Notes:", { align: "left" })
        .moveDown(0.5)
        .fontSize(8)
        .font("Helvetica")
        .text(invoice.notes, { align: "left" });
    }
  }

  async generateInventoryReport(companyId, filters = {}) {
    try {
      const query = { companyId };
      if (filters.status) query.status = filters.status;
      if (filters.brand) query.brand = { $regex: filters.brand, $options: "i" };

      const inventory = await Inventory.find(query)
        .populate("dealerId", "name")
        .sort({ createdAt: -1 });

      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
      });

      this.doc = doc;

      const filename = `inventory-report-${Date.now()}.pdf`;
      const filepath = path.join(__dirname, "../public/reports", filename);

      const dir = path.dirname(filepath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // Generate report content
      this.generateReportHeader("Inventory Report");
      this.generateInventoryTable(inventory);
      this.generateReportFooter();

      doc.end();

      return new Promise((resolve, reject) => {
        stream.on("finish", () => resolve(`/reports/${filename}`));
        stream.on("error", reject);
      });
    } catch (error) {
      console.error("Inventory report generation error:", error);
      throw error;
    }
  }

  generateReportHeader(title) {
    const doc = this.doc;

    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .text(title, { align: "center" })
      .moveDown(1);

    doc
      .fontSize(10)
      .font("Helvetica")
      .text(`Generated on ${new Date().toLocaleString()}`, { align: "center" })
      .moveDown(2);
  }

  generateInventoryTable(inventory) {
    const doc = this.doc;
    const tableTop = doc.y;
    const tableLeft = 50;
    const colWidths = [80, 120, 100, 80, 100, 80]; // Brand, Model, Ref, Price, Status, Dealer

    // Headers
    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .text("Brand", tableLeft, tableTop)
      .text("Model", tableLeft + colWidths[0], tableTop)
      .text("Ref No", tableLeft + colWidths[0] + colWidths[1], tableTop)
      .text(
        "Price",
        tableLeft + colWidths[0] + colWidths[1] + colWidths[2],
        tableTop
      )
      .text(
        "Status",
        tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
        tableTop
      )
      .text(
        "Dealer",
        tableLeft +
          colWidths[0] +
          colWidths[1] +
          colWidths[2] +
          colWidths[3] +
          colWidths[4],
        tableTop
      );

    let currentY = tableTop + 20;

    // Table rows
    inventory.forEach((item, index) => {
      if (currentY > 700) {
        // New page if near bottom
        doc.addPage();
        currentY = 50;
      }

      doc
        .fontSize(8)
        .font("Helvetica")
        .text(item.brand, tableLeft, currentY)
        .text(item.model, tableLeft + colWidths[0], currentY)
        .text(item.refNo, tableLeft + colWidths[0] + colWidths[1], currentY)
        .text(
          `$${item.priceListed.toLocaleString()}`,
          tableLeft + colWidths[0] + colWidths[1] + colWidths[2],
          currentY
        )
        .text(
          item.status,
          tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
          currentY
        )
        .text(
          item.dealerId?.name || "N/A",
          tableLeft +
            colWidths[0] +
            colWidths[1] +
            colWidths[2] +
            colWidths[3] +
            colWidths[4],
          currentY
        );

      currentY += 15;
    });
  }

  generateReportFooter() {
    const doc = this.doc;

    doc
      .moveDown(2)
      .fontSize(8)
      .font("Helvetica")
      .text("This report was generated by WatchDealerHub", { align: "center" });
  }
}

module.exports = PDFGenerator;
