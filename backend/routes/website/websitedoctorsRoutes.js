const express = require("express");
const router = express.Router();
const {
  getWebsiteDoctors,
  getWebsiteSpecializations,
  getWebsiteDoctorById,
  getWebsiteDoctorBySlug,
  getWebsiteDoctorStats,
  getSearchSuggestions,
  getDoctorProfileImage,
  serveDoctorProfileImageFile
} = require("../../controllers/website/websitedoctorsController");

// @route   GET /api/website/doctors
// @desc    Get all doctors with filtering and pagination for website
// @access  Public
router.get("/", getWebsiteDoctors);

// @route   GET /api/website/doctors/specializations
// @desc    Get all unique specializations for website
// @access  Public
router.get("/specializations", getWebsiteSpecializations);

// @route   GET /api/website/doctors/stats/summary
// @desc    Get website doctor statistics
// @access  Public
router.get("/stats/summary", getWebsiteDoctorStats);

// @route   GET /api/website/doctors/search/suggestions
// @desc    Get search suggestions for doctors
// @access  Public
router.get("/search/suggestions", getSearchSuggestions);

// @route   GET /api/website/doctors/profile-image/:fileId
// @desc    Serve doctor profile image directly as file (for SEO)
// @access  Public
router.get("/profile-image/:fileId", serveDoctorProfileImageFile);

// @route   GET /api/website/doctors/image/:fileId
// @desc    Get doctor profile image by fileId (JSON with base64)
// @access  Public
router.get("/image/:fileId", getDoctorProfileImage);

// @route   GET /api/website/doctors/slug/:slug
// @desc    Get single doctor by slug for website
// @access  Public
router.get("/slug/:slug", getWebsiteDoctorBySlug);

// @route   GET /api/website/doctors/:id
// @desc    Get single doctor by ID for website
// @access  Public
router.get("/:id", getWebsiteDoctorById);

module.exports = router;