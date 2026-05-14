import React, { useEffect, useState, useRef, useContext } from "react";
import { useTranslation } from "react-i18next";
import {
  getMessagesBetweenUsers,
  sendChatMessage,
  uploadFile,
  getDoctorsData,
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
} from "react-icons/fi";
import { AuthContext } from "../context/AuthContext";
import defaultUserImage from "../assets/default-user.png";
import "../styles/Messages.css";

const getLocalizedText = (value, language) => {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";

  const preferredKeys = language === "ru" ? ["ru", "en"] : ["en", "ru"];
  for (const key of preferredKeys) {
    if (typeof value[key] === "string" && value[key].trim()) {
      return value[key].trim();
    }
  }

  const fallback = Object.values(value).find((entry) => typeof entry === "string" && entry.trim());
  return fallback ? fallback.trim() : "";
};

const formatPersonName = (person, language) => {
  if (!person || typeof person !== "object") return "";
  return [
    getLocalizedText(person.firstName, language),
    getLocalizedText(person.middleName, language),
    getLocalizedText(person.lastName, language),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
};

const normalizeDisplayName = (value, language) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return (
      getLocalizedText(value[language], language) ||
      getLocalizedText(value.en, language) ||
      getLocalizedText(value.ru, language) ||
      ""
    );
  }
  return String(value);
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
  const [filePreview, setFilePreview] = useState(null);
  const [fileType, setFileType] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [unreadCounts, setUnreadCounts] = useState({});
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const { user } = useContext(AuthContext);

  const baseUrl = import.meta.env.VITE_BASE_URL || "http://localhost:3003";
  const uiLanguage = i18n.language === "ru" ? "ru" : "en";

  // Safe current user data with defaults - prioritize AuthContext user
  const safeCurrentUser = {
    email: user?.email || currentUser?.email || "",
    role: user?.role || currentUser?.role || "",
    fullName: normalizeDisplayName(user?.fullName || currentUser?.fullName, uiLanguage) || "Current User",
    profilePicture:
      user?.profilePicture || currentUser?.profilePicture || defaultUserImage,
  };

  useEffect(() => {
    fetchSidebarData();
  }, []);

  useEffect(() => {
    if (safeCurrentUser.email) fetchUnreadCounts();
  }, [safeCurrentUser.email]);

  useEffect(() => {
    if (selectedRecipient) fetchMessages(selectedRecipient.email);
  }, [selectedRecipient]);

  // Fetch all contacts (doctors, managers, assistants)
  const fetchSidebarData = async () => {
    try {
      const [docRes, managerRes, assistantRes] = await Promise.all([
        getDoctorsData(),
        getManagersData(),
        getAssistantsData(),
      ]);

      const formattedDoctors = (docRes.doctors || []).map((d) => ({
        ...d,
        fullName: formatPersonName(d, uiLanguage),
        profilePicture: d.profilePicture
          ? `data:image/jpeg;base64,${d.profilePicture}`
          : defaultUserImage,
        role: d.role || "doctor",
      }));

      const allManagers = (managerRes.managers || []).map((m) => ({
        ...m,
        fullName: formatPersonName(m, uiLanguage),
        profilePicture: m.profilePicture
          ? `data:image/jpeg;base64,${m.profilePicture}`
          : defaultUserImage,
        role: m.role || "manager",
      }));

      const allAssistants = (assistantRes.assistants || []).map((a) => ({
        ...a,
        fullName: formatPersonName(a, uiLanguage),
        profilePicture: a.profilePicture
          ? `data:image/jpeg;base64,${a.profilePicture}`
          : defaultUserImage,
        role: a.role || "assistant",
      }));

      setManagers(allManagers.filter((m) => m.role === "manager"));
      setHeadManagers(allManagers.filter((m) => m.role === "head_manager"));
      setAssistants(allAssistants.filter((a) => a.role === "assistant"));
      setHeadAssistants(
        allAssistants.filter((a) => a.role === "head_assistant")
      );
      setDoctors(formattedDoctors);
    } catch (err) {
      console.error("Sidebar fetch failed:", err);
      setError(err.message);
    }
  };

  const fetchUnreadCounts = async () => {
    try {
      const counts = await getUnreadCounts(safeCurrentUser.email);
      setUnreadCounts(counts);
    } catch (err) {
      console.error("Unread fetch failed:", err);
    }
  };

  const fetchMessages = async (email) => {
    try {
      if (!safeCurrentUser.email || !email) {
        console.error("Missing email for fetching messages");
        return;
      }
      const msgs = await getMessagesBetweenUsers(safeCurrentUser.email, email);
      setMessages(msgs || []);
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      console.error("Fetch messages failed:", err);
      setError(err.message);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !file) || isSending || !selectedRecipient) return;

    // Validate required fields
    if (!safeCurrentUser.email || !selectedRecipient.email) {
      setError("Missing required user information");
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

      const payload = {
        text: input.trim(),
        sender: {
          email: safeCurrentUser.email,
          role: safeCurrentUser.role,
        },
        receiver: {
          email: selectedRecipient.email,
          role: selectedRecipient.role || "user",
        },
        ...(fileData && fileData),
      };

      await sendChatMessage(payload);
      await fetchMessages(selectedRecipient.email);
      setInput("");
      setFile(null);
      setFilePreview(null);
    } catch (err) {
      console.error("Send message error:", err);
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
        String(user.fullName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
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

  return (
    <div className="mm-modern-page">
      <div className="mm-modern-container">
        {/* LEFT SIDEBAR - Modern Design */}
        <div className="mm-modern-sidebar">
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
                placeholder="Search contacts..."
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
                {role === "all"
                  ? "All"
                  : role === "manager"
                  ? "Managers"
                  : role === "assistant"
                  ? "Assistants"
                  : "Doctors"}
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

              //  Filter role sections dynamically by search results and selected tab
              const visibleSections = roleSections
                .filter(({ title, users }) => {
                  // Filter out sections that don't match the active tab
                  if (
                    activeRoleTab !== "all" &&
                    !title.toLowerCase().includes(activeRoleTab)
                  )
                    return false;

                  // Keep only if it has at least one matching user
                  const filtered = users.filter(
                    (u) =>
                      u.fullName
                        ?.toLowerCase()
                        .includes(searchTerm.toLowerCase()) ||
                      u.email?.toLowerCase().includes(searchTerm.toLowerCase())
                  );
                  return filtered.length > 0;
                })
                //  Sort dynamically by how many matches they have
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
                  return bMatches - aMatches; // higher matches first
                });

              if (visibleSections.length === 0)
                return <div className="mm-empty-contacts">No users found</div>;

              return visibleSections.map(({ title, users }) => (
                <ContactSection
                  key={title}
                  title={title}
                  users={users}
                  selectedRecipient={selectedRecipient}
                  setSelectedRecipient={setSelectedRecipient}
                  getStatusColor={getStatusColor}
                  currentUserEmail={safeCurrentUser.email}
                  searchTerm={searchTerm}
                  unreadCounts={unreadCounts}
                  fetchUnreadCounts={fetchUnreadCounts}
                  safeCurrentUser={safeCurrentUser}
                />
              ));
            })()}
          </div>
        </div>

        {/* RIGHT CHAT PANEL - Modern Design */}
        <div className="mm-modern-chat">
          {selectedRecipient ? (
            <>
              <div className="mm-chat-header">
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
                        />
                      </React.Fragment>
                    );
                  })
                ) : (
                  <div className="mm-empty-chat">
                    <FiMessageSquare />
                    <p>No messages yet</p>
                    <span>
                      Start a conversation with {selectedRecipient.fullName}
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
                  placeholder="Type your message..."
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
                <h2>Welcome to Messages</h2>
                <p>Select a contact to start chatting</p>
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
}) => {
  const displayName =
    user.email === currentUserEmail ? `${user.fullName} (You)` : user.fullName;

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
  getStatusColor,
  currentUserEmail,
  searchTerm,
  unreadCounts,
  fetchUnreadCounts,
  safeCurrentUser,
}) => {
  const filtered = users.filter(
    (user) =>
      String(user.fullName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
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
            onClick={async () => {
              setSelectedRecipient(user);

              // Mark messages as read immediately
              if (safeCurrentUser.email && user.email) {
                try {
                  await markMessagesAsRead(safeCurrentUser.email, user.email);
                  fetchUnreadCounts(); // refresh after marking
                } catch (err) {
                  console.error("Mark read failed:", err);
                }
              }
            }}
            statusColor={getStatusColor(user.role)}
            currentUserEmail={currentUserEmail}
            unreadCounts={unreadCounts}
          />
        ))
      ) : (
        <div className="mm-empty-contacts">No {title.toLowerCase()} found</div>
      )}
    </div>
  );
};

const MessageBubble = ({ message, isSender, formatTime, baseUrl }) => {
  const renderAttachment = () => {
    if (!message.file || !message.file.url) return null;

    const fileUrl = message.file.url.startsWith("http")
      ? message.file.url
      : `${baseUrl}${message.file.url}`;
    const fileType = message.file.type || "";

    // IMAGE PREVIEW
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

    // PDF PREVIEW (inline)
    if (fileType === "pdf") {
      return (
        <div className="mm-file-preview mm-pdf-preview">
          <iframe
            src={fileUrl}
            title={message.file.fileName}
            className="mm-pdf-frame"
          ></iframe>
          <div className="mm-file-actions">
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mm-btn mm-view-btn"
            >
              View PDF
            </a>
            <a href={fileUrl} download className="mm-btn mm-download-btn">
              Download
            </a>
          </div>
        </div>
      );
    }

    // DOCUMENT (docx, doc, other)
    if (fileType === "document" || fileType === "other") {
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
              View
            </a>
            <a href={fileUrl} download className="mm-download-btn">
              Download
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
        {renderAttachment()}
        {message.text && <div className="mm-message-text">{message.text}</div>}
        <div className="mm-message-time">{formatTime(message.timestamp)}</div>
      </div>
    </div>
  );
};

export default Messages;
