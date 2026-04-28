const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { getTemplates, createTemplate, updateTemplate, deleteTemplate } = require("../controllers/earlyDetectionTemplateController");

router.get("/", auth, getTemplates);
router.post("/", auth, createTemplate);
router.put("/:id", auth, updateTemplate);
router.delete("/:id", auth, deleteTemplate);

module.exports = router;
