const Invoice = require('../models/Invoice.model.js');
const Inventory = require('../models/inventory');
const PDFGenerator = require('../services/pdfGenerator');
const { asyncHandler } = require('../middlewares/error.middleware');

// Get all invoices for a company
const getAllInvoices = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, paymentMethod, startDate, endDate } = req.query;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = { sellerId: req.user._id };
    
    if (status) filter.status = status;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const invoices = await Invoice.find(filter)
      .populate('items', 'brand model refNo priceListed currency')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Invoice.countDocuments(filter);

    res.json({
      invoices,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        totalItems: total
      }
    });
  } catch (error) {
    console.error('Get all invoices error:', error);
    res.status(500).json({ error: 'Failed to get invoices' });
  }
};

// Get single invoice
const getInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    
    const invoice = await Invoice.findOne({
      _id: id,
      sellerId: req.user._id
    }).populate('items', 'brand model refNo priceListed currency images');

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json({ invoice });
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ error: 'Failed to get invoice' });
  }
};

// Create new invoice
const createInvoice = async (req, res) => {
  try {
    const {
      buyer,
      items,
      subtotal,
      tax = 0,
      discount = 0,
      total,
      currency,
      paymentMethod,
      dueDate,
      notes
    } = req.body;

    // Validate items exist and belong to user's company
    const inventoryItems = await Inventory.find({
      _id: { $in: items },
      companyId: req.user.companyId
    });

    if (inventoryItems.length !== items.length) {
      return res.status(400).json({ error: 'Some inventory items not found or not accessible' });
    }

    const invoice = new Invoice({
      sellerId: req.user._id,
      buyer,
      items,
      subtotal,
      tax,
      discount,
      total,
      currency: currency || req.user.defaultCurrency,
      paymentMethod,
      status: 'Pending',
      dueDate: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
      notes
    });

    await invoice.save();

    // Populate items for response
    await invoice.populate('items', 'brand model refNo priceListed currency');

    res.status(201).json({
      message: 'Invoice created successfully',
      invoice
    });
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
};

// Update invoice
const updateInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData.invoiceNo;
    delete updateData.sellerId;

    const invoice = await Invoice.findOneAndUpdate(
      {
        _id: id,
        sellerId: req.user._id
      },
      updateData,
      { new: true }
    ).populate('items', 'brand model refNo priceListed currency');

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json({
      message: 'Invoice updated successfully',
      invoice
    });
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
};

// Delete invoice
const deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await Invoice.findOneAndDelete({
      _id: id,
      sellerId: req.user._id
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
};

// Generate PDF for invoice
const generateInvoicePDF = async (req, res) => {
  try {
    const { id } = req.params;
    
    const invoice = await Invoice.findOne({
      _id: id,
      sellerId: req.user._id
    }).populate('items', 'brand model refNo priceListed currency');

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const pdfGenerator = new PDFGenerator();
    const pdfBuffer = await pdfGenerator.generateInvoicePDF(invoice);

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNo}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    console.error('Generate invoice PDF error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
};

// Mark invoice as paid
const markInvoiceAsPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentDate, paymentMethod } = req.body;

    const invoice = await Invoice.findOneAndUpdate(
      {
        _id: id,
        sellerId: req.user._id
      },
      {
        status: 'Paid',
        paymentDate: paymentDate || new Date(),
        paymentMethod: paymentMethod || invoice.paymentMethod
      },
      { new: true }
    ).populate('items', 'brand model refNo priceListed currency');

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json({
      message: 'Invoice marked as paid successfully',
      invoice
    });
  } catch (error) {
    console.error('Mark invoice as paid error:', error);
    res.status(500).json({ error: 'Failed to mark invoice as paid' });
  }
};

// Get invoice statistics
const getInvoiceStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const dateFilter = {};
    if (startDate || endDate) {
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);
    }

    const stats = await Invoice.aggregate([
      {
        $match: {
          sellerId: req.user._id,
          ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
        }
      },
      {
        $group: {
          _id: null,
          totalInvoices: { $sum: 1 },
          totalAmount: { $sum: '$total' },
          paidAmount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'Paid'] }, '$total', 0]
            }
          },
          pendingAmount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'Pending'] }, '$total', 0]
            }
          },
          byStatus: {
            $push: {
              status: '$status',
              amount: '$total'
            }
          },
          byPaymentMethod: {
            $push: {
              method: '$paymentMethod',
              amount: '$total'
            }
          }
        }
      }
    ]);

    if (stats.length === 0) {
      return res.json({
        totalInvoices: 0,
        totalAmount: 0,
        paidAmount: 0,
        pendingAmount: 0,
        byStatus: {},
        byPaymentMethod: {}
      });
    }

    const stat = stats[0];
    
    // Process status breakdown
    const statusBreakdown = {};
    stat.byStatus.forEach(item => {
      statusBreakdown[item.status] = (statusBreakdown[item.status] || 0) + item.amount;
    });

    // Process payment method breakdown
    const paymentMethodBreakdown = {};
    stat.byPaymentMethod.forEach(item => {
      paymentMethodBreakdown[item.method] = (paymentMethodBreakdown[item.method] || 0) + item.amount;
    });

    res.json({
      totalInvoices: stat.totalInvoices,
      totalAmount: stat.totalAmount,
      paidAmount: stat.paidAmount,
      pendingAmount: stat.pendingAmount,
      byStatus: statusBreakdown,
      byPaymentMethod: paymentMethodBreakdown
    });
  } catch (error) {
    console.error('Get invoice stats error:', error);
    res.status(500).json({ error: 'Failed to get invoice statistics' });
  }
};

module.exports = {
  getAllInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  generateInvoicePDF,
  markInvoiceAsPaid,
  getInvoiceStats
}; 