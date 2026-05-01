const express = require("express");
const multer = require("multer");
const router = express.Router();

const auth = require("../middleware/auth");
const { doctorSignIn } = require("../controllers/authController");
const {
  createDoctor,
  getDoctors,
  getAllDoctors,
  getDoctorById,
  getDoctorFees,
  updateDoctor,
  deleteDoctor,
  getDoctorByEmail,
  getDoctorBreaks,
  createOrUpdateMyBreaks,
  updateMyBreakById,
  deleteMyBreakById,
  getMe,
  getMyBreaks,
  getDoctorBranchesList,
  getDoctorsForAssistant,
  getMessage,
  deleteMessage,
  uploadMessageFile,
  getDoctorsLite,
  getAllDoctorsForMessages,
} = require("../controllers/doctorController");

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

// Doctor CRUD routes
router.post("/doctor-signin", doctorSignIn);
router.get("/me", auth, getMe);
router.get("/doctor-breaks", auth, getMyBreaks);
router.post("/doctor-breaks", auth, createOrUpdateMyBreaks);
router.put("/doctor-breaks/:breakId", auth, updateMyBreakById);
router.delete("/doctor-breaks/:breakId", auth, deleteMyBreakById);
router.get("/branches", auth, getDoctorBranchesList);

// Specific GET routes (before /:id pattern)
router.get("/all", auth, getAllDoctors);
router.get("/lite", auth, getDoctorsLite);
router.get("/by-email/:email", auth, getDoctorByEmail);
router.get("/for-assistant/:assistantEmail", auth, getDoctorsForAssistant);
router.get("/messages/allDoctors", auth, getAllDoctorsForMessages);
router.post("/messages/upload", auth, upload, uploadMessageFile);
router.delete("/messages/:messageId", auth, deleteMessage);
router.get("/messages", auth, getMessage);

// Generic CRUD routes
router.post("/", [auth, upload], createDoctor);
router.get("/", auth, getDoctors);
router.get("/:id", auth, getDoctorById);
router.get("/:id/fees", auth, getDoctorFees);
router.put("/:id", [auth, upload], updateDoctor);
router.delete("/:id", auth, deleteDoctor);

// Doctor breaks routes
router.get("/breaks/:doctorEmail/:date", auth, getDoctorBreaks);
router.post("/breaks", auth, createOrUpdateMyBreaks);
router.delete("/breaks/:doctorEmail/:date", auth, deleteMyBreakById);

module.exports = router;
