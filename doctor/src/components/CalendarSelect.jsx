import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import '../styles/CalendarSelect.css';

export default function CalendarSelect({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // scroll selected item into view when list opens
  useEffect(() => {
    if (open && listRef.current) {
      const active = listRef.current.querySelector('.cal-select__item--active');
      if (active) active.scrollIntoView({ block: 'center' });
    }
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div className="cal-select" ref={ref}>
      <button
        type="button"
        className="cal-select__trigger"
        onClick={() => setOpen((o) => !o)}
      >
        <span>{selected?.label}</span>
        <ChevronDown
          size={11}
          className={`cal-select__arrow${open ? ' cal-select__arrow--open' : ''}`}
        />
      </button>

      {open && (
        <ul className="cal-select__list" ref={listRef}>
          {options.map((opt) => (
            <li
              key={opt.value}
              className={`cal-select__item${opt.value === value ? ' cal-select__item--active' : ''}`}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
