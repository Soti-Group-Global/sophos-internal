const express = require("express");
const multer = require("multer");
const router = express.Router();

const auth = require("../middleware/auth");
const {
  createSpecialist,
  getAllSpecialists,
  getSpecialistById,
  getSpecialistByEmail,
  getSpecialistFees,
  updateSpecialist,
  deleteSpecialist,
} = require("../controllers/specialistController");

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
router.post("/", [auth, upload], createSpecialist);

// Get all Specialists (optionally filtered by branch name)
router.get("/", auth, getAllSpecialists);

// Get Specialist by Email
router.get("/by-email/:email", auth, getSpecialistByEmail);

// Get Specialist Fees
router.get("/:id/fees", auth, getSpecialistFees);

// Get Specialist by ID
router.get("/:id", auth, getSpecialistById);

// Update Specialist
router.put("/:id", [auth, upload], updateSpecialist);

// Delete Specialist
router.delete("/:id", auth, deleteSpecialist);

module.exports = router;
