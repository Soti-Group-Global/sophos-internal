const mongoose = require("mongoose");

const labEntrySchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["file", "text"], required: true },
    label: { type: String, trim: true, default: "" },
    text: { type: String, trim: true, default: "" },
    filename: { type: String, trim: true, default: "" },
    fileId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { _id: true, timestamps: { createdAt: true, updatedAt: false } },
);

const patientAnalysisSectionSchema = new mongoose.Schema(
  {
    patientId: { type: String, required: true, unique: true, index: true },
    laboratoryAnalysis: { type: [labEntrySchema], default: [] },
    studiesManipulations: { type: [labEntrySchema], default: [] },
  },
  { timestamps: true },
);

module.exports = mongoose.model("PatientFlatSection", patientAnalysisSectionSchema);
