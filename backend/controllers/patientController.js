const Patient = require('../models/Patient');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const { getGfs } = require('../gridfs');

// Configure Nodemailer transport
const transporter = nodemailer.createTransport({
  service: 'gmail', // Adjust to your email service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Helper: read profile picture from GridFS
async function readProfilePicture(profileFileId) {
  if (!profileFileId) return null;
  const gfs = getGfs();
  const file = await gfs.find({ _id: new mongoose.Types.ObjectId(profileFileId) }).toArray();
  if (file.length === 0) return null;
  const readStream = gfs.openDownloadStream(file[0]._id);
  const chunks = [];
  return new Promise((resolve) => {
    readStream.on('data', (chunk) => chunks.push(chunk));
    readStream.on('end', () => {
      resolve(Buffer.concat(chunks).toString('base64'));
    });
    readStream.on('error', () => {
      resolve(null); // Continue without profile picture
    });
  });
}

// Helper: parse JSON array from FormData string
function parseJsonArray(value) {
  try {
    const v = JSON.parse(value);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// Get all patients (with optional doctorEmail query)
const getAllPatients = async (req, res) => {
  try {
    const patients = await Patient.find();
    const patientsWithImages = await Promise.all(patients.map(async (patient) => {
      const profilePicture = await readProfilePicture(patient.profileFileId);
      return { ...patient.toObject(), profilePicture };
    }));
    res.status(200).json({ patients: patientsWithImages });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch patients', error: error.message });
  }
};

// Get a single patient by ID
const getPatientById = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    const profilePicture = await readProfilePicture(patient.profileFileId);
    res.status(200).json({ patient: { ...patient.toObject(), profilePicture } });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch patient', error: error.message });
  }
};

// Get a single patient by email
const getPatientByEmail = async (req, res) => {
  try {
    const patient = await Patient.findOne({ email: req.params.email });
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    const profilePicture = await readProfilePicture(patient.profileFileId);
    res.status(200).json({ patient: { ...patient.toObject(), profilePicture } });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch patient', error: error.message });
  }
};

// Add a new patient
const addPatient = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Validation errors', errors: errors.array() });
  }

  try {
    const {
      // Basic Data
      firstName, middleName, lastName, gender, dateOfBirth, notes,
      // Contacts
      phoneNumber, additionalPhone, maxId, telegramNickname, telegramId,
      email, newsletter, egisz,
      instagram, vk, facebook, ok,
      contactPerson, contactPersonPhone,
      // Documents
      cmip, cmipDate, cmipOrgCode, snils, medInsuranceOrg,
      socialSupportCode, citizenship,
      documentType, documentSeries, documentNumber,
      documentIssuedDate, departmentCode, documentIssuedBy, inn,
      // Address
      addressType, region, district, city, settlement, street,
      house, terrain, apartment, postcode, geocoordinates, registrationChange,
      // Personal Data
      maritalStatus, education, employment, placeOfWork,
      workSpecialty, changePlaceOfWork, changeOfPosition,
      // Disability
      disability, disabilityFrom, disabilityTo, disabilityIndefinitely,
      invalidGroup, disabilityType, disabilityPrimaryRepeated,
      // Anamnesis
      anamnesisDisability, bloodGroup, rhFactor, kellAntigen,
      otherBloodInfo, allergies,
      // Arrays
      diseases, finalDiagnoses, radiationDoses, legalRepresentatives,
      // System
      comments, notificationLanguage,
    } = req.body;

    // Check if patient with this email already exists
    const existingPatient = await Patient.findOne({ email });
    if (existingPatient) {
      return res.status(400).json({ message: 'Patient with this email already exists' });
    }

    // Check if user with this email already exists
    let user = await User.findOne({ email });

    // If user doesn't exist, create one
    if (!user) {
      const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      user = new User({
        email,
        password: hashedPassword,
        role: 'patient',
        profileCompleted: false,
      });

      await user.save();
    } else {
      if (user.role !== 'patient') {
        return res.status(400).json({
          message: `A user with this email already exists with role: ${user.role}. Cannot create patient profile.`
        });
      }
    }

    const patient = new Patient({
      // Basic Data
      firstName,
      middleName: middleName || '',
      lastName,
      gender,
      dateOfBirth,
      notes: notes || '',
      // Contacts
      phoneNumber,
      additionalPhone: additionalPhone || '',
      maxId: maxId || '',
      telegramNickname: telegramNickname || '',
      telegramId: telegramId || '',
      email,
      newsletter: newsletter || false,
      egisz: egisz || false,
      instagram: instagram || '',
      vk: vk || '',
      facebook: facebook || '',
      ok: ok || '',
      contactPerson: contactPerson || '',
      contactPersonPhone: contactPersonPhone || '',
      // Documents
      cmip: cmip || '',
      cmipDate: cmipDate || null,
      cmipOrgCode: cmipOrgCode || '',
      snils: snils || '',
      medInsuranceOrg: medInsuranceOrg || '',
      socialSupportCode: socialSupportCode || '',
      citizenship: citizenship || '',
      documentType: documentType || '',
      documentSeries: documentSeries || '',
      documentNumber: documentNumber || '',
      documentIssuedDate: documentIssuedDate || null,
      departmentCode: departmentCode || '',
      documentIssuedBy: documentIssuedBy || '',
      inn: inn || '',
      // Address
      addressType: addressType || '',
      region: region || '',
      district: district || '',
      city: city || '',
      settlement: settlement || '',
      street: street || '',
      house: house || '',
      terrain: terrain || '',
      apartment: apartment || '',
      postcode: postcode || '',
      geocoordinates: geocoordinates || '',
      registrationChange: registrationChange || '',
      // Personal Data
      maritalStatus: maritalStatus || '',
      education: education || '',
      employment: employment || '',
      placeOfWork: placeOfWork || '',
      workSpecialty: workSpecialty || '',
      changePlaceOfWork: changePlaceOfWork || '',
      changeOfPosition: changeOfPosition || '',
      // Disability
      disability: disability || '',
      disabilityFrom: disabilityFrom || null,
      disabilityTo: disabilityTo || null,
      disabilityIndefinitely: disabilityIndefinitely || false,
      invalidGroup: invalidGroup || '',
      disabilityType: disabilityType || '',
      disabilityPrimaryRepeated: disabilityPrimaryRepeated || '',
      // Anamnesis
      anamnesisDisability: anamnesisDisability || '',
      bloodGroup: bloodGroup || '',
      rhFactor: rhFactor || '',
      kellAntigen: kellAntigen || '',
      otherBloodInfo: otherBloodInfo || '',
      allergies: allergies || '',
      // Arrays — values arrive as JSON strings from FormData
      diseases: parseJsonArray(diseases),
      finalDiagnoses: parseJsonArray(finalDiagnoses),
      radiationDoses: parseJsonArray(radiationDoses),
      legalRepresentatives: parseJsonArray(legalRepresentatives),
      // System
      comments: comments || '',
      notificationLanguage: notificationLanguage || 'en',
    });

    // Handle profile image
    if (req.file) {
      const gfs = getGfs();
      const writeStream = gfs.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype,
      });
      writeStream.end(req.file.buffer);
      const fileId = await new Promise((resolve, reject) => {
        writeStream.on('finish', () => resolve(writeStream.id));
        writeStream.on('error', (err) => {
          reject(err);
        });
      });
      patient.profileFileId = fileId;
    }

    await patient.save();
    const profilePicture = await readProfilePicture(patient.profileFileId);

    res.status(201).json({
      message: 'Patient added successfully',
      patient: { ...patient.toObject(), profilePicture },
    });
  } catch (error) {
    res.status(400).json({ message: 'Failed to add patient', error: error.message });
  }
};

// Update a patient
const updatePatient = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Validation errors', errors: errors.array() });
  }

  try {
    const {
      // Basic
      firstName, middleName, lastName, gender, dateOfBirth, notes,
      // Contacts
      phoneNumber, additionalPhone, email,
      maxId, telegramNickname, telegramId,
      newsletter, egisz,
      instagram, vk, facebook, ok,
      contactPerson, contactPersonPhone,
      // Documents
      cmip, cmipDate, cmipOrgCode, snils, medInsuranceOrg,
      socialSupportCode, citizenship,
      documentType, documentSeries, documentNumber,
      documentIssuedDate, departmentCode, documentIssuedBy, inn,
      // Address
      addressType, region, district, city, settlement, street,
      house, terrain, apartment, postcode, geocoordinates, registrationChange,
      // Personal
      maritalStatus, education, employment, placeOfWork,
      workSpecialty, changePlaceOfWork, changeOfPosition,
      // Disability
      disability, disabilityFrom, disabilityTo, disabilityIndefinitely,
      invalidGroup, disabilityType, disabilityPrimaryRepeated,
      // Anamnesis
      anamnesisDisability, bloodGroup, rhFactor, kellAntigen,
      otherBloodInfo, allergies,
      // Arrays
      diseases, finalDiagnoses, radiationDoses, legalRepresentatives,
      // System
      comments, notificationLanguage,
    } = req.body;

    // Parse array fields — sent as JSON strings from FormData
    const parsedDiseases = parseJsonArray(diseases);
    const parsedFinalDiagnoses = parseJsonArray(finalDiagnoses);
    const parsedRadiationDoses = parseJsonArray(radiationDoses);
    const parsedLegalRepresentatives = parseJsonArray(legalRepresentatives);

    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Check if email is changed and already exists
    if (email !== patient.email) {
      const existingPatient = await Patient.findOne({ email });
      if (existingPatient) {
        return res.status(400).json({ message: 'Patient with this email already exists' });
      }
    }

    // Normalize date to midnight UTC
    const normalizedDate = new Date(dateOfBirth);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    // Basic
    patient.firstName = firstName;
    patient.middleName = middleName || '';
    patient.lastName = lastName;
    patient.gender = gender;
    patient.dateOfBirth = normalizedDate;
    patient.notes = notes || '';
    // Contacts
    patient.phoneNumber = phoneNumber;
    patient.additionalPhone = additionalPhone || '';
    patient.email = email;
    patient.maxId = maxId || '';
    patient.telegramNickname = telegramNickname || '';
    patient.telegramId = telegramId || '';
    patient.newsletter = newsletter === 'true' || newsletter === true;
    patient.egisz = egisz === 'true' || egisz === true;
    patient.instagram = instagram || '';
    patient.vk = vk || '';
    patient.facebook = facebook || '';
    patient.ok = ok || '';
    patient.contactPerson = contactPerson || '';
    patient.contactPersonPhone = contactPersonPhone || '';
    // Documents
    patient.cmip = cmip || '';
    patient.cmipDate = cmipDate || null;
    patient.cmipOrgCode = cmipOrgCode || '';
    patient.snils = snils || '';
    patient.medInsuranceOrg = medInsuranceOrg || '';
    patient.socialSupportCode = socialSupportCode || '';
    patient.citizenship = citizenship || '';
    patient.documentType = documentType || '';
    patient.documentSeries = documentSeries || '';
    patient.documentNumber = documentNumber || '';
    patient.documentIssuedDate = documentIssuedDate || null;
    patient.departmentCode = departmentCode || '';
    patient.documentIssuedBy = documentIssuedBy || '';
    patient.inn = inn || '';
    // Address
    patient.addressType = addressType || '';
    patient.region = region || '';
    patient.district = district || '';
    patient.city = city || '';
    patient.settlement = settlement || '';
    patient.street = street || '';
    patient.house = house || '';
    patient.terrain = terrain || '';
    patient.apartment = apartment || '';
    patient.postcode = postcode || '';
    patient.geocoordinates = geocoordinates || '';
    patient.registrationChange = registrationChange || '';
    // Personal
    patient.maritalStatus = maritalStatus || '';
    patient.education = education || '';
    patient.employment = employment || '';
    patient.placeOfWork = placeOfWork || '';
    patient.workSpecialty = workSpecialty || '';
    patient.changePlaceOfWork = changePlaceOfWork || '';
    patient.changeOfPosition = changeOfPosition || '';
    // Disability
    patient.disability = disability || '';
    patient.disabilityFrom = disabilityFrom || null;
    patient.disabilityTo = disabilityTo || null;
    patient.disabilityIndefinitely = disabilityIndefinitely === 'true' || disabilityIndefinitely === true;
    patient.invalidGroup = invalidGroup || '';
    patient.disabilityType = disabilityType || '';
    patient.disabilityPrimaryRepeated = disabilityPrimaryRepeated || '';
    // Anamnesis
    patient.anamnesisDisability = anamnesisDisability || '';
    patient.bloodGroup = bloodGroup || '';
    patient.rhFactor = rhFactor || '';
    patient.kellAntigen = kellAntigen || '';
    patient.otherBloodInfo = otherBloodInfo || '';
    patient.allergies = allergies || '';
    // Arrays
    patient.diseases = parsedDiseases;
    patient.finalDiagnoses = parsedFinalDiagnoses;
    patient.radiationDoses = parsedRadiationDoses;
    patient.legalRepresentatives = parsedLegalRepresentatives;
    // System
    patient.comments = comments || '';
    patient.notificationLanguage = notificationLanguage || 'en';

    // Handle profile image
    if (req.file) {
      const gfs = getGfs();
      if (patient.profileFileId) {
        try {
          await gfs.delete(new mongoose.Types.ObjectId(patient.profileFileId));
        } catch (err) {
        }
      }
      const writeStream = gfs.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype,
      });
      writeStream.end(req.file.buffer);
      const fileId = await new Promise((resolve, reject) => {
        writeStream.on('finish', () => resolve(writeStream.id));
        writeStream.on('error', (err) => {
          reject(err);
        });
      });
      patient.profileFileId = fileId;
    }

    await patient.save();

    // Return response
    res.status(200).json({
      message: 'Patient updated successfully',
      patient,
    });
  } catch (error) {
    res.status(400).json({ message: 'Failed to update patient', error: error.message });
  }
};

// Patch a patient – partial update for GeneralInformationTab fields
const patchPatient = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Whitelist of every top-level scalar field from the GeneralInformationTab
    const ALLOWED_SCALAR_FIELDS = [
      // Basic Data
      'firstName', 'middleName', 'lastName', 'gender', 'dateOfBirth', 'notes',
      // Contacts
      'phoneNumber', 'additionalPhone', 'maxId', 'telegramNickname', 'telegramId',
      'email', 'newsletter', 'egisz',
      'instagram', 'vk', 'facebook', 'ok',
      'contactPerson', 'contactPersonPhone',
      // Documents
      'cmip', 'cmipDate', 'cmipOrgCode', 'snils', 'medInsuranceOrg',
      'socialSupportCode', 'citizenship',
      'documentType', 'documentSeries', 'documentNumber',
      'documentIssuedDate', 'departmentCode', 'documentIssuedBy', 'inn',
      // Address
      'addressType', 'region', 'district', 'city', 'settlement', 'street',
      'house', 'terrain', 'apartment', 'postcode', 'geocoordinates', 'registrationChange',
      // Personal Data
      'maritalStatus', 'education', 'employment', 'placeOfWork',
      'workSpecialty', 'changePlaceOfWork', 'changeOfPosition',
      // Disability
      'disability', 'disabilityFrom', 'disabilityTo', 'disabilityIndefinitely',
      'invalidGroup', 'disabilityType', 'disabilityPrimaryRepeated',
      // Anamnesis
      'anamnesisDisability', 'bloodGroup', 'rhFactor', 'kellAntigen',
      'otherBloodInfo', 'allergies',
      // System
      'comments', 'notificationLanguage',
    ];

    // Array fields handled separately to allow full replacement
    const ALLOWED_ARRAY_FIELDS = [
      'diseases', 'finalDiagnoses', 'radiationDoses', 'legalRepresentatives',
    ];

    const updates = {};

    // Apply scalar fields – only if explicitly present in request body
    for (const field of ALLOWED_SCALAR_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    }

    // Apply array fields – replace entire array when provided
    for (const field of ALLOWED_ARRAY_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        const val = req.body[field];
        updates[field] = Array.isArray(val) ? val : [];
      }
    }

    // Email uniqueness check if email is being changed
    if (updates.email && updates.email !== patient.email) {
      const conflict = await Patient.findOne({ email: updates.email });
      if (conflict) {
        return res.status(400).json({ message: 'Another patient with this email already exists' });
      }
    }

    const updated = await Patient.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.status(200).json({ message: 'Patient updated successfully', patient: updated });
  } catch (error) {
    res.status(400).json({ message: 'Failed to update patient', error: error.message });
  }
};

// Delete a patient
const deletePatient = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    if (patient.profileFileId) {
      const gfs = getGfs();
      try {
        const file = await gfs.find({ _id: new mongoose.Types.ObjectId(patient.profileFileId) }).toArray();
        if (file.length > 0) {
          await gfs.delete(new mongoose.Types.ObjectId(patient.profileFileId));
        }
      } catch (err) {
      }
    }
    await patient.deleteOne();
    res.status(200).json({ message: 'Patient deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete patient', error: error.message });
  }
};

// Send email to patient
const sendEmail = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Validation errors', errors: errors.array() });
  }

  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    const { to, subject, body } = req.body;
    if (to !== patient.email) {
      return res.status(400).json({ message: 'Email address does not match patient record' });
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      text: body,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to send email', error: error.message });
  }
};

module.exports = {
  getAllPatients,
  getPatientById,
  getPatientByEmail,
  addPatient,
  updatePatient,
  patchPatient,
  deletePatient,
  sendEmail,
};
