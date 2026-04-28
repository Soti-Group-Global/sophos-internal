const mongoose = require("mongoose");

const supplierSchema = new mongoose.Schema({
  name: { type: String, required: true },
  contactPerson: String,
  phone: String,
  email: String,
  address: String,
  gstNumber: String,
  bankDetails: {
    accountName: String,
    accountNumber: String,
    ifscCode: String,
  },
  branch: {
    type: String,
  },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Supplier", supplierSchema);
