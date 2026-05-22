import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import diseases from "../../utils/medical_diseases_code.json";
import "./DiseaseCodeSearch.css";

const CODE_RE = /^([A-Z][0-9A-Z.\-]+)/;

const splitItem = (mkbValue) => {
  const m = mkbValue.match(CODE_RE);
  const code = m ? m[1] : "";
  const name = mkbValue.slice(code.length).trim();
  return { code, name };
};

const highlight = (text, q) => {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="dcs-mark">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
};

/**
 * DiseaseCodeSearch
 *
 * Props:
 *   value        – controlled display value
 *   onChange     – called with the display string on every keystroke
 *   onSelect     – called with { code, name } when an item is picked from the list
 *   displayMode  – "code" (show only the code after selection) | "name" (show only the diagnosis name)
 *   placeholder, className, disabled
 */
const DiseaseCodeSearch = ({
  value = "",
  onChange,
  onSelect,
  displayMode = "name",
  placeholder = "Search ICD / disease code…",
  className = "",
  disabled = false,
}) => {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handler = (e) => {
      if (
        inputRef.current && !inputRef.current.contains(e.target) &&
        listRef.current && !listRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const updateDropdownPosition = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const minWidth = 340;
    const width = Math.max(rect.width, minWidth);
    const left = Math.min(rect.left, window.innerWidth - width - 8);
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left,
      width,
      zIndex: 99999,
    });
  }, []);

  const search = useCallback((q) => {
    if (!q.trim()) return [];
    const lower = q.toLowerCase();
    return diseases.filter((d) => d.MKB_VALUES.toLowerCase().includes(lower)).slice(0, 60);
  }, []);

  const handleChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    setActiveIdx(-1);
    const filtered = search(q);
    setResults(filtered);
    if (filtered.length > 0) {
      updateDropdownPosition();
      setOpen(true);
    } else {
      setOpen(false);
    }
    onChange?.(q);
  };

  const handleSelect = (item) => {
    const { code, name } = splitItem(item.MKB_VALUES);
    const displayVal = displayMode === "code" ? code : name;
    setQuery(displayVal);
    setResults([]);
    setOpen(false);
    setActiveIdx(-1);
    if (onSelect) {
      onSelect({ code, name });
    } else {
      onChange?.(displayVal);
    }
  };

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      handleSelect(results[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  useEffect(() => {
    if (listRef.current && activeIdx >= 0) {
      const el = listRef.current.children[activeIdx];
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIdx]);

  const dropdown = open
    ? createPortal(
        <ul className="dcs-dropdown" style={dropdownStyle} ref={listRef}>
          {results.map((item, idx) => {
            const { code } = splitItem(item.MKB_VALUES);
            return (
              <li
                key={item.ID}
                className={`dcs-item${activeIdx === idx ? " dcs-item--active" : ""}`}
                onMouseDown={() => handleSelect(item)}
                onMouseEnter={() => setActiveIdx(idx)}
              >
                {code && <span className="dcs-code">{code}</span>}
                <span className="dcs-label">{highlight(item.MKB_VALUES, query)}</span>
              </li>
            );
          })}
        </ul>,
        document.body
      )
    : null;

  return (
    <div className={`dcs-wrapper ${className}`}>
      <input
        ref={inputRef}
        type="text"
        className="dcs-input"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
      />
      {dropdown}
    </div>
  );
};

export default DiseaseCodeSearch;
