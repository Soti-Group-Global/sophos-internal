const express = require("express");
const multer = require("multer");
const router = express.Router();
const auth = require("../middleware/auth");
const upload = multer({ storage: multer.memoryStorage() });
const {
  getAllLaboratoryTests,
  getLaboratoryTestById,
  createLaboratoryTest,
  updateLaboratoryTest,
  deleteLaboratoryTest,
  uploadLaboratoryTestFile,
  getLaboratoryTestFile,
  removeLaboratoryTestFile,
  addLaboratoryTestNote,
  updateLaboratoryTestNote,
  removeLaboratoryTestNote,
} = require("../controllers/PatientTestController");

router.get("/",    auth, getAllLaboratoryTests);
router.post("/",   auth, createLaboratoryTest);
router.get("/:id", auth, getLaboratoryTestById);
router.put("/:id", auth, updateLaboratoryTest);
router.delete("/:id", auth, deleteLaboratoryTest);

// files — patientId in body (upload) or query (get/delete)
router.post("/:id/upload-file",    auth, upload.single("file"), uploadLaboratoryTestFile);
router.get("/:id/file/:fileId",    auth, getLaboratoryTestFile);
router.delete("/:id/file/:fileId", auth, removeLaboratoryTestFile);
router.delete("/:id/file",         auth, removeLaboratoryTestFile);

// notes — patientId in body (add/update) or query (delete)
router.patch("/:id/note",          auth, addLaboratoryTestNote);
router.patch("/:id/note/:noteId",  auth, updateLaboratoryTestNote);
router.delete("/:id/note/:noteId", auth, removeLaboratoryTestNote);
router.delete("/:id/note",         auth, removeLaboratoryTestNote);

module.exports = router;
