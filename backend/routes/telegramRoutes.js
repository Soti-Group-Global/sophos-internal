require("dotenv").config();

const express = require("express");
const {
  validateCredentials,
  getChats,
  filterChats,
  sendMessage,
  getChatMessages,
  getMedia,
  markChatRead,
  sendDocument,
  checkContact,
} = require("../controllers/telegramController");

const router = express.Router();

router.get("/chats", validateCredentials, getChats);
router.get("/chats/filter", validateCredentials, filterChats);
router.post("/send", validateCredentials, sendMessage);
router.get("/chat/messages", validateCredentials, getChatMessages);
router.get("/media", validateCredentials, getMedia);
router.post("/chat/read", validateCredentials, markChatRead);
router.post("/document/send", validateCredentials, sendDocument);
router.get("/check-contact", validateCredentials, checkContact);

module.exports = router;
