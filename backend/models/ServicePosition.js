const mongoose = require("mongoose");

const RelatedServiceSchema = new mongoose.Schema(
  {
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServicePosition",
      required: true,
    },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false }
);

const ServicePositionSchema = new mongoose.Schema(
  {
    // File-system location
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceCategory",
      default: null,
    },

    // Identity
    serviceCode: {
      type: String,
      trim: true,
      default: "",
    },
    pmuCode: {
      type: String,
      trim: true,
      default: "",
    },
    serialNumber: {
      type: Number,
      default: 0,
    },
    type: {
      type: String,
      enum: ["service", "good", "complex"],
      default: "service",
    },

    // Names
    name: {
      type: String,
      required: true,
      trim: true,
    },
    shortName: {
      type: String,
      trim: true,
      default: "",
    },

    // Content
    description: {
      type: String,
      default: "",
    },
    specification: {
      type: String,
      default: "",
    },

    // Pricing
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    costPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    costType: {
      type: String,
      enum: ["simple", "complex"],
      default: "simple",
    },

    // Tax / fiscal
    sno: {
      type: String,
      default: "default",
    },
    vat: {
      type: String,
      default: "default",
    },
    cashRegister: {
      type: String,
      default: "",
    },

    // Appearance
    backgroundColor: {
      type: String,
      default: "",
    },
    textColor: {
      type: String,
      default: "",
    },
    tag: {
      type: String,
      default: "",
    },

    // Duration in minutes
    duration: {
      type: Number,
      default: null,
    },

    // Branch availability
    branch: {
      type: String,
      default: "all",
    },

    // Linked document / executor / supplier
    documentFormTemplate: {
      type: String,
      default: "",
    },
    executor: {
      type: String,
      default: "",
    },
    supplier: {
      type: String,
      default: "",
    },

    // Flags
    isActive: {
      type: Boolean,
      default: true,
    },
    excludeFromTaxDeduction: {
      type: Boolean,
      default: false,
    },
    isConsultation: {
      type: Boolean,
      default: false,
    },
    consultationDoctor: {
      type: String,
      default: "",
    },
    consultationDoctors: [
      {
        doctor: { type: String, default: "" },
        price: { type: Number, default: 0 },
        _id: false,
      },
    ],

    // Related services (possible add-ons)
    relatedServices: [RelatedServiceSchema],

    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

ServicePositionSchema.index({ category: 1 });
ServicePositionSchema.index({ branch: 1 });
ServicePositionSchema.index({ isActive: 1 });
ServicePositionSchema.index({ name: 1 });
ServicePositionSchema.index({ serviceCode: 1 });
ServicePositionSchema.index({ price: 1 });
ServicePositionSchema.index({ createdAt: -1 });

module.exports = mongoose.model("ServicePosition", ServicePositionSchema);
