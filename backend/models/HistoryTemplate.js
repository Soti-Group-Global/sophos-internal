const mongoose = require("mongoose");

/**
 * HistoryTemplate — per-doctor reusable text templates for each historyForm field.
 *
 * Each doctor owns their templates; access is always filtered by doctorEmail.
 * fieldKey matches the keys used in Application.historyForm
 * (e.g. "complaints", "anamnesisVitae", "preliminaryDiagnosis", …).
 *
 * content is stored as HTML (same format as the Tiptap editor output).
 */
const historyTemplateSchema = new mongoose.Schema(
  {
    doctorEmail: {
      type: String,
      required: false,
      default: null,
      lowercase: true,
      trim: true,
      index: true,
    },
    fieldKey: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    content: {
      type: String,
      default: "",
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

/* Compound index for fast per-doctor, per-field lookups */
historyTemplateSchema.index({ doctorEmail: 1, fieldKey: 1 });

module.exports = mongoose.model("HistoryTemplate", historyTemplateSchema);
