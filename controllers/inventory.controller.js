const { Inventory } = require('../models/inventory');
const Company = require('../models/Company.model');
const { asyncHandler } = require('../middlewares/error.middleware');

// Get all inventory items for a company
const getInventory = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, brand, model, visibility } = req.query;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = { companyId: req.user.companyId.toString() };

    if (status) filter.status = status;
    if (brand) filter.brand = { $regex: brand, $options: 'i' };
    if (model) filter.model = { $regex: model, $options: 'i' };
    if (visibility) filter.visibility = visibility;
    console.log(' ==========>', req.user.companyId, filter)
    const inventory = await Inventory.find(filter)
      .populate('dealerId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    console.log('inventory ==>', inventory)
    const total = await Inventory.countDocuments(filter);

    res.json({
      inventory,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        totalItems: total
      }
    });
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ error: 'Failed to get inventory' });
  }
};

// Get single inventory item
const getInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("id =>>>>>>>", id)
    const item = await Inventory.findOne({
      _id: id,
      companyId: req.user.companyId
    }).populate('dealerId', 'name email');

    if (!item) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    res.json({ item });
  } catch (error) {
    console.error('Get inventory item error:', error);
    res.status(500).json({ error: 'Failed to get inventory item' });
  }
};

// Create new inventory item
const createInventoryItem = async (req, res) => {
  try {
    const {
      brand,
      model,
      refNo,
      year,
      condition,
      pricePaid,
      priceListed,
      currency,
      country,
      visibility,
      description,
      features,
      serialNumber,
      boxPapers,
      movement,
      caseSize,
      caseMaterial,
      braceletMaterial,
      dialColor,
      waterResistance
    } = req.body;

    // Check if user has company
    if (!req.user.companyId) {
      return res.status(400).json({ error: 'User must be associated with a company' });
    }

    // Process uploaded images
    let images = [];
    if (req.files && req.files.length > 0) {
      images = req.files.map(file => `/uploads/${file.filename}`);
    }

    const inventoryItem = new Inventory({
      companyId: req.user.companyId,
      dealerId: req.user._id,
      brand,
      model,
      refNo,
      year: year ? parseInt(year) : undefined,
      condition,
      pricePaid: pricePaid ? parseFloat(pricePaid) : undefined,
      priceListed: priceListed ? parseFloat(priceListed) : undefined,
      currency: currency || req.user.defaultCurrency,
      country,
      visibility: visibility || 'private',
      description,
      features: features || [],
      serialNumber,
      boxPapers,
      movement,
      caseSize,
      caseMaterial,
      braceletMaterial,
      dialColor,
      waterResistance,
      images
    });

    await inventoryItem.save();

    res.status(201).json({
      message: 'Inventory item created successfully',
      item: inventoryItem
    });
  } catch (error) {
    console.error('Create inventory item error:', error);
    res.status(500).json({ error: 'Create inventory error detailsventory item' });
  }
};

// Update inventory item
const updateInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      brand,
      model,
      refNo,
      year,
      condition,
      pricePaid,
      priceListed,
      currency,
      country,
      visibility,
      description,
      features,
      serialNumber,
      boxPapers,
      movement,
      caseSize,
      caseMaterial,
      braceletMaterial,
      dialColor,
      waterResistance
    } = req.body;

    // Build update data
    const updateData = {
      brand,
      model,
      refNo,
      year: year ? parseInt(year) : undefined,
      condition,
      pricePaid: pricePaid ? parseFloat(pricePaid) : undefined,
      priceListed: priceListed ? parseFloat(priceListed) : undefined,
      currency,
      country,
      visibility,
      description,
      features,
      serialNumber,
      boxPapers,
      movement,
      caseSize,
      caseMaterial,
      braceletMaterial,
      dialColor,
      waterResistance
    };

    // Process uploaded images
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => `/uploads/${file.filename}`);
      updateData.images = newImages;
    }

    const item = await Inventory.findOneAndUpdate(
      {
        _id: id,
        companyId: req.user.companyId
      },
      updateData,
      { new: true }
    ).populate('dealerId', 'name email');

    if (!item) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    res.json({
      message: 'Inventory item updated successfully',
      item
    });
  } catch (error) {
    console.error('Update inventory item error:', error);
    res.status(500).json({ error: 'Failed to update inventory item' });
  }
};

// Delete inventory item
const deleteInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await Inventory.findOneAndDelete({
      _id: id,
      companyId: req.user.companyId
    });

    if (!item) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    res.json({ message: 'Inventory item deleted successfully' });
  } catch (error) {
    console.error('Delete inventory item error:', error);
    res.status(500).json({ error: 'Failed to delete inventory item' });
  }
};

// Get inventory statistics
const getInventoryStats = async (req, res) => {
  try {
    const stats = await Inventory.aggregate([
      { $match: { companyId: req.user.companyId } },
      {
        $group: {
          _id: null,
          totalItems: { $sum: 1 },
          totalValue: { $sum: '$priceListed' },
          averagePrice: { $avg: '$priceListed' },
          byStatus: {
            $push: {
              status: '$status',
              price: '$priceListed'
            }
          },
          byBrand: {
            $push: {
              brand: '$brand',
              count: 1
            }
          }
        }
      }
    ]);

    if (stats.length === 0) {
      return res.json({
        totalItems: 0,
        totalValue: 0,
        averagePrice: 0,
        byStatus: {},
        byBrand: {}
      });
    }

    const stat = stats[0];

    // Process status breakdown
    const statusBreakdown = {};
    stat.byStatus.forEach(item => {
      statusBreakdown[item.status] = (statusBreakdown[item.status] || 0) + 1;
    });

    // Process brand breakdown
    const brandBreakdown = {};
    stat.byBrand.forEach(item => {
      brandBreakdown[item.brand] = (brandBreakdown[item.brand] || 0) + 1;
    });

    res.json({
      totalItems: stat.totalItems,
      totalValue: stat.totalValue,
      averagePrice: stat.averagePrice,
      byStatus: statusBreakdown,
      byBrand: brandBreakdown
    });
  } catch (error) {
    console.error('Get inventory stats error:', error);
    res.status(500).json({ error: 'Failed to get inventory statistics' });
  }
};

// Bulk update inventory status
const bulkUpdateStatus = async (req, res) => {
  try {
    const { itemIds, status } = req.body;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ error: 'Item IDs array is required' });
    }

    if (!['Available', 'On Hold', 'Sold', 'Reserved', 'In Transit', 'Under Repair'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await Inventory.updateMany(
      {
        _id: { $in: itemIds },
        companyId: req.user.companyId
      },
      { status }
    );

    res.json({
      message: `Updated ${result.modifiedCount} items to ${status}`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Bulk update status error:', error);
    res.status(500).json({ error: 'Failed to update inventory status' });
  }
};

// Search inventory
const searchInventory = async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const searchFilter = {
      companyId: req.user.companyId,
      $or: [
        { brand: { $regex: q, $options: 'i' } },
        { model: { $regex: q, $options: 'i' } },
        { refNo: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ]
    };

    const inventory = await Inventory.find(searchFilter)
      .populate('dealerId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Inventory.countDocuments(searchFilter);

    res.json({
      inventory,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        totalItems: total
      }
    });
  } catch (error) {
    console.error('Search inventory error:', error);
    res.status(500).json({ error: 'Failed to search inventory' });
  }
};

module.exports = {
  getInventory,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  getInventoryStats,
  bulkUpdateStatus,
  searchInventory
}; 