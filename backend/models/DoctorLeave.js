const mongoose = require("mongoose");

const doctorLeaveSchema = new mongoose.Schema(
  {
    doctorEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    startDate: {
      type: String,
      required: true,
    },
    endDate: {
      type: String,
      required: true,
    },
    workingDays: {
      type: Number,
      min: 0,
      default: null,
    },
    leaveType: {
      type: String,
      enum: [
        "Vacation",
        "Sick Leave",
        "Unpaid Leave",
        "Maternity/Paternity",
        "Other",
      ],
      default: "Vacation",
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Cancelled"],
      default: "Pending",
      index: true,
    },
    comment: {
      type: String,
      trim: true,
      default: "",
    },
    isGivenByAdmin: {
      type: Boolean,
      default: false,
    },
    reviewedBy: {
      type: String,
      default: null,
    },
    reviewedByName: {
      type: String,
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewComment: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

doctorLeaveSchema.index({ doctorEmail: 1, startDate: 1, endDate: 1 });
doctorLeaveSchema.index({ doctorEmail: 1, status: 1 });
doctorLeaveSchema.index({ startDate: 1, endDate: 1, status: 1 });

module.exports = mongoose.model("DoctorLeave", doctorLeaveSchema);
