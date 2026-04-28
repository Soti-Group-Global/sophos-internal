const mongoose = require("mongoose");
const DoctorMessage = require("../models/DoctorMessage");
const { getGfsMessages } = require("../gridfs-messages");
const { setAuditLogContext } = require("../utils/auditLogHelper");

const { ObjectId } = mongoose.Types;

const getMessagesByEmail = async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    const docMsg = await DoctorMessage.findOne({ email });
    return res.status(200).json({ messages: docMsg ? docMsg.messages : [] });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

const sendMessage = async (req, res) => {
  const { text, recipientEmail, replyTo, fileId, fileUrl, fileType, fileName } = req.body;

  if (!text && !fileId) {
    return res.status(400).json({ message: "Either text or file is required" });
  }
  if (!recipientEmail) {
    return res.status(400).json({ message: "Recipient email is required" });
  }

  try {
    const managerEmail = req.user.email;
    const newMessage = {
      text: text || "",
      user: "Manager",
      timestamp: new Date(),
      ...(replyTo && { replyTo }),
      ...(fileId && { fileId, fileUrl, fileType, fileName }),
    };

    let managerMsg = await DoctorMessage.findOne({ email: managerEmail });
    if (!managerMsg) {
      managerMsg = await DoctorMessage.create({
        email: managerEmail,
        messages: [newMessage],
      });
    } else {
      managerMsg.messages.push(newMessage);
      if (managerMsg.messages.length > 50) {
        managerMsg.messages = managerMsg.messages.slice(-50);
      }
      await managerMsg.save();
    }

    let recipientMsg = await DoctorMessage.findOne({ email: recipientEmail });
    if (!recipientMsg) {
      recipientMsg = await DoctorMessage.create({
        email: recipientEmail,
        messages: [newMessage],
      });
    } else {
      recipientMsg.messages.push(newMessage);
      if (recipientMsg.messages.length > 50) {
        recipientMsg.messages = recipientMsg.messages.slice(-50);
      }
      await recipientMsg.save();
    }

    setAuditLogContext(req, {
      actionType: "CREATE",
      entity: "DoctorMessage",
      message: `Sent message to ${recipientEmail}`,
    });

    return res.status(200).json({ message: newMessage });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

const deleteMessage = async (req, res) => {
  const { email, messageId } = req.params;
  const managerEmail = req.user.email;

  try {
    if (!ObjectId.isValid(messageId)) {
      return res.status(400).json({ message: "Invalid message ID format" });
    }

    const docMsg = await DoctorMessage.findOne({ email: decodeURIComponent(email) });
    if (!docMsg) {
      return res.status(404).json({ message: "Message list not found for specified email" });
    }

    const message = docMsg.messages.find((m) => m._id.toString() === messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found in specified email thread" });
    }

    let fileDeleted = false;
    if (message.fileId) {
      const gfs = getGfsMessages();
      try {
        await gfs.delete(new ObjectId(message.fileId));
        fileDeleted = true;
      } catch (err) {
        // ignore file delete errors
      }
    }

    docMsg.messages = docMsg.messages.filter((m) => m._id.toString() !== messageId);
    await docMsg.save();

    const managerMsg = await DoctorMessage.findOne({ email: managerEmail });
    if (managerMsg) {
      const managerMessage = managerMsg.messages.find((m) => m._id.toString() === messageId);
      if (managerMessage) {
        if (!fileDeleted && managerMessage.fileId) {
          const gfs = getGfsMessages();
          try {
            await gfs.delete(new ObjectId(managerMessage.fileId));
          } catch (err) {
            // ignore file delete errors
          }
        }
        managerMsg.messages = managerMsg.messages.filter((m) => m._id.toString() !== messageId);
        await managerMsg.save();
      }
    }

    setAuditLogContext(req, {
      actionType: "DELETE",
      entity: "DoctorMessage",
      entityId: messageId,
      message: `Deleted message ${messageId} in thread ${decodeURIComponent(email)}`,
    });

    return res.status(200).json({ message: "Message deleted successfully" });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

const uploadMessageFile = async (req, res) => {
  try {
    if (!req.file) {
      if (req.fileFilterError) {
        return res.status(400).json({
          success: false,
          message: req.fileFilterError.message,
        });
      }
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const gfs = getGfsMessages();
    const filename = `${Date.now()}_${req.file.originalname}`;

    const uploadStream = gfs.openUploadStream(filename, {
      contentType: req.file.mimetype,
      metadata: {
        uploadedBy: req.user.id,
        originalName: req.file.originalname,
      },
    });

    const fileId = uploadStream.id;
    uploadStream.end(req.file.buffer);

    await new Promise((resolve, reject) => {
      uploadStream.on("finish", () => resolve());
      uploadStream.on("error", (err) => reject(err));
    });

    return res.status(200).json({
      success: true,
      fileId,
      fileUrl: `/api/messages/file-by-id/${fileId}`,
      fileType: req.file.mimetype.startsWith("image/") ? "image" : "document",
      fileName: req.file.originalname,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "File processing failed",
      error: err.message,
    });
  }
};

const getMessageFileById = async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid file ID format" });
    }

    const gfs = getGfsMessages();
    const fileId = new ObjectId(req.params.id);

    const files = await gfs.find({ _id: fileId }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ message: "File not found" });
    }

    res.set("Content-Type", files[0].contentType);
    res.set("Cache-Control", "public, max-age=31536000");
    res.set("Content-Disposition", `inline; filename=\"${files[0].filename}\"`);

    const readStream = gfs.openDownloadStream(fileId);
    readStream.on("error", () => {
      if (!res.headersSent) {
        res.status(404).end();
      }
    });
    readStream.pipe(res);
  } catch (err) {
    return res.status(500).json({ message: "Error retrieving file" });
  }
};

module.exports = {
  getMessagesByEmail,
  sendMessage,
  deleteMessage,
  uploadMessageFile,
  getMessageFileById,
};
