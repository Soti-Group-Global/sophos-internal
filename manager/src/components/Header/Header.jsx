import { useContext, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FiLogOut, FiMenu, FiX, FiMapPin, FiChevronDown } from "react-icons/fi";
import { RiTranslate } from "react-icons/ri";
import { MdDashboardCustomize } from "react-icons/md";
import ReactCountryFlag from "react-country-flag";
import { AuthContext } from "../../context/AuthContext";
import { useBranch } from "../../context/BranchContext";
import { getProfile, getNotifications } from "../../utils/api";
import defaultUser from "../../assets/default-user.png";
import { useTranslation } from "react-i18next";
import "./Header.css";
import NotificationBox from "../NotificationBox";
import BoardPage from "../../pages/BoardPage";

const Header = ({ onMenuToggle, isSidebarOpen }) => {
  const { user, logout } = useContext(AuthContext);
  const { selectedBranch, setSelectedBranch } = useBranch();
  const { t, i18n } = useTranslation();

  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    middleName: "",
    profilePicture: null,
    branches: [],
  });
  const [notifications, setNotifications] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isBoardOpen, setIsBoardOpen] = useState(false);

  const langDropdownRef = useRef(null);
  const branchDropdownRef = useRef(null);

  // Handle mobile detection
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fetch profile data
  const normalizeBranches = (rawBranches) => {
    if (!rawBranches) return [];
    if (Array.isArray(rawBranches)) {
      return rawBranches
        .map((b) => (typeof b === "string" ? b : b?.name || b?.branch))
        .filter(Boolean);
    }
    if (typeof rawBranches === "string") return [rawBranches];
    if (typeof rawBranches === "object") return [rawBranches.name || rawBranches.branch].filter(Boolean);
    return [];
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await getProfile();
        const {
          firstName,
          lastName,
          middleName,
          profilePicture,
          branches: profileBranches,
          branch: singleBranch,
        } = response.data.user || {};

        const branches =
          normalizeBranches(profileBranches).length > 0
            ? normalizeBranches(profileBranches)
            : normalizeBranches(singleBranch) || [];

        // Fallback to auth user branches if API returns none (seen on content manager role)
        const fallbackBranches =
          branches.length > 0 ? branches : normalizeBranches(user?.branches || user?.branch);

        setProfileData({
          firstName: firstName || "",
          lastName: lastName || "",
          middleName: middleName || "",
          profilePicture: profilePicture || null,
          branches: fallbackBranches,
        });
      } catch (error) {
        setProfileData({
          firstName: "",
          lastName: "",
          profilePicture: null,
          branches: normalizeBranches(user?.branches || user?.branch),
        });
      }
    };
    fetchProfile();
  }, [user?.email]);

  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await getNotifications();
        setNotifications(response || []);
      } catch (error) {
        setNotifications([]);
      }
    };
    fetchNotifications();
  }, []);

  // Handle outside click for language dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        langDropdownRef.current &&
        !langDropdownRef.current.contains(event.target)
      ) {
        setIsLangDropdownOpen(false);
      }
      if (
        branchDropdownRef.current &&
        !branchDropdownRef.current.contains(event.target)
      ) {
        setIsBranchDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isBoardOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsBoardOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isBoardOpen]);

  const fullName =
    profileData.firstName || profileData.lastName
      ? [profileData.lastName, profileData.firstName, profileData.middleName]
          .filter(Boolean)
          .join(" ")
      : user?.email || t("user.manager");

  // Check if we have branches to show
  const hasBranches = profileData.branches && profileData.branches.length > 0;

  const branchOptions = hasBranches
    ? profileData.branches.length > 1
      ? [
        { value: "All", label: t("branches.all") },
        ...profileData.branches.map((branchName) => ({
          value: branchName,
          label:
            t(`branches.${branchName.toLowerCase().replace(/\s+/g, "_")}`) ||
            branchName,
        })),
      ]
      : profileData.branches.map((branchName) => ({
        value: branchName,
        label:
          t(`branches.${branchName.toLowerCase().replace(/\s+/g, "_")}`) ||
          branchName,
      }))
    : [];

  useEffect(() => {
    if (!hasBranches) return;

    if (profileData.branches.length === 1) {
      const onlyBranch = profileData.branches[0];
      if (selectedBranch !== onlyBranch) {
        setSelectedBranch(onlyBranch);
      }
      return;
    }

    if (!selectedBranch) {
      setSelectedBranch("All");
    }
  }, [profileData.branches, hasBranches, selectedBranch, setSelectedBranch]);

  const handleBranchChange = (branchValue) => {
    setSelectedBranch(branchValue);
  };

  const handleOpenBoard = () => {
    setIsLangDropdownOpen(false);
    setIsBranchDropdownOpen(false);
    setIsBoardOpen(true);
  };

  const currentDate = new Date().toLocaleDateString(
    i18n.language === "ru" ? "ru-RU" : "en-US",
    { day: "2-digit", month: "short", year: "numeric" }
  );
  const currentTime = new Date().toLocaleTimeString(
    i18n.language === "ru" ? "ru-RU" : "en-US",
    { hour: "2-digit", minute: "2-digit" }
  );

  return (
    <>
    <header className="header">
      {/* Mobile Menu */}
      {isMobile && (
        <div className="header-mobile-toggle">
          <button
            className="mobile-menu-btn"
            onClick={onMenuToggle}
            title={
              isSidebarOpen ? t("actions.close_menu") : t("actions.open_menu")
            }
          >
            {isSidebarOpen ? <FiX /> : <FiMenu />}
          </button>
          {!isMobile && (
            <div className="mobile-header-info">
              <div className="user-info mobile-info">
                <div className="user-name mobile-name">{fullName}</div>
                <div className="user-location mobile-location">
                  {currentDate} | {currentTime}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Desktop User Info */}
      {!isMobile && (
        <div className="header-user desktop-user">
          <div className="user-avatar">
            <img
              src={profileData.profilePicture || defaultUser}
              alt={t("user.avatar_alt")}
              onError={(e) => (e.target.src = defaultUser)}
            />
          </div>
          <div className="user-info">
            <div className="user-name">{fullName}</div>
          </div>
        </div>
      )}

      {/* Right Actions */}
      <div className="header-actions">
        {/* Language Selector */}
        <div className="lingo-selector-wrapper" ref={langDropdownRef}>
          <button
            className="lingo-trigger-btn"
            title={t("actions.translate")}
            onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
            aria-expanded={isLangDropdownOpen}
          >
            <RiTranslate className="lingo-trigger-icon" />
            <span className="lingo-current-lang">
              {i18n.language === "en" ? "EN" : "RU"}
            </span>
          </button>

          {isLangDropdownOpen && (
            <div className="lingo-dropdown-panel">
              <div className="lingo-dropdown-header">
                <RiTranslate className="lingo-header-icon" />
                <span>{t("actions.select_language")}</span>
              </div>

              <div className="lingo-options-list">
                <button
                  className={`lingo-option-item ${i18n.language === "en" ? "lingo-option-active" : ""
                    }`}
                  onClick={() => i18n.changeLanguage("en")}
                >
                  <ReactCountryFlag countryCode="US" svg style={{ width: '1.2em', height: '1.2em' }} /> English
                </button>
                <button
                  className={`lingo-option-item ${i18n.language === "ru" ? "lingo-option-active" : ""
                    }`}
                  onClick={() => i18n.changeLanguage("ru")}
                >
                  <ReactCountryFlag countryCode="RU" svg style={{ width: '1.2em', height: '1.2em' }} /> Русский
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Branch Selector - Only show if we have branches */}
        {hasBranches && (
          <div className="branch-selector-wrapper" ref={branchDropdownRef}>
            <button
              className="branch-trigger-btn"
              title={t("branches.select_branch") || "Select Branch"}
              onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
              aria-expanded={isBranchDropdownOpen}
            >
              <FiMapPin className="branch-trigger-icon" />
              <span className="branch-current">
                {branchOptions.find((b) => b.value === selectedBranch)?.label || selectedBranch}
              </span>
              <FiChevronDown className={`branch-chevron ${isBranchDropdownOpen ? "branch-chevron-up" : ""}`} />
            </button>

            {isBranchDropdownOpen && (
              <div className="branch-dropdown-panel">
                <div className="branch-dropdown-header">
                  <FiMapPin className="branch-header-icon" />
                  <span>{t("branches.select_branch") || "Select Branch"}</span>
                </div>

                <div className="branch-options-list">
                  {branchOptions.map((branch) => (
                    <button
                      key={branch.value}
                      className={`branch-option-item ${selectedBranch === branch.value ? "branch-option-active" : ""}`}
                      onClick={() => {
                        handleBranchChange(branch.value);
                        setIsBranchDropdownOpen(false);
                      }}
                    >
                      <span className="branch-option-content">
                        <FiMapPin className="branch-icon" />
                        <span className="branch-name">{branch.label}</span>
                      </span>
                      {selectedBranch === branch.value && (
                        <span className="branch-checkmark">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Board */}
        <button
          type="button"
          className="header-btn header-btn-board"
          title={t("board.pageTitle") || "Board"}
          aria-label={t("board.pageTitle") || "Board"}
          aria-haspopup="dialog"
          aria-expanded={isBoardOpen}
          onClick={handleOpenBoard}
        >
          <MdDashboardCustomize className="header-icon" />
        </button>



        {/* Notifications */}
        <NotificationBox notifications={notifications} />

        {/* Logout */}
        <button
          className="header-btn header-btn-logout"
          title={t("actions.logout")}
          onClick={logout}
        >
          <FiLogOut className="header-icon" />
        </button>
      </div>
    </header>

      {isBoardOpen && createPortal(
        <div className="board-drawer-overlay" onClick={() => setIsBoardOpen(false)}>
          <div className="board-drawer" onClick={(e) => e.stopPropagation()}>
            <BoardPage onClose={() => setIsBoardOpen(false)} />
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default Header;
