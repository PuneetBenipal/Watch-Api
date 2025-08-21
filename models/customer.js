const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true,
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
    preferredCurrency: {
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
    lastPurchaseDate: {
        type: Date
    },
    lifetimeValue: {
        type: Number,
        default: 0
    },
    employer: {
        type: String,
        required: true
    }
}, { timestamps: true });

const Customer = mongoose.model('Customer', CustomerSchema);

module.exports = Customer;