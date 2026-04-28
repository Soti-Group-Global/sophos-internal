const express = require("express");
const router = express.Router();
const {
  markAsReadByRole,
  getNotificationsByEmail,
  markSpecificNotificationAsRead,
  createNotification,
  getImportantNotifications,
  getAllNotifications,
  getCommonNotifications,
  getPersonalNotifications,
} = require("../controllers/notificationController");

// GET /api/notifications — Get notifications by email
router.get("/", getNotificationsByEmail);

// GET /api/notifications/important — Get important notifications with read status
router.get("/important", getImportantNotifications);

// GET /api/notifications/get — Get all common notifications
router.get("/get", getAllNotifications);

// GET /api/notifications/common — Get common notifications
router.get("/common", getCommonNotifications);

// GET /api/notifications/personal — Get personal notifications
router.get("/personal", getPersonalNotifications);

// POST /api/notifications — Create notification(s)
router.post("/", createNotification);

// PATCH /api/notifications/:id/read — Mark notification as read by role
router.patch("/:id/read", markAsReadByRole);

// PATCH /api/notifications/:notificationId/read — Mark specific notification as read
router.patch("/:notificationId/read", markSpecificNotificationAsRead);

module.exports = router;
