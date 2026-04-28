const mongoose = require("mongoose");

const corporateFormRegistrationSchema = new mongoose.Schema(
  {
    // Which corporate form this submission belongs to (referenced by link slug)
    formLink: { type: String, required: true, trim: true },

    // Employee details
    lastName: { type: String, required: true, trim: true },
    firstName: { type: String, required: true, trim: true },
    middleName: { type: String, trim: true },
    email: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },

    // Auto-generated coupon: SPH-<COMPANY_SHORT>-<NUMBERS>
    couponCode: { type: String, unique: true, trim: true },
  },
  {
    timestamps: true,
  }
);

// Generate coupon before saving
corporateFormRegistrationSchema.pre("save", async function (next) {
  if (!this.couponCode) {
    // Will be set by controller with company name context
  }
  next();
});

module.exports = mongoose.model(
  "CorporateFormRegistration",
  corporateFormRegistrationSchema
);
