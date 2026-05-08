const express = require("express");
const multer = require("multer");
const { body } = require("express-validator");
const auth = require("../middleware/auth");
const router = express.Router();

const {
  createAssistant,
  getAssistantsList,
  getAllAssistants,
  getAssistantById,
  updateAssistant,
  deleteAssistant,
  assignDoctor,
  removeDoctorAssignment,
  getAssistantsByDoctor,
  getAssistantByEmail,
  getProfileImage,
  grantAccess,
  revokeAccess,
  updateAccessTime,
  getMe,
  updateMe,
  uploadProfileImage,
  getImageById,
  getAssistantDoctors,
  createAccessRequest,
  grantAssistantAccess,
  createAvailability,
  getAvailability,
  deleteAvailability,
  getAssistants,
} = require("../controllers/assistantController");
const { assistantSignIn } = require("../controllers/authController");

// Middleware: check if user is head assistant
const headAssistantOnly = (req, res, next) => {
  if (req.user?.role !== "head_assistant") {
    return res.status(403).json({ message: "Access denied. Head assistant only." });
  }
  next();
};

// Configure multer with memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file) {
      return cb(null, false);
    }
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype) {
      return cb(null, true);
    }
    cb(new Error("Only JPEG/JPG/PNG images are allowed"));
  },
}).single("profileImage");

// Validation rules for create/update
const assistantValidation = [
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

// Assistant sign-in route
router.post("/assistant-signin", assistantSignIn);

router.get('/me', auth, getMe);
router.put('/me', auth, updateMe);
router.post('/upload/profile-image', auth, upload, uploadProfileImage);
router.get('/image-by-id/:id', auth, getImageById);
router.get('/doctors', auth, getAssistantDoctors);
router.post('/access-requests', auth, createAccessRequest);
router.post('/grant-assistant-access', auth, headAssistantOnly, grantAssistantAccess);
router.post('/availability', auth, createAvailability);
router.get('/availability', auth, getAvailability);
router.delete('/availability/:id', auth, deleteAvailability);
router.get('/getAssistants', auth, getAssistants);

// Create assistant
router.post("/", [auth, upload, ...assistantValidation], createAssistant);

// Get all assistants (optionally filtered by branch name)
router.get("/", auth, getAllAssistants);

// Get assistant by email
router.get("/by-email/:email", auth, getAssistantByEmail);

// Get profile image by file ID
router.get("/profile-image/:fileId", auth, getProfileImage);

// Get assistants assigned to a doctor
router.get("/doctors/:doctorEmail/assistants", auth, getAssistantsByDoctor);

// Assign doctor to assistant
router.post(
  "/assign-doctor",
  [
    auth,
    body("assistantEmail").isEmail().withMessage("Invalid assistant email"),
    body("doctorEmail").isEmail().withMessage("Invalid doctor email"),
    body("startDateTime")
      .isISO8601()
      .toDate()
      .withMessage("Invalid start date-time"),
    body("endDateTime")
      .isISO8601()
      .toDate()
      .withMessage("Invalid end date-time"),
  ],
  assignDoctor,
);

// Grant access
router.patch("/grant-access", auth, grantAccess);

// Revoke access
router.patch("/revoke-access", auth, revokeAccess);

// Update access time
router.patch("/update-access-time", auth, updateAccessTime);

// Get assistant by ID
router.get("/:id", auth, getAssistantById);

// Update assistant
router.put("/:id", [auth, upload, ...assistantValidation], updateAssistant);

// Delete assistant
router.delete("/:id", auth, deleteAssistant);

// Remove doctor assignment from assistant
router.delete("/:id/assign-doctor/:doctorEmail", auth, removeDoctorAssignment);

module.exports = router;
