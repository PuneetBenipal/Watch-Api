const express = require('express');
const router = express.Router();
const { isAuth, optionalAuth } = require('../middlewares/auth.middleware');
const Listing = require('../models/Listing');
const WhatsAppParser = require('../services/whatsappParser');

// Public routes (optional auth)
router.use(optionalAuth);

// Get all listings with filtering
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      brand,
      model,
      maxPrice,
      minPrice,
      country,
      condition,
      year,
      processingStatus = 'processed'
    } = req.query;

    const skip = (page - 1) * limit;

    // Build filter object
    const filter = { processingStatus };

    if (brand) filter['parsed.brand'] = { $regex: brand, $options: 'i' };
    if (model) filter['parsed.model'] = { $regex: model, $options: 'i' };
    if (maxPrice) filter['parsed.price'] = { ...filter['parsed.price'], $lte: parseFloat(maxPrice) };
    if (minPrice) filter['parsed.price'] = { ...filter['parsed.price'], $gte: parseFloat(minPrice) };
    if (country) filter['parsed.location'] = { $regex: country, $options: 'i' };
    if (condition) filter['parsed.condition'] = { $regex: condition, $options: 'i' };
    if (year) filter['parsed.year'] = parseInt(year);

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
});

// Get single listing
router.get('/:id', async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    res.json({ listing });
  } catch (error) {
    console.error('Get listing error:', error);
    res.status(500).json({ error: 'Failed to get listing' });
  }
});

// Parse WhatsApp group (admin only)
router.post('/parse-group', isAuth, async (req, res) => {
  try {
    const { groupId, limit = 50 } = req.body;

    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const whatsappParser = new WhatsAppParser();
    await whatsappParser.initialize();

    const listings = await whatsappParser.processGroupListings(groupId, limit);

    res.json({
      message: `Processed ${listings.length} listings from group`,
      listings
    });
  } catch (error) {
    console.error('Parse group error:', error);
    res.status(500).json({ error: 'Failed to parse WhatsApp group' });
  }
});

// Manually create listing (admin only)
router.post('/', isAuth, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

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
      processingStatus: 'processed'
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
});

// Update listing (admin only)
router.put('/:id', isAuth, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const updateData = req.body;

    const listing = await Listing.findByIdAndUpdate(
      req.params.id,
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
});

// Delete listing (admin only)
router.delete('/:id', isAuth, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const listing = await Listing.findByIdAndDelete(req.params.id);

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    res.json({ message: 'Listing deleted successfully' });
  } catch (error) {
    console.error('Delete listing error:', error);
    res.status(500).json({ error: 'Failed to delete listing' });
  }
});

// Get listing statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = await Listing.aggregate([
      {
        $group: {
          _id: null,
          totalListings: { $sum: 1 },
          processedListings: {
            $sum: { $cond: [{ $eq: ['$processingStatus', 'processed'] }, 1, 0] }
          },
          failedListings: {
            $sum: { $cond: [{ $eq: ['$processingStatus', 'failed'] }, 1, 0] }
          },
          duplicateListings: {
            $sum: { $cond: [{ $eq: ['$processingStatus', 'duplicate'] }, 1, 0] }
          },
          byBrand: {
            $push: {
              brand: '$parsed.brand',
              count: 1
            }
          },
          byCountry: {
            $push: {
              country: '$countryTag',
              count: 1
            }
          }
        }
      }
    ]);

    if (stats.length === 0) {
      return res.json({
        totalListings: 0,
        processedListings: 0,
        failedListings: 0,
        duplicateListings: 0,
        byBrand: {},
        byCountry: {}
      });
    }

    const stat = stats[0];

    // Process brand breakdown
    const brandBreakdown = {};
    stat.byBrand.forEach(item => {
      if (item.brand) {
        brandBreakdown[item.brand] = (brandBreakdown[item.brand] || 0) + 1;
      }
    });

    // Process country breakdown
    const countryBreakdown = {};
    stat.byCountry.forEach(item => {
      if (item.country) {
        countryBreakdown[item.country] = (countryBreakdown[item.country] || 0) + 1;
      }
    });

    res.json({
      totalListings: stat.totalListings,
      processedListings: stat.processedListings,
      failedListings: stat.failedListings,
      duplicateListings: stat.duplicateListings,
      byBrand: brandBreakdown,
      byCountry: countryBreakdown
    });
  } catch (error) {
    console.error('Get listing stats error:', error);
    res.status(500).json({ error: 'Failed to get listing statistics' });
  }
});

module.exports = router; 