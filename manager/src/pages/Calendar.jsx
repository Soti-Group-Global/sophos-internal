import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useTranslation } from "react-i18next";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { FiChevronDown, FiCalendar, FiClock, FiUser } from "react-icons/fi";
import { IoMdClose } from "react-icons/io";

import { getApplicationsCalender, getAllDoctors } from "../utils/api";
import { useBranch } from "../context/BranchContext";
import "../styles/Calendar.css";
import LoadingComponent from "../components/Loading/LoadingComponent";


const MonthYearDropdown = ({ calendarRef, currentDate, onDateChange }) => {
  const { t, i18n } = useTranslation("calendar");
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const dropdownRef = useRef();
  const buttonRef = useRef();
  
  // Current actual date (today)
  const actualCurrentDate = new Date();
  const actualCurrentYear = actualCurrentDate.getFullYear();
  const actualCurrentMonth = actualCurrentDate.getMonth();
  
  // Display month state - initially shows current month when dropdown opens
  const [displayMonth, setDisplayMonth] = useState(actualCurrentMonth);
  const [displayYear, setDisplayYear] = useState(actualCurrentYear);
  
  // Selected date from calendar
  const targetYear = currentDate.getFullYear();
  const targetMonth = currentDate.getMonth();

  const initialRange = 50;
  const [yearsRange, setYearsRange] = useState(() =>
    Array.from({ length: initialRange }, (_, i) => actualCurrentYear - 25 + i)
  );

  const hasScrolledToCurrentYear = useRef(false);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset to current month when dropdown opens
  useEffect(() => {
    if (showDropdown) {
      setDisplayMonth(actualCurrentMonth);
      setDisplayYear(actualCurrentYear);
    }
  }, [showDropdown, actualCurrentMonth, actualCurrentYear]);

  // Calculate dropdown position when it opens
  useEffect(() => {
    if (showDropdown && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const dropdownWidth = 360; // min-width
      
      let top = rect.bottom + 4; // Reduced gap - 4px instead of 12px
      let right = viewportWidth - rect.right;
      
      // Adjust if dropdown would go outside left edge
      if (right + dropdownWidth > viewportWidth) {
        right = 16; // minimum margin from edge
      }
      
      // Ensure dropdown doesn't go off the left side
      if (rect.right - dropdownWidth < 16) {
        right = 16; // Position from left edge instead
      }
      
      setDropdownPosition({ top, right });
    }
  }, [showDropdown]);

  const handleSelectDate = (month, year) => {
    const newDate = new Date(year, month, 1);
    onDateChange(newDate);
    setShowDropdown(false);
  };

  // Navigate to previous month
  const goToPreviousMonth = () => {
    if (displayMonth === 0) {
      setDisplayMonth(11);
      setDisplayYear(displayYear - 1);
    } else {
      setDisplayMonth(displayMonth - 1);
    }
  };

  // Navigate to next month
  const goToNextMonth = () => {
    if (displayMonth === 11) {
      setDisplayMonth(0);
      setDisplayYear(displayYear + 1);
    } else {
      setDisplayMonth(displayMonth + 1);
    }
  };

  // Get translated month names
  const getTranslatedMonth = (monthIndex) => {
    const months = [
      t("months.january"),
      t("months.february"),
      t("months.march"),
      t("months.april"),
      t("months.may"),
      t("months.june"),
      t("months.july"),
      t("months.august"),
      t("months.september"),
      t("months.october"),
      t("months.november"),
      t("months.december"),
    ];
    return months[monthIndex];
  };

  const getTranslatedShortMonth = (monthIndex) => {
    const monthsShort = [
      t("months_short.jan"),
      t("months_short.feb"),
      t("months_short.mar"),
      t("months_short.apr"),
      t("months_short.may"),
      t("months_short.jun"),
      t("months_short.jul"),
      t("months_short.aug"),
      t("months_short.sep"),
      t("months_short.oct"),
      t("months_short.nov"),
      t("months_short.dec"),
    ];
    return monthsShort[monthIndex];
  };

  const monthYearText = `${getTranslatedMonth(targetMonth)} ${targetYear}`;
  const displayMonthYearText = `${getTranslatedMonth(displayMonth)} ${displayYear}`;

  // Ensure the display year and target year are always in range
  useEffect(() => {
    setYearsRange((prev) => {
      const min = Math.min(...prev);
      const max = Math.max(...prev);
      const yearToCheck = Math.min(targetYear, displayYear, actualCurrentYear);
      const yearToCheckMax = Math.max(targetYear, displayYear, actualCurrentYear);
      if (yearToCheck < min || yearToCheckMax > max) {
        const newStart = yearToCheck - 25;
        return Array.from({ length: initialRange }, (_, i) => newStart + i);
      }
      return prev;
    });
  }, [targetYear, displayYear, actualCurrentYear]);

  // Scroll to display year when dropdown opens or when navigating
  useEffect(() => {
    if (!showDropdown) {
      hasScrolledToCurrentYear.current = false;
      return;
    }

    // Wait for the next render cycle to ensure DOM is ready
    const timer = setTimeout(() => {
      const dropdown = dropdownRef.current?.querySelector(".hd-dropdown-content");
      if (!dropdown) return;

      const yearElement = dropdown.querySelector(
        `.hd-year-section[data-year="${displayYear}"]`
      );
      
      if (yearElement) {
        // Calculate scroll position to center the year
        const scrollPosition = yearElement.offsetTop - dropdown.clientHeight / 3;
        
        // Smooth scroll to position
        dropdown.scrollTo({
          top: Math.max(0, scrollPosition),
          behavior: hasScrolledToCurrentYear.current ? 'smooth' : 'auto'
        });
        
        hasScrolledToCurrentYear.current = true;
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [showDropdown, displayYear]);

  return (
    <div className="hd-month-selector-wrapper" ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        className="hd-month-selector-btn"
        onClick={() => setShowDropdown((prev) => !prev)}
      >
        <FiCalendar className="hd-month-icon" />
        <span className="month-year-text">{monthYearText}</span>
        <FiChevronDown
          className={`hd-dropdown-arrow ${showDropdown ? "hd-dropdown-arrow--rotated" : ""}`}
        />
      </button>

      {showDropdown && (
        <div 
          className="hd-month-dropdown"
          style={{
            top: `${dropdownPosition.top}px`,
            right: `${dropdownPosition.right}px`
          }}
        >
          <div className="hd-dropdown-header">
            <div className="hd-dropdown-nav">
              <button 
                className="hd-nav-btn hd-nav-btn--prev"
                onClick={goToPreviousMonth}
                type="button"
              >
                ‹
              </button>
              <div className="hd-dropdown-current">
                <h3 className="hd-dropdown-title">{displayMonthYearText}</h3>
              </div>
              <button 
                className="hd-nav-btn hd-nav-btn--next"
                onClick={goToNextMonth}
                type="button"
              >
                ›
              </button>
            </div>
          </div>
          <div className="hd-dropdown-content">
            <div 
              key={displayYear} 
              data-year={displayYear} 
              className={`hd-year-section ${
                displayYear === actualCurrentYear ? 'hd-year-section--current' : ''
              }`}
            >
              <div className="hd-months-grid">
                {Array.from({ length: 12 }, (_, m) => {
                  const isCurrentMonth = actualCurrentMonth === m && actualCurrentYear === displayYear;
                  const isSelectedMonth = targetMonth === m && targetYear === displayYear;
                  const isDisplayMonth = displayMonth === m;
                  
                  return (
                    <div
                      key={m}
                      className={`hd-month-option ${
                        isSelectedMonth ? "hd-month-option--selected" : ""
                      } ${
                        isCurrentMonth ? "hd-month-option--current" : ""
                      } ${
                        isDisplayMonth ? "hd-month-option--display" : ""
                      }`}
                      onClick={() => handleSelectDate(m, displayYear)}
                    >
                      {getTranslatedShortMonth(m)}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


const EventTooltip = ({ event, position, onClose, onMouseEnter, onMouseLeave }) => {
  const { t, i18n } = useTranslation("calendar");
  if (!event) return null;

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString(i18n.language, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const getBubbleClass = useCallback((event) => {
    const status = event.extendedProps.appointmentStatus;
    const isFollowUp = event.extendedProps.isFollowUp;

    if (isFollowUp) return "event-followup";

    switch (status) {
      case "confirmed":
        return "event-confirmed";
      case "pending":
      case "unconfirmed":
        return "event-pending";
      case "cancelled":
        return "event-cancelled";
      default:
        return "event-default";
    }
  }, []);

  return (
    <div
      className="hd-event-tooltip"
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        zIndex: 9999,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
  
      <div className={`hd-tooltip-event-header hd-calendar-event--${getBubbleClass(event).replace('event-', '')}`}>
        <h4>{event.extendedProps?.patientName || t("unknown_patient")}</h4>
      </div>

      <div className="hd-tooltip-content">
        <div className="hd-tooltip-row">
          <FiClock className="hd-tooltip-icon" />
          <span>
            {t("tooltip_time")}: {formatTime(event.start)} -{" "}
            {formatTime(event.end)}
          </span>
        </div>
        <div className="hd-tooltip-row">
          <FiUser className="hd-tooltip-icon" />
          <span>
            {t("tooltip_doctor")}:{" "}
            {event.extendedProps?.doctorName || t("unknown_doctor")}
          </span>
        </div>
        <div className="event-title">{event.extendedProps?.serviceNo}</div>
      </div>
    </div>
  );
};

const Calendar = () => {
  const { t, i18n } = useTranslation("calendar");
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredEvent, setHoveredEvent] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [currentDate, setCurrentDate] = useState(new Date());
  const { selectedBranch } = useBranch();
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [followUpFilter, setFollowUpFilter] = useState("all");
  const lastFetchedRangeRef = useRef({ start: null, end: null });
  const isProgrammaticNavigationRef = useRef(false);
  const calendarRef = useRef(null);
  const navigate = useNavigate();
  const [hoverSlot, setHoverSlot] = useState(null);
  const [buttonPosition, setButtonPosition] = useState({ x: 0, y: 0 });
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    start: null,
    end: null,
  });
  const [doctorFilter, setDoctorFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [doctors, setDoctors] = useState([]);
  const [services, setServices] = useState([]);

  // Tooltip delay management
  const hideTimeoutRef = useRef(null);

  // Get translated locale for FullCalendar
  const getCalendarLocale = useCallback(() => {
    const locales = {
      en: {
        code: "en",
        buttonText: {
          today: t("buttons.today"),
          month: t("buttons.month"),
          week: t("buttons.week"),
          day: t("buttons.day"),
        },
        allDayText: "All Day",
        moreLinkText: "more",
        noEventsText: "No events",
        weekText: "W",
      },
      ru: {
        code: "ru",
        buttonText: {
          today: t("buttons.today"),
          month: t("buttons.month"),
          week: t("buttons.week"),
          day: t("buttons.day"),
        },
        allDayText: "Весь день",
        moreLinkText: "еще",
        noEventsText: "Нет событий",
        weekText: "Н",
      },
    };
    return locales[i18n.language] || locales.en;
  }, [i18n.language, t]);

  // Get translated month and day names for FullCalendar
  const getCalendarTexts = useCallback(() => {
    return {
      monthNames: [
        t("months.january"),
        t("months.february"),
        t("months.march"),
        t("months.april"),
        t("months.may"),
        t("months.june"),
        t("months.july"),
        t("months.august"),
        t("months.september"),
        t("months.october"),
        t("months.november"),
        t("months.december"),
      ],
      monthNamesShort: [
        t("months_short.jan"),
        t("months_short.feb"),
        t("months_short.mar"),
        t("months_short.apr"),
        t("months_short.may"),
        t("months_short.jun"),
        t("months_short.jul"),
        t("months_short.aug"),
        t("months_short.sep"),
        t("months_short.oct"),
        t("months_short.nov"),
        t("months_short.dec"),
      ],
      dayNames: [
        t("weekdays.sunday"),
        t("weekdays.monday"),
        t("weekdays.tuesday"),
        t("weekdays.wednesday"),
        t("weekdays.thursday"),
        t("weekdays.friday"),
        t("weekdays.saturday"),
      ],
      dayNamesShort: [
        t("weekdays_short.sun"),
        t("weekdays_short.mon"),
        t("weekdays_short.tue"),
        t("weekdays_short.wed"),
        t("weekdays_short.thu"),
        t("weekdays_short.fri"),
        t("weekdays_short.sat"),
      ],
    };
  }, [t]);

  const fetchApplications = useCallback(
    async (startDate, endDate, isProgrammatic = false) => {
      const startStr = startDate?.toISOString();
      const endStr = endDate?.toISOString();

      if (
        lastFetchedRangeRef.current.start === startStr &&
        lastFetchedRangeRef.current.end === endStr &&
        !isProgrammatic
      ) {
        return;
      }

      lastFetchedRangeRef.current = { start: startStr, end: endStr };

      if (!isProgrammatic) setIsLoading(true);

      try {
        const response = await getApplicationsCalender({
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          ...(statusFilter !== "all" && { status: statusFilter }),
          ...(followUpFilter !== "all" && { followup: followUpFilter }),
          ...(doctorFilter !== "all" && { doctorEmail: doctorFilter }),
          ...(serviceFilter !== "all" && { serviceType: serviceFilter }),
          ...(selectedBranch &&
            selectedBranch !== "All" && { branch: selectedBranch }),
        });

        const apps = response.data.applications || [];

        const enrichedEvents = apps
          .map((app, idx) => {
            const patientName =
              app.patientName || app.patient?.email || t("unknown_patient");
            const doctorName =
              app.doctorName || app.doctor?.email || t("unknown_doctor");

            return {
              id: app.applicationId || app._id || `temp-${idx}`,
              title: patientName,
              start: app.startTime
                ? new Date(app.startTime).toISOString()
                : null,
              end: app.endTime ? new Date(app.endTime).toISOString() : null,
              extendedProps: {
                patientName,
                doctorName,
                serviceType: app.serviceType || t("na"),
                appointmentStatus:
                  app.appointmentStatus?.toLowerCase() || "pending",
                serviceNo: app.applicationId,
                isFollowUp: app.isFollowUp || false,
              },
            };
          })
          .filter((ev) => {
            if (followUpFilter === "true") return ev.extendedProps.isFollowUp;
            if (followUpFilter === "false") return !ev.extendedProps.isFollowUp;
            return true;
          });

        setEvents(enrichedEvents);
      } catch (error) {
        toast.error(error.response?.data?.message || t("error_fetch"));
      } finally {
        if (!isProgrammatic) setIsLoading(false);
      }
    },
    [statusFilter, followUpFilter, doctorFilter, serviceFilter, t, selectedBranch]
  );
  useEffect(() => {
  if (calendarRef.current) {
    const calendarApi = calendarRef.current.getApi();
    calendarApi.refetchEvents();
  }
}, [selectedBranch]);


  useEffect(() => {
    const loadFilters = async () => {
      try {
        const doctorsData = await getAllDoctors();
        setDoctors(doctorsData || []);

        setServices([
          {
            label: "In-face and remote consultations",
            value: "In-face and remote consultations",
          },
          {
            label: "Individual early diagnosis of diseases",
            value: "Individual early diagnosis of diseases",
          },
        ]);
      } catch (err) {
      }
    };
    loadFilters();
  }, []);

  // Handle tooltip mouse events to prevent blinking
  const handleTooltipMouseEnter = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const handleTooltipMouseLeave = useCallback(() => {
    // Add small delay when leaving tooltip to prevent rapid cycling
    hideTimeoutRef.current = setTimeout(() => {
      setHoveredEvent(null);
    }, 50); // Short delay to allow mouse movement back to event
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  const handleApplyFilters = useCallback(() => {
    if (!fromDate || !toDate) {
      toast.warn(`Please select both ${t("from")} and ${t("to")} dates.`);
      return;
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);

    setCurrentDate(start);
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) calendarApi.gotoDate(start);

    fetchApplications(start, end, true);
  }, [fromDate, toDate, fetchApplications, t]);

  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    fetchApplications(start, end);
  }, [fetchApplications, selectedBranch]);

  const handleEventClick = useCallback(
    (info) => {
      const applicationId = info.event.extendedProps.serviceNo;
      navigate(`/applications/details/${encodeURIComponent(applicationId)}`);
    },
    [navigate]
  );

  const handleEventMouseEnter = useCallback((info) => {
    // Clear any pending hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    
    const rect = info.el.getBoundingClientRect();
    const tooltipWidth = 320; // Increased width for better content display
    const tooltipHeight = 180; // Increased height for better content display
    const margin = 12; // Space between tooltip and appointment

    let positionX = rect.left + rect.width / 2 - tooltipWidth / 2;
    let positionY = rect.top - tooltipHeight - margin; // Always try to position above first

    // Adjust horizontal position if tooltip goes off screen
    if (positionX + tooltipWidth > window.innerWidth) {
      positionX = window.innerWidth - tooltipWidth - 16;
    }

    if (positionX < 16) {
      positionX = 16;
    }

    // Only move below if there's really not enough space above (less than 20px from top)
    if (positionY < 20) {
      positionY = rect.bottom + margin; // Position below with margin
      
      // If positioning below would go off bottom of screen, center it vertically
      if (positionY + tooltipHeight > window.innerHeight - 20) {
        positionY = Math.max(20, window.innerHeight / 2 - tooltipHeight / 2);
      }
    }

    setTooltipPosition({ x: positionX, y: positionY });
    setHoveredEvent(info.event);
  }, []);

  const handleEventMouseLeave = useCallback(() => {
    // Only start hide timer if mouse is actually leaving the event area
    // Add longer delay to allow smooth transition to tooltip
    hideTimeoutRef.current = setTimeout(() => {
      setHoveredEvent(null);
    }, 300); // Increased delay for smoother experience
  }, []);

  const handleDatesSet = useCallback(
    (arg) => {
      if (isProgrammaticNavigationRef.current) {
        isProgrammaticNavigationRef.current = false;
        return;
      }

      const midDate = new Date((arg.start.getTime() + arg.end.getTime()) / 2);
      setCurrentDate(midDate);

      fetchApplications(arg.start, arg.end);
    },
    [fetchApplications]
  );

  const getBubbleClass = useCallback((event) => {
    const status = event.extendedProps.appointmentStatus;
    const isFollowUp = event.extendedProps.isFollowUp;

    if (isFollowUp) return "event-followup";

    switch (status) {
      case "confirmed":
        return "event-confirmed";
      case "pending":
      case "unconfirmed":
        return "event-pending";
      case "cancelled":
        return "event-cancelled";
      default:
        return "event-default";
    }
  }, []);

  const renderEventContent = useCallback(
    (arg) => {
      const { event } = arg;
      const formatTime = (dateString) =>
        new Date(dateString).toLocaleTimeString(i18n.language, {
          hour: "numeric",
          minute: "2-digit",
          hour12: false,
        });

      return (
        <div className={`hd-calendar-event hd-calendar-event--${getBubbleClass(event).replace('event-', '')}`}>
          <div className="hd-event-header">
            <span className="hd-event-time">
              {formatTime(event.start)} - {formatTime(event.end)}
            </span>
            {event.extendedProps.isFollowUp && (
              <span className="hd-followup-badge">{t("followup")}</span>
            )}
          </div>

          <div className="hd-event-title">
            {event.title || t("unknown_patient")}
          </div>

          <div className="hd-event-service">
            {event.extendedProps.serviceType || t("na")}
          </div>
        </div>
      );
    },
    [getBubbleClass, t, i18n.language]
  );

  const handleSlotMouseEnter = useCallback((info) => {
    const rect = info.el.getBoundingClientRect();
    const start = new Date(info.date);
    const end = new Date(start.getTime() + 30 * 60000);
    setHoverSlot({ start, end });

    setButtonPosition({
      x: rect.left + rect.width - 90,
      y: rect.top + 10,
    });
  }, []);

  const handleSlotMouseLeave = useCallback(() => {
    setHoverSlot(null);
  }, []);

  const calendarProps = useMemo(
    () => ({
      ref: calendarRef,
      plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
      headerToolbar: {
        start: 'prev today next',
        center: '',
        end: 'dayGridMonth,timeGridWeek,timeGridDay'
      },
      buttonText: {
        today: t("buttons.today"),
        month: t("buttons.month"),
        week: t("buttons.week"),
        day: t("buttons.day"),
        prev: '‹',
        next: '›'
      },
      initialView: "dayGridMonth",
      views: {
        timeGridDay: {
          titleFormat: {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          },
          dayHeaderFormat: { weekday: "long", day: "numeric", month: "short" },
        },
        timeGridWeek: {
          titleFormat: { month: "long", year: "numeric" },
          dayHeaderFormat: { weekday: "short", day: "numeric", month: "short" },
        },
      },
      selectable: true,
      selectMirror: true,
      select: (selectionInfo) => {
        const { start, end } = selectionInfo;
        setConfirmModal({ open: true, start, end });
      },
      events: async (fetchInfo, successCallback, failureCallback) => {
        try {
          const { start, end } = fetchInfo;
          const params = {
            start: start.toISOString(),
            end: end.toISOString(),
            ...(statusFilter !== "all" && { status: statusFilter }),
            ...(followUpFilter !== "all" && { followup: followUpFilter }),
            ...(doctorFilter !== "all" && { doctorEmail: doctorFilter }),
            ...(serviceFilter !== "all" && { serviceType: serviceFilter }),
            ...(selectedBranch &&
              selectedBranch !== "All" && { branch: selectedBranch }),
          };

          const response = await getApplicationsCalender(params);

          const apps = response.data.applications || [];
          const enrichedEvents = apps
            .map((app, idx) => ({
              id: app.applicationId || app._id || `temp-${idx}`,
              title:
                app.patientName || app.patient?.email || t("unknown_patient"),
              start: app.startTime
                ? new Date(app.startTime).toISOString()
                : null,
              end: app.endTime ? new Date(app.endTime).toISOString() : null,
              extendedProps: {
                patientName:
                  app.patientName || app.patient?.email || t("unknown_patient"),
                doctorName:
                  app.doctorName || app.doctor?.email || t("unknown_doctor"),
                serviceType: app.serviceType || t("na"),
                appointmentStatus:
                  app.appointmentStatus?.toLowerCase() || "pending",
                serviceNo: app.applicationId,
                isFollowUp: app.isFollowUp || false,
              },
            }))
            .filter((ev) => ev.start && ev.end);
          successCallback(enrichedEvents);
        } catch (error) {
          
          failureCallback(error);
        }
      },
      eventContent: renderEventContent,
      eventClick: handleEventClick,
      eventMouseEnter: handleEventMouseEnter,
      eventMouseLeave: handleEventMouseLeave,
      slotMouseEnter: handleSlotMouseEnter,
      slotMouseLeave: handleSlotMouseLeave,
      height: "auto",
      dayMaxEvents: 3,
      moreLinkClick: "popover",
      slotMinTime: "09:00:00",
      slotMaxTime: "21:00:00",
      slotDuration: "00:30:00",
      locale: getCalendarLocale(),
      ...getCalendarTexts(),
    }),
    [
      statusFilter,
      followUpFilter,
      doctorFilter,
      serviceFilter,
      selectedBranch,
      renderEventContent,
      handleEventClick,
      handleEventMouseEnter,
      handleEventMouseLeave,
      t,
      getCalendarLocale,
      getCalendarTexts,
    ]
  );

  if (isLoading) {
    return <LoadingComponent message={t("loading")} />;
  }

  return (
    <div className="hd-calendar-page">
      <div className="hd-calendar-header">
        <div className="hd-header-content">
          <div className="hd-header-top">
            <div className="hd-title-section">
              <h1 className="hd-main-title">{t("title")}</h1>
              <p className="hd-subtitle">{t("subtitle")}</p>
            </div>
            <div className="hd-legend-container">
              <div className="hd-legend-item">
                <span className="hd-legend-dot hd-legend-dot--confirmed"></span>
                <span>{t("legend_confirmed")}</span>
              </div>
              <div className="hd-legend-item">
                <span className="hd-legend-dot hd-legend-dot--pending"></span>
                <span>{t("legend_pending")}</span>
              </div>
              <div className="hd-legend-item">
                <span className="hd-legend-dot hd-legend-dot--cancelled"></span>
                <span>{t("legend_cancelled")}</span>
              </div>
              <div className="hd-legend-item">
                <span className="hd-legend-dot hd-legend-dot--followup"></span>
                <span>{t("legend_followup")}</span>
              </div>
            </div>
          </div>

          <div className="hd-filters-wrapper">
            <div className="hd-filters-grid">
              <div className="hd-filter-group">
                <label className="hd-filter-label">{t("filter_followup")}</label>
                <select
                  value={followUpFilter}
                  onChange={(e) => setFollowUpFilter(e.target.value)}
                  className="hd-filter-select"
                >
                  <option value="all">{t("all")}</option>
                  <option value="true">{t("followup_only")}</option>
                  <option value="false">{t("regular_appointments")}</option>
                </select>
              </div>

              <div className="hd-filter-group">
                <label className="hd-filter-label">{t("filter_status")}</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="hd-filter-select"
                >
                  <option value="all">{t("all")}</option>
                  <option value="confirmed">{t("confirmed")}</option>
                  <option value="pending">{t("pending")}</option>
                  <option value="unconfirmed">{t("unconfirmed")}</option>
                  <option value="cancelled">{t("cancelled")}</option>
                </select>
              </div>

              <div className="hd-filter-group">
                <label className="hd-filter-label">{t("filter_doctor")}</label>
                <select
                  value={doctorFilter}
                  onChange={(e) => setDoctorFilter(e.target.value)}
                  className="hd-filter-select"
                >
                  <option value="all">{t("all")}</option>
                  {doctors.map((doc) => (
                    <option key={doc._id || doc.email} value={doc.email}>
                      {[doc.firstName, doc.middleName, doc.lastName]
                        .filter(Boolean)
                        .join(" ")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="hd-filter-group">
                <label className="hd-filter-label">{t("filter_service")}</label>
                <select
                  value={serviceFilter}
                  onChange={(e) => setServiceFilter(e.target.value)}
                  className="hd-filter-select"
                >
                  <option value="all">{t("all")}</option>
                  {services.map((s, i) => (
                    <option key={i} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="hd-filter-group">
                <label className="hd-filter-label">{t("from")}</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="hd-filter-input"
                />
              </div>

              <div className="hd-filter-group">
                <label className="hd-filter-label">{t("to")}</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="hd-filter-input"
                />
              </div>

              <button
                className="hd-apply-filters-btn"
                onClick={handleApplyFilters}
              >
                {t("apply")}
              </button>

              <MonthYearDropdown
                calendarRef={calendarRef}
                currentDate={currentDate}
                onDateChange={(date) => {
                  setCurrentDate(date);
                  const calendarApi = calendarRef.current?.getApi();
                  if (calendarApi) {
                    isProgrammaticNavigationRef.current = true;
                    calendarApi.gotoDate(date);
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="hd-calendar-main-container">
        <FullCalendar {...calendarProps} />
      </div>

      {hoveredEvent && (
        <EventTooltip
          event={hoveredEvent}
          position={tooltipPosition}
          onClose={handleEventMouseLeave}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
        />
      )}

      {confirmModal.open && (
        <div className="hd-modal-overlay">
          <div className="hd-modal-container">
            <h3 className="hd-modal-title">{t("create_appointment")}</h3>
            <p className="hd-modal-description">
              {t("from")}{" "}
              {new Date(confirmModal.start).toLocaleTimeString(i18n.language, {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              {t("to")}{" "}
              {new Date(confirmModal.end).toLocaleTimeString(i18n.language, {
                hour: "2-digit",
                minute: "2-digit",
              })}
              ?
            </p>
            <div className="hd-modal-actions">
              <button
                className="hd-confirm-btn"
                onClick={() => {
                  const startTime = confirmModal.start.toISOString();
                  const endTime = confirmModal.end.toISOString();
                  setConfirmModal({ open: false, start: null, end: null });
                  navigate(
                    `/applications/add?start=${encodeURIComponent(
                      startTime
                    )}&end=${encodeURIComponent(endTime)}`
                  );
                }}
              >
                {t("create_appointment")}
              </button>
              <button
                className="hd-cancel-btn"
                onClick={() =>
                  setConfirmModal({ open: false, start: null, end: null })
                }
              >
                <IoMdClose />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(Calendar);
