const mongoose = require("mongoose");
const PatientAnalysisSection = require("../models/PatientAnalysisSection");
const PatientMorphologySection = require("../models/PatientMorphologySection");

// Flat entry sections (doctor/assistant): laboratoryAnalysis, studiesManipulations
const LAB_SECTIONS = ["laboratoryAnalysis", "studiesManipulations"];

// Flat managed sections (files + comment): morphologicalResearch, proceduresAndManipulations
const MANAGED_SECTIONS = ["morphologicalResearch", "proceduresAndManipulations"];

const bucket = () =>
  new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "sectionFiles" });

/* ──────────────────────────────────────────────────────────────────────────
   GET /api/patient-sections/:patientId/:section
   Lab sections:     returns { entries: [...] }
   Managed sections: returns { files, comment }
────────────────────────────────────────────────────────────────────────── */
exports.getSection = async (req, res) => {
  try {
    const { patientId, section } = req.params;

    if (LAB_SECTIONS.includes(section)) {
      const doc = await PatientAnalysisSection.findOne({ patientId }).lean();
      const entries = doc ? (doc[section] || []) : [];
      return res.json({ entries });
    }

    if (MANAGED_SECTIONS.includes(section)) {
      const doc = await PatientMorphologySection.findOne({ patientId }).lean();
      const sec = doc ? (doc[section] || { files: [], comment: {} }) : { files: [], comment: {} };
      return res.json(sec);
    }

    res.status(400).json({ error: "Invalid section" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ──────────────────────────────────────────────────────────────────────────
   POST /api/patient-sections/:patientId/:section/text
   Lab sections only: adds a named text entry.
   Body: { label: "RU name", text: "EN name" }
────────────────────────────────────────────────────────────────────────── */
exports.addTextEntry = async (req, res) => {
  try {
    const { patientId, section } = req.params;
    if (!LAB_SECTIONS.includes(section)) return res.status(400).json({ error: "Invalid section" });

    const { text = "", label = "" } = req.body;
    if (!label.trim() && !text.trim()) return res.status(400).json({ error: "Name is required" });

    const doc = await PatientAnalysisSection.findOneAndUpdate(
      { patientId },
      { $push: { [section]: { kind: "text", label: label.trim(), text: text.trim() } } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    res.json({ section: { entries: doc[section] } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ──────────────────────────────────────────────────────────────────────────
   POST /api/patient-sections/:patientId/:section/upload
   Managed sections: stores flat file record in PatientMorphologySection.
   Lab sections: stores flat file entry in PatientAnalysisSection.
────────────────────────────────────────────────────────────────────────── */
exports.uploadFile = async (req, res) => {
  try {
    const { patientId, section } = req.params;
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const gfs = bucket();
    const storedName = `${Date.now()}_${req.file.originalname}`;
    const uploadStream = gfs.openUploadStream(storedName, {
      contentType: req.file.mimetype,
      metadata: { originalName: req.file.originalname, uploadedBy: req.user?.id || null },
    });
    uploadStream.end(req.file.buffer);
    await new Promise((resolve, reject) => {
      uploadStream.on("finish", resolve);
      uploadStream.on("error", reject);
    });

    if (MANAGED_SECTIONS.includes(section)) {
      const fileRecord = {
        filename: req.file.originalname,
        fileId: uploadStream.id,
        uploadedAt: new Date(),
      };
      const doc = await PatientMorphologySection.findOneAndUpdate(
        { patientId },
        { $push: { [`${section}.files`]: fileRecord } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      return res.json({ file: fileRecord, section: doc[section] });
    }

    if (LAB_SECTIONS.includes(section)) {
      const label = (req.body?.label || "").trim();
      const doc = await PatientAnalysisSection.findOneAndUpdate(
        { patientId },
        { $push: { [section]: { kind: "file", label, filename: req.file.originalname, fileId: uploadStream.id } } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      return res.json({ section: { entries: doc[section] } });
    }

    res.status(400).json({ error: "Invalid section" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ──────────────────────────────────────────────────────────────────────────
   GET /api/patient-sections/:patientId/:section/file/:fileId
   Streams a file from GridFS.
────────────────────────────────────────────────────────────────────────── */
exports.getFile = async (req, res) => {
  try {
    const { patientId, section, fileId } = req.params;
    let storedFileId;

    if (MANAGED_SECTIONS.includes(section)) {
      const doc = await PatientMorphologySection.findOne({ patientId }).lean();
      const file = (doc?.[section]?.files || []).find(
        (f) => String(f.fileId) === fileId || String(f._id) === fileId,
      );
      storedFileId = file?.fileId;
    } else if (LAB_SECTIONS.includes(section)) {
      const doc = await PatientAnalysisSection.findOne({ patientId }).lean();
      const entry = (doc?.[section] || []).find(
        (e) => String(e.fileId) === fileId || String(e._id) === fileId,
      );
      storedFileId = entry?.fileId;
    } else {
      return res.status(400).json({ error: "Invalid section" });
    }

    if (!storedFileId) return res.status(404).json({ error: "File not found" });

    const gfs = bucket();
    const objectId = new mongoose.Types.ObjectId(storedFileId);
    const files = await gfs.find({ _id: objectId }).toArray();
    if (!files.length) return res.status(404).json({ error: "File not found in storage" });

    const meta = files[0];
    res.set({
      "Content-Type": meta.contentType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${meta.metadata?.originalName || meta.filename}"`,
    });
    gfs.openDownloadStream(objectId).pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ──────────────────────────────────────────────────────────────────────────
   DELETE /api/patient-sections/:patientId/:section/file/:fileId
   Removes a file from GridFS and from the section document.
────────────────────────────────────────────────────────────────────────── */
exports.removeFile = async (req, res) => {
  try {
    const { patientId, section, fileId } = req.params;

    if (MANAGED_SECTIONS.includes(section)) {
      const doc = await PatientMorphologySection.findOne({ patientId });
      if (!doc) return res.status(404).json({ error: "Section not found" });

      const record = (doc[section]?.files || []).find(
        (f) => String(f.fileId) === fileId || String(f._id) === fileId,
      );
      if (record?.fileId) {
        try { await bucket().delete(new mongoose.Types.ObjectId(record.fileId)); } catch (_) {}
      }
      doc[section].files = (doc[section].files || []).filter(
        (f) => String(f.fileId) !== fileId && String(f._id) !== fileId,
      );
      doc.markModified(section);
      await doc.save();
      return res.json({ section: doc[section] });
    }

    if (LAB_SECTIONS.includes(section)) {
      const doc = await PatientAnalysisSection.findOne({ patientId });
      if (!doc) return res.status(404).json({ error: "Section not found" });

      const entry = (doc[section] || []).find(
        (e) => String(e.fileId) === fileId || String(e._id) === fileId,
      );
      if (entry?.fileId) {
        try { await bucket().delete(new mongoose.Types.ObjectId(entry.fileId)); } catch (_) {}
      }
      doc[section] = (doc[section] || []).filter(
        (e) => String(e.fileId) !== fileId && String(e._id) !== fileId,
      );
      doc.markModified(section);
      await doc.save();
      return res.json({ section: { entries: doc[section] } });
    }

    res.status(400).json({ error: "Invalid section" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ──────────────────────────────────────────────────────────────────────────
   DELETE /api/patient-sections/:patientId/:section/entries/:entryId
   Lab sections only: removes any entry by _id (text or file).
────────────────────────────────────────────────────────────────────────── */
exports.removeEntry = async (req, res) => {
  try {
    const { patientId, section, entryId } = req.params;
    if (!LAB_SECTIONS.includes(section)) return res.status(400).json({ error: "Invalid section" });

    const doc = await PatientAnalysisSection.findOne({ patientId });
    if (!doc) return res.json({ section: { entries: [] } });

    const entry = (doc[section] || []).find((e) => String(e._id) === entryId);
    if (entry?.fileId) {
      try { await bucket().delete(new mongoose.Types.ObjectId(entry.fileId)); } catch (_) {}
    }
    doc[section] = (doc[section] || []).filter((e) => String(e._id) !== entryId);
    doc.markModified(section);
    await doc.save();

    res.json({ section: { entries: doc[section] } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ──────────────────────────────────────────────────────────────────────────
   PATCH /api/patient-sections/:patientId/:section/comment
   Managed sections only: updates the comment value.
────────────────────────────────────────────────────────────────────────── */
exports.updateComment = async (req, res) => {
  try {
    const { patientId, section } = req.params;
    if (!MANAGED_SECTIONS.includes(section))
      return res.status(400).json({ error: "Invalid section" });

    const { value } = req.body;
    const doc = await PatientMorphologySection.findOneAndUpdate(
      { patientId },
      { $set: { [`${section}.comment.value`]: value ?? "" } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    res.json({ section: doc[section] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
