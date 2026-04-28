import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import "../styles/Notification.css";
import LoadingComponent from "../components/Loading/LoadingComponent";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { getNotifications, createNotification } from "../utils/api";

const Notification = () => {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [messageEn, setMessageEn] = useState("");
  const [messageRu, setMessageRu] = useState("");
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isLink, setIsLink] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState("en");
  const [isLoading, setIsLoading] = useState(false);

  const editorRef = useRef(null);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const notifications = await getNotifications();
      setNotifications(notifications);
      setIsLoading(false);
    } catch (error) {
      toast.error(t("notifications.error_message"));
      setIsLoading(false);
    }
  };

  const renderHtmlContent = (htmlString) => {
    return <span dangerouslySetInnerHTML={{ __html: htmlString }} />;
  };

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = currentLanguage === "en" ? messageEn : messageRu;
    }
  }, [currentLanguage]);

  const handleEditorInput = () => {
    const content = editorRef.current?.innerHTML || "";
    if (currentLanguage === "en") {
      setMessageEn(content);
    } else {
      setMessageRu(content);
    }
  };

  const addNotification = async () => {
    const payload = {
      message: {
        en: messageEn,
        ru: messageRu || messageEn,
      },
      type: "info",
      isHtml: true,
    };

    try {
      await createNotification(payload);
      toast.success(t("notifications.success_message"));
      setShowModal(false);
      resetForm();
      fetchNotifications();
    } catch (error) {
      toast.error(t("notifications.error_message"));
    }
  };

  const resetForm = () => {
    setMessageEn("");
    setMessageRu("");
    setCurrentLanguage("en");
    setIsBold(false);
    setIsItalic(false);
    setIsLink(false);
    if (editorRef.current) {
      editorRef.current.innerHTML = "";
    }
  };

  const applyFormatting = (format) => {
    const selection = window.getSelection();
    if (!selection.rangeCount || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    let formattedContent = range.extractContents();

    switch (format) {
      case "bold":
        setIsBold(!isBold);
        const strong = document.createElement("strong");
        strong.appendChild(formattedContent);
        range.insertNode(strong);
        break;
      case "italic":
        setIsItalic(!isItalic);
        const em = document.createElement("em");
        em.appendChild(formattedContent);
        range.insertNode(em);
        break;
      case "link":
        const url = prompt("Enter URL:", "https://");
        if (!url) return;
        setIsLink(true);
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.appendChild(formattedContent);
        range.insertNode(a);
        break;
      default:
        range.insertNode(formattedContent);
        return;
    }

    selection.removeAllRanges();
    handleEditorInput();
  };

  return (
          <div className="applications-container">
            <div className="notification-system">
              <ToastContainer position="top-right" autoClose={3000} />
              <div className="notification-header-actions">
                <button
                  className="add-notification-btn"
                  onClick={() => setShowModal(true)}
                >
                  {t("notifications.add_notification")}
                </button>
              </div>

              <div className="notifications-container">
                {isLoading ? (
                  <div className="loading-state">
                    <div className="spinner"></div>
                    <span>{t("notifications.loading_users")}</span>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="empty-state">
                    <svg
                      width="48"
                      height="48"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M12 8V12"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <path
                        d="M12 16H12.01"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                    <p>{t("notifications.no_users_found")}</p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div key={notification._id} className="notification-card">
                      <div className="notification-header">
                        <span className="notification-type">{notification.type}</span>
                        <span className="notification-date">
                          {new Date(notification.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="notification-body">
                        {notification.message.en && (
                          <div className="notification-section">
                            <p className="notification-label">
                              {t("notifications.english")}:{" "}
                              <span>{renderHtmlContent(notification.message.en)}</span>
                            </p>
                          </div>
                        )}
                        {notification.message.ru && (
                          <div className="notification-section">
                            <p className="notification-label">
                              {t("notifications.russian")}:{" "}
                              <span>{renderHtmlContent(notification.message.ru)}</span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {showModal && (
                <div className="notification-modal-overlay">
                  <div className="notification-modal-container">
                    <div className="notification-modal-header">
                      <h2>{t("notifications.create_new_notification")}</h2>
                      <button
                        className="notification-modal-close"
                        onClick={() => setShowModal(false)}
                        aria-label={t("notifications.close_modal")}
                      >
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M18 6L6 18"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M6 6L18 18"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>

                    <div className="notification-modal-content">
                      <div className="notification-modal-section">
                        <h3 className="notification-section-title">{t("notifications.notification_content")}</h3>
                        <div className="notification-language-tabs">
                          <button
                            className={`notification-lang-tab ${currentLanguage === "en" ? "active" : ""}`}
                            onClick={() => setCurrentLanguage("en")}
                          >
                            {t("notifications.english")}
                          </button>
                          <button
                            className={`notification-lang-tab ${currentLanguage === "ru" ? "active" : ""}`}
                            onClick={() => setCurrentLanguage("ru")}
                          >
                            {t("notifications.russian")}
                          </button>
                        </div>
                      </div>

                      <div className="notification-modal-section">
                        <div className="notification-rich-editor">
                          <div className="notification-editor-toolbar">
                            <button
                              onClick={() => applyFormatting("bold")}
                              className={`notification-format-btn ${isBold ? "active" : ""}`}
                              aria-label={t("notifications.bold")}
                            >
                              <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M6 4H14C15.5913 4 17.1174 4.63214 18.2426 5.75736C19.3679 6.88258 20 8.4087 20 10C20 11.5913 19.3679 13.1174 18.2426 14.2426C17.1174 15.3679 15.5913 16 14 16H6V4Z"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M6 12H15C16.0609 12 17.0783 12.4214 17.8284 13.1716C18.5786 13.9217 19 14.9391 19 16C19 17.0609 18.5786 18.0783 17.8284 18.8284C17.0783 19.5786 16.0609 20 15 20H6V12Z"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={() => applyFormatting("italic")}
                              className={`notification-format-btn ${isItalic ? "active" : ""}`}
                              aria-label={t("notifications.italic")}
                            >
                              <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M19 4H10"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M14 20H5"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M15 4L9 20"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={() => applyFormatting("link")}
                              className={`notification-format-btn ${isLink ? "active" : ""}`}
                              aria-label={t("notifications.link")}
                            >
                              <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M10 13C10.4295 13.5741 10.9774 14.0491 11.6066 14.3929C12.2357 14.7367 12.9315 14.9411 13.6467 14.9923C14.3618 15.0435 15.0796 14.9403 15.7513 14.6897C16.4231 14.4392 17.0331 14.047 17.54 13.54L20.54 10.54C21.4508 9.59695 21.9548 8.33394 21.9434 7.02296C21.932 5.71198 21.4061 4.45791 20.4791 3.53087C19.5521 2.60383 18.298 2.07799 16.987 2.0666C15.6761 2.05521 14.413 2.55916 13.47 3.46997L11.75 5.17997"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M14 11C13.5705 10.4259 13.0226 9.9508 12.3934 9.60705C11.7642 9.26329 11.0685 9.05886 10.3533 9.00766C9.63816 8.95646 8.92037 9.05963 8.24861 9.3102C7.57685 9.56077 6.96684 9.95296 6.45996 10.46L3.45996 13.46C2.54915 14.403 2.0452 15.666 2.05659 16.977C2.06798 18.288 2.59382 19.5421 3.52086 20.4691C4.4479 21.3962 5.70197 21.922 7.01295 21.9334C8.32393 21.9448 9.58694 21.4408 10.53 20.53L12.24 18.82"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                          </div>
                          <div
                            ref={editorRef}
                            className="notification-editor-content"
                            contentEditable
                            onInput={handleEditorInput}
                            placeholder={t("notifications.write_message_placeholder", {
                              language: currentLanguage === "en" ? t("notifications.english") : t("notifications.russian"),
                            })}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="notification-modal-footer">
                      <button
                        className="notification-cancel-btn"
                        onClick={() => setShowModal(false)}
                      >
                        {t("notifications.cancel")}
                      </button>
                      <button
                        className="notification-submit-btn"
                        onClick={addNotification}
                        disabled={!messageEn && !messageRu}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M12 5V19"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M5 12H19"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        {t("notifications.send_notification")}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
  );
};

export default Notification;