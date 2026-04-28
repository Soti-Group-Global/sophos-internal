const User = require("../models/User");
const UserNotification = require("../models/UserNotificationSchema");
const CommonNotification = require("../models/CommonNotification");
const moment = require("moment-timezone");

// PATCH /:id/read — Mark notification as read by role
const markAsReadByRole = async (req, res) => {
  const { role } = req.body;

  if (
    ![
      "patient",
      "doctor",
      "manager",
      "head_manager",
      "assistant",
      "head_doctor",
      "head_assistant",
      "specialist",
      "super_admin",
      "content_manager",
      "user",
    ].includes(role)
  ) {
    return res.status(400).json({ message: "Invalid role" });
  }

  try {
    const notification = await UserNotification.findByIdAndUpdate(
      req.params.id,
      { $set: { [`isRead.${role}`]: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.status(200).json({
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    res.status(500).json({ message: "Error marking as read" });
  }
};

// GET / — Get notifications by email
const getNotificationsByEmail = async (req, res) => {
  try {
    const email = req.query.email;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const userNotification = await UserNotification.findOne({ userId: user._id });
    if (!userNotification) {
      return res.json([]);
    }

    res.json(userNotification.notifications || []);
  } catch (error) {
    res.status(500).json({ message: "Server error while fetching notifications." });
  }
};

// PATCH /:notificationId/read — Mark a specific notification as read (personal or common)
const markSpecificNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const email = req.query.email || req.user?.email;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Try to find the notification in user's personal notifications
    const userNotification = await UserNotification.findOne({ userId: user._id });

    // First, check if it's a personal notification
    let personalNotification = null;
    if (userNotification) {
      personalNotification = userNotification.notifications.id(notificationId);
    }

    if (personalNotification) {
      // Personal notification logic
      if (personalNotification.isRead) {
        return res.status(200).json({ message: "Notification already marked as read." });
      }

      personalNotification.isRead = true;
      await userNotification.save();

      return res.json({ message: "Notification marked as read." });
    }

    // If not personal, maybe it's a common notification
    const commonNotification = await CommonNotification.findById(notificationId);
    if (!commonNotification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    const alreadyRead = commonNotification.isReadBy.includes(user._id.toString());
    if (alreadyRead) {
      return res.status(200).json({ message: "Common notification already marked as read." });
    }

    commonNotification.isReadBy.push(user._id.toString());
    await commonNotification.save();

    return res.json({ message: "Common notification marked as read." });

  } catch (error) {
    res.status(500).json({ message: "Server error." });
  }
};

// POST / — Create notification(s)
const createNotification = async (req, res) => {
  const { message, type = "info", users = [] } = req.body;

  if (!message?.en || !message?.ru) {
    return res.status(400).json({ error: "Message (en and ru) is required" });
  }

  const newNotification = {
    message,
    type,
    createdAt: moment.tz("Europe/Moscow").toDate(),
    isRead: false,
  };

  try {
    if (users.length > 0) {
      //  User-specific notifications
      for (const userId of users) {
        let record = await UserNotification.findOne({ userId });

        if (record) {
          record.notifications.push(newNotification);
          await record.save();
        } else {
          await UserNotification.create({
            userId,
            notifications: [newNotification],
          });
        }
      }
    } else {
      // Store a single common notification
      await CommonNotification.create({
        message,
        type: "common", // explicitly mark
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification(s) added successfully",
    });
  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      details: err.message || "An unexpected error occurred",
    });
  }
};

// GET /important — Get important notifications with user-specific read status
const getImportantNotifications = async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Fetch all important notifications from the database
    const notifications = await CommonNotification.find().sort({ createdAt: -1 });

    // Check if the user has read the notification (i.e., user is in `isReadBy` array)
    const notificationsWithReadStatus = notifications.map((n) => {
      const isRead = n.isReadBy && n.isReadBy.includes(user._id.toString());
      return {
        ...n.toObject(),
        isRead, // Add the user-specific read status
      };
    });

    res.status(200).json(notificationsWithReadStatus);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// GET /get — Get all common notifications
const getAllNotifications = async (req, res) => {
  try {
    const notifications = await CommonNotification.find()
      .sort({ createdAt: -1 })
      .exec();

    return res.status(200).json({ notifications });
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching notifications' });
  }
};

// GET /common — Get common notifications
const getCommonNotifications = async (req, res) => {
  try {
    const notifications = await CommonNotification.find()
      .sort({ createdAt: -1 })
      .exec();
    return res.status(200).json({ notifications });
  } catch (error) {
    return res.status(500).json({ message: "Error fetching notifications" });
  }
};

// GET /personal — Get personal notifications
const getPersonalNotifications = async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ message: "Missing email" });
  }

  try {
    const notifications = await UserNotification.find()
    .sort({ createdAt: -1 });

    return res.status(200).json({ notifications });
  } catch (error) {
    return res.status(500).json({ message: "Error fetching personal notifications" });
  }
};

module.exports = {
  markAsReadByRole,
  getNotificationsByEmail,
  markSpecificNotificationAsRead,
  createNotification,
  getImportantNotifications,
  getAllNotifications,
  getCommonNotifications,
  getPersonalNotifications,
};
