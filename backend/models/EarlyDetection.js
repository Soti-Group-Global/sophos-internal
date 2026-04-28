const mongoose = require("mongoose");

// Comment Schema
const commentSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    email: { type: String, required: true },
    role: { type: String, required: true, enum: ["doctor", "manager"] },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

// Payment Schema
const paymentSchema = new mongoose.Schema(
  {
    id: { type: String },
    invoiceNumber: { type: String },
    status: {
      type: String,
      enum: ["new", "invoice-sent", "paid", "cancelled", "free", "pending"],
      required: true,
    },
    paymentLink: { type: String },
    invoiceFileId: { type: String },
  },
  { _id: false }
);

// Document Schema
const documentSchema = new mongoose.Schema(
  {
    filename: { type: String },
    fileId: { type: mongoose.Schema.Types.ObjectId, ref: "Media" },
    url: { type: String },
    createdAt: { type: Date, default: Date.now },
    verificationStatus: { type: String },
  },
  { _id: false }
);

// Service Order Schema
const serviceOrderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    serviceName: { type: String, required: true, trim: true },
    entranceDiagnosis: { type: String, required: true, trim: true },
    briefHistory: { type: String, required: true, trim: true },
    promoCode: { type: String, trim: true },
    expertReviewService: {
      type: String,
      enum: [
        "Expert review of CT",
        "Expert review of MRI",
        "Expert review of PET-CT",
        "Expert review of CT+MRI",
      ],
      default: null,
    },
    pathologicaService: {
      type: String,
      enum: [
        "Cytological examination",
        "Histological examination",
        "Comprehensive Study (cytological + histological)",
        "Pathologist Consultation",
      ],
      default: null,
    },
  },
  { _id: true }
);

// Appointment Entry Schema
const appointmentEntrySchema = new mongoose.Schema(
  {
    doctorEmail: { type: String, required: true },
    specialty: {
      type: String,
      required: function () {
        return this.serviceType === "In-face and remote consultations";
      },
    },
    appointmentMode: {
      type: String,
      enum: ["Online", "Offline"],
      required: function () {
        return this.serviceType === "In-face and remote consultations";
      },
    },
    appointmentStatus: {
      type: String,
      required: true,
      enum: [
        "New",
        "Paid",
        "Cancelled",
        "Unconfirmed",
        "Confirmed",
        "Pending payment",
        "Completed",
      ],
    },
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    meetingLink: { type: String },
    prescription: {
      type: {
        text: { type: String, default: "" },
        verificationStatus: {
          type: String,
          enum: ["Verified", "Under Review", "Disapproved"],
          default: "Under Review",
        },
      },
      default: () => ({ text: "", verificationStatus: "Under Review" }),
    },
    conclusion: {
      type: {
        text: { type: String, default: "" },
        verificationStatus: {
          type: String,
          enum: ["Verified", "Under Review", "Disapproved"],
          default: "Under Review",
        },
      },
      default: () => ({ text: "", verificationStatus: "Under Review" }),
    },
  },
  { _id: true, timestamps: true }
);

// Main EarlyDetection Schema
const earlyDetectionSchema = new mongoose.Schema(
  {
    applicationId: { type: String, required: true },
    patientEmail: { type: String, required: true },
    appointments: [appointmentEntrySchema],
    documents: [documentSchema],
    comments: [commentSchema],
    payments: [paymentSchema],
    serviceOrders: [serviceOrderSchema],
    serviceType: {
      type: String,
      required: true,
      enum: [
        "In-face and remote consultations",
        "Individual early diagnosis of diseases",
        "Consultation",
      ],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("EarlyDetection", earlyDetectionSchema);
