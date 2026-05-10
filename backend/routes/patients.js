const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const multer = require('multer');
const patientController = require('../controllers/patientController');

// Configure multer with memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (!file) {
      return cb(null, false); // Allow no file
    }
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only JPEG/JPG/PNG images are allowed'));
  },
}).single('profileImage');

// Get all patients (with optional doctorEmail query)
router.get('/', auth, patientController.getAllPatients);

// Get a single patient by email (specific routes first to avoid being shadowed by `/:id`)
router.get('/by-email/:email', auth, patientController.getPatientByEmail);
// Get a single patient by custom patientId field
router.get('/by-patient-id/:patientId', auth, patientController.getPatientByPatientId);
// Older frontend callers expect `/patients/email/:email` — support that path too
router.get('/email/:email', auth, patientController.getPatientByEmail);

// Assistant-specific patient endpoints
// Get patients accessible to a particular assistant (query: assistantEmail, page, limit, search)
router.get('/assistant', auth, patientController.getAssistantpatients);
// Get a simple list of all patients (id, name, email) for assistant selection
router.get('/assistant/all', auth, patientController.getAssistantAllPatients);
// Quick create patient endpoint used by assistants (returns temp password)
router.post('/assistant/create', auth, patientController.createPatient);
// Get a single patient by ID
router.get('/:id', auth, patientController.getPatientById);

// Add a new patient
router.post(
  '/',
  [
    auth,
    upload,
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('gender').isIn(['Male', 'Female', 'Other']).withMessage('Invalid gender'),
    body('dateOfBirth').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Invalid date format. Use YYYY-MM-DD.'),
    body('email').isEmail().withMessage('Invalid email'),
    body('phoneNumber').trim().notEmpty().withMessage('Phone number is required'),
  ],
  patientController.addPatient
);

// Update a patient
router.put(
  '/:id',
  [
    auth,
    upload,
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('gender').isIn(['Male', 'Female', 'Other']).withMessage('Invalid gender'),
    body('dateOfBirth').isISO8601().withMessage('Invalid date format. Must be YYYY-MM-DD or ISO 8601'),
  ],
  patientController.updatePatient
);

// Create a legal representative for a patient
router.post('/:id/legal-representative', auth, patientController.createLegalRepresentative);

// Update (or create via special id) a legal representative
router.put('/:id/legal-representative/:legalRepId', auth, patientController.updateLegalRepresentative);

// Update contact fields for a patient
router.put('/:id/contact-person', auth, patientController.updateContact);

// Update document fields for a patient
router.put('/:id/documents', auth, patientController.updateDocument);

// Update address for a patient
router.put('/:id/address', auth, patientController.updateAddress);

// Update diseases array (replace or partial) for a patient
router.put('/:id/disease-info', auth, patientController.updateDiseaseInfo);

// Update final diagnoses array for a patient
router.put('/:id/final-diagnosis', auth, patientController.updateFinalDiagnosis);

// Update personal data fields for a patient
router.put('/:id/personal-data', auth, patientController.updatePersonalData);

// Update disability fields for a patient
router.put('/:id/disability', auth, patientController.updateDisability);

// Update anamnesis fields for a patient
router.put('/:id/anamnesis', auth, patientController.updateAnamnesis);

// Update radiation doses array for a patient
router.put('/:id/radiation-doses', auth, patientController.updateRadiationDoses);

// Patch a patient – partial update for GeneralInformationTab fields
router.patch('/:id', auth, patientController.patchPatient);

// Delete a patient
router.delete('/:id', auth, patientController.deletePatient);

// Send email to patient
router.post(
  '/:id/emails/send',
  [
    auth,
    body('to').isEmail().withMessage('Invalid email address'),
    body('subject').trim().notEmpty().withMessage('Subject is required'),
    body('body').trim().notEmpty().withMessage('Email body is required'),
  ],
  patientController.sendEmail
);

module.exports = router;
