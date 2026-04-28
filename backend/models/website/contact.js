const mongoose = require("mongoose");

const contactUsSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: false, default: "" },
    lastName: { type: String, required: false, default: "" },
    middleName: { type: String, default: "" },
    whatsapp: { type: Boolean, default: false },
    telegram: { type: Boolean, default: false },
    max: { type: Boolean, default: false },
    phoneNumber: { type: String, required: true },
    city: { type: String, required: true },
    message: { type: String, default: "" },
    email: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("ContactUs", contactUsSchema);
