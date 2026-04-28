import React, { useEffect, useRef, useState, useContext } from "react";
import { BiSolidBellRing } from "react-icons/bi";
import { FaRegUser, FaTimes } from "react-icons/fa";
import { AnimatePresence, motion } from "framer-motion";
import { AiOutlineExclamationCircle } from "react-icons/ai";
import { useTranslation } from "react-i18next";
import "../styles/NotificationBox.css";
import LoadingComponent from "./Loading/LoadingComponent";
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
  const fetchedOnceRef = useRef(false);

  const userEmail = user?.email;
  const userRole = user?.role?.toLowerCase();
  
  // Check if user is content_manager
  const isContentManager = userRole === "content_manager";

  useEffect(() => {
    // Don't fetch notifications for content_manager
    if (isContentManager) {
      setCommonNotifications([]);
      setPersonalNotifications([]);
      setIsLoading(false);
      return;
    }

    if (fetchedOnceRef.current) return;
    fetchedOnceRef.current = true;

    const fetchAllNotifications = async () => {
      setIsLoading(true);
      try {
        const [commonRes, personalRes] = await Promise.all([
          getCommonNotifications(),
          userEmail
            ? getPersonalNotifications(userEmail)
            : Promise.resolve({ notifications: [] }),
        ]);
        setCommonNotifications(commonRes.notifications || []);
        setPersonalNotifications(personalRes.notifications || []);
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllNotifications();
  }, [userEmail, isContentManager]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // For content_manager, always show 0 notifications
  const commonCount = isContentManager ? 0 : commonNotifications.length;
  const personalUnreadCount = isContentManager ? 0 : personalNotifications.filter(
    (n) => !n.isRead?.[userRole]
  ).length;
  const notificationCount = isContentManager ? 0 : commonCount + personalUnreadCount;

  const renderNotificationMessage = (notification) => {
    const currentLanguage = i18n.language;
    const message =
      notification.message[currentLanguage] || notification.message.en;
    return <span dangerouslySetInnerHTML={{ __html: message }} />;
  };

  const renderNotifications = (list, type) => {
    return list.map((notification, index) => {
      const isUnread = !notification.isRead?.[userRole];

      return (
        <motion.div
          key={notification._id}
          className={`notif-box-item ${isUnread ? "notif-box-item-unread" : ""}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: index * 0.05 }}
          onClick={async () => {
            if (isUnread && type === "personal") {
              try {
                await markNotificationAsRead(notification._id, userRole);
                const updatedList = [...personalNotifications];
                updatedList[index].isRead[userRole] = true;
                setPersonalNotifications(updatedList);
              } catch (err) {
              }
            }
          }}
        >
          <div className="notif-box-indicator">
            {isUnread && <div className="notif-box-unread-dot" />}
            <AiOutlineExclamationCircle className="notif-box-icon" />
          </div>
          <div className="notif-box-content">
            <p className="notif-box-message">
              {renderNotificationMessage(notification)}
            </p>
            <p className="notif-box-time">
              {new Date(notification.createdAt).toLocaleString()}
            </p>
          </div>
        </motion.div>
      );
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return t("notif_box.just_now");
    } else if (diffInHours < 24) {
      const hours = Math.floor(diffInHours);
      return `${hours}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // If user is content_manager, show empty notification box
  if (isContentManager) {
    return (
      <div className="notif-box-wrapper" ref={bellRef}>
        <button
          className="notif-box-trigger"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <BiSolidBellRing size={22} />
          {/* No notification counter for content_manager */}
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              key="notification-panel"
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ duration: 0.2, type: "spring", stiffness: 300 }}
              className="notif-box-panel"
            >
              {/* Header */}
              <div className="notif-box-panel-header">
                <div className="notif-box-header-title">
                  <BiSolidBellRing size={20} />
                  <h3>{t("notif_box.title")}</h3>
                </div>
                <button className="notif-box-close-btn" onClick={() => setIsOpen(false)}>
                  <FaTimes size={14} />
                </button>
              </div>

              {/* Content - Empty state for content_manager */}
              <div className="notif-box-panel-content">
                <div className="notif-box-empty-state">
                  <AiOutlineExclamationCircle size={32} />
                  <p>{t("notif_box.no_notifications_available") || "Notifications are not available for your role"}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="notif-box-wrapper" ref={bellRef}>
      <button
        className="notif-box-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <BiSolidBellRing size={22} />
        {notificationCount > 0 && (
          <motion.span
            className="notif-box-counter"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            key={notificationCount}
          >
            {notificationCount > 99 ? "99+" : notificationCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="notification-panel"
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ duration: 0.2, type: "spring", stiffness: 300 }}
            className="notif-box-panel"
          >
            {/* Header */}
            <div className="notif-box-panel-header">
              <div className="notif-box-header-title">
                <BiSolidBellRing size={20} />
                <h3>{t("notif_box.title")}</h3>
              </div>
              <button className="notif-box-close-btn" onClick={() => setIsOpen(false)}>
                <FaTimes size={14} />
              </button>
            </div>

            {/* Tabs */}
            <div className="notif-box-panel-tabs">
              <button
                onClick={() => setActiveTab("common")}
                className={`notif-box-tab ${activeTab === "common" ? "notif-box-tab-active" : ""}`}
              >
                <AiOutlineExclamationCircle />
                <span>{t("notif_box.common")}</span>
                {commonCount > 0 && (
                  <span className="notif-box-tab-counter">{commonCount}</span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("personal")}
                className={`notif-box-tab ${activeTab === "personal" ? "notif-box-tab-active" : ""}`}
              >
                <FaRegUser />
                <span>{t("notif_box.personal")}</span>
                {personalUnreadCount > 0 && (
                  <span className="notif-box-tab-counter">{personalUnreadCount}</span>
                )}
              </button>
            </div>

            {/* Content */}
            <div className="notif-box-panel-content">
              {isLoading ? (
                <LoadingComponent message={t("notif_box.loading")} />
              ) : activeTab === "common" ? (
                commonCount === 0 ? (
                  <div className="notif-box-empty-state">
                    <AiOutlineExclamationCircle size={32} />
                    <p>{t("notif_box.no_notifications")}</p>
                  </div>
                ) : (
                  <div className="notif-box-notifications-list">
                    {renderNotifications(commonNotifications, "common")}
                  </div>
                )
              ) : personalNotifications.length === 0 ? (
                <div className="notif-box-empty-state">
                  <AiOutlineExclamationCircle size={32} />
                  <p>{t("notif_box.no_notifications")}</p>
                </div>
              ) : (
                <div className="notif-box-notifications-list">
                  {renderNotifications(personalNotifications, "personal")}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBox;
