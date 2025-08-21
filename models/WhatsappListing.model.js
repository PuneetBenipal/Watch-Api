// models/WhatsappListing.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const WhatsappListingSchema = new Schema({
    companyId: {
        type: Schema.Types.ObjectId,
        ref: "Company",
        required: true,
        index: true
    },

    brand: { type: String },
    model: { type: String },
    refNo: { type: String },
    price: { type: Number },
    currency: { type: String, default: "USD" },
    sellerName: { type: String },                   // parsed seller label
    images: [{ type: String }],

    country: { type: String },                      // classifier result (UK, UAE, etc.)
    groupName: { type: String },                    // originating group
    messageId: { type: String },                    // source identifier
    duplicateHash: { type: String, index: true },   // for dedupe

    parsedAt: { type: Date, default: Date.now }
}, { timestamps: true });

WhatsappListingSchema.index({ companyId: 1, createdAt: -1 });
WhatsappListingSchema.index({ companyId: 1, brand: 1, refNo: 1, country: 1 });

const WhatsAppListingSvc =  mongoose.model("WhatsappListing", WhatsappListingSchema);
module.exports = WhatsAppListingSvc;
