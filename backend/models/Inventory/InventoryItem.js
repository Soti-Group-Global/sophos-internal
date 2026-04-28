// models/InventoryItem.js
const mongoose = require("mongoose");

const inventoryItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: {
    type: String,
    enum: ["Medicine", "Consumable", "Equipment", "Lab Supply", "Other"],
    default: "Medicine"
  },
  sku: { type: String, unique: true },
  description: String,
  unit: { type: String, default: "pcs" },
  manufacturer: String,

  // Reorder Logic
  reorderLevel: { type: Number, default: 10 },
  reorderQuantity: { type: Number, default: 50 },
  preferredSupplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier" },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("InventoryItem", inventoryItemSchema);
