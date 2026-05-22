const mongoose = require("mongoose");
const PatientLaboratoryTest = require("../models/PatientLaboratoryTest");
const PatientInstrumentalAnalysis = require("../models/PatientInstrumentalAnalysis");
const PatientLabSection = require("../models/PatientLabSection");

const bucket = () =>
  new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "sectionFiles" });

// labField: which array inside PatientLabSection to use
// "laboratoryTests" for PatientLaboratoryTest
// "instrumentalAnalysis" for PatientInstrumentalAnalysis

function makeController(Model, labField) {

  // Find the PatientLabSection entry for this patient+catalogItem, creating both if needed
  async function getOrCreateEntry(patientId, itemId) {
    let doc = await PatientLabSection.findOne({ patientId });
    if (!doc) {
      doc = new PatientLabSection({ patientId, laboratoryTests: [], instrumentalAnalysis: [] });
    }
    let entry = doc[labField].find((e) => String(e.item) === String(itemId));
    if (!entry) {
      doc[labField].push({ item: itemId, files: [], notes: [] });
      entry = doc[labField][doc[labField].length - 1];
    }
    return { doc, entry };
  }

  // Merge catalog item with PatientLabSection entry data for the frontend
  function merged(catalogItem, entry) {
    return {
      ...catalogItem.toObject(),
      files: (entry?.files || []).map((f) => ({
        _id: f._id,
        fileName: f.filename || f.customName || "",
        fileId: f.fileId,
        uploadedAt: f.uploadedAt,
      })),
      notes: (entry?.notes || []).map((n) => ({
        _id: n._id,
        content: n.content ?? n.note ?? "",
        createdAt: n.createdAt,
      })),
    };
  }

  return {
    /* ── catalog CRUD ── */

    getAll: async (req, res) => {
      try {
        const items = await Model.find().sort({ createdAt: 1 });
        const { patientId } = req.query;
        if (!patientId) return res.json(items);

        const sectionDoc = await PatientLabSection.findOne({ patientId });
        const result = items.map((item) => {
          const entry = (sectionDoc?.[labField] || []).find(
            (e) => String(e.item) === String(item._id),
          );
          return merged(item, entry);
        });
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },

    getById: async (req, res) => {
      try {
        const item = await Model.findById(req.params.id);
        if (!item) return res.status(404).json({ error: "Not found" });

        const { patientId } = req.query;
        if (!patientId) return res.json(item);

        const sectionDoc = await PatientLabSection.findOne({ patientId });
        const entry = (sectionDoc?.[labField] || []).find(
          (e) => String(e.item) === String(item._id),
        );
        res.json(merged(item, entry));
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },

    create: async (req, res) => {
      try {
        const { name } = req.body;
        const item = await Model.create({ name });
        res.status(201).json(item);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },

    update: async (req, res) => {
      try {
        const { name } = req.body;
        const item = await Model.findByIdAndUpdate(
          req.params.id,
          { name },
          { new: true, runValidators: true },
        );
        if (!item) return res.status(404).json({ error: "Not found" });
        res.json(item);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },

    remove: async (req, res) => {
      try {
        const item = await Model.findByIdAndDelete(req.params.id);
        if (!item) return res.status(404).json({ error: "Not found" });
        res.json({ message: "Deleted successfully" });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },

    /* ── file operations → stored in PatientLabSection ── */

    uploadFile: async (req, res) => {
      try {
        const { id } = req.params;
        const { patientId } = req.body;
        if (!patientId) return res.status(400).json({ error: "patientId is required" });
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const item = await Model.findById(id);
        if (!item) return res.status(404).json({ error: "Not found" });

        // Upload to GridFS
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

        const { doc, entry } = await getOrCreateEntry(patientId, id);
        entry.files.push({ filename: req.file.originalname, fileId: uploadStream.id });
        await doc.save();

        const updatedEntry = doc[labField].find((e) => String(e.item) === String(id));
        res.json(merged(item, updatedEntry));
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },

    getFile: async (req, res) => {
      try {
        const { id, fileId } = req.params;
        const { patientId } = req.query;
        if (!patientId) return res.status(400).json({ error: "patientId is required" });

        const sectionDoc = await PatientLabSection.findOne({ patientId });
        const entry = (sectionDoc?.[labField] || []).find((e) => String(e.item) === id);
        const record = (entry?.files || []).find(
          (f) => String(f.fileId) === fileId || String(f._id) === fileId,
        );
        if (!record?.fileId) return res.status(404).json({ error: "File not found" });

        const gfs = bucket();
        const objectId = new mongoose.Types.ObjectId(record.fileId);
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
    },

    removeFile: async (req, res) => {
      try {
        const { id, fileId } = req.params;
        const { patientId } = req.query;
        if (!patientId) return res.status(400).json({ error: "patientId is required" });

        const item = await Model.findById(id);
        if (!item) return res.status(404).json({ error: "Not found" });

        const sectionDoc = await PatientLabSection.findOne({ patientId });
        if (!sectionDoc) return res.status(404).json({ error: "Section not found" });

        const entry = (sectionDoc[labField] || []).find((e) => String(e.item) === id);
        if (entry) {
          const record = (entry.files || []).find(
            (f) => String(f.fileId) === fileId || String(f._id) === fileId,
          );
          if (record?.fileId) {
            try { await bucket().delete(new mongoose.Types.ObjectId(record.fileId)); } catch (_) {}
          }
          entry.files = entry.files.filter(
            (f) => String(f.fileId) !== fileId && String(f._id) !== fileId,
          );
          await sectionDoc.save();
        }

        const updatedEntry = (sectionDoc[labField] || []).find((e) => String(e.item) === id);
        res.json(merged(item, updatedEntry));
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },

    /* ── note operations → stored in PatientLabSection ── */

    addNote: async (req, res) => {
      try {
        const { id } = req.params;
        const { patientId, note } = req.body;
        if (!patientId) return res.status(400).json({ error: "patientId is required" });

        const item = await Model.findById(id);
        if (!item) return res.status(404).json({ error: "Not found" });

        const { doc, entry } = await getOrCreateEntry(patientId, id);
        entry.notes.push({ content: note || "" });
        await doc.save();

        const updatedEntry = doc[labField].find((e) => String(e.item) === String(id));
        res.json(merged(item, updatedEntry));
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },

    updateNote: async (req, res) => {
      try {
        const { id, noteId } = req.params;
        const { patientId, note } = req.body;
        if (!patientId) return res.status(400).json({ error: "patientId is required" });

        const item = await Model.findById(id);
        if (!item) return res.status(404).json({ error: "Not found" });

        const sectionDoc = await PatientLabSection.findOne({ patientId });
        const entry = (sectionDoc?.[labField] || []).find((e) => String(e.item) === id);
        const noteDoc = (entry?.notes || []).find((n) => String(n._id) === noteId);
        if (noteDoc) {
          noteDoc.content = note ?? noteDoc.content;
          await sectionDoc.save();
        }

        const updatedEntry = (sectionDoc?.[labField] || []).find((e) => String(e.item) === id);
        res.json(merged(item, updatedEntry));
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },

    removeNote: async (req, res) => {
      try {
        const { id, noteId } = req.params;
        const { patientId } = req.query;
        if (!patientId) return res.status(400).json({ error: "patientId is required" });

        const item = await Model.findById(id);
        if (!item) return res.status(404).json({ error: "Not found" });

        const sectionDoc = await PatientLabSection.findOne({ patientId });
        const entry = (sectionDoc?.[labField] || []).find((e) => String(e.item) === id);
        if (entry) {
          entry.notes = noteId
            ? entry.notes.filter((n) => String(n._id) !== noteId)
            : [];
          await sectionDoc.save();
        }

        const updatedEntry = (sectionDoc?.[labField] || []).find((e) => String(e.item) === id);
        res.json(merged(item, updatedEntry));
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },
  };
}

const labCtrl  = makeController(PatientLaboratoryTest,      "laboratoryTests");
const instrCtrl = makeController(PatientInstrumentalAnalysis, "instrumentalAnalysis");

// PatientLaboratoryTest
exports.getAllLaboratoryTests      = labCtrl.getAll;
exports.getLaboratoryTestById     = labCtrl.getById;
exports.createLaboratoryTest      = labCtrl.create;
exports.updateLaboratoryTest      = labCtrl.update;
exports.deleteLaboratoryTest      = labCtrl.remove;
exports.uploadLaboratoryTestFile  = labCtrl.uploadFile;
exports.getLaboratoryTestFile     = labCtrl.getFile;
exports.removeLaboratoryTestFile  = labCtrl.removeFile;
exports.addLaboratoryTestNote     = labCtrl.addNote;
exports.updateLaboratoryTestNote  = labCtrl.updateNote;
exports.removeLaboratoryTestNote  = labCtrl.removeNote;

// PatientInstrumentalAnalysis
exports.getAllInstrumentalAnalysis      = instrCtrl.getAll;
exports.getInstrumentalAnalysisById    = instrCtrl.getById;
exports.createInstrumentalAnalysis     = instrCtrl.create;
exports.updateInstrumentalAnalysis     = instrCtrl.update;
exports.deleteInstrumentalAnalysis     = instrCtrl.remove;
exports.uploadInstrumentalAnalysisFile = instrCtrl.uploadFile;
exports.getInstrumentalAnalysisFile    = instrCtrl.getFile;
exports.removeInstrumentalAnalysisFile = instrCtrl.removeFile;
exports.addInstrumentalAnalysisNote    = instrCtrl.addNote;
exports.updateInstrumentalAnalysisNote = instrCtrl.updateNote;
exports.removeInstrumentalAnalysisNote = instrCtrl.removeNote;
