import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Clock,
  Heart,
  Users,
  Calendar,
  MessageSquare,
  User,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ChevronsRight,
  ChevronsLeft,
  X,
} from "lucide-react";
import "./Sidebar.css";
import { FiGrid } from "react-icons/fi";
import logo_en from "../../assets/logo_en.png";
import logo_ru from "../../assets/logo_ru.png";
import { useTranslation } from "react-i18next";

const Sidebar = ({ collapsed, toggleSidebar, isMobile }) => {
  const location = useLocation();
  const [expandedGroups, setExpandedGroups] = useState({
    client: true,
    corporate: true,
    feed: true,
  });
  const { t , i18n} = useTranslation();
  const currentLogo = i18n.language === "ru" ? logo_ru : logo_en;



  const navigationGroups = [
    {
      name: t("sidebar.client"),
      icon: Users,
      key: "client",
      items: [
        { icon: Clock, label: t("sidebar.myAppointments"), path: "/appointments" },
        { icon: Heart, label: t("sidebar.earlyDetection"), path: "/early-detection" },
        { icon: Users, label: t("sidebar.patients"), path: "/patients" },
      ],
    },
    {
      name: t("sidebar.corporate"),
      icon: Users,
      key: "corporate",
      items: [
        { icon: UserCheck, label: t("sidebar.assistants"), path: "/assistants" },
        { icon: FiGrid, label: t("sidebar.tasks"), path: "/tasks" },
      ],
    },
    {
      name: t("sidebar.feed"),
      icon: MessageSquare,
      key: "feed",
      items: [
        { icon: User, label: t("sidebar.profile"), path: "/profile" },
        { icon: MessageSquare, label: t("sidebar.messages"), path: "/messages" },
      ],
    },
  ];

  

  // Expand correct group when navigating
  useEffect(() => {
    const updated = { ...expandedGroups };
    navigationGroups.forEach((group) => {
      const hasActiveChild = group.items.some((item) =>
        location.pathname.startsWith(item.path)
      );
      if (hasActiveChild) {
        updated[group.key] = true;
      }
    });
    setExpandedGroups(updated);
  }, [location.pathname]);

  return (
    <>
      {isMobile && !collapsed && (
        <div className="sidebar-overlay" onClick={toggleSidebar} />
      )}

      <div
        className={`
          sidebar
          ${collapsed ? "sidebar-closed" : "sidebar-open"}
          ${isMobile ? "mobile" : ""}
        `}
      >
        {isMobile && (
          <button onClick={toggleSidebar} className="mobile-close-btn">
            <X size={18} />
          </button>
        )}

        <div className="sidebar-header">
          <img src={currentLogo} alt={t("sidebar.logo_alt")} className="sidebar-logo" />
          {!isMobile && (
            <button
              className="sidebar-toggle-btn"
              onClick={toggleSidebar}
              title={collapsed ? "Expand" : "Collapse"}
            >
              {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          {navigationGroups.map((group, groupIndex) => {
            const GroupIcon = group.icon;
            const isExpanded = expandedGroups[group.key];

            return (
              <div key={groupIndex} className="nav-group-container">
                <button
                  className="nav-group-item"
                  onClick={() =>
                    setExpandedGroups((prev) => ({
                      ...prev,
                      [group.key]: !prev[group.key],
                    }))
                  }
                  title={collapsed ? group.name : ""}
                >
                  <div className="nav-icon-wrapper">
                    <GroupIcon size={20} className="nav-icon" />
                  </div>

                  {!collapsed && (
                    <>
                      <span className="nav-label">{group.name}</span>
                      <div className="expand-icon">
                        {isExpanded ? (
                          <ChevronUp size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )}
                      </div>
                    </>
                  )}
                </button>

                {isExpanded && !collapsed && (
                  <div className="sub-items">
                    {group.items.map((item, itemIndex) => {
                      const Icon = item.icon;
                      const isActive = location.pathname.startsWith(item.path);
                      return (
                        <div key={itemIndex} className="sub-item-wrapper">
                          <div className="branch-line"></div>
                          <Link
                            to={item.path}
                            className={`sub-item ${isActive ? "active" : ""}`}
                            onClick={isMobile ? toggleSidebar : undefined}
                          >
                            <div className="sub-item-icon">
                              <Icon size={18} />
                            </div>
                            <span className="sub-item-label">{item.label}</span>
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}

                {collapsed && (
                  <div className="nav-tooltip">
                    {group.name}
                    <div className="tooltip-arrow" />
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </>
  );
};

export default Sidebar;
