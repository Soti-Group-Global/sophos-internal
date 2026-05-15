const mongoose = require("mongoose");

const ServiceCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    identifier: {
      type: String,
      trim: true,
      default: "",
    },
    comment: {
      type: String,
      default: "",
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceCategory",
      default: null,
    },
    branch: {
      type: String,
      default: "all",
    },
    departments: [{ type: String }],
    specializations: [{ type: String }],
    availableInBranches: [{ type: String }],
    isActive: {
      type: Boolean,
      default: true,
    },
    isLinkedWithSpeciality: {
      type: Boolean,
      default: false,
    },
    specialities: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SpecialtyMaster",
      },
    ],
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

ServiceCategorySchema.index({ parent: 1 });
ServiceCategorySchema.index({ branch: 1 });
ServiceCategorySchema.index({ isActive: 1 });
ServiceCategorySchema.index({ name: 1 });

module.exports = mongoose.model("ServiceCategory", ServiceCategorySchema);
