// const express = require('express');
// const router = express.Router();
// const { isAuth, isDealer } = require('../middlewares/auth.middleware');
// const Alert = require('../models/Alert');

// // All routes require authentication and dealer role
// router.use(isAuth);
// router.use(isDealer);

// // Get all alerts for user
// router.get('/', async (req, res) => {
//   try {
//     const alerts = await Alert.find({ userId: req.user._id })
//       .sort({ createdAt: -1 });

//     res.json({ alerts });
//   } catch (error) {
//     console.error('Get alerts error:', error);
//     res.status(500).json({ error: 'Failed to get alerts' });
//   }
// });

// // Get single alert
// router.get('/:id', async (req, res) => {
//   try {
//     const alert = await Alert.findOne({
//       _id: req.params.id,
//       userId: req.user._id
//     });

//     if (!alert) {
//       return res.status(404).json({ error: 'Alert not found' });
//     }

//     res.json({ alert });
//   } catch (error) {
//     console.error('Get alert error:', error);
//     res.status(500).json({ error: 'Failed to get alert' });
//   }
// });

// // Create new alert
// router.post('/', async (req, res) => {
//   try {
//     const {
//       name,
//       description,
//       filters,
//       channel,
//       notificationSettings
//     } = req.body;

//     const alert = new Alert({
//       userId: req.user._id,
//       name,
//       description,
//       filters,
//       channel: channel || 'email',
//       notificationSettings: notificationSettings || {
//         email: true,
//         telegram: false,
//         inApp: true
//       }
//     });

//     await alert.save();

//     res.status(201).json({
//       message: 'Alert created successfully',
//       alert
//     });
//   } catch (error) {
//     console.error('Create alert error:', error);
//     res.status(500).json({ error: 'Failed to create alert' });
//   }
// });

// // Update alert
// router.put('/:id', async (req, res) => {
//   try {
//     const updateData = req.body;

//     const alert = await Alert.findOneAndUpdate(
//       {
//         _id: req.params.id,
//         userId: req.user._id
//       },
//       updateData,
//       { new: true }
//     );

//     if (!alert) {
//       return res.status(404).json({ error: 'Alert not found' });
//     }

//     res.json({
//       message: 'Alert updated successfully',
//       alert
//     });
//   } catch (error) {
//     console.error('Update alert error:', error);
//     res.status(500).json({ error: 'Failed to update alert' });
//   }
// });

// // Delete alert
// router.delete('/:id', async (req, res) => {
//   try {
//     const alert = await Alert.findOneAndDelete({
//       _id: req.params.id,
//       userId: req.user._id
//     });

//     if (!alert) {
//       return res.status(404).json({ error: 'Alert not found' });
//     }

//     res.json({ message: 'Alert deleted successfully' });
//   } catch (error) {
//     console.error('Delete alert error:', error);
//     res.status(500).json({ error: 'Failed to delete alert' });
//   }
// });

// // Toggle alert active status
// router.put('/:id/toggle', async (req, res) => {
//   try {
//     const alert = await Alert.findOne({
//       _id: req.params.id,
//       userId: req.user._id
//     });

//     if (!alert) {
//       return res.status(404).json({ error: 'Alert not found' });
//     }

//     alert.isActive = !alert.isActive;
//     await alert.save();

//     res.json({
//       message: `Alert ${alert.isActive ? 'activated' : 'deactivated'} successfully`,
//       alert
//     });
//   } catch (error) {
//     console.error('Toggle alert error:', error);
//     res.status(500).json({ error: 'Failed to toggle alert' });
//   }
// });

// module.exports = router;

const router = require('express').Router();
const Alert = require('../models/Alert');
const AlertEvent = require('../models/AlertEvent');
const { isAuth } = require("../middlewares/auth.middleware");

// GET /api/alerts
router.get('/', isAuth, async (req, res) => {
  const items = await Alert.find({ companyId: req.user.companyId }).sort({ updatedAt: -1 }).lean();
  res.json(items);
});

// POST /api/alerts
router.post('/', isAuth, async (req, res) => {
  const { name, isEnabled = true, notify = {}, throttlePerDay = 50, rules = [] } = req.body;
  const doc = await Alert.create({
    companyId: req.user.companyId, name, isEnabled,
    notify: { inApp: true, email: false, whatsapp: false, ...notify },
    throttlePerDay, rules
  });
  res.status(201).json({ id: doc._id });
});

// PUT /api/alerts/:id
router.put('/:id', isAuth, async (req, res) => {
  const _id = req.params.id;
  const { name, isEnabled, notify, throttlePerDay, rules } = req.body;
  await Alert.updateOne({ _id, companyId: req.user.companyId }, { $set: { name, isEnabled, notify, throttlePerDay, rules } });
  res.json({ ok: true });
});

// DELETE /api/alerts/:id
router.delete('/:id', isAuth, async (req, res) => {
  const _id = req.params.id;
  await Alert.deleteOne({ _id, companyId: req.user.companyId });
  res.json({ ok: true });
});

// GET /api/alerts/events?page=1&pageSize=20
router.get('/events', isAuth, async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const skip = (page - 1) * pageSize;
  const events = await AlertEvent.aggregate([
    { $match: { companyId: req.user.companyId } },
    { $sort: { firedAt: -1 } },
    { $skip: skip },
    { $limit: pageSize },
    { $lookup: { from: 'alerts', localField: 'alertId', foreignField: '_id', as: 'alert' } },
    { $addFields: { alert_name: { $ifNull: [{ $arrayElemAt: ['$alert.name', 0] }, ''] } } },
    { $project: { alert: 0 } }
  ]);
  res.json(events);
});

module.exports = router;
