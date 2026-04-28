const express = require("express");
const router = express.Router();
const {
  getAllDoctors,
  getDoctorsProfileData,
  getEarlyDetectionDoctors,
  getDoctorById,
  getDoctorByEmail,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  addReview,
  getDoctorsBySpecialty,
  getFeaturedDoctors,
  getDoctorProfileImage,
  getDoctorsMinimal,
  getDoctorServices,
  sendDoctorCredentials,
  checkDoctorHasAccount,
  testDoctorCredentialsEmail,
  updateDoctorsOrder,
} = require("../controllers/doctorsProfileController");
const multer = require("multer");
const { getGfs } = require("../gridfs");

/** Multer config for doctor profile images */
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (!file) return cb(null, false);
    const filetypes = /jpeg|jpg|png/;
    if (filetypes.test(file.mimetype)) return cb(null, true);
    cb(new Error("Only JPEG/JPG/PNG images are allowed"));
  },
}).single("profileImage");

// Public routes
router.get("/", getAllDoctors);
router.get("/minimal", getDoctorsMinimal);
router.get("/get-doctors", getDoctorsProfileData);
router.get("/early-detection", getEarlyDetectionDoctors);
router.get("/check-account/:email", checkDoctorHasAccount);
router.get("/featured", getFeaturedDoctors);
router.get("/specialty/:specialty", getDoctorsBySpecialty);

// Test email route (must be before :id routes)
router.post("/test-email", testDoctorCredentialsEmail);

router.get("/:id", getDoctorById);
router.get("/:id/services", getDoctorServices);
router.get("/email/:email", getDoctorByEmail);
router.get("/by-email/:email", getDoctorByEmail);
router.post("/:id/reviews", addReview);

router.post("/", upload, createDoctor);
router.patch("/:id", upload, updateDoctor);
router.delete("/:id", deleteDoctor);
router.post("/:id/send-credentials", sendDoctorCredentials);
router.get("/image/:fileId", getDoctorProfileImage);

// Update doctors display order
router.post("/update-order", updateDoctorsOrder);

module.exports = router;
