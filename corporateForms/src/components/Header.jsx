import { useState, useEffect, useRef } from "react";
import ReactCountryFlag from "react-country-flag";
import { FaGlobe } from "react-icons/fa";
import { IoIosArrowDown } from "react-icons/io";
import "../styles/Header.css";

const LANGUAGES = [
  { code: "en", name: "English", countryCode: "US" },
  { code: "ru", name: "Русский", countryCode: "RU" },
];

const Header = ({ lang, onLangChange }) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const current = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="cf-header-bar">
      <div className="cf-header-inner">
        {/* Logo — switches by language */}
        <div className="cf-header-logo">
          <img
            src={lang === "ru" ? "/logo_ru.png" : "/logo_en.png"}
            alt="SOPHOS"
            className="cf-header-logo-img"
          />
        </div>

        {/* Language switcher */}
        <div className="cf-lang-switcher" ref={dropdownRef}>
          <FaGlobe className="cf-lang-globe" />

          <button
            className="cf-lang-btn"
            onClick={() => setOpen((prev) => !prev)}
          >
            <ReactCountryFlag
              countryCode={current.countryCode}
              svg
              style={{ width: "1.2em", height: "0.9em", borderRadius: "2px" }}
              title={current.name}
            />
            <span className="cf-lang-label">{current.name}</span>
            <IoIosArrowDown className={`cf-lang-chevron${open ? " open" : ""}`} />
          </button>

          {open && (
            <ul className="cf-lang-dropdown">
              {LANGUAGES.map((l) => (
                <li
                  key={l.code}
                  className={`cf-lang-option${lang === l.code ? " active" : ""}`}
                  onClick={() => {
                    onLangChange(l.code);
                    setOpen(false);
                  }}
                >
                  <ReactCountryFlag
                    countryCode={l.countryCode}
                    svg
                    style={{ width: "1.2em", height: "0.9em", borderRadius: "2px" }}
                    title={l.name}
                  />
                  <span>{l.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
