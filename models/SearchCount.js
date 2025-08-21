const mongoose = require('mongoose');

const SearchCountSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },
    value: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('SearchCount', SearchCountSchema);