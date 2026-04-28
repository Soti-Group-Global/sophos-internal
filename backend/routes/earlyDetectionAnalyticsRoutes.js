const express = require("express");
const router = express.Router();
const {
  getEarlyDetectionSummary,
  getEarlyDetectionRevenueTrend,
  getEarlyDetectionDoctorPerformance,
  getEarlyDetectionModeSplit,
  getEarlyDetectionVerificationStats,
  getEarlyDetectionServiceGrowth,
  getEarlyDetectionSpecialtyStats,
} = require("../controllers/earlyDetectionAnalyticsController");

// Super Admin Analytics Endpoints
router.get("/summary", getEarlyDetectionSummary);
router.get("/revenue-trend", getEarlyDetectionRevenueTrend);
router.get("/doctor-performance", getEarlyDetectionDoctorPerformance);
router.get("/mode-split", getEarlyDetectionModeSplit);
router.get("/verification-stats", getEarlyDetectionVerificationStats);
router.get("/service-growth", getEarlyDetectionServiceGrowth);
router.get("/specialties", getEarlyDetectionSpecialtyStats);

module.exports = router;
