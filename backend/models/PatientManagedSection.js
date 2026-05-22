const mongoose = require("mongoose");

const bookingFileSchema = new mongoose.Schema(
  {
    filename: { type: String, trim: true, default: "" },
    customName: { type: String, trim: true, default: "" },
    fileId: { type: mongoose.Schema.Types.ObjectId, ref: "Media", default: null },
    url: { type: String, trim: true, default: "" },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const historyFieldSchema = new mongoose.Schema(
  {
    value: { type: String, default: "" },
    isVerified: { type: Boolean, default: false },
    verifiedBy: { type: String, default: null },
    verifiedAt: { type: Date, default: null },
  },
  { _id: false },
);

const managedSectionDataSchema = new mongoose.Schema(
  {
    files: { type: [bookingFileSchema], default: [] },
    comment: { type: historyFieldSchema, default: () => ({}) },
  },
  { _id: false },
);

const patientManagedSectionSchema = new mongoose.Schema(
  {
    patientId: { type: String, required: true, unique: true, index: true },
    morphologicalResearch: { type: managedSectionDataSchema, default: () => ({}) },
    proceduresAndManipulations: { type: managedSectionDataSchema, default: () => ({}) },
  },
  { timestamps: true },
);

module.exports = mongoose.model("PatientManagedSection", patientManagedSectionSchema);
