const ComplicatedCasesForm = require("../../models/website/ComplicatedCasesForm");
const { getGfsComplicatedCases } = require("../../gridfs-complicated-cases");
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;
const telegramBot = require("../../services/telegramBot");
const maxBot = require("../../services/maxBot");

// Submit Complicated Cases Form
exports.submitComplicatedCasesForm = async (req, res) => {
  try {

    // Handle file uploads to GridFS
    const fileIds = [];
    if (req.files && req.files.length > 0) {
      const gfs = getGfsComplicatedCases();
      
      for (const file of req.files) {
        const filename = `${Date.now()}_${file.originalname}`;
        
        const uploadStream = gfs.openUploadStream(filename, {
          contentType: file.mimetype,
          metadata: {
            originalName: file.originalname,
            size: file.size,
          },
        });

        const fileId = uploadStream.id;
        uploadStream.end(file.buffer);

        await new Promise((resolve, reject) => {
          uploadStream.on("finish", resolve);
          uploadStream.on("error", reject);
        });

        fileIds.push(fileId);
      }
    }

    // Create form data with file IDs
    const formData = {
      ...req.body,
      files: fileIds,
    };

    const complicatedCasesForm = await ComplicatedCasesForm.create(formData);

    // Send Telegram notification
    try {
      await telegramBot.sendComplicatedCasesNotification(complicatedCasesForm);
      await maxBot.sendComplicatedCasesNotification(complicatedCasesForm);
    } catch (telegramError) {
    }

    res.status(201).json({
      message: "Complicated Cases form submitted successfully",
      success: true,
      data: complicatedCasesForm,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error submitting the form",    });
  }
};

// Get All Complicated Cases Forms
exports.getComplicatedCasesForms = async (req, res) => {
  try {
    const forms = await ComplicatedCasesForm.find().sort({ createdAt: -1 });
    
    return res.status(200).json({
      message: "Forms fetched successfully",
      data: forms,
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal server error",    });
  }
};

// Get Single Complicated Cases Form by ID
exports.getComplicatedCasesFormById = async (req, res) => {
  try {
    const form = await ComplicatedCasesForm.findById(req.params.id);
    
    if (!form) {
      return res.status(404).json({
        message: "Form not found",
      });
    }

    return res.status(200).json({
      message: "Form fetched successfully",
      data: form,
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal server error",    });
  }
};

// Update Complicated Cases Form
exports.updateComplicatedCasesForm = async (req, res) => {
  try {
    const form = await ComplicatedCasesForm.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    
    if (!form) {
      return res.status(404).json({
        message: "Form not found",
      });
    }

    return res.status(200).json({
      message: "Form updated successfully",
      data: form,
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal server error",    });
  }
};

// Delete Complicated Cases Form
exports.deleteComplicatedCasesForm = async (req, res) => {
  try {
    const form = await ComplicatedCasesForm.findByIdAndDelete(req.params.id);
    
    if (!form) {
      return res.status(404).json({
        message: "Form not found",
      });
    }

    // Delete associated files from GridFS
    if (form.files && form.files.length > 0) {
      const gfs = getGfsComplicatedCases();
      for (const fileId of form.files) {
        try {
          await gfs.delete(new ObjectId(fileId));
        } catch (err) {
        }
      }
    }

    return res.status(200).json({
      message: "Form deleted successfully",
      data: form,
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal server error",    });
  }
};

// Upload File to GridFS
exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const gfs = getGfsComplicatedCases();
    const filename = `${Date.now()}_${req.file.originalname}`;

    const uploadStream = gfs.openUploadStream(filename, {
      contentType: req.file.mimetype,
      metadata: {
        originalName: req.file.originalname,
        size: req.file.size,
      },
    });

    const fileId = uploadStream.id;
    uploadStream.end(req.file.buffer);

    await new Promise((resolve, reject) => {
      uploadStream.on("finish", resolve);
      uploadStream.on("error", reject);
    });

    res.status(200).json({
      success: true,
      fileId,
      fileName: req.file.originalname,
    });
  } catch (error) {
    res.status(500).json({ 
      message: "File upload failed", 

    });
  }
};

// Get File from GridFS
exports.getFile = async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!ObjectId.isValid(fileId)) {
      return res.status(400).json({ message: "Invalid file ID format" });
    }

    const gfs = getGfsComplicatedCases();
    const files = await gfs.find({ _id: new ObjectId(fileId) }).toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({ message: "File not found" });
    }

    const fileInfo = files[0];
    const originalName = fileInfo.metadata?.originalName || fileInfo.filename;

    res.set("Content-Type", fileInfo.contentType);
    res.set("Cache-Control", "public, max-age=31536000");
    res.set("Content-Disposition", `attachment; filename="${originalName}"`);

    const readStream = gfs.openDownloadStream(new ObjectId(fileId));
    readStream.on("error", (err) => {
      if (!res.headersSent) res.status(404).end();
    });

    readStream.pipe(res);
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ 
        message: "File retrieval failed",  
      });
    }
  }
};

// Delete File from GridFS
exports.deleteFile = async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!ObjectId.isValid(fileId)) {
      return res.status(400).json({ message: "Invalid file ID format" });
    }

    const gfs = getGfsComplicatedCases();
    await gfs.delete(new ObjectId(fileId));

    res.status(200).json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ 
      message: "File deletion failed", 

    });
  }
};
