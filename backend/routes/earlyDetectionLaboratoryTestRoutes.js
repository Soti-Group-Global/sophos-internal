const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const {
  createEarlyDetectionLaboratoryTest,
  getEarlyDetectionLaboratoryTests,
  getEarlyDetectionLaboratoryTestById,
  updateEarlyDetectionLaboratoryTest,
  deleteEarlyDetectionLaboratoryTest
} = require("../controllers/EarlyDetectionLaboratoryTestController");

router.post("/", createEarlyDetectionLaboratoryTest);
router.get("/", getEarlyDetectionLaboratoryTests);
router.get("/:id", getEarlyDetectionLaboratoryTestById);
router.put("/:id", updateEarlyDetectionLaboratoryTest);
router.delete("/:id", deleteEarlyDetectionLaboratoryTest);

module.exports = router;