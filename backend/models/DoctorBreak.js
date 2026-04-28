const mongoose = require("mongoose");

const doctorBreakSchema = new mongoose.Schema(
  {
    doctorEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    date: {
      type: String, // Format: "YYYY-MM-DD"
      required: true,
    },
    breaks: [
      {
        startTime: {
          type: String, // Format: "HH:MM"
          required: true,
        },
        endTime: {
          type: String, // Format: "HH:MM"
          required: true,
        },
      },
    ],
    comment: {
      type: String,
      trim: true,
      default: "",
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Create compound index for efficient querying
doctorBreakSchema.index({ doctorEmail: 1, date: 1 });

module.exports = mongoose.model("DoctorBreak", doctorBreakSchema);
