const {
  submitPatientCooridnationForms,
  getPatientCooridnationForms,
  updatePatientCooridnationForm,
  deletePatientCooridnationForm,
} = require("../../controllers/website/patientCoordinationFormController");
const express = require("express");
const router = express.Router();

router.post("/", submitPatientCooridnationForms);
router.get("/", getPatientCooridnationForms);
router.put("/:id", updatePatientCooridnationForm);
router.delete("/:id", deletePatientCooridnationForm);

module.exports = router;
