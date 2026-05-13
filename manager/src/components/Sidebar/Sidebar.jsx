import React, { useState, useEffect, useContext } from "react";
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
  ListTodo,
  Stethoscope,
  BookOpen,
  FolderOpen,
  ClipboardPlus,
  ClipboardList,
  CalendarCheck,
  Star,
  Contact,
  Phone,
  BookHeart,
  BarChart2
} from "lucide-react";
import { FaStore } from "react-icons/fa";
import { MdSchedule } from "react-icons/md";
import "./Sidebar.css";
import logoEn from "/logo_en.png";
import logoRu from "/logo_ru.png";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../../context/AuthContext";

const Sidebar = ({ isSidebarOpen = false, isMobileOpen = false, onMobileClose, onToggleSidebar }) => {
  const location = useLocation();
  const [expandedGroups, setExpandedGroups] = useState({
    corporate: true,
    clients: true,
    feed: true,
    content: true,
  });
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const { t, i18n } = useTranslation();
  const { user } = useContext(AuthContext);

  const restrictedForManager = ["/add-employee", "/notifications"];

  // Detect mobile devices
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileDevice(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  const toggleSidebar = () => {
    if (onToggleSidebar) onToggleSidebar();
  };

  const handleNavClick = () => {
    if (isMobileDevice) {
      if (onMobileClose) onMobileClose();
    }
    // On desktop, hover controls sidebar — no action needed on click
  };

  const toggleGroup = (groupKey) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  // Get current logo based on language
  const getCurrentLogo = () => {
    return i18n.language === 'ru' ? logoRu : logoEn;
  };

  const navigationGroups = [
    {
      nameKey: "clients",
      icon: ClientsIcon,
      key: "clients",
      items: [
        { icon: Grid, key: "applications", path: "/applications" },
       // { icon: Heart, key: "early_detection", path: "/early-detection" },
        {
          icon: ClipboardPlus,
          key: "early_detection",
          path: "/early-detection/bookings",
        },
        { icon: Users, key: "patients", path: "/patients" },
      ],
    },
    {
      nameKey: "corporate",
      icon: Building,
      key: "corporate",
      items: [
         { icon: FileText, key: "reports", path: "/dashboard" },
        { icon: BarChart2, key: "detailedReport", path: "/reports" },
        { icon: UserCheck, key: "employee", path: "/add-employee" },
        { icon: FaStore, key: "inventory", path: "/inventory" },
        { icon: Activity, key: "analysis", path: "/analysis" },
        { icon: ListTodo, key: "task", path: "/tasks" },
        { icon: Building, key: "corporateRegistration", path: "/corporate-registration" },
      ],
    },
    {
      nameKey: "feed",
      icon: Rss,
      key: "feed",
      items: [
        { icon: MessageSquare, key: "messenger", path: "/messenger" },
        // { icon: MessageCircle, key: "whatsapp", path: "/whatsapp" },
        { icon: Send, key: "telegram", path: "/telegram" },
        { icon: MessageCircle, key: "max", path: "/max" },
        { icon: Bell, key: "notifications", path: "/notifications" },
        { icon: ClipboardList, key: "logs", path: "/logs" },
        { icon: User, key: "profile", path: "/profile" },
      ],
    },
    {
      nameKey: "content",
      icon: FolderOpen,
      key: "content",
      items: [
      //  { icon: Stethoscope, key: "doctors", path: "/doctors-profile" },
      //  { icon: BookOpen, key: "blogs", path: "/blogs" },
        { icon: ClipboardPlus, key: "services", path: "/services" },
        { icon: ClipboardList, key: "serviceManager", path: "/service-manager" },
        { icon: CalendarCheck , key: "scheduleManagement", path: "/schedule" },
      //  { icon: ClipboardPlus, key: "vacancies", path: "/vacancies" },
      //  { icon: Star, key: "reviews", path: "/reviews" },
      //  { icon: Image, key: "promos", path: "/promos" },
      ],
    },
    /*
    {
      nameKey: "forms",
      icon: Contact,
      key: "forms",
      items: [
        { icon: Phone, key: "contactUsForms", path: "/contact-us-forms" },
        {
          icon: BookHeart,
          key: "patientCoordinationForms",
          path: "/patient-coordination-forms",
        },
         {
          icon: Phone,
          key: "contactViaPhone",
          path: "/contact-via-phone",
        },
        {
          icon: BookHeart,
          key: "complicatedCasesForms",
          path: "/complicated-cases-forms",
        },
        {
          icon: BookHeart,
          key: "earlyDetectionBookings",
          path: "/early-detection-bookings",
        },
      ],
    },
    */
  ];

  const getFilteredNavigationGroups = () => {
    
    if (user?.role === "content_manager") {
      // If user has canManage array, filter items based on it
      if (user?.canManage && Array.isArray(user.canManage) && user.canManage.length > 0) {
        const allowedKeys = user.canManage;
        const filteredGroups = [];

        // Filter feed, content, and forms groups based on canManage
        const feedGroup = navigationGroups.find((group) => group.key === "feed");
        const contentGroup = navigationGroups.find((group) => group.key === "content");
        const formsGroup = navigationGroups.find((group) => group.key === "forms");

        // Filter feed group
        if (feedGroup) {
          const filteredFeedItems = feedGroup.items.filter((item) => 
            allowedKeys.includes(item.key) && item.key !== "logs"
          );
          if (filteredFeedItems.length > 0) {
            filteredGroups.push({
              ...feedGroup,
              items: filteredFeedItems,
            });
          }
        }

        // Filter content group
        if (contentGroup) {
          const filteredContentItems = contentGroup.items.filter((item) => 
            allowedKeys.includes(item.key)
          );
          if (filteredContentItems.length > 0) {
            filteredGroups.push({
              ...contentGroup,
              items: filteredContentItems,
            });
          }
        }

        // Filter forms group
        if (formsGroup) {
          const filteredFormsItems = formsGroup.items.filter((item) => 
            allowedKeys.includes(item.key)
          );
          if (filteredFormsItems.length > 0) {
            filteredGroups.push({
              ...formsGroup,
              items: filteredFormsItems,
            });
          }
        }

        // Always add profile if not already in the filtered items
        if (!allowedKeys.includes("profile")) {
          // Find which group has items and add profile to it, or create a separate group
          if (filteredGroups.length > 0) {
            // Add to the first group
            filteredGroups[0].items.push({ icon: User, key: "profile", path: "/profile" });
          } else {
            // Create a minimal group with just profile
            filteredGroups.push({
              nameKey: "feed",
              icon: Rss,
              key: "feed",
              items: [{ icon: User, key: "profile", path: "/profile" }],
            });
          }
        }

        return filteredGroups;
      }

      // Fallback: if no canManage field, show all content and forms (old behavior)
      const contentGroup = navigationGroups.find(
        (group) => group.key === "content"
      );
      const formsGroup = navigationGroups.find(
        (group) => group.key === "forms"
      );

      const contentManagerGroups = [];

      if (contentGroup) {
        contentManagerGroups.push({
          ...contentGroup,
          items: [
            ...contentGroup.items,
            { icon: User, key: "profile", path: "/profile" },
          ],
        });
      }

      if (formsGroup) {
        contentManagerGroups.push(formsGroup);
      }

      return contentManagerGroups;
    }

    if (user?.role === "manager") {
      return navigationGroups
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (item) => !restrictedForManager.includes(item.path)
          ),
        }))
        .filter((group) => group.items.length > 0);
    }

    return navigationGroups;
  };

  const filteredNavigationGroups = getFilteredNavigationGroups();

  // Auto-expand groups with active children
  useEffect(() => {
    const updated = { ...expandedGroups };
    let hasUpdates = false;

    filteredNavigationGroups.forEach((group) => {
      const hasActiveChild = group.items.some((item) =>
        location.pathname.startsWith(item.path)
      );
      if (hasActiveChild && !updated[group.key]) {
        updated[group.key] = true;
        hasUpdates = true;
      }
    });

    if (hasUpdates) {
      setExpandedGroups(updated);
    }
  }, [location.pathname]);

  const translate = (key, fallback) => {
    const translated = t(`sidebar.${key}`);
    return translated === `sidebar.${key}` ? fallback : translated;
  };

  // Determine if sub-items should be shown
  const shouldShowSubItems = (group) => {
    // On mobile, only show when mobile sidebar is open
    if (isMobileDevice) {
      return isMobileOpen && expandedGroups[group.key];
    }
    // On desktop, show when sidebar is expanded
    return isSidebarOpen && expandedGroups[group.key];
  };

  // Determine if we should show the sidebar content
  const shouldShowSidebarContent = isMobileDevice ? isMobileOpen : isSidebarOpen;

  return (
    <>
      {/* Mobile overlay */}
      {isMobileDevice && isMobileOpen && (
        <div className="sidebar-overlay" onClick={onMobileClose} />
      )}

      <div
        className={`sidebar ${
          shouldShowSidebarContent ? "sidebar-expanded" : "sidebar-minimized"
        } ${isMobileOpen ? "mobile-open" : ""} ${
          isMobileDevice ? "mobile-device" : ""
        }`}
      >
        {/* Mobile close button */}
        {isMobileDevice && isMobileOpen && (
          <button onClick={onMobileClose} className="mobile-close-btn">
            <X size={18} />
          </button>
        )}

        <div className="sidebar-header">
          <img
            src={getCurrentLogo()}
            alt={translate("logo_alt", "Health Direct Logo")}
            className="sidebar-logo"
          />
          {!isMobileDevice && (
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
          {filteredNavigationGroups.map((group, groupIndex) => {
            const GroupIcon = group.icon;
            const isExpanded = expandedGroups[group.key];
            const visibleItems = group.items;

            return (
              <div key={groupIndex} className="nav-group-container">
                <button
                  className="nav-group-item"
                  onClick={() => toggleGroup(group.key)}
                  title={
                    !shouldShowSidebarContent
                      ? translate(group.nameKey, group.nameKey)
                      : ""
                  }
                >
                  <div className="nav-icon-wrapper">
                    <GroupIcon size={20} className="nav-icon" />
                  </div>

                  {shouldShowSidebarContent && (
                    <>
                      <span className="nav-label">
                        {translate(group.nameKey, group.nameKey)}
                      </span>
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

                {shouldShowSubItems(group) && (
                  <div className="sub-items">
                    {visibleItems.map((item, itemIndex) => {
                      const Icon = item.icon;
                      const isActive = location.pathname.startsWith(item.path);
                      return (
                        <div key={itemIndex} className="sub-item-wrapper">
                          <div className="branch-line"></div>
                          <Link
                            to={item.path}
                            className={`sub-item ${isActive ? "active" : ""}`}
                            onClick={handleNavClick}
                          >
                            <div className="sub-item-icon">
                              <Icon size={18} />
                            </div>
                            <span className="sub-item-label">
                              {translate(item.key, item.key)}
                            </span>
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}

                {!shouldShowSidebarContent && (
                  <div className="nav-tooltip">
                    {translate(group.nameKey, group.nameKey)}
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
