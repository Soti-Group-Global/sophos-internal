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
  dateFormat = 'dd/MM/yyyy',
}) => {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(value ? new Date(value) : new Date());
  const [selectedDate, setSelectedDate] = useState(value);
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const calendarRef = useRef(null);
  const yearDropdownRef = useRef(null);
  const monthDropdownRef = useRef(null);

  const currentLang = i18n.language;

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
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

  // Update current month when value changes externally
  useEffect(() => {
    if (value) {
      setSelectedDate(new Date(value));
      setCurrentMonth(new Date(value));
    }
  }, [value]);

  const FALLBACK_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const FALLBACK_MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const FALLBACK_WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const FALLBACK_WEEKDAYS_SHORT = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  const getMonthNames = () => {
    const months = t('calendar.months', { returnObjects: true });
    if (Array.isArray(months)) return months;
    return FALLBACK_MONTHS;
  };

  const getMonthNamesShort = () => {
    const months = t('calendar.monthsShort', { returnObjects: true });
    if (Array.isArray(months)) return months;
    return FALLBACK_MONTHS_SHORT;
  };

  const getDayNames = () => {
    const days = t('calendar.weekdays', { returnObjects: true });
    if (Array.isArray(days)) return days;
    return FALLBACK_WEEKDAYS;
  };

  const getDayNamesShort = () => {
    const days = t('calendar.weekdays_short', { returnObjects: true });
    if (Array.isArray(days)) return days;
    return FALLBACK_WEEKDAYS_SHORT;
  };

  const formatDate = (date) => {
    if (!date) return '';
    
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    switch (dateFormat) {
      case 'dd/MM/yyyy':
        return `${day}/${month}/${year}`;
      case 'MM/dd/yyyy':
        return `${month}/${day}/${year}`;
      case 'yyyy-MM-dd':
        return `${year}-${month}-${day}`;
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
  const monthNamesShort = getMonthNamesShort();
  const dayNamesShort = getDayNamesShort();

  return (
    <div className={`custom-calendar-wrapper ${isOpen ? 'is-open' : ''} ${className}`} ref={calendarRef}>
      <div className="custom-calendar-input-wrapper">
        <input
          type="text"
          value={formatDate(selectedDate)}
          placeholder={placeholder || t('calendar.selectDate')}
          readOnly
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`custom-calendar-input ${disabled ? 'disabled' : ''}`}
        />
        <CalendarIcon 
          size={15} 
          className="custom-calendar-icon"
          onClick={() => !disabled && setIsOpen(!isOpen)}
        />
      </div>

      {isOpen && (
        <div className="custom-calendar-dropdown">
          <div className="custom-calendar-header">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="custom-calendar-nav-button"
              aria-label={t('calendar.previousMonth')}
            >
              <ChevronLeft size={16} />
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
                    <ChevronDown size={12} />
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
                    <ChevronDown size={12} />
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
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="custom-calendar-body">
            <div className="custom-calendar-weekdays">
              {dayNamesShort.map((day, index) => (
                <div key={index} className="custom-calendar-weekday">
                  {day}
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
