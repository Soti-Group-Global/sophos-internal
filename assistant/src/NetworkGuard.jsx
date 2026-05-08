import React, { useEffect, useState } from "react";
import { FiWifiOff, FiWifi, FiRefreshCw } from "react-icons/fi";
import "./styles/NetworkGuard.css"; // Import the CSS file

const NetworkGuard = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineUI, setShowOfflineUI] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Show "reconnecting" state briefly before hiding
      setTimeout(() => setShowOfflineUI(false), 1500);
      window.location.reload();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineUI(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <>
      {children}
      {showOfflineUI && (
        <div className="network-guard-overlay">
          {isOnline ? (
            <>
              <FiWifi className="network-guard-icon" />
              <h1 className="network-guard-title">Connection Restored</h1>
              <div className="network-guard-reconnecting">
                <FiRefreshCw className="network-guard-spinner" />
                Refreshing page...
              </div>
            </>
          ) : (
            <>
              <FiWifiOff className="network-guard-icon" />
              <h1 className="network-guard-title">No Internet Connection</h1>
              <p className="network-guard-message">
                You're currently offline. Please check your network connection and try again.
              </p>
              <button
                onClick={handleRefresh}
                className="network-guard-button"
              >
                <FiRefreshCw /> Refresh
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default NetworkGuard;