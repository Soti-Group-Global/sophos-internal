import React, { useState, useEffect, useRef, useContext } from "react";
import ReactDOM from "react-dom";
import { Link, useLocation } from "react-router-dom";
import {
  Grid2x2 as Grid,
  Users,
  User,
  FileText,
  MessageSquare,
  Bell,
  Image,
  Activity,
  UserCheck,
  Heart,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ChevronsRight,
  ChevronsLeft,
  X,
  Send,
  MessageCircle,
  Building,
  Users as ClientsIcon,
  Rss,
  Warehouse,
  ListTodo,
  Clock
} from "lucide-react";
import "./Sidebar2.css";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../../context/AuthContext";

const Sidebar2 = ({ isMobileOpen = false, onMobileClose, onToggleSidebar }) => {
  const { user } = useContext(AuthContext);

  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth < 768);
  const [tooltip, setTooltip] = useState({ visible: false, text: "", x: 0, y: 0 });
  const [expandedGroups, setExpandedGroups] = useState({
    corporate: false,
    clients: false,
    feed: false,
  });
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const handleResize = () => setIsSmallScreen(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleSidebar = () => {
    const newState = !isSidebarOpen;
    setIsSidebarOpen(newState);
    if (onToggleSidebar) {
      onToggleSidebar(newState);
    }
  };

  const toggleGroup = (groupKey) => {
    // On small screens groups are always open — don't allow collapsing
    if (isSmallScreen) return;
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  const navigationGroups = [
    {
      name: "sidebar.clients",
      icon: ClientsIcon,
      key: "clients",
      items: [
        { icon: Activity, label: "sidebar.myAppointments", path: "/appointments" },
        { icon: Users, label: "sidebar.patients", path: "/patients" },
        { icon: Heart, label: "sidebar.earlyDetection", path: "/early-detection" }
      ],
    },
    {
      name: "sidebar.corporate",
      icon: Building,
      key: "corporate",
      items: [
        { icon: Grid, label: "sidebar.profile", path: "/profile" },
        { icon: UserCheck, label: "sidebar.scheduleManagement", path: "/schedule-management" },
        { icon: FileText, label: "sidebar.mySpace", path: "/my-space" },
        { icon: Warehouse, label: "sidebar.stockRequest", path: "/stock-request" },
        { icon: ListTodo, label: "sidebar.tasks", path: "/tasks" },
        { icon: Clock, label: "sidebar.schedule", path: "/schedule-appointments" },
      ],
    },
    {
      name: "sidebar.feed",
      icon: Rss,
      key: "feed",
      items: [
        { icon: Warehouse, label: "sidebar.stockManagement", path: "/stock-management" },
        { icon: MessageSquare, label: "sidebar.messages", path: "/messages" }
      ],
    },
  ];

  // Auto-expand groups if current route matches any of their children
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // When sidebar opens on mobile, expand all groups so links are immediately visible
  useEffect(() => {
    if (isMobileOpen || isSmallScreen) {
      setExpandedGroups({ corporate: true, clients: true, feed: true });
    }
  }, [isMobileOpen, isSmallScreen]);

  return (
    <>
      {isMobileOpen && (
        <div className="sidebar-overlay" onClick={onMobileClose} />
      )}

      <div
        className={`
          sidebar
          ${isSidebarOpen ? "sidebar-open" : "sidebar-closed"}
          ${isMobileOpen ? "mobile-open" : ""}
        `}
      >
        {isMobileOpen && (
          <button onClick={onMobileClose} className="mobile-close-btn">
            <X size={18} />
          </button>
        )}

        <div className="sidebar-header">
          <img
            src={i18n.language === "ru" ? "/logo_ru.png" : "/logo_en.png"}
            alt={t("sidebar.logo_alt")}
            className="sidebar-logo"
          />
          {!isMobileOpen && (
            <button
              className="sidebar-toggle-btn"
              onClick={toggleSidebar}
              title={isSidebarOpen ? "Collapse" : "Expand"}
            >
              {isSidebarOpen ? <ChevronsLeft size={16} /> : <ChevronsRight size={16} />}
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          {navigationGroups
            .map((group, groupIndex) => {
              const GroupIcon = group.icon;
              const isExpanded = expandedGroups[group.key];

              return (
                <div key={groupIndex} className="nav-group-container">
                <button
                    className="nav-group-item"
                    onClick={() => toggleGroup(group.key)}
                    onMouseEnter={(e) => {
                      if (!isSidebarOpen) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({
                          visible: true,
                          text: t(group.name),
                          x: rect.right + 12,
                          y: rect.top + rect.height / 2,
                        });
                      }
                    }}
                    onMouseLeave={() => setTooltip({ visible: false, text: "", x: 0, y: 0 })}
                  >
                    <div className="nav-icon-wrapper">
                      <GroupIcon size={20} className="nav-icon" />
                    </div>

                    {(isSidebarOpen || isMobileOpen) && (
                      <>
                        <span className="nav-label">{t(group.name)}</span>
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

                  {isExpanded && (isSidebarOpen || isMobileOpen) && (
                    <div className="sub-items">
                      {group.items
                        .filter(item => !(user.role === "assistant" && (item.label === "sidebar.scheduleManagement" || item.label === "sidebar.schedule")))
                        .filter(item => !(user.role === "assistant" && item.label === "sidebar.stockManagement"))
                        .filter(item => !(user.role === "head_assistant" && (item.label === "sidebar.calendar" || item.label === "sidebar.stockRequest")))
                        .map((item, itemIndex) => {
                          const Icon = item.icon;
                          const isActive = location.pathname.startsWith(item.path);
                          return (
                            <div key={itemIndex} className="sub-item-wrapper">
                              <div className="branch-line"></div>
                              <Link
                                to={item.path}
                                className={`sub-item ${isActive ? "active" : ""}`}
                                onClick={onMobileClose}
                              >
                                <div className="sub-item-icon">
                                  <Icon size={18} />
                                </div>
                                <span className="sub-item-label">{t(item.label)}</span>
                              </Link>
                            </div>
                          );
                        })}
                    </div>
                  )}

                </div>
              );
            })
          }
        </nav>
      </div>

      {tooltip.visible && ReactDOM.createPortal(
        <div
          style={{
            position: "fixed",
            top: tooltip.y,
            left: tooltip.x,
            transform: "translateY(-50%)",
            background: "linear-gradient(135deg, #0A2E5D 0%, #163d6b 100%)",
            color: "white",
            fontSize: "13px",
            fontWeight: 500,
            padding: "8px 14px",
            borderRadius: "8px",
            whiteSpace: "nowrap",
            boxShadow: "0 8px 24px rgba(10,46,93,0.3)",
            border: "1px solid rgba(10,46,93,0.2)",
            pointerEvents: "none",
            zIndex: 99999,
          }}
        >
          {tooltip.text}
          <div style={{
            position: "absolute",
            top: "50%",
            left: "-5px",
            transform: "translateY(-50%) rotate(45deg)",
            width: "10px",
            height: "10px",
            background: "#0A2E5D",
            borderLeft: "1px solid rgba(10,46,93,0.2)",
            borderBottom: "1px solid rgba(10,46,93,0.2)",
          }} />
        </div>,
        document.body
      )}
    </>
  );
};

export default Sidebar2;
