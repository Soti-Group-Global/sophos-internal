import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import ReactCountryFlag from "react-country-flag";
import "../styles/Navbar.css";

function Navbar() {
  const { t, i18n } = useTranslation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const languages = [
    { code: "en", name: "English", countryCode: "US" },
    { code: "ru", name: "Русский", countryCode: "RU" },
  ];

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    setIsDropdownOpen(false);
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const currentLanguage = languages.find(lang => lang.code === i18n.language);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Logo */}
        <Link to="/" className="navbar-logo">
          <img src={i18n.language === "ru" ? "/logo_ru.png" : "/logo_en.png"} alt="Health Direct Logo" />
        </Link>

        {/* Language Selector Dropdown */}
        <div className="language-dropdown" ref={dropdownRef}>
          <button 
            className="dropdown-toggle"
            onClick={toggleDropdown}
            aria-expanded={isDropdownOpen}
            aria-haspopup="true"
          >
            <ReactCountryFlag
              countryCode={currentLanguage.countryCode}
              svg
              style={{
                width: '1.5em',
                height: '1.5em',
                marginRight: '8px',
              }}
            />
            <span className="current-language">{currentLanguage.name}</span>
            <svg 
              className={`dropdown-arrow ${isDropdownOpen ? 'open' : ''}`} 
              width="12" 
              height="7" 
              viewBox="0 0 12 7" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          
          {isDropdownOpen && (
            <div className="dropdown-menu">
              {languages.map((language) => (
                <button
                  key={language.code}
                  className={`dropdown-item ${i18n.language === language.code ? 'active' : ''}`}
                  onClick={() => changeLanguage(language.code)}
                >
                  <ReactCountryFlag
                    countryCode={language.countryCode}
                    svg
                    style={{
                      width: '1.5em',
                      height: '1.5em',
                      marginRight: '10px',
                    }}
                  />
                  {language.name}
                  {i18n.language === language.code && (
                    <svg 
                      className="checkmark" 
                      width="16" 
                      height="16" 
                      viewBox="0 0 16 16" 
                      fill="none" 
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M13.3334 4L6.00008 11.3333L2.66675 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;