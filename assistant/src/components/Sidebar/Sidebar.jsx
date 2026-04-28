import {
  FiCalendar,
  FiUsers,
  FiUser,
  FiMessageSquare,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
} from "react-icons/fi";
import { MdOutlineHealthAndSafety } from "react-icons/md";
import { BsPersonWorkspace } from "react-icons/bs";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import logo from "../../assets/logo.png";
import "./Sidebar.css";

const Sidebar = ({ collapsed, toggleSidebar, isMobile }) => {
  const location = useLocation();
  const { t } = useTranslation();

  const navItems = [
    { to: "/appointments", icon: <FiClock />, labelKey: "sidebar.myAppointments" },
    { to: "/early-detection", icon: <MdOutlineHealthAndSafety />, labelKey: "sidebar.earlyDetection" },
    { to: "/patients", icon: <FiUsers />, labelKey: "sidebar.patients" },
    { to: "/profile", icon: <FiUser />, labelKey: "sidebar.profile" },
    { to: "/my-space", icon: <BsPersonWorkspace />, labelKey: "sidebar.mySpace" },

  ];

  return (
    <div className={`sidebar ${collapsed ? "collapsed" : "open"} ${isMobile ? "mobile" : ""}`}>
      <div className="sidebar-header">
        <img src={logo} alt="Logo" className="sidebar-logo" />
        <button className="toggle-btn" onClick={toggleSidebar}>
          {collapsed ? <FiChevronRight /> : <FiChevronLeft />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(({ to, icon, labelKey }) => {
          const isActive = location.pathname === to || location.pathname.startsWith(`${to}/`);
          return (
            <Link
              key={to}
              to={to}
              className={`nav-item ${isActive ? "active" : ""}`}
              onClick={() => isMobile && toggleSidebar()} // Close sidebar on mobile after clicking

            >
              <span className="nav-icon">{icon}</span>
              <span className="nav-label">{t(labelKey)}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default Sidebar;
