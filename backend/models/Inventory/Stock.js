const mongoose = require("mongoose");

const stockSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "InventoryItem",
    required: true,
  },
  batchNumber: String,
  expiryDate: Date,
  quantity: { type: Number, default: 0 },
  branch: {
    type: String,
  },
  lastUpdated: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Stock", stockSchema);
