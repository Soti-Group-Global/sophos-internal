const axios = require("axios");

const WAPPI_BASE_URL = process.env.WAPPI_BASE_URL || "https://wappi.pro";
const API_TOKEN = process.env.WAPPI_API_TOKEN;
const PROFILE_ID = process.env.WAPPI_PROFILE_ID_WHATSAPP;

const validateCredentials = (req, res, next) => {
  if (!API_TOKEN || !PROFILE_ID) {
    return res.status(500).json({ error: "Missing API credentials" });
  }
  req.apiToken = API_TOKEN;
  req.profileId = PROFILE_ID;
  next();
};

const getChats = async (req, res) => {
  try {
    const response = await axios.get(`${WAPPI_BASE_URL}/api/sync/chats/get`, {
      headers: { Authorization: req.apiToken },
      params: { profile_id: req.profileId, show_all: true },
    });
    res.json(response.data);
  } catch (error) {
    res
      .status(error.response?.status || 500)
      .json(error.response?.data || { error: "Server error" });
  }
};

const filterChats = async (req, res) => {
  const { client_name } = req.query;
  try {
    const response = await axios.get(
      `${WAPPI_BASE_URL}/api/sync/chats/filter`,
      {
        headers: { Authorization: req.apiToken },
        params: { profile_id: req.profileId, client_name: client_name || "" },
      }
    );
    res.json(response.data);
  } catch (error) {
    res
      .status(error.response?.status || 500)
      .json(error.response?.data || { error: "Server error" });
  }
};

const sendMessage = async (req, res) => {
  const { to, message } = req.body;
  if (!to || !message) {
    return res.status(400).json({ error: "'to' and 'message' are required" });
  }
  try {
    const response = await axios.post(
      `${WAPPI_BASE_URL}/api/sync/message/send`,
      { body: message, recipient: to },
      {
        headers: { Authorization: req.apiToken },
        params: { profile_id: req.profileId },
        timeout: 30000,
      }
    );
    res.json(response.data);
  } catch (error) {
    res
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
    const response = await axios.get(
      `${WAPPI_BASE_URL}/api/sync/messages/get`,
      {
        headers: { Authorization: req.apiToken },
        params: { profile_id: req.profileId, chat_id },
      }
    );
    const messages = response.data.messages || [];
    const uniqueMessages = Array.from(
      new Map(messages.map((msg) => [msg.id, msg])).values()
    );
    res.json(uniqueMessages);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: "Server error while fetching messages",
      details: error.response?.data || error.message,
    });
  }
};

const downloadMedia = async (req, res) => {
  const { message_id, profile_id } = req.query;
  if (!message_id || !profile_id) {
    return res
      .status(400)
      .json({ error: "message_id and profile_id are required" });
  }
  try {
    const response = await axios.get(
      `${WAPPI_BASE_URL}/api/sync/message/media/download`,
      {
        headers: { Authorization: req.apiToken, Accept: "application/json" },
        params: { profile_id, message_id },
      }
    );
    if (response.status !== 200 || !response.data.file_link) {
      return res
        .status(404)
        .json({ error: "Media not found or no download link provided" });
    }
    const { file_link, file_name, mimetype } = response.data;
    res.json({ status: "success", file_name, mime_type: mimetype, file_link });
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: "Server error while fetching media data",
      details: error.response?.data || error.message,
    });
  }
};

const sendDocument = async (req, res) => {
  const { to, file_name, file_data, file_type } = req.body;
  if (!to || !file_name || !file_data || !file_type) {
    return res
      .status(400)
      .json({
        error: "'to', 'file_name', 'file_data', and 'file_type' are required",
      });
  }
  try {
    const response = await axios.post(
      `${WAPPI_BASE_URL}/api/sync/message/document/send`,
      { recipient: to, file_name, b64_file: file_data, file_type },
      {
        headers: { Authorization: req.apiToken },
        params: { profile_id: req.profileId },
      }
    );
    res.json(response.data);
  } catch (error) {
    res
      .status(error.response?.status || 500)
      .json(error.response?.data || { error: "Server error" });
  }
};

const markMessageAsRead = async (req, res) => {
  const { message_id } = req.body;
  if (!message_id) {
    return res.status(400).json({ error: "'message_id' is required" });
  }
  try {
    const response = await axios.post(
      `${WAPPI_BASE_URL}/api/sync/message/mark/read`,
      { message_id },
      {
        headers: { Authorization: req.apiToken },
        params: { profile_id: req.profileId },
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: "Server error" });
  }
};

module.exports = {
  validateCredentials,
  getChats,
  filterChats,
  sendMessage,
  getChatMessages,
  getMedia: downloadMedia,
  sendDocument,
  markChatRead: markMessageAsRead,
};
