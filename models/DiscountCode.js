const mongoose = require('mongoose');

const discountCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  description: {
    type: String,
    trim: true
  },
  discountPercent: {
    type: Number,
    min: 0,
    max: 100
  },
  expiresAt: {
    type: Date
  },
  usageLimit: {
    type: Number,
    min: 0
  },
  usedCount: {
    type: Number,
    default: 0,
    min: 0
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Method to check if discount code is expired
discountCodeSchema.methods.isExpired = function() {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
};

// Method to check if discount code is active and not expired
discountCodeSchema.methods.isActive = function() {
  return this.active && !this.isExpired();
};

// Pre-save middleware to automatically disable expired codes
discountCodeSchema.pre('save', function(next) {
  if (this.isExpired()) {
    this.active = false;
  }
  next();
});

// Static method to get all active codes (not expired)
discountCodeSchema.statics.findActive = function() {
  return this.find({
    active: true,
    $or: [
      { expiresAt: { $gt: new Date() } },
      { expiresAt: null }
    ]
  });
};

// Static method to disable expired codes
discountCodeSchema.statics.disableExpiredCodes = async function() {
  const result = await this.updateMany(
    {
      active: true,
      expiresAt: { $lt: new Date() }
    },
    {
      $set: { active: false }
    }
  );
  return result;
};

module.exports = mongoose.model('DiscountCode', discountCodeSchema); 