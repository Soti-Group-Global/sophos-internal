const mongoose = require("mongoose");

const localizedNameSchema = new mongoose.Schema(
  {
    en: { type: String, required: true, trim: true },
    ru: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const applicationInstrumentalAnalysisSchema = new mongoose.Schema(
  {
    name: {
      type: localizedNameSchema,
      required: true,
      default: () => ({ en: "", ru: "" }),
    },
    note: {
      type: String,
      default: "",
    },
    notes: {
      type: [
        new mongoose.Schema(
          {
            _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
            content: { type: String, default: "" },
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    fileName: {
      type: String,
      default: "",
    },
    fileMimeType: {
      type: String,
      default: "",
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    files: {
      type: [
        new mongoose.Schema(
          {
            fileId: { type: mongoose.Schema.Types.ObjectId, required: true },
            fileName: { type: String, required: true },
            fileMimeType: { type: String, default: "" },
            fileSize: { type: Number, default: 0 },
            uploadedAt: { type: Date, default: Date.now },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model(
  "ApplicationInstrumentalAnalysis",
  applicationInstrumentalAnalysisSchema,
);
