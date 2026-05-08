const mongoose = require("mongoose");
const ApplicationLaboratoryTest = require("../models/ApplicationLaboratoryTest");

// Create a new laboratory test for an application
exports.createLaboratoryTest = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.en || !name.ru) {
      return res.status(400).json({ error: "Both name.en and name.ru are required" });
    }
    const laboratoryTest = new ApplicationLaboratoryTest({
      name,
    });
    await laboratoryTest.save();
    res.status(201).json(laboratoryTest);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all laboratory tests for an application
exports.getLaboratoryTests = async (req, res) => {
  try {
    const laboratoryTests = await ApplicationLaboratoryTest.find();
    res.status(200).json(laboratoryTests);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

//Get a specific laboratory test by ID
exports.getLaboratoryTestById = async (req, res) => {
  try {
    const { id } = req.params;
    const laboratoryTest = await ApplicationLaboratoryTest.findById(id);
    if (!laboratoryTest) {
      return res.status(404).json({ error: "Laboratory test not found" });
    }
    res.status(200).json(laboratoryTest);
    } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update a laboratory test by ID
exports.updateLaboratoryTest = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.en || !name.ru) {
      return res.status(400).json({ error: "Both name.en and name.ru are required" });
    }
    const updatedLaboratoryTest = await ApplicationLaboratoryTest.findByIdAndUpdate(
      id,
      { name },
      { new: true },
    );
    if (!updatedLaboratoryTest) {
      return res.status(404).json({ error: "Laboratory test not found" });
    }
    res.status(200).json(updatedLaboratoryTest);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Upload a file for a laboratory test
exports.uploadLaboratoryTestFile = async (req, res) => {
  try {
    const { id } = req.params;
    const test = await ApplicationLaboratoryTest.findById(id);
    if (!test) {
      return res.status(404).json({ error: "Laboratory test not found" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "labTestFiles",
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

    test.files = [...(test.files || []), fileRecord];
    test.fileId = uploadStream.id;
    test.fileName = req.file.originalname;
    test.fileMimeType = req.file.mimetype;
    test.fileSize = req.file.size;
    await test.save();

    res.status(200).json(test);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getLaboratoryTestFile = async (req, res) => {
  try {
    const { id, fileId: requestedFileId } = req.params;
    const test = await ApplicationLaboratoryTest.findById(id);
    if (!test) {
      return res.status(404).json({ error: "File not found" });
    }

    const fileId = requestedFileId || test.fileId || test.files?.[test.files.length - 1]?.fileId;
    if (!fileId) {
      return res.status(404).json({ error: "File not found" });
    }

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "labTestFiles",
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
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.removeLaboratoryTestFile = async (req, res) => {
  try {
    const { id, fileId: requestedFileId } = req.params;
    const test = await ApplicationLaboratoryTest.findById(id);
    if (!test) {
      return res.status(404).json({ error: "File not found" });
    }

    const fileId = requestedFileId || test.fileId;
    if (!fileId) {
      return res.status(404).json({ error: "File not found" });
    }

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "labTestFiles",
    });
    await bucket.delete(new mongoose.Types.ObjectId(fileId));

    test.files = (test.files || []).filter((item) => String(item.fileId) !== String(fileId));
    if (String(test.fileId) === String(fileId)) {
      const newestFile = test.files[test.files.length - 1];
      if (newestFile) {
        test.fileId = newestFile.fileId;
        test.fileName = newestFile.fileName;
        test.fileMimeType = newestFile.fileMimeType;
        test.fileSize = newestFile.fileSize;
      } else {
        test.fileId = null;
        test.fileName = "";
        test.fileMimeType = "";
        test.fileSize = 0;
      }
    }

    await test.save();
    res.status(200).json(test);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Add a new text note for a laboratory test
exports.addLaboratoryTestNote = async (req, res) => {
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

    const updatedLaboratoryTest = await ApplicationLaboratoryTest.findByIdAndUpdate(
      id,
      {
        $push: { notes: noteRecord },
        $unset: { note: "" },
      },
      { new: true },
    );
    if (!updatedLaboratoryTest) {
      return res.status(404).json({ error: "Laboratory test not found" });
    }
    res.status(200).json(updatedLaboratoryTest);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.updateLaboratoryTestNote = async (req, res) => {
  try {
    const { id, noteId } = req.params;
    const { note } = req.body;
    if (!note || !note.trim()) {
      return res.status(400).json({ error: "Note content is required" });
    }

    const updatedLaboratoryTest = await ApplicationLaboratoryTest.findOneAndUpdate(
      { _id: id, "notes._id": noteId },
      {
        $set: {
          "notes.$.content": note,
          "notes.$.updatedAt": new Date(),
        },
      },
      { new: true },
    );
    if (!updatedLaboratoryTest) {
      return res.status(404).json({ error: "Laboratory test or note not found" });
    }
    res.status(200).json(updatedLaboratoryTest);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteLaboratoryTestNote = async (req, res) => {
  try {
    const { id, noteId } = req.params;
    const update = noteId
      ? { $pull: { notes: { _id: noteId } } }
      : { $unset: { note: "" } };

    const updatedLaboratoryTest = await ApplicationLaboratoryTest.findByIdAndUpdate(
      id,
      update,
      { new: true },
    );
    if (!updatedLaboratoryTest) {
      return res.status(404).json({ error: "Laboratory test not found" });
    }
    res.status(200).json(updatedLaboratoryTest);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete a laboratory test by ID
exports.deleteLaboratoryTest = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedLaboratoryTest = await ApplicationLaboratoryTest.findByIdAndDelete(id);
    if (!deletedLaboratoryTest) {
      return res.status(404).json({ error: "Laboratory test not found" });
    }
    res.status(200).json({ message: "Laboratory test deleted successfully" });
    } catch (error) {
    res.status(400).json({ error: error.message });
  }
};