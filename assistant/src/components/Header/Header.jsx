import { useContext, useState, useEffect, useRef } from "react";
import {
  FiBell,
  FiLogOut,
  FiMenu,
  FiChevronDown,
  FiChevronUp,
  FiCheck,
} from "react-icons/fi";
import ReactCountryFlag from "react-country-flag";
import { AuthContext } from "../../context/AuthContext";
import { useTranslation } from "react-i18next";
import defaultUser from "../../assets/default-user.png";
import "./Header.css";
import i18n from "i18next";
import NotificationBox from "../NotificationBox";
import { getAssistant } from "../../utils/api";

const Header = ({ toggleSidebar, isMobile }) => {
  const { logout } = useContext(AuthContext);
  const { t } = useTranslation();

  const [assistant, setAssistant] = useState(null);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);

  const dropdownRef = useRef(null);
  const langRef = useRef(null);

  const currentDate = new Date().toLocaleDateString(
    i18n.language === "ru" ? "ru-RU" : "en-US",
    { day: "2-digit", month: "short", year: "numeric" },
  );

  const currentTime = new Date().toLocaleTimeString(
    i18n.language === "ru" ? "ru-RU" : "en-US",
    { hour: "2-digit", minute: "2-digit" },
  );

  const toggleDropdown = () => setIsDropdownOpen(!isDropdownOpen);
  const toggleLangDropdown = () => setIsLangOpen(!isLangOpen);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (langRef.current && !langRef.current.contains(event.target)) {
        setIsLangOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLanguageSelect = (lang) => {
    i18n.changeLanguage(lang);
    setIsLangOpen(false);
  };

  useEffect(() => {
    const fetchAssistantData = async () => {
      try {
        const response = await getAssistant();
        if (response?.data?.assistant) {
          setAssistant(response.data.assistant);
        }
      } catch (error) {
        console.error(error);
      }
    };

    fetchAssistantData();
  }, []);

  return (
    <header className="hdr__bar">
      <div className="hdr__left">
        {isMobile && (
          <button
            className="hdr__btn hdr__btn--menu"
            onClick={toggleSidebar}
            title={t("general.menu")}
          >
            <FiMenu className="hdr__menu-icon" />
          </button>
        )}
        <div className="hdr__avatar">
          <img src={defaultUser} alt="User Avatar" />
        </div>
        <div className="hdr__info">
          <div className="hdr__name">
            {assistant
              ? [assistant.lastName, assistant.firstName, assistant.middleName]
                  .filter(Boolean)
                  .join(" ") || assistant.email
              : t("general.assistant")}
          </div>
        </div>
      </div>

      <div className="hdr__right">
        {/* Language Toggle */}
        {(() => {
          const LANGS = [
            { code: "en", label: "English", countryCode: "US" },
            { code: "ru", label: "Русский", countryCode: "RU" },
          ];
          const activeLang =
            LANGS.find((l) => l.code === i18n.language) || LANGS[0];
          return (
            <div className="hdr__lang-wrap" ref={langRef}>
              <button
                className={`hdr-lang-toggle${isLangOpen ? " open" : ""}`}
                onClick={toggleLangDropdown}
                aria-haspopup="listbox"
                aria-expanded={isLangOpen}
              >
                <ReactCountryFlag
                  countryCode={activeLang.countryCode}
                  svg
                  style={{
                    width: "1.5em",
                    height: "1.5em",
                    marginRight: "8px",
                  }}
                />
                <span className="hdr-lang-name">{activeLang.label}</span>
                <svg
                  className={`hdr-lang-arrow${isLangOpen ? " open" : ""}`}
                  width="12"
                  height="7"
                  viewBox="0 0 12 7"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M1 1L6 6L11 1"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {isLangOpen && (
                <div className="hdr-lang-menu" role="listbox">
                  {LANGS.map((lang) => {
                    const isActive = i18n.language === lang.code;
                    return (
                      <button
                        key={lang.code}
                        role="option"
                        aria-selected={isActive}
                        className={`hdr-lang-item${isActive ? " active" : ""}`}
                        onClick={() => handleLanguageSelect(lang.code)}
                      >
                        <ReactCountryFlag
                          countryCode={lang.countryCode}
                          svg
                          style={{
                            width: "1.5em",
                            height: "1.5em",
                            marginRight: "10px",
                          }}
                        />
                        {lang.label}
                        {isActive && (
                          <svg
                            className="hdr-lang-check"
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M13.3334 4L6.00008 11.3333L2.66675 8"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Notifications */}
        <NotificationBox />

        {/* Logout */}
        <button
          className="hdr__btn hdr__btn--logout"
          title={t("general.logout")}
          onClick={logout}
        >
          <FiLogOut className="hdr__icon" />
        </button>
      </div>
    </header>
  );
};

export default Header;
