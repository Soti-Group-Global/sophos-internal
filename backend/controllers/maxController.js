const axios = require("axios");
const { getIO } = require("../socket");

const MAX_BASE_URL = process.env.MAX_BASE_URL || "https://wappi.pro";

// Cache for media file links to avoid repeated API calls
const mediaLinkCache = new Map();
const CACHE_DURATION = 3 * 24 * 60 * 60 * 1000; // 3 days (same as link expiry)

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const makeMaxRequest = async (method, endpoint, apiToken, queryParams = null, body = null) => {
  try {
    const url = queryParams
      ? `${MAX_BASE_URL}${endpoint}?${new URLSearchParams(queryParams).toString()}`
      : `${MAX_BASE_URL}${endpoint}`;

    const config = {
      method,
      url,
      headers: { Authorization: apiToken }
    };

    if (body) {
      config.data = body;
      config.headers['Content-Type'] = 'application/json';
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// ============================================================
// CONTROLLERS - CHATS
// ============================================================

// GET /api/max/chats - Get all chats
const getChats = async (req, res) => {
  try {
    const data = await makeMaxRequest("POST", "/maxapi/sync/chats/get", req.apiToken, {
      profile_id: req.profileId,
      limit: 50,
      show_all: false,
      offset: 0,
      order: "desc"
    });

    res.json({ chats: data.dialogs || [] });
  } catch (error) {
    res.status(error.response?.status || 500).json(
      error.response?.data || { error: "Failed to fetch chats" }
    );
  }
};

// GET /api/max/chats/filter - Filter chats by client name
const filterChats = async (req, res) => {
  try {
    const { client_name } = req.query;

    const data = await makeMaxRequest("POST", "/maxapi/sync/chats/get", req.apiToken, {
      profile_id: req.profileId,
      client_name: client_name || "",
      limit: 50,
      show_all: false,
      offset: 0,
      order: "desc"
    });

    res.json({ chats: data.dialogs || [] });
  } catch (error) {
    res.status(error.response?.status || 500).json(
      error.response?.data || { error: "Failed to filter chats" }
    );
  }
};

// ============================================================
// CONTROLLERS - MESSAGES
// ============================================================

// GET /api/max/chat/messages - Get messages for a chat
const getChatMessages = async (req, res) => {
  try {
    const { chat_id } = req.query;

    if (!chat_id) {
      return res.status(400).json({ error: "chat_id is required" });
    }

    // Use GET with query params (per Wappi documentation)
    const data = await makeMaxRequest("GET", "/maxapi/sync/messages/get", req.apiToken, {
      profile_id: req.profileId,
      chat_id: chat_id,
      limit: 100,
      offset: 0,
      order: "desc"
    });

    const messages = data.messages || [];

    // For media messages, fetch the download link (with caching)
    const messagesWithMedia = await Promise.all(
      messages.map(async (msg) => {
        // Check if message has media (image, video, document, audio)
        if (['image', 'video', 'document', 'audio', 'ptt'].includes(msg.type) && msg.id) {
          // Check if message has s3Info.url AND it's a sent message (fromMe: true)
          // Only use s3Info.url for messages we sent via API
          if (msg.s3Info && msg.s3Info.url && msg.fromMe) {
            return {
              ...msg,
              file_link: msg.s3Info.url,
              file_name: msg.file_name || msg.s3Info.url.split('/').pop()
            };
          }

          // For received messages or messages without s3Info, fetch from media download API
          // Check cache first - use chat_id + message_id as key to prevent cross-chat issues
          const cacheKey = `${msg.chatId || req.query.chat_id}_${msg.id}`;
          const cached = mediaLinkCache.get(cacheKey);
          if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            return {
              ...msg,
              file_link: cached.file_link,
              file_name: cached.file_name
            };
          }

          try {
            const mediaData = await makeMaxRequest("GET", "/maxapi/sync/message/media/download", req.apiToken, {
              profile_id: req.profileId,
              message_id: msg.id
            });

            // Extract filename from detail field
            let fileName = msg.file_name || 'file';
            if (mediaData.detail && mediaData.detail.includes(':')) {
              const parts = mediaData.detail.split(':');
              if (parts.length > 1) {
                fileName = parts[1].trim();
              }
            }

            // Cache the result with chat_id + message_id as key
            mediaLinkCache.set(cacheKey, {
              file_link: mediaData.file_link,
              file_name: fileName,
              timestamp: Date.now()
            });

            return {
              ...msg,
              file_link: mediaData.file_link,
              file_name: fileName
            };
          } catch (err) {
            return msg;
          }
        }
        return msg;
      })
    );

    res.json(messagesWithMedia);
  } catch (error) {
    res.status(error.response?.status || 500).json(
      error.response?.data || { error: "Failed to fetch messages" }
    );
  }
};

// POST /api/max/chat/read - Mark messages in chat as read
const markChatAsRead = async (req, res) => {
  try {
    const { chat_id } = req.body;

    if (!chat_id) {
      return res.status(400).json({ error: "chat_id is required" });
    }

    // First, get all messages from the chat to find unread ones
    const messagesData = await makeMaxRequest("GET", "/maxapi/sync/messages/get", req.apiToken, {
      profile_id: req.profileId,
      chat_id: chat_id,
      limit: 100,
      offset: 0,
      order: "desc"
    });

    const messages = messagesData.messages || [];

    // Find unread messages (messages not from me)
    const unreadMessages = messages.filter(msg => !msg.fromMe && msg.id);

    if (unreadMessages.length === 0) {
      return res.json({ success: true, markedCount: 0 });
    }

    // Mark each unread message as read
    const markPromises = unreadMessages.map(msg =>
      makeMaxRequest(
        "POST",
        "/maxapi/sync/message/mark/read",
        req.apiToken,
        { profile_id: req.profileId },
        { message_id: msg.id.toString() }
      ).catch(err => {
        return null;
      })
    );

    await Promise.all(markPromises);

    res.json({ success: true, markedCount: unreadMessages.length });
  } catch (error) {
    res.status(error.response?.status || 500).json(
      error.response?.data || { error: "Failed to mark chat as read" }
    );
  }
};

// ============================================================
// CONTROLLERS - SEND MESSAGES
// ============================================================

// POST /api/max/send - Send text message
const sendMessage = async (req, res) => {
  try {
    const { to, message } = req.body;

    // Check if 'to' is a phone number (starts with + or is very long) or a chat_id
    // Chat IDs are typically shorter numeric strings (8-10 digits)
    // Phone numbers with country codes are typically 11-15 digits and may start with +
    const isPhoneNumber = to.startsWith('+') || (to.length >= 11 && /^\d+$/.test(to));

    // For phone numbers, use 'recipient'; for chat_ids, use 'chat_id'
    const payload = isPhoneNumber
      ? { recipient: to, body: message }
      : { chat_id: to, body: message };

    const data = await makeMaxRequest(
      "POST",
      "/maxapi/sync/message/send",
      req.apiToken,
      { profile_id: req.profileId },
      payload
    );

    res.json(data);
  } catch (error) {
    res.status(error.response?.status || 500).json(
      error.response?.data || { error: "Failed to send message" }
    );
  }
};

// POST /api/max/document/send - Send file
const sendDocument = async (req, res) => {
  try {
    const { to, file_name, file_data, file_type } = req.body;

    // Determine if 'to' is a phone number or chat_id
    const isPhoneNumber = to.startsWith('+') || (to.length >= 11 && /^\d+$/.test(to));

    // Remove base64 prefix if present
    const base64Data = file_data.replace(/^data:.*?;base64,/, '');

    // Upload to catbox.moe - a reliable temporary file hosting service
    const FormData = require('form-data');
    const form = new FormData();
    const fileBuffer = Buffer.from(base64Data, 'base64');
    form.append('fileToUpload', fileBuffer, { filename: file_name });
    form.append('reqtype', 'fileupload');

    let fileUrl;
    try {
      const uploadResponse = await axios.post('https://catbox.moe/user/api.php', form, {
        headers: {
          ...form.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      // catbox.moe returns the URL as plain text
      fileUrl = uploadResponse.data.trim();

      if (!fileUrl.startsWith('http')) {
        throw new Error('Invalid URL received from upload service');
      }
    } catch (uploadError) {
      return res.status(500).json({ error: 'Failed to upload file to temporary storage' });
    }

    // Prepare payload
    const payload = {
      url: fileUrl,
      caption: ""
    };

    if (isPhoneNumber) {
      payload.recipient = to;
    } else {
      payload.chat_id = to;
    }

    // Max API async file sending - profile_id goes in query params
    const data = await makeMaxRequest(
      "POST",
      "/maxapi/async/message/file/url/send",
      req.apiToken,
      { profile_id: req.profileId },
      payload
    );

    res.json(data);
  } catch (error) {
    res.status(error.response?.status || 500).json(
      error.response?.data || { error: "Failed to send file" }
    );
  }
};

// GET /api/max/temp-file/:filename - Serve temporary file
const serveTempFile = (req, res) => {
  const path = require("path");
  const fs = require("fs");
  const tempFilePath = path.join(__dirname, '../temp', req.params.filename);

  if (!fs.existsSync(tempFilePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  res.sendFile(tempFilePath);
};

// ============================================================
// CONTROLLERS - WEBHOOKS
// ============================================================

// POST /api/max/webhook - Handle incoming webhook events
const handleWebhook = async (req, res) => {
  try {
    const payload = req.body;
    const io = getIO();
    const profileId = payload.profile_id;

    if (profileId) {
      io.to(profileId).emit("max:message", payload);
    } else {
      io.emit("max:message", payload);
    }

    res.status(200).send("OK");
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
};

// ============================================================
// CONTROLLERS - DEBUG/ADMIN
// ============================================================

// GET /api/max/profile/status - Get profile status
const getProfileStatus = async (req, res) => {
  try {
    const apiToken = process.env.MAX_API_TOKEN;
    const profileId = req.query.profile_id || process.env.MAX_PROFILE_ID;

    const response = await axios.get(`${MAX_BASE_URL}/maxapi/sync/get/status`, {
      headers: { Authorization: apiToken },
      params: { profile_id: profileId }
    });

    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(
      error.response?.data || { error: "Failed to get profile status" }
    );
  }
};

// GET /api/max/profiles - Get all profiles
const getAllProfiles = async (req, res) => {
  try {
    const apiToken = process.env.MAX_API_TOKEN;

    const response = await axios.get(`${MAX_BASE_URL}/maxapi/profile/all/get`, {
      headers: {
        Authorization: apiToken,
        'Content-Type': 'application/json'
      }
    });

    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(
      error.response?.data || { error: "Failed to get profiles" }
    );
  }
};

// GET /api/max/check-contact - Check if phone number is registered on Max
const checkContact = async (req, res) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({ error: "phone parameter is required" });
    }

    // Call Max API to check if contact is registered
    const data = await makeMaxRequest(
      "GET",
      "/maxapi/sync/contact/check",
      req.apiToken,
      {
        profile_id: req.profileId,
        phone: phone
      }
    );

    // API returns 'on_max' field to indicate if number is registered
    const result = {
      exists: data.on_max || false,
      phone: phone,
      chat_id: data.chat_id || null
    };

    res.json(result);
  } catch (error) {
    // Fallback to exists: true if API fails (don't block users)
    res.json({
      exists: true,
      phone: req.query.phone,
      warning: "Could not verify contact status"
    });
  }
};

module.exports = {
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
};
