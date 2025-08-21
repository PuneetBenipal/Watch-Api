const mongoose = require('mongoose');

const AlertEventSchema = new mongoose.Schema({
    alertId: { type: mongoose.Types.ObjectId, ref: 'Alert', index: true, required: true },
    companyId: { type: mongoose.Types.ObjectId, index: true, required: true },
    listingId: { type: mongoose.Types.ObjectId, index: true, required: true },
    firedAt: { type: Date, default: Date.now, index: true },
    reason: { type: String },
    payload: { type: Object },
    deliveredChannels: { type: [String], enum: ['in_app', 'email', 'whatsapp'], default: ['in_app'] }
}, { timestamps: true });

AlertEventSchema.index({ alertId: 1, listingId: 1 }, { unique: true });

module.exports = mongoose.model('AlertEvent', AlertEventSchema);
