const mongoose = require("mongoose");
const Application = require("../models/Application");

const ALLOWED_SECTIONS = ["morphologicalResearch", "proceduresAndManipulations", "conclusion"];

const bucket = () =>
  new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "sectionFiles" });

/* GET /api/application-section/:applicationId/:section */
exports.getSection = async (req, res) => {
  try {
    const { applicationId, section } = req.params;
    if (!ALLOWED_SECTIONS.includes(section))
      return res.status(400).json({ error: "Invalid section" });

    const app = await Application.findOne({ applicationId });
    if (!app) return res.status(404).json({ error: "Application not found" });

    res.json(app[section] || { files: [], comment: {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* POST /api/application-section/:applicationId/:section/upload  (multipart, field "file") */
exports.uploadFile = async (req, res) => {
  try {
    const { applicationId, section } = req.params;
    if (!ALLOWED_SECTIONS.includes(section))
      return res.status(400).json({ error: "Invalid section" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const app = await Application.findOne({ applicationId });
    if (!app) return res.status(404).json({ error: "Application not found" });

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

    const fileRecord = {
      filename: req.file.originalname,
      fileId: uploadStream.id,
      uploadedAt: new Date(),
    };

    if (!app[section]) app[section] = { files: [], comment: {} };
    app[section].files.push(fileRecord);
    app.markModified(section);
    await app.save();

    res.json({ file: fileRecord, section: app[section] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* GET /api/application-section/:applicationId/:section/file/:fileId */
exports.getFile = async (req, res) => {
  try {
    const { applicationId, section, fileId } = req.params;
    if (!ALLOWED_SECTIONS.includes(section))
      return res.status(400).json({ error: "Invalid section" });

    const app = await Application.findOne({ applicationId });
    if (!app) return res.status(404).json({ error: "Application not found" });

    const fileRecord = (app[section]?.files || []).find(
      (f) => String(f.fileId) === fileId || String(f._id) === fileId
    );
    if (!fileRecord) return res.status(404).json({ error: "File not found in section" });

    const gfs = bucket();
    const objectId = new mongoose.Types.ObjectId(fileRecord.fileId);
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

/* DELETE /api/application-section/:applicationId/:section/file/:fileId */
exports.removeFile = async (req, res) => {
  try {
    const { applicationId, section, fileId } = req.params;
    if (!ALLOWED_SECTIONS.includes(section))
      return res.status(400).json({ error: "Invalid section" });

    const app = await Application.findOne({ applicationId });
    if (!app) return res.status(404).json({ error: "Application not found" });

    const record = (app[section]?.files || []).find(
      (f) => String(f.fileId) === fileId || String(f._id) === fileId
    );
    if (record?.fileId) {
      try {
        await bucket().delete(new mongoose.Types.ObjectId(record.fileId));
      } catch (_) {}
    }

    app[section].files = (app[section].files || []).filter(
      (f) => String(f.fileId) !== fileId && String(f._id) !== fileId
    );
    app.markModified(section);
    await app.save();

    res.json({ section: app[section] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* PATCH /api/application-section/:applicationId/:section/comment */
exports.updateComment = async (req, res) => {
  try {
    const { applicationId, section } = req.params;
    if (!ALLOWED_SECTIONS.includes(section))
      return res.status(400).json({ error: "Invalid section" });

    const { value } = req.body;
    const app = await Application.findOne({ applicationId });
    if (!app) return res.status(404).json({ error: "Application not found" });

    if (!app[section]) app[section] = { files: [], comment: {} };
    app[section].comment = { ...(app[section].comment || {}), value: value ?? "" };
    app.markModified(section);
    await app.save();

    res.json({ section: app[section] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
