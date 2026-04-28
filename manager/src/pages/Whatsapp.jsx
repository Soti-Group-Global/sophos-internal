import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import "../styles/Whatsapp.css";
import {
  FiSend,
  FiSearch,
  FiPaperclip,
  FiFileText,
  FiImage,
  FiVideo,
  FiX,
} from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa";
import MessagesContainer from "./MessagesContainer";
import { motion, AnimatePresence } from "framer-motion";
import defaultUserPfp from "../assets/default-user.png";

function WhatsApp() {
  const [chats, setChats] = useState([]);
  const [filteredChats, setFilteredChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedChat, setSelectedChat] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showNewContactDialog, setShowNewContactDialog] = useState(false);
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactMessage, setNewContactMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [base64File, setBase64File] = useState("");
  const [fileType, setFileType] = useState(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const baseUrl = import.meta.env.VITE_BASE_URL;

  const selectedChatRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const POLLING_INTERVAL = 3000;

  const fetchChats = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await axios.get(`${baseUrl}/api/whatsapp/chats`);
      const dialogs = response.data?.dialogs || [];
      
      // Preserve unread_count = 0 for selected chat during silent polling
      const updatedDialogs = silent && selectedChatRef.current
        ? dialogs.map((chat) =>
            chat.id === selectedChatRef.current.id ? { ...chat, unread_count: 0 } : chat
          )
        : dialogs;
      
      setChats(updatedDialogs);
      
      if (!searchTerm) {
        setFilteredChats(updatedDialogs);
      } else {
        const filtered = updatedDialogs.filter((chat) =>
          chat.name?.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setFilteredChats(filtered);
      }
    } catch (error) {
      if (!silent) {
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [baseUrl, searchTerm]);

  const fetchMessages = useCallback(async (chatId, silent = false) => {
    if (!silent) {
      setLoadingMessages(true);
      setMessages([]);
    }
    try {
      const response = await axios.get(`${baseUrl}/api/whatsapp/chat/messages`, {
        params: { chat_id: chatId },
      });
      const serverMessages = (response.data || []).reverse();
      
      if (silent) {
        setMessages((prev) => {
          const serverIds = new Set(serverMessages.map((m) => m.id));
          const optimisticMessages = prev.filter(
            (m) => String(m.id).startsWith("temp-") && !serverMessages.some((sm) => sm.body === m.body && sm.fromMe)
          );
          return [...serverMessages, ...optimisticMessages];
        });
      } else {
        setMessages(serverMessages);
      }
    } catch (error) {
      if (!silent) {
        setMessages([]);
      }
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, [baseUrl]);

  const sendMessage = async () => {
    if (!selectedChat || !message.trim()) return;

    const messageText = message.trim();
    setSendingMessage(true);
    setMessage("");

    // Optimistic update
    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      body: messageText,
      fromMe: true,
      type: "chat",
      time: Math.floor(Date.now() / 1000),
      delivery_status: "sent",
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      await axios.post(`${baseUrl}/api/whatsapp/send`, {
        to: selectedChat.id,
        message: messageText,
      });
    } catch (error) {
      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticMessage.id));
      setMessage(messageText);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleChatSelect = async (chat) => {
    if (selectedChat?.id === chat.id) return;
    
    const hadUnread = chat.unread_count > 0;
    
    // Clear messages immediately when switching chats
    setMessages([]);
    setSelectedChat(chat);
    setShowUpload(false);
    
    // Show chat view on mobile
    if (isMobile) {
      setShowMobileChat(true);
    }
    
    // Clear unread count in UI
    setChats((prevChats) =>
      prevChats.map((c) => (c.id === chat.id ? { ...c, unread_count: 0 } : c))
    );
    setFilteredChats((prevFiltered) =>
      prevFiltered.map((c) => (c.id === chat.id ? { ...c, unread_count: 0 } : c))
    );

    // Mark as read in backend
    if (hadUnread) {
      try {
        const response = await axios.get(`${baseUrl}/api/whatsapp/chat/messages`, {
          params: { chat_id: chat.id },
        });
        const chatMessages = response.data || [];
        if (chatMessages.length > 0) {
          const lastMessageId = chatMessages[0]?.id;
          if (lastMessageId) {
            await axios.post(`${baseUrl}/api/whatsapp/chat/read`, {
              message_id: lastMessageId,
            });
          }
        }
      } catch (error) {
      }
    }
  };

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (value) {
      const filtered = chats.filter((chat) =>
        chat.name?.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredChats(filtered);
    } else {
      setFilteredChats(chats);
    }
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

  const handleFileUpload = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setFileType(type);
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result.split(",")[1]?.trim() || "";
        setBase64File(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendFile = async () => {
    if (!base64File || !selectedFile || !selectedChat) return;

    try {
      await axios.post(`${baseUrl}/api/whatsapp/document/send`, {
        to: selectedChat.id,
        file_name: selectedFile.name,
        file_data: base64File,
        file_type: fileType,
      });
      setSelectedFile(null);
      setBase64File("");
      setFileType(null);
      setShowUpload(false);
    } catch (error) {
    }
  };

  const handleSendToNewContact = async (e) => {
    e.preventDefault();
    if (!newContactPhone.trim() || !newContactMessage.trim()) {
      alert("Please enter phone number and message!");
      return;
    }
    
    try {
      setSendingMessage(true);
      await axios.post(`${baseUrl}/api/whatsapp/send`, {
        to: newContactPhone,
        message: newContactMessage,
      });
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

  // Initial fetch and chat polling
  useEffect(() => {
    fetchChats();
    const chatPollInterval = setInterval(() => {
      fetchChats(true);
    }, POLLING_INTERVAL);
    return () => clearInterval(chatPollInterval);
  }, [fetchChats]);

  // Keep selectedChatRef in sync
  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  // Message polling
  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.id);
      
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      pollingIntervalRef.current = setInterval(() => {
        if (selectedChatRef.current) {
          fetchMessages(selectedChatRef.current.id, true);
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

  return (
    <div className="whatsapp-container">
      <div className={`wa-chat-list-column ${isMobile && showMobileChat ? 'wa-hidden-mobile' : ''}`}>
        <div className="wa-header">
          <div className="wa-header-content">
            <FaWhatsapp className="wa-header-icon" />
            <span>WhatsApp</span>
          </div>
          <button 
            className="wa-new-chat-btn"
            onClick={() => setShowNewContactDialog(true)}
            title="New Chat"
          >
            +
          </button>
        </div>
        <div className="wa-search-container">
          <div className="wa-search-bar">
            <FiSearch className="wa-search-icon" />
            <input
              type="text"
              placeholder="Search or start new chat"
              value={searchTerm}
              onChange={handleSearch}
            />
          </div>
        </div>
        <div className="wa-chats-list">
          {filteredChats.map((chat) => (
            <div
              key={chat.id}
              className={`wa-chat-item ${selectedChat?.id === chat.id ? "active" : ""}`}
              onClick={() => handleChatSelect(chat)}
            >
              <img
                src={chat.thumbnail || defaultUserPfp}
                alt={chat.name}
                className="wa-chat-avatar"
                onError={(e) => { e.target.src = defaultUserPfp; }}
              />
              <div className="wa-chat-info">
                <div className="wa-chat-name-row">
                  <span className="wa-chat-name">{chat.name || chat.id}</span>
                  <span className="wa-chat-time">
                    {chat.last_message_time
                      ? new Date(chat.last_message_time * 1000).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}
                  </span>
                </div>
                <div className="wa-chat-preview-row">
                  <span className="wa-chat-preview">
                    {chat.last_message_data || "No messages"}
                  </span>
                  {chat.unread_count > 0 && (
                    <span className="wa-unread-badge">
                      {chat.unread_count > 99 ? "99+" : chat.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`wa-chat-window ${isMobile && !showMobileChat ? 'wa-hidden-mobile' : ''}`}>
        {selectedChat ? (
          <>
            <div className="wa-chat-header">
              {isMobile && (
                <button 
                  className="wa-back-btn" 
                  onClick={handleBackToContactList}
                  title="Back to contacts"
                >
                  ←
                </button>
              )}
              <img
                src={selectedChat.thumbnail || defaultUserPfp}
                alt={selectedChat.name}
                className="wa-header-avatar"
                onError={(e) => { e.target.src = defaultUserPfp; }}
              />
              <div className="wa-header-info">
                <span className="wa-header-name">{selectedChat.name || selectedChat.id}</span>
              </div>
            </div>

            <div className="wa-messages-area">
              <MessagesContainer
                key={selectedChat?.id || 'default'}
                messages={messages}
                loading={loadingMessages}
                profileId={import.meta.env.VITE_WAPPI_PROFILE_ID_WHATSAPP}
                platform="whatsapp"
              />
            </div>

            <div className="wa-input-container">
              <div className="wa-attach-wrapper">
                <button
                  className="wa-attach-btn"
                  onClick={() => setShowUpload((prev) => !prev)}
                >
                  <FiPaperclip />
                </button>

                <AnimatePresence>
                  {showUpload && (
                    <motion.div
                      className="wa-upload-menu"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                    >
                      <label className="wa-upload-option">
                        <FiImage />
                        <span>Photos</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload(e, "image")}
                          hidden
                        />
                      </label>
                      <label className="wa-upload-option">
                        <FiVideo />
                        <span>Videos</span>
                        <input
                          type="file"
                          accept="video/*"
                          onChange={(e) => handleFileUpload(e, "video")}
                          hidden
                        />
                      </label>
                      <label className="wa-upload-option">
                        <FiFileText />
                        <span>Document</span>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.txt"
                          onChange={(e) => handleFileUpload(e, "document")}
                          hidden
                        />
                      </label>
                      {selectedFile && (
                        <div className="wa-selected-file">
                          <span>{selectedFile.name}</span>
                          <button onClick={handleSendFile}>Send</button>
                          <button onClick={() => {
                            setSelectedFile(null);
                            setBase64File("");
                          }}>
                            <FiX />
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <input
                type="text"
                className="wa-message-input"
                placeholder="Type a message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={sendingMessage}
              />

              <button
                className="wa-send-btn"
                onClick={sendMessage}
                disabled={sendingMessage || !message.trim()}
              >
                <FiSend />
              </button>
            </div>
          </>
        ) : (
          <div className="wa-no-chat">
            <div className="wa-no-chat-content">
              <FaWhatsapp className="wa-no-chat-icon" />
              <h2>WhatsApp Web</h2>
              <p>Send and receive messages without keeping your phone online.</p>
            </div>
          </div>
        )}
      </div>

      {/* New Contact Dialog */}
      {showNewContactDialog && (
        <div className="max-modal-overlay" onClick={() => setShowNewContactDialog(false)}>
          <div className="max-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="max-modal-header">
              <h3>New Chat</h3>
              <button 
                className="max-modal-close"
                onClick={() => setShowNewContactDialog(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSendToNewContact} className="max-modal-form">
              <div className="max-modal-field">
                <label>Phone Number</label>
                <input
                  type="text"
                  placeholder="Enter phone number (e.g., 1234567890)"
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  className="max-modal-input"
                  required
                />
              </div>
              <div className="max-modal-field">
                <label>Message</label>
                <textarea
                  placeholder="Enter your message..."
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
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="max-modal-btn max-modal-btn-send"
                  disabled={sendingMessage}
                >
                  {sendingMessage ? "Sending..." : "Send"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default WhatsApp;
