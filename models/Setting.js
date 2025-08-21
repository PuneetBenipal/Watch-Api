const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  value: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

module.exports = Setting = mongoose.model('Setting', SettingSchema);