const express = require("express");
const router = express.Router();
const serviceController = require("../controllers/serviceController");
const multer = require("multer");
const validateUpload = require("../middleware/validateUpload");
const auth = require("../middleware/auth");

// Multer configuration for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/", auth, serviceController.createService);
router.get("/", serviceController.getAllServices);
router.get("/names", serviceController.getServiceNames);
router.get("/:id", serviceController.getServiceById);
router.put("/:id", auth, serviceController.updateService);
router.delete("/:id", auth, serviceController.deleteService);

// File upload and retrieval
router.post("/upload", auth, upload.single("file"), validateUpload(["image", "pdf", "doc"]), serviceController.uploadFile);
router.get("/file/:fileId", serviceController.getFile);

module.exports = router;
