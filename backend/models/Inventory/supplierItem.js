// models/SupplierItem.js
const mongoose = require("mongoose");

const supplierItemSchema = new mongoose.Schema({
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
  item: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryItem", required: true },
  supplierProductCode: String, // optional, if supplier uses a different code
  price: { type: Number, required: true },
  minOrderQty: { type: Number, default: 1 },
  lastUpdated: { type: Date, default: Date.now },
  branch: {
    type: String,
  },
});

supplierItemSchema.index({ supplier: 1, item: 1 }, { unique: true }); // Prevent duplicate supplier-product combos

module.exports = mongoose.model("SupplierItem", supplierItemSchema);
