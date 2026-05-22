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

const testEntryNoteSchema = new mongoose.Schema(
  {
    content: { type: String, trim: true, default: "" },
  },
  { _id: true, timestamps: true },
);

const laboratoryTestEntrySchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "PatientLaboratoryTest",
    },
    files: { type: [bookingFileSchema], default: [] },
    notes: { type: [testEntryNoteSchema], default: [] },
  },
  { _id: true },
);

const instrumentalAnalysisEntrySchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "PatientInstrumentalAnalysis",
    },
    files: { type: [bookingFileSchema], default: [] },
    notes: { type: [testEntryNoteSchema], default: [] },
  },
  { _id: true },
);

const patientLabSectionSchema = new mongoose.Schema(
  {
    patientId: { type: String, required: true, unique: true, index: true },
    laboratoryTests: { type: [laboratoryTestEntrySchema], default: [] },
    instrumentalAnalysis: { type: [instrumentalAnalysisEntrySchema], default: [] },
  },
  { timestamps: true },
);

module.exports = mongoose.model("PatientLabSection", patientLabSectionSchema);
