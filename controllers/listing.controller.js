const Listing = require('../models/listing');
const WhatsAppParser = require('../services/whatsappParser');
const { asyncHandler } = require('../middlewares/error.middleware');

// Get all listings (public)
const getListings = async (req, res) => {
  try {
    const { page = 1, limit = 20, brand, model, maxPrice, country } = req.query;
    const skip = (page - 1) * limit;

    const filter = { processingStatus: 'processed' };
    
    if (brand) filter['parsed.brand'] = { $regex: brand, $options: 'i' };
    if (model) filter['parsed.model'] = { $regex: model, $options: 'i' };
    if (maxPrice) filter['parsed.price'] = { $lte: parseFloat(maxPrice) };
    if (country) filter['parsed.location'] = { $regex: country, $options: 'i' };

    const listings = await Listing.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Listing.countDocuments(filter);

    res.json({
      listings,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        totalItems: total
      }
    });
  } catch (error) {
    console.error('Get listings error:', error);
    res.status(500).json({ error: 'Failed to get listings' });
  }
};

// Search listings
const searchListings = async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const searchFilter = {
      processingStatus: 'processed',
      $or: [
        { 'parsed.brand': { $regex: q, $options: 'i' } },
        { 'parsed.model': { $regex: q, $options: 'i' } },
        { 'parsed.refNo': { $regex: q, $options: 'i' } },
        { messageText: { $regex: q, $options: 'i' } }
      ]
    };

    const listings = await Listing.find(searchFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Listing.countDocuments(searchFilter);

    res.json({
      listings,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        totalItems: total
      }
    });
  } catch (error) {
    console.error('Search listings error:', error);
    res.status(500).json({ error: 'Failed to search listings' });
  }
};

// Get single listing
const getListing = async (req, res) => {
  try {
    const { id } = req.params;

    const listing = await Listing.findById(id);

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    res.json({ listing });
  } catch (error) {
    console.error('Get listing error:', error);
    res.status(500).json({ error: 'Failed to get listing' });
  }
};

// Admin: Parse WhatsApp groups
const parseWhatsAppGroups = async (req, res) => {
  try {
    const { groupIds, limit = 50 } = req.body;

    if (!groupIds || !Array.isArray(groupIds)) {
      return res.status(400).json({ error: 'Group IDs array is required' });
    }

    const whatsappParser = new WhatsAppParser();
    await whatsappParser.initialize();

    const results = [];

    for (const groupId of groupIds) {
      try {
        const listings = await whatsappParser.processGroupListings(groupId, limit);
        results.push({
          groupId,
          success: true,
          count: listings.length
        });
      } catch (error) {
        console.error(`Failed to parse group ${groupId}:`, error);
        results.push({
          groupId,
          success: false,
          error: error.message
        });
      }
    }

    await whatsappParser.close();

    res.json({
      message: 'WhatsApp parsing completed',
      results
    });
  } catch (error) {
    console.error('Parse WhatsApp groups error:', error);
    res.status(500).json({ error: 'Failed to parse WhatsApp groups' });
  }
};

// Admin: Create listing manually
const createListing = async (req, res) => {
  try {
    const {
      groupId,
      messageText,
      parsed,
      sourceType = 'manual',
      countryTag
    } = req.body;

    const listing = new Listing({
      groupId,
      messageText,
      parsed,
      sourceType,
      countryTag,
      isProcessed: true,
      processingStatus: 'processed',
      confidence: calculateConfidence(parsed)
    });

    await listing.save();

    res.status(201).json({
      message: 'Listing created successfully',
      listing
    });
  } catch (error) {
    console.error('Create listing error:', error);
    res.status(500).json({ error: 'Failed to create listing' });
  }
};

// Admin: Update listing
const updateListing = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const listing = await Listing.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    res.json({
      message: 'Listing updated successfully',
      listing
    });
  } catch (error) {
    console.error('Update listing error:', error);
    res.status(500).json({ error: 'Failed to update listing' });
  }
};

// Admin: Delete listing
const deleteListing = async (req, res) => {
  try {
    const { id } = req.params;

    const listing = await Listing.findByIdAndDelete(id);

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    res.json({ message: 'Listing deleted successfully' });
  } catch (error) {
    console.error('Delete listing error:', error);
    res.status(500).json({ error: 'Failed to delete listing' });
  }
};

// Admin: Get listing statistics
const getListingStats = async (req, res) => {
  try {
    const stats = await Listing.aggregate([
      {
        $group: {
          _id: null,
          totalListings: { $sum: 1 },
          byStatus: {
            $push: {
              status: '$processingStatus',
              count: 1
            }
          },
          bySource: {
            $push: {
              source: '$sourceType',
              count: 1
            }
          },
          byBrand: {
            $push: {
              brand: '$parsed.brand',
              count: 1
            }
          },
          averageConfidence: { $avg: '$confidence' }
        }
      }
    ]);

    if (stats.length === 0) {
      return res.json({
        totalListings: 0,
        byStatus: {},
        bySource: {},
        byBrand: {},
        averageConfidence: 0
      });
    }

    const stat = stats[0];
    
    // Process status breakdown
    const statusBreakdown = {};
    stat.byStatus.forEach(item => {
      statusBreakdown[item.status] = (statusBreakdown[item.status] || 0) + 1;
    });

    // Process source breakdown
    const sourceBreakdown = {};
    stat.bySource.forEach(item => {
      sourceBreakdown[item.source] = (sourceBreakdown[item.source] || 0) + 1;
    });

    // Process brand breakdown
    const brandBreakdown = {};
    stat.byBrand.forEach(item => {
      if (item.brand) {
        brandBreakdown[item.brand] = (brandBreakdown[item.brand] || 0) + 1;
      }
    });

    res.json({
      totalListings: stat.totalListings,
      byStatus: statusBreakdown,
      bySource: sourceBreakdown,
      byBrand: brandBreakdown,
      averageConfidence: stat.averageConfidence
    });
  } catch (error) {
    console.error('Get listing stats error:', error);
    res.status(500).json({ error: 'Failed to get listing statistics' });
  }
};

// Helper function to calculate confidence
const calculateConfidence = (parsed) => {
  let confidence = 0;
  
  if (parsed.brand) confidence += 0.3;
  if (parsed.price) confidence += 0.3;
  if (parsed.refNo) confidence += 0.2;
  if (parsed.year) confidence += 0.1;
  if (parsed.condition) confidence += 0.1;
  
  return Math.min(confidence, 1);
};

// Admin: Bulk delete listings
const bulkDeleteListings = async (req, res) => {
  try {
    const { listingIds } = req.body;

    if (!listingIds || !Array.isArray(listingIds) || listingIds.length === 0) {
      return res.status(400).json({ error: 'Listing IDs array is required' });
    }

    const result = await Listing.deleteMany({
      _id: { $in: listingIds }
    });

    res.json({
      message: `Deleted ${result.deletedCount} listings`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Bulk delete listings error:', error);
    res.status(500).json({ error: 'Failed to delete listings' });
  }
};

// Admin: Reprocess listings
const reprocessListings = async (req, res) => {
  try {
    const { listingIds } = req.body;

    if (!listingIds || !Array.isArray(listingIds) || listingIds.length === 0) {
      return res.status(400).json({ error: 'Listing IDs array is required' });
    }

    const result = await Listing.updateMany(
      {
        _id: { $in: listingIds }
      },
      {
        isProcessed: false,
        processingStatus: 'pending'
      }
    );

    res.json({
      message: `Reprocessing ${result.modifiedCount} listings`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Reprocess listings error:', error);
    res.status(500).json({ error: 'Failed to reprocess listings' });
  }
};

module.exports = {
  getListings,
  searchListings,
  getListing,
  parseWhatsAppGroups,
  createListing,
  updateListing,
  deleteListing,
  getListingStats,
  bulkDeleteListings,
  reprocessListings
}; 