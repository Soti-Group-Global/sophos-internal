const mongoose = require("mongoose");
const ApplicationInstrumentalAnalysis = require("../models/ApplicationInstrumentalAnalysis");

// Create a new instrumental analysis for an application
exports.createInstrumentalAnalysis = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || !name.en || !name.ru) {
            return res.status(400).json({ error: "Both name.en and name.ru are required" });
        }
        const instrumentalAnalysis = new ApplicationInstrumentalAnalysis({
            name,
        });
        await instrumentalAnalysis.save();
        res.status(201).json(instrumentalAnalysis);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get all instrumental analyses for an application
exports.getInstrumentalAnalyses = async (req, res) => {
    try {
        const instrumentalAnalyses = await ApplicationInstrumentalAnalysis.find();
        res.status(200).json(instrumentalAnalyses);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};

//Get a specific instrumental analysis by ID
exports.getInstrumentalAnalysisById = async (req, res) => {
    try {
        const { id } = req.params;
        const instrumentalAnalysis = await ApplicationInstrumentalAnalysis.findById(id);
        if (!instrumentalAnalysis) {
            return res.status(404).json({ error: "Instrumental analysis not found" });
        }
        res.status(200).json(instrumentalAnalysis);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Update an instrumental analysis by ID
exports.updateInstrumentalAnalysis = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        if (!name || !name.en || !name.ru) {
            return res.status(400).json({ error: "Both name.en and name.ru are required" });
        }
        const updatedInstrumentalAnalysis = await ApplicationInstrumentalAnalysis.findByIdAndUpdate(
            id,
            { name },
            { new: true },
        );
        if (!updatedInstrumentalAnalysis) {
            return res.status(404).json({ error: "Instrumental analysis not found" });
        }
        res.status(200).json(updatedInstrumentalAnalysis);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Upload file for an instrumental analysis
exports.uploadInstrumentalAnalysisFile = async (req, res) => {
    try {
        const { id } = req.params;
        const analysis = await ApplicationInstrumentalAnalysis.findById(id);
        if (!analysis) {
            return res.status(404).json({ error: "Instrumental analysis not found" });
        }
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: "instrumentalAnalysisFiles",
        });

        const filename = `${Date.now()}_${req.file.originalname}`;
        const uploadStream = bucket.openUploadStream(filename, {
            contentType: req.file.mimetype,
            metadata: {
                originalName: req.file.originalname,
                uploadedBy: req.user?.id || null,
            },
        });

        uploadStream.end(req.file.buffer);
        await new Promise((resolve, reject) => {
            uploadStream.on("finish", resolve);
            uploadStream.on("error", reject);
        });

        const fileRecord = {
            fileId: uploadStream.id,
            fileName: req.file.originalname,
            fileMimeType: req.file.mimetype,
            fileSize: req.file.size,
            uploadedAt: new Date(),
        };

        analysis.files = [...(analysis.files || []), fileRecord];
        analysis.fileId = uploadStream.id;
        analysis.fileName = req.file.originalname;
        analysis.fileMimeType = req.file.mimetype;
        analysis.fileSize = req.file.size;
        await analysis.save();

        res.status(200).json(analysis);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.getInstrumentalAnalysisFile = async (req, res) => {
    try {
        const { id, fileId: requestedFileId } = req.params;
        const analysis = await ApplicationInstrumentalAnalysis.findById(id);
        if (!analysis) {
            return res.status(404).json({ error: "File not found" });
        }

        const fileId = requestedFileId || analysis.fileId || analysis.files?.[analysis.files.length - 1]?.fileId;
        if (!fileId) {
            return res.status(404).json({ error: "File not found" });
        }

        const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: "instrumentalAnalysisFiles",
        });
        const objectId = new mongoose.Types.ObjectId(fileId);
        const files = await bucket.find({ _id: objectId }).toArray();
        if (!files || files.length === 0) {
            return res.status(404).json({ error: "File not found" });
        }

        const file = files[0];
        res.set({
            "Content-Type": file.contentType || "application/octet-stream",
            "Content-Disposition": `inline; filename="${file.metadata?.originalName || file.filename}"`,
        });

        const readStream = bucket.openDownloadStream(objectId);
        readStream.pipe(res);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.removeInstrumentalAnalysisFile = async (req, res) => {
    try {
        const { id, fileId: requestedFileId } = req.params;
        const analysis = await ApplicationInstrumentalAnalysis.findById(id);
        if (!analysis) {
            return res.status(404).json({ error: "File not found" });
        }

        const fileId = requestedFileId || analysis.fileId;
        if (!fileId) {
            return res.status(404).json({ error: "File not found" });
        }

        const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: "instrumentalAnalysisFiles",
        });
        await bucket.delete(new mongoose.Types.ObjectId(fileId));

        analysis.files = (analysis.files || []).filter((item) => String(item.fileId) !== String(fileId));
        if (String(analysis.fileId) === String(fileId)) {
            const newestFile = analysis.files[analysis.files.length - 1];
            if (newestFile) {
                analysis.fileId = newestFile.fileId;
                analysis.fileName = newestFile.fileName;
                analysis.fileMimeType = newestFile.fileMimeType;
                analysis.fileSize = newestFile.fileSize;
            } else {
                analysis.fileId = null;
                analysis.fileName = "";
                analysis.fileMimeType = "";
                analysis.fileSize = 0;
            }
        }

        await analysis.save();
        res.status(200).json(analysis);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Add a new text note for an instrumental analysis
exports.addInstrumentalAnalysisNote = async (req, res) => {
    try {
        const { id } = req.params;
        const { note } = req.body;
        if (!note || !note.trim()) {
            return res.status(400).json({ error: "Note content is required" });
        }

        const noteRecord = {
            _id: new mongoose.Types.ObjectId(),
            content: note,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const updatedInstrumentalAnalysis = await ApplicationInstrumentalAnalysis.findByIdAndUpdate(
            id,
            {
                $push: { notes: noteRecord },
                $unset: { note: "" },
            },
            { new: true },
        );
        if (!updatedInstrumentalAnalysis) {
            return res.status(404).json({ error: "Instrumental analysis not found" });
        }
        res.status(200).json(updatedInstrumentalAnalysis);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.updateInstrumentalAnalysisNote = async (req, res) => {
    try {
        const { id, noteId } = req.params;
        const { note } = req.body;
        if (!note || !note.trim()) {
            return res.status(400).json({ error: "Note content is required" });
        }

        const updatedInstrumentalAnalysis = await ApplicationInstrumentalAnalysis.findOneAndUpdate(
            { _id: id, "notes._id": noteId },
            {
                $set: {
                    "notes.$.content": note,
                    "notes.$.updatedAt": new Date(),
                },
            },
            { new: true },
        );
        if (!updatedInstrumentalAnalysis) {
            return res.status(404).json({ error: "Instrumental analysis or note not found" });
        }
        res.status(200).json(updatedInstrumentalAnalysis);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.deleteInstrumentalAnalysisNote = async (req, res) => {
    try {
        const { id, noteId } = req.params;
        const update = noteId
            ? { $pull: { notes: { _id: noteId } } }
            : { $unset: { note: "" } };

        const updatedInstrumentalAnalysis = await ApplicationInstrumentalAnalysis.findByIdAndUpdate(
            id,
            update,
            { new: true },
        );
        if (!updatedInstrumentalAnalysis) {
            return res.status(404).json({ error: "Instrumental analysis not found" });
        }
        res.status(200).json(updatedInstrumentalAnalysis);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Delete an instrumental analysis by ID
exports.deleteInstrumentalAnalysis = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedInstrumentalAnalysis = await ApplicationInstrumentalAnalysis.findByIdAndDelete(id);
        if (!deletedInstrumentalAnalysis) {
            return res.status(404).json({ error: "Instrumental analysis not found" });
        }
        res.status(200).json({ message: "Instrumental analysis deleted successfully" });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};