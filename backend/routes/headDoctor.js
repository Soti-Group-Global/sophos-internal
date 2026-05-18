const express = require("express");
const multer = require("multer");
const auth = require("../middleware/auth");
const validateUpload = require("../middleware/validateUpload");
const router = express.Router();

const MANAGER_ROLES = ['manager', 'head_manager', 'super_admin'];
const requireManagerRole = (req, res, next) => {
  if (!MANAGER_ROLES.includes(req.user?.role)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
};

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
router.post("/", [auth, upload], validateUpload(["image"]), createHeadDoctor);

// Get all HeadDoctors (optionally filtered by branch name)
router.get("/", auth, getAllHeadDoctors);

// Get HeadDoctor by email
router.get("/by-email/:email", auth, getHeadDoctorByEmail);

// Get by ID
router.get("/:id", auth, getHeadDoctorById);

// Get fees by ID
router.get("/:id/fees", auth, getHeadDoctorFees);

// Update HeadDoctor
router.put("/:id", [auth, upload], validateUpload(["image"]), updateHeadDoctor);

// Delete HeadDoctor (manager-level only)
router.delete("/:id", auth, requireManagerRole, deleteHeadDoctor);

module.exports = router;
