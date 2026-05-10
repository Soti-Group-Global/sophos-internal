const Patient = require('../models/Patient');
const User = require('../models/User');
const Application = require('../models/Application');
const Assistant = require('../models/Assistant');
const HeadAssistant = require('../models/HeadAssistant');
const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const { transporter } = require('../utils/emailService');
const { getGfs } = require('../gridfs');
const moment = require('moment-timezone');

// Configure Nodemailer transport


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

function getPatientId(req) {
  return req.params.id || req.params.patientId;
}

// Get all patients (with optional doctorEmail query)
const getAllPatients = async (req, res) => {
  try {
    const { doctorEmail } = req.query;
    const normalizedDoctorEmail = doctorEmail ? doctorEmail.toLowerCase() : null;

    const patients = await Patient.find().lean();

    // Fetch applications by patient emails and/or by doctorEmail (if provided)
    let applications = [];
    const patientEmails = patients.map((p) => p.email).filter(Boolean).map((e) => e.toLowerCase());

    const queryClauses = [];
    if (patientEmails.length) {
      queryClauses.push({ patientEmail: { $in: patientEmails } });
    }
    if (normalizedDoctorEmail) {
      queryClauses.push({ doctorEmail: normalizedDoctorEmail });
      queryClauses.push({ "doctors.doctorEmail": normalizedDoctorEmail });
    }

    if (queryClauses.length) {
      applications = await Application.find({ $or: queryClauses })
        .sort({ date: -1, startTime: -1, createdAt: -1 })
        .select("patientEmail applicationId date startTime endTime serviceType appointmentStatus")
        .lean();
    }

    const latestApplicationByPatient = new Map();
    applications.forEach((application) => {
      const patientEmail = application.patientEmail?.toLowerCase();
      if (patientEmail && !latestApplicationByPatient.has(patientEmail)) {
        latestApplicationByPatient.set(patientEmail, application);
      }
    });

    const patientsWithImages = await Promise.all(
      patients.map(async (patient) => {
        const profilePicture = await readProfilePicture(patient.profileFileId);
        const latestApplication = latestApplicationByPatient.get(patient.email?.toLowerCase());

        return {
          ...patient,
          profilePicture,
          ...(latestApplication
            ? {
                applicationId: latestApplication.applicationId,
                date: latestApplication.date,
                startTime: latestApplication.startTime,
                endTime: latestApplication.endTime,
                serviceType: latestApplication.serviceType,
                appointmentStatus: latestApplication.appointmentStatus,
              }
            : {}),
        };
      }),
    );

    res.status(200).json({ patients: patientsWithImages });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch patients', error: error.message });
  }
};

// Get a single patient by ID
const getPatientById = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.patientId);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    const profilePicture = await readProfilePicture(patient.profileFileId);
    res.status(200).json({ patient: { ...patient.toObject(), profilePicture } });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch patient', error: error.message });
  }
};

// Get a single patient by custom patientId field (e.g. "HD-001")
const getPatientByPatientId = async (req, res) => {
  try {
    const patient = await Patient.findOne({ patientId: req.params.patientId });
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

//Create Legal Representative
const createLegalRepresentative = async (req, res) => {
  try{
    const patientId = getPatientId(req);
    const legalRepData = req.body;
    const patient = await Patient.findById(patientId);
    if(!patient){
        return res.status(404).json({ message: "Patient not found" });
    }
    patient.legalRepresentatives.push(legalRepData);
    await patient.save();
    res.status(201).json({ message: "Legal representative added successfully", legalRepresentatives: patient.legalRepresentatives });
  }
  catch(error){
    console.log("Error creating legal representative:", error);
    res.status(500).json({ message: "Error creating legal representative" });
  }
};

// Update Legal Representative (update existing or create new)
const updateLegalRepresentative = async (req, res) => {
  try{
    const patientId = getPatientId(req);
    const { legalRepId } = req.params;
        const legalRepData = req.body;
        const patient = await Patient.findById(patientId);
        if(!patient){
            return res.status(404).json({ message: "Patient not found" });
        }

        // If legalRepId is "new" or "undefined", create a new legal representative
        if (!legalRepId || legalRepId === "new" || legalRepId === "undefined") {
            patient.legalRepresentatives.push(legalRepData);
            await patient.save();
            return res.status(201).json({ message: "Legal representative added successfully", legalRepresentatives: patient.legalRepresentatives });
        }

        const legalRepIndex = patient.legalRepresentatives.findIndex(rep => rep._id.toString() === legalRepId);
        if(legalRepIndex === -1){
            return res.status(404).json({ message: "Legal representative not found" });
        }
        patient.legalRepresentatives[legalRepIndex] = { ...patient.legalRepresentatives[legalRepIndex].toObject(), ...legalRepData };
        await patient.save();
        res.status(200).json({ message: "Legal representative updated successfully", legalRepresentatives: patient.legalRepresentatives });
    }
    catch(error){
        console.log("Error updating legal representative:", error);
        res.status(500).json({ message: "Error updating legal representative" });
    }
}

//Update Contact Person
const updateContact = async (req, res) => {
    try {
    const patientId = getPatientId(req);

        const patient = await Patient.findById(patientId);
        if (!patient) {
            return res.status(404).json({ message: "Patient not found" });
        }

        const fields = [
            "phoneNumber",
            "additionalPhone",
            "maxId",
            "telegramNickname",
            "telegramId",
            "newsletter",
            "egisz",
            "instagram",
            "vk",
            "facebook",
            "ok",
            "contactPerson",
            "contactPersonPhone"
        ];

        fields.forEach(field => {
            if (req.body[field] !== undefined) {
                patient[field] = req.body[field];
            }
        });

        await patient.save();

        res.status(200).json({
            message: "Contacts updated successfully",
            data: patient
        });

    } catch (error) {
        console.error("Error updating contacts:", error);
        res.status(500).json({ message: "Error updating contacts" });
    }
};

//Update Documents
const updateDocument = async (req,res) => {
  try {
  const patientId = getPatientId(req);
        const patient = await Patient.findById(patientId);
        if (!patient) {
            return res.status(404).json({ message: "Patient not found" });
        }
        const documentFields = [
            "cmip",
            "cmipDate",
            "cmipOrgCode",
            "snils",
            "medInsuranceOrg",
            "socialSupportCode",
            "citizenship",
            "documentType",
            "documentSeries",
            "documentNumber",
            "documentIssuedDate",
            "departmentCode",
            "documentIssuedBy",
            "inn"
        ];

        documentFields.forEach(field => {
            if (req.body[field] !== undefined) {
                patient[field] = req.body[field];
            }
        });
        await patient.save();
        res.status(200).json({ message: "Documents updated successfully", data: patient });
    }
    catch (error) {
        console.error("Error updating documents:", error);
        res.status(500).json({ message: "Error updating documents" });
    } 
}

//Update address
const updateAddress = async(req,res) => {
  try {
  const patientId = getPatientId(req);
        const patient = await Patient.findById(patientId);
        if (!patient) {
            return res.status(404).json({ message: "Patient not found" });
        }
        const addressFields = [
            "addressType",
            "region",
            "district",
            "city",
            "settlement",
            "street",
            "house",
            "terrain",
            "apartment",
            "postcode"
        ];
        addressFields.forEach(field => {
            if (req.body[field] !== undefined) {
                patient[field] = req.body[field];
            }
        });
        await patient.save();
        res.status(200).json({ message: "Address updated successfully", data: patient });
    }
    catch (error) {
        console.error("Error updating address:", error);
        res.status(500).json({ message: "Error updating address" });
    }
}

//Update Disease Information
const updateDiseaseInfo = async (req, res) => {
  try {
  const patientId = getPatientId(req);
        const patient = await
            Patient.findById(patientId);
        if (!patient) {
            return res.status(404).json({ message: "Patient not found" });
        }
        // Accept full array replacement: { diseases: [...] }
        if (Array.isArray(req.body.diseases)) {
            patient.diseases = req.body.diseases;
        } else {
            // Legacy: flat fields update first entry
            const diseaseFields = ["startDate", "endDate", "diagnosis", "icdCode", "doctor"];
            diseaseFields.forEach(field => {
                if (req.body[field] !== undefined) {
                    patient.diseases = patient.diseases || [];
                    if (patient.diseases.length === 0) {
                        patient.diseases.push({});
                    }
                    patient.diseases[0][field] = req.body[field];
                }
            });
        }
        await patient.save();
        res.status(200).json({ message: "Disease information updated successfully", data: patient });
    }
    catch (error) {
        console.error("Error updating disease information:", error);
        res.status(500).json({ message: "Error updating disease information" });
    }
}

// Update Recording sheet of final diagnosis
const updateFinalDiagnosis = async(req,res)=>{
  try {
  const patientId = getPatientId(req);
        const patient = await Patient.findById(patientId);
        if (!patient) {
            return res.status(404).json({ message: "Patient not found" });
        }
        // Accept full array replacement: { finalDiagnoses: [...] }
        if (Array.isArray(req.body.finalDiagnoses)) {
            patient.finalDiagnoses = req.body.finalDiagnoses;
        } else {
            // Legacy: flat fields update first entry
            const finalDiagnosisFields = ["date", "diagnosis", "icdCode", "primary", "doctorName", "jobTitle", "speciality"];
            finalDiagnosisFields.forEach(field => {
                if (req.body[field] !== undefined) {
                    patient.finalDiagnoses = patient.finalDiagnoses || [];
                    if (patient.finalDiagnoses.length === 0) {
                        patient.finalDiagnoses.push({});
                    }
                    patient.finalDiagnoses[0][field] = req.body[field];
                }
            });
        }
        await patient.save();
        res.status(200).json({ message: "Final diagnosis updated successfully", data: patient });
    }
    catch (error) {
        console.error("Error updating final diagnosis:", error);
        res.status(500).json({ message: "Error updating final diagnosis" });
    }
}

// Update Personal Data
const updatePersonalData = async(req,res)=> {
  try {
  const patientId = getPatientId(req);
        const patient = await Patient.findById(patientId);
        if (!patient) {
            return res.status(404).json({ message: "Patient not found" });
        }
        const personalDataFields = [
            "maritalStatus",
            "education",
            "employment",
            "placeOfWork",
            "workSpecialty",
            "changePlaceOfWork",
            "changeOfPosition"
        ];
        personalDataFields.forEach(field => {
            if (req.body[field] !== undefined) {
                patient[field] = req.body[field];
            }
        });
        await patient.save();
        res.status(200).json({ message: "Personal data updated successfully", data: patient });
    }
    catch (error) {
        console.error("Error updating personal data:", error);
        res.status(500).json({ message: "Error updating personal data" });
    }
}

//Update Disability
const updateDisability = async(req,res) => {
  try {
  const patientId = getPatientId(req);
        const patient = await Patient.findById(patientId);
        if (!patient) {
            return res.status(404).json({ message: "Patient not found" });
        }
        const disabilityFields = [
            "disability",
            "disabilityFrom",
            "disabilityTo",
            "disabilityIndefinitely",
            "invalidGroup",
            "disabilityType",
            "disabilityPrimaryRepeated"
        ];
        disabilityFields.forEach(field => {
            if (req.body[field] !== undefined) {
                patient[field] = req.body[field];
            }
        });
        await patient.save();
        res.status(200).json({ message: "Disability information updated successfully", data: patient });
    }
    catch (error) {
        console.error("Error updating disability information:", error);
        res.status(500).json({ message: "Error updating disability information" });
    }
};

// Update Anamnesis
const updateAnamnesis = async(req,res) => {
  try {
  const patientId = getPatientId(req);
        const patient = await Patient.findById(patientId);
        if (!patient) {
            return res.status(404).json({ message: "Patient not found" });
        }
        const anamnesisFields = [
            "anamnesisDisability",
            "bloodGroup",
            "rhFactor",
            "kellAntigen",
            "otherBloodInfo",
            "allergies"
        ];
        anamnesisFields.forEach(field => {
            if (req.body[field] !== undefined) {
                patient[field] = req.body[field];
            }
        }
        );
        await patient.save();
        res.status(200).json({ message: "Anamnesis updated successfully", data: patient });
    }
    catch (error) {
        console.error("Error updating anamnesis:", error);
        res.status(500).json({ message: "Error updating anamnesis" });
    }
}

//Update Radiation Doses
const updateRadiationDoses = async(req,res)=> {
  try {
  const patientId = getPatientId(req);
        const patient = await Patient.findById(patientId);
        if (!patient) {
            return res.status(404).json({ message: "Patient not found" });
        }
        // Accept full array replacement: { radiationDoses: [...] }
        if (Array.isArray(req.body.radiationDoses)) {
            patient.radiationDoses = req.body.radiationDoses;
        } else {
            // Legacy: flat fields update first entry
            const radiationDoseFields = ["date", "researchType", "effectiveDose", "note"];
            radiationDoseFields.forEach(field => {
                if (req.body[field] !== undefined) {
                    patient.radiationDoses = patient.radiationDoses || [];
                    if (patient.radiationDoses.length === 0) {
                        patient.radiationDoses.push({});
                    }
                    patient.radiationDoses[0][field] = req.body[field];
                }
            });
        }
        await patient.save();
        res.status(200).json({ message: "Radiation doses updated successfully", data: patient });
    }
    catch (error) {
        console.error("Error updating radiation doses:", error);
        res.status(500).json({ message: "Error updating radiation doses" });
    }
}

// Update a patient
const updatePatient = async (req, res) => {
  try {
        const { id } = req.params;
        const { email, firstName, middleName, lastName, dateOfBirth, gender, notes } = req.body;
        const updatedPatient = await Patient.findByIdAndUpdate(
            id,
            {
                email,
                firstName,
                middleName,
                lastName,
                dateOfBirth,
                gender,
                notes
            },
            { new: true }
        );

        if (!updatedPatient) {
            return res.status(404).json({ message: "Patient not found" });
        }

        res.status(200).json({ message: "Patient updated successfully", patient: updatedPatient });
     } catch (error) {
        console.log("Error updating patient:", error);
        res.status(500).json({ message: "Error updating patient" });
     }
};

// Patch a patient – partial update for GeneralInformationTab fields
const patchPatient = async (req, res) => {
  try {
    const patient = await Patient.findOne({ patientId: req.params.id });
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

    const updated = await Patient.findOneAndUpdate(
      { patientId: req.params.id },
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
    const patient = await Patient.findById(req.params.patientId);
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
    const patient = await Patient.findById(req.params.patientId);
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

//----- Assistant related function -----------//
const getAssistantpatients = async(req,res)=>{
    const { assistantEmail, page = 1, limit = 20, search = '' } = req.query;

  if (!assistantEmail) {
    return res.status(400).json({ error: 'assistantEmail query parameter is required' });
  }

  try {
    const assistantModel = req.user.role === 'head_assistant' ? HeadAssistant : Assistant;
    const assistant = await assistantModel.findOne({ email: assistantEmail.toLowerCase().trim() });
    if (!assistant) {
      return res.status(404).json({ error: 'Assistant not found' });
    }

    const nowMSK = moment().tz('Europe/Moscow');

    const activeDoctorEmails = (assistant.doctors || [])
      .filter((doc) => {
        const start = moment(doc.startDateTime);
        const end = moment(doc.endDateTime);
        return nowMSK.isBetween(start, end);
      })
      .map((doc) => doc.doctorEmail?.toLowerCase().trim())
      .filter(Boolean);

    if (activeDoctorEmails.length === 0) {
      return res.json([]);
    }

    const applications = await Application.find({
      'doctors.doctorEmail': { $in: activeDoctorEmails },
      appointmentStatus: { $ne: 'Unconfirmed' },
    });

    const patientEmails = [
      ...new Set(
        applications
          .map((app) => app.patientEmail?.toLowerCase().trim())
          .filter((email) => !!email)
      ),
    ];

    if (patientEmails.length === 0) {
      return res.json([]);
    }

    let patients = await Patient.find({ email: { $in: patientEmails } });

    if (search.trim()) {
      const term = search.toLowerCase();
      patients = patients.filter(
        (p) =>
          p.firstName?.toLowerCase().includes(term) ||
          p.lastName?.toLowerCase().includes(term) ||
          p.email?.toLowerCase().includes(term)
      );
    }

    const latestByPatient = {};
    applications.forEach((app) => {
      const email = app.patientEmail?.toLowerCase().trim();
      if (!email) return;
      const current = latestByPatient[email];
      const currentDate = new Date(current?.date || 0);
      const newDate = new Date(app.date);
      if (!current || newDate > currentDate) {
        latestByPatient[email] = app;
      }
    });

    const enriched = patients.map((patient) => {
      const p = patient.toObject();
      const email = (p.email || '').toLowerCase().trim();
      const app = latestByPatient[email];
      const mergedAppInfo = app
        ? {
            applicationId: app.applicationId,
            serviceType: app.serviceType,
            date: app.date,
            startTime: app.startTime,
            endTime: app.endTime,
            appointmentMode: app.appointmentMode,
            appointmentStatus: app.appointmentStatus,
          }
        : {};
      return {
        email: p.email,
        firstName: p.firstName,
        middleName: p.middleName,
        lastName: p.lastName,
        gender: p.gender,
        dateOfBirth: p.dateOfBirth,
        telephone: p.telephone,
        additionalPhone: p.additionalPhone,
        ...mergedAppInfo,
      };
    });

    const start = (parseInt(page) - 1) * parseInt(limit);
    const paginated = enriched.slice(start, start + parseInt(limit));

    res.status(200).json(paginated);
  } catch (error) {
    console.error('Error fetching assistant patients:', error);
    res.status(500).json({ error: 'Internal Server Error', detail: error.message });
  }
}

const getAssistantAllPatients = async (req, res) => {
  try {
    const patients = await Patient.find({}, 'firstName middleName lastName email');
    const formattedPatients = patients.map((patient) => {
      let fullName = patient.firstName;
      if (patient.middleName) fullName += ` ${patient.middleName}`;
      fullName += ` ${patient.lastName}`;
      return { id: patient._id, name: fullName, email: patient.email };
    });
    res.json(formattedPatients);
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ message: 'Error fetching patients' });
  }
}

const createPatient = async (req, res) => {
  try {
    const { firstName, middleName, lastName, email, phoneNumber, gender, dateOfBirth } = req.body;

    if (!firstName || !lastName || !email || !phoneNumber || !gender || !dateOfBirth) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const randomPassword = Math.random().toString(36).slice(-8);

    try {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({ message: 'User with this email already exists' });
      }

      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(randomPassword, saltRounds);

      const newUser = new User({
        email,
        password: hashedPassword,
        role: 'patient',
        isProfileCompleted: true,
      });
      const savedUser = await newUser.save();

      const newPatient = new Patient({
        firstName,
        middleName: middleName || '',
        lastName,
        email,
        phoneNumber,
        gender,
        dateOfBirth,
        user: savedUser._id,
        profileCompleted: true,
      });
      const savedPatient = await newPatient.save();

      let fullName = savedPatient.firstName;
      if (savedPatient.middleName) fullName += ` ${savedPatient.middleName}`;
      fullName += ` ${savedPatient.lastName}`;

      res.status(201).json({
        id: savedPatient._id,
        name: fullName,
        email: savedPatient.email,
        tempPassword: randomPassword,
      });
    } catch (error) {
      if (email) await User.findOneAndDelete({ email });
      throw error;
    }
  } catch (error) {
    console.error('Error creating patient:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    if (error.response?.status === 409) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }
    res.status(500).json({ message: 'Error creating patient' });
  }
}

module.exports = {
  getAllPatients,
  getPatientById,
  getPatientByEmail,
  getPatientByPatientId,
  addPatient,
  createLegalRepresentative,
  updateLegalRepresentative,
  updateContact,
  updateDocument,
  updateAddress,
  updateDiseaseInfo,
  updateFinalDiagnosis,
  updatePersonalData,
  updateDisability,
  updateAnamnesis,
  updateRadiationDoses,
  updatePatient,
  patchPatient,
  deletePatient,
  sendEmail,
  getAssistantpatients,
  getAssistantAllPatients,
  createPatient
};
