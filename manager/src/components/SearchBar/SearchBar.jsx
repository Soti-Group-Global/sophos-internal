import { useRef } from "react";
import { Search, X } from "lucide-react";
import "./SearchBar.css";

const SearchBar = ({
  value = "",
  onChange,
  onClear,
  onKeyDown,
  placeholder = "Search...",
  className = "",
  style = {},
  maxWidth,
  size = "md", // "sm" | "md" | "lg"
  autoFocus = false,
  disabled = false,
}) => {
  const inputRef = useRef(null);

  const handleClear = () => {
    if (onClear) {
      onClear();
    } else {
      onChange?.({ target: { value: "" } });
    }
    inputRef.current?.focus();
  };

  return (
    <div
      className={`sb-wrapper sb-${size} ${className}`}
      style={{ maxWidth: maxWidth || undefined, ...style }}
    >
      <Search className="sb-icon" size={size === "sm" ? 14 : size === "lg" ? 18 : 16} />
      <input
        ref={inputRef}
        type="text"
        className="sb-input"
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
      />
      {value && !disabled && (
        <button className="sb-clear" onClick={handleClear} type="button" tabIndex={-1}>
          <X size={14} />
        </button>
      )}
    </div>
  );
};

export default SearchBar;
