const HistoryTemplate = require("../models/HistoryTemplate");

/* Helper: resolve the target doctor email.
   Admins / managers can pass ?doctorEmail=x or body.doctorEmail to operate on any doctor.
   Regular users are scoped to their own email. */
const resolveDocEmail = (req) => {
  const role = req.user.role;
  const isAdmin = ["super_admin", "manager", "head_doctor"].includes(role);
  if (isAdmin) {
    return (req.query.doctorEmail || req.body.doctorEmail || req.user.email).toLowerCase().trim();
  }
  return req.user.email;
};

/**
 * GET /api/history-templates
 * Returns all templates owned by the target doctor.
 * Optional query params: ?fieldKey=<key>  ?doctorEmail=<email> (admin only)
 */
const getTemplates = async (req, res) => {
  try {
    const doctorEmail = resolveDocEmail(req);
    const { fieldKey } = req.query;

    const doctorFilter  = { doctorEmail };
    const defaultFilter = { isDefault: true, doctorEmail: null };
    if (fieldKey) {
      doctorFilter.fieldKey  = fieldKey.trim();
      defaultFilter.fieldKey = fieldKey.trim();
    }

    const [doctorTemplates, defaultTemplates] = await Promise.all([
      HistoryTemplate.find(doctorFilter).sort({ createdAt: -1 }).lean(),
      HistoryTemplate.find(defaultFilter).sort({ createdAt: -1 }).lean(),
    ]);

    res.json([...doctorTemplates, ...defaultTemplates]);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch templates", error: err.message });
  }
};

/**
 * POST /api/history-templates
 * Body: { fieldKey, name, content, doctorEmail? (admin only) }
 * Creates a new template owned by the resolved doctor.
 */
const createTemplate = async (req, res) => {
  try {
    const { fieldKey, name, content, isDefault } = req.body;

    if (!fieldKey || !name) {
      return res.status(400).json({ message: "fieldKey and name are required" });
    }

    const templateData = {
      fieldKey:  fieldKey.trim(),
      name:      name.trim(),
      content:   content || "",
      isDefault: !!isDefault,
      // Only attach doctorEmail for non-default (personal) templates
      doctorEmail: isDefault ? null : resolveDocEmail(req),
    };

    const template = new HistoryTemplate(templateData);
    await template.save();
    res.status(201).json(template);
  } catch (err) {
    res.status(500).json({ message: "Failed to create template", error: err.message });
  }
};

/**
 * PUT /api/history-templates/:id
 * Body: { name?, content? }
 * Updates a template. Only the owning doctor can update it.
 */
const updateTemplate = async (req, res) => {
  try {
    const doctorEmail = resolveDocEmail(req);
    const { name, content } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (content !== undefined) updates.content = content;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    // Try doctor-owned template first, then fall back to global default
    let template = await HistoryTemplate.findOneAndUpdate(
      { _id: req.params.id, doctorEmail },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!template) {
      template = await HistoryTemplate.findOneAndUpdate(
        { _id: req.params.id, isDefault: true, doctorEmail: null },
        { $set: updates },
        { new: true, runValidators: true }
      );
    }

    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    res.json(template);
  } catch (err) {
    res.status(500).json({ message: "Failed to update template", error: err.message });
  }
};

/**
 * DELETE /api/history-templates/:id
 * Deletes a template. Only the owning doctor can delete it.
 */
const deleteTemplate = async (req, res) => {
  try {
    const doctorEmail = resolveDocEmail(req);

    // Try doctor-owned first, then fall back to global default
    let template = await HistoryTemplate.findOneAndDelete({
      _id: req.params.id,
      doctorEmail,
    });

    if (!template) {
      template = await HistoryTemplate.findOneAndDelete({
        _id: req.params.id,
        isDefault: true,
        doctorEmail: null,
      });
    }

    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    res.json({ message: "Template deleted", id: req.params.id });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete template", error: err.message });
  }
};

module.exports = {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
};
