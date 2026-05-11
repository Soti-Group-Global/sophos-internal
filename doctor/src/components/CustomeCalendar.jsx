import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import './CustomCalendar.css';

const CustomCalendar = ({
  value,
  onChange,
  minDate,
  maxDate,
  placeholder,
  className = '',
  disabled = false,
  showYearDropdown = true,
  showMonthDropdown = true,
  dateFormat = '',
}) => {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(value ? new Date(value) : new Date());
  const [selectedDate, setSelectedDate] = useState(value);
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const inputRef = useRef(null);
  const calendarRef = useRef(null);
  const dropdownRef = useRef(null);
  const yearDropdownRef = useRef(null);
  const monthDropdownRef = useRef(null);

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedInsideCalendar =
        (calendarRef.current && calendarRef.current.contains(event.target)) ||
        (dropdownRef.current && dropdownRef.current.contains(event.target));

      if (!clickedInsideCalendar) {
        setIsOpen(false);
        setIsYearDropdownOpen(false);
        setIsMonthDropdownOpen(false);
      }

      if (yearDropdownRef.current && !yearDropdownRef.current.contains(event.target)) {
        setIsYearDropdownOpen(false);
      }

      if (monthDropdownRef.current && !monthDropdownRef.current.contains(event.target)) {
        setIsMonthDropdownOpen(false);
      }
    };

    if (isOpen || isYearDropdownOpen || isMonthDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, isYearDropdownOpen, isMonthDropdownOpen]);

  // Position dropdown in the viewport so it can overflow parent containers.
  // This avoids clipping when the calendar is rendered inside a small or scrollable section.
  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const input = inputRef.current;
      if (!input) return;

      const rect = input.getBoundingClientRect();
      const preferredWidth = Math.max(rect.width, 240);
      const horizontalPadding = 8;

      // Keep dropdown within viewport horizontally
      const maxLeft = window.innerWidth - preferredWidth - horizontalPadding;
      const left = Math.min(Math.max(rect.left, horizontalPadding), Math.max(maxLeft, horizontalPadding));

      // Always show dropdown below the input (matching other date pickers). If needed,
      // we constrain the dropdown height so it can scroll rather than flipping above.
      const top = rect.bottom + 6;

      // If the dropdown would extend beyond the viewport, allow it to scroll within the available space.
      const maxHeight = Math.max(window.innerHeight - top - 12, 180);

      setDropdownStyle({
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${preferredWidth}px`,
        zIndex: 9999,
        maxHeight: `${maxHeight}px`,
      });

      setDropdownStyle({
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${preferredWidth}px`,
        zIndex: 9999,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);

    const handleScroll = () => setIsOpen(false);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);

  // Update current month when value changes externally
  useEffect(() => {
    if (value) {
      setSelectedDate(new Date(value));
      setCurrentMonth(new Date(value));
    }
  }, [value]);

  const toOrderedArray = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    return Object.keys(value)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => value[k]);
  };

  const getMonthNames = () => {
    const fromCalendar = toOrderedArray(t('calendar.months', { returnObjects: true }));
    if (fromCalendar.length === 12) return fromCalendar;

    const fromRoot = toOrderedArray(t('months', { returnObjects: true }));
    if (fromRoot.length === 12) return fromRoot;

    const formatter = new Intl.DateTimeFormat(i18n.language || 'en', { month: 'long' });
    return Array.from({ length: 12 }, (_, month) => formatter.format(new Date(2026, month, 1)));
  };

  const getDayNamesShort = () => {
    const fromCalendar = toOrderedArray(t('calendar.weekdays_short', { returnObjects: true }));
    if (fromCalendar.length === 7) return fromCalendar;

    const altFromCalendar = toOrderedArray(t('calendar.weekdaysShort', { returnObjects: true }));
    if (altFromCalendar.length === 7) return altFromCalendar;

    const formatter = new Intl.DateTimeFormat(i18n.language || 'en', { weekday: 'short' });
    // Monday-first order
    return [1, 2, 3, 4, 5, 6, 0].map((day) => formatter.format(new Date(2026, 0, 4 + day)));
  };

  const formatDate = (date) => {
    if (!date) return '';
    
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    const resolvedFormat = dateFormat || (String(i18n.language || '').startsWith('ru') ? 'dd.MM.yyyy' : 'MM/dd/yyyy');

    switch (resolvedFormat) {
      case 'dd.MM.yyyy':
        return `${day}.${month}.${year}`;
      case 'dd/MM/yyyy':
        return `${day}/${month}/${year}`;
      case 'MM/dd/yyyy':
        return `${month}/${day}/${year}`;
      case 'yyyy-MM-dd':
        return `${year}-${month}-${day}`;
      case 'dd-MM-yyyy':
        return `${day}-${month}-${year}`;
      default:
        return `${day}/${month}/${year}`;
    }
  };

  const isDateDisabled = (date) => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  const isSameDay = (date1, date2) => {
    if (!date1 || !date2) return false;
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  };

  const isToday = (date) => {
    return isSameDay(date, new Date());
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of month
    // Adjust for week starting on Monday (0 = Sunday in JS)
    const offset = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;
    for (let i = 0; i < offset; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const handleYearChange = (year) => {
    setCurrentMonth(new Date(year, currentMonth.getMonth()));
    setIsYearDropdownOpen(false);
  };

  const handleMonthChange = (month) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), month));
    setIsMonthDropdownOpen(false);
  };

  const handleDateClick = (date) => {
    if (date && !isDateDisabled(date)) {
      setSelectedDate(date);
      onChange(date);
      setIsOpen(false);
    }
  };

  const getYearRange = () => {
    const currentYear = new Date().getFullYear();
    const minYear = minDate ? minDate.getFullYear() : currentYear - 100;
    const maxYear = maxDate ? maxDate.getFullYear() : currentYear + 10;
    
    const years = [];
    for (let year = minYear; year <= maxYear; year++) {
      years.push(year);
    }
    return years.reverse();
  };

  const days = getDaysInMonth(currentMonth);
  const monthNames = getMonthNames();
  const dayNamesShort = getDayNamesShort();

  return (
    <div className={`custom-calendar-wrapper ${isOpen ? 'is-open' : ''}`} ref={calendarRef}>
      <div className="custom-calendar-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          value={formatDate(selectedDate)}
          placeholder={placeholder || t('calendar.selectDate')}
          readOnly
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`custom-calendar-input ${className} ${disabled ? 'disabled' : ''}`}
        />
        <CalendarIcon 
          size={20} 
          className="custom-calendar-icon"
          onClick={() => !disabled && setIsOpen(!isOpen)}
        />
      </div>

      {isOpen && (
        <div ref={dropdownRef} className="custom-calendar-dropdown" style={dropdownStyle}>
          <div className="custom-calendar-header">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="custom-calendar-nav-button"
              aria-label={t('calendar.previousMonth')}
            >
              <ChevronLeft size={20} />
            </button>

            <div className="custom-calendar-selectors">
              {showMonthDropdown && (
                <div className="custom-dropdown-wrapper" ref={monthDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}
                    className="custom-dropdown-button"
                    aria-label={t('calendar.selectMonth')}
                  >
                    {monthNames[currentMonth.getMonth()]}
                    <ChevronDown size={16} />
                  </button>
                  {isMonthDropdownOpen && (
                    <div className="custom-dropdown-menu">
                      {monthNames.map((month, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleMonthChange(index)}
                          className={`custom-dropdown-item ${currentMonth.getMonth() === index ? 'selected' : ''}`}
                        >
                          {month}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {showYearDropdown && (
                <div className="custom-dropdown-wrapper" ref={yearDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
                    className="custom-dropdown-button"
                    aria-label={t('calendar.selectYear')}
                  >
                    {currentMonth.getFullYear()}
                    <ChevronDown size={16} />
                  </button>
                  {isYearDropdownOpen && (
                    <div className="custom-dropdown-menu scrollable">
                      {getYearRange().map((year) => (
                        <button
                          key={year}
                          type="button"
                          onClick={() => handleYearChange(year)}
                          className={`custom-dropdown-item ${currentMonth.getFullYear() === year ? 'selected' : ''}`}
                        >
                          {year}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!showMonthDropdown && !showYearDropdown && (
                <div className="custom-calendar-title">
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="custom-calendar-nav-button"
              aria-label={t('calendar.nextMonth')}
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="custom-calendar-body">
            <div className="custom-calendar-weekdays">
              {dayNamesShort.map((day, index) => (
                <div key={index} className="custom-calendar-weekday">
                  {String(day || '').toUpperCase()}
                </div>
              ))}
            </div>

            <div className="custom-calendar-days">
              {days.map((date, index) => {
                if (!date) {
                  return <div key={`empty-${index}`} className="custom-calendar-day empty" />;
                }

                const isSelected = isSameDay(date, selectedDate);
                const isCurrentDay = isToday(date);
                const isDisabled = isDateDisabled(date);

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleDateClick(date)}
                    disabled={isDisabled}
                    className={`custom-calendar-day ${isSelected ? 'selected' : ''} ${
                      isCurrentDay ? 'today' : ''
                    } ${isDisabled ? 'disabled' : ''}`}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="custom-calendar-footer">
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                if (!isDateDisabled(today)) {
                  handleDateClick(today);
                }
              }}
              className="custom-calendar-today-button"
            >
              {t('calendar.today', { defaultValue: t('calendar.buttons.today', { defaultValue: 'Today' }) })}
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="custom-calendar-close-button"
            >
              {t('calendar.close', { defaultValue: t('close', { defaultValue: 'Close' }) })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomCalendar;
