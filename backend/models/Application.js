const mongoose = require("mongoose");
const Counter = require("./Counter");

// Comment Schema
const commentSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    email: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: ["doctor", "manager"],
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

// Payment Schema
const paymentSchema = new mongoose.Schema(
  {
    id: { type: String },
    invoiceNumber: { type: String }, // Will be in format: INV-MM/YYYY-000X
    status: {
      type: String,
      enum: ["new", "invoice-sent", "paid", "cancelled", "free", "pending"],
      required: true,
    },
    paymentLink: { type: String },
    invoiceFileId: { type: String },

    // Items (works for both consultation and tests)
    items: [
      {
        name: { type: String, required: true }, // service/test name
        amount: { type: Number, required: true }, // price for that item
      },
    ],

    // Payment totals
    amount: { type: Number, required: true }, // total before discount
    discount: { type: Number, default: 0 }, // discount applied
    finalAmount: { type: Number, required: true }, // total after discount
    currency: { type: String, default: "RUB" }, // ISO currency code

    // Payment type
    type: {
      type: String,
      enum: ["consultation", "test"],
      required: true,
    },
    // Timestamps
    createdAt: { type: Date, default: Date.now },
    paidAt: { type: Date },
  },
  { _id: false },
);

// Document Schema
const documentSchema = new mongoose.Schema(
  {
    filename: { type: String },
    fileId: { type: mongoose.Schema.Types.ObjectId, ref: "Media" },
    url: { type: String },
    uploadedAt: { type: Date, default: Date.now },
    verificationStatus: { type: String },
  },
  { _id: false },
);

// Lab / Study entry (file or text)
const labEntrySchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["file", "text"], required: true },
    text: { type: String, default: "" },
    label: { type: String, default: "" },
    filename: { type: String },
    fileId: { type: mongoose.Schema.Types.ObjectId },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

// Service Order Schema (embedded)
const serviceOrderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    serviceName: {
      type: String,
      required: false,
      trim: true,
    },
    entranceDiagnosis: {
      type: String,
      trim: true,
    },
    briefHistory: {
      type: String,
      trim: true,
    },
    promoCode: {
      type: String,
      trim: true,
    },
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
  { _id: true },
);

// Prescription and Conclusion Schema
const textFieldSchema = new mongoose.Schema(
  {
    text: { type: String, default: "" },
    verificationStatus: {
      type: String,
      enum: ["Verified", "Pending", "Unverified"],
      default: "Unverified",
    },
  },
  { _id: true },
);

// Meeting Schema
const meetingInfoSchema = new mongoose.Schema(
  {
    roomId: { type: String, default: null },
    status: {
      type: String,
      enum: ["scheduled", "active", "ended", "cancelled"],
      default: "scheduled",
    },
    startedAt: { type: Date },
    endedAt: { type: Date },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    notes: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

// History field sub-document — wraps content with a verification flag
const historyFieldSchema = new mongoose.Schema(
  {
    value: { type: String, default: "" }, // HTML content (rich text)
    isVerified: { type: Boolean, default: false }, // true = doctor approved, visible to patient
    verifiedBy: { type: String, default: null }, // doctor email who verified
    verifiedAt: { type: Date, default: null }, // timestamp of verification
  },
  { _id: false },
);

const bookingFileSchema = new mongoose.Schema(
  {
    filename: { type: String, trim: true, default: "" },
    customName: { type: String, trim: true, default: "" },
    fileId: { type: mongoose.Schema.Types.ObjectId, ref: "Media", default: null },
    url: { type: String, trim: true, default: "" },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

// History Form Schema (medical history for this appointment)
const historyFormSchema = new mongoose.Schema(
  {
    // Section 1 — Complaints
    complaints: { type: historyFieldSchema, default: () => ({}) },
    // Section 2 — Anamnesis Morbi
    anamnesisMorbi: { type: historyFieldSchema, default: () => ({}) },
    // Section 3 — Anamnesis Vitae
    anamnesisVitae: { type: historyFieldSchema, default: () => ({}) },
    // Section 4 — Physical Exam (top-level + subsections)
    physicalExam: { type: historyFieldSchema, default: () => ({}) },
    respiratory: { type: historyFieldSchema, default: () => ({}) },
    circulatory: { type: historyFieldSchema, default: () => ({}) },
    digestive: { type: historyFieldSchema, default: () => ({}) },
    urinary: { type: historyFieldSchema, default: () => ({}) },
    endocrine: { type: historyFieldSchema, default: () => ({}) },
    // Section 5 — Preliminary Diagnosis
    preliminaryDiagnosis: { type: historyFieldSchema, default: () => ({}) },
    // Section 6 — Examination Plan
    examinationPlan: { type: historyFieldSchema, default: () => ({}) },
    // Section 7 — Examination Results
    examinationResults: { type: historyFieldSchema, default: () => ({}) },
    // Section 8 — Clinical Diagnosis
    clinicalDiagnosis: { type: historyFieldSchema, default: () => ({}) },
    // Section 9 — Treatment Plan
    treatmentPlan: { type: historyFieldSchema, default: () => ({}) },
  },
  { _id: false },
);

// Doctor Service Assignment Schema
const doctorServiceSchema = new mongoose.Schema(
  {
    doctorEmail: { type: String, required: true },
    doctorName: { type: String },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Service" },
    serviceName: { type: String },
  },
  { _id: false },
);


const managedUploadSectionSchema = new mongoose.Schema(
  {
    files: { type: [bookingFileSchema], default: [] },
    comment: { type: historyFieldSchema, default: () => ({}) },
  },
  { _id: false },
);

// Application Schema
const applicationSchema = new mongoose.Schema(
  {
    applicationId: { type: String, required: true, unique: true },
    patientId: { type: String, index: true },       // СОФ/Мос/Пац-001 — primary reference
    patientEmail: { type: String },                  // legacy, kept for backward compat
    doctors: { type: [doctorServiceSchema], default: [] }, // Array of doctors with their assigned services
    serviceType: {
      type: String,
      required: true,
    },
    branch: {
      type: String,
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
        "Awaiting for Payment",
      ],
    },
    date: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    payments: { type: [paymentSchema], default: [] },
    comments: { type: [commentSchema], default: [] },
    documents: { type: [documentSchema], default: [] },
    serviceOrders: { type: [serviceOrderSchema], default: [] },
    services: [{ type: mongoose.Schema.Types.ObjectId, ref: "ServicePosition" }],
    followUp: {
      needed: { type: Boolean, default: false },
      comment: { type: String, default: "" },
      applicationId: { type: String, default: null }, // link to new appointment if booked
      booked: { type: Boolean, default: false },
    },
    meeting: {
      type: meetingInfoSchema,
      default: () => ({ status: "scheduled" }),
    },
    isFirstAppointment: { type: Boolean, default: false },
    isRepetitiveAppointment: { type: Boolean, default: false },
    historyForm: { type: historyFormSchema, default: () => ({}) },
       morphologicalResearch: {
      type: managedUploadSectionSchema,
      default: () => ({}),
    },
    proceduresAndManipulations: {
      type: managedUploadSectionSchema,
      default: () => ({}),
    },
    laboratoryAnalysis: { type: [labEntrySchema], default: [] },
    studiesManipulations: { type: [labEntrySchema], default: [] },
  },
  { timestamps: true, strict: true },
);

// Middleware to generate invoice number before saving payment
applicationSchema.pre("save", async function (next) {
  try {
    // Only generate invoice numbers for new payments
    if (this.payments && this.payments.length > 0) {
      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const year = now.getFullYear();
      const counterName = `invoiceId-${month}/${year}`;
      const monthYear = `${month}/${year}`;

      // Process each payment without invoice number
      for (const payment of this.payments) {
        if (!payment.invoiceNumber && payment.status !== "free") {
          // First, ensure counter document exists
          await Counter.updateOne(
            { name: counterName },
            {
              $setOnInsert: {
                name: counterName,
                monthYear: monthYear,
                monthlyCount: 0,
                overallCount: 0,
              },
            },
            { upsert: true },
          );

          // Now increment and get the new value
          const updatedCounter = await Counter.findOneAndUpdate(
            { name: counterName },
            { $inc: { monthlyCount: 1 } },
            { new: true },
          );

          // Assign the invoice number with the updated counter value
          payment.invoiceNumber = `INV-${monthYear}-${String(
            updatedCounter.monthlyCount,
          ).padStart(4, "0")}`;
        }
      }
    }
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model("Application", applicationSchema);