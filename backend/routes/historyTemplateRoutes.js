const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} = require("../controllers/historyTemplateController");

// GET    /api/history-templates          → list (optional ?fieldKey=)
router.get("/", auth, getTemplates);

// POST   /api/history-templates          → create
router.post("/", auth, createTemplate);

// PUT    /api/history-templates/:id      → update
router.put("/:id", auth, updateTemplate);

// DELETE /api/history-templates/:id      → delete
router.delete("/:id", auth, deleteTemplate);

module.exports = router;
