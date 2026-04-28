const express = require('express');
const multer = require('multer');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const {
  createHeadAssistant,
  getAllHeadAssistants,
  getHeadAssistantById,
  updateHeadAssistant,
  deleteHeadAssistant,
  assignDoctor,
  getHeadAssistantByEmail,
  getAvailability,
  createAvailability,
  deleteAvailability,
  bulkUpdateAvailability,
} = require('../controllers/headAssistantController');

const router = express.Router();

/** Multer Config **/
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file) return cb(null, false);
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype) return cb(null, true);
    cb(new Error('Only JPEG/JPG/PNG images are allowed'));
  },
}).single('profileImage');

/** Validation rules **/
const createValidation = [
  body("email").isEmail().normalizeEmail(),
  body("phoneNumber")
    .matches(/^\+?\d{10,15}$/)
    .withMessage("Invalid phone number format"),
  body("firstName").trim().notEmpty().withMessage("First name is required"),
  body("lastName").trim().notEmpty().withMessage("Last name is required"),
  body("dateOfBirth").optional().isISO8601().toDate(),
  body("gender").optional().isIn(["Male", "Female", "Other"]),
];

const updateValidation = [
  body("email").isEmail().normalizeEmail(),
  body("phoneNumber")
    .matches(/^\+?\d{10,15}$/)
    .withMessage("Invalid phone number format"),
  body("firstName").trim().notEmpty().withMessage("First name is required"),
  body("lastName").trim().notEmpty().withMessage("Last name is required"),
  body("dateOfBirth")
    .optional()
    .isISO8601()
    .toDate()
    .withMessage("Invalid date of birth"),
  body("gender")
    .optional()
    .isIn(["Male", "Female", "Other"])
    .withMessage("Invalid gender"),
];

const assignDoctorValidation = [
  body('doctorEmail').isEmail(),
  body('startDateTime').isISO8601().toDate(),
  body('endDateTime').isISO8601().toDate(),
];

// Create HeadAssistant
router.post("/", [auth, upload, ...createValidation], createHeadAssistant);

// Get all Head Assistants (optionally filtered by branch name)
router.get("/", auth, getAllHeadAssistants);

// Get head assistant by email (must be before /:id)
router.get("/email/:email", getHeadAssistantByEmail);

// Get head assistant availability
router.get("/availability/:email", getAvailability);

// Create head assistant availability
router.post("/availability/:email", createAvailability);

// Bulk update head assistant availability
router.post("/availability/:email/bulk", bulkUpdateAvailability);

// Delete head assistant availability
router.delete("/availability/:id", deleteAvailability);

// Get by ID
router.get('/:id', auth, getHeadAssistantById);

// Update HeadAssistant
router.put("/:id", [auth, upload, ...updateValidation], updateHeadAssistant);

// Delete HeadAssistant
router.delete('/:id', auth, deleteHeadAssistant);

// Assign doctor
router.post('/:id/assign-doctor', [auth, ...assignDoctorValidation], assignDoctor);


module.exports = router;
