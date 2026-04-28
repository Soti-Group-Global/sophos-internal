import { useState, useRef, useEffect } from "react";
import { Clock } from "lucide-react";
import "./CustomTimePicker.css";

const CustomTimePicker = ({ value, onChange, placeholder, className, minTime, disabled, allowedTimes = null }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState(null);
  const [selectedMinute, setSelectedMinute] = useState(null);
  const dropdownRef = useRef(null);

  // Generate time slots with 30-minute intervals
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const hourStr = hour.toString().padStart(2, '0');
        const minuteStr = minute.toString().padStart(2, '0');
        const timeStr = `${hourStr}:${minuteStr}`;
        
        // If minTime is provided, filter out times before it
        if (minTime) {
          const [minHour, minMinute] = minTime.split(':').map(Number);
          if (hour < minHour || (hour === minHour && minute <= minMinute)) {
            continue;
          }
        }
        
        slots.push(timeStr);
      }
    }
    return slots;
  };

  const generatedSlots = generateTimeSlots();
  const timeSlots = Array.isArray(allowedTimes) ? allowedTimes : generatedSlots;

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = ['00', '30'];

  // Parse the value to get hour and minute
  useEffect(() => {
    if (value) {
      const [hour, minute] = value.split(':');
      setSelectedHour(hour);
      setSelectedMinute(minute);
    } else {
      setSelectedHour(null);
      setSelectedMinute(null);
    }
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleHourSelect = (hour) => {
    setSelectedHour(hour);
    if (selectedMinute !== null) {
      const timeValue = `${hour}:${selectedMinute}`;
      onChange(timeValue);
    }
  };

  const handleMinuteSelect = (minute) => {
    setSelectedMinute(minute);
    if (selectedHour !== null) {
      const timeValue = `${selectedHour}:${minute}`;
      onChange(timeValue);
      setIsOpen(false);
    }
  };

  const handleTimeSlotClick = (timeSlot) => {
    onChange(timeSlot);
    setIsOpen(false);
  };

  const displayValue = value || placeholder || "Select time";

  // Scroll to selected time when dropdown opens
  const listRef = useRef(null);
  useEffect(() => {
    if (isOpen && listRef.current && value) {
      const selectedEl = listRef.current.querySelector('.time-slot-option.selected');
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'center' });
      }
    }
  }, [isOpen]);

  return (
    <div className={`custom-time-picker ${className || ""}`} ref={dropdownRef}>
      <div
        className={`time-picker-input ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className="time-value">{displayValue}</span>
        <Clock size={18} className="time-icon" />
      </div>

      {isOpen && (
        <div className="time-picker-dropdown">
          <div className="time-slots-list" ref={listRef}>
            {timeSlots.length > 0 ? (
              timeSlots.map((slot) => (
                <div
                  key={slot}
                  className={`time-slot-option ${value === slot ? 'selected' : ''}`}
                  onClick={() => handleTimeSlotClick(slot)}
                >
                  {slot}
                </div>
              ))
            ) : (
              <div className="time-slot-option disabled">No available times</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomTimePicker;
