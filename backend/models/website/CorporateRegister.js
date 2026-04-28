const mongoose = require("mongoose");

const corporateRegisterSchema = new mongoose.Schema(
  {
    link: { type: String, required: true, trim: true, unique: true }, // English only, used in URL: form.sophos.med.ru/${link}
    corporateName: { type: String, required: true, trim: true },
    hr: {
      firstName: { type: String, required: true, trim: true },
      lastName: { type: String, required: true, trim: true },
      middleName: { type: String, trim: true },
    },
    email: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    discountPercentage: { type: Number, min: 0, max: 100 },
    password: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("CorporateRegister", corporateRegisterSchema);
