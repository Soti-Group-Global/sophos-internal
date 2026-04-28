const express = require("express");
const router = express.Router();
const serviceController = require("../controllers/serviceController");
const multer = require("multer");

// Multer configuration for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/", serviceController.createService);
router.get("/", serviceController.getAllServices);
router.get("/names", serviceController.getServiceNames);
router.get("/:id", serviceController.getServiceById);
router.put("/:id", serviceController.updateService);
router.delete("/:id", serviceController.deleteService);

// File upload and retrieval
router.post("/upload", upload.single("file"), serviceController.uploadFile);
router.get("/file/:fileId", serviceController.getFile);

module.exports = router;
