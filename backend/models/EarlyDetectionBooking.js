const mongoose = require("mongoose");
const validator = require("validator");

const PAYMENT_METHOD_ENUM = [
  "tbank",
  "vtb",
  "yandex",
  "bank_transfer",
  "cash",
  "payment_terminal",
  "create_without_payment",
  "manual_admin",
];

// Static packages array — main base package
const EARLY_DETECTION_PACKAGES = [
  {
    id: "predict",
    name: "«ПРЕДИКТ»",
    price: 99500,
    currency: "RUB"
  },
];

// Add-on options that can be selected alongside the base package
const EARLY_DETECTION_ADDONS = [
  { id: "predict-plus", name: "Апгрейд «ПРЕДИКТ+5»", price: 98000, description: "Расширенная диагностика + онкопоиск" },
  { id: "ct", name: "НДКТ грудной клетки", price: 11700 },
  { id: "mri", name: "МРТ головного мозга", price: 12000 },
  { id: "endoscopy", name: "Гастроскопия + колоноскопия", price: 28500, oldPrice: 58000 },
  { id: "mammography", name: "Маммография с томосинтезом", price: 12000 },
  { id: "oncosearch", name: "Онкопоиск", price: 50000 },
  { id: "insurance", name: "Онкострахование", price: 35000 },
];

// Helper to get package price by id
function getPackagePriceById(id) {
  const pkg = EARLY_DETECTION_PACKAGES.find(p => p.id === id);
  return pkg ? pkg.price : null;
}

// Helper to get add-on by id
function getAddOnById(id) {
  return EARLY_DETECTION_ADDONS.find(a => a.id === id) || null;
}

// Helper to calculate total with add-ons
function calculateTotal(packageId, addOnIds = []) {
  const basePrice = getPackagePriceById(packageId) || 0;
  const addOnsTotal = addOnIds.reduce((sum, id) => {
    const addon = getAddOnById(id);
    return sum + (addon ? addon.price : 0);
  }, 0);
  return basePrice + addOnsTotal;
}

const historyFieldSchema = new mongoose.Schema(
  {
    value: { type: String, default: "" },
    isVerified: { type: Boolean, default: false },
    verifiedBy: { type: String, default: null },
    verifiedAt: { type: Date, default: null },
  },
  { _id: false },
);

const historyFormSchema = new mongoose.Schema(
  {
    isFirstAppointment: { type: Boolean, default: false },
    isRepetitiveAppointment: { type: Boolean, default: false },
    complaints: { type: historyFieldSchema, default: () => ({}) },
    anamnesisMorbi: { type: historyFieldSchema, default: () => ({}) },
    anamnesisVitae: { type: historyFieldSchema, default: () => ({}) },
    physicalExam: { type: historyFieldSchema, default: () => ({}) },
    respiratory: { type: historyFieldSchema, default: () => ({}) },
    circulatory: { type: historyFieldSchema, default: () => ({}) },
    digestive: { type: historyFieldSchema, default: () => ({}) },
    urinary: { type: historyFieldSchema, default: () => ({}) },
    endocrine: { type: historyFieldSchema, default: () => ({}) },
    preliminaryDiagnosis: { type: historyFieldSchema, default: () => ({}) },
    examinationPlan: { type: historyFieldSchema, default: () => ({}) },
    examinationResults: { type: historyFieldSchema, default: () => ({}) },
    clinicalDiagnosis: { type: historyFieldSchema, default: () => ({}) },
    treatmentPlan: { type: historyFieldSchema, default: () => ({}) },
    specialistConsultation: { type: historyFieldSchema, default: () => ({}) },
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

const managedUploadSectionSchema = new mongoose.Schema(
  {
    files: { type: [bookingFileSchema], default: [] },
    comment: { type: historyFieldSchema, default: () => ({}) },
  },
  { _id: false },
);

const testEntryNoteSchema = new mongoose.Schema(
  {
    content: { type: String, trim: true, default: "" },
  },
  { _id: true, timestamps: true },
);

const laboratoryTestEntrySchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "EarlyDetectionLaboratoryTest",
    },
    files: { type: [bookingFileSchema], default: [] },
    notes: { type: [testEntryNoteSchema], default: [] },
  },
  { _id: true },
);

const instrumentalAnalysisEntrySchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "EarlyDetectionInstrumentalAnalysis",
    },
    files: { type: [bookingFileSchema], default: [] },
    notes: { type: [testEntryNoteSchema], default: [] },
  },
  { _id: true },
);

const scheduleItemSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, required: true },
    isCompleted: { type: Boolean, default: false },
    date: { type: Date, default: null },
    startTime: { type: String, trim: true, default: "" },
    endTime: { type: String, trim: true, default: "" },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DoctorsProfile",
      default: null,
    },
    historyForm: {
      type: historyFormSchema,
      default: () => ({}),
    },
  },
  { _id: true },
);

const bookingSchema = new mongoose.Schema({
  // Patient Reference
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: [true, "Patient reference is required"],
  },

  schedule: {
    specialistConsultations: {
      type: [scheduleItemSchema],
      default: () => ([
        { title: "Gynecologist" },
        { title: "Therapist" },
        { title: "Dermatologist" },
        { title: "Ophthalmologist" },
        { title: "Gynecologist" },
        { title: "Surgeon" },
        { title: "ENT" },
        { title: "Ultrasound" },
      ]),
    },
    laboratoryTests: {
      type: [laboratoryTestEntrySchema],
      default: [],
    },
    instrumentalAnalysis: {
      type: [instrumentalAnalysisEntrySchema],
      default: [],
    },
    morphologicalResearch: {
      type: managedUploadSectionSchema,
      default: () => ({}),
    },
    proceduresAndManipulations: {
      type: managedUploadSectionSchema,
      default: () => ({}),
    },
    surgeries: {
      type: managedUploadSectionSchema,
      default: () => ({}),
    },
  },

  // Consents
  consents: {
    dataProcessing: {
      type: Boolean,
      required: [true, "Data processing consent is required"],
      default: false,
    },
    marketing: {
      type: Boolean,
      default: false,
    },
  },

  // Selected Package (required — main package is always needed)
  package: {
    id: {
      type: String,
      enum: ["test", "predict", "predict-plus"], // keep old values for backward compatibility
      required: [true, "Package ID is required"],
    },
    name: {
      type: String,
      required: [true, "Package name is required"],
    },
    price: {
      type: Number,
      required: [true, "Package price is required"],
    },
    currency: {
      type: String,
      default: "RUB",
    },
  },

  // Selected Add-on Options
  addOns: [{
    id: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
  }],

  // Total amount (base package + add-ons)
  totalAmount: {
    type: Number,
    default: 0,
  },

  // Payment events (single source of truth)
  paymentHistory: [
    {
      status: { type: String },
      paymentId: { type: String, default: null },
      orderId: { type: String, default: null },
      paymentUrl: { type: String, default: null },
      amount: { type: Number, default: null },
      paidAt: { type: Date, default: null },
      transactionId: { type: String, default: null },
      paymentMethod: {
        type: String,
        enum: PAYMENT_METHOD_ENUM,
        default: null,
      },
      tbank: { type: mongoose.Schema.Types.Mixed, default: null },
      installment: { type: mongoose.Schema.Types.Mixed, default: null },
      notes: { type: String, default: null },
      createdBy: { type: String, default: null },
      createdAt: { type: Date, default: null },
      changedBy: { type: String, default: 'system' },
      changedAt: { type: Date, default: Date.now },
    },
  ],

  // Booking Status
  status: {
    type: String,
    enum: ["pending", "confirmed", "completed", "cancelled"],
    default: "pending",
  },

  // Booking Reference
  bookingNumber: {
    type: String,
    unique: true,
  },

  // Invoice number in format ED-MM/YYYY-000
  invoiceNumber: {
    type: String,
    unique: true,
  },

  // Track sequence number for the month
  sequenceNumber: {
    type: Number,
    default: 0,
  },

  // Internal Notes
  internalNotes: [
    {
      note: {
        type: String,
        required: true,
        trim: true,
      },
      addedBy: {
        type: String,
        required: true,
      },
      addedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const derivePaymentState = (history = [], doc) => {
  const last = Array.isArray(history) && history.length > 0 ? history[history.length - 1] : null;
  const amountInKopecks =
    last?.amount ?? (((doc?.totalAmount || doc?.package?.price || 0) * 100) || null);

  return {
    status: last?.status || "pending",
    paymentLink: last?.paymentUrl || null,
    paidAt: last?.paidAt || null,
    transactionId: last?.transactionId || last?.paymentId || null,
    paymentMethod: last?.paymentMethod || null,
    tbank: last?.tbank || null,
    installment: last?.installment || null,
    amount: amountInKopecks,
  };
};

bookingSchema.virtual("payment")
  .get(function () {
    if (!this.$locals) this.$locals = {};
    if (!this.$locals.__paymentState) {
      this.$locals.__paymentState = derivePaymentState(this.paymentHistory, this);
    }
    return this.$locals.__paymentState;
  })
  .set(function (value) {
    if (!this.$locals) this.$locals = {};
    const current = this.$locals.__paymentState || derivePaymentState(this.paymentHistory, this);
    this.$locals.__paymentState = {
      ...current,
      ...(value || {}),
    };
  });

// Generate booking and invoice numbers before saving
bookingSchema.pre("save", async function (next) {
  if (!this.isModified("paymentHistory")) {
    const state = this.$locals?.__paymentState;
    if (state) {
      if (!Array.isArray(this.paymentHistory)) {
        this.paymentHistory = [];
      }

      const amountInKopecks =
        state?.amount ??
        state?.tbank?.amount ??
        state?.installment?.totalAmount ??
        ((this.totalAmount || this.package?.price || 0) * 100);

      const nextEntry = {
        status: state.status || "pending",
        paymentId: state?.tbank?.paymentId || state?.transactionId || null,
        orderId: state?.tbank?.orderId || this.invoiceNumber || null,
        paymentUrl: state.paymentLink || null,
        amount: amountInKopecks,
        paidAt: state.paidAt || null,
        transactionId: state.transactionId || null,
        paymentMethod: state.paymentMethod || null,
        tbank: state.tbank || null,
        installment: state.installment || null,
        notes: state.notes || null,
        createdBy: state.createdBy || null,
        createdAt: state.createdAt || new Date(),
        changedBy: state.changedBy || "system",
        changedAt: new Date(),
      };

      const last = this.paymentHistory.length > 0
        ? this.paymentHistory[this.paymentHistory.length - 1]
        : null;

      const shouldAppend =
        !last ||
        String(last.status || "") !== String(nextEntry.status || "") ||
        String(last.transactionId || "") !== String(nextEntry.transactionId || "") ||
        String(last.paymentUrl || "") !== String(nextEntry.paymentUrl || "") ||
        String(last.paymentMethod || "") !== String(nextEntry.paymentMethod || "") ||
        String(last.paymentId || "") !== String(nextEntry.paymentId || "") ||
        String(last.orderId || "") !== String(nextEntry.orderId || "") ||
        Number(last.amount || 0) !== Number(nextEntry.amount || 0) ||
        String(last.paidAt || "") !== String(nextEntry.paidAt || "");

      if (shouldAppend) {
        this.paymentHistory.push(nextEntry);
      }
    }
  }

  if (this.isNew) {
    const date = new Date();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    
    // Find the last sequence number for this month
    const lastBooking = await this.constructor.findOne({
      createdAt: {
        $gte: new Date(year, date.getMonth(), 1), // Start of month
        $lt: new Date(year, date.getMonth() + 1, 1), // Start of next month
      }
    }).sort({ sequenceNumber: -1 });

    // Calculate next sequence number
    const nextSequence = lastBooking ? lastBooking.sequenceNumber + 1 : 1;
    this.sequenceNumber = nextSequence;

    // Generate invoice number: ED-MM/YYYY-000
    this.invoiceNumber = `ED-${month}/${year}-${nextSequence.toString().padStart(3, "0")}`;
    
    // Also keep the old booking number for reference
    const day = date.getDate().toString().padStart(2, "0");
    this.bookingNumber = `ED${year.toString().slice(-2)}${month}${day}${nextSequence.toString().padStart(3, "0")}`;
  }
  
  this.updatedAt = new Date();
  next();
});

const EarlyDetectionBooking = mongoose.model(
  "EarlyDetectionBooking",
  bookingSchema
);

module.exports = EarlyDetectionBooking;
module.exports.getPackagePriceById = getPackagePriceById;
module.exports.getAddOnById = getAddOnById;
module.exports.calculateTotal = calculateTotal;
module.exports.EARLY_DETECTION_PACKAGES = EARLY_DETECTION_PACKAGES;
module.exports.EARLY_DETECTION_ADDONS = EARLY_DETECTION_ADDONS;
