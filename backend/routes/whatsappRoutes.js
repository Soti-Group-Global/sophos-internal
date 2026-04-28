const express = require("express");
const {
  validateCredentials,
  getChats,
  filterChats,
  sendMessage,
  getChatMessages,
  getMedia,
  sendDocument,
  markChatRead,
} = require("../controllers/whatsappController");

const router = express.Router();

router.get("/chats", validateCredentials, getChats);
router.get("/chats/filter", validateCredentials, filterChats);
router.post("/send", validateCredentials, sendMessage);
router.get("/chat/messages", validateCredentials, getChatMessages);
router.get("/media", validateCredentials, getMedia);
router.post("/document/send", validateCredentials, sendDocument);
router.post("/chat/read", validateCredentials, markChatRead);

module.exports = router;
