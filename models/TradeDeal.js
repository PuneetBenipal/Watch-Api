const mongoose = require('mongoose');

const tradeDealSchema = new mongoose.Schema({
  sender_name: {
    type: String,
    trim: true,
    required: true
  },
  sender_number: {
    type: String,
    trim: true,
    required: true
  },
  status: {
    type: String,
    trim: true,
    enum: ['Direct', 'Forwarded'],
    default: 'Direct'
  },
  product_image: {
    type: String,
    trim: true
  },
  product_name: {
    type: String,
    trim: true
  },
  product_price: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Create indexes for better performance
tradeDealSchema.index({ sender_name: 1 });
tradeDealSchema.index({ product_name: 1 });
tradeDealSchema.index({ createdAt: 1 });
tradeDealSchema.index({ status: 1 });

const TradeDeal = mongoose.model('TradeDeal', tradeDealSchema);

module.exports = TradeDeal; 


// brand: { type: String },
// model: { type: String },
// refNo: { type: String },
// price: { type: Number },
// currency: { type: String, default: "USD" },