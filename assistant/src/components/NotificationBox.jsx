import React, { useEffect, useRef, useState, useContext } from "react";
import { BiSolidBellRing } from "react-icons/bi";
import { FaRegUser } from "react-icons/fa";
import { FiX, FiBell, FiInbox } from "react-icons/fi";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import "../styles/NotificationBox.css";
import {
  getCommonNotifications,
  getPersonalNotifications,
  markNotificationAsRead,
} from "../utils/api";
import { AuthContext } from "../context/AuthContext";

const NotificationBox = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("common");
  const [commonNotifications, setCommonNotifications] = useState([]);
  const [personalNotifications, setPersonalNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const bellRef = useRef(null);
  const { t, i18n } = useTranslation();
  const { user } = useContext(AuthContext);
  const assistantEmail = user?.email;

  useEffect(() => {
    const fetchAllNotifications = async () => {
      setIsLoading(true);
      try {
        const [commonRes, personalRes] = await Promise.all([
          getCommonNotifications(),
          assistantEmail
            ? getPersonalNotifications(assistantEmail)
            : Promise.resolve({ notifications: [] }),
        ]);
        setCommonNotifications(commonRes.notifications || []);
        setPersonalNotifications(personalRes.notifications || []);
      } catch (error) {
        console.error("Error fetching notifications:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllNotifications();
  }, [assistantEmail]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const commonCount = commonNotifications.length;
  const personalUnreadCount = personalNotifications.filter(
    (n) => !n.isRead?.assistant
  ).length;
  const notificationCount = commonCount + personalUnreadCount;

  const renderMessage = (notification) => {
    const msg = notification.message[i18n.language] || notification.message.en;
    return <span dangerouslySetInnerHTML={{ __html: msg }} />;
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const renderNotifications = (list, type) =>
    list.map((notification, index) => {
      const isUnread = !notification.isRead?.assistant;
      return (
        <div
          key={notification._id}
          className={`nb-item${isUnread ? " nb-item--unread" : ""}`}
          onClick={async () => {
            if (isUnread && type === "personal") {
              try {
                await markNotificationAsRead(notification._id, "assistant");
                const updated = [...personalNotifications];
                updated[index].isRead.assistant = true;
                setPersonalNotifications(updated);
              } catch (err) {
                console.error("Failed to mark as read:", err);
              }
            }
          }}
        >
          <div className="nb-item-icon">
            <FiBell size={14} />
          </div>
          <div className="nb-item-body">
            <p className="nb-item-msg">{renderMessage(notification)}</p>
            <span className="nb-item-time">{formatTime(notification.createdAt)}</span>
          </div>
          {isUnread && <span className="nb-item-dot" />}
        </div>
      );
    });

  return (
    <div className="nb-wrapper" ref={bellRef}>
      <button className="nb-bell-btn" onClick={() => setIsOpen((prev) => !prev)}>
        <BiSolidBellRing size={18} />
        {notificationCount > 0 && (
          <span className="nb-bell-badge">{notificationCount}</span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="nb-panel"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="nb-panel"
          >
            {/* Header */}
            <div className="nb-header">
              <div className="nb-header-left">
                <div className="nb-header-icon"><FiBell size={16} /></div>
                <span className="nb-header-title">{t("notif_box.title")}</span>
              </div>
              <button className="nb-close-btn" onClick={() => setIsOpen(false)}>
                <FiX size={16} />
              </button>
            </div>

            {/* Tabs */}
            <div className="nb-tabs">
              <button
                className={`nb-tab${activeTab === "common" ? " nb-tab--active" : ""}`}
                onClick={() => setActiveTab("common")}
              >
                <FiBell size={13} />
                {t("notif_box.common")}
                {commonCount > 0 && <span className="nb-tab-badge">{commonCount}</span>}
              </button>
              <button
                className={`nb-tab${activeTab === "personal" ? " nb-tab--active" : ""}`}
                onClick={() => setActiveTab("personal")}
              >
                <FaRegUser size={12} />
                {t("notif_box.personal")}
                {personalUnreadCount > 0 && (
                  <span className="nb-tab-badge">{personalUnreadCount}</span>
                )}
              </button>
            </div>

            {/* Content */}
            <div className="nb-content">
              {isLoading ? (
                <div className="nb-empty">
                  <div className="nb-spinner" />
                  <span>{t("notif_box.loading")}</span>
                </div>
              ) : activeTab === "common" ? (
                commonCount === 0 ? (
                  <div className="nb-empty">
                    <FiInbox size={32} />
                    <p>{t("notif_box.no_notifications")}</p>
                  </div>
                ) : (
                  renderNotifications(commonNotifications, "common")
                )
              ) : personalNotifications.length === 0 ? (
                <div className="nb-empty">
                  <FiInbox size={32} />
                  <p>{t("notif_box.no_notifications")}</p>
                </div>
              ) : (
                renderNotifications(personalNotifications, "personal")
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBox;
