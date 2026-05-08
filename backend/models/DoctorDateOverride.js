const mongoose = require("mongoose");

const overrideSlotSchema = new mongoose.Schema(
  {
    startTime: { type: String, default: "09:00" },
    endTime:   { type: String, default: "18:00" },
    type:      { type: String, enum: ["working", "break"], default: "working" },
  },
  { _id: false }
);

const doctorDateOverrideSchema = new mongoose.Schema(
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
    isDayOff: {
      type: Boolean,
      default: false,
    },
    slots: {
      type: [overrideSlotSchema],
      default: [],
    },
  },
  { timestamps: true }
);

// One override per doctor per date
doctorDateOverrideSchema.index({ doctorEmail: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("DoctorDateOverride", doctorDateOverrideSchema);
