const mongoose = require("mongoose");

const slotSchema = new mongoose.Schema(
  {
    startTime: { type: String, default: "09:00" },
    endTime:   { type: String, default: "18:00" },
    type:      { type: String, enum: ["working", "break"], default: "working" },
  },
  { _id: false }
);

const dayScheduleSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      required: true,
    },
    isDayOff: { type: Boolean, default: false },
    slots: { type: [slotSchema], default: [] },
  },
  { _id: false }
);

const doctorWeeklyScheduleSchema = new mongoose.Schema(
  {
    doctorEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    schedule: [dayScheduleSchema],
  },
  { timestamps: true }
);

const DEFAULT_SCHEDULE = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
].map((day) => ({
  day,
  isDayOff: day === "Sunday",
  slots: day === "Sunday"
    ? []
    : [{ startTime: "09:00", endTime: "18:00", type: "working" }],
}));

doctorWeeklyScheduleSchema.statics.DEFAULT_SCHEDULE = DEFAULT_SCHEDULE;

const DoctorWeeklySchedule = mongoose.model("DoctorWeeklySchedule", doctorWeeklyScheduleSchema);
DoctorWeeklySchedule.DEFAULT_SCHEDULE = DEFAULT_SCHEDULE;
module.exports = DoctorWeeklySchedule;
