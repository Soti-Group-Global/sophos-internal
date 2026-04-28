require("dotenv").config();

const axios = require("axios");

const WAPPI_BASE_URL = process.env.WAPPI_BASE_URL || "https://wappi.pro";
const API_TOKEN = process.env.WAPPI_API_TOKEN;
const PROFILE_ID = process.env.WAPPI_PROFILE_ID_TELEGRAM;

const validateCredentials = (req, res, next) => {
  if (!API_TOKEN || !PROFILE_ID) {
    return res.status(500).json({ error: "API token or Telegram profile ID not configured" });
  }
  req.apiToken = API_TOKEN;
  req.profileId = PROFILE_ID;
  return next();
};

const getChats = async (req, res) => {
  try {
    const response = await axios.get(`${WAPPI_BASE_URL}/tapi/sync/chats/get`, {
      headers: { Authorization: req.apiToken },
      params: { profile_id: req.profileId },
    });
    return res.json(response.data);
  } catch (error) {
    return res
      .status(error.response?.status || 500)
      .json(error.response?.data || { error: "Server error" });
  }
};

const filterChats = async (req, res) => {
  const { client_name } = req.query;
  try {
    const response = await axios.get(`${WAPPI_BASE_URL}/tapi/sync/chats/filter`, {
      headers: { Authorization: req.apiToken },
      params: { profile_id: req.profileId, client_name: client_name || "" },
    });
    return res.json(response.data);
  } catch (error) {
    return res
      .status(error.response?.status || 500)
      .json(error.response?.data || { error: "Server error" });
  }
};

const sendMessage = async (req, res) => {
  const { chat_id, message } = req.body;
  if (!chat_id || !message) {
    return res.status(400).json({ error: "'chat_id' and 'message' are required" });
  }
  try {
    const response = await axios.post(
      `${WAPPI_BASE_URL}/tapi/sync/message/send`,
      { body: message, recipient: chat_id },
      {
        headers: { Authorization: req.apiToken },
        params: { profile_id: req.profileId },
      }
    );
    return res.json(response.data);
  } catch (error) {
    return res
      .status(error.response?.status || 500)
      .json(error.response?.data || { error: "Server error" });
  }
};

const getChatMessages = async (req, res) => {
  const { chat_id } = req.query;
  if (!chat_id) {
    return res.status(400).json({ error: "chat_id is required" });
  }
  try {
    const response = await axios.get(`${WAPPI_BASE_URL}/tapi/sync/messages/get`, {
      headers: { Authorization: req.apiToken },
      params: { profile_id: req.profileId, chat_id },
    });
    if (!response.data.messages) {
      return res.json([]);
    }
    const messages = response.data.messages || [];
    const uniqueMessages = Array.from(new Map(messages.map((msg) => [msg.id, msg])).values());
    return res.json(uniqueMessages);
  } catch (error) {
    return res.status(error.response?.status || 500).json({
      error: "Server error while fetching messages",
      details: error.response?.data || { detail: error.message },
    });
  }
};

const getMedia = async (req, res) => {
  const { message_id, profile_id } = req.query;
  if (!message_id || !profile_id) {
    return res.status(400).json({ error: "message_id and profile_id are required" });
  }

  try {
    const response = await axios.get(`${WAPPI_BASE_URL}/tapi/sync/message/media/download`, {
      headers: { Authorization: req.apiToken, Accept: "application/json" },
      params: { profile_id, message_id },
    });

    if (response.status !== 200 || !response.data.file_link) {
      return res.status(404).json({
        error: "Media not found or no download link provided",
        wappiResponse: response.data,
      });
    }
    const { file_link, file_name, mimetype } = response.data;
    return res.json({ status: "success", file_name, mime_type: mimetype, file_link });
  } catch (error) {
    return res.status(error.response?.status || 500).json({
      error: "Server error while fetching media data",
      details: error.response?.data || { detail: error.message },
      message_id,
      wappiError: error.response?.data,
    });
  }
};

const markChatRead = async (req, res) => {
  const { message_id } = req.body;
  if (!message_id) {
    return res.status(400).json({ error: "'message_id' is required" });
  }
  try {
    const response = await axios.post(
      `${WAPPI_BASE_URL}/tapi/sync/message/mark/read`,
      { message_id },
      {
        headers: { Authorization: req.apiToken },
        params: { profile_id: req.profileId },
      }
    );
    return res.json(response.data);
  } catch (error) {
    return res
      .status(error.response?.status || 500)
      .json(error.response?.data || { error: "Server error" });
  }
};

const sendDocument = async (req, res) => {
  const { chat_id, file_name, b64_file, caption } = req.body;
  if (!chat_id || !file_name || !b64_file) {
    return res.status(400).json({ error: "'chat_id', 'file_name', and 'b64_file' are required" });
  }

  let apiUrl;
  const fileType = b64_file.startsWith("/9j/")
    ? "img"
    : b64_file.startsWith("iVBOR")
      ? "img"
      : "document";
  switch (fileType) {
    case "img":
      apiUrl = `${WAPPI_BASE_URL}/tapi/async/message/img/send`;
      break;
    case "video":
      apiUrl = `${WAPPI_BASE_URL}/tapi/async/message/video/send`;
      break;
    case "document":
    default:
      apiUrl = `${WAPPI_BASE_URL}/tapi/async/message/document/send`;
      break;
  }

  const payload = {
    recipient: chat_id,
    file_name,
    b64_file,
    caption: caption || "",
    timeout_from: 1,
    timeout_to: 3,
  };

  try {
    const response = await axios.post(apiUrl, payload, {
      headers: { Authorization: req.apiToken },
      params: { profile_id: req.profileId },
    });
    return res.json(response.data);
  } catch (error) {
    return res
      .status(error.response?.status || 500)
      .json(error.response?.data || { error: "Server error while sending file" });
  }
};

const checkContact = async (req, res) => {
  const { phone } = req.query;
  if (!phone) {
    return res.status(400).json({ error: "Phone number is required" });
  }

  try {
    const response = await axios.get(`${WAPPI_BASE_URL}/tapi/sync/chats/filter`, {
      headers: { Authorization: req.apiToken },
      params: {
        profile_id: req.profileId,
        client_name: phone.replace(/\D/g, ""),
      },
    });

    const exists = response.data && response.data.dialogs && response.data.dialogs.length > 0;

    return res.json({ exists, phone });
  } catch (error) {
    return res.json({ exists: true, phone, note: "Validation unavailable" });
  }
};

module.exports = {
  validateCredentials,
  getChats,
  filterChats,
  sendMessage,
  getChatMessages,
  getMedia,
  markChatRead,
  sendDocument,
  checkContact,
};
