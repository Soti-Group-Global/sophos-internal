const mongoose = require("mongoose");

const labCardStatusSchema = new mongoose.Schema({
  blood:   { type: String, enum: ["normal", "attention", "urgent", ""], default: "" },
  glands:  { type: String, enum: ["normal", "attention", "urgent", ""], default: "" },
  heart:   { type: String, enum: ["normal", "attention", "urgent", ""], default: "" },
  eyes:    { type: String, enum: ["normal", "attention", "urgent", ""], default: "" },
  stomach: { type: String, enum: ["normal", "attention", "urgent", ""], default: "" },
  kidney:  { type: String, enum: ["normal", "attention", "urgent", ""], default: "" },
  bones:   { type: String, enum: ["normal", "attention", "urgent", ""], default: "" },
  ent:     { type: String, enum: ["normal", "attention", "urgent", ""], default: "" },
  skin:    { type: String, enum: ["normal", "attention", "urgent", ""], default: "" },
}, { _id: false });

const vitalsSchema = new mongoose.Schema({
  age:    { type: String, default: "" },
  gender: { type: String, default: "" },
  height: { type: String, default: "" },
  weight: { type: String, default: "" },
}, { _id: false });

const coverFieldsSchema = new mongoose.Schema({
  fullName:    { type: String, default: "" },
  dob:         { type: String, default: "" },
  gender:      { type: String, default: "" },
  phone:        { type: String, default: "" },
  email:        { type: String, default: "" },
  patientId:   { type: String, default: "" },
  programName: { type: String, default: "" },
  examDate:    { type: String, default: "" },
}, { _id: false });

const page4EntrySchema = new mongoose.Schema({
  id:       { type: String, required: true },
  testId:   { type: String, default: "" },
  testName: { type: String, default: "" },
  type:     { type: String, enum: ["lab", "instrumental"], default: "lab" },
  text:     { type: String, default: "" },
}, { _id: false });

const earlyDetectionReportSchema = new mongoose.Schema({
  // Reference to the booking
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "EarlyDetectionBooking",
    required: true,
    unique: true,
  },

  // Reference to the patient
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true,
  },

  // Page 1 — cover fields (editable)
  coverFields: { type: coverFieldsSchema, default: () => ({}) },

  // Page 2 — intro rich text
  introText: { type: String, default: "" },

  // Page 3 — vitals
  vitals: { type: vitalsSchema, default: () => ({}) },

  // Page 3 — lab card statuses
  labCardStatus: { type: labCardStatusSchema, default: () => ({}) },

  // Page 4 — entries (lab + instrumental)
  page4Entries: { type: [page4EntrySchema], default: [] },

  // Page 4+ — conclusion sections
  diagnosisText:       { type: String, default: "" },
  followUpText:        { type: String, default: "" },
  recommendationsText: { type: String, default: "" },

}, { timestamps: true });

earlyDetectionReportSchema.index({ booking: 1 });
earlyDetectionReportSchema.index({ patient: 1 });

module.exports = mongoose.model("EarlyDetectionReport", earlyDetectionReportSchema);
