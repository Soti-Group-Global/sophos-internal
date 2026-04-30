const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const EarlyDetectionBooking = require('../models/EarlyDetectionBooking');
const Patient = require('../models/Patient');
const DoctorsProfile = require('../models/DoctorsProfile');
const EarlyDetectionLaboratoryTest = require('../models/EarlyDetectionLaboratoryTest');
const EarlyDetectionInstrumentalAnalysis = require('../models/EarlyDetectionInstrumentalAnalysis');
const telegramBot = require('../services/telegramBot');
const maxBot = require('../services/maxBot');
const tbankPaymentService = require('../services/tbankPaymentService');

const MANAGED_TEST_MODELS = {
  laboratoryTests: EarlyDetectionLaboratoryTest,
  instrumentalAnalysis: EarlyDetectionInstrumentalAnalysis,
};

// Master price catalogue – must stay in sync with frontend ED_PACKAGES / ED_ADDONS
const ED_PACKAGES_MASTER = [
  { id: 'predict', name: '«ПРЕДИКТ»', price: 99500 },
];
const ED_ADDONS_MASTER = [
  { id: 'predict-plus',  name: 'Апгрейд «ПРЕДИКТ+5»',          price: 98000 },
  { id: 'ct',            name: 'НДКТ грудной клетки',           price: 11700 },
  { id: 'mri',           name: 'МРТ головного мозга',           price: 12000 },
  { id: 'endoscopy',     name: 'Гастроскопия + колоноскопия',   price: 28500 },
  { id: 'mammography',   name: 'Маммография с томосинтезом',    price: 12000 },
  { id: 'oncosearch',    name: 'Онкопоиск',                     price: 50000 },
  { id: 'insurance',     name: 'Онкострахование',               price: 35000 },
];

const resolveManagedTestModel = (section) => MANAGED_TEST_MODELS[String(section || '').trim()];
const TEST_REQUIRED_UPLOAD_SECTIONS = ['laboratoryTests', 'instrumentalAnalysis'];
const SIMPLE_UPLOAD_SECTIONS = ['morphologicalResearch', 'proceduresAndManipulations'];
const requiresTestSelection = (section) => TEST_REQUIRED_UPLOAD_SECTIONS.includes(String(section || '').trim());
const isSimpleUploadSection = (section) => SIMPLE_UPLOAD_SECTIONS.includes(String(section || '').trim());

const DEFAULT_SPECIALIST_CONSULTATIONS = [
  "Gynecologist",
  "Therapist",
  "Dermatologist",
  "Ophthalmologist",
  "Gynecologist",
  "Surgeon",
  "ENT",
  "Ultrasound",
];

const HISTORY_FORM_KEYS = [
  "complaints",
  "anamnesisMorbi",
  "anamnesisVitae",
  "physicalExam",
  "respiratory",
  "circulatory",
  "digestive",
  "urinary",
  "endocrine",
  "preliminaryDiagnosis",
  "examinationPlan",
  "examinationResults",
  "clinicalDiagnosis",
  "treatmentPlan",
  "specialistConsultation",
];

const toDateOnlyString = (value) => {
  if (!value) return null;
  try {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().split("T")[0];
  } catch {
    return null;
  }
};

const toDateValue = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const createLegacyCustomerView = (patientDoc) => {
  const base = patientDoc
    ? {
        _id: patientDoc._id,
        firstName: patientDoc.firstName || "",
        middleName: patientDoc.middleName || "",
        lastName: patientDoc.lastName || "",
        email: patientDoc.email || "",
        phone: patientDoc.phoneNumber || patientDoc.phone || "",
        phoneNumber: patientDoc.phoneNumber || patientDoc.phone || "",
        dateOfBirth: patientDoc.dateOfBirth ? new Date(patientDoc.dateOfBirth) : null,
        gender: patientDoc.gender || "Other",
      }
    : {
        firstName: "",
        middleName: "",
        lastName: "",
        email: "",
        phone: "",
        phoneNumber: "",
        dateOfBirth: null,
        gender: "Other",
      };

  return {
    ...base,
    toObject() {
      return { ...base };
    },
  };
};

const normalizeHistoryField = (field) => {
  if (typeof field === "string") {
    return {
      value: field,
      isVerified: false,
      verifiedBy: null,
      verifiedAt: null,
    };
  }

  return {
    value: field?.value || "",
    isVerified: !!field?.isVerified,
    verifiedBy: field?.verifiedBy || null,
    verifiedAt: toDateValue(field?.verifiedAt),
  };
};

const normalizeHistoryForm = (historyForm = {}) => {
  const normalized = {
    isFirstAppointment: !!historyForm?.isFirstAppointment,
    isRepetitiveAppointment: !!historyForm?.isRepetitiveAppointment,
  };

  HISTORY_FORM_KEYS.forEach((key) => {
    normalized[key] = normalizeHistoryField(historyForm?.[key]);
  });

  return normalized;
};

const normalizeFileEntry = (file = {}) => ({
  filename: file?.filename || "",
  customName: file?.customName || "",
  fileId: file?.fileId || null,
  url: file?.url || "",
  uploadedAt: toDateValue(file?.uploadedAt) || undefined,
});

const normalizeManagedUploadSection = (section = {}) => ({
  files: Array.isArray(section?.files) ? section.files.map(normalizeFileEntry) : [],
  comment: normalizeHistoryField(section?.comment),
});

const normalizeConsultationItem = (item = {}) => ({
  title: item?.title || "",
  isCompleted: !!item?.isCompleted,
  date: toDateValue(item?.date),
  startTime: item?.startTime || "",
  endTime: item?.endTime || "",
  doctor: item?.doctor || item?.doctorId || null,
  historyForm: normalizeHistoryForm(item?.historyForm || {}),
});

const buildSchedule = (scheduleInput = {}, legacyAppointmentDate = null, legacyAppointmentTime = "") => {
  const specialistConsultations = Array.isArray(scheduleInput?.specialistConsultations)
    ? scheduleInput.specialistConsultations
        .map(normalizeConsultationItem)
        .filter((item) => item.title)
    : DEFAULT_SPECIALIST_CONSULTATIONS.map((title, index) => ({
        title,
      isCompleted: false,
        date: index === 0 ? toDateValue(legacyAppointmentDate) : null,
        startTime: index === 0 ? (legacyAppointmentTime || "") : "",
        endTime: "",
        doctor: null,
        historyForm: normalizeHistoryForm({}),
      }));

  const laboratoryTests = Array.isArray(scheduleInput?.laboratoryTests)
    ? scheduleInput.laboratoryTests
        .filter((entry) => entry?.item || entry?.itemId)
        .map((entry) => ({
          item: entry.item || entry.itemId,
          files: Array.isArray(entry?.files) ? entry.files.map(normalizeFileEntry) : [],
        }))
    : [];

  const instrumentalAnalysis = Array.isArray(scheduleInput?.instrumentalAnalysis)
    ? scheduleInput.instrumentalAnalysis
        .filter((entry) => entry?.item || entry?.itemId)
        .map((entry) => ({
          item: entry.item || entry.itemId,
          files: Array.isArray(entry?.files) ? entry.files.map(normalizeFileEntry) : [],
        }))
    : [];

  return {
    specialistConsultations,
    laboratoryTests,
    instrumentalAnalysis,
    morphologicalResearch: normalizeManagedUploadSection(scheduleInput?.morphologicalResearch),
    proceduresAndManipulations: normalizeManagedUploadSection(scheduleInput?.proceduresAndManipulations),
    surgeries: normalizeManagedUploadSection(scheduleInput?.surgeries),
  };
};

const deriveLegacyAppointment = (schedule = {}) => {
  const consultations = Array.isArray(schedule?.specialistConsultations)
    ? schedule.specialistConsultations
    : [];
  const firstWithTiming =
    consultations.find((item) => item?.date || item?.startTime || item?.endTime) ||
    consultations[0] ||
    null;

  return {
    appointmentDate: firstWithTiming?.date ? toDateValue(firstWithTiming.date) : null,
    appointmentTime: firstWithTiming?.startTime || "",
  };
};

const resolvePatientInput = (body = {}) => body.patient || body.customer || null;

const ensurePatientRecord = async (patientInput = {}) => {
  const id = patientInput?._id || patientInput?.id || patientInput?.patientId;
  const email = patientInput?.email?.trim()?.toLowerCase() || "";
  let patient = null;

  if (id) {
    patient = await Patient.findById(id);
  } else if (email) {
    patient = await Patient.findOne({ email });
  }

  if (!patient && !email) {
    throw new Error("Patient email is required");
  }

  if (!patient) {
    if (!patientInput?.firstName || !patientInput?.lastName || !patientInput?.dateOfBirth || !(patientInput?.phone || patientInput?.phoneNumber)) {
      throw new Error("Missing required patient information");
    }

    patient = new Patient({
      email,
      firstName: patientInput.firstName.trim(),
      middleName: patientInput.middleName?.trim() || "",
      lastName: patientInput.lastName.trim(),
      dateOfBirth: new Date(patientInput.dateOfBirth),
      phoneNumber: (patientInput.phone || patientInput.phoneNumber || "").trim(),
      gender: patientInput.gender || "Other",
    });
  } else {
    if (patientInput.firstName) patient.firstName = patientInput.firstName.trim();
    if (patientInput.middleName !== undefined) patient.middleName = patientInput.middleName?.trim() || "";
    if (patientInput.lastName) patient.lastName = patientInput.lastName.trim();
    if (patientInput.dateOfBirth) patient.dateOfBirth = new Date(patientInput.dateOfBirth);
    if (patientInput.phone || patientInput.phoneNumber) {
      patient.phoneNumber = (patientInput.phone || patientInput.phoneNumber || "").trim();
    }
    if (patientInput.gender) patient.gender = patientInput.gender;
    if (email) patient.email = email;
  }

  await patient.save();
  return patient;
};

const attachLegacyBookingFields = async (booking) => {
  if (!booking) return booking;

  let patientDoc = booking.patient;
  if (!patientDoc || typeof patientDoc !== "object" || !patientDoc.email) {
    patientDoc = booking.patient ? await Patient.findById(booking.patient).lean() : null;
  }

  booking.customer = createLegacyCustomerView(patientDoc);
  const legacyAppointment = deriveLegacyAppointment(booking.schedule || {});
  booking.appointmentDate = legacyAppointment.appointmentDate;
  booking.appointmentTime = legacyAppointment.appointmentTime;
  return booking;
};

const populateBookingReferences = async (booking) => {
  if (!booking?.populate) return booking;

  await booking.populate([
    {
      path: "patient",
    },
    {
      path: "schedule.specialistConsultations.doctor",
      select: "firstName middleName lastName email phoneNumber position",
    },
    {
      path: "schedule.laboratoryTests.item",
      select: "name",
    },
    {
      path: "schedule.instrumentalAnalysis.item",
      select: "name",
    },
  ]);

  return booking;
};

const serializeBookingResponse = async (booking) => {
  if (!booking) return null;
  await populateBookingReferences(booking);
  const legacyAppointment = deriveLegacyAppointment(booking.schedule || {});
  const raw = booking.toObject ? booking.toObject() : { ...booking };
  // Use populated patient directly — no customer concept in early detection
  const patient = raw.patient && typeof raw.patient === "object" ? raw.patient : {};

  return {
    ...raw,
    payment: booking.payment || raw.payment || null,
    patient: {
      ...patient,
      dateOfBirth: toDateOnlyString(patient.dateOfBirth),
      email: patient.email || "",
    },
    appointmentDate: toDateOnlyString(legacyAppointment.appointmentDate),
    appointmentTime: legacyAppointment.appointmentTime || "",
  };
};

const serializeBookingListResponse = async (bookings = []) =>
  Promise.all(bookings.map((booking) => serializeBookingResponse(booking)));

// @desc    Get managed tests by section
// @route   GET /api/early-detection/form/bookings/tests/:section
// @access  Private/Admin
exports.getManagedTests = async (req, res) => {
  try {
    const { section } = req.params;
    const Model = resolveManagedTestModel(section);

    if (!Model) {
      return res.status(400).json({ success: false, message: 'Unsupported section' });
    }

    const items = await Model.find().sort({ 'name.en': 1, 'name.ru': 1, createdAt: -1 }).lean();
    return res.status(200).json({ success: true, data: items });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load tests', error: error.message });
  }
};

// @desc    Create managed test
// @route   POST /api/early-detection/form/bookings/tests/:section
// @access  Private/Admin
exports.createManagedTest = async (req, res) => {
  try {
    const { section } = req.params;
    const Model = resolveManagedTestModel(section);

    if (!Model) {
      return res.status(400).json({ success: false, message: 'Unsupported section' });
    }

    const nameEn = String(req.body?.name?.en || '').trim();
    const nameRu = String(req.body?.name?.ru || '').trim();

    if (!nameEn || !nameRu) {
      return res.status(400).json({ success: false, message: 'Both English and Russian names are required' });
    }

    const created = await Model.create({ name: { en: nameEn, ru: nameRu } });
    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to create test', error: error.message });
  }
};

// @desc    Update managed test
// @route   PUT /api/early-detection/form/bookings/tests/:section/:testId
// @access  Private/Admin
exports.updateManagedTest = async (req, res) => {
  try {
    const { section, testId } = req.params;
    const Model = resolveManagedTestModel(section);

    if (!Model) {
      return res.status(400).json({ success: false, message: 'Unsupported section' });
    }

    const nameEn = String(req.body?.name?.en || '').trim();
    const nameRu = String(req.body?.name?.ru || '').trim();

    if (!nameEn || !nameRu) {
      return res.status(400).json({ success: false, message: 'Both English and Russian names are required' });
    }

    const updated = await Model.findByIdAndUpdate(
      testId,
      { $set: { name: { en: nameEn, ru: nameRu } } },
      { new: true },
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Test not found' });
    }

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update test', error: error.message });
  }
};

// @desc    Delete managed test
// @route   DELETE /api/early-detection/form/bookings/tests/:section/:testId
// @access  Private/Admin
exports.deleteManagedTest = async (req, res) => {
  try {
    const { section, testId } = req.params;
    const Model = resolveManagedTestModel(section);

    if (!Model) {
      return res.status(400).json({ success: false, message: 'Unsupported section' });
    }

    const deleted = await Model.findByIdAndDelete(testId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Test not found' });
    }

    await EarlyDetectionBooking.updateMany({}, { $pull: { [`schedule.${section}`]: { item: testId } } });

    return res.status(200).json({ success: true, message: 'Test deleted' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete test', error: error.message });
  }
};

// @desc    Upload file to laboratory/instrumental section item
// @route   POST /api/early-detection/form/bookings/:id/schedule/:section/upload
// @access  Private/Admin
exports.uploadScheduleSectionFile = async (req, res) => {
  try {
    const { id, section } = req.params;
    const { itemId, customName } = req.body || {};
    const file = req.file;
    const normalizedSection = String(section || '').trim();
    const needsTest = requiresTestSelection(normalizedSection);
    const isSimpleSection = isSimpleUploadSection(normalizedSection);

    if (!needsTest && !isSimpleSection) {
      return res.status(400).json({ success: false, message: 'Unsupported section' });
    }

    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    let normalizedItemId = null;
    if (needsTest) {
      const Model = resolveManagedTestModel(normalizedSection);
      if (!Model) {
        return res.status(400).json({ success: false, message: 'Unsupported section' });
      }

      if (!itemId || !mongoose.Types.ObjectId.isValid(String(itemId))) {
        return res.status(400).json({ success: false, message: 'Valid itemId is required' });
      }

      const testExists = await Model.findById(itemId).lean();
      if (!testExists) {
        return res.status(404).json({ success: false, message: 'Selected test not found' });
      }

      normalizedItemId = String(itemId);
    }

    if (isSimpleSection && !String(customName || '').trim()) {
      return res.status(400).json({ success: false, message: 'customName is required for this section' });
    }

    const booking = await EarlyDetectionBooking.findOne({
      $or: [{ _id: id }, { bookingNumber: id }, { invoiceNumber: id }],
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'media',
    });

    const uploadStream = bucket.openUploadStream(file.originalname, {
      contentType: file.mimetype,
      metadata: {
        bookingId: String(booking._id),
        section: normalizedSection,
        ...(normalizedItemId ? { itemId: normalizedItemId } : {}),
      },
    });

    const fileId = await new Promise((resolve, reject) => {
      uploadStream.on('finish', () => resolve(uploadStream.id));
      uploadStream.on('error', reject);
      uploadStream.end(file.buffer);
    });

    if (!booking.schedule) booking.schedule = {};

    if (needsTest) {
      if (!Array.isArray(booking.schedule[normalizedSection])) {
        booking.schedule[normalizedSection] = [];
      }
    } else {
      if (!booking.schedule[normalizedSection] || typeof booking.schedule[normalizedSection] !== 'object') {
        booking.schedule[normalizedSection] = {};
      }
      if (!Array.isArray(booking.schedule[normalizedSection].files)) {
        booking.schedule[normalizedSection].files = [];
      }
    }

    const sectionEntries = booking.schedule[normalizedSection];

    const filePayload = {
      filename: file.originalname,
      customName: String(customName || '').trim(),
      fileId,
      uploadedAt: new Date(),
      url: '',
    };

    if (needsTest) {
      const existingIndex = sectionEntries.findIndex(
        (entry) => String(entry?.item?._id || entry?.item || '') === normalizedItemId,
      );

      if (existingIndex >= 0) {
        sectionEntries[existingIndex].files = Array.isArray(sectionEntries[existingIndex].files)
          ? [...sectionEntries[existingIndex].files, filePayload]
          : [filePayload];
      } else {
        sectionEntries.push({
          item: normalizedItemId,
          files: [filePayload],
        });
      }
    } else {
      sectionEntries.files = Array.isArray(sectionEntries.files)
        ? [...sectionEntries.files, filePayload]
        : [filePayload];
    }

    booking.markModified(`schedule.${normalizedSection}`);
    await booking.save();

    const serializedBooking = await serializeBookingResponse(booking);
    return res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      data: serializedBooking,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to upload file', error: error.message });
  }
};

// @desc    Get uploaded schedule file (view/download)
// @route   GET /api/early-detection/form/bookings/files/:fileId
// @access  Private/Admin
exports.getScheduleFile = async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(String(fileId))) {
      return res.status(400).json({ success: false, message: 'Invalid file id' });
    }

    const objectId = new mongoose.Types.ObjectId(String(fileId));
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'media',
    });

    const files = await bucket.find({ _id: objectId }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    const file = files[0];
    const asDownload = ['1', 'true', 'yes'].includes(String(req.query?.download || '').toLowerCase());
    const dispositionType = asDownload ? 'attachment' : 'inline';

    res.set('Content-Type', file.contentType || 'application/octet-stream');
    res.set('Content-Disposition', `${dispositionType}; filename="${encodeURIComponent(file.filename || 'file')}"`);

    const readStream = bucket.openDownloadStream(objectId);
    readStream.on('error', (error) => {
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Failed to stream file', error: error.message });
      }
    });
    readStream.pipe(res);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to get file', error: error.message });
  }
};

// @desc    Save specialist consultation history form
// @route   PUT /api/early-detection/form/bookings/:id/specialist/:idx
// @access  Admin
exports.saveSpecialistHistoryForm = async (req, res) => {
  try {
    const { id, idx } = req.params;
    const index = parseInt(idx, 10);
    const { historyForm } = req.body;

    if (isNaN(index)) return res.status(400).json({ error: "Invalid specialist index" });

    const booking = await EarlyDetectionBooking.findById(id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    const specialist = booking.schedule.specialistConsultations[index];
    if (!specialist) return res.status(404).json({ error: "Specialist not found" });

    if (historyForm && typeof historyForm === "object") {
      Object.assign(specialist.historyForm, historyForm);
    }

    booking.markModified("schedule.specialistConsultations");
    await booking.save();

    return res.json({ success: true, specialist: booking.schedule.specialistConsultations[index] });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
};

// @desc    Create or update booking with payment link
// @route   POST /api/early-detection/submit
// @access  Public
exports.submitBooking = async (req, res) => {
  try {
    // Import package helpers
    const { getPackagePriceById, getAddOnById, calculateTotal, EARLY_DETECTION_PACKAGES, EARLY_DETECTION_ADDONS } = require('../models/EarlyDetectionBooking');

    const patientInput = resolvePatientInput(req.body);
    const { appointmentDate, package: inputPackage, consents, paymentMethod, addOns: inputAddOns, lang, schedule } = req.body;

    // Package is required — main package must always be selected
    if (!inputPackage || !inputPackage.id) {
      return res.status(400).json({
        success: false,
        message: 'Package selection is required'
      });
    }
    const packagePrice = getPackagePriceById(inputPackage.id);
    const foundPackage = EARLY_DETECTION_PACKAGES.find(p => p.id === inputPackage.id);
    const packageCurrency = foundPackage?.currency || "RUB";
    if (!packagePrice) {
      return res.status(400).json({
        success: false,
        message: 'Invalid package id'
      });
    }
    const packageObj = {
      id: inputPackage.id,
      name: foundPackage?.name || inputPackage.name,
      description: inputPackage.description,
      price: packagePrice,
      currency: packageCurrency
    };

    // Validate and compose add-ons
    const validAddOns = [];
    if (Array.isArray(inputAddOns) && inputAddOns.length > 0) {
      for (const addonInput of inputAddOns) {
        const addon = getAddOnById(addonInput.id || addonInput);
        if (addon) {
          validAddOns.push({ id: addon.id, name: addon.name, price: addon.price });
        }
      }
    }

    // Calculate total amount (base package + add-ons)
    const addOnIds = validAddOns.map(a => a.id);
    const totalAmount = calculateTotal(packageObj.id, addOnIds);

    // Validate required fields
    if (!patientInput || !patientInput.firstName || !patientInput.lastName || !patientInput.dateOfBirth || !patientInput.email || !(patientInput.phone || patientInput.phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Missing required patient information'
      });
    }

    // Validate appointment date (optional)
    let appointment = null;
    if (appointmentDate) {
      appointment = new Date(appointmentDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      appointment.setHours(0, 0, 0, 0);

      if (appointment < today) {
        return res.status(400).json({
          success: false,
          message: 'Appointment date must be today or in the future'
        });
      }
    }

    const patientRecord = await ensurePatientRecord(patientInput);

    // Validate required consents
    if (!consents || consents.dataProcessing !== true) {
      return res.status(400).json({
        success: false,
        message: 'Data processing consent is required'
      });
    }

    const normalizedSchedule = buildSchedule(schedule, appointment, req.body.appointmentTime || "");

    // Check if user has existing unpaid booking
    const existingUnpaidBooking = await EarlyDetectionBooking.findOne({
      patient: patientRecord._id,
      'paymentHistory.status': { $in: ['pending', 'failed', 'processing'] }
    }).sort({ createdAt: -1 });

    let booking;
    let isNewBooking = false;

    if (existingUnpaidBooking && existingUnpaidBooking.payment.status !== 'paid') {
      existingUnpaidBooking.patient = patientRecord._id;
      existingUnpaidBooking.schedule = normalizedSchedule;
      existingUnpaidBooking.consents = {
        dataProcessing: consents.dataProcessing === true,
        marketing: consents.marketing === true
      };
      if (packageObj) {
        existingUnpaidBooking.package = packageObj;
      }
      existingUnpaidBooking.addOns = validAddOns;
      existingUnpaidBooking.totalAmount = totalAmount;
      existingUnpaidBooking.payment.status = 'pending';
      existingUnpaidBooking.payment.paymentLink = null;
      existingUnpaidBooking.payment.transactionId = null;
      existingUnpaidBooking.payment.paidAt = null;
      booking = existingUnpaidBooking;
      isNewBooking = false;
    } else {
      // Create new booking
      booking = await EarlyDetectionBooking.create({
        patient: patientRecord._id,
        schedule: normalizedSchedule,
        consents: {
          dataProcessing: consents.dataProcessing === true,
          marketing: consents.marketing === true
        },
        package: packageObj,
        addOns: validAddOns,
        totalAmount: totalAmount,
        paymentHistory: [{
          status: 'pending',
          paymentUrl: null,
          paidAt: null,
          amount: (totalAmount || packageObj?.price || 0) * 100,
          changedBy: req.user?.id || 'system',
          changedAt: new Date(),
        }]
      });
      isNewBooking = true;
    }

    await attachLegacyBookingFields(booking);

    // Generate YooKassa payment
    // TEMPORARILY COMMENTED OUT FOR TESTING
    /*
    try {
      const payment = await createYooKassaPayment(booking);

      // Update booking with payment information
      booking.payment.paymentLink = payment.confirmation.confirmation_url;
      booking.payment.transactionId = payment.id;
      await booking.save();

      const responseMessage = isNewBooking
        ? 'Booking created successfully. Redirect to payment.'
        : 'Booking updated successfully. New payment link generated.';

      await telegramBot.sendBookingNotification(booking);
      await maxBot.sendBookingNotification(booking);

      res.status(isNewBooking ? 201 : 200).json({
        success: true,
        message: responseMessage,
        data: {
          booking: {
            id: booking._id,
            bookingNumber: booking.bookingNumber,
            invoiceNumber: booking.invoiceNumber,
            customer: {
              ...booking.customer.toObject(),
              dateOfBirth: booking.customer.dateOfBirth ? booking.customer.dateOfBirth.toISOString().split('T')[0] : null
            },
            consents: booking.consents,
            package: booking.package,
            status: booking.status,
            updated: !isNewBooking
          },
          payment: {
            id: payment.id,
            paymentLink: payment.confirmation.confirmation_url,
            status: booking.payment.status,
            amount: booking.package.price,
            currency: booking.package.currency
          }
        }
      });

    } catch (paymentError) {

      if (isNewBooking) {
        // If payment creation fails for new booking, delete it
        await EarlyDetectionBooking.findByIdAndDelete(booking._id);
      }

      res.status(500).json({
        success: false,
        message: 'Failed to create payment. Please try again.',
        error: paymentError.message
      });
    }
    */

    // Generate T-Bank payment link
    let paymentLink = null;
    try {
      // Use totalAmount for payment (handles package-only, add-ons-only, or both)
      const paymentAmount = booking.totalAmount || booking.package?.price || 0;
      const amountInKopecks = paymentAmount * 100;
      const orderId = `${booking.bookingNumber}-${Date.now()}`;

      // Build description based on what was selected
      const hasAddOns = booking.addOns && booking.addOns.length > 0;
      let description;
      if (hasAddOns) {
        description = `Оплата за пакет "${booking.package.name}" + ${booking.addOns.map(a => a.name).join(', ')} - Early Detection`;
      } else {
        description = `Оплата за пакет "${booking.package.name}" - Early Detection`;
      }

      // Prepare URLs
      const baseUrl = 'https://ed.sophos-med.ru';
      const successUrl = `${baseUrl}/success?bookingId=${booking._id}`;
      const failUrl = `${baseUrl}/failure?bookingId=${booking._id}`;
      const notificationUrl = 'https://apimanager.sophos-med.ru/api/early-detection/payment/tbank-webhook';

      // Generate receipt items — base package + each add-on as separate line item
      const receiptItems = [{
        name: booking.package.name,
        price: booking.package.price * 100,
        quantity: 1,
        amount: booking.package.price * 100,
        tax: 'none',
        paymentMethod: 'full_prepayment',
        paymentObject: 'service'
      }];
      if (hasAddOns) {
        for (const addon of booking.addOns) {
          receiptItems.push({
            name: addon.name,
            price: addon.price * 100,
            quantity: 1,
            amount: addon.price * 100,
            tax: 'none',
            paymentMethod: 'full_prepayment',
            paymentObject: 'service'
          });
        }
      }

      // Generate receipt
      const receipt = tbankPaymentService.generateReceipt({
        email: booking.customer.email,
        phone: booking.customer.phone,
        items: receiptItems,
        taxation: 'usn_income'
      });

      // Initialize T-Bank payment with installment support
      const paymentResponse = await tbankPaymentService.initPayment({
        amount: amountInKopecks,
        orderId: orderId,
        description: description,
        customerEmail: booking.customer.email,
        customerPhone: booking.customer.phone,
        customerKey: booking.customer.email, // Use email as unique customer identifier
        language: lang === 'en' ? 'en' : 'ru', // Set payment form language based on frontend
        recurrent: false, // Enable card saving if needed
        receipt: receipt,
        successUrl: successUrl,
        failUrl: failUrl,
        notificationUrl: notificationUrl,
        data: {
          BookingId: booking._id.toString(),
          CustomerName: `${booking.customer.firstName} ${booking.customer.lastName}`,
          PackageId: booking.package.id
        },
        // Enable installment option (T-Bank will show if customer is eligible)
        installment: {
          enabled: true
        }
      });

      if (paymentResponse.success) {
        // Update booking with T-Bank payment info
        booking.payment.paymentMethod = booking.payment.paymentMethod || 'tbank';
        booking.payment.status = 'processing';
        booking.payment.paymentLink = paymentResponse.paymentUrl;
        booking.payment.tbank = {
          paymentId: paymentResponse.paymentId,
          orderId: orderId,
          terminalKey: process.env.TBANK_TERMINAL_KEY,
          paymentStatus: paymentResponse.status,
          amount: amountInKopecks,
          lastUpdated: new Date()
        };

        if (!Array.isArray(booking.paymentHistory)) {
          booking.paymentHistory = [];
        }
        const lastIndex = booking.paymentHistory.length - 1;
        const hasPendingLast =
          lastIndex >= 0 &&
          String(booking.paymentHistory[lastIndex]?.status || '') === 'pending';

        const nextPaymentRow = {
          status: 'processing',
          paymentId: paymentResponse.paymentId,
          orderId: orderId,
          paymentUrl: paymentResponse.paymentUrl,
          amount: amountInKopecks,
          transactionId: paymentResponse.paymentId,
          paymentMethod: booking.payment.paymentMethod || 'tbank',
          tbank: booking.payment.tbank,
          changedBy: req.user?.id || 'system',
          changedAt: new Date(),
        };

        if (hasPendingLast) {
          booking.paymentHistory[lastIndex] = {
            ...booking.paymentHistory[lastIndex],
            ...nextPaymentRow,
          };
          booking.markModified('paymentHistory');
        } else {
          booking.paymentHistory.push(nextPaymentRow);
        }

        paymentLink = paymentResponse.paymentUrl;
      } else {
        throw new Error(paymentResponse.message || 'Failed to initialize T-Bank payment');
      }
    } catch (paymentError) {

      if (isNewBooking) {
        // If payment creation fails for new booking, delete it
        await EarlyDetectionBooking.findByIdAndDelete(booking._id);
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to create payment. Please try again.',
        error: paymentError.message
      });
    }

    // Save booking with payment info
    await booking.save();

    const responseMessage = isNewBooking
      ? 'Booking created successfully. Redirect to payment.'
      : 'Booking updated successfully. New payment link generated.';

    await telegramBot.sendBookingNotification(booking);
    await maxBot.sendBookingNotification(booking);
    const serializedBooking = await serializeBookingResponse(booking);

    res.status(isNewBooking ? 201 : 200).json({
      success: true,
      message: responseMessage,
      data: {
        booking: {
          ...serializedBooking,
          updated: !isNewBooking,
        },
        payment: {
          paymentLink: paymentLink,
          status: booking.payment.status,
          amount: booking.totalAmount || booking.package.price,
          currency: booking.package.currency || 'RUB'
        }
      }
    });

  } catch (error) {

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Invoice number already exists',
        error: 'Duplicate booking'
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error processing booking',
      error: error.message
    });
  }
};

// @desc    Get user's booking history
// @route   GET /api/early-detection/user-bookings/:email
// @access  Public
exports.getUserBookings = async (req, res) => {
  try {
    const { email } = req.params;

    const patient = await Patient.findOne({ email: email.toLowerCase() });
    const bookings = patient
      ? await EarlyDetectionBooking.find({ patient: patient._id })
          .sort({ createdAt: -1 })
          .select('-__v')
      : [];

    const unpaidBookings = bookings.filter(b =>
      b.payment.status !== 'paid'
    );

    const paidBookings = bookings.filter(b =>
      b.payment.status === 'paid'
    );

    const serializedBookings = await serializeBookingListResponse(bookings);

    res.status(200).json({
      success: true,
      data: {
        total: bookings.length,
        unpaidCount: unpaidBookings.length,
        paidCount: paidBookings.length,
        hasUnpaid: unpaidBookings.length > 0,
        latestUnpaid: unpaidBookings.length > 0
          ? serializedBookings.find((item) => String(item._id) === String(unpaidBookings[0]._id)) || null
          : null,
        allBookings: serializedBookings,
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user bookings',
      error: error.message
    });
  }
};

// @desc    Cancel unpaid booking
// @route   PUT /api/early-detection/cancel-unpaid/:bookingId
// @access  Public
exports.cancelUnpaidBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await EarlyDetectionBooking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.payment.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel paid booking'
      });
    }

    // Mark as cancelled
    booking.payment.status = 'failed';
    booking.status = 'cancelled';
    await booking.save();

    const serializedBooking = await serializeBookingResponse(booking);

    res.status(200).json({
      success: true,
      message: 'Unpaid booking cancelled',
      data: serializedBooking
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error cancelling booking',
      error: error.message
    });
  }
};

// Helper function to create YooKassa payment using direct API
async function createYooKassaPayment(booking) {
  const { YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY, PAYMENT_RETURN_URL } = process.env;

  if (!YOOKASSA_SHOP_ID || !YOOKASSA_SECRET_KEY || !PAYMENT_RETURN_URL) {
    throw new Error('YooKassa configuration is missing');
  }

  await attachLegacyBookingFields(booking);

  const idempotenceKey = uuidv4();

  const totalPrice = booking.totalAmount || booking.package.price;
  const paymentData = {
    amount: {
      value: totalPrice.toFixed(2),
      currency: booking.package.currency || 'RUB'
    },
    confirmation: {
      type: 'redirect',
      return_url: `${PAYMENT_RETURN_URL}?invoice=${booking.invoiceNumber}`
    },
    capture: true,
    description: `Invoice ${booking.invoiceNumber}: Early Detection Package - ${booking.package.name}`,
    metadata: {
      bookingId: booking._id.toString(),
      invoiceNumber: booking.invoiceNumber,
      bookingNumber: booking.bookingNumber,
      customerEmail: booking.customer.email,
      customerName: `${booking.customer.lastName} ${booking.customer.firstName}`,
      dataProcessingConsent: booking.consents.dataProcessing,
      marketingConsent: booking.consents.marketing
    }
  };

  try {
    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotence-Key': idempotenceKey,
        'Authorization': 'Basic ' + Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString('base64')
      },
      body: JSON.stringify(paymentData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`YooKassa payment creation failed: ${errorData.description || 'Unknown error'}`);
    }

    return await response.json();

  } catch (error) {
    throw error;
  }
}

// @desc    T-Bank webhook handler
// @route   POST /api/early-detection/payment/tbank-webhook
// @access  Public (T-Bank calls this)
exports.tbankPaymentWebhook = async (req, res) => {
  try {

    const { TerminalKey, OrderId, Success, Status, PaymentId, ErrorCode, Amount, CardId, Pan, Token } = req.body;


    // Verify token
    const isValidToken = tbankPaymentService.verifyWebhookToken(req.body);
    if (!isValidToken) {
      return res.status(403).send('Invalid token');
    }

    if (!OrderId) {
      return res.status(400).send('OK'); // Still return OK to prevent retries
    }

    // Extract booking number from OrderId (format: BOOKINGNUM-timestamp)
    const bookingNumber = OrderId.split('-')[0];

    // Find booking by booking number
    const booking = await EarlyDetectionBooking.findOne({ bookingNumber });

    if (!booking) {
      return res.status(200).send('OK'); // Return OK to prevent retries
    }

    await attachLegacyBookingFields(booking);

    // Track if payment was already paid before this webhook (to prevent duplicate notifications)
    const wasAlreadyPaid = booking.payment.status === 'paid';

    // Update T-Bank payment info
    if (!booking.payment.tbank) {
      booking.payment.tbank = {};
    }
    booking.payment.tbank.paymentId = PaymentId;
    booking.payment.tbank.paymentStatus = Status;
    booking.payment.tbank.lastUpdated = new Date();

    // Update payment status based on T-Bank status
    // Note: With PayType 'O' (one-stage), T-Bank sends both AUTHORIZED and CONFIRMED simultaneously
    switch (Status) {
      case 'CONFIRMED':
      case 'AUTHORIZED':
        booking.payment.status = 'paid';
        booking.payment.paidAt = new Date();
        booking.status = 'confirmed';
        break;

      case 'REJECTED':
      case 'CANCELED':
        booking.payment.status = 'failed';
        booking.status = 'cancelled';
        break;

      case 'REFUNDED':
        booking.payment.status = 'failed';
        booking.status = 'cancelled';
        break;

      case 'NEW':
      case 'AUTHORIZING':
      case 'CONFIRMING':
        booking.payment.status = 'processing';
        break;

      default:
        break;
    }

    await booking.save();

    // Send Telegram notification only once - only if payment just became paid (wasn't paid before)
    const shouldSendNotification = 
      (Status === 'CONFIRMED' || Status === 'AUTHORIZED') && 
      booking.payment.status === 'paid' &&
      !wasAlreadyPaid; // Only send if it wasn't already paid
    
    if (shouldSendNotification) {
      try {
        await telegramBot.sendBookingNotification(booking);
        await maxBot.sendBookingNotification(booking);
      } catch (telegramError) {
      }
    } else if ((Status === 'CONFIRMED' || Status === 'AUTHORIZED') && wasAlreadyPaid) {
    }

    
    // T-Bank requires exactly "OK" in uppercase, no JSON
    res.status(200).send('OK');

  } catch (error) {
    
    // Still return OK to prevent endless retries
    res.status(200).send('OK');
  }
};

// @desc    YooKassa webhook handler
// @route   POST /api/early-detection/payment/webhook
// @access  Public (YooKassa calls this)
exports.paymentWebhook = async (req, res) => {
  try {

    const { event, object } = req.body;


    if (event !== 'payment.succeeded' && event !== 'payment.canceled' && event !== 'payment.waiting_for_capture') {
      return res.status(200).json({ received: true });
    }


    const paymentId = object.id;
    const invoiceNumber = object.metadata?.invoiceNumber;
    const bookingNumber = object.metadata?.bookingNumber;


    // Find booking by payment ID, invoice number, or booking number
    let booking = await EarlyDetectionBooking.findOne({
      'payment.transactionId': paymentId
    });

    if (!booking && invoiceNumber) {
      booking = await EarlyDetectionBooking.findOne({ invoiceNumber });
    }

    if (!booking && bookingNumber) {
      booking = await EarlyDetectionBooking.findOne({ bookingNumber });
    }

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }


    // Update payment status based on YooKassa event

    switch (event) {
      case 'payment.succeeded':
        booking.payment.status = 'paid';
        booking.payment.paidAt = new Date();
        booking.status = 'confirmed';
        break;

      case 'payment.canceled':
        booking.payment.status = 'failed';
        booking.status = 'cancelled';
        break;

      case 'payment.waiting_for_capture':
        booking.payment.status = 'processing';
        break;
    }

    await booking.save();

    res.status(200).json({ received: true });

  } catch (error) {
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

// @desc    Check payment status
// @route   GET /api/early-detection/payment/status/:bookingId
// @access  Public
exports.checkPaymentStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await EarlyDetectionBooking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    await attachLegacyBookingFields(booking);

    res.status(200).json({
      success: true,
      data: {
        paymentStatus: booking.payment.status,
        bookingStatus: booking.status,
        paidAt: booking.payment.paidAt,
        paymentLink: booking.payment.paymentLink,
        bookingNumber: booking.bookingNumber,
        invoiceNumber: booking.invoiceNumber,
        canUpdate: booking.payment.status !== 'paid',
        customer: {
          ...booking.customer.toObject(),
          dateOfBirth: toDateOnlyString(booking.customer.dateOfBirth)
        },
        consents: booking.consents
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking payment status',
      error: error.message
    });
  }
};

// @desc    Get booking details with payment info
// @route   GET /api/early-detection/booking/:id
// @access  Public
exports.getBookingById = async (req, res) => {
  try {
    const booking = await EarlyDetectionBooking.findOne({
      $or: [
        { bookingNumber: req.params.id },
        { invoiceNumber: req.params.id }
      ]
    }).select('-__v');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const serializedBooking = await serializeBookingResponse(booking);

    res.status(200).json({
      success: true,
      data: serializedBooking
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching booking',
      error: error.message
    });
  }
};

const getWeeklyBookingsOnCalendar = async (req, res) => {
  try {
    const doctorEmail = req.query.doctorEmail || req.user?.email;
    let query = {};

    console.log("[CALENDAR] === getWeeklyBookingsOnCalendar START ===");
    console.log("[CALENDAR] doctorEmail:", doctorEmail);

    // If doctor email provided, find their profile and filter by that
    if (doctorEmail) {
      const doctor = await DoctorsProfile.findOne({ email: doctorEmail });
      console.log("[CALENDAR] Doctor found:", !!doctor, doctor?._id);
      if (doctor) {
        // Find bookings where this doctor is assigned to specialist consultations
        query["schedule.specialistConsultations.doctor"] = doctor._id;
        console.log("[CALENDAR] Query filter:", JSON.stringify(query));
      }
    }

    let bookings = await EarlyDetectionBooking.find(query)
      .populate("patient");
    
    console.log("[CALENDAR] Bookings found:", bookings.length);

    // Manually populate doctor refs in specialist consultations for all bookings
    for (let b of bookings) {
      if (b.schedule && b.schedule.specialistConsultations) {
        for (let i = 0; i < b.schedule.specialistConsultations.length; i++) {
          const spec = b.schedule.specialistConsultations[i];
          if (spec.doctor && mongoose.Types.ObjectId.isValid(spec.doctor)) {
            spec.doctor = await DoctorsProfile.findById(spec.doctor);
          }
        }
      }
    }

    // Transform bookings to match expected frontend format
    const transformedBookings = bookings.flatMap((booking) => {
      const results = [];
      
      console.log("[CALENDAR] Processing booking:", booking._id, booking.bookingNumber);
      console.log("[CALENDAR] - Patient:", booking.patient?._id, booking.patient?.email);
      console.log("[CALENDAR] - Schedule specialistConsultations length:", booking.schedule?.specialistConsultations?.length);
      
      if (booking.schedule && booking.schedule.specialistConsultations && booking.schedule.specialistConsultations.length > 0) {
        // Create one result entry per specialist consultation
        booking.schedule.specialistConsultations.forEach((consultation, idx) => {
          const transformed = {
            _id: booking._id,
            bookingId: booking._id,
            bookingNumber: booking.bookingNumber,
            invoiceNumber: booking.invoiceNumber,
            applicationId: booking.bookingNumber, // Use bookingNumber as applicationId for legacy compatibility
            patientId: booking.patient?._id,
            patientEmail: booking.patient?.email || null,
            patientName: booking.patient?.firstName || booking.patient?.name || "Unknown",
            appointmentStatus: booking.status, // 'pending', 'confirmed', 'completed', 'cancelled'
            date: consultation.date,
            startTime: consultation.startTime,
            endTime: consultation.endTime,
            specialistTitle: consultation.title,
            doctorId: consultation.doctor?._id,
            doctorEmail: consultation.doctor?.email,
            doctorName: consultation.doctor?.firstName || consultation.doctor?.name,
            serviceType: "specialist-consultation", // or could be derived from title
            totalAmount: booking.totalAmount || 0,
            paymentStatus: booking.payment?.status || "pending",
          };
          results.push(transformed);
          
          console.log(`[CALENDAR] - Specialist ${idx} (${consultation.title}):`, {
            date: consultation.date,
            startTime: consultation.startTime,
            doctorEmail: consultation.doctor?.email,
          });
        });
      } else {
        // If no consultations, still create base entry
        const transformed = {
          _id: booking._id,
          bookingId: booking._id,
          bookingNumber: booking.bookingNumber,
          invoiceNumber: booking.invoiceNumber,
          applicationId: booking.bookingNumber,
          patientId: booking.patient?._id,
          patientEmail: booking.patient?.email || null,
          patientName: booking.patient?.firstName || booking.patient?.name || "Unknown",
          appointmentStatus: booking.status,
          date: null,
          startTime: null,
          endTime: null,
          specialistTitle: null,
          doctorId: null,
          doctorEmail: null,
          doctorName: null,
          serviceType: "booking",
          totalAmount: booking.totalAmount || 0,
          paymentStatus: booking.payment?.status || "pending",
        };
        results.push(transformed);
        console.log("[CALENDAR] - No specialist consultations found");
      }
      
      return results;
    });

    console.log("[CALENDAR] Transformed results count:", transformedBookings.length);
    console.log("[CALENDAR] === getWeeklyBookingsOnCalendar END ===");

    res.json(transformedBookings);
  } catch (error) {
    console.error("Error fetching bookings for calendar:", error);
    res.status(500).json({ message: "Failed to fetch bookings for calendar", error: error.message });
  }
};

exports.getWeeklyBookingsOnCalendar = getWeeklyBookingsOnCalendar;

// @desc    Get invoice by number
// @route   GET /api/early-detection/invoice/:invoiceNumber
// @access  Public
exports.getInvoiceByNumber = async (req, res) => {
  try {
    const booking = await EarlyDetectionBooking.findOne({
      invoiceNumber: req.params.invoiceNumber
    }).select('-__v');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    const serializedBooking = await serializeBookingResponse(booking);

    res.status(200).json({
      success: true,
      data: serializedBooking
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching invoice',
      error: error.message
    });
  }
};

// @desc    Get monthly invoice statistics
// @route   GET /api/early-detection/invoices/monthly/:month/:year
// @access  Private/Admin
exports.getMonthlyInvoices = async (req, res) => {
  try {
    const { month, year } = req.params;

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const invoices = await EarlyDetectionBooking.find({
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    })
      .sort({ sequenceNumber: 1 })
      .select('invoiceNumber bookingNumber patient consents package payment status createdAt schedule');

    const paidInvoices = invoices.filter(inv => inv.payment.status === 'paid');
    const pendingInvoices = invoices.filter(inv => inv.payment.status === 'pending');
    const totalRevenue = paidInvoices.reduce((sum, inv) => sum + inv.package.price, 0);
    const serializedInvoices = await serializeBookingListResponse(invoices);

    res.status(200).json({
      success: true,
      data: {
        month: month,
        year: year,
        totalInvoices: invoices.length,
        paidInvoices: paidInvoices.length,
        pendingInvoices: pendingInvoices.length,
        totalRevenue: totalRevenue,
        averageInvoiceValue: paidInvoices.length > 0 ? totalRevenue / paidInvoices.length : 0,
        invoices: serializedInvoices,
        nextInvoiceNumber: invoices.length > 0 ? `ED-${month.padStart(2, '0')}/${year}-${(invoices.length + 1).toString().padStart(3, '0')}` : `ED-${month.padStart(2, '0')}/${year}-001`
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching monthly invoices',
      error: error.message
    });
  }
};

// @desc    Get all bookings (admin)
// @route   GET /api/early-detection/bookings
// @access  Private/Admin
exports.getBookings = async (req, res) => {
  try {
    const bookings = await EarlyDetectionBooking.find()
      .sort({ createdAt: -1 })
      .select('-__v');
    const formattedBookings = await serializeBookingListResponse(bookings);

    res.status(200).json({
      success: true,
      count: formattedBookings.length,
      data: formattedBookings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching bookings',
      error: error.message
    });
  }
};

// @desc    Update booking status (Admin)
// @route   PUT /api/early-detection/bookings/:id/status
// @access  Private/Admin
exports.updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Find booking by ID, booking number, or invoice number
    let booking = await EarlyDetectionBooking.findOne({
      $or: [
        { _id: id },
        { bookingNumber: id },
        { invoiceNumber: id }
      ]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Store old status for logging
    const oldStatus = booking.status;

    // Update booking status
    booking.status = status;

    // Add status notes if provided
    if (notes) {
      if (!booking.statusHistory) {
        booking.statusHistory = [];
      }
      booking.statusHistory.push({
        status: status,
        notes: notes,
        changedBy: req.user?.id || 'system',
        changedAt: new Date()
      });
    }

    await booking.save();

    const serializedBooking = await serializeBookingResponse(booking);

    res.status(200).json({
      success: true,
      message: `Booking status updated from ${oldStatus} to ${status}`,
      data: serializedBooking
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating booking status',
      error: error.message
    });
  }
};

// @desc    Update payment status (Admin)
// @route   PUT /api/early-detection/bookings/:id/payment-status
// @access  Private/Admin
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus, paymentDate, notes, paymentHistoryId, transactionId, paymentMethod, createNewEntry, amount } = req.body;

    // Validate payment status
    const validPaymentStatuses = ['pending', 'paid', 'failed', 'processing', 'refunded'];
    if (!validPaymentStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment status. Must be one of: ${validPaymentStatuses.join(', ')}`
      });
    }

    const allowedPaymentMethods = [
      'tbank',
      'vtb',
      'yandex',
      'bank_transfer',
      'cash',
      'payment_terminal',
      'create_without_payment',
      'manual_admin',
    ];
    const normalizedPaymentMethod = String(paymentMethod || '').trim() || null;
    if (normalizedPaymentMethod && !allowedPaymentMethods.includes(normalizedPaymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method'
      });
    }

    // Find booking by ID, booking number, or invoice number
    let booking = await EarlyDetectionBooking.findOne({
      $or: [
        { _id: id },
        { bookingNumber: id },
        { invoiceNumber: id }
      ]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    await attachLegacyBookingFields(booking);

    // Store old status for logging
    const oldPaymentStatus = booking.payment.status;

    // Update payment status
    booking.payment.status = paymentStatus;
    if (normalizedPaymentMethod) {
      booking.payment.paymentMethod = normalizedPaymentMethod;
    }

    // Use invoiceNumber as transaction ID
    const finalTransactionId = booking.invoiceNumber;

    if (finalTransactionId) {
      booking.payment.transactionId = finalTransactionId;
    }

    // Update paidAt timestamp if status changed to paid
    if (paymentStatus === 'paid') {
      // Use provided paymentDate or current date
      const paidAtDate = paymentDate ? new Date(paymentDate) : new Date();
      booking.payment.paidAt = paidAtDate;
      // Also update booking status to confirmed if it was pending
      if (booking.status === 'pending') {
        booking.status = 'confirmed';
      }
    }

    // Add / update payment history entry
    if (!booking.paymentHistory) {
      booking.paymentHistory = [];
    }

    // Find exact entry by subdocument _id first, then by transaction/payment id, then fallback to latest.
    // For explicit manual creation, force new row by skipping update lookup.
    let existingPaymentIndex = -1;

    if (!createNewEntry && paymentHistoryId) {
      existingPaymentIndex = booking.paymentHistory.findIndex(
        (entry) => String(entry?._id) === String(paymentHistoryId)
      );

      if (existingPaymentIndex < 0) {
        return res.status(404).json({
          success: false,
          message: 'Payment history entry not found for this booking'
        });
      }
    }

    if (!createNewEntry && existingPaymentIndex < 0 && transactionId) {
      existingPaymentIndex = booking.paymentHistory.findIndex(
        (entry) =>
          String(entry?.paymentId || '') === String(transactionId) ||
          String(entry?.transactionId || '') === String(transactionId)
      );
    }

    if (!createNewEntry && existingPaymentIndex < 0 && booking.paymentHistory.length > 0) {
      existingPaymentIndex = booking.paymentHistory.length - 1;
    }

    const existingEntry = existingPaymentIndex >= 0
      ? booking.paymentHistory[existingPaymentIndex]
      : null;

    const normalizedAmount = Number(amount);
    const hasAmountOverride = Number.isFinite(normalizedAmount) && normalizedAmount >= 0;

    // Create single payment history entry
    const paymentHistoryEntry = {
      paymentId: createNewEntry
        ? `manual-${Date.now()}`
        : (existingEntry?.paymentId || transactionId || finalTransactionId || `manual-${Date.now()}`),
      orderId: existingEntry?.orderId || booking.invoiceNumber || booking._id.toString(),
      paymentUrl: existingEntry?.paymentUrl || null,
      amount: hasAmountOverride
        ? normalizedAmount
        : (existingEntry?.amount || (booking.totalAmount || booking.package?.price || 0) * 100),
      status: paymentStatus,
      transactionId: existingEntry?.transactionId || transactionId || finalTransactionId,
      paymentMethod: normalizedPaymentMethod || existingEntry?.paymentMethod || booking.payment?.paymentMethod || null,
      notes: notes || `Manual: ${paymentStatus}`,
      createdBy: existingEntry?.createdBy || req.user?.id || 'admin',
      createdAt: existingEntry?.createdAt || new Date(),
      changedBy: req.user?.id || 'system',
      changedAt: new Date(),
    };

    // Add paidAt if status is paid
    if (paymentStatus === 'paid') {
      paymentHistoryEntry.paidAt = paymentDate ? new Date(paymentDate) : (existingEntry?.paidAt || new Date());
    } else {
      paymentHistoryEntry.paidAt = null;
    }

    // Update existing entry or push new one
    if (existingPaymentIndex >= 0) {
      booking.paymentHistory[existingPaymentIndex] = paymentHistoryEntry;
    } else {
      booking.paymentHistory.push(paymentHistoryEntry);
    }

    await booking.save();

    const serializedBooking = await serializeBookingResponse(booking);

    res.status(200).json({
      success: true,
      message: `Payment status updated from ${oldPaymentStatus} to ${paymentStatus}`,
      data: serializedBooking
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating payment status',
      error: error.message
    });
  }
};

// @desc    Mark booking as paid manually (Admin)
// @route   PUT /api/early-detection/bookings/:id/mark-as-paid
// @access  Private/Admin
exports.markAsPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const { transactionId, paymentMethod, notes } = req.body;

    // Find booking by ID, booking number, or invoice number
    let booking = await EarlyDetectionBooking.findOne({
      $or: [
        { _id: id },
        { bookingNumber: id },
        { invoiceNumber: id }
      ]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    await attachLegacyBookingFields(booking);

    // Check if already paid
    if (booking.payment.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Booking is already marked as paid'
      });
    }

    // Store old status for logging
    const oldPaymentStatus = booking.payment.status;
    const oldBookingStatus = booking.status;

    // Auto-generate transaction ID if not provided (use ED series)
    const finalTransactionId = transactionId || booking.invoiceNumber;

    // Update payment and booking status
    booking.payment.status = 'paid';
    booking.payment.paidAt = new Date();
    booking.payment.transactionId = finalTransactionId;
    booking.status = 'confirmed';

    // Update payment method if provided
    if (paymentMethod) {
      booking.payment.paymentMethod = paymentMethod;
    }

    // Add to payment history
    if (!booking.paymentHistory) {
      booking.paymentHistory = [];
    }
    booking.paymentHistory.push({
      status: 'paid',
      transactionId: finalTransactionId,
      paymentMethod: paymentMethod,
      notes: notes || 'Manually marked as paid by admin',
      changedBy: req.user?.id || 'system',
      changedAt: new Date()
    });

    await booking.save();

    const serializedBooking = await serializeBookingResponse(booking);

    res.status(200).json({
      success: true,
      message: `Booking marked as paid. Payment status: ${oldPaymentStatus} → paid, Booking status: ${oldBookingStatus} → confirmed`,
      data: serializedBooking
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error marking booking as paid',
      error: error.message
    });
  }
};

// @desc    Permanently delete a booking (Admin)
// @route   DELETE /api/early-detection/form/bookings/:id
// @access  Private/Admin
exports.deleteBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await EarlyDetectionBooking.findByIdAndDelete(id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    res.status(200).json({ message: "Booking deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete booking", error: error.message });
  }
};

// @desc    Cancel booking (Admin)
// @route   PUT /api/early-detection/bookings/:id/cancel
// @access  Private/Admin
exports.cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, refundAmount } = req.body;

    // Find booking by ID, booking number, or invoice number
    let booking = await EarlyDetectionBooking.findOne({
      $or: [
        { _id: id },
        { bookingNumber: id },
        { invoiceNumber: id }
      ]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    await attachLegacyBookingFields(booking);

    // Check if already cancelled
    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Booking is already cancelled'
      });
    }

    // Store old status for logging
    const oldBookingStatus = booking.status;
    const oldPaymentStatus = booking.payment.status;

    // Update booking and payment status
    booking.status = 'cancelled';
    booking.payment.status = 'failed'; // Or 'refunded' if refund was processed

    // Add refund information if applicable
    if (refundAmount) {
      booking.payment.refundAmount = refundAmount;
      booking.payment.refundDate = new Date();
      booking.payment.status = 'refunded';
    }

    // Add cancellation notes to history
    if (!booking.statusHistory) {
      booking.statusHistory = [];
    }
    booking.statusHistory.push({
      status: 'cancelled',
      reason: reason,
      refundAmount: refundAmount,
      changedBy: req.user?.id || 'system',
      changedAt: new Date()
    });

    await booking.save();

    const serializedBooking = await serializeBookingResponse(booking);

    res.status(200).json({
      success: true,
      message: `Booking cancelled. Booking status: ${oldBookingStatus} → cancelled, Payment status: ${oldPaymentStatus} → ${booking.payment.status}`,
      data: serializedBooking
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error cancelling booking',
      error: error.message
    });
  }
};

// @desc    Update booking details (Admin)
// @route   PUT /api/early-detection/bookings/:id
// @access  Private/Admin
exports.updateBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { appointmentDate, package: packageData, consents, notes, addOns: inputAddOns, schedule } = req.body;
    const patientInput = resolvePatientInput(req.body);
    const hasAppointmentTime = Object.prototype.hasOwnProperty.call(req.body, 'appointmentTime');
    const hasSchedule = Object.prototype.hasOwnProperty.call(req.body, 'schedule');
    const { getPackagePriceById, getAddOnById, calculateTotal, EARLY_DETECTION_PACKAGES } = require('../models/EarlyDetectionBooking');

    // Find booking by ID, booking number, or invoice number
    let booking = await EarlyDetectionBooking.findOne({
      $or: [
        { _id: id },
        { bookingNumber: id },
        { invoiceNumber: id }
      ]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    await attachLegacyBookingFields(booking);

    let patientUpdated = false;
    let scheduleUpdated = false;
    let packageUpdated = false;
    let addOnsUpdated = false;
    let consentsUpdated = false;
    let totalAmountUpdated = false;

    if (patientInput) {
      const patientRecord = await ensurePatientRecord(patientInput);
      booking.patient = patientRecord._id;
      patientUpdated = true;
    }

    const currentSchedule = booking.schedule?.toObject ? booking.schedule.toObject() : (booking.schedule || {});
    const legacyAppointment = deriveLegacyAppointment(currentSchedule);
    let nextAppointmentDate = legacyAppointment.appointmentDate;

    if (appointmentDate !== undefined) {
      if (!appointmentDate) {
        nextAppointmentDate = null;
      } else {
        const parsedAppointmentDate = new Date(appointmentDate);
        if (Number.isNaN(parsedAppointmentDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid appointment date'
          });
        }
        nextAppointmentDate = parsedAppointmentDate;
      }
    }

    const nextAppointmentTime = hasAppointmentTime
      ? (req.body.appointmentTime || '')
      : (legacyAppointment.appointmentTime || '');

    if (hasSchedule || appointmentDate !== undefined || hasAppointmentTime) {
      const scheduleUpdate =
        hasSchedule && schedule && typeof schedule === 'object'
          ? schedule
          : {};

      const mergedSchedule = {
        ...currentSchedule,
        ...scheduleUpdate
      };

      const nextSchedule = buildSchedule(
        mergedSchedule,
        nextAppointmentDate,
        nextAppointmentTime
      );

      if (appointmentDate !== undefined || hasAppointmentTime) {
        if (!Array.isArray(nextSchedule.specialistConsultations) || nextSchedule.specialistConsultations.length === 0) {
          nextSchedule.specialistConsultations = DEFAULT_SPECIALIST_CONSULTATIONS.map((title, index) => ({
            title,
            date: index === 0 ? nextAppointmentDate : null,
            startTime: index === 0 ? nextAppointmentTime : '',
            endTime: '',
            doctor: null,
            historyForm: normalizeHistoryForm({})
          }));
        } else {
          nextSchedule.specialistConsultations[0] = {
            ...nextSchedule.specialistConsultations[0],
            date: appointmentDate !== undefined
              ? nextAppointmentDate
              : nextSchedule.specialistConsultations[0].date,
            startTime: hasAppointmentTime
              ? nextAppointmentTime
              : nextSchedule.specialistConsultations[0].startTime
          };
        }
      }

      booking.schedule = nextSchedule;
      scheduleUpdated = true;
    }

    if (packageData) {
      const currentPackage = booking.package?.toObject ? booking.package.toObject() : (booking.package || {});
      const nextPackageId = packageData.id || currentPackage.id;
      const packagePrice = getPackagePriceById(nextPackageId);

      if (!nextPackageId || !packagePrice) {
        return res.status(400).json({
          success: false,
          message: 'Invalid package id'
        });
      }

      const foundPackage = EARLY_DETECTION_PACKAGES.find((item) => item.id === nextPackageId);
      booking.package = {
        ...currentPackage,
        ...packageData,
        id: nextPackageId,
        name: packageData.name || foundPackage?.name || currentPackage.name,
        price: packagePrice,
        currency: foundPackage?.currency || packageData.currency || currentPackage.currency || 'RUB'
      };
      packageUpdated = true;
    }

    if (inputAddOns !== undefined) {
      const validAddOns = [];
      if (Array.isArray(inputAddOns) && inputAddOns.length > 0) {
        for (const addonInput of inputAddOns) {
          const addon = getAddOnById(addonInput.id || addonInput);
          if (addon) {
            validAddOns.push({ id: addon.id, name: addon.name, price: addon.price });
          }
        }
      }

      booking.addOns = validAddOns;
      addOnsUpdated = true;
    }

    if (consents) {
      const currentConsents = booking.consents?.toObject ? booking.consents.toObject() : (booking.consents || {});
      booking.consents = {
        ...currentConsents,
        dataProcessing: consents.dataProcessing === undefined
          ? currentConsents.dataProcessing
          : consents.dataProcessing === true,
        marketing: consents.marketing === undefined
          ? currentConsents.marketing
          : consents.marketing === true
      };
      consentsUpdated = true;
    }

    if (packageUpdated || addOnsUpdated) {
      const addOnIds = Array.isArray(booking.addOns) ? booking.addOns.map((addon) => addon.id) : [];
      booking.totalAmount = calculateTotal(booking.package.id, addOnIds) || booking.package.price || 0;
      totalAmountUpdated = true;
    }

    // Add update history
    if (!booking.updateHistory) {
      booking.updateHistory = [];
    }
    booking.updateHistory.push({
      timestamp: new Date(),
      updatedBy: req.user?.id || 'system',
      changes: {
        patient: patientUpdated ? 'updated' : 'unchanged',
        schedule: scheduleUpdated ? 'updated' : 'unchanged',
        package: packageUpdated ? 'updated' : 'unchanged',
        addOns: addOnsUpdated ? 'updated' : 'unchanged',
        consents: consentsUpdated ? 'updated' : 'unchanged',
        totalAmount: totalAmountUpdated ? 'updated' : 'unchanged'
      },
      notes: notes
    });

    await booking.save();

    const serializedBooking = await serializeBookingResponse(booking);

    res.status(200).json({
      success: true,
      message: 'Booking updated successfully',
      data: serializedBooking
    });

  } catch (error) {

    if (error.message === 'Patient email is required' || error.message === 'Missing required patient information') {
      return res.status(400).json({
        success: false,
        message: error.message,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating booking',
      error: error.message
    });
  }
};


// @desc    Create booking manually (Admin)
// @route   POST /api/early-detection/bookings/manual
// @access  Private/Admin
exports.createManualBooking = async (req, res) => {
  try {
    const {
      appointmentDate,
      package: packageData,
      consents,
      createPaymentLink,
      markAsPaid,
      paidDate,
      paymentMethod,
      addOns: inputAddOns,
      lang,
      schedule,
    } = req.body;
    const patientInput = resolvePatientInput(req.body);
    const hasAppointmentTime = Object.prototype.hasOwnProperty.call(req.body, 'appointmentTime');
    const { getPackagePriceById, getAddOnById, calculateTotal, EARLY_DETECTION_PACKAGES } = require('../models/EarlyDetectionBooking');

    // Validate required fields
    if (!patientInput || !(patientInput._id || patientInput.id || patientInput.patientId || patientInput.email)) {
      return res.status(400).json({
        success: false,
        message: 'Patient reference or email is required'
      });
    }

    // Validate appointment date (optional)
    let appointment = null;
    if (appointmentDate) {
      appointment = new Date(appointmentDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      appointment.setHours(0, 0, 0, 0);

      if (appointment < today) {
        return res.status(400).json({
          success: false,
          message: 'Appointment date must be today or in the future'
        });
      }
    }

    // Validate required consents
    if (!consents || consents.dataProcessing !== true) {
      return res.status(400).json({
        success: false,
        message: 'Data processing consent is required'
      });
    }

    // Package is required — main package must always be selected
    if (!packageData || !packageData.id) {
      return res.status(400).json({
        success: false,
        message: 'Package selection is required'
      });
    }

    const packagePrice = getPackagePriceById(packageData.id);
    const foundPackage = EARLY_DETECTION_PACKAGES.find((item) => item.id === packageData.id);

    if (!packagePrice) {
      return res.status(400).json({
        success: false,
        message: 'Invalid package id'
      });
    }

    const packageObj = {
      id: packageData.id,
      name: foundPackage?.name || packageData.name,
      description: packageData.description,
      price: packagePrice,
      currency: foundPackage?.currency || packageData.currency || 'RUB'
    };

    const allowedPaymentMethods = [
      'tbank',
      'vtb',
      'yandex',
      'bank_transfer',
      'cash',
      'payment_terminal',
      'create_without_payment',
    ];
    const normalizedPaymentMethod = String(paymentMethod || '').trim() || null;

    if (normalizedPaymentMethod && !allowedPaymentMethods.includes(normalizedPaymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method'
      });
    }

    const shouldMarkAsPaid = markAsPaid === true;
    const shouldCreatePaymentLink = createPaymentLink === true || (!shouldMarkAsPaid && normalizedPaymentMethod === 'tbank');

    // Validate payment options
    if (shouldCreatePaymentLink && shouldMarkAsPaid) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create payment link and mark as paid simultaneously. Choose one option.'
      });
    }

    if (normalizedPaymentMethod === 'create_without_payment' && (shouldCreatePaymentLink || shouldMarkAsPaid)) {
      return res.status(400).json({
        success: false,
        message: 'Create without payment cannot be marked as paid or have a payment link'
      });
    }

    let paidAtValue = null;
    if (shouldMarkAsPaid) {
      if (!paidDate) {
        return res.status(400).json({
          success: false,
          message: 'Paid date is required when mark as paid is enabled'
        });
      }

      const parsedPaidDate = new Date(paidDate);
      if (Number.isNaN(parsedPaidDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid paid date'
        });
      }
      paidAtValue = parsedPaidDate;
    }

    // Validate and compose add-ons
    const validAddOns = [];
    if (Array.isArray(inputAddOns) && inputAddOns.length > 0) {
      for (const addonInput of inputAddOns) {
        const addon = getAddOnById(addonInput.id || addonInput);
        if (addon) {
          validAddOns.push({ id: addon.id, name: addon.name, price: addon.price });
        }
      }
    }

    // Calculate total (base package + add-ons)
    const addOnIds = validAddOns.map((addon) => addon.id);
    const totalAmount = calculateTotal(packageObj.id, addOnIds) || packageObj.price || 0;
    const patientRecord = await ensurePatientRecord(patientInput);
    const normalizedSchedule = buildSchedule(
      schedule,
      appointment,
      hasAppointmentTime ? req.body.appointmentTime : ''
    );

    // Create booking with initial status
    const bookingData = {
      patient: patientRecord._id,
      schedule: normalizedSchedule,
      consents: {
        dataProcessing: consents.dataProcessing === true,
        marketing: consents.marketing === true
      },
      package: packageObj,
      addOns: validAddOns,
      totalAmount: totalAmount,
      paymentHistory: [{
        status: shouldMarkAsPaid ? 'paid' : (shouldCreatePaymentLink ? 'pending' : 'pending'),
        paymentUrl: null,
        paidAt: shouldMarkAsPaid ? paidAtValue : null,
        paymentMethod: normalizedPaymentMethod || (shouldMarkAsPaid ? 'manual_admin' : null),
        transactionId: null,
        amount: (totalAmount || packageObj?.price || 0) * 100,
        changedBy: req.user?.id || 'system',
        changedAt: new Date(),
      }],
      status: shouldMarkAsPaid ? 'confirmed' : 'pending'
    };

    // Add admin notes if provided
    if (req.body.adminNotes) {
      if (!bookingData.adminNotes) bookingData.adminNotes = [];
      bookingData.adminNotes.push({
        note: req.body.adminNotes,
        addedBy: req.user?.id || 'system',
        addedAt: new Date()
      });
    }

    // Create the booking
    const booking = await EarlyDetectionBooking.create(bookingData);
    await attachLegacyBookingFields(booking);

    // Set transactionId to the ED-series invoiceNumber (generated by pre-save hook)
    if (shouldMarkAsPaid && booking.invoiceNumber) {
      booking.payment.transactionId = booking.invoiceNumber;
      await booking.save();
    }

    let paymentLink = null;

    // Create T-Bank payment link if requested
    if (shouldCreatePaymentLink && !shouldMarkAsPaid) {
      try {
        const paymentAmount = booking.totalAmount || booking.package?.price || 0;
        const amountInKopecks = paymentAmount * 100;
        const orderId = booking.bookingNumber || `ED-${booking._id}`;

        // Build description based on what was selected
        const bkgHasAddOns = booking.addOns && booking.addOns.length > 0;
        let description;
        if (bkgHasAddOns) {
          description = `Оплата за пакет "${booking.package.name}" + ${booking.addOns.map(a => a.name).join(', ')} - Early Detection`;
        } else {
          description = `Оплата за пакет "${booking.package.name}" - Early Detection`;
        }

        // Prepare URLs
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const successUrl = `${baseUrl}/early-detection/payment-success?bookingId=${booking._id}`;
        const failUrl = `${baseUrl}/early-detection/payment-failed?bookingId=${booking._id}`;
        const notificationUrl = 'https://apimanager.sophos-med.ru/api/early-detection/payment/tbank-webhook';

        // Generate receipt items — base package + each add-on as separate line item
        const receiptItems = [{
          name: booking.package.name,
          price: booking.package.price * 100,
          quantity: 1,
          amount: booking.package.price * 100,
          tax: 'none',
          paymentMethod: 'full_prepayment',
          paymentObject: 'service'
        }];
        if (bkgHasAddOns) {
          for (const addon of booking.addOns) {
            receiptItems.push({
              name: addon.name,
              price: addon.price * 100,
              quantity: 1,
              amount: addon.price * 100,
              tax: 'none',
              paymentMethod: 'full_prepayment',
              paymentObject: 'service'
            });
          }
        }

        // Generate receipt
        const receipt = tbankPaymentService.generateReceipt({
          email: booking.customer.email,
          phone: booking.customer.phone,
          items: receiptItems,
          taxation: 'usn_income'
        });

        // Initialize T-Bank payment with installment support
        const paymentResponse = await tbankPaymentService.initPayment({
          amount: amountInKopecks,
          orderId: orderId,
          description: description,
          customerEmail: booking.customer.email,
          customerPhone: booking.customer.phone,
          customerKey: booking.customer.email, // Use email as unique customer identifier
          language: lang === 'en' ? 'en' : 'ru', // Set payment form language based on frontend lang
          recurrent: false, // Enable card saving if needed
          receipt: receipt,
          successUrl: successUrl,
          failUrl: failUrl,
          notificationUrl: notificationUrl,
          data: {
            BookingId: booking._id.toString(),
            CustomerName: `${booking.customer.firstName} ${booking.customer.lastName}`,
            PackageId: booking.package.id
          },
          // Enable installment option (T-Bank will show if customer is eligible)
          installment: {
            enabled: true
          }
        });

        if (paymentResponse.success) {
          // Update booking with T-Bank payment info
          booking.payment.paymentMethod = booking.payment.paymentMethod || 'tbank';
          booking.payment.status = 'processing';
          booking.payment.paymentLink = paymentResponse.paymentUrl;
          booking.payment.tbank = {
            paymentId: paymentResponse.paymentId,
            orderId: orderId,
            terminalKey: process.env.TBANK_TERMINAL_KEY,
            paymentStatus: paymentResponse.status,
            amount: amountInKopecks,
            lastUpdated: new Date()
          };

          if (!Array.isArray(booking.paymentHistory)) {
            booking.paymentHistory = [];
          }
          const lastIndex = booking.paymentHistory.length - 1;
          const hasPendingLast =
            lastIndex >= 0 &&
            String(booking.paymentHistory[lastIndex]?.status || '') === 'pending';

          const nextPaymentRow = {
            status: 'processing',
            paymentId: paymentResponse.paymentId,
            orderId: orderId,
            paymentUrl: paymentResponse.paymentUrl,
            amount: amountInKopecks,
            transactionId: paymentResponse.paymentId,
            paymentMethod: booking.payment.paymentMethod || 'tbank',
            tbank: booking.payment.tbank,
            changedBy: req.user?.id || 'system',
            changedAt: new Date(),
          };

          if (hasPendingLast) {
            booking.paymentHistory[lastIndex] = {
              ...booking.paymentHistory[lastIndex],
              ...nextPaymentRow,
            };
            booking.markModified('paymentHistory');
          } else {
            booking.paymentHistory.push(nextPaymentRow);
          }

          await booking.save();

          paymentLink = paymentResponse.paymentUrl;
        } else {
          throw new Error(paymentResponse.message || 'Failed to initialize T-Bank payment');
        }
      } catch (paymentError) {

        // Remove the booking if payment link creation fails and we require it
        if (req.body.requirePaymentLink === true) {
          await EarlyDetectionBooking.findByIdAndDelete(booking._id);
          throw new Error(`Failed to create payment link: ${paymentError.message}`);
        }

        // Continue without payment link but keep overall payment state pending
        booking.payment.status = 'pending';

        if (!Array.isArray(booking.paymentHistory)) {
          booking.paymentHistory = [];
        }
        const lastIndex = booking.paymentHistory.length - 1;
        const hasPendingLast =
          lastIndex >= 0 &&
          String(booking.paymentHistory[lastIndex]?.status || '') === 'pending';
        const failedRow = {
          status: 'pending',
          paymentMethod: booking.payment?.paymentMethod || null,
          notes: `Payment link creation failed: ${paymentError.message}`,
          changedBy: req.user?.id || 'system',
          changedAt: new Date(),
        };
        if (hasPendingLast) {
          booking.paymentHistory[lastIndex] = {
            ...booking.paymentHistory[lastIndex],
            ...failedRow,
          };
          booking.markModified('paymentHistory');
        } else {
          booking.paymentHistory.push(failedRow);
        }

        await booking.save();
      }
    }

    // Add to payment history if marked as paid
    if (markAsPaid) {
      if (!booking.paymentHistory) {
        booking.paymentHistory = [];
      }
      booking.paymentHistory.push({
        status: 'paid',
        transactionId: booking.payment.transactionId,
        paymentMethod: 'manual_admin',
        notes: 'Manually marked as paid during creation',
        changedBy: req.user?.id || 'system',
        changedAt: new Date()
      });

      await booking.save();
    }

    // Send Telegram notification
    try {

    } catch (telegramError) {
      // Don't fail the request if Telegram fails
    }

    // Prepare response data
      const responseData = {
      booking: await serializeBookingResponse(booking)
    };

    if (paymentLink) {
      responseData.payment = {
        paymentLink: paymentLink,
        amount: booking.totalAmount || booking.package?.price || 0,
        currency: booking.package.currency || 'RUB',
        status: booking.payment.status,
        paymentId: booking.payment.tbank?.paymentId,
        orderId: booking.payment.tbank?.orderId
      };
    }

    res.status(201).json({
      success: true,
      message: markAsPaid
        ? 'Booking created and marked as paid'
        : (createPaymentLink && paymentLink
          ? 'Booking created with payment link'
          : 'Booking created (pending payment setup)'),
      data: responseData
    });

  } catch (error) {
    if (error.message === 'Patient email is required' || error.message === 'Missing required patient information') {
      return res.status(400).json({
        success: false,
        message: error.message,
        error: error.message
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Invoice number already exists',
        error: 'Duplicate booking'
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.message
      });
    }

    // Handle payment link creation errors
    if (error.message.includes('payment link')) {
      return res.status(500).json({
        success: false,
        message: 'Payment link creation failed',
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating manual booking',
      error: error.message
    });
  }
};

// @desc    Generate payment link for existing booking (Admin)
// @route   POST /api/early-detection/bookings/:id/generate-payment-link
// @access  Private/Admin
exports.generatePaymentLink = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, lang, paymentMethod, amount, packageId, addonIds } = req.body;

    const allowedPaymentMethods = [
      'tbank',
      'vtb',
      'yandex',
      'bank_transfer',
      'cash',
      'payment_terminal',
      'manual_admin',
    ];
    const normalizedPaymentMethod = String(paymentMethod || '').trim() || 'tbank';
    if (!allowedPaymentMethods.includes(normalizedPaymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method'
      });
    }

    // Find booking by ID, booking number, or invoice number
    let booking = await EarlyDetectionBooking.findOne({
      $or: [
        { _id: id },
        { bookingNumber: id },
        { invoiceNumber: id }
      ]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    await attachLegacyBookingFields(booking);

    // Check if booking is already paid
    if (booking.payment.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot generate payment link for paid booking'
      });
    }

    // Generate new T-Bank payment
    try {
      // Resolve package & add-ons: use overrides if provided, else fall back to booking data
      // Always look up price from master catalogue so admin-selected packages are priced correctly
      const masterPkg = ED_PACKAGES_MASTER.find(p => p.id === (packageId || booking.package?.id));
      const resolvedPackage = masterPkg
        ? { ...masterPkg }
        : (packageId
            ? { id: packageId, name: booking.package?.name || packageId, price: booking.package?.price || 0 }
            : booking.package);

      const resolvedAddOns = Array.isArray(addonIds)
        ? addonIds.map(id => {
            const master = ED_ADDONS_MASTER.find(a => a.id === id);
            if (master) return { ...master };
            const existing = (booking.addOns || []).find(a => a.id === id);
            return existing || { id, name: id, price: 0 };
          })
        : (booking.addOns || []);

      // Amount: use frontend override (kopecks) if provided; otherwise compute from resolved items
      const normalizedAmount = Number(amount);
      const hasAmountOverride = Number.isFinite(normalizedAmount) && normalizedAmount >= 0;
      let amountInKopecks;
      if (hasAmountOverride) {
        amountInKopecks = Math.round(normalizedAmount);
      } else {
        const pkgKopecks = (resolvedPackage?.price || 0) * 100;
        const addonsKopecks = (resolvedAddOns || []).reduce((sum, a) => sum + (a.price || 0) * 100, 0);
        amountInKopecks = pkgKopecks + addonsKopecks || (booking.totalAmount || booking.package?.price || 0) * 100;
      }

      const orderId = `${booking.bookingNumber}-${Date.now()}`;

      // Build description based on resolved selection
      const glHasAddOns = resolvedAddOns && resolvedAddOns.length > 0;
      let description;
      if (glHasAddOns) {
        description = `Оплата за пакет "${resolvedPackage?.name || 'Unknown'}" + ${resolvedAddOns.length} доп. опций - Early Detection`;
      } else {
        description = `Оплата за пакет "${resolvedPackage?.name || 'Unknown'}" - Early Detection`;
      }

      // Prepare URLs
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const successUrl = `${baseUrl}/early-detection/payment-success?bookingId=${booking._id}`;
      const failUrl = `${baseUrl}/early-detection/payment-failed?bookingId=${booking._id}`;
      const notificationUrl = 'https://apimanager.sophos-med.ru/api/early-detection/payment/tbank-webhook';

      // Build receipt items: base package + add-ons
      const receiptItems = [{
        name: resolvedPackage?.name || 'Package',
        price: resolvedPackage?.price ? resolvedPackage.price * 100 : amountInKopecks,
        quantity: 1,
        amount: resolvedPackage?.price ? resolvedPackage.price * 100 : amountInKopecks,
        tax: 'none',
        paymentMethod: 'full_prepayment',
        paymentObject: 'service'
      }];

      // Add each add-on as a separate receipt line item
      if (glHasAddOns) {
        resolvedAddOns.forEach(addOn => {
          receiptItems.push({
            name: addOn.name,
            price: addOn.price * 100,
            quantity: 1,
            amount: addOn.price * 100,
            tax: 'none',
            paymentMethod: 'full_prepayment',
            paymentObject: 'service'
          });
        });
      }

      // Generate receipt
      const receipt = tbankPaymentService.generateReceipt({
        email: booking.customer.email,
        phone: booking.customer.phone,
        items: receiptItems,
        taxation: 'usn_income'
      });

      // Initialize T-Bank payment with installment support
      const paymentResponse = await tbankPaymentService.initPayment({
        amount: amountInKopecks,
        orderId: orderId,
        description: description,
        customerEmail: booking.customer.email,
        customerPhone: booking.customer.phone,
        customerKey: booking.customer.email, // Use email as unique customer identifier
        language: lang === 'en' ? 'en' : 'ru', // Set payment form language based on frontend
        recurrent: false, // Enable card saving if needed
        receipt: receipt,
        successUrl: successUrl,
        failUrl: failUrl,
        notificationUrl: notificationUrl,
        data: {
          BookingId: booking._id.toString(),
          CustomerName: `${booking.customer.firstName} ${booking.customer.lastName}`,
          PackageId: resolvedPackage?.id || booking.package?.id || '',
          AddOns: resolvedAddOns.length > 0 ? resolvedAddOns.map(a => a.id).join(',') : ''
        },
        // Enable installment option (T-Bank will show if customer is eligible)
        installment: {
          enabled: true
        }
      });

      if (!paymentResponse.success) {
        throw new Error(paymentResponse.message || 'Failed to initialize T-Bank payment');
      }

      // Single payment array: store generated links in paymentHistory
      if (!booking.paymentHistory) {
        booking.paymentHistory = [];
      }
      booking.paymentHistory.push({
        paymentId: paymentResponse.paymentId,
        orderId: orderId,
        paymentUrl: paymentResponse.paymentUrl,
        amount: amountInKopecks,
        status: 'pending',
        transactionId: paymentResponse.paymentId,
        paymentMethod: normalizedPaymentMethod,
        notes: notes || 'Payment link generated by admin',
        createdBy: req.user?.id || 'admin',
        createdAt: new Date(),
        changedBy: req.user?.id || 'system',
        changedAt: new Date(),
      });

      // Update main payment info (for backward compatibility)
      booking.payment.paymentLink = paymentResponse.paymentUrl;
      booking.payment.paymentMethod = normalizedPaymentMethod;
      if (booking.payment.status === 'failed' || booking.payment.status === 'pending') {
        booking.payment.status = 'processing';
      }
      booking.payment.tbank = {
        paymentId: paymentResponse.paymentId,
        orderId: orderId,
        terminalKey: process.env.TBANK_TERMINAL_KEY,
        paymentStatus: paymentResponse.status,
        amount: amountInKopecks,
        lastUpdated: new Date()
      };

      await booking.save();

      const serializedBooking = await serializeBookingResponse(booking);

      res.status(200).json({
        success: true,
        message: 'Payment link generated successfully',
        data: {
          booking: serializedBooking,
          paymentLink: paymentResponse.paymentUrl,
          paymentId: paymentResponse.paymentId,
          orderId: orderId,
          amount: booking.totalAmount || booking.package.price
        }
      });

    } catch (paymentError) {

      booking.payment.status = 'pending';

      if (!Array.isArray(booking.paymentHistory)) {
        booking.paymentHistory = [];
      }
      booking.paymentHistory.push({
        status: 'pending',
        paymentMethod: normalizedPaymentMethod,
        notes: `Payment link generation failed: ${paymentError.message}`,
        changedBy: req.user?.id || 'system',
        changedAt: new Date(),
      });
      await booking.save();

      res.status(500).json({
        success: false,
        message: paymentError.message || 'Failed to generate payment link',
        error: paymentError.message
      });
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating payment link',
      error: error.message
    });
  }
};  

// @desc    Validate existing payment link
// @route   GET /api/early-detection/bookings/:id/validate-payment-link
// @access  Private/Admin
exports.validatePaymentLink = async (req, res) => {
  try {
    const { id } = req.params;

    // Find booking by ID, booking number, or invoice number
    let booking = await EarlyDetectionBooking.findOne({
      $or: [
        { _id: id },
        { bookingNumber: id },
        { invoiceNumber: id }
      ]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    await attachLegacyBookingFields(booking);

    if (!booking.payment.transactionId) {
      return res.status(400).json({
        success: false,
        message: 'No payment transaction found'
      });
    }

    // Check payment status with YooKassa
    const { YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY } = process.env;

    if (!YOOKASSA_SHOP_ID || !YOOKASSA_SECRET_KEY) {
      throw new Error('YooKassa configuration is missing');
    }

    try {
      const response = await fetch(`https://api.yookassa.ru/v3/payments/${booking.payment.transactionId}`, {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString('base64')
        }
      });

      if (!response.ok) {
        throw new Error(`YooKassa API returned ${response.status}`);
      }

      const paymentInfo = await response.json();

      // Update booking status based on YooKassa status
      const oldPaymentStatus = booking.payment.status;
      const oldBookingStatus = booking.status;

      switch (paymentInfo.status) {
        case 'succeeded':
          booking.payment.status = 'paid';
          booking.payment.paidAt = new Date(paymentInfo.captured_at || paymentInfo.created_at);
          if (booking.status === 'pending') {
            booking.status = 'confirmed';
          }
          break;
        case 'canceled':
          booking.payment.status = 'failed';
          if (booking.status === 'pending') {
            booking.status = 'cancelled';
          }
          break;
        case 'waiting_for_capture':
          booking.payment.status = 'processing';
          break;
        case 'pending':
          booking.payment.status = 'pending';
          break;
      }

      // Only save if status changed
      if (oldPaymentStatus !== booking.payment.status || oldBookingStatus !== booking.status) {
        await booking.save();

        // Add to history
        if (!booking.paymentHistory) {
          booking.paymentHistory = [];
        }
        booking.paymentHistory.push({
          status: booking.payment.status,
          transactionId: booking.payment.transactionId,
          notes: `Status validated via YooKassa API: ${paymentInfo.status}`,
          changedBy: 'system',
          changedAt: new Date(),
          yooKassaStatus: paymentInfo.status
        });

        await booking.save();
      }

      const serializedBooking = await serializeBookingResponse(booking);

      res.status(200).json({
        success: true,
        message: 'Payment link validated',
        data: {
          booking: serializedBooking,
          yooKassaPayment: {
            id: paymentInfo.id,
            status: paymentInfo.status,
            amount: paymentInfo.amount,
            description: paymentInfo.description,
            created: paymentInfo.created_at,
            captured: paymentInfo.captured_at,
            confirmationUrl: paymentInfo.confirmation?.confirmation_url || booking.payment.paymentLink
          },
          validation: {
            isValid: booking.payment.paymentLink === (paymentInfo.confirmation?.confirmation_url || booking.payment.paymentLink),
            statusChanged: oldPaymentStatus !== booking.payment.status,
            currentStatus: booking.payment.status,
            previousStatus: oldPaymentStatus
          }
        }
      });

    } catch (yooKassaError) {
      const serializedBooking = await serializeBookingResponse(booking);

      res.status(200).json({
        success: false,
        message: 'Failed to validate with YooKassa',
        error: yooKassaError.message,
        data: {
          booking: serializedBooking,
          validation: {
            isValid: false,
            error: yooKassaError.message
          }
        }
      });
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error validating payment link',
      error: error.message
    });
  }
};

const getInternalNotes = async (req, res) => {
  try {
    const bookingId = req.params.bookingId || req.params.id;
    const booking = await findBooking(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    res.json({ internalNotes: booking.internalNotes || [] });
  } catch (error) {
    console.error("Error fetching internal notes:", error);
    res.status(500).json({ message: "Failed to fetch internal notes", error: error.message });
  }
};

exports.getInternalNotes = getInternalNotes;

// Add internal note to booking
exports.addInternalNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { note, addedBy } = req.body;

    if (!note || !note.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Note content is required'
      });
    }

    if (!addedBy || !addedBy.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Note author is required'
      });
    }

    // Find booking
    const booking = await EarlyDetectionBooking.findOne({
      $or: [
        { _id: id },
        { bookingNumber: id },
        { invoiceNumber: id }
      ]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Add note
    if (!booking.internalNotes) {
      booking.internalNotes = [];
    }

    booking.internalNotes.push({
      note: note.trim(),
      addedBy: addedBy.trim(),
      addedAt: new Date()
    });

    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Note added successfully',
      data: booking.internalNotes
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error adding note',
      error: error.message
    });
  }
};

// Update internal note
exports.updateInternalNote = async (req, res) => {
  try {
    const { id, noteId } = req.params;
    const { note } = req.body;

    if (!note || !note.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Note content is required'
      });
    }

    // Find booking
    const booking = await EarlyDetectionBooking.findOne({
      $or: [
        { _id: id },
        { bookingNumber: id },
        { invoiceNumber: id }
      ]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Find and update note
    const noteToUpdate = booking.internalNotes.id(noteId);
    if (!noteToUpdate) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    noteToUpdate.note = note.trim();
    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Note updated successfully',
      data: booking.internalNotes
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating note',
      error: error.message
    });
  }
};

// Delete internal note
exports.deleteInternalNote = async (req, res) => {
  try {
    const { id, noteId } = req.params;

    // Find booking
    const booking = await EarlyDetectionBooking.findOne({
      $or: [
        { _id: id },
        { bookingNumber: id },
        { invoiceNumber: id }
      ]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Find and remove note
    const noteToDelete = booking.internalNotes.id(noteId);
    if (!noteToDelete) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    booking.internalNotes.pull(noteId);
    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Note deleted successfully',
      data: booking.internalNotes
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting note',
      error: error.message
    });
  }
};

