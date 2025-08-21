const mongoose = require("mongoose");
const { Schema } = mongoose;

const CURRENCIES = ["GBP", "USD", "AED", "HKD", "EUR"];

const PaymentSchema = new Schema({
    companyId: {
        type: Schema.Types.ObjectId, ref: "Company"
    },

    paymentId: String,

    amount: Number,
    method: String,
    status: String,
    currency: { type: String, enum: CURRENCIES },

    feature: String,

    paidAt: Date,

    isDeleted: Boolean,
    deletedAt: Date,

    createdAt: Date,
})

const Payment = mongoose.model("Payment", PaymentSchema);
module.exports = Payment;