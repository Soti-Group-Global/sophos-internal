const express = require("express");
const router = express.Router();
const {
  getApplicationSummary,
  getApplicationRevenueTrend,
  getApplicationDoctorPerformance,
  getApplicationVerificationStats,
  getApplicationSpecialtyStats,
  getApplicationServiceGrowth,
} = require("../controllers/applicationAnalyticsController");

// Super Admin Analytics Routes for Applications
router.get("/summary", getApplicationSummary);
router.get("/revenue-trend", getApplicationRevenueTrend);
router.get("/doctor-performance", getApplicationDoctorPerformance);
router.get("/verification-stats", getApplicationVerificationStats);
router.get("/specialties", getApplicationSpecialtyStats);
router.get("/service-growth", getApplicationServiceGrowth);

module.exports = router;
