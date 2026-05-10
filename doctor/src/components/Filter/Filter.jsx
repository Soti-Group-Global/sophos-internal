import { useRef, useEffect, useState } from "react";
import { Filter as FilterIcon, ChevronDown, Check } from "lucide-react";
import "./Filter.css";

/**
 * Reusable filter dropdown component.
 *
 * Props:
 *   options      — array of { value: string, label: string }
 *   value        — currently selected value
 *   onChange     — (value: string) => void
 *   placeholder  — button label when value matches the "all" option (default "Filter")
 *   icon         — optional React node to replace the default FilterIcon
 */
export default function FilterDropdown({
  options = [],
  value,
  onChange,
  placeholder = "Filter",
  icon,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find((o) => o.value === value);
  const buttonLabel = selected ? selected.label : placeholder;

  const handleSelect = (optValue) => {
    onChange?.(optValue);
    setOpen(false);
  };

  return (
    <div className="fd-wrapper" ref={ref}>
      <button
        className={`fd-button${open ? " fd-button--open" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        {icon ?? <FilterIcon size={15} />}
        <span className="fd-button-label">{buttonLabel}</span>
        <ChevronDown size={13} className={`fd-chevron${open ? " fd-chevron--open" : ""}`} />
      </button>

      {open && (
        <div className="fd-dropdown">
          <ul className="fd-list">
            {options.map((opt) => (
              <li
                key={opt.value}
                className={`fd-item${value === opt.value ? " fd-item--active" : ""}`}
                onClick={() => handleSelect(opt.value)}
              >
                <span>{opt.label}</span>
                {value === opt.value && <Check size={13} className="fd-check" />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
