const mongoose = require("mongoose");

const complicatedCasesFormSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    middleName: { type: String, default: "" },
    lastName: { type: String, required: true },
    phone: { type: String, required: true },
    whatsapp: { type: Boolean, default: false },
    telegram: { type: Boolean, default: false },
    max: { type: Boolean, default: false },
    email: { type: String, required: true },
    city: { type: String, required: true },
    message: { type: String, default: "" },
    agree1: { type: Boolean, required: true, default: false },
    agree2: { type: Boolean, required: true, default: false },
    files: [{ type: mongoose.Schema.Types.ObjectId }], // Array of GridFS file IDs
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "ComplicatedCasesForm",
  complicatedCasesFormSchema
);
