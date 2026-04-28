const express = require("express");
const router = express.Router();
const {
  getChats,
  filterChats,
  getChatMessages,
  markChatAsRead,
  sendMessage,
  sendDocument,
  serveTempFile,
  handleWebhook,
  getProfileStatus,
  getAllProfiles,
  checkContact,
} = require("../controllers/maxController");

// ============================================================
// MIDDLEWARE
// ============================================================

const validateCredentials = (req, res, next) => {
  const apiToken = process.env.MAX_API_TOKEN;
  const profileId = req.query.profile_id || process.env.MAX_PROFILE_ID;

  if (!apiToken || !profileId) {
    return res.status(401).json({ error: "Missing API token or profile ID" });
  }

  req.apiToken = apiToken;
  req.profileId = profileId;
  next();
};

// ============================================================
// ROUTES - CHATS
// ============================================================

router.get("/chats", validateCredentials, getChats);
router.get("/chats/filter", validateCredentials, filterChats);

// ============================================================
// ROUTES - MESSAGES
// ============================================================

router.get("/chat/messages", validateCredentials, getChatMessages);
router.post("/chat/read", validateCredentials, markChatAsRead);

// ============================================================
// ROUTES - SEND MESSAGES
// ============================================================

router.post("/send", validateCredentials, sendMessage);
router.post("/document/send", validateCredentials, sendDocument);
router.get("/temp-file/:filename", serveTempFile);

// ============================================================
// ROUTES - WEBHOOKS
// ============================================================

router.post("/webhook", handleWebhook);

// ============================================================
// ROUTES - DEBUG/ADMIN
// ============================================================

router.get("/profile/status", getProfileStatus);
router.get("/profiles", getAllProfiles);
router.get("/check-contact", validateCredentials, checkContact);

module.exports = router;
