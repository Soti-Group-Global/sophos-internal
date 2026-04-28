const mongoose = require("mongoose");

const stockTransactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["Usage", "Adjustment", "Transfer", "Return"],
    required: true
  },
  item: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryItem" },
  quantity: Number,
  fromLocation: String,
  toLocation: String,
  patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient" }, // optional
  notes: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("StockTransaction", stockTransactionSchema);
