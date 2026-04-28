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

// Get a single patient by ID
router.get('/:id', auth, patientController.getPatientById);

// Get a single patient by email
router.get('/by-email/:email', auth, patientController.getPatientByEmail);

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
    body('email').isEmail().withMessage('Invalid email'),
    body('phoneNumber').trim().notEmpty().withMessage('Phone number is required'),
  ],
  patientController.updatePatient
);

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
