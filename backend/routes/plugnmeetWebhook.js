const express = require("express");
const { receiveWebhook } = require("../controllers/plugnmeetWebhookController");

const router = express.Router();

// PlugNmeet webhook receiver
// POST /api/plugnmeet/webhook
router.post("/webhook", receiveWebhook);

module.exports = router;

