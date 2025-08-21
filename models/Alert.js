const mongoose = require('mongoose');

const RuleSchema = new mongoose.Schema({
  field: {
    type: String,
    enum: ['brand', 'model', 'ref', 'price', 'country', 'condition', 'sellerId', 'currency'],
    required: true
  },
  operator: {
    type: String,
    enum: ['eq', 'neq', 'contains', 'lte', 'gte', 'in', 'not_in', 'regex'],
    required: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  }
}, { _id: false });

const AlertSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Types.ObjectId,
    index: true,
    required: true
  },
  name: { type: String, required: true },
  isEnabled: { type: Boolean, default: true },
  notify: {
    inApp: { type: Boolean, default: true },
    email: { type: Boolean, default: false },
    whatsapp: { type: Boolean, default: false }
  },
  throttlePerDay: { type: Number, default: 50 },
  rules: {
    type: [RuleSchema],
    default: []
  }
}, { timestamps: true });

AlertSchema.index({ companyId: 1, updatedAt: -1 });

module.exports = Alert = mongoose.model('Alert', AlertSchema);
