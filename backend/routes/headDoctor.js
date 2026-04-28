const express = require("express");
const multer = require("multer");
const auth = require("../middleware/auth");
const router = express.Router();

const {
  createHeadDoctor,
  getAllHeadDoctors,
  getHeadDoctorById,
  getHeadDoctorFees,
  updateHeadDoctor,
  deleteHeadDoctor,
  getHeadDoctorByEmail,
} = require("../controllers/headDoctorController");

/** Multer config **/
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file) return cb(null, false);
    const filetypes = /jpeg|jpg|png/;
    if (filetypes.test(file.mimetype)) return cb(null, true);
    cb(new Error("Only JPEG/JPG/PNG images are allowed"));
  },
}).single("profileImage");

// Create Specialist
router.post("/", [auth, upload], createHeadDoctor);

// Get all HeadDoctors (optionally filtered by branch name)
router.get("/", auth, getAllHeadDoctors);

// Get HeadDoctor by email
router.get("/by-email/:email", auth, getHeadDoctorByEmail);

// Get by ID
router.get("/:id", auth, getHeadDoctorById);

// Get fees by ID
router.get("/:id/fees", auth, getHeadDoctorFees);

// Update HeadDoctor
router.put("/:id", [auth, upload], updateHeadDoctor);

// Delete HeadDoctor
router.delete("/:id", auth, deleteHeadDoctor);

module.exports = router;
