import React, { useEffect, useRef, useState, useContext } from "react";
import { BiSolidBellRing } from "react-icons/bi";
import { FaRegUser, FaTimes } from "react-icons/fa";
import { AnimatePresence, motion } from "framer-motion";
import { AiOutlineExclamationCircle } from "react-icons/ai";
import { useTranslation } from "react-i18next";
import "../styles/NotificationBox.css";
import {
  getCommonNotifications,
  getPersonalNotifications,
  markNotificationAsRead,
} from "../utils/api";
import { AuthContext } from "../context/AuthContext";
import { formatDateISO, formatTimeHHMM } from "../utils/dateFormat";

const NotificationBox = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("common");
  const [commonNotifications, setCommonNotifications] = useState([]);
  const [personalNotifications, setPersonalNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const bellRef = useRef(null);
  const { t, i18n } = useTranslation();
  const { user } = useContext(AuthContext);
  const doctorEmail = user?.email;


  useEffect(() => {
    const fetchAllNotifications = async () => {
      setIsLoading(true);
      try {
        const [commonRes, personalRes] = await Promise.all([
          getCommonNotifications(),
          doctorEmail
            ? getPersonalNotifications(doctorEmail)
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
  }, [doctorEmail]);

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
    (n) => !n.isRead?.doctor
  ).length;

  const notificationCount = commonCount + personalUnreadCount;

  const renderNotificationMessage = (notification) => {
    const currentLanguage = i18n.language;
    const message =
      notification.message[currentLanguage] || notification.message.en;
    return <span dangerouslySetInnerHTML={{ __html: message }} />;
  };

  const renderNotifications = (list, type) => {
    return list.map((notification, index) => (
      <div
        key={notification._id}
        className={`dropdown-item ${
          !notification.isRead?.doctor ? "unread" : ""
        }`}
        onClick={async () => {
          if (!notification.isRead?.doctor && type === "personal") {
            try {
              await markNotificationAsRead(notification._id, "doctor");
              const updatedList = [...personalNotifications];
              updatedList[index].isRead.doctor = true; // Update only patient field
              setPersonalNotifications(updatedList);
            } catch (err) {
              console.error("Failed to mark as read:", err);
            }
          }
        }}
      >
        <AiOutlineExclamationCircle className="dropdown-icon" />
        <div>
          <p>{renderNotificationMessage(notification)}</p>
          <p className="item-time">
            {`${formatDateISO(notification.createdAt)} ${formatTimeHHMM(
              notification.createdAt
            )}`}
          </p>
        </div>
      </div>
    ));
  };

  return (
    <div className="notification-wrapper" ref={bellRef}>
      <button
        className="notification-button"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <BiSolidBellRing size={20} />
        {notificationCount > 0 && (
          <span className="notification-badge">{notificationCount}</span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="notification-dropdown"
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.2 }}
            className="notification-dropdown"
          >
            <div className="dropdown-header">
              <h4 className="dropdown-title">
                <BiSolidBellRing className="bell-icon" size={16} />
                {t("notif_box.title")}
              </h4>
              <button className="dropdown-close-btn" onClick={() => setIsOpen(false)}>
                <FaTimes className="dropdown-notification-close-icon" />
              </button>
            </div>

            <div className="dropdown-tabs">
              <button
                onClick={() => setActiveTab("common")}
                className={`tab-button ${
                  activeTab === "common" ? "active" : ""
                }`}
              >
                <AiOutlineExclamationCircle />
                {t("notif_box.common")}
                <span className="tab-badge">{commonCount}</span>
              </button>
              <button
                onClick={() => setActiveTab("personal")}
                className={`tab-button ${
                  activeTab === "personal" ? "active" : ""
                }`}
              >
                <FaRegUser />
                {t("notif_box.personal")}
                <span className="tab-badge">{personalUnreadCount}</span>
              </button>
            </div>

            <div className="dropdown-content">
              {isLoading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <span>{t("notif_box.loading")}</span>
                </div>
              ) : activeTab === "common" ? (
                commonCount === 0 ? (
                  <div className="empty-state">
                    <AiOutlineExclamationCircle />
                    <p>{t("notif_box.no_notifications")}</p>
                  </div>
                ) : (
                  renderNotifications(commonNotifications, "common")
                )
              ) : personalNotifications.length === 0 ? (
                <div className="empty-state">
                  <AiOutlineExclamationCircle />
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
