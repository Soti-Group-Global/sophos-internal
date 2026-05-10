const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// SUB-SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

// Disease record (dispensary observation)
const diseaseSchema = new mongoose.Schema({
  startDate: { type: Date },
  endDate: { type: Date },
  diagnosis: { type: String, trim: true },
  icdCode: { type: String, trim: true },
  doctor: { type: String, trim: true },
}, { _id: true });

// Final (refined) diagnosis record
const finalDiagnosisSchema = new mongoose.Schema({
  date: { type: Date },
  diagnosis: { type: String, trim: true },
  icdCode: { type: String, trim: true },
  primary: { type: String, enum: ['1', '2'], default: '1' }, // 1 = primary, 2 = secondary
  doctorName: { type: String, trim: true },
  jobTitle: { type: String, trim: true },
  speciality: { type: String, trim: true },
}, { _id: true });

// Radiation dose record
const radiationDoseSchema = new mongoose.Schema({
  date: { type: Date },
  researchType: { type: String, trim: true },
  effectiveDose: { type: String, trim: true },
  note: { type: String, trim: true },
}, { _id: true });

// Legal representative (full nested object)
const legalRepresentativeSchema = new mongoose.Schema({
  // Personal info
  lastName: { type: String, trim: true },
  firstName: { type: String, trim: true },
  middleName: { type: String, trim: true },
  isCurrent: { type: Boolean, default: false },
  birthday: { type: Date },
  gender: { type: String, enum: ['Male', 'Female', 'Other', ''] },
  relationship: { type: String, trim: true },
  attitudeToPatient: { type: String, trim: true },
  documentOfAuthority: { type: String, trim: true },
  // Document info
  documentType: { type: String, trim: true },
  series: { type: String, trim: true },
  number: { type: String, trim: true },
  whenIssued: { type: Date },
  issuedBy: { type: String, trim: true },
  snils: { type: String, trim: true },
  // Address info
  address: { type: String, trim: true },
  addressType: { type: String, trim: true },
  tenant: { type: String, trim: true },
  subjectOfRussia: { type: String, trim: true },
  district: { type: String, trim: true },
  city: { type: String, trim: true },
  settlement: { type: String, trim: true },
  street: { type: String, trim: true },
  house: { type: String, trim: true },
  apartment: { type: String, trim: true },
  state: { type: String, trim: true },
}, { _id: true });

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PATIENT SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const patientSchema = new mongoose.Schema({
  // ─── BASIC DATA ────────────────────────────────────────────────────────────
  email: {
    type: String,
    required: false,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      message: "Invalid email format.",
    },
  },
  firstName: { type: String, required: true, trim: true },
  middleName: { type: String, trim: true },
  lastName: { type: String, required: true, trim: true },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
  dateOfBirth: { type: Date, required: true },
  notes: { type: String, trim: true, default: '' },

  // ─── CONTACTS ──────────────────────────────────────────────────────────────
  phoneNumber: { type: String, required: true, trim: true },
  additionalPhone: { type: String, trim: true },
  maxId: { type: String, trim: true }, // External MAX ID
  telegramNickname: { type: String, trim: true },
  telegramId: { type: String, trim: true },
  newsletter: { type: Boolean, default: false },
  egisz: { type: Boolean, default: false }, // ЕГИСЗ integration
  // Social media
  instagram: { type: String, trim: true },
  vk: { type: String, trim: true },
  facebook: { type: String, trim: true },
  ok: { type: String, trim: true }, // Odnoklassniki
  // Emergency contact
  contactPerson: { type: String, trim: true },
  contactPersonPhone: { type: String, trim: true },

  // ─── DOCUMENTS ─────────────────────────────────────────────────────────────
  cmip: { type: String, trim: true }, // СНИЛС/CMIP number
  cmipDate: { type: Date },
  cmipOrgCode: { type: String, trim: true },
  snils: { type: String, trim: true },
  medInsuranceOrg: { type: String, trim: true },
  socialSupportCode: { type: String, trim: true },
  citizenship: { type: String, trim: true },
  documentType: { type: String, trim: true },
  documentSeries: { type: String, trim: true },
  documentNumber: { type: String, trim: true },
  documentIssuedDate: { type: Date },
  departmentCode: { type: String, trim: true },
  documentIssuedBy: { type: String, trim: true },
  inn: { type: String, trim: true },

  // ─── ADDRESS ───────────────────────────────────────────────────────────────
  addressType: { type: String, trim: true },
  region: { type: String, trim: true },
  district: { type: String, trim: true },
  city: { type: String, trim: true },
  settlement: { type: String, trim: true },
  street: { type: String, trim: true },
  house: { type: String, trim: true },
  terrain: { type: String, trim: true },
  apartment: { type: String, trim: true },
  postcode: { type: String, trim: true },
  geocoordinates: { type: String, trim: true },
  registrationChange: { type: String, trim: true },

  // ─── PERSONAL DATA ─────────────────────────────────────────────────────────
  maritalStatus: { type: String, trim: true },
  education: { type: String, trim: true },
  employment: { type: String, trim: true },
  placeOfWork: { type: String, trim: true },
  workSpecialty: { type: String, trim: true }, // Job title / position
  changePlaceOfWork: { type: String, trim: true },
  changeOfPosition: { type: String, trim: true },

  // ─── DISABILITY ────────────────────────────────────────────────────────────
  disability: { type: String, enum: ['Yes', 'No', ''], default: '' },
  disabilityFrom: { type: Date },
  disabilityTo: { type: Date },
  disabilityIndefinitely: { type: Boolean, default: false },
  invalidGroup: { type: String, trim: true },
  disabilityType: { type: String, trim: true },
  disabilityPrimaryRepeated: { type: String, trim: true },

  // ─── ANAMNESIS ─────────────────────────────────────────────────────────────
  anamnesisDisability: { type: String, trim: true },
  bloodGroup: { type: String, trim: true },
  rhFactor: { type: String, trim: true },
  kellAntigen: { type: String, trim: true },
  otherBloodInfo: { type: String, trim: true },
  allergies: { type: String, trim: true },

  // ─── ARRAYS ────────────────────────────────────────────────────────────────
  diseases: [diseaseSchema],
  finalDiagnoses: [finalDiagnosisSchema],
  radiationDoses: [radiationDoseSchema],
  legalRepresentatives: [legalRepresentativeSchema],

  // ─── PATIENT ID ────────────────────────────────────────────────────────────
  patientId: { type: String, unique: true, sparse: true, trim: true },

  // ─── PROFILE & SYSTEM ──────────────────────────────────────────────────────
  profileFileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'profileImages',
  },
  notificationLanguage: { type: String, enum: ['en', 'ru'], default: 'en' },
  profileCompleted: { type: Boolean, default: true },
  comments: { type: String, default: '', trim: true },
  createdAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

// ─────────────────────────────────────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────────────────────────────────────
patientSchema.index({ lastName: 1, firstName: 1 });
patientSchema.index({ phoneNumber: 1 });
patientSchema.index({ snils: 1 });
patientSchema.index({ documentNumber: 1 });
patientSchema.index({ patientId: 1 });

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-GENERATE patientId BEFORE SAVE
// Format: СОФ/Мос/Пац-XXXXXX (6 digits, zero-padded, e.g. 001, 001000)
// ─────────────────────────────────────────────────────────────────────────────
patientSchema.pre('save', async function (next) {
  if (this.patientId) return next(); // already set

  try {
    const PREFIX = 'СОФ/Мос/Пац-';
    // Find the highest existing numeric suffix
    const last = await mongoose.model('Patient')
      .findOne({ patientId: { $regex: `^${PREFIX}\\d+$` } })
      .sort({ patientId: -1 })
      .select('patientId')
      .lean();

    let nextNum = 1;
    if (last?.patientId) {
      const num = parseInt(last.patientId.replace(PREFIX, ''), 10);
      if (!isNaN(num)) nextNum = num + 1;
    }

    // Zero-pad to minimum 3 digits, expanding as needed (001, 999, 1000, 001000)
    const padded = String(nextNum).padStart(3, '0');
    this.patientId = `${PREFIX}${padded}`;
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('Patient', patientSchema);