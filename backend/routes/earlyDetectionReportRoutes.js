const express = require("express");
const router = express.Router();
const { getReport, saveReport } = require("../controllers/earlyDetectionReportController");

// GET /api/early-detection/report/:bookingId
router.get("/:bookingId", getReport);

// PUT /api/early-detection/report/:bookingId
router.put("/:bookingId", saveReport);

module.exports = router;
