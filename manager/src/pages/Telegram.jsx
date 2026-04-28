import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import MessagesContainer from "./MessagesContainer";
import { FaTelegramPlane, FaSearch, FaPlus, FaImage, FaVideo, FaFile, FaTimes } from "react-icons/fa";
import defaultUserPfp from "../assets/default-user.png";
import defaultGroupPfp from "../assets/default-group.png";
import "../styles/Telegram.css";

const Telegram = () => {
  const { t } = useTranslation("telegram_messenger");
  const { VITE_WAPPI_API_TOKEN, VITE_WAPPI_PROFILE_ID, VITE_WAPPI_BASE_URL } = import.meta.env;
  const [chats, setChats] = useState([]);
  const [filteredChats, setFilteredChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState("");
  const [showAttachmentOptions, setShowAttachmentOptions] = useState(false);
  const [showNewContactDialog, setShowNewContactDialog] = useState(false);
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactMessage, setNewContactMessage] = useState("");
  const [validatingPhone, setValidatingPhone] = useState(false);
  const [phoneValidationError, setPhoneValidationError] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [base64File, setBase64File] = useState("");
  const [fileType, setFileType] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewMessage, setPreviewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendingAttachment, setSendingAttachment] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const baseUrl = import.meta.env.VITE_BASE_URL;
  const selectedChatRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const attachmentMenuRef = useRef(null);
  const chatOrderRef = useRef(new Map());
  const messagesRequestSeqRef = useRef(0);
  const POLLING_INTERVAL = 3000; // Poll every 3 seconds

  const getChatSortTimestamp = (chat) => {
    const candidates = [
      chat?.last_message_time,
      chat?.lastMessageTime,
      chat?.last_message_date,
      chat?.lastMessageDate,
      chat?.updated_at,
      chat?.updatedAt,
      chat?.date,
      chat?.time,
    ];

    for (const c of candidates) {
      if (c === undefined || c === null || c === "") continue;
      if (typeof c === "number") return c > 1e12 ? Math.floor(c / 1000) : c;
      const parsedNum = Number(c);
      if (!Number.isNaN(parsedNum) && parsedNum > 0) {
        return parsedNum > 1e12 ? Math.floor(parsedNum / 1000) : parsedNum;
      }
      const parsedDate = new Date(c).getTime();
      if (!Number.isNaN(parsedDate)) return Math.floor(parsedDate / 1000);
    }
    return 0;
  };

  const sortChatsStable = (dialogs) => {
    const prevOrder = chatOrderRef.current;
    const sorted = [...dialogs].sort((a, b) => {
      const ta = getChatSortTimestamp(a);
      const tb = getChatSortTimestamp(b);
      if (tb !== ta) return tb - ta;

      const aPrev = prevOrder.get(a.id);
      const bPrev = prevOrder.get(b.id);
      if (aPrev !== undefined && bPrev !== undefined && aPrev !== bPrev) {
        return aPrev - bPrev;
      }

      const nameCmp = (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
      if (nameCmp !== 0) return nameCmp;
      return String(a.id || "").localeCompare(String(b.id || ""));
    });

    chatOrderRef.current = new Map(sorted.map((c, i) => [c.id, i]));
    return sorted;
  };

  const fetchChats = useCallback(async (silent = false) => {
    try {
      const response = await axios.get(`${baseUrl}/api/telegram/chats`);
      const dialogs = response.data.dialogs || [];
      const sortedDialogs = sortChatsStable(dialogs);
      setChats(sortedDialogs);
      // Only update filteredChats if no filter is active
      if (!filter) {
        setFilteredChats(sortedDialogs);
      } else {
        const filtered = sortedDialogs.filter((chat) =>
          chat.name.toLowerCase().includes(filter.toLowerCase())
        );
        setFilteredChats(filtered);
      }
    } catch (error) {
      if (!silent) {
      }
    }
  }, [baseUrl, filter]);

  const fetchMessages = useCallback(async (chatId, silent = false) => {
    const requestSeq = ++messagesRequestSeqRef.current;

    if (!silent) {
      setLoadingMessages(true);
      setMessages([]);
    }
    try {
      const response = await axios.get(`${baseUrl}/api/telegram/chat/messages`, {
        params: { chat_id: chatId },
      });

      // Ignore stale responses from previous chat switches/requests
      if (
        requestSeq !== messagesRequestSeqRef.current ||
        !selectedChatRef.current ||
        selectedChatRef.current.id !== chatId
      ) {
        return;
      }

      const serverMessages = [...response.data].sort((a, b) => a.time - b.time);
      
      if (silent) {
        // Merge: keep optimistic messages that aren't in server response yet
        setMessages((prev) => {
          const serverIds = new Set(serverMessages.map((m) => m.id));
          const optimisticMessages = prev.filter(
            (m) => String(m.id).startsWith("temp-") && !serverMessages.some((sm) => sm.body === m.body && sm.fromMe)
          );
          return [...serverMessages, ...optimisticMessages].sort((a, b) => a.time - b.time);
        });
      } else {
        setMessages(serverMessages);
      }
    } catch (error) {
      if (
        requestSeq !== messagesRequestSeqRef.current ||
        !selectedChatRef.current ||
        selectedChatRef.current.id !== chatId
      ) {
        return;
      }
      if (!silent) {
        setMessages([]);
      }
    } finally {
      if (
        !silent &&
        requestSeq === messagesRequestSeqRef.current &&
        selectedChatRef.current &&
        selectedChatRef.current.id === chatId
      ) {
        setLoadingMessages(false);
      }
    }
  }, [baseUrl]);

  const sendMessage = async () => {
    if (message.trim() && selectedChat) {
      const messageText = message.trim();
      setSendingMessage(true);
      setMessage("");
      
      // Optimistically add message to UI
      const optimisticMessage = {
        id: `temp-${Date.now()}`,
        body: messageText,
        type: "text",
        time: Math.floor(Date.now() / 1000),
        fromMe: true,
        delivery_status: "sent",
      };
      setMessages((prev) => [...prev, optimisticMessage]);
      
      try {
        await axios.post(
          `${baseUrl}/api/telegram/send`,
          {
            chat_id: selectedChat.id,
            message: messageText,
          },
          {
            headers: { Authorization: VITE_WAPPI_API_TOKEN },
          }
        );
        // Polling will update with the real message
      } catch (error) {
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((msg) => msg.id !== optimisticMessage.id));
        setMessage(messageText); // Restore message to input
      } finally {
        setSendingMessage(false);
      }
    }
  };

  const handleFileSelect = (type) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = type === "photo" ? "image/*" : type === "video" ? "video/*" : "*/*";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        setSelectedFile(file);
        setFileType(type);
        const reader = new FileReader();
        reader.onload = () => {
          const base64String = reader.result.split(",")[1]?.trim() || "";
          setBase64File(base64String);
          setShowPreview(true);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const sendDocument = async () => {
    if (!base64File || !selectedFile || !selectedChat) return;

    setSendingAttachment(true);
    const payload = {
      chat_id: selectedChat.id,
      file_name: selectedFile.name,
      b64_file: base64File,
      caption: previewMessage.trim() || "",
    };

    try {
      const response = await axios.post(`${baseUrl}/api/telegram/document/send`, payload, {
        headers: {
          Authorization: VITE_WAPPI_API_TOKEN,
          "Content-Type": "application/json",
        },
      });
      setSelectedFile(null);
      setBase64File("");
      setFileType(null);
      setShowPreview(false);
      setPreviewMessage("");
      await fetchMessages(selectedChat.id);
    } catch (error) {
    } finally {
      setSendingAttachment(false);
    }
  };

  useEffect(() => {
    fetchChats();
    
    // Set up polling for chat list updates
    const chatPollInterval = setInterval(() => {
      fetchChats(true); // Silent fetch
    }, POLLING_INTERVAL);
    
    return () => {
      clearInterval(chatPollInterval);
    };
  }, [fetchChats]);

  // Close attachment menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target)) {
        setShowAttachmentOptions(false);
      }
    };

    if (showAttachmentOptions) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showAttachmentOptions]);

  // Keep selectedChatRef in sync
  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.id);
      
      // Set up polling for messages when a chat is selected
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      pollingIntervalRef.current = setInterval(() => {
        if (selectedChatRef.current) {
          fetchMessages(selectedChatRef.current.id, true); // Silent fetch
        }
      }, POLLING_INTERVAL);
    } else {
      setMessages([]);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }
    
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [selectedChat, fetchMessages]);

  const handleFilterChange = (e) => {
    const value = e.target.value.replace(/[\\/]/g, "");
    setFilter(value);
    if (value) {
      const filtered = chats.filter((chat) =>
        chat.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredChats(filtered);
    } else {
      setFilteredChats(chats);
    }
  };

  const handleChatSelect = async (chat) => {
    const hadUnread = chat.unread_count > 0;
    
    // Clear messages immediately when switching chats
    setMessages([]);
    setSelectedChat(chat);
    setFilter("");
    
    // Show chat view on mobile
    if (isMobile) {
      setShowMobileChat(true);
    }
    
    // Clear unread count for the selected chat in UI
    setChats((prevChats) =>
      prevChats.map((c) =>
        c.id === chat.id ? { ...c, unread_count: 0 } : c
      )
    );
    setFilteredChats((prevFiltered) =>
      prevFiltered.map((c) =>
        c.id === chat.id ? { ...c, unread_count: 0 } : c
      )
    );
    // Fetch messages and mark last one as read if there were unread messages
    if (hadUnread) {
      try {
        const response = await axios.get(`${baseUrl}/api/telegram/chat/messages`, {
          params: { chat_id: chat.id },
        });
        const chatMessages = response.data || [];
        if (chatMessages.length > 0) {
          // Get the last message ID to mark as read
          const sortedMessages = [...chatMessages].sort((a, b) => b.time - a.time);
          const lastMessageId = sortedMessages[0]?.id;
          if (lastMessageId) {
            await axios.post(`${baseUrl}/api/telegram/chat/read`, {
              message_id: lastMessageId,
            });
          }
        }
      } catch (error) {
      }
    }
  };

  const getDefaultPfp = (chat) => {
    return chat.type === "group" ? defaultGroupPfp : defaultUserPfp;
  };

  const handleBackToContactList = () => {
    setShowMobileChat(false);
  };

  // Window resize listener for responsive detection
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) {
        setShowMobileChat(false); // Reset mobile state on desktop
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const validatePhoneNumber = async (phone) => {
    if (!phone.trim()) {
      setPhoneValidationError("");
      return;
    }

    setValidatingPhone(true);
    setPhoneValidationError("");

    try {
      // Check if the number exists in Telegram via backend
      const response = await axios.get(`${baseUrl}/api/telegram/check-contact`, {
        params: { phone: phone.trim() }
      });

      if (response.data.exists) {
        setPhoneValidationError("");
      } else {
        setPhoneValidationError("This phone number is not available on Telegram");
      }
    } catch (error) {
      setPhoneValidationError("Unable to validate phone number");
    } finally {
      setValidatingPhone(false);
    }
  };

  const handleSendToNewContact = async (e) => {
    e.preventDefault();
    if (!newContactPhone.trim() || !newContactMessage.trim()) {
      alert("Please enter phone number and message!");
      return;
    }

    if (phoneValidationError) {
      alert(phoneValidationError);
      return;
    }
    
    try {
      setSendingMessage(true);
      await axios.post(
        `${baseUrl}/api/telegram/send`,
        {
          chat_id: newContactPhone,
          message: newContactMessage,
        },
        {
          headers: { Authorization: VITE_WAPPI_API_TOKEN },
        }
      );
      setNewContactPhone("");
      setNewContactMessage("");
      setShowNewContactDialog(false);
      // Refresh chats to see the new conversation
      fetchChats();
      alert("Message sent successfully!");
    } catch (error) {
      alert("Failed to send message to new contact!");
    } finally {
      setSendingMessage(false);
    }
  };

  return (
          <div className="telegram-container">
            <div className={`chat-list-column ${isMobile && showMobileChat ? 'tg-hidden-mobile' : ''}`}>
              <div className="telegram-header-container">
                <h2 className="telegram-header">
                  <FaTelegramPlane style={{ marginRight: "10px", verticalAlign: "middle" }} /> Telegram
                </h2>
                <button 
                  className="telegram-new-chat-btn"
                  onClick={() => setShowNewContactDialog(true)}
                  title={t("new_chat")}
                >
                  <FaPlus />
                </button>
              </div>
              <div className="search-bar-container">
                <div className="search-bar-chat">
                  <FaSearch />
                  <input
                    type="text"
                    placeholder={t("search_placeholder")}
                    value={filter}
                    onChange={handleFilterChange}
                  />
                </div>
              </div>
              <div className="chats-list">
                {filteredChats.map((chat) => (
                  <div
                    key={chat.id}
                    className={`chat-item ${selectedChat?.id === chat.id ? "active" : ""}`}
                    onClick={() => handleChatSelect(chat)}
                  >
                    <div className="chat-item-content">
                      <img
                        src={chat.picture || getDefaultPfp(chat)}
                        alt={chat.name}
                        className="chat-thumbnail"
                        onError={(e) => {
                          e.target.src = getDefaultPfp(chat);
                        }}
                      />
                      <div>
                        <strong>{chat.name}</strong>
                        <p>{chat.last_message_data || t("no_messages")}</p>
                      </div>
                    </div>
                    {chat.unread_count > 0 && (
                      <div className="unread-count">{chat.unread_count}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className={`chat-window-column ${isMobile && !showMobileChat ? 'tg-hidden-mobile' : ''}`}>
              {selectedChat ? (
                <>
                  <div className="chat-header">
                    {isMobile && (
                      <button 
                        className="tg-back-btn" 
                        onClick={handleBackToContactList}
                        title={t("back_to_contacts")}
                      >
                        ←
                      </button>
                    )}
                    <img
                      src={selectedChat.picture || getDefaultPfp(selectedChat)}
                      alt={selectedChat.name}
                      className="profile-photo"
                      onError={(e) => {
                      ref={attachmentMenuRef}
                        e.target.src = getDefaultPfp(selectedChat);
                      }}
                    />
                    <div className="chat-header-info">
                      <h3>{selectedChat.name}</h3>
                    </div>
                  </div>
                  <MessagesContainer
                    key={selectedChat.id}
                    messages={messages}
                    selectedChat={selectedChat}
                    loading={loadingMessages}
                    profileId={import.meta.env.VITE_WAPPI_PROFILE_ID_TELEGRAM}
                    platform="telegram"
                  />
                  <div className="message-input-container">
                    <button
                      className="attach-button"
                      onClick={() => setShowAttachmentOptions(!showAttachmentOptions)}
                      disabled={sendingAttachment}
                    >
                      <FaPlus />
                    </button>
                    {showAttachmentOptions && (
                      <div className="attachment-tooltip">
                        <button onClick={() => handleFileSelect("photo")} className="tooltip-option">
                          <FaImage /> {t("photo")}
                        </button>
                        <button onClick={() => handleFileSelect("video")} className="tooltip-option">
                          <FaVideo /> {t("video")}
                        </button>
                        <button onClick={() => handleFileSelect("file")} className="tooltip-option">
                          <FaFile /> {t("file")}
                        </button>
                      </div>
                    )}
                    <input
                      type="text"
                      placeholder={t("type_message")}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={sendingMessage}
                    />
                    <button
                      className="send-button"
                      onClick={sendMessage}
                      disabled={sendingMessage || !message.trim()}
                    >
                      <FaTelegramPlane />
                    </button>
                  </div>
                </>
              ) : (
                <div className="no-chat-selected">{t("no_chat_selected")}</div>
              )}
              {showPreview && selectedFile && (
                <div className="preview-modal">
                  <div className="preview-content">
                    <button
                      className="close-preview"
                      onClick={() => {
                        setShowPreview(false);
                        setSelectedFile(null);
                        setBase64File("");
                        setFileType(null);
                        setPreviewMessage("");
                      }}
                    >
                      <FaTimes />
                    </button>
                    {selectedFile.type.startsWith("image/") && (
                      <img src={URL.createObjectURL(selectedFile)} alt="Preview" className="preview-image" />
                    )}
                    {selectedFile.type.startsWith("video/") && (
                      <video controls className="preview-video">
                        <source src={URL.createObjectURL(selectedFile)} type={selectedFile.type} />
                        Your browser does not support the video tag.
                      </video>
                    )}
                    {!selectedFile.type.startsWith("image/") && !selectedFile.type.startsWith("video/") && (
                      <div className="preview-file">{selectedFile.name}</div>
                    )}
                    <input
                      type="text"
                      placeholder={t("add_caption")}
                      value={previewMessage}
                      onChange={(e) => setPreviewMessage(e.target.value)}
                      className="preview-input"
                    />
                    <button
                      className="send-preview-button"
                      onClick={sendDocument}
                      disabled={sendingAttachment}
                    >
                      {sendingAttachment ? t("sending") : t("send")}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* New Contact Dialog */}
            {showNewContactDialog && (
              <div className="max-modal-overlay" onClick={() => setShowNewContactDialog(false)}>
                <div className="max-modal-content" onClick={(e) => e.stopPropagation()}>
                  <div className="max-modal-header">
                    <h3>{t("new_chat")}</h3>
                    <button 
                      className="max-modal-close"
                      onClick={() => setShowNewContactDialog(false)}
                    >
                      ×
                    </button>
                  </div>
                  <form onSubmit={handleSendToNewContact} className="max-modal-form">
                    <div className="max-modal-field">
                      <label>{t("phone_number")}</label>
                      <input
                        type="text"
                        placeholder={t("phone_placeholder")}
                        value={newContactPhone}
                        onChange={(e) => {
                          setNewContactPhone(e.target.value);
                          setPhoneValidationError("");
                        }}
                        onBlur={(e) => validatePhoneNumber(e.target.value)}
                        className="max-modal-input"
                        required
                      />
                      {validatingPhone && (
                        <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                          {t("validating_phone")}
                        </small>
                      )}
                      {phoneValidationError && (
                        <small style={{ color: '#e74c3c', marginTop: '4px', display: 'block' }}>
                          {phoneValidationError}
                        </small>
                      )}
                    </div>
                    <div className="max-modal-field">
                      <label>{t("message")}</label>
                      <textarea
                        placeholder={t("message_placeholder")}
                        value={newContactMessage}
                        onChange={(e) => setNewContactMessage(e.target.value)}
                        className="max-modal-textarea"
                        rows="4"
                        required
                      />
                    </div>
                    <div className="max-modal-actions">
                      <button 
                        type="button"
                        className="max-modal-btn max-modal-btn-cancel"
                        onClick={() => setShowNewContactDialog(false)}
                      >
                        {t("cancel")}
                      </button>
                      <button 
                        type="submit"
                        className="max-modal-btn max-modal-btn-send"
                        disabled={sendingMessage}
                      >
                        {sendingMessage ? t("sending") : t("send")}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
  );
};

export default Telegram;