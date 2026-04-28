const mongoose = require("mongoose");

const earlyDetectionTemplateSchema = new mongoose.Schema(
  {
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
  },
  { timestamps: true }
);

earlyDetectionTemplateSchema.index({ fieldKey: 1 });

module.exports = mongoose.model("EarlyDetectionTemplate", earlyDetectionTemplateSchema);
