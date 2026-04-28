const mongoose = require("mongoose");

const localizedNameSchema = new mongoose.Schema(
  {
    en: { type: String, required: true, trim: true },
    ru: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const earlyDetectionProcedureManipulationSchema = new mongoose.Schema(
  {
    name: {
      type: localizedNameSchema,
      required: true,
      default: () => ({ en: "", ru: "" }),
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model(
  "EarlyDetectionProcedureManipulation",
  earlyDetectionProcedureManipulationSchema,
);
