import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Users,
  Tag,
  Calendar as CalendarIcon,
  Clock,
  User,
  Stethoscope,
} from "lucide-react";
import { getApplicationsByDate, getApplicationCountsByMonth, getDoctorBreaks, saveDoctorBreaks, getDoctors } from "../../utils/api";
import CreateAppointmentModal from "./CreateAppointmentModal";
import { getApptDotClass, getApptStatusClass, getApptStatusColor, getApptStatusDark } from "../../utils/appointmentStatus";
import "./CalendarView.css";

const CalendarView = ({ onSelectApplication, selectedApplication }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState("all");
  const [selectedTag, setSelectedTag] = useState("all");
  const [viewType, setViewType] = useState("week"); // day, week, month
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const monthDropdownRef = useRef(null);
  const yearDropdownRef = useRef(null);
  const [activeDoctorMenu, setActiveDoctorMenu] = useState(null); // Track which doctor menu is open
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [selectedDoctorForBreak, setSelectedDoctorForBreak] = useState(null);
  const [breakSlots, setBreakSlots] = useState([{ startTime: '18:00', endTime: '22:00' }]);
  const [breakComment, setBreakComment] = useState('');
  const [hoveredSlot, setHoveredSlot] = useState(null); // { doctorEmail, hour, minute }
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [appointmentModalData, setAppointmentModalData] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [monthlyCounts, setMonthlyCounts] = useState({});
  const [allDoctors, setAllDoctors] = useState([]);

  const SLOT_HEIGHT = 36;
  const CAL_START_MIN = 9 * 60;
  const timeLineRef = useRef(null);

  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });

  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setNowMinutes(n.getHours() * 60 + n.getMinutes());
    };
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  const isViewingToday = currentDate.toDateString() === new Date().toDateString();
  const nowTop = isViewingToday
    ? ((nowMinutes - CAL_START_MIN) / 15) * SLOT_HEIGHT
    : -1;

  useEffect(() => {
    if (nowTop >= 0 && timeLineRef.current) {
      timeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isViewingToday]);

  // Check if time slots overlap
  const hasTimeConflict = (slots, currentIndex, newStartTime, newEndTime) => {
    const start = newStartTime || slots[currentIndex].startTime;
    const end = newEndTime || slots[currentIndex].endTime;
    
    return slots.some((slot, index) => {
      if (index === currentIndex) return false;
      
      const slotStart = slot.startTime;
      const slotEnd = slot.endTime;
      
      // Check if times overlap
      return (start < slotEnd && end > slotStart);
    });
  };

  // Fetch applications for the selected date
  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      // Format date in YYYY-MM-DD using local timezone (not UTC)
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const response = await getApplicationsByDate(dateStr);
      
      setApplications(response.data || []);
    } catch (error) {
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  useEffect(() => {
    getDoctors().then((res) => {
      const list = Array.isArray(res?.data) ? res.data
        : Array.isArray(res?.doctors) ? res.doctors
        : Array.isArray(res) ? res : [];
      setAllDoctors(list);
    }).catch(() => setAllDoctors([]));
  }, []);

  // Fetch application counts for every day in the visible month (mini-calendar badges)
  useEffect(() => {
    const fetchMonthlyCounts = async () => {
      try {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const response = await getApplicationCountsByMonth(year, month);
        setMonthlyCounts(response.data || {});
      } catch {
        setMonthlyCounts({});
      }
    };
    fetchMonthlyCounts();
  }, [currentDate.getFullYear(), currentDate.getMonth()]);

  // Close doctor menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (activeDoctorMenu && !event.target.closest('.doctor-column-header')) {
        setActiveDoctorMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeDoctorMenu]);

  // Close month/year dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (monthDropdownRef.current && !monthDropdownRef.current.contains(event.target)) {
        setShowMonthDropdown(false);
      }
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(event.target)) {
        setShowYearDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Helper function to format name in Last First Middle order
  const formatDoctorName = (doctor) => {
    if (!doctor) return '';
    
    // Get current language from i18n, default to 'en'
    const lang = i18n.language === 'ru' ? 'ru' : 'en';
    const fallbackLang = lang === 'en' ? 'ru' : 'en';
    
    // Extract names with language preference
    const getF = (f) => {
      if (!f) return '';
      if (typeof f === 'string') return f;
      if (typeof f === 'object') return f[lang] || f[fallbackLang] || Object.values(f).find(v => typeof v === 'string') || '';
      return '';
    };
    const lastName = getF(doctor.lastName);
    const firstName = getF(doctor.firstName);
    const middleName = getF(doctor.middleName);
    
    // Format: Last First Middle
    return [lastName, firstName, middleName].filter(Boolean).join(' ').trim();
  };

  // Helper: extract localized specialty from a doctor's populated specialtyIds
  const getSpecialtyName = (doc) => {
    if (!doc?.specialtyIds?.length) return '';
    const s = doc.specialtyIds[0]; // primary specialty
    if (!s) return '';
    const lang = i18n.language === 'ru' ? 'ru' : 'en';
    return lang === 'ru'
      ? (s.name_ru || s.name_en || '')
      : (s.name_en || s.name_ru || '');
  };

  // Build appointment lookup map by doctor email for enriching allDoctors
  const appDoctorMap = applications.reduce((acc, app) => {
    const doctorEmail = app.doctorEmail || app.doctor?.email || app.doctor?.Email || (app.doctors && app.doctors[0]?.doctorEmail);
    if (doctorEmail && !acc[doctorEmail]) {
      acc[doctorEmail] = app;
    }
    return acc;
  }, {});

  // Show all doctors; enrich with appointment data where available
  const doctors = allDoctors.map((d) => {
    const name = formatDoctorName(d);
    const app = appDoctorMap[d.email];
    let spec = getSpecialtyName(d);
    if (!spec && app?.specialty) {
      spec = typeof app.specialty === 'string'
        ? app.specialty
        : (app.specialty[i18n.language === 'ru' ? 'ru' : 'en'] || app.specialty.ru || app.specialty.en || '');
    }
    return {
      id: d._id || d.email,
      email: d.email,
      name,
      _doctorProfile: d,
      specialty: spec || t('calendar.specialist'),
      initials: getInitials(name),
    };
  });

  // Generate time slots (8:00 to 20:00, 15-minute intervals)
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 9; hour < 18; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        slots.push({
          hour,
          minute,
          display: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
        });
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  const getStatusLabel = (status) => {
    if (!status) return "";
    return t(
      `applications.status_${status.toLowerCase().replace(/\s+/g, "_")}`,
      status,
    );
  };

  // Get initials from name
  function getInitials(name) {
    if (!name) return "??";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  // Get week dates
  const getWeekDates = (date) => {
    const week = [];
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    start.setDate(diff);

    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(start);
      currentDay.setDate(start.getDate() + i);
      week.push(currentDay);
    }
    return week;
  };

  const weekDates = getWeekDates(currentDate);

  // Track which appointments have already been rendered to avoid duplicates
  const renderedAppointments = new Set();

  // Filter applications by selected date and doctor email - only return if this is the START time
  const getAppointmentsForDoctorAndTime = (doctorEmail, date, hour, minute) => {
    const filtered = applications.filter(app => {
      if (!app.date || !app.startTime) return false;
      
      // Parse the app date - handle both string "YYYY-MM-DD" and Date objects
      let appDateStr;
      if (typeof app.date === 'string') {
        appDateStr = app.date;
      } else {
        const d = new Date(app.date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        appDateStr = `${year}-${month}-${day}`;
      }
      
      // Format current date using local timezone (not UTC)
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const currentDateStr = `${year}-${month}-${day}`;
      
      const isSameDay = appDateStr === currentDateStr;
      
      if (!isSameDay) return false;
      
      // Check if doctor email matches - check multiple possible fields including doctors array
      const appDoctorEmail = app.doctorEmail || app.doctor?.email || app.doctor?.Email || (app.doctors && app.doctors[0]?.doctorEmail);
      if (appDoctorEmail !== doctorEmail) return false;

      // Parse start time - handle both ISO datetime and time string formats
      let startHour, startMinute;
      if (app.startTime.includes('T')) {
        // ISO datetime format: "2026-02-26T00:00:00.000Z"
        const startDateTime = new Date(app.startTime);
        startHour = startDateTime.getUTCHours();
        startMinute = startDateTime.getUTCMinutes();
      } else {
        // Time string format: "09:00"
        [startHour, startMinute] = app.startTime.split(':').map(Number);
      }
      
      // Only return the appointment at its START time slot to avoid duplicates
      return startHour === hour && startMinute === minute;
    });
    
    return filtered;
  };

  // Returns true if the appointment's start datetime is in the future
  // (not cancelled / completed / no-show regardless of stored status)
  const isAppointmentUpcoming = (app) => {
    if (!app) return false;

    const skipped = ['cancelled', 'canceled', 'completed', 'no-show', 'noshow', 'paid'];
    if (app.appointmentStatus && skipped.includes(app.appointmentStatus.toLowerCase().trim())) {
      return false;
    }

    const now = new Date();
    let startDateTime;

    if (app.startTime?.includes('T')) {
      // ISO datetime stored in UTC — match how the calendar renders it
      const dt = new Date(app.startTime);
      // Reconstruct as local time using the UTC fields (same as display logic)
      startDateTime = new Date(
        dt.getUTCFullYear(),
        dt.getUTCMonth(),
        dt.getUTCDate(),
        dt.getUTCHours(),
        dt.getUTCMinutes(),
      );
    } else if (app.startTime) {
      // "HH:MM" string — combine with app.date in local timezone
      let dateStr;
      if (typeof app.date === 'string') {
        dateStr = app.date;
      } else {
        const d = new Date(app.date);
        dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
      startDateTime = new Date(`${dateStr}T${app.startTime}:00`);
    } else {
      return false;
    }

    return startDateTime > now;
  };

  // Returns the status to USE FOR DISPLAY.
  // Future appointments are shown as "upcoming" even if stored as "confirmed" etc.
  // Final statuses (cancelled, completed, no-show, paid) are never overridden.
  const getEffectiveStatus = (app) => {
    if (isAppointmentUpcoming(app)) return 'upcoming';
    return app.appointmentStatus;
  };

  // Calculate appointment duration in slots
  const getAppointmentSlots = (startTime, endTime) => {
    if (!startTime || !endTime) return 1;
    
    let startHour, startMinute, endHour, endMinute;
    
    // Parse start time - handle both ISO datetime and time string formats
    if (startTime.includes('T')) {
      const startDateTime = new Date(startTime);
      startHour = startDateTime.getUTCHours();
      startMinute = startDateTime.getUTCMinutes();
    } else {
      [startHour, startMinute] = startTime.split(':').map(Number);
    }
    
    // Parse end time - handle both ISO datetime and time string formats
    if (endTime.includes('T')) {
      const endDateTime = new Date(endTime);
      endHour = endDateTime.getUTCHours();
      endMinute = endDateTime.getUTCMinutes();
    } else {
      [endHour, endMinute] = endTime.split(':').map(Number);
    }
    
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    
    return Math.max(1, Math.ceil((endMinutes - startMinutes) / 15));
  };

  // Navigate dates
  const goToPreviousWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentDate(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Handle month selection
  const handleMonthChange = (monthIndex) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(monthIndex);
    setCurrentDate(newDate);
    setShowMonthDropdown(false);
  };

  // Handle year selection
  const handleYearChange = (year) => {
    const newDate = new Date(currentDate);
    newDate.setFullYear(year);
    setCurrentDate(newDate);
    setShowYearDropdown(false);
  };

  // Generate year options (current year ± 10 years for scrolling)
  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 10; i <= currentYear + 10; i++) {
      years.push(i);
    }
    return years;
  };

  // Get month names
  const getMonthNames = () => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date(2000, i, 1);
      months.push({
        index: i,
        name: date.toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', { month: 'long' })
      });
    }
    return months;
  };

  // Scroll to current year when dropdown opens
  useEffect(() => {
    if (showYearDropdown) {
      const currentYearElement = document.querySelector('.year-dropdown .dropdown-item.selected');
      if (currentYearElement) {
        currentYearElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }, [showYearDropdown]);

  // Format month/year
  const formatMonthYear = () => {
    return currentDate.toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', {
      month: 'long',
      year: 'numeric',
    });
  };

  // Get mini calendar days
  const getMiniCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const prevLastDay = new Date(year, month, 0);
    
    const firstDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const days = [];
    
    // Previous month days
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      days.push({
        day: prevLastDay.getDate() - i,
        isCurrentMonth: false,
        date: new Date(year, month - 1, prevLastDay.getDate() - i),
      });
    }
    
    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({
        day: i,
        isCurrentMonth: true,
        date: new Date(year, month, i),
      });
    }
    
    // Next month days
    const remainingDays = 42 - days.length; // 6 weeks
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        date: new Date(year, month + 1, i),
      });
    }
    
    return days;
  };

  const miniCalendarDays = getMiniCalendarDays();
  const today = new Date();

  return (
    <div className="calendar-view-layout applications-calendar-view-layout">
      {/* Left Sidebar */}
      <div className={`calendar-sidebar${sidebarOpen ? ' sidebar-responsive-open' : ''}`}>
        <div className="sidebar-date-section">
          <div className="current-date-display">
            <CalendarIcon size={16} />
            <span>{currentDate.toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
            <button className="collapse-btn" onClick={() => setSidebarOpen(false)}>
              <ChevronLeft size={16} />
            </button>
          </div>

          <div className="mini-calendar">
            <div className="mini-calendar-header">
              <button onClick={goToPreviousWeek} className="nav-btn">
                <ChevronLeft size={16} />
              </button>
              <div className="month-year-display">
                <div className="month-selector" ref={monthDropdownRef}>
                  <span 
                    className="month-name clickable"
                    onClick={() => {
                      setShowMonthDropdown(!showMonthDropdown);
                      setShowYearDropdown(false);
                    }}
                  >
                    {currentDate.toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', { month: 'long' })}
                  </span>
                  <ChevronDown 
                    size={14} 
                    className="chevron-icon clickable"
                    onClick={() => {
                      setShowMonthDropdown(!showMonthDropdown);
                      setShowYearDropdown(false);
                    }}
                  />
                  {showMonthDropdown && (
                    <div className="custom-dropdown month-dropdown">
                      {getMonthNames().map((month) => (
                        <div
                          key={month.index}
                          className={`dropdown-item ${currentDate.getMonth() === month.index ? 'selected' : ''}`}
                          onClick={() => handleMonthChange(month.index)}
                        >
                          {month.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="year-selector" ref={yearDropdownRef}>
                  <span 
                    className="year-name clickable"
                    onClick={() => {
                      setShowYearDropdown(!showYearDropdown);
                      setShowMonthDropdown(false);
                    }}
                  >
                    {currentDate.getFullYear()}
                  </span>
                  <ChevronDown 
                    size={14} 
                    className="chevron-icon clickable"
                    onClick={() => {
                      setShowYearDropdown(!showYearDropdown);
                      setShowMonthDropdown(false);
                    }}
                  />
                  {showYearDropdown && (
                    <div className="custom-dropdown year-dropdown">
                      {getYearOptions().map((year) => (
                        <div
                          key={year}
                          className={`dropdown-item ${currentDate.getFullYear() === year ? 'selected' : ''}`}
                          onClick={() => handleYearChange(year)}
                        >
                          {year}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <button onClick={goToNextWeek} className="nav-btn">
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="mini-calendar-grid">
              <div className="weekday-labels">
                {[1, 2, 3, 4, 5, 6, 0].map((dayIndex) => {
                  const d = new Date(2023, 0, 2 + dayIndex); // Jan 2 2023 is Monday
                  const label = d.toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'short' }).toUpperCase().slice(0, 3);
                  return (
                    <div key={dayIndex} className="weekday-label">{label}</div>
                  );
                })}
              </div>
              <div className="calendar-days">
                {miniCalendarDays.map((dayObj, index) => {
                  const isToday = dayObj.date.toDateString() === today.toDateString();
                  const isSelected = dayObj.date.toDateString() === currentDate.toDateString();
                  const d = dayObj.date;
                  const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  const count = dayObj.isCurrentMonth ? (monthlyCounts[dateKey] || 0) : 0;

                  return (
                    <button
                      key={index}
                      className={`calendar-day ${!dayObj.isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                      onClick={() => setCurrentDate(dayObj.date)}
                    >
                      {dayObj.day}
                      {count > 0 && (
                        <span className="cal-day-count">{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <button 
              className="add-appointment-btn"
              onClick={() => {
                const dateStr = currentDate.toISOString().split('T')[0];
                const now = new Date();
                const startDateTime = new Date(`${dateStr}T09:00:00`);
                const endDateTime = new Date(`${dateStr}T10:00:00`);
                
                setAppointmentModalData({
                  doctorEmail: '',
                  date: dateStr,
                  startTime: startDateTime.toISOString(),
                  endTime: endDateTime.toISOString(),
                });
                setShowAppointmentModal(true);
              }}
            >
              <CalendarIcon size={16} />
              {t('calendar.add_appointment') || 'Add Appointment'}
            </button>

            {/* Status Legend */}
            <div className="cal-status-legend">
              {[
                { key: "confirmed", en: "Confirmed",  ru: "Подтверждено" },
                { key: "completed", en: "Completed",  ru: "Завершено"    },
                { key: "upcoming",  en: "Upcoming",   ru: "Предстоящее"  },
                { key: "cancelled", en: "Cancelled",  ru: "Отменено"     },
              ].map(({ key, en, ru }) => (
                <div key={key} className="cal-status-legend-row">
                  <span className="cal-status-legend-dot" style={{ background: getApptStatusColor(key) }} />
                  <span>{i18n.language?.startsWith('ru') ? ru : en}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Calendar Grid */}
      <div className="calendar-main-content">
        {loading ? (
          <div className="calendar-loading">
            <div className="loading-spinner"></div>
          </div>
        ) : (
          <>
            <div className="calendar-scroll-wrapper">
            <div className="calendar-header">
              <div className="time-column-header">
                <button
                  className={`cv-sidebar-toggle ${sidebarOpen ? 'cv-sidebar-toggle--open' : ''}`}
                  onClick={() => setSidebarOpen((v) => !v)}
                  aria-label="Toggle calendar sidebar"
                >
                  {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                </button>
                <Clock size={16} className="cv-clock-icon" />
              </div>
              {doctors.map((doctor) => (
                <div key={doctor.id} className="doctor-column-header" style={{ position: 'relative' }}>
                  <div 
                    className="doctor-header-content"
                    onClick={() => setActiveDoctorMenu(activeDoctorMenu === doctor.email ? null : doctor.email)}
                  >
                    <div className="doctor-avatar">
                      <span>{doctor._doctorProfile ? getInitials(formatDoctorName(doctor._doctorProfile)) : doctor.initials}</span>
                    </div>
                    <div className="doctor-info">
                      <div className="doctor-name">{doctor._doctorProfile ? formatDoctorName(doctor._doctorProfile) : doctor.name}</div>
                      <div className="doctor-specialty">{doctor._doctorProfile ? (getSpecialtyName(doctor._doctorProfile) || doctor.specialty || t('calendar.specialist')) : (doctor.specialty || t('calendar.specialist'))}</div>
                    </div>
                  </div>
                  
                  {activeDoctorMenu === doctor.email && (
                    <div className="doctor-menu-dropdown">
                      <div className="doctor-menu-item" onClick={() => {
                        setActiveDoctorMenu(null);
                      }}>
                        <CalendarIcon size={16} />
                        <span>{t('calendar.weeklySchedule')}</span>
                      </div>
                      <div className="doctor-menu-item" onClick={async () => {
                        setSelectedDoctorForBreak(doctor);
                        setActiveDoctorMenu(null);
                        
                        // Load existing breaks for this doctor and date
                        try {
                          const dateStr = currentDate.toISOString().split('T')[0];
                          const response = await getDoctorBreaks(doctor.email, dateStr);
                          
                          if (response.data && response.data.breaks && response.data.breaks.length > 0) {
                            setBreakSlots(response.data.breaks);
                            setBreakComment(response.data.comment || '');
                          } else {
                            // Set default break slot if no existing breaks
                            setBreakSlots([{ startTime: '18:00', endTime: '22:00' }]);
                            setBreakComment('');
                          }
                        } catch (error) {
                          // Set default break slot on error
                          setBreakSlots([{ startTime: '18:00', endTime: '22:00' }]);
                          setBreakComment('');
                        }
                        
                        setShowBreakModal(true);
                      }}>
                        <Clock size={16} />
                        <span>{t('calendar.addBreak')}</span>
                      </div>
                      <div className="doctor-menu-item" onClick={() => {
                        setActiveDoctorMenu(null);
                      }}>
                        <CalendarIcon size={16} />
                        <span>{t('calendar.cancelWorkingDay')}</span>
                      </div>
                      <div className="doctor-menu-item" onClick={() => {
                        setActiveDoctorMenu(null);
                      }}>
                        <User size={16} />
                        <span>{t('calendar.employeeProfile')}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="calendar-body" style={{ position: 'relative' }}>
          {nowTop >= 0 && (
            <div ref={timeLineRef} className="cal-now-line" style={{ top: `${nowTop}px` }}>
              <span className="cal-now-dot" />
            </div>
          )}
          <div className="time-slots-column">
            {timeSlots.map((slot, index) => (
              <div key={index} className={`time-slot ${slot.minute === 0 || slot.minute === 30 ? 'half-hour-mark' : ''}`}>
                {(slot.minute === 0 || slot.minute === 30) && <span className="time-label">{slot.display}</span>}
              </div>
            ))}
          </div>

          <div className="appointments-grid">
            {doctors.map((doctor) => (
              <div key={doctor.email} className="doctor-column">
                {timeSlots.map((slot, slotIndex) => {
                  const appointments = getAppointmentsForDoctorAndTime(
                    doctor.email,
                    currentDate,
                    slot.hour,
                    slot.minute
                  );

                  const isHovered = hoveredSlot?.doctorEmail === doctor.email && 
                                    hoveredSlot?.hour === slot.hour && 
                                    hoveredSlot?.minute === slot.minute;
                  
                  // Check if this is part of the hovered 1-hour span (4 slots of 15 min)
                  const isInHoverSpan = hoveredSlot?.doctorEmail === doctor.email && 
                                        hoveredSlot?.hour === slot.hour && 
                                        slot.minute >= hoveredSlot.minute && 
                                        slot.minute < hoveredSlot.minute + 60;

                  return (
                    <div 
                      key={slotIndex} 
                      className={`time-cell ${slot.minute === 0 || slot.minute === 30 ? 'half-hour-mark' : ''} ${isInHoverSpan ? 'hover-span' : ''}`}
                      style={isHovered && appointments.length === 0 ? { cursor: 'pointer' } : undefined}
                      onClick={() => {
                        if (!isHovered || appointments.length > 0) return;
                        const dateStr = currentDate.toISOString().split('T')[0];
                        const totalMins = slot.hour * 60 + slot.minute + 60;
                        const endH = Math.floor(totalMins / 60);
                        const endM = totalMins % 60;
                        const startStr = `${slot.hour.toString().padStart(2,'0')}:${slot.minute.toString().padStart(2,'0')}`;
                        const endStr = `${endH.toString().padStart(2,'0')}:${endM.toString().padStart(2,'0')}`;
                        setAppointmentModalData({
                          doctorEmail: doctor.email,
                          date: dateStr,
                          startTime: new Date(`${dateStr}T${startStr}:00`).toISOString(),
                          endTime: new Date(`${dateStr}T${endStr}:00`).toISOString(),
                        });
                        setShowAppointmentModal(true);
                      }}
                      onMouseEnter={() => {
                        // Check if there's a full continuous 1-hour slot available (4 slots of 15 min)
                        let hasConflict = false;
                        
                        // Calculate what the end time would be (1 hour from start)
                        const totalStartMinutes = slot.hour * 60 + slot.minute;
                        const totalEndMinutes = totalStartMinutes + 60;
                        const endHour = Math.floor(totalEndMinutes / 60);
                        const endMinute = totalEndMinutes % 60;
                        
                        // Check all slots in the 1-hour span
                        for (let i = 0; i < 4; i++) {
                          const checkTotalMinutes = totalStartMinutes + (i * 15);
                          const checkHour = Math.floor(checkTotalMinutes / 60);
                          const checkMinute = checkTotalMinutes % 60;
                          
                          // Skip if we've gone past end of day
                          if (checkHour >= 24) {
                            hasConflict = true;
                            break;
                          }
                          
                          const checkApps = getAppointmentsForDoctorAndTime(
                            doctor.email,
                            currentDate,
                            checkHour,
                            checkMinute
                          );
                          
                          if (checkApps.length > 0) {
                            hasConflict = true;
                            break;
                          }
                        }
                        
                        // Also check if any appointments would overlap with this 1-hour window
                        // by checking if any appointment starts before our end time and ends after our start time
                        const allApps = applications.filter(app => {
                          const appDoctorEmail = app.doctorEmail || app.doctor?.email || app.doctor?.Email;
                          return appDoctorEmail === doctor.email;
                        });
                        
                        for (const app of allApps) {
                          // Parse appointment start and end times
                          let appStartHour, appStartMinute, appEndHour, appEndMinute;
                          
                          if (app.startTime.includes('T')) {
                            const startDt = new Date(app.startTime);
                            appStartHour = startDt.getUTCHours();
                            appStartMinute = startDt.getUTCMinutes();
                          } else {
                            [appStartHour, appStartMinute] = app.startTime.split(':').map(Number);
                          }
                          
                          if (app.endTime.includes('T')) {
                            const endDt = new Date(app.endTime);
                            appEndHour = endDt.getUTCHours();
                            appEndMinute = endDt.getUTCMinutes();
                          } else {
                            [appEndHour, appEndMinute] = app.endTime.split(':').map(Number);
                          }
                          
                          const appStartMinutes = appStartHour * 60 + appStartMinute;
                          const appEndMinutes = appEndHour * 60 + appEndMinute;
                          
                          // Check for overlap: appointment starts before our end time AND ends after our start time
                          if (appStartMinutes < totalEndMinutes && appEndMinutes > totalStartMinutes) {
                            hasConflict = true;
                            break;
                          }
                        }
                        
                        if (!hasConflict) {
                          setHoveredSlot({ doctorEmail: doctor.email, hour: slot.hour, minute: slot.minute });
                        }
                      }}
                      onMouseLeave={() => setHoveredSlot(null)}
                    >
                      {isHovered && (() => {
                        // Calculate start and end times
                        const startHour = slot.hour;
                        const startMinute = slot.minute;
                        const totalMinutes = startHour * 60 + startMinute + 60; // Add 1 hour
                        const endHour = Math.floor(totalMinutes / 60);
                        const endMinute = totalMinutes % 60;
                        
                        const startTime = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;
                        const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
                        
                        return (
                          <div
                            className="create-appointment-hover"
                          >
                            <span className="create-icon">+</span>
                            <span className="create-text">{t('calendar.create_appointment')}</span>
                            <span className="create-time">{startTime} - {endTime}</span>
                          </div>
                        );
                      })()}
                      {appointments.map((app) => {
                        const duration = getAppointmentSlots(app.startTime, app.endTime);
                        const isSelected = selectedApplication?._id === app._id;
                        // Use effective status: future appointments show as "upcoming"
                        const effectiveStatus = getEffectiveStatus(app);
                        const statusLabel = getStatusLabel(effectiveStatus);
                        // Calculate height: each slot is 36px, subtract 4px for top/bottom margins
                        const blockHeight = (duration * 36) - 4;

                        // Format times for display
                        const formatTime = (timeStr) => {
                          if (!timeStr) return '';
                          if (timeStr.includes('T')) {
                            const dt = new Date(timeStr);
                            return `${dt.getUTCHours().toString().padStart(2, '0')}:${dt.getUTCMinutes().toString().padStart(2, '0')}`;
                          }
                          return timeStr;
                        };

                        // Format patient name in Last First Middle order
                        let patientName = app.patientName;
                        if (!patientName && app.patient) {
                          const lastName = app.patient.lastName || '';
                          const firstName = app.patient.firstName || '';
                          const middleName = app.patient.middleName || '';
                          patientName = [lastName, firstName, middleName].filter(Boolean).join(' ').trim();
                        }
                        if (!patientName) {
                          patientName = t('calendar.unknown_patient');
                        }

                        // Light-background statuses need dark text for readability
                        const lightBgStatuses = ['pending', 'in process', 'pending-payment', 'pending payment', 'waiting for assign'];
                        const effectiveKey = effectiveStatus?.toLowerCase().trim() ?? '';
                        const textColor = lightBgStatuses.includes(effectiveKey) ? '#1f2937' : '#ffffff';

                        return (
                          <div
                            key={app._id}
                            className={`appointment-block ${isSelected ? 'selected' : ''} ${getApptStatusClass(effectiveStatus)}`}
                            style={{
                              height: `${blockHeight}px`,
                              background: getApptStatusColor(effectiveStatus),
                              color: textColor,
                            }}
                            onClick={() => {
                              const appId = app.applicationId || app._id;
                              navigate(`/applications/appointment/${encodeURIComponent(appId)}`);
                            }}
                          >
                            {isAppointmentUpcoming(app) && (
                              <span
                                className="upcoming-live-dot"
                                style={{
                                  '--dot-fill': getApptStatusDark(effectiveStatus),
                                  '--dot-ring': getApptStatusDark(effectiveStatus),
                                }}
                              />
                            )}
                            <div className="appointment-time">
                              {formatTime(app.startTime)}
                            </div>
                            <div className="appointment-patient">
                              {patientName}
                            </div>
                            {duration > 1 && (
                              <div className="appointment-status-row">
                                <span
                                  className={`appt-status-dot appointment-status-dot ${getApptDotClass(effectiveStatus)}`}
                                />
                                <span className="appointment-status-text">
                                  {statusLabel}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
            </div>{/* end calendar-scroll-wrapper */}
          </>
        )}
      </div>

      {/* Add Break Modal */}
      {showBreakModal && selectedDoctorForBreak && (
        <div className="modal-overlay" onClick={() => setShowBreakModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="break-modal-header">
              <h3 className="break-modal-title">{t('calendar.addBreak')}</h3>
              <button className="break-modal-close" onClick={() => setShowBreakModal(false)}>
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="doctor-name-display">{selectedDoctorForBreak.name}</div>
              
              {breakSlots.map((slot, index) => (
                <div key={index} className="break-time-row">
                  <input
                    type="time"
                    className="time-input"
                    value={slot.startTime}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      if (hasTimeConflict(breakSlots, index, newValue, slot.endTime)) {
                        toast.warning(t('calendar.timeConflictError'));
                        return;
                      }
                      const newSlots = [...breakSlots];
                      newSlots[index].startTime = newValue;
                      setBreakSlots(newSlots);
                    }}
                  />
                  <span className="time-separator">–</span>
                  <input
                    type="time"
                    className="time-input"
                    value={slot.endTime}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      if (hasTimeConflict(breakSlots, index, slot.startTime, newValue)) {
                        toast.warning(t('calendar.timeConflictError'));
                        return;
                      }
                      const newSlots = [...breakSlots];
                      newSlots[index].endTime = newValue;
                      setBreakSlots(newSlots);
                    }}
                  />
                  {breakSlots.length > 1 && (
                    <button 
                      className="delete-break-btn"
                      onClick={() => {
                        const newSlots = breakSlots.filter((_, i) => i !== index);
                        setBreakSlots(newSlots);
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              
              <button 
                className="add-break-btn"
                onClick={() => {
                  setBreakSlots([...breakSlots, { startTime: '', endTime: '' }]);
                }}
              >
                + {t('calendar.break')}
              </button>
              
              <div className="comment-section">
                <label className="comment-label">{t('calendar.comment')}</label>
                <textarea
                  className="comment-textarea"
                  value={breakComment}
                  onChange={(e) => setBreakComment(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="save-btn" onClick={async () => {
                try {
                  const dateStr = currentDate.toISOString().split('T')[0];
                  
                  await saveDoctorBreaks({
                    doctorEmail: selectedDoctorForBreak.email,
                    date: dateStr,
                    breaks: breakSlots.filter(slot => slot.startTime && slot.endTime),
                    comment: breakComment,
                  });
                  
                  toast.success(t('calendar.saveSuccess') || 'Breaks saved successfully');
                  setShowBreakModal(false);
                  setBreakComment('');
                  setBreakSlots([{ startTime: '18:00', endTime: '22:00' }]);
                  
                  // Optionally refresh applications to show updated breaks
                  try {
                    await fetchApplications();
                  } catch (refreshError) {
                    // Silently fail - breaks are already saved
                  }
                } catch (error) {
                  toast.error(t('calendar.saveError') || 'Failed to save breaks');
                }
              }}>
                {t('calendar.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Appointment Modal */}
      {showAppointmentModal && appointmentModalData && (
        <CreateAppointmentModal
          isOpen={showAppointmentModal}
          onClose={() => {
            setShowAppointmentModal(false);
            setAppointmentModalData(null);
          }}
          doctorEmail={appointmentModalData.doctorEmail}
          date={appointmentModalData.date}
          startTime={appointmentModalData.startTime}
          endTime={appointmentModalData.endTime}
          onSuccess={async (newApplication) => {
            // Refresh applications after successful creation
            await fetchApplications();
            // Optionally select the new application
            if (onSelectApplication && newApplication) {
              onSelectApplication(newApplication);
            }
          }}
        />
      )}
    </div>
  );
};

export default CalendarView;
