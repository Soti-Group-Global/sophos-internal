import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import "./TimePickerInput.css";

const MINUTES = ["00", "15", "30", "45"];
const HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));

const TimePickerInput = ({ value = "09:00", onChange, className = "" }) => {
  const [open, setOpen]   = useState(false);
  const [pos,  setPos]    = useState({ top: 0, left: 0 });
  const triggerRef        = useRef(null);
  const dropdownRef       = useRef(null);
  const hourListRef       = useRef(null);
  const minuteListRef     = useRef(null);

  const [hh, mm] = (value || "09:00").split(":").map((v) => String(v).padStart(2, "0"));

  // Position the portal dropdown under the trigger
  const openDropdown = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      top:  rect.bottom + window.scrollY + 4,
      left: rect.left   + window.scrollX,
    });
    setOpen(true);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        triggerRef.current && triggerRef.current.contains(e.target)
      ) return;
      if (
        dropdownRef.current && dropdownRef.current.contains(e.target)
      ) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Scroll selected items into view when dropdown opens
  useEffect(() => {
    if (!open) return;
    const scrollTo = (listRef, val, items) => {
      const idx = items.indexOf(val);
      if (idx >= 0 && listRef.current) {
        const item = listRef.current.children[idx];
        if (item) item.scrollIntoView({ block: "center" });
      }
    };
    // slight delay so the portal renders first
    setTimeout(() => {
      scrollTo(hourListRef,   hh, HOURS);
      scrollTo(minuteListRef, mm, MINUTES);
    }, 0);
  }, [open]);

  const setHour   = (h) => onChange(`${h}:${mm}`);
  const setMinute = (m) => { onChange(`${hh}:${m}`); setOpen(false); };

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={`tpi-trigger ${className}`}
        onClick={() => open ? setOpen(false) : openDropdown()}
      >
        <span className="tpi-value">{hh}:{mm}</span>
        <svg className="tpi-clock-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="10" cy="10" r="8"/>
          <polyline points="10,5 10,10 13,13"/>
        </svg>
      </button>

      {open && document.body && createPortal(
        <div
          ref={dropdownRef}
          className="tpi-dropdown"
          style={{ top: pos.top, left: pos.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {/* Hours column */}
          <div className="tpi-column">
            <div className="tpi-col-header">HH</div>
            <ul className="tpi-list" ref={hourListRef}>
              {HOURS.map((h) => (
                <li
                  key={h}
                  className={`tpi-item${h === hh ? " tpi-item--active" : ""}`}
                  onClick={() => setHour(h)}
                >
                  {h}
                </li>
              ))}
            </ul>
          </div>

          <div className="tpi-col-sep">:</div>

          {/* Minutes column */}
          <div className="tpi-column">
            <div className="tpi-col-header">MM</div>
            <ul className="tpi-list" ref={minuteListRef}>
              {MINUTES.map((m) => (
                <li
                  key={m}
                  className={`tpi-item${m === mm ? " tpi-item--active" : ""}`}
                  onClick={() => setMinute(m)}
                >
                  {m}
                </li>
              ))}
            </ul>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default TimePickerInput;
