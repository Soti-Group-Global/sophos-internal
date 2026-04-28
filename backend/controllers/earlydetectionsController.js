const mongoose = require("mongoose");
const EarlyDetection = require("../models/EarlyDetection");
const Patient = require("../models/Patient");
const Order = require("../models/Order");
const { ObjectId } = mongoose.Types;

// GET all EarlyDetection applications
const getAllEarlyDetections = async (req, res) => {
  try {
    const detections = await EarlyDetection.find().lean();

    const results = await Promise.all(
      detections.map(async (detection) => {
        const {
          applicationId,
          patientEmail,
          serviceType,
          appointments,
          documents,
          comments,
          payments,
          serviceOrders,
        } = detection;

        const patient = await Patient.findOne({ email: patientEmail }).lean();
        const fullName = patient
          ? `${patient.lastName || ""} ${patient.firstName || ""} ${patient.middleName || ""}
            `.trim()
          : "Unknown";

        return {
          applicationId,
          patientEmail,
          patientName: fullName,
          serviceType,
          appointments,
          documents,
          comments,
          payments,
          serviceOrders,
        };
      })
    );

    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
};

// GET single early detection for doctor
const getDoctorSingleDetection = async (req, res) => {
  const { applicationId, doctorEmail } = req.query;

  if (!applicationId || !doctorEmail) {
    return res
      .status(400)
      .json({ error: "applicationId and doctorEmail are required" });
  }

  try {
    const detection = await EarlyDetection.findOne({ applicationId }).lean();
    if (!detection) {
      return res.status(404).json({ error: "Application not found" });
    }

    const appointments = detection.appointments.filter(
      (appt) => appt.doctorEmail === doctorEmail
    );

    const otherAppointments = detection.appointments
      .filter((appt) => appt.doctorEmail !== doctorEmail)
      .map((appt) => ({
        doctorEmail: appt.doctorEmail,
        date: appt.date,
        startTime: appt.startTime,
        endTime: appt.endTime,
        appointmentStatus: appt.appointmentStatus,
      }));

    const patient = await Patient.findOne({
      email: detection.patientEmail,
    }).lean();
    const patientName = patient
      ? `${patient.lastName || ""} ${patient.firstName || ""} ${patient.middleName || ""}
        `.trim()
      : "Unknown";

    const orders = await Order.find({ appointmentId: applicationId }).lean();

    res.status(200).json({
      applicationId: detection.applicationId,
      patientEmail: detection.patientEmail,
      patientName,
      serviceType: detection.serviceType,
      documents: detection.documents,
      comments: detection.comments,
      appointments,
      otherAppointments,
      orders,
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

// Update Prescription
const updatePrescription = async (req, res) => {
  const { applicationId } = req.params;
  const { text, doctorEmail } = req.body;

  if (!text || !doctorEmail) {
    return res
      .status(400)
      .json({ error: "Text and doctorEmail are required." });
  }

  try {
    const application = await EarlyDetection.findOne({
      applicationId,
      "appointments.doctorEmail": doctorEmail,
    });

    if (!application) {
      return res
        .status(404)
        .json({ error: "Application or appointment not found." });
    }

    const appointment = application.appointments.find(
      (appt) => appt.doctorEmail === doctorEmail
    );

    if (!appointment) {
      return res
        .status(404)
        .json({ error: "Appointment not found for this doctor." });
    }

    appointment.prescription = {
      text,
      verificationStatus: "Verified",
    };

    await application.save();
    res.status(200).json(application);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

// Update Conclusion
const updateConclusion = async (req, res) => {
  const { applicationId } = req.params;
  const { text, doctorEmail } = req.body;

  if (!text || !doctorEmail) {
    return res
      .status(400)
      .json({ error: "Text and doctorEmail are required." });
  }

  try {
    const application = await EarlyDetection.findOne({
      applicationId,
      "appointments.doctorEmail": doctorEmail,
    });

    if (!application) {
      return res
        .status(404)
        .json({ error: "Application or appointment not found." });
    }

    const appointment = application.appointments.find(
      (appt) => appt.doctorEmail === doctorEmail
    );

    if (!appointment) {
      return res
        .status(404)
        .json({ error: "Appointment not found for this doctor." });
    }

    appointment.conclusion = {
      text,
      verificationStatus: "Verified",
    };

    await application.save();
    res.status(200).json(application);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

// Upload document
const uploadDocument = async (req, res) => {
  try {
    const applicationId = req.params.id;
    const file = req.file;

    if (!applicationId) {
      return res.status(400).json({ message: "Application ID is required" });
    }

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "media",
    });

    const uploadStream = bucket.openUploadStream(file.originalname, {
      contentType: file.mimetype,
    });

    const fileId = uploadStream.id;
    uploadStream.end(file.buffer);

    uploadStream.on("finish", async () => {
      const updatedApp = await EarlyDetection.findOneAndUpdate(
        { applicationId },
        {
          $push: {
            documents: {
              filename: file.originalname,
              fileId,
              uploadedAt: new Date(),
              verificationStatus: "Verified",
            },
          },
        },
        { new: true }
      );

      if (!updatedApp) {
        return res.status(404).json({ message: "Application not found" });
      }

      res.status(200).json(updatedApp);
    });

    uploadStream.on("error", (err) => {
      res.status(500).json({ message: "Upload failed", error: err.message });
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Upload document file
const uploadDocumentFile = async (req, res) => {
  try {
    const applicationId = decodeURIComponent(req.params.id);
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No file received" });
    }

    const earlyDetection = await EarlyDetection.findOne({ applicationId });
    if (!earlyDetection) {
      return res.status(404).json({ message: "Application not found" });
    }

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "media",
    });

    const uploadStream = bucket.openUploadStream(file.originalname, {
      contentType: file.mimetype,
    });
    uploadStream.end(file.buffer);

    const fileId = await new Promise((resolve, reject) => {
      uploadStream.on("finish", () => resolve(uploadStream.id));
      uploadStream.on("error", reject);
    });

    earlyDetection.documents.push({
      filename: file.originalname,
      fileId,
      verificationStatus: "Verified",
      uploadedAt: new Date(),
    });

    await earlyDetection.save();

    res.status(201).json({
      message: "File uploaded successfully",
      applicationId: earlyDetection.applicationId,
      documents: earlyDetection.documents,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "File upload failed", error: error.message });
  }
};

// Upload document URL
const uploadDocumentUrl = async (req, res) => {
  try {
    const applicationId = decodeURIComponent(req.params.id);
    const { url, filename } = req.body;

    if (!url) {
      return res.status(400).json({ message: "URL is required" });
    }

    const earlyDetection = await EarlyDetection.findOne({ applicationId });
    if (!earlyDetection) {
      return res.status(404).json({ message: "Application not found" });
    }

    earlyDetection.documents.push({
      filename: filename || "Cloud Link",
      fileId: null,
      url: url.trim(),
      verificationStatus: "Verified",
      uploadedAt: new Date(),
    });

    await earlyDetection.save();

    res.status(201).json({
      message: "URL uploaded successfully",
      applicationId: earlyDetection.applicationId,
      documents: earlyDetection.documents,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "URL upload failed", error: error.message });
  }
};

// Get document by ID
const getDocumentById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid file ID format" });
    }

    const fileId = new ObjectId(id);
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "media",
    });

    const files = await bucket.find({ _id: fileId }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ message: "Document not found" });
    }

    res.set("Content-Type", files[0].contentType || "application/octet-stream");
    const readStream = bucket.openDownloadStream(fileId);

    readStream.on("error", (err) => {
      if (!res.headersSent) {
        res
          .status(500)
          .json({ message: "Error streaming document", error: err.message });
      }
    });

    readStream.pipe(res);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error retrieving document", error: err.message });
  }
};

// Update verification status
const updateVerification = async (req, res) => {
  const { id } = req.params;
  const { type, field, status, doctorEmail } = req.body;

  try {
    const application = await EarlyDetection.findOne({ applicationId: id });

    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    if (type === "document") {
      const doc = application.documents.find(
        (d) => String(d.fileId) === String(field)
      );
      if (doc) {
        doc.verificationStatus = status;
      } else {
        return res.status(404).json({ error: "Document not found" });
      }
    } else if (["prescription", "conclusion"].includes(type)) {
      const appointment = application.appointments.find(
        (a) => a.doctorEmail === doctorEmail
      );
      if (!appointment) {
        return res
          .status(404)
          .json({ error: "Matching appointment not found for doctor" });
      }

      if (!appointment[type]) {
        appointment[type] = {};
      }

      appointment[type].verificationStatus = status;
    } else {
      return res.status(400).json({ error: "Invalid verification type" });
    }

    await application.save();
    res.json({ message: "Verification status updated", application });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

// Update comment
const updateComment = async (req, res) => {
  const { applicationId, commentId } = req.params;
  const { text, edited, editTimestamp } = req.body;

  try {
    const application = await EarlyDetection.findOne({ applicationId });
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    const comment = application.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }

    comment.text = text;
    comment.edited = edited;
    comment.editTimestamp = editTimestamp;

    await application.save();
    res.json(comment);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// Add comment
const addComment = async (req, res) => {
  const applicationId = decodeURIComponent(req.params.applicationId);
  const { comments } = req.body;

  const newComment = Array.isArray(comments)
    ? comments[comments.length - 1]
    : comments;

  try {
    const application = await EarlyDetection.findOneAndUpdate(
      { applicationId },
      { $push: { comments: newComment } },
      { new: true }
    );

    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    res.json(application);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete comment
const deleteComment = async (req, res) => {
  const { applicationId, commentId } = req.params;

  try {
    const application = await EarlyDetection.findOne({ applicationId });
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    const commentIndex = application.comments.findIndex(
      (comment) => comment._id.toString() === commentId
    );

    if (commentIndex === -1) {
      return res.status(404).json({ error: "Comment not found" });
    }

    application.comments.splice(commentIndex, 1);
    await application.save();

    res.json({
      success: true,
      message: "Comment deleted successfully",
      applicationId,
      commentId,
    });
  } catch (err) {
    res.status(500).json({
      error: "Internal server error",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Add multiple tests
const addMultipleTests = async (req, res) => {
  try {
    const { tests } = req.body;
    const applicationId = req.params.applicationId;

    const application = await EarlyDetection.findOne({ applicationId });
    if (!application) {
      return res
        .status(404)
        .json({ message: "Early Detection Application not found" });
    }

    if (!Array.isArray(tests) || tests.length === 0) {
      return res.status(400).json({ message: "No tests provided" });
    }

    const orderPromises = tests.map(async (test) => {
      const newOrder = new Order({
        orderId: null,
        appointmentId: applicationId,
        testId: test.testId,
        testName: test.testName,
        vendorId: null,
        vendorName: test.vendorName || null,
        status: "Waiting for Assign",
      });

      await newOrder.save();
      return newOrder._id;
    });

    const orderIds = await Promise.all(orderPromises);

    res.json({
      message: "Tests added successfully. Orders created.",
      orderCount: orderIds.length,
      orderIds,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error while saving tests" });
  }
};

module.exports = {
  getAllEarlyDetections,
  getDoctorSingleDetection,
  updatePrescription,
  updateConclusion,
  uploadDocument,
  uploadDocumentFile,
  uploadDocumentUrl,
  getDocumentById,
  updateVerification,
  updateComment,
  addComment,
  deleteComment,
  addMultipleTests,
};
