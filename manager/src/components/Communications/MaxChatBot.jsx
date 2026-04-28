// src/components/MaxChatBot.jsx
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../../styles/MaxChatBot.css";
import LoadingComponent from "../Loading/LoadingComponent";

// Icons
import { FiX } from "react-icons/fi";
import { IoMdArrowUp } from "react-icons/io";
import { GrAttachment } from "react-icons/gr";
import { LuSticker } from "react-icons/lu";
import { MdOutlinePhotoLibrary } from "react-icons/md";
import { IoVideocamOutline } from "react-icons/io5";
import { CiFileOn } from "react-icons/ci";

// API functions
import { getMaxMessages, sendMaxMessage, sendMaxFile } from "../../utils/api";

const MaxChatBot = ({ 
  isOpen, 
  onClose, 
  contactId, 
  contactName = "Max Contact",
  contactThumbnail = "",
  contactType = "bot"
}) => {
  // State management
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [showAttachmentDialog, setShowAttachmentDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [base64File, setBase64File] = useState("");
  const [fileType, setFileType] = useState(null);

  // Refs
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef({ image: null, video: null, document: null });

  // Effects
  useEffect(() => {
    if (isOpen && contactId) {
      fetchMessages();
    }
  }, [isOpen, contactId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // API Functions
  const fetchMessages = async () => {
    if (!contactId) return;
    
    setLoading(true);
    try {
      const data = await getMaxMessages(contactId);
      
      // Format messages for consistent structure
      const formattedMessages = (data || []).map(msg => ({
        id: msg.id || Math.random().toString(36).substr(2, 9),
        body: msg.body || "",
        fromMe: msg.fromMe || false,
        type: msg.type || "text",
        time: msg.time || new Date().toISOString(),
        src: msg.src || "",
        fileName: msg.file_name || ""
      }));
      
      setMessages(formattedMessages);
    } catch (error) {
      toast.error("Failed to load messages!", {
        position: "top-right",
        autoClose: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e) => {
    if (e) e.preventDefault();
    
    if (!inputValue.trim() || !contactId || sending) return;

    setSending(true);
    try {
      // Send message via API
      await sendMaxMessage(contactId, inputValue);
      
      // Optimistically add message to UI
      const newMessage = {
        id: `temp-${Date.now()}`,
        body: inputValue,
        fromMe: true,
        type: "text",
        time: new Date().toISOString(),
      };
      
      setMessages(prev => [...prev, newMessage]);
      setInputValue("");
      scrollToBottom();
      
      toast.success("Message sent!", {
        position: "top-right",
        autoClose: 2000,
      });
      
      // Refresh messages to get actual server response
      setTimeout(() => fetchMessages(), 500);
      
    } catch (error) {
      toast.error("Failed to send message!", {
        position: "top-right",
        autoClose: 3000,
      });
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB", {
        position: "top-right",
        autoClose: 3000,
      });
      return;
    }

    setSelectedFile(file);
    setFileType(type);

    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result.split(",")[1]?.trim() || "";
      setBase64File(base64String);
    };
    reader.onerror = () => {
      toast.error("Failed to read file", {
        position: "top-right",
        autoClose: 3000,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSendFile = async () => {
    if (!selectedFile || !base64File || !contactId || !fileType || sending) return;

    setSending(true);
    try {
      await sendMaxFile(contactId, selectedFile.name, base64File, fileType);
      
      // Optimistically add file message to UI
      const newMessage = {
        id: `temp-file-${Date.now()}`,
        body: selectedFile.name,
        fromMe: true,
        type: fileType,
        time: new Date().toISOString(),
        fileName: selectedFile.name
      };
      
      setMessages(prev => [...prev, newMessage]);
      setSelectedFile(null);
      setBase64File("");
      setFileType(null);
      setShowAttachmentDialog(false);
      scrollToBottom();
      
      toast.success("File sent successfully!", {
        position: "top-right",
        autoClose: 2000,
      });
      
      // Refresh messages
      setTimeout(() => fetchMessages(), 500);
      
    } catch (error) {
      toast.error("Failed to send file!", {
        position: "top-right",
        autoClose: 3000,
      });
    } finally {
      setSending(false);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const renderMessageContent = (message) => {
    switch (message.type) {
      case "image":
        return (
          <div className="max-message-media">
            <img 
              src={message.src || message.body} 
              alt="Shared image" 
              className="max-message-image"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'block';
              }}
            />
            <div className="max-message-fallback" style={{display: 'none'}}>
              📷 Image
            </div>
          </div>
        );
      
      case "video":
        return (
          <div className="max-message-media">
            <video 
              src={message.src || message.body} 
              controls 
              className="max-message-video"
            />
          </div>
        );
      
      case "document":
        return (
          <div className="max-message-document">
            <div className="max-document-icon">📄</div>
            <div className="max-document-info">
              <span className="max-document-name">
                {message.fileName || message.body || "Document"}
              </span>
              <span className="max-document-size">File</span>
            </div>
          </div>
        );
      
      default:
        return (
          <span className="max-message-text">{message.body}</span>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="max-chatbot-container"
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <ToastContainer position="top-right" autoClose={3000} />
          
          {/* Header */}
          <motion.div 
            className="max-chatbot-header"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="max-contact-info">
              <div 
                className={`max-avatar ${contactType}`}
                style={{ 
                  backgroundImage: contactThumbnail ? `url(${contactThumbnail})` : undefined 
                }}
              />
              <div className="max-contact-details">
                <span className="max-contact-name">{contactName}</span>
                
              </div>
            </div>
            <FiX 
              className="max-close-icon" 
              onClick={onClose}
            />
          </motion.div>

          {/* Messages Container */}
          <div 
            className="max-messages-container"
            ref={messagesContainerRef}
          >
            {loading ? (
              <LoadingComponent message="Loading messages..." />
            ) : messages.length === 0 ? (
              <div className="max-empty-state">
                <div className="max-empty-illustration">💬</div>
                <h3>No messages yet</h3>
                <p>Start a conversation with {contactName}</p>
              </div>
            ) : (
              <div className="max-messages-list">
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    className={`max-message ${message.fromMe ? 'max-sent' : 'max-received'}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="max-message-bubble">
                      {renderMessageContent(message)}
                      <span className="max-message-time">
                        {formatTime(message.time)}
                      </span>
                    </div>
                  </motion.div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Area */}
          <motion.div 
            className="max-input-container"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {/* Attachment Dialog */}
            <AnimatePresence>
              {showAttachmentDialog && (
                <motion.div
                  className="max-attachment-dialog"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <div className="max-attachment-options">
                    <label className="max-attachment-option">
                      <MdOutlinePhotoLibrary className="max-option-icon" />
                      <span>Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        ref={el => fileInputRef.current.image = el}
                        onChange={(e) => handleFileUpload(e, "image")}
                        style={{ display: "none" }}
                      />
                    </label>
                    
                    <label className="max-attachment-option">
                      <IoVideocamOutline className="max-option-icon" />
                      <span>Video</span>
                      <input
                        type="file"
                        accept="video/*"
                        ref={el => fileInputRef.current.video = el}
                        onChange={(e) => handleFileUpload(e, "video")}
                        style={{ display: "none" }}
                      />
                    </label>
                    
                    <label className="max-attachment-option">
                      <CiFileOn className="max-option-icon" />
                      <span>File</span>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.txt,.zip"
                        ref={el => fileInputRef.current.document = el}
                        onChange={(e) => handleFileUpload(e, "document")}
                        style={{ display: "none" }}
                      />
                    </label>
                  </div>

                  {/* File Preview */}
                  {selectedFile && (
                    <div className="max-file-preview">
                      <div className="max-file-info">
                        <span className="max-file-name">{selectedFile.name}</span>
                        <span className="max-file-size">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                      <button
                        className="max-send-file-btn"
                        onClick={handleSendFile}
                        disabled={sending}
                      >
                        {sending ? (
                          <div className="max-btn-spinner"></div>
                        ) : (
                          <IoMdArrowUp />
                        )}
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input Form */}
            <form className="max-input-form" onSubmit={sendMessage}>
              <GrAttachment
                className="max-attach-btn"
                onClick={() => setShowAttachmentDialog(!showAttachmentDialog)}
              />
              
              <input
                type="text"
                placeholder="Type a message..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                className="max-text-input"
                disabled={sending}
              />
              
    
              
              <button 
                type="submit" 
                className="max-send-btn"
                disabled={!inputValue.trim() || sending || !contactId}
              >
                {sending ? (
                  <div className="max-btn-spinner"></div>
                ) : (
                  <IoMdArrowUp />
                )}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MaxChatBot;