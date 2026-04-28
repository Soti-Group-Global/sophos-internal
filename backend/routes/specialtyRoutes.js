const express = require("express");
const router = express.Router();
const specialtyController = require("../controllers/specialtyController");

// ======================= SPECIALTY ROUTES =======================
router.get("/specialties", specialtyController.getAllSpecialties);
router.get("/specialties/:id", specialtyController.getSpecialtyById);
router.post("/specialties", specialtyController.createSpecialty);
router.put("/specialties/:id", specialtyController.updateSpecialty);
router.delete("/specialties/:id", specialtyController.deleteSpecialty);

// ======================= SUB-SPECIALITY ROUTES =======================
router.get("/sub-specialities", specialtyController.getAllSubSpecialities);
router.get("/sub-specialities/:id", specialtyController.getSubSpecialityById);
router.post("/sub-specialities", specialtyController.createSubSpeciality);
router.put("/sub-specialities/:id", specialtyController.updateSubSpeciality);
router.delete("/sub-specialities/:id", specialtyController.deleteSubSpeciality);

module.exports = router;
