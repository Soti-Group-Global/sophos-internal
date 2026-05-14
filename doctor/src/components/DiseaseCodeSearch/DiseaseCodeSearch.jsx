import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import diseases from "../../utils/medical_diseases_code.json";
import "./DiseaseCodeSearch.css";

const CODE_RE = /^([A-Z][0-9A-Z.\-]+)/;

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

const DiseaseCodeSearch = ({
  value = "",
  onChange,
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
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
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
    setQuery(item.MKB_VALUES);
    setResults([]);
    setOpen(false);
    setActiveIdx(-1);
    onChange?.(item.MKB_VALUES);
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
            const codeMatch = item.MKB_VALUES.match(CODE_RE);
            const code = codeMatch ? codeMatch[1] : null;
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
