const mongoose = require("mongoose");
const AccountSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    brand: {
      companyName: String,
      logoUrl: String,
      primaryColor: { type: String, default: "#111111" },
      footerNote: String,
      address: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Account", AccountSchema);
