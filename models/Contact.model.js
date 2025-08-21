const mongoose = require("mongoose");
const { Schema } = mongoose;

const CONTACT_TYPES = ["dealer", "customer"];

const ContactSchema = new Schema({
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    type: { type: String, enum: CONTACT_TYPES, required: true }, // dealer | customer

    // Common
    companyName: { type: String, trim: true },                   // for dealers
    fullName: { type: String, trim: true },                      // for customers or dealer contact person
    contactPerson: { type: String, trim: true },
    whatsapp: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },

    country: { type: String, trim: true },
    city: { type: String, trim: true },
    defaultCurrency: { type: String },                           // optional per contact

    tags: [{ type: String, trim: true }],
    notes: { type: String, trim: true },

    // CRM metrics
    lastContactedAt: { type: Date },
    lifetimeValue: { type: Number, default: 0 }                  // for customers
}, { timestamps: true });

ContactSchema.index({ companyId: 1, type: 1 });
ContactSchema.index({ companyId: 1, email: 1 });

module.exports = Contact = mongoose.model("Contact", ContactSchema);
