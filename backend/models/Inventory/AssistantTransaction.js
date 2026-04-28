const mongoose = require("mongoose");

const assistantTransactionSchema = new mongoose.Schema(
  {
    // Email of the Assistant initiating the transaction
    fromAssistantEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    // Overall transaction/request status
    status: {
      type: String,
      enum: [
        "Pending",
        "Partially Approved",
        "Approved",
        "Rejected",
        "Completed",
      ],
      default: "Pending",
    },

    requestedDate: {
      type: Date,
      default: Date.now,
    },

    approvedDate: Date,

    // Optional remarks or notes (reason for transaction)
    notes: {
      type: String,
      trim: true,
    },

    // List of items requested by the assistant
    items: [
      {
        item: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "InventoryItem",
          required: true,
        },
        requestedQuantity: {
          type: Number,
          required: true,
          min: 1,
        },
        approvedQuantity: {
          type: Number,
          default: 0,
          min: 0,
        },
        itemStatus: {
          type: String,
          enum: ["Pending", "Approved", "Rejected", "Received"],
          default: "Pending",
        },
      },
    ],

    // Optional: for system tracking
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

//  Auto-update full transaction status based on item statuses
assistantTransactionSchema.pre("save", function (next) {
  if (this.items && this.items.length > 0) {
    const allApproved = this.items.every((i) => i.itemStatus === "Approved");
    const allReceived = this.items.every((i) => i.itemStatus === "Received");
    const allRejected = this.items.every((i) => i.itemStatus === "Rejected");
    const someApproved = this.items.some((i) => i.itemStatus === "Approved");

    if (allReceived) this.status = "Completed";
    else if (allApproved) this.status = "Approved";
    else if (someApproved) this.status = "Partially Approved";
    else if (allRejected) this.status = "Rejected";
    else this.status = "Pending";
  }
  next();
});

module.exports = mongoose.model(
  "AssistantTransaction",
  assistantTransactionSchema
);
