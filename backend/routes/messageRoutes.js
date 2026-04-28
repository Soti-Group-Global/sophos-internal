const express = require("express");
const router = express.Router();
const multer = require("multer");
const messageController = require("../controllers/messageController");

// Use memory storage for GridFS
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Routes
router.post("/send", messageController.sendMessage);
router.get("/between/:user1/:user2", messageController.getMessagesBetweenUsers);
router.get("/user/:email", messageController.getUserMessages);
router.put("/mark-read", messageController.markMessagesAsRead);

// File upload & retrieval
router.post("/upload", upload.single("file"), messageController.uploadFile);
router.get("/file-by-id/:fileId", messageController.getFileById);

router.put("/mark-read", messageController.markMessagesAsRead);
router.get("/unread/:email", messageController.getUnreadCounts);

module.exports = router;
