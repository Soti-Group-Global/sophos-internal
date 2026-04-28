const mongoose = require("mongoose");

const purchaseOrderSchema = new mongoose.Schema({
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Supplier",
    required: true,
  },
  orderDate: { type: Date, default: Date.now },
  receivedDate: Date,

  //  Each item has its own status
  items: [
    {
      item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "InventoryItem",
        required: true,
      },
      batchNumber: String,
      expiryDate: Date,
      quantity: { type: Number, required: true },
      costPrice: { type: Number, required: true },
      receivedQuantity: { type: Number, default: 0 },
      itemStatus: {
        type: String,
        enum: ["Pending", "Partially Received", "Received", "Cancelled"],
        default: "Pending",
      },
      remarks: String,
      updatedAt: { type: Date, default: Date.now },
    },
  ],
    branch: {
    type: String,
  },

  totalAmount: Number,

  // Optional overall order status (based on item statuses)
  status: {
    type: String,
    enum: ["Pending", "Partially Received", "Received", "Cancelled"],
    default: "Pending",
  },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

// Middleware to auto-update overall status
purchaseOrderSchema.pre("save", function (next) {
  if (this.items && this.items.length > 0) {
    const allStatuses = this.items.map((i) => i.itemStatus);
    if (allStatuses.every((s) => s === "Received")) {
      this.status = "Received";
    } else if (allStatuses.every((s) => s === "Cancelled")) {
      this.status = "Cancelled";
    } else if (
      allStatuses.some((s) => s === "Received" || s === "Partially Received")
    ) {
      this.status = "Partially Received";
    } else {
      this.status = "Pending";
    }
  }
  next();
});

module.exports = mongoose.model("PurchaseOrder", purchaseOrderSchema);
