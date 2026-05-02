const mongoose = require("mongoose");

const breakSlotSchema = new mongoose.Schema(
  {
    startTime: { type: String, required: true }, // "HH:MM"
    endTime:   { type: String, required: true }, // "HH:MM"
  },
  { _id: false }
);

const doctorBreakSchema = new mongoose.Schema(
  {
    doctorEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    date: {
      type: String, // "YYYY-MM-DD"
      required: true,
    },
    breaks: {
      type: [breakSlotSchema],
      default: [],
    },
    comment: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

// One record per doctor per date
doctorBreakSchema.index({ doctorEmail: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("DoctorBreak", doctorBreakSchema);
