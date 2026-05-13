import { useContext, useState, useEffect, useRef } from "react";
import { FiSearch, FiBell, FiLogOut, FiMenu } from "react-icons/fi";
import { RiTranslate } from "react-icons/ri";
import { AuthContext } from "../../context/AuthContext";
import { useTranslation } from "react-i18next";
import ReactCountryFlag from "react-country-flag";
import defaultUser from "../../assets/default-user.png";
import "./Header.css";
import i18n from "i18next";
import NotificationBox from "../NotificationBox";
import { getDoctorBranches, getImage } from "../../utils/api";
import { formatDateISO, formatTimeHHMM } from "../../utils/dateFormat";

const Header = ({ toggleSidebar, isMobile }) => {
  const { user, logout } = useContext(AuthContext);
  const { t, i18n } = useTranslation();
  const lang = i18n.language || "en";

  const languages = [
    { code: "en", label: "English", countryCode: "US" },
    { code: "ru", label: "Русский", countryCode: "RU" },
  ];

  const currentLang =
    languages.find((l) => l.code === i18n.language) || languages[0];

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isSearchBubbleVisible, setIsSearchBubbleVisible] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [branch, setBranch] = useState("");
  const [avatarSrc, setAvatarSrc] = useState(defaultUser);

  const dropdownRef = useRef(null);
  const searchRef = useRef(null);
  const langRef = useRef(null);

  // Derive display name from multilingual firstName/lastName
  const displayName = (() => {
    const first = user?.firstName?.[lang] || user?.firstName?.en || "";
    const last = user?.lastName?.[lang] || user?.lastName?.en || "";
    const middle = user?.middleName?.[lang] || user?.middleName?.en || "";

    const full = `${last} ${first} ${middle}`.trim();
    return full || user?.email || t("general.doctor");
  })();

  const currentDate = formatDateISO(new Date());
  const currentTime = formatTimeHHMM(new Date());

  const toggleDropdown = () => setIsDropdownOpen(!isDropdownOpen);
  const toggleLangDropdown = () => setIsLangOpen(!isLangOpen);

  const toggleSearch = () => {
    if (isSearchExpanded) {
      setIsSearchBubbleVisible(false);
      setTimeout(() => setIsSearchExpanded(false), 300);
    } else {
      setIsSearchExpanded(true);
      setTimeout(() => setIsSearchBubbleVisible(true), 100);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target) &&
        isSearchExpanded
      ) {
        toggleSearch();
      }
      if (langRef.current && !langRef.current.contains(event.target)) {
        setIsLangOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSearchExpanded]);

  useEffect(() => {
    const fetchBranch = async () => {
      try {
        const res = await getDoctorBranches();
        if (res?.branches?.length > 0) {
          setBranch(res.branches[0]); // use the first branch for display
        }
      } catch (err) {
        console.error("Failed to fetch doctor branch:", err);
      }
    };

    fetchBranch();
  }, []);

  // Fetch profile image when user.profileFileId changes
  useEffect(() => {
    const fetchAvatar = async () => {
      if (user?.profileFileId) {
        try {
          const blob = await getImage(user.profileFileId);
          setAvatarSrc(URL.createObjectURL(blob));
        } catch {
          setAvatarSrc(defaultUser);
        }
      } else {
        setAvatarSrc(defaultUser);
      }
    };
    fetchAvatar();
  }, [user?.profileFileId]);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    if (e.target.value.length > 0) {
      setSearchResults([
        { id: 1, title: "Patient: Amanda Chavez" },
        { id: 2, title: "Appointment: May 15, 10:30 AM" },
        { id: 3, title: "Prescription: #RX-2023-0456" },
      ]);
    } else {
      setSearchResults([]);
    }
  };

  const handleLanguageSelect = (lang) => {
    i18n.changeLanguage(lang);
    setIsLangOpen(false);
  };

  return (
    <header className="header">
      <div className="header-user">
        {isMobile && (
          <button
            className="header-btn header-btn-menu"
            onClick={toggleSidebar}
            title={t("general.menu")}
          >
            <FiMenu className="header-menu-icon" />
          </button>
        )}
        <div className="user-avatar">
          <img
            src={avatarSrc}
            alt="User Avatar"
            onError={() => setAvatarSrc(defaultUser)}
          />
        </div>
        <div className="user-info">
          <div className="user-name">{displayName}</div>
        </div>
      </div>

      <div className="header-section-actions">
        {/* Language Toggle */}
        <div className="language-switcher" ref={langRef}>
          <button
            className="language-switcher__icon-btn"
            onClick={toggleLangDropdown}
            aria-label="Change language"
          >
            <ReactCountryFlag
              countryCode={currentLang.countryCode}
              svg
              style={{ width: "22px", height: "16px", borderRadius: "2px", objectFit: "cover" }}
              title={currentLang.label}
            />
            <span className="language-switcher__label">{currentLang.label}</span>
          </button>

          {isLangOpen && (
            <div className="language-popup">
              <div className="language-popup__content">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    className={`language-popup__option ${i18n.language === lang.code
                        ? "language-popup__option--active"
                        : ""
                      }`}
                    onClick={() => handleLanguageSelect(lang.code)}
                  >
                    <ReactCountryFlag
                      countryCode={lang.countryCode}
                      svg
                      style={{ width: "24px", height: "18px", borderRadius: "2px", objectFit: "cover" }}
                      title={lang.label}
                    />
                    <span className="language-popup__label">{lang.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        <NotificationBox />

        {/* Logout */}
        <button
          className="header-btn header-btn-logout"
          title={t("general.logout")}
          onClick={logout}
        >
          <FiLogOut className="header-icon" />
        </button>
      </div>
    </header>
  );
};

export default Header;
