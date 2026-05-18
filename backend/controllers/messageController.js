const mongoose = require("mongoose");
const Message = require("../models/messageSchema");
const { getGfsMessages } = require("../gridfs-messages");
const path = require("path");
const fs = require("fs");
const { ObjectId } = mongoose.Types;
const User = require("../models/User");
const Manager = require("../models/Manager");

const { getIO } = require("../socket");

exports.sendMessage = async (req, res) => {
  try {
    const { text, sender, receiver, file, replyTo } = req.body;

    // Validate sender & receiver
    if (!sender?.email || !receiver?.email) {
      return res.status(400).json({
        success: false,
        message: "Sender and receiver are required.",
      });
    }

    // Require at least text or file
    if (!text?.trim() && !file) {
      return res.status(400).json({
        success: false,
        message: "Message must include text or a file.",
      });
    }

    // Create message
    const message = await Message.create({
      text,
      sender,
      receiver,
      file,
      replyTo,
      timestamp: new Date(),
      isRead: false,
    });

    // Emit socket event to receiver and sender (for real-time updates)
    try {
      const io = getIO();
      // Use email as room name for simplicity
      io.to(receiver.email).emit("message:new", { message });
      io.to(sender.email).emit("message:new", { message });
    } catch (err) {
    }

    res.status(201).json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMessagesBetweenUsers = async (req, res) => {
  try {
    const { user1, user2 } = req.params;

    if (!user1 || !user2) {
      return res.status(400).json({
        success: false,
        message: "Both user emails are required.",
      });
    }

    let messages = [];

    // If the chat involves the manager group
    if (user2 === "manager_group@system" || user1 === "manager_group@system") {
      const currentUserEmail = user1 === "manager_group@system" ? user2 : user1;

      messages = await Message.find({
        $or: [
          {
            "sender.email": currentUserEmail,
            "receiver.role": "manager",
          },
          {
            "sender.role": "manager",
            "receiver.email": currentUserEmail,
          },
        ],
      })
        .sort({ timestamp: 1 })
        .lean();
    } else {
      // Normal one-to-one conversation
      messages = await Message.find({
        $or: [
          { "sender.email": user1, "receiver.email": user2 },
          { "sender.email": user2, "receiver.email": user1 },
        ],
      })
        .sort({ timestamp: 1 })
        .lean();
    }

    // Collect all manager emails
    const managerEmails = [
      ...new Set(
        messages.flatMap((msg) => {
          const emails = [];
          if (msg.sender?.role === "manager") emails.push(msg.sender.email);
          if (msg.receiver?.role === "manager") emails.push(msg.receiver.email);
          return emails;
        })
      ),
    ];

    // Fetch manager details
    const managers = await Manager.find(
      { email: { $in: managerEmails } },
      "email firstName middleName lastName"
    ).lean();

    const managerMap = managers.reduce((acc, m) => {
      acc[m.email] = [m.firstName, m.middleName, m.lastName]
        .filter(Boolean)
        .join(" ");
      return acc;
    }, {});

    // Clean + attach names
    const messagesWithNames = messages.map((msg) => {
      const sender = { ...msg.sender };
      const receiver = { ...msg.receiver };

      if (sender.role === "manager" && managerMap[sender.email]) {
        sender.name = managerMap[sender.email];
      }
      if (receiver.role === "manager" && managerMap[receiver.email]) {
        receiver.name = managerMap[receiver.email];
      }

      // Return flattened, safe message object
      return {
        _id: msg._id,
        text: msg.text,
        file: msg.file || {},
        timestamp: msg.timestamp,
        isRead: msg.isRead,
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt,
        sender,
        receiver,
      };
    });

    res.status(200).json({
      success: true,
      messages: messagesWithNames,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getUserMessages = async (req, res) => {
  try {
    const { email } = req.params;

    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "Email parameter is required." });

    const messages = await Message.find({
      $or: [{ "sender.email": email }, { "receiver.email": email }],
    }).sort({ timestamp: -1 });

    res.status(200).json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.markMessagesAsRead = async (req, res) => {
  try {
    const { receiverEmail, senderEmail } = req.body;

    if (!receiverEmail || !senderEmail) {
      return res.status(400).json({
        success: false,
        message: "receiverEmail and senderEmail are required.",
      });
    }

    let updateFilter = {
      "receiver.email": receiverEmail,
      isRead: false,
    };

    if (senderEmail === "manager_group@system") {
      updateFilter["sender.role"] = "manager";
    } else {
      updateFilter["sender.email"] = senderEmail;
    }

    const result = await Message.updateMany(updateFilter, {
      $set: { isRead: true },
    });

    res.status(200).json({
      success: true,
      message: "Marked as read",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.uploadFile = async (req, res) => {
  try {
    if (!req.file)
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });

    const gfs = getGfsMessages();
    const filename = `${Date.now()}_${req.file.originalname}`;

    const uploadStream = gfs.openUploadStream(filename, {
      contentType: req.file.mimetype,
      metadata: {
        uploadedBy: req.user?.id || "anonymous",
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

    const fileType = req.file.mimetype.startsWith("image/")
      ? "image"
      : "document";

    res.status(200).json({
      success: true,
      fileId,
      fileUrl: `/api/messages/file-by-id/${fileId}`,
      fileType,
      fileName: req.file.originalname,
      fileSize: req.file.size,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "File upload failed",    });
  }
};

exports.getFileById = async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!ObjectId.isValid(fileId))
      return res.status(400).json({ message: "Invalid file ID format" });

    const gfs = getGfsMessages();
    const files = await gfs.find({ _id: new ObjectId(fileId) }).toArray();

    if (!files?.length)
      return res.status(404).json({ message: "File not found" });

    res.set("Content-Type", files[0].contentType);
    res.set("Cache-Control", "public, max-age=31536000");
    res.set("Content-Disposition", `inline; filename="${files[0].filename}"`);

    const readStream = gfs.openDownloadStream(new ObjectId(fileId));
    readStream.on("error", (err) => {
      if (!res.headersSent) res.status(404).end();
    });
    readStream.pipe(res);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getUnreadCounts = async (req, res) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email parameter is required.",
      });
    }

    let unreadMessages = [];

    // CASE 1: Skip virtual group
    if (email === "manager_group@system") {
      return res.status(200).json({
        success: true,
        unread: {},
        managerUnread: {},
        otherUnread: {},
      });
    }

    // Fetch unread messages received by the user
    unreadMessages = await Message.aggregate([
      {
        $match: {
          "receiver.email": email,
          isRead: false,
        },
      },
      {
        $group: {
          _id: {
            senderEmail: "$sender.email",
            senderRole: "$sender.role",
          },
          count: { $sum: 1 },
        },
      },
    ]);

    // Split into categories
    const managerUnread = {};
    const otherUnread = {};

    unreadMessages.forEach((msg) => {
      const email = msg._id.senderEmail;
      const role = msg._id.senderRole;
      const count = msg.count;

      if (role === "manager") {
        managerUnread[email] = count;
      } else {
        otherUnread[email] = count;
      }
    });

    // Combine for total map
    const unreadMap = { ...managerUnread, ...otherUnread };

    res.status(200).json({
      success: true,
      unread: unreadMap,
      managerUnread,
      otherUnread,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
