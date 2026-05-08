import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar/Sidebar";
import Header from "./Header/Header";
import "./Layout.css";

const Layout = () => {
  const [collapsed, setCollapsed] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const location = useLocation();
  const isAppointmentDetails = /^\/appointments\/[^/]+$/.test(location.pathname);
  const isEarlyDetectionDetails = /^\/early-detection-bookings\/[^/]+$/.test(location.pathname);
  const isMeetingRoom = location.pathname === "/meeting-room" || isEarlyDetectionDetails || isAppointmentDetails;

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 1024;
      setIsMobile(mobile);

      // Auto-collapse only when switching to mobile; do not auto-expand on desktop
      if (mobile) {
        setCollapsed(true);
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize(); // Initial check

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  return (
    <div className="layout-container">
      {!isMeetingRoom && (
        <>
          <Sidebar
            collapsed={collapsed}
            toggleSidebar={toggleSidebar}
            isMobile={isMobile}
          />

          {/* Backdrop only when expanded on mobile */}
          {isMobile && !collapsed && (
            <div className="sidebar-backdrop" onClick={() => setCollapsed(true)} />
          )}
        </>
      )}

      <div className={`main-content${(isEarlyDetectionDetails || isAppointmentDetails) ? "" : collapsed ? " collapsed" : " expanded"}`}>
        {!isMeetingRoom && (
          <Header toggleSidebar={toggleSidebar} isMobile={isMobile} />
        )}
        <main className={`layout-content${isAppointmentDetails ? " layout-content--white" : ""}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
