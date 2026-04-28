const BoardNote = require("../models/Board");
const Assistant = require("../models/Assistant");
const DoctorsProfile = require("../models/DoctorsProfile");
const Manager = require("../models/Manager");

const DOCTOR_ROLES = ["doctor", "head_doctor", "specialist"];
const ASSISTANT_ROLES = ["assistant", "head_assistant"];
const MANAGER_ROLES = ["manager", "head_manager", "super_admin", "content_manager"];

async function resolveDisplayName(email, role) {
  try {
    if (ASSISTANT_ROLES.includes(role)) {
      const doc = await Assistant.findOne({ email }).select("firstName middleName lastName").lean();
      if (doc) return [doc.lastName, doc.firstName, doc.middleName].filter(Boolean).join(" ");
    } else if (DOCTOR_ROLES.includes(role)) {
      const doc = await DoctorsProfile.findOne({ email }).select("firstName lastName").lean();
      if (doc) {
        const lang = "en";
        const first = doc.firstName?.[lang] || doc.firstName?.ru || "";
        const last = doc.lastName?.[lang] || doc.lastName?.ru || "";
        return `${last} ${first}`.trim();
      }
    } else if (MANAGER_ROLES.includes(role)) {
      const doc = await Manager.findOne({ email }).select("firstName lastName").lean();
      if (doc) return `${doc.lastName || ""} ${doc.firstName || ""}`.trim();
    }
  } catch (_) {}
  return "";
}

// GET all notes visible to the current user
exports.getNotes = async (req, res) => {
  try {
    const { email, role } = req.user;
    // A note is visible if:
    // 1. isPersonal and createdBy === email, OR
    // 2. !isPersonal and (visibleTo includes role OR visibleTo is empty (= all roles))
    const notes = await BoardNote.find({
      $or: [
        { isPersonal: true, createdBy: email },
        { isPersonal: false, $or: [{ visibleTo: role }, { visibleTo: { $size: 0 } }] },
      ],
    }).sort({ pinned: -1, createdAt: -1 }).lean();

    // Enrich notes that have no stored display name
    const enriched = await Promise.all(
      notes.map(async (note) => {
        if (!note.createdByName) {
          note.createdByName = await resolveDisplayName(note.createdBy, note.createdByRole);
        }
        return note;
      })
    );

    res.json({ success: true, notes: enriched });
  } catch (err) {
    console.error("getNotes error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// POST create a note
exports.createNote = async (req, res) => {
  try {
    const { email, role } = req.user;
    const { title, content, visibleTo, isPersonal } = req.body;

    if (!content) return res.status(400).json({ success: false, message: "Content is required" });

    const createdByName = await resolveDisplayName(email, role);

    const note = await BoardNote.create({
      title: title || "",
      content,
      visibleTo: isPersonal ? [] : (Array.isArray(visibleTo) ? visibleTo : []),
      isPersonal: !!isPersonal,
      createdBy: email,
      createdByName,
      createdByRole: role,
    });

    res.status(201).json({ success: true, note });
  } catch (err) {
    console.error("createNote error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// PATCH update a note (only creator can edit)
exports.updateNote = async (req, res) => {
  try {
    const { email } = req.user;
    const note = await BoardNote.findOne({ _id: req.params.id, createdBy: email });
    if (!note) return res.status(404).json({ success: false, message: "Note not found" });

    const { title, content, visibleTo, isPersonal, pinned } = req.body;
    if (title !== undefined) note.title = title;
    if (content !== undefined) note.content = content;
    if (isPersonal !== undefined) note.isPersonal = isPersonal;
    if (visibleTo !== undefined) note.visibleTo = isPersonal ? [] : visibleTo;
    if (pinned !== undefined) note.pinned = pinned;

    await note.save();
    res.json({ success: true, note });
  } catch (err) {
    console.error("updateNote error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// DELETE a note (only creator can delete)
exports.deleteNote = async (req, res) => {
  try {
    const { email } = req.user;
    const result = await BoardNote.deleteOne({ _id: req.params.id, createdBy: email });
    if (result.deletedCount === 0)
      return res.status(404).json({ success: false, message: "Note not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("deleteNote error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
