import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState, Suspense } from "react";
import Header from "./Header/Header";
import "../styles/AppLayout.css";
import Sidebar from "./Sidebar/Sidebar";
import "./Sidebar/Sidebar.css";
import "./Header/Header.css";
import { useLayoutTopBar } from "../context/LayoutTopBarContext";

const LoadingSpinner = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: '100%'
  }}>
    <div className="inner-loading-spinner" style={{
      width: '30px',
      height: '30px',
      border: '2px solid #e2e8f0',
      borderTopColor: '#0A2E5D',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }} />
    <style>{`
      @keyframes spin { to { transform: rotate(360deg); } }
    `}</style>
  </div>
);

const AppLayout = ({ children }) => {
  const { pathname } = useLocation();
  const { topBarContent } = useLayoutTopBar();
  // true = sidebar expanded (280px), false = sidebar minimized (72px)
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);

      // Close mobile sidebar when switching to desktop
      if (!mobile && isMobileSidebarOpen) {
        setIsMobileSidebarOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isMobileSidebarOpen]);

  const handleMenuToggle = () => {
    if (isMobile) {
      setIsMobileSidebarOpen(!isMobileSidebarOpen);
    } else {
      setIsSidebarExpanded(!isSidebarExpanded);
    }
  };

  const handleMobileClose = () => {
    setIsMobileSidebarOpen(false);
  };

  const handleSidebarToggle = () => {
    if (isMobile) {
      setIsMobileSidebarOpen(false);
    } else {
      setIsSidebarExpanded(!isSidebarExpanded);
    }
  };

  // Close mobile sidebar when route changes
  useEffect(() => {
    if (isMobileSidebarOpen) {
      setIsMobileSidebarOpen(false);
    }
  }, [pathname]);

  const hideSidebar =
    pathname.startsWith("/applications/appointment/") ||
    pathname.startsWith("/early-detection-bookings/");

  const hideHeader = pathname.startsWith("/early-detection-bookings/");

  // Determine CSS classes based on state
  const sidebarMinimized = !isSidebarExpanded && !isMobile && !hideSidebar;
  const showCustomTopBar = Boolean(topBarContent);

  return (
    <div className={`layout-container${hideSidebar ? " no-sidebar" : ""}${hideHeader ? " no-header" : ""}`}>
      {!hideSidebar && (
        <Sidebar
          isSidebarOpen={isSidebarExpanded}
          isMobileOpen={isMobileSidebarOpen}
          onMobileClose={handleMobileClose}
          onToggleSidebar={handleSidebarToggle}
        />
      )}
      {(!hideHeader || showCustomTopBar) && (
        <div className={`layout-top-bar ${sidebarMinimized ? "sidebar-minimized" : ""}`}>
          {showCustomTopBar ? topBarContent : (
            <Header
              onMenuToggle={handleMenuToggle}
              isSidebarOpen={isMobile ? isMobileSidebarOpen : isSidebarExpanded}
            />
          )}
        </div>
      )}
      <div className={`layout-content ${sidebarMinimized ? "sidebar-minimized" : ""}`}>
        <main className={`layout-main ${isMobileSidebarOpen ? 'mobile-sidebar-open' : ''}`}>
          <Suspense fallback={<LoadingSpinner />}>
            {children || <Outlet />}
          </Suspense>
        </main>

        {/* Mobile overlay */}
        {isMobileSidebarOpen && (
          <div
            className="mobile-sidebar-overlay"
            onClick={handleMobileClose}
          />
        )}
      </div>
    </div>
  );
};

export default AppLayout;
