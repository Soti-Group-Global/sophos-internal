import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar2 from "./Sidebar/Sidebar2";
import Header from "./Header/Header";
import "./Layout.css";

const Layout = () => {
  const [collapsed, setCollapsed] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const location = useLocation();
  const isEarlyDetectionDetails = /^\/early-detection\/[^/]+$/.test(location.pathname);
  const isAppointmentDetails = /^\/appointments\/[^/]+$/.test(location.pathname);
  const hideSidebar = isEarlyDetectionDetails || isAppointmentDetails;
  const hideHeader = isEarlyDetectionDetails || isAppointmentDetails;

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 1024;
      setIsMobile(mobile);
      
      // Auto-collapse sidebar on mobile, expand on desktop
      if (mobile) {
        setCollapsed(true);
      } else {
        setCollapsed(false);
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
      {!hideSidebar && (
        <Sidebar2
          isMobileOpen={isMobile && !collapsed}
          onMobileClose={() => setCollapsed(true)}
          onToggleSidebar={(open) => setCollapsed(!open)}
        />
      )}

      {/* Backdrop only when expanded on mobile */}
      {isMobile && !collapsed && (
        <div className="sidebar-backdrop" onClick={() => setCollapsed(true)} />
      )}

      <div
        className={`layout-main ${
          hideSidebar ? "no-sidebar" : isMobile ? "" : collapsed ? "collapsed" : "expanded"
        }`}
      >
        {!hideHeader && <Header toggleSidebar={toggleSidebar} isMobile={isMobile} />}
        <main className="layout-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;