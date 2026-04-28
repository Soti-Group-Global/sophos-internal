
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { socket } from "../utils/socket";
import "../styles/MaxMessenger.css";
import { BsFillPlusSquareFill } from "react-icons/bs";
import { IoIosArrowBack, IoMdArrowUp } from "react-icons/io";
import { FiArrowDownCircle } from "react-icons/fi";
import { FiSearch } from "react-icons/fi";
import { HiDotsVertical } from "react-icons/hi";
import { GrAttachment } from "react-icons/gr";
import { LuSticker } from "react-icons/lu";
import { MdOutlinePhotoLibrary } from "react-icons/md";
import { IoVideocamOutline } from "react-icons/io5";
import { CiFileOn } from "react-icons/ci";
import { BsCheck, BsCheckAll } from "react-icons/bs";
import {
  getMaxChats,
  filterMaxChats,
  getMaxMessages,
  sendMaxMessage,
  sendMaxFile,
  markMaxChatAsRead,
  checkMaxContact,
} from "../utils/api";

export default function MaxMessenger() {
  const { t } = useTranslation("max_messenger");
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [showNewContactDialog, setShowNewContactDialog] = useState(false);
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactMessage, setNewContactMessage] = useState("");
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [base64File, setBase64File] = useState("");
  const [fileType, setFileType] = useState(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [validatingPhone, setValidatingPhone] = useState(false);
  const [phoneValidationError, setPhoneValidationError] = useState("");
  const [phoneValidationSuccess, setPhoneValidationSuccess] = useState(false);
  const [validatedChatId, setValidatedChatId] = useState(null);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  // Image loading states
  const [loadingImages, setLoadingImages] = useState({});
  const [imageErrors, setImageErrors] = useState({});
  const [selectedMedia, setSelectedMedia] = useState(null); // For modal viewer
  
  const attachmentMenuRef = useRef(null);
  const phoneDebounceTimer = useRef(null);

  const selectedRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const lastFetchTimeRef = useRef({ chats: 0, messages: 0 });
  const messagesRequestSeqRef = useRef(0);
  const POLLING_INTERVAL = 10000;
  const MIN_FETCH_INTERVAL = 2000; // Minimum 2 seconds between fetches

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const autoScrollLockedRef = useRef(false);
  const isInitialLoadRef = useRef(false);
  const SCROLL_BOTTOM_THRESHOLD = 40;

  // Keep selectedRef in sync
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  // Date grouping helper function
  const getDateLabel = (timestamp) => {
    if (!timestamp) return "Unknown";
    // MAX API returns timestamps in milliseconds
    const ts = timestamp > 1e12 ? timestamp : timestamp * 1000;
    const messageDate = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (messageDate.toDateString() === today.toDateString()) return "Today";
    else if (messageDate.toDateString() === yesterday.toDateString()) return "Yesterday";
    else return messageDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  // Group messages by date
  const groupedMessages = messages.reduce((acc, msg) => {
    if (!msg) return acc;
    const dateLabel = getDateLabel(msg.time);
    if (!acc[dateLabel]) acc[dateLabel] = [];
    acc[dateLabel].push(msg);
    return acc;
  }, {});

  const sortedDateLabels = Object.keys(groupedMessages).sort((a, b) => {
    const getDate = (label) => {
      if (label === "Today") return new Date();
      if (label === "Yesterday") return new Date().setDate(new Date().getDate() - 1);
      return new Date(label.split(" ").reverse().join("-"));
    };
    return getDate(a) - getDate(b);
  });

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

  const fetchChats = useCallback(async (client_name = "", silent = false) => {
    const now = Date.now();
    if (now - lastFetchTimeRef.current.chats < MIN_FETCH_INTERVAL) {
      return; // Prevent too frequent fetches
    }
    lastFetchTimeRef.current.chats = now;
    
    if (!silent) setLoadingChats(true);
    try {
      const data = client_name ? await filterMaxChats(client_name) : await getMaxChats();
      const updatedChats = (data.chats || []).map((chat) => ({
        id: chat.id,
        name: chat.name || chat.phone || t("unknown"),
        last_message_data: chat.last_message_data || "",
        thumbnail: chat.thumbnail || "",
        unread_count: chat.unread_count || 0,
        type: chat.isGroup ? "group" : chat.participants?.some(p => p.is_bot) ? "bot" : "dialog",
      }));
      
      // Only update if there are actual changes (compare JSON to avoid unnecessary re-renders)
      setChats((prevChats) => {
        if (JSON.stringify(prevChats) !== JSON.stringify(updatedChats)) {
          return updatedChats;
        }
        return prevChats;
      });
    } catch (error) {
      if (!silent) {
      }
    } finally {
      if (!silent) setLoadingChats(false);
    }
  }, []);

  const fetchMessages = useCallback(async (chat_id, silent = false) => {
    const requestSeq = ++messagesRequestSeqRef.current;

    const now = Date.now();
    if (now - lastFetchTimeRef.current.messages < MIN_FETCH_INTERVAL) {
      return; // Prevent too frequent fetches
    }
    lastFetchTimeRef.current.messages = now;
    
    if (!silent) setLoadingMessages(true);
    try {
      const data = await getMaxMessages(chat_id);
      if (requestSeq !== messagesRequestSeqRef.current || selectedRef.current !== chat_id) {
        return;
      }

      // Messages come from API in desc order (newest first), need to reverse for display
      const serverMessages = data ? [...data].reverse() : [];
      
      // Debug: Log messages to see their structure
      if (!silent) {
        serverMessages.forEach((msg, i) => {
          if (msg.type !== 'text') {
            console.log(i, msg.type, {
              file_link: msg.file_link,
              file_name: msg.file_name,
              fromMe: msg.fromMe
            });
          }
        });
      }

      if (silent) {
        setMessages((prev) => {
          // Keep optimistic messages that haven't been confirmed yet
          const optimisticMessages = prev.filter((m) => {
            if (!m.id?.startsWith?.("temp-")) return false;
            
            // For text messages, check if body matches
            if (m.type === 'text') {
              return !serverMessages.some((sm) => sm.body === m.body && sm.fromMe);
            }
            
            // For file messages, check if file_name matches and it's recent (within last 10 seconds)
            if (['image', 'video', 'document'].includes(m.type)) {
              const isRecent = Date.now() - m.time < 10000;
              const hasMatch = serverMessages.some((sm) => 
                sm.file_name === m.file_name && 
                sm.fromMe && 
                sm.type === m.type
              );
              return isRecent && !hasMatch;
            }
            
            return true;
          });
          return [...serverMessages, ...optimisticMessages];
        });
      } else {
        setMessages(serverMessages);
      }
    } catch (error) {
      if (requestSeq !== messagesRequestSeqRef.current || selectedRef.current !== chat_id) {
        return;
      }
      if (!silent) {
      }
    } finally {
      if (!silent && requestSeq === messagesRequestSeqRef.current && selectedRef.current === chat_id) {
        setLoadingMessages(false);
      }
    }
  }, []);

  // Single unified polling setup
  useEffect(() => {
    const profileId = "8370586e-3dfd";

    // Join profile room
    socket.emit("join", profileId);

    // Initial fetch
    fetchChats();

    // Listen for real-time messages
    const handleMaxMessage = (payload) => {
      fetchChats("", true);
      
      if (selectedRef.current && (payload.chat_id === selectedRef.current || payload.from === selectedRef.current)) {
        fetchMessages(selectedRef.current, true);
      }
    };
    
    socket.on("max:message", handleMaxMessage);

    // Single polling interval for both chats and messages
    pollingIntervalRef.current = setInterval(() => {
      fetchChats("", true);
      if (selectedRef.current) {
        fetchMessages(selectedRef.current, true);
      }
    }, POLLING_INTERVAL);

    return () => {
      socket.off("max:message", handleMaxMessage);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []); // Empty deps - runs once on mount

  // Handle chat selection
  useEffect(() => {
    if (selected) {
      isInitialLoadRef.current = true; // Mark initial load for this chat
      fetchMessages(selected);
    } else {
      setMessages([]);
    }
  }, [selected, fetchMessages]);

  // Handle search (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchChats(searchTerm);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, fetchChats]);

  // Snap to bottom instantly (before paint) on initial chat load
  useLayoutEffect(() => {
    if (isInitialLoadRef.current && messages.length > 0 && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      isInitialLoadRef.current = false;
    }
  }, [messages]);

  // Scroll to bottom when messages change (only if user is near bottom)
  useEffect(() => {
    if (isInitialLoadRef.current) return; // handled by useLayoutEffect above
    const container = messagesContainerRef.current;
    if (container) {
      const distanceFromBottom = container.scrollHeight - (container.scrollTop + container.clientHeight);
      isNearBottomRef.current = distanceFromBottom <= SCROLL_BOTTOM_THRESHOLD;
    }
    if (!autoScrollLockedRef.current && isNearBottomRef.current) {
      scrollToBottom();
    }
  }, [messages]);

  // Auto-refresh messages every 30 seconds when a chat is selected (reduced from 5s)
  useEffect(() => {
    if (!selected) return;
    
    const intervalId = setInterval(() => {
      fetchMessages(selected, true); // Silent refresh
    }, 30000); // Every 30 seconds (reduced frequency)
    
    return () => clearInterval(intervalId);
  }, [selected, fetchMessages]);


  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || !selected) {
      alert(t("alerts.select_chat_and_message"));
      return;
    }
    try {
      const messageText = inputValue;
      setInputValue("");
      
      // Optimistically add message
      setMessages((prev) => [
        ...prev,
        { id: `temp-${Date.now()}`, body: messageText, fromMe: true, type: "text", time: Date.now() },
      ]);
      // Always scroll to bottom when user sends a message
      autoScrollLockedRef.current = false;
      isNearBottomRef.current = true;
      setShowScrollButton(false);
      scrollToBottom();
      
      await sendMaxMessage(selected, messageText);
      
      // Refresh messages to get the actual sent message
      setTimeout(() => fetchMessages(selected, true), 1000);
    } catch (error) {
      alert(t("alerts.failed_to_send_message"));
    }
  };

  const handleChatSelect = async (chat_id) => {
    if (selected === chat_id) return;
    // Reset scroll lock when switching chats
    autoScrollLockedRef.current = false;
    isNearBottomRef.current = true;
    isInitialLoadRef.current = true; // Mark as initial load so first render snaps to bottom
    setShowScrollButton(false);
    // Immediately clear previous chat messages to avoid stale content flash
    setMessages([]);
    setLoadingMessages(true);
    setSelected(chat_id);
    
    // Show chat view on mobile
    if (isMobile) {
      setShowMobileChat(true);
    }
    
    // Mark chat as read to clear notification count
    try {
      await markMaxChatAsRead(chat_id);
      // Update local chat list to clear unread count immediately
      setChats((prevChats) =>
        prevChats.map((chat) =>
          chat.id === chat_id ? { ...chat, unread_count: 0 } : chat
        )
      );
    } catch (error) {
    }
  };

  const handleBackToContactList = () => {
    setShowMobileChat(false);
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
    if (!selectedFile || !base64File || !selected || !fileType) {
      alert(t("alerts.select_chat_and_file"));
      return;
    }
    try {
      // Optimistically add file message
      const tempId = `temp-${Date.now()}`;
      const tempMessage = {
        id: tempId,
        body: "",
        fromMe: true,
        type: fileType === "document" ? "document" : fileType === "video" ? "video" : "image",
        time: Date.now(),
        file_name: selectedFile.name,
        file_link: URL.createObjectURL(selectedFile), // Temporary local preview
      };
      
      setMessages((prev) => [...prev, tempMessage]);
      // Always scroll to bottom when user sends a file
      autoScrollLockedRef.current = false;
      isNearBottomRef.current = true;
      setShowScrollButton(false);
      scrollToBottom();
      
      await sendMaxFile(selected, selectedFile.name, base64File, fileType);
      
      setSelectedFile(null);
      setBase64File("");
      setFileType(null);
      setShowAttachmentMenu(false);
      
      // Show success message
      setToastMessage(t("toast.file_sent_successfully"));
      setTimeout(() => setToastMessage(""), 3000);
      
      // Refresh messages to get the actual sent file from server
      setTimeout(() => fetchMessages(selected, true), 1000);
    } catch (error) {
      alert(t("alerts.failed_to_send_file"));
    }
  };

  const validatePhoneNumber = async (phone) => {
    if (!phone.trim()) {
      setPhoneValidationError("");
      setPhoneValidationSuccess(false);
      setValidatedChatId(null);
      return;
    }
    
    setValidatingPhone(true);
    setPhoneValidationError("");
    setPhoneValidationSuccess(false);
    setValidatedChatId(null);
    
    try {
      const result = await checkMaxContact(phone);
      if (!result.exists) {
        setPhoneValidationError(t("validation.phone_not_registered"));
        setPhoneValidationSuccess(false);
        setValidatedChatId(null);
      } else {
        setPhoneValidationSuccess(true);
        // Store the chat_id for sending messages
        setValidatedChatId(result.chat_id);
      }
    } catch (error) {
      // On error, assume valid to not block user
      setPhoneValidationSuccess(true);
      setValidatedChatId(null);
    } finally {
      setValidatingPhone(false);
    }
  };

  // Debounced phone validation - triggers automatically as user types
  useEffect(() => {
    // Clear existing timer
    if (phoneDebounceTimer.current) {
      clearTimeout(phoneDebounceTimer.current);
    }

    // Only validate if there's a phone number
    if (newContactPhone.trim()) {
      // Set debounce timer - validate after 800ms of no typing
      phoneDebounceTimer.current = setTimeout(() => {
        validatePhoneNumber(newContactPhone);
      }, 800);
    } else {
      // Clear validation states if phone is empty
      setPhoneValidationError("");
      setPhoneValidationSuccess(false);
      setValidatingPhone(false);
      setValidatedChatId(null);
    }

    // Cleanup on unmount
    return () => {
      if (phoneDebounceTimer.current) {
        clearTimeout(phoneDebounceTimer.current);
      }
    };
  }, [newContactPhone]);

  // Click outside to close attachment menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target)) {
        setShowAttachmentMenu(false);
      }
    };

    if (showAttachmentMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showAttachmentMenu]);

  const handleSendToNewContact = async (e) => {
    e.preventDefault();
    if (!newContactPhone.trim() || !newContactMessage.trim()) {
      alert(t("alerts.enter_phone_and_message"));
      return;
    }
    
    if (phoneValidationError) {
      alert(t("alerts.enter_valid_phone"));
      return;
    }
    
    try {
      setSendingMessage(true);
      // Use chat_id if available, otherwise fall back to phone number
      const recipient = validatedChatId || newContactPhone;
      await sendMaxMessage(recipient, newContactMessage);
      setNewContactPhone("");
      setNewContactMessage("");
      setShowNewContactDialog(false);
      setPhoneValidationError("");
      setPhoneValidationSuccess(false);
      setValidatedChatId(null);
      // Refresh chats to see the new conversation
      fetchChats();
      alert(t("alerts.message_sent_successfully"));
    } catch (error) {
      alert(t("alerts.failed_to_send_to_new_contact"));
    } finally {
      setSendingMessage(false);
    }
  };

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    const isNearBottom = distanceFromBottom <= SCROLL_BOTTOM_THRESHOLD;
    isNearBottomRef.current = isNearBottom;
    autoScrollLockedRef.current = !isNearBottom;
    setShowScrollButton(!isNearBottom);
  };

  return (
    <div className="max-ui-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="max-toast-notification">
          {toastMessage}
        </div>
      )}
      
      <aside className={`max-sidebar ${isMobile && showMobileChat ? 'max-hidden-mobile' : ''}`}>
        <div className="max-sidebar-header">
          <span>{t("ui.chats")}</span>
          <BsFillPlusSquareFill 
            className="max-add-chat" 
            onClick={() => setShowNewContactDialog(true)}
            title={t("modal.new_chat")}
          />
        </div>
        <div className="max-search-container">
          <input
            id="max-search-box"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t("ui.search")}
            className="max-search-box"
          />
        </div>
        <div className="max-contacts-list">
          {chats.map(({ id, name, last_message_data, thumbnail, unread_count, type }) => (
            <div
              key={id}
              className={`max-contact-row${selected === id ? " max-active" : ""}`}
              onClick={() => handleChatSelect(id)}
            >
              <div 
                className={`max-avatar ${type || "bot"}`} 
                style={{ backgroundImage: thumbnail ? `url(${thumbnail})` : undefined }}
              >
                {!thumbnail && (name ? name.charAt(0).toUpperCase() : '?')}
              </div>
              <div className="max-contact-info">
                <div className="max-contact-details">
                  <div className="max-contact-title">{name}</div>
                  <div className="max-contact-preview">{last_message_data || t("ui.no_messages")}</div>
                </div>
                {unread_count > 0 && (
                  <span className="max-contact-time">{unread_count > 99 ? "99+" : unread_count}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </aside>
      <main className={`max-chat-main ${isMobile && !showMobileChat ? 'max-hidden-mobile' : ''}`}>
        {!selected ? (
          <div className="max-no-contact">{t("ui.select_contact")}</div>
        ) : (
          <>
            <div className="max-chat-header">
              <IoIosArrowBack 
                className="max-back-btn" 
                onClick={isMobile ? handleBackToContactList : () => setSelected(null)}
                title={isMobile ? t("ui.back_to_contacts") : t("ui.close_chat")}
              />
              <div className="max-chat-avatar max-avatar bot">
                {chats.find((c) => c.id === selected)?.name?.charAt(0).toUpperCase() || '?'}
              </div>
              <div className="max-chat-name-area">
                <span className="max-chat-name">
                  {chats.find((c) => c.id === selected)?.name || t("unknown")}
                </span>
                <span className="max-bot-label">{t("ui.bot")}</span>
              </div>
              <div className="max-spacer" />
              <FiSearch className="max-chat-header-btn" />
              <HiDotsVertical className="max-chat-header-btn" />
            </div>
            <div className="max-messages-wrapper">
            <div className="max-chat-content-area" ref={messagesContainerRef} onScroll={handleScroll}>
              {loadingMessages ? (
                <div className="max-loading">{t("loading_messages")}</div>
              ) : (
                sortedDateLabels.map((dateLabel) => (
                  <div key={dateLabel} className="max-date-group">
                    <div className="max-date-label">{dateLabel}</div>
                    {groupedMessages[dateLabel].map((msg, i) => (
                      <div
                        className={`max-chat-message ${msg.fromMe ? "max-sent" : ""}`}
                        key={msg.id || `${dateLabel}-${i}`}
                      >
                    {msg.type === "image" && (
                      <div className="max-media-container">
                        {loadingImages[msg.id] && (
                          <div className="max-media-loading">
                            <div className="max-spinner"></div>
                          </div>
                        )}
                        <img 
                          src={msg.file_link || msg.body} 
                          className={`max-chat-image ${loadingImages[msg.id] ? 'max-loading' : ''}`}
                          alt="chat" 
                          onLoad={() => {
                            setLoadingImages(prev => ({ ...prev, [msg.id]: false }));
                          }}
                          onLoadStart={() => {
                            setLoadingImages(prev => ({ ...prev, [msg.id]: true }));
                          }}
                          onError={(e) => {
                            setLoadingImages(prev => ({ ...prev, [msg.id]: false }));
                            setImageErrors(prev => ({ ...prev, [msg.id]: true }));
                          }}
                          onClick={() => setSelectedMedia({ type: 'image', url: msg.file_link || msg.body })}
                          style={{ cursor: 'pointer' }}
                        />
                        {imageErrors[msg.id] && (
                          <div className="max-media-error">Failed to load image</div>
                        )}
                      </div>
                    )}
                    {msg.type === "video" && (
                      <div className="max-media-container">
                        <video 
                          src={msg.file_link || msg.body} 
                          className="max-chat-video" 
                          controls 
                          preload="metadata"
                          onError={(e) => {
                          }}
                        />
                      </div>
                    )}
                    {msg.type === "document" && (() => {
                      // Check if document is actually an image
                      const fileExt = msg.file_name?.toLowerCase().split('.').pop();
                      const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(fileExt || '');
                      
                      // Try to display as image if extension matches OR if we should try loading it as image
                      if ((isImage || !fileExt || fileExt === msg.file_name) && msg.file_link && !imageErrors[msg.id]) {
                        // Display as image (will fallback to document icon on error)
                        return (
                          <div className="max-media-container">
                            {loadingImages[msg.id] && (
                              <div className="max-media-loading">
                                <div className="max-spinner"></div>
                              </div>
                            )}
                            <img 
                              src={msg.file_link} 
                              className={`max-chat-image ${loadingImages[msg.id] ? 'max-loading' : ''}`}
                              alt={msg.file_name || 'image'}
                              onLoad={() => {
                                setLoadingImages(prev => ({ ...prev, [msg.id]: false }));
                              }}
                              onLoadStart={() => {
                                setLoadingImages(prev => ({ ...prev, [msg.id]: true }));
                              }}
                              onError={(e) => {
                                setLoadingImages(prev => ({ ...prev, [msg.id]: false }));
                                setImageErrors(prev => ({ ...prev, [msg.id]: true }));
                              }}
                              onClick={() => setSelectedMedia({ 
                                type: 'image', 
                                url: msg.file_link,
                                name: msg.file_name 
                              })}
                              style={{ cursor: 'pointer' }}
                            />
                            {imageErrors[msg.id] && (
                              <div className="max-media-error">Failed to load image</div>
                            )}
                          </div>
                        );
                      }
                      
                      // Display as regular document
                      return (
                        <a 
                          href={msg.file_link || msg.body} 
                          className="max-chat-document" 
                          download={msg.file_name || "document"}
                          onClick={(e) => {
                            e.preventDefault();
                            // Create a temporary link to download with proper filename
                            const link = document.createElement('a');
                            link.href = msg.file_link || msg.body;
                            link.download = msg.file_name || 'document';
                            link.target = '_blank';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                        >
                          <CiFileOn className="max-document-icon" />
                          <div className="max-document-info">
                            <span className="max-document-name">{msg.file_name || t("document")}</span>
                            {msg.caption && <span className="max-document-caption">{msg.caption}</span>}
                          </div>
                        </a>
                      );
                    })()}
                    {msg.type === "text" && (
                      <span className="max-msg-text">{msg.body}</span>
                    )}
                    {msg.time != null && (
                      <div className="max-message-footer">
                        <span className="max-chat-time">
                          {(() => {
                            const ts = msg.time > 1e12 ? msg.time : msg.time * 1000;
                            return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
                          })()}
                        </span>
                        {msg.fromMe && (
                          <span className={`max-read-receipt ${msg.isRead ? 'read' : ''}`}>
                            {msg.delivery_status === 'sent' && <BsCheck />}
                            {(msg.delivery_status === 'delivered' || msg.delivery_status === 'read') && <BsCheckAll />}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                    ))}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            {showScrollButton && (
              <button
                className="max-scroll-to-bottom-button"
                onClick={() => {
                  autoScrollLockedRef.current = false;
                  isNearBottomRef.current = true;
                  setShowScrollButton(false);
                  scrollToBottom();
                }}
              >
                <FiArrowDownCircle size={35} />
              </button>
            )}
            </div>
            
            {/* Media Viewer Modal */}
            {selectedMedia && (
              <div className="max-media-modal" onClick={() => setSelectedMedia(null)}>
                <div className="max-media-modal-content" onClick={(e) => e.stopPropagation()}>
                  <button className="max-media-close" onClick={() => setSelectedMedia(null)}>×</button>
                  {selectedMedia.type === 'image' && (
                    <img src={selectedMedia.url} alt="Full size" className="max-media-modal-image" />
                  )}
                  <a 
                    href={selectedMedia.url} 
                    download={selectedMedia.name || 'file'}
                    className="max-media-download-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      // Force download with proper filename
                      const link = document.createElement('a');
                      link.href = selectedMedia.url;
                      link.download = selectedMedia.name || 'file';
                      link.target = '_blank';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                  >
                    {t("ui.download")}
                  </a>
                </div>
              </div>
            )}
            <form className="max-chat-input-bar" onSubmit={sendMessage}>
              <div className="max-attach-btn-wrapper" ref={attachmentMenuRef}>
                <GrAttachment
                  className="max-attach-btn"
                  type="button"
                  onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                />
                {showAttachmentMenu && (
                  <div className="max-popup-menu">
                    <label className="max-popup-item">
                      <MdOutlinePhotoLibrary className="max-popup-icon" />
                      {t("ui.photo")}
                      <input
                        type="file"
                        accept="image/*"
                        className="max-hidden-file-input"
                        onChange={(e) => handleFileUpload(e, "image")}
                      />
                    </label>
                    <label className="max-popup-item">
                      <IoVideocamOutline className="max-popup-icon" />
                      {t("ui.video")}
                      <input
                        type="file"
                        accept="video/*"
                        className="max-hidden-file-input"
                        onChange={(e) => handleFileUpload(e, "video")}
                      />
                    </label>
                    <label className="max-popup-item">
                      <CiFileOn className="max-popup-file-icon" />
                      {t("ui.file")}
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        className="max-hidden-file-input"
                        onChange={(e) => handleFileUpload(e, "document")}
                      />
                    </label>
                    {selectedFile && (
                      <div className="max-popup-item max-file-preview">
                        <input
                          type="text"
                          value={selectedFile.name}
                          readOnly
                          className="max-file-name-input"
                        />
                        <button
                          className="max-send-btn"
                          type="button"
                          onClick={handleSendFile}
                        >
                          <IoMdArrowUp />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <input
                type="text"
                placeholder={t("ui.message_placeholder")}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="max-input-text"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(e);
                  }
                }}
              />
              <LuSticker className="max-sticker-btn" />
              <button className="max-send-btn" type="submit">
                <IoMdArrowUp />
              </button>
            </form>
          </>
        )}
      </main>

      {/* New Contact Dialog */}
      {showNewContactDialog && (
        <div className="max-modal-overlay" onClick={() => {
          setShowNewContactDialog(false);
          setValidatedChatId(null);
          setPhoneValidationError("");
          setPhoneValidationSuccess(false);
        }}>
          <div className="max-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="max-modal-header">
              <h3>{t("modal.new_chat")}</h3>
              <button 
                className="max-modal-close"
                onClick={() => {
                  setShowNewContactDialog(false);
                  setValidatedChatId(null);
                  setPhoneValidationError("");
                  setPhoneValidationSuccess(false);
                }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSendToNewContact} className="max-modal-form">
              <div className="max-modal-field">
                <label>{t("modal.phone_number")}</label>
                <div className="max-input-wrapper">
                  <input
                    type="text"
                    placeholder={t("modal.phone_placeholder")}
                    value={newContactPhone}
                    onChange={(e) => {
                      setNewContactPhone(e.target.value);
                      // Reset validation states - debounced effect will handle validation
                      setPhoneValidationError("");
                      setPhoneValidationSuccess(false);
                    }}
                    className={`max-modal-input ${validatingPhone ? 'max-input-validating' : ''} ${phoneValidationError ? 'max-input-error' : ''} ${phoneValidationSuccess ? 'max-input-success' : ''}`}
                    required
                  />
                  {validatingPhone && (
                    <span className="max-input-icon max-validating-icon">⏳</span>
                  )}
                  {phoneValidationSuccess && !validatingPhone && (
                    <span className="max-input-icon max-success-icon">✓</span>
                  )}
                  {phoneValidationError && !validatingPhone && (
                    <span className="max-input-icon max-error-icon">✕</span>
                  )}
                </div>
                {validatingPhone && (
                  <div className="max-validation-badge max-checking">
                    <div className="max-spinner"></div>
                    <span>{t("validation.checking_registration")}</span>
                  </div>
                )}
                {phoneValidationSuccess && !validatingPhone && (
                  <div className="max-validation-badge max-success-badge">
                    <svg className="max-badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <div className="max-badge-content">
                      <span className="max-badge-title">{t("validation.number_verified")}</span>
                      <span className="max-badge-subtitle">{t("validation.number_registered")}</span>
                    </div>
                  </div>
                )}
                {phoneValidationError && !validatingPhone && (
                  <div className="max-validation-badge max-error-badge">
                    <svg className="max-badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <div className="max-badge-content">
                      <span className="max-badge-title">{t("validation.number_not_found")}</span>
                      <span className="max-badge-subtitle">{phoneValidationError}</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="max-modal-field">
                <label>{t("modal.message")}</label>
                <textarea
                  placeholder={t("modal.message_placeholder")}
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
                  onClick={() => {
                    setShowNewContactDialog(false);
                    setValidatedChatId(null);
                    setPhoneValidationError("");
                    setPhoneValidationSuccess(false);
                  }}
                >
                  {t("modal.cancel")}
                </button>
                <button 
                  type="submit"
                  className="max-modal-btn max-modal-btn-send"
                  disabled={sendingMessage || phoneValidationError || (!phoneValidationSuccess && newContactPhone.trim())}
                >
                  {sendingMessage ? t("modal.sending") : t("modal.send")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}