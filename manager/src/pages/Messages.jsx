import React, { useEffect, useState, useRef, useContext, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  getMessagesBetweenUsers,
  sendChatMessage,
  uploadFile,
  getDoctors,
  getManagersData,
  getAssistantsData,
  getUnreadCounts,
  markMessagesAsRead,
} from "../utils/api";
import {
  FiSend,
  FiUser,
  FiUsers,
  FiMessageSquare,
  FiPaperclip,
  FiFile,
  FiX,
  FiSearch,
  FiMoreVertical,
  FiArrowLeft,
} from "react-icons/fi";
import { AuthContext } from "../context/AuthContext";
import defaultUserImage from "../assets/default-user.png";
import "../styles/Messages.css";

// Helper function to extract multilingual field values
const getFieldValue = (field, lang = 'en') => {
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (typeof field === 'object') return field[lang] || field['en'] || '';
  return '';
};

const Messages = ({ currentUser }) => {
  const { t, i18n } = useTranslation();
  const [doctors, setDoctors] = useState([]);
  const [managers, setManagers] = useState([]);
  const [headManagers, setHeadManagers] = useState([]);
  const [assistants, setAssistants] = useState([]);
  const [headAssistants, setHeadAssistants] = useState([]);
  const [activeRoleTab, setActiveRoleTab] = useState("all");
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [filePreview, setFilePreview] = useState(null);
  const [fileType, setFileType] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [unreadCounts, setUnreadCounts] = useState({});
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const selectedRecipientRef = useRef(null);
  const messagePollingRef = useRef(null);
  const unreadPollingRef = useRef(null);
  const { user } = useContext(AuthContext);

  const POLLING_INTERVAL = 3000;

  const baseUrl = import.meta.env.VITE_BASE_URL || "http://localhost:3003";

  const safeCurrentUser = {
    email: user?.email || currentUser?.email || "",
    role: user?.role || currentUser?.role || "",
    fullName: user?.fullName || currentUser?.fullName || "Current User",
    profilePicture:
      user?.profilePicture || currentUser?.profilePicture || defaultUserImage,
  };

  useEffect(() => {
    fetchSidebarData();
  }, []);

  // Keep selectedRecipientRef in sync
  useEffect(() => {
    selectedRecipientRef.current = selectedRecipient;
  }, [selectedRecipient]);

  // Unread counts polling
  useEffect(() => {
    if (safeCurrentUser.email) {
      fetchUnreadCounts();
      unreadPollingRef.current = setInterval(() => {
        fetchUnreadCounts(true);
      }, POLLING_INTERVAL);
    }
    return () => {
      if (unreadPollingRef.current) {
        clearInterval(unreadPollingRef.current);
      }
    };
  }, [safeCurrentUser.email]);

  // Message polling when recipient selected
  useEffect(() => {
    if (selectedRecipient) {
      fetchMessages(selectedRecipient.email);
      
      if (messagePollingRef.current) {
        clearInterval(messagePollingRef.current);
      }
      messagePollingRef.current = setInterval(() => {
        if (selectedRecipientRef.current) {
          fetchMessages(selectedRecipientRef.current.email, true);
        }
      }, POLLING_INTERVAL);
    } else {
      setMessages([]);
      if (messagePollingRef.current) {
        clearInterval(messagePollingRef.current);
        messagePollingRef.current = null;
      }
    }
    
    return () => {
      if (messagePollingRef.current) {
        clearInterval(messagePollingRef.current);
        messagePollingRef.current = null;
      }
    };
  }, [selectedRecipient]);

  const fetchSidebarData = async () => {
    try {
      const [docRes, managerRes, assistantRes] = await Promise.all([
        getDoctors(),
        getManagersData(),
        getAssistantsData(),
      ]);

      const currentLang = (i18n.language || "en").startsWith("ru")
        ? "ru"
        : "en";

      // DoctorsProfile endpoint returns { success, count, data }
      // Keep backward compatibility for older shapes.
      const doctorList = Array.isArray(docRes?.data)
        ? docRes.data
        : Array.isArray(docRes?.doctors)
          ? docRes.doctors
          : Array.isArray(docRes)
            ? docRes
            : [];

      const formattedDoctors = doctorList.map((d) => ({
        ...d,
        fullName: [
          getFieldValue(d.firstName, currentLang),
          getFieldValue(d.middleName, currentLang),
          getFieldValue(d.lastName, currentLang),
        ]
          .filter(Boolean)
          .join(" ") || d.email || "Unknown Doctor",
        profilePicture: d.profilePicture
          ? `data:image/jpeg;base64,${d.profilePicture}`
          : defaultUserImage,
        role: d.role || "doctor",
      }));

      const allManagers = (managerRes.managers || []).map((m) => ({
        ...m,
        fullName: [m.firstName, m.middleName, m.lastName]
          .filter(Boolean)
          .join(" "),
        profilePicture: m.profilePicture
          ? `data:image/jpeg;base64,${m.profilePicture}`
          : defaultUserImage,
        role: m.role || "manager",
      }));

      const allAssistants = (assistantRes.assistants || []).map((a) => ({
        ...a,
        fullName: [a.firstName, a.middleName, a.lastName]
          .filter(Boolean)
          .join(" "),
        profilePicture: a.profilePicture
          ? `data:image/jpeg;base64,${a.profilePicture}`
          : defaultUserImage,
        role: a.role || "assistant",
      }));

      const filteredManagers = allManagers.filter((m) => m.role === "manager");
      if (filteredManagers.length > 0) {
        setManagers([
          {
            fullName: t("messages.sections.managers"),
            email: "manager_group@system",
            role: "manager_group",
            profilePicture: filteredManagers[0].profilePicture,
            groupMembers: filteredManagers,
          },
        ]);
      } else {
        setManagers([]);
      }
      setHeadManagers(allManagers.filter((m) => m.role === "head_manager"));

      setAssistants(allAssistants.filter((a) => a.role === "assistant"));
      setHeadAssistants(
        allAssistants.filter((a) => a.role === "head_assistant")
      );
      setDoctors(formattedDoctors);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchUnreadCounts = async (silent = false) => {
    try {
      const counts = await getUnreadCounts(safeCurrentUser.email);

      if (!counts || !counts.success) {
        if (!silent) 
        return;
      }

      const { managerUnread = {}, otherUnread = {} } = counts;

      const totalManagerUnread = Object.values(managerUnread).reduce(
        (sum, val) => sum + val,
        0
      );

      const combinedUnread = {
        ...otherUnread,
        ...(totalManagerUnread > 0
          ? { "manager_group@system": totalManagerUnread }
          : {}),
      };

      // Preserve cleared unread count for selected recipient during polling
      if (silent && selectedRecipientRef.current) {
        const selectedEmail = selectedRecipientRef.current.email;
        if (combinedUnread[selectedEmail] !== undefined) {
          combinedUnread[selectedEmail] = 0;
        }
      }

      setUnreadCounts(combinedUnread);
    } catch (err) {
    }
  };

  const fetchMessages = async (email, silent = false) => {
    try {
      if (!safeCurrentUser.email || !email) {
        return;
      }
      const msgs = await getMessagesBetweenUsers(safeCurrentUser.email, email);

      setMessages(msgs || []);
      if (!silent) setTimeout(scrollToBottom, 100);
    } catch (err) {
      if (!silent) {
        setError(err.message);
      }
    }
  };

  const handleRecipientSelect = async (recipient) => {
    if (selectedRecipient?.email === recipient.email) return;
    
    const hadUnread = unreadCounts[recipient.email] > 0;
    setSelectedRecipient(recipient);
    setShowMobileChat(true); // Show chat view on mobile
    
    // Clear unread count in UI immediately
    if (hadUnread) {
      setUnreadCounts((prev) => ({
        ...prev,
        [recipient.email]: 0,
      }));
      
      // Mark messages as read in backend
      try {
        await markMessagesAsRead(safeCurrentUser.email, recipient.email);
      } catch (err) {
      }
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !file) || isSending || !selectedRecipient) return;

    if (!safeCurrentUser.email || !selectedRecipient.email) {
      setError(t("messages.errors.missingInfo"));
      return;
    }

    setIsSending(true);
    try {
      let fileData = null;
      if (file) {
        const upload = await uploadFile(file);
        fileData = {
          file: {
            id: upload.fileId,
            url: upload.fileUrl,
            type: upload.fileType,
          },
        };
      }

      const basePayload = {
        text: input.trim(),
        sender: {
          email: safeCurrentUser.email,
          role: safeCurrentUser.role,
          name: safeCurrentUser.fullName,
        },
        ...(fileData && fileData),
      };

      if (selectedRecipient.role === "manager_group") {
        const groupMembers = selectedRecipient.groupMembers || [];
        for (const manager of groupMembers) {
          const payload = {
            ...basePayload,
            receiver: {
              email: manager.email,
              role: manager.role || "manager",
              name: manager.fullName,
            },
          };
          await sendChatMessage(payload);
        }
      } else {
        const payload = {
          ...basePayload,
          receiver: {
            email: selectedRecipient.email,
            role: selectedRecipient.role || "user",
            name: selectedRecipient.fullName,
          },
        };
        await sendChatMessage(payload);
      }

      await fetchMessages(selectedRecipient.email);
      setInput("");
      setFile(null);
      setFilePreview(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    if (selectedFile.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => setFilePreview(reader.result);
      reader.readAsDataURL(selectedFile);
      setFileType("image");
    } else setFileType("document");
  };

  const removeFile = () => {
    setFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleTimeString(i18n.language, {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleDateString(i18n.language, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const filteredUsers = (users) => {
    return users.filter(
      (user) =>
        user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const getStatusColor = (role) => {
    switch (role) {
      case "doctor":
        return "#34b7f1";
      case "manager":
        return "#4a6fa5";
      case "head_manager":
        return "#2e5b8b";
      default:
        return "#999";
    }
  };

  // Get tab label with translation
  const getTabLabel = (role) => {
    switch (role) {
      case "all":
        return t("messages.tabs.all");
      case "manager":
        return t("messages.tabs.manager");
      case "assistant":
        return t("messages.tabs.assistant");
      case "doctor":
        return t("messages.tabs.doctor");
      default:
        return role;
    }
  };

  // Get section title with translation
  const getSectionTitle = (titleKey) => {
    switch (titleKey) {
      case "Head Managers":
        return t("messages.sections.headManagers");
      case "Managers":
        return t("messages.sections.managers");
      case "Head Assistants":
        return t("messages.sections.headAssistants");
      case "Assistants":
        return t("messages.sections.assistants");
      case "Head Doctors":
        return t("messages.sections.headDoctors");
      case "Doctors":
        return t("messages.sections.doctors");
      default:
        return titleKey;
    }
  };

  return (
    <div className="mm-modern-page">
      <div className="mm-modern-container">
        {/* LEFT SIDEBAR - Modern Design */}
        <div className={`mm-modern-sidebar ${showMobileChat ? 'mm-mobile-sidebar-hidden' : ''}`}>
          <div className="mm-sidebar-header">
            <div className="mm-user-info">
              <img
                src={safeCurrentUser.profilePicture}
                alt={safeCurrentUser.fullName}
                className="mm-current-user-avatar"
                onError={(e) => {
                  e.target.src = defaultUserImage;
                }}
              />
              <div className="mm-user-details">
                <h3>{safeCurrentUser.fullName}</h3>
                <span className="mm-user-role">{safeCurrentUser.role}</span>
              </div>
            </div>
            <button className="mm-menu-btn">
              <FiMoreVertical />
            </button>
          </div>

          <div className="mm-search-container">
            <div className="mm-search-box">
              <FiSearch className="mm-search-icon" />
              <input
                type="text"
                placeholder={t("messages.search.placeholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mm-search-input"
              />
            </div>
          </div>

          {/* Role Filter Tabs */}
          <div className="mm-role-tabs">
            {["all", "manager", "assistant", "doctor"].map((role) => (
              <button
                key={role}
                className={`mm-role-tab ${
                  activeRoleTab === role ? "active" : ""
                }`}
                onClick={() => setActiveRoleTab(role)}
              >
                {getTabLabel(role)}
              </button>
            ))}
          </div>

          {/* 🔹 Filtered Contact Sections - Dynamic Ordering */}
          <div className="mm-contacts-list">
            {(() => {
              const roleSections = [
                {
                  title: "Head Managers",
                  users: headManagers,
                },
                {
                  title: "Managers",
                  users: managers,
                },
                {
                  title: "Head Assistants",
                  users: headAssistants,
                },
                {
                  title: "Assistants",
                  users: assistants,
                },
                {
                  title: "Head Doctors",
                  users: doctors.filter((d) => d.role === "head_doctor"),
                },
                {
                  title: "Doctors",
                  users: doctors.filter((d) => d.role === "doctor"),
                },
              ];

              const visibleSections = roleSections
                .filter(({ title, users }) => {
                  if (
                    activeRoleTab !== "all" &&
                    !title.toLowerCase().includes(activeRoleTab)
                  )
                    return false;

                  const filtered = users.filter(
                    (u) =>
                      u.fullName
                        ?.toLowerCase()
                        .includes(searchTerm.toLowerCase()) ||
                      u.email?.toLowerCase().includes(searchTerm.toLowerCase())
                  );
                  return filtered.length > 0;
                })

                .sort((a, b) => {
                  const aMatches = a.users.filter(
                    (u) =>
                      u.fullName
                        ?.toLowerCase()
                        .includes(searchTerm.toLowerCase()) ||
                      u.email?.toLowerCase().includes(searchTerm.toLowerCase())
                  ).length;
                  const bMatches = b.users.filter(
                    (u) =>
                      u.fullName
                        ?.toLowerCase()
                        .includes(searchTerm.toLowerCase()) ||
                      u.email?.toLowerCase().includes(searchTerm.toLowerCase())
                  ).length;
                  return bMatches - aMatches;
                });

              if (visibleSections.length === 0)
                return (
                  <div className="mm-empty-contacts">
                    {t("messages.errors.noUsersFound")}
                  </div>
                );

              return visibleSections.map(({ title, users }) => (
                <ContactSection
                  key={title}
                  title={getSectionTitle(title)}
                  users={users}
                  selectedRecipient={selectedRecipient}
                  setSelectedRecipient={setSelectedRecipient}
                  handleRecipientSelect={handleRecipientSelect}
                  getStatusColor={getStatusColor}
                  currentUserEmail={safeCurrentUser.email}
                  searchTerm={searchTerm}
                  unreadCounts={unreadCounts}
                  fetchUnreadCounts={fetchUnreadCounts}
                  safeCurrentUser={safeCurrentUser}
                  t={t}
                />
              ));
            })()}
          </div>
        </div>

        {/* RIGHT CHAT PANEL - Modern Design */}
        <div className={`mm-modern-chat ${showMobileChat ? 'mm-mobile-chat-active' : ''}`}>
          {selectedRecipient ? (
            <>
              <div className="mm-chat-header">
                <button 
                  className="mm-back-btn-mobile"
                  onClick={() => setShowMobileChat(false)}
                  aria-label="Back to contacts"
                >
                  <FiArrowLeft />
                </button>
                <div className="mm-chat-user-info">
                  <div className="mm-avatar-container">
                    <img
                      src={selectedRecipient.profilePicture || defaultUserImage}
                      alt={selectedRecipient.fullName}
                      className="mm-chat-user-avatar"
                      onError={(e) => {
                        e.target.src = defaultUserImage;
                      }}
                    />
                    <div
                      className="mm-status-indicator"
                      style={{
                        backgroundColor: getStatusColor(selectedRecipient.role),
                      }}
                    />
                  </div>
                  <div className="mm-chat-user-details">
                    <h3>{selectedRecipient.fullName}</h3>
                    <span className="mm-user-role">
                      {selectedRecipient.role}
                    </span>
                  </div>
                </div>
                <div className="mm-chat-actions">
                  <button className="mm-action-btn">
                    <FiMoreVertical />
                  </button>
                </div>
              </div>

              {error && (
                <div className="mm-error-message">
                  {error}
                  <button
                    onClick={() => setError(null)}
                    className="mm-error-close-btn"
                  >
                    <FiX />
                  </button>
                </div>
              )}

              <div className="mm-chat-messages" ref={messagesEndRef}>
                {messages.length > 0 ? (
                  messages.map((msg, index) => {
                    const showDate =
                      index === 0 ||
                      formatDate(messages[index - 1]?.timestamp) !==
                        formatDate(msg.timestamp);

                    return (
                      <React.Fragment key={msg._id || index}>
                        {showDate && (
                          <div className="mm-date-divider">
                            <span>{formatDate(msg.timestamp)}</span>
                          </div>
                        )}
                        <MessageBubble
                          message={msg}
                          isSender={msg.sender?.email === safeCurrentUser.email}
                          formatTime={formatTime}
                          baseUrl={baseUrl}
                          t={t}
                          selectedRecipient={selectedRecipient}
                        />
                      </React.Fragment>
                    );
                  })
                ) : (
                  <div className="mm-empty-chat">
                    <FiMessageSquare />
                    <p>{t("messages.chat.noMessages")}</p>
                    <span>
                      {t("messages.chat.startConversation", {
                        name: selectedRecipient.fullName,
                      })}
                    </span>
                  </div>
                )}
              </div>

              {file && (
                <div className="mm-file-preview-modern">
                  <div className="mm-file-preview-content">
                    {filePreview ? (
                      <img
                        src={filePreview}
                        alt="preview"
                        className="mm-preview-image"
                      />
                    ) : (
                      <div className="mm-file-document">
                        <FiFile size={20} />
                        <span className="mm-file-name">{file.name}</span>
                      </div>
                    )}
                  </div>
                  <button onClick={removeFile} className="mm-remove-file-btn">
                    <FiX />
                  </button>
                </div>
              )}

              <div className="mm-chat-input-container">
                <button
                  className="mm-attach-btn-modern"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FiPaperclip />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*,.pdf,.doc,.docx"
                  style={{ display: "none" }}
                />
                <input
                  type="text"
                  className="mm-chat-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSend()}
                  placeholder={t("messages.chat.inputPlaceholder")}
                />
                <button
                  className="mm-send-btn-modern"
                  onClick={handleSend}
                  disabled={isSending || (!input.trim() && !file)}
                >
                  <FiSend />
                </button>
              </div>
            </>
          ) : (
            <div className="mm-welcome-screen">
              <div className="mm-welcome-content">
                <FiMessageSquare className="mm-welcome-icon" />
                <h2>{t("messages.welcome.title")}</h2>
                <p>{t("messages.welcome.description")}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ContactItem = ({
  user,
  isSelected,
  onClick,
  statusColor,
  currentUserEmail,
  unreadCounts,
  t,
}) => {
  const displayName =
    user.email === currentUserEmail
      ? `${user.fullName}${t("messages.chat.you")}`
      : user.fullName;

  return (
    <div
      className={`mm-contact-item ${isSelected ? "mm-contact-selected" : ""}`}
      onClick={onClick}
    >
      <div className="mm-contact-avatar">
        <img
          src={user.profilePicture}
          alt={displayName}
          onError={(e) => {
            e.target.src = defaultUserImage;
          }}
        />
        <div
          className="mm-contact-status"
          style={{ backgroundColor: statusColor }}
        />
      </div>
      <div className="mm-contact-info">
        <h4 className="mm-contact-name">
          {displayName}
          {unreadCounts[user.email] > 0 && (
            <span className="mm-unread-badge">{unreadCounts[user.email]}</span>
          )}
        </h4>

        <span className="mm-contact-role">{user.role}</span>
      </div>
    </div>
  );
};

const ContactSection = ({
  title,
  users,
  selectedRecipient,
  setSelectedRecipient,
  handleRecipientSelect,
  getStatusColor,
  currentUserEmail,
  searchTerm,
  unreadCounts,
  fetchUnreadCounts,
  safeCurrentUser,
  t,
}) => {
  const filtered = users.filter(
    (user) =>
      user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="mm-contact-section">
      <div className="mm-section-header">
        <span className="mm-section-title">{title}</span>
        <span className="mm-section-badge">{filtered.length}</span>
      </div>
      {filtered.length > 0 ? (
        filtered.map((user) => (
          <ContactItem
            key={user.email}
            user={user}
            isSelected={selectedRecipient?.email === user.email}
            onClick={() => handleRecipientSelect(user)}
            statusColor={getStatusColor(user.role)}
            currentUserEmail={currentUserEmail}
            unreadCounts={unreadCounts}
            t={t}
          />
        ))
      ) : (
        <div className="mm-empty-contacts">
          {t("messages.errors.noSectionUsers", {
            section: title.toLowerCase(),
          })}
        </div>
      )}
    </div>
  );
};

const MessageBubble = ({
  message,
  isSender,
  formatTime,
  baseUrl,
  t,
  selectedRecipient,
}) => {
  const renderAttachment = () => {
    if (!message.file || typeof message.file !== "object") return null;

    const fileUrl = message.file?.url
      ? message.file.url.startsWith("http")
        ? message.file.url
        : `${baseUrl}${message.file.url}`
      : null;

    const fileType = message.file?.type || "";

    if (!fileUrl) return null;
    if (fileType === "image") {
      return (
        <div className="mm-file-preview">
          <img
            src={fileUrl}
            alt={message.file.fileName || "attachment"}
            className="mm-message-image"
            onError={(e) => (e.target.style.display = "none")}
          />
        </div>
      );
    }

    if (fileType === "pdf") {
      return (
        <div className="mm-file-preview mm-pdf-preview">
          <iframe
            src={fileUrl}
            title={message.file.fileName || "PDF"}
            className="mm-pdf-frame"
          ></iframe>
          <div className="mm-file-actions">
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mm-btn mm-view-btn"
            >
              {t("messages.chat.viewPdf")}
            </a>
            <a href={fileUrl} download className="mm-btn mm-download-btn">
              {t("messages.chat.download")}
            </a>
          </div>
        </div>
      );
    }

    if (["document", "other"].includes(fileType)) {
      return (
        <div className="mm-file-preview mm-doc-preview">
          <div className="mm-file-doc-info">
            <FiFile size={22} />
            <span className="mm-file-name">
              {message.file.fileName || "document"}
            </span>
          </div>
          <div className="mm-file-actions">
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mm-view-btn"
            >
              {t("messages.chat.view")}
            </a>
            <a href={fileUrl} download className="mm-download-btn">
              {t("messages.chat.download")}
            </a>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div
      className={`mm-message-modern ${
        isSender ? "mm-message-sent" : "mm-message-received"
      }`}
    >
      <div className="mm-message-content">
        {selectedRecipient?.role === "manager_group" &&
          !isSender &&
          message.sender?.name && (
            <div className="mm-message-sender-name">{message.sender.name}</div>
          )}

        {renderAttachment()}
        {message.text && <div className="mm-message-text">{message.text}</div>}
        <div className="mm-message-time">{formatTime(message.timestamp)}</div>
      </div>
    </div>
  );
};

export default Messages;
