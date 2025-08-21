const mongoose = require('mongoose');

const DealerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  contactPerson: {
    type: String,
    trim: true
  },
  whatsappNumber: {
    type: String,
    required: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  country: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    trim: true
  },
  businessType: {
    type: String,
    enum: ['dealer', 'retailer', 'broker'],
    default: 'dealer'
  },
  defaultCurrency: {
    type: String,
    enum: ['GBP', 'USD', 'AED', 'HKD', 'EUR', 'CHF', 'JPY'],
    default: 'USD'
  },
  notes: {
    type: String,
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  lastContacted: {
    type: Date,
    default: Date.now
  },
  employer: {
    type: String,
    required: true
  }
}, { timestamps: true });

const Dealer = mongoose.model('Dealer', DealerSchema);

module.exports = Dealer;