const EarlyDetectionTemplate = require("../models/EarlyDetectionTemplate");

// GET /api/early-detection/templates
const getTemplates = async (req, res) => {
  try {
    const filter = {};
    if (req.query.fieldKey) filter.fieldKey = req.query.fieldKey.trim();
    const templates = await EarlyDetectionTemplate.find(filter).sort({ createdAt: -1 }).lean();
    res.json(templates);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch templates", error: err.message });
  }
};

// POST /api/early-detection/templates
const createTemplate = async (req, res) => {
  try {
    const { fieldKey, name, content } = req.body;
    if (!fieldKey || !name) return res.status(400).json({ message: "fieldKey and name are required" });
    const template = new EarlyDetectionTemplate({ fieldKey: fieldKey.trim(), name: name.trim(), content: content || "" });
    await template.save();
    res.status(201).json(template);
  } catch (err) {
    res.status(500).json({ message: "Failed to create template", error: err.message });
  }
};

// PUT /api/early-detection/templates/:id
const updateTemplate = async (req, res) => {
  try {
    const { name, content } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (content !== undefined) updates.content = content;
    const template = await EarlyDetectionTemplate.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!template) return res.status(404).json({ message: "Template not found" });
    res.json(template);
  } catch (err) {
    res.status(500).json({ message: "Failed to update template", error: err.message });
  }
};

// DELETE /api/early-detection/templates/:id
const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "Template ID is required" });
    const template = await EarlyDetectionTemplate.findByIdAndDelete(id);
    if (!template) return res.status(404).json({ message: "Template not found" });
    res.json({ message: "Template deleted", id: req.params.id });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete template", error: err.message });
  }
};

module.exports = { getTemplates, createTemplate, updateTemplate, deleteTemplate };
