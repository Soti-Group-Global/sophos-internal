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
import { getApplicationsCalendar, getEmailFromToken, getDoctors } from "../utils/api";
import { FiChevronDown, FiCalendar, FiClock, FiUser } from "react-icons/fi";
import "../styles/Calendar.css";

const MonthYearDropdown = ({ calendarRef, currentDate, onDateChange }) => {
  const { t } = useTranslation("calendar");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef();
  const currentYear = new Date().getFullYear();

  const initialRange = 50;
  const [yearsRange, setYearsRange] = useState(() =>
    Array.from({ length: initialRange }, (_, i) => currentYear - 25 + i)
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

  const handleSelectDate = (month, year) => {
    const newDate = new Date(year, month, 1);
    onDateChange(newDate);
    setShowDropdown(false);
  };

  const monthYearText = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(currentDate);

  useEffect(() => {
    if (!showDropdown) {
      hasScrolledToCurrentYear.current = false;
      return;
    }

    const dropdown = dropdownRef.current?.querySelector(".month-year-dropdown");
    if (!dropdown) return;

    if (!hasScrolledToCurrentYear.current) {
      const yearElement = dropdown.querySelector(
        `.dropdown-year-group[data-year="${currentYear}"]`
      );
      if (yearElement) {
        yearElement.scrollIntoView({ block: "start", behavior: "instant" });
        hasScrolledToCurrentYear.current = true;
      }
    }
  }, [showDropdown, yearsRange, currentYear]);

  return (
    <div className="month-selector-wrapper" ref={dropdownRef}>
      <button
        type="button"
        className="month-selector-button"
        onClick={() => setShowDropdown((prev) => !prev)}
      >
        <FiCalendar className="calendar-icon" />
        <span className="month-year-text">{monthYearText}</span>
        <FiChevronDown
          className={`dropdown-icon ${showDropdown ? "rotated" : ""}`}
        />
      </button>

      {showDropdown && (
        <div className="month-year-dropdown">
          <div className="dropdown-header">
            <h3>Select Month & Year</h3>
          </div>
          <div className="dropdown-content">
            {yearsRange.map((year) => (
              <div key={year} data-year={year} className="dropdown-year-group">
                <div className="dropdown-year-label">{year}</div>
                <div className="dropdown-months">
                  {Array.from({ length: 12 }, (_, m) => (
                    <div
                      key={m}
                      className={`dropdown-month ${
                        currentDate.getMonth() === m &&
                        currentDate.getFullYear() === year
                          ? "current-month"
                          : ""
                      }`}
                      onClick={() => handleSelectDate(m, year)}
                    >
                      {new Date(0, m).toLocaleString("default", {
                        month: "short",
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const EventTooltip = ({ event, position, onClose }) => {
  const { t } = useTranslation("calendar");
  if (!event) return null;

  const formatTime = (dateString) =>
    new Date(dateString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

  const getBubbleClass = useCallback((event) => {
    const status = event.extendedProps.appointmentStatus;
    const isFollowUp = event.extendedProps.isFollowUp;

    if (isFollowUp) return "event-followup";

    switch (status) {
      case "confirmed":
        return "event-confirmed";
      case "upcoming":
        return "event-upcoming";
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
      className="event-tooltip"
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        zIndex: 9999,
      }}
      onMouseLeave={onClose}
    >
      <div className={`modern-events ${getBubbleClass(event)}`}>
        <h4>{event.extendedProps?.patientName || t("unknown_patient")}</h4>
      </div>

      <div className="tooltip-content">
        <div className="tooltip-row">
          <FiClock className="tooltip-icon" />
          <span>
            {formatTime(event.start)} - {formatTime(event.end)}
          </span>
        </div>
        <div className="tooltip-row">
          <FiUser className="tooltip-icon" />
          <span>{event.extendedProps?.doctorName || t("unknown_doctor")}</span>
        </div>
        <div className="event-title">{event.extendedProps?.serviceNo}</div>
      </div>
    </div>
  );
};

const Calendar = () => {
  const { t } = useTranslation("calendar");

  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredEvent, setHoveredEvent] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [doctors, setDoctors] = useState([]);

  const [doctorFilter, setDoctorFilter] = useState("all");
  const [followUpFilter, setFollowUpFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [currentDate, setCurrentDate] = useState(new Date());
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const lastFetchedRangeRef = useRef({ start: null, end: null });
  const isProgrammaticNavigationRef = useRef(false);
  const calendarRef = useRef(null);
  const navigate = useNavigate();

  const assistantEmail = getEmailFromToken();

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
        const response = await getApplicationsCalendar({
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          status: statusFilter !== "all" ? statusFilter : undefined,
          followup: followUpFilter !== "all" ? followUpFilter : undefined,
          doctorEmail: doctorFilter !== "all" ? doctorFilter : undefined
        });

        const apps = response.data.applications || [];

        const enrichedEvents = apps
          .map((app, idx) => {
            const patientName =
              app.patientName || app.patient?.email || t("unknown_patient");
            const doctorName =
              app.doctorName?.[lang] || app.doctorName?.en || app.doctor?.email || t("unknown_doctor");

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
        console.error("Error fetching applications:", error);
        toast.error(error.response?.data?.message || t("error_fetch"));
      } finally {
        if (!isProgrammatic) setIsLoading(false);
      }
    },
    [statusFilter, t]
  );

  const handleApplyFilters = useCallback(() => {
    if (!fromDate || !toDate) {
      toast.warn("Please select both From and To dates.");
      return;
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);

    setCurrentDate(start);
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) calendarApi.gotoDate(start);

    fetchApplications(start, end, true);
  }, [fromDate, toDate, fetchApplications]);


  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    fetchApplications(start, end);
  }, [fetchApplications]);


  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const res = await getDoctors(assistantEmail);
        setDoctors(res?.doctors || []);
      } catch (err) {
        console.error("Failed to fetch doctors:", err);
      }
    };

    fetchDoctors();
  }, []);


  const handleEventClick = useCallback(
    (info) => {
      const applicationId = info.event.extendedProps.serviceNo;
      navigate(`/applications/details/${encodeURIComponent(applicationId)}`);
    },
    [navigate]
  );

  const handleEventMouseEnter = useCallback((info) => {
    const rect = info.el.getBoundingClientRect();
    setTooltipPosition({ x: rect.left + rect.width / 2, y: rect.top - 10 });
    setHoveredEvent(info.event);
  }, []);

  const handleEventMouseLeave = useCallback(() => setHoveredEvent(null), []);

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
      case "upcoming":
        return "event-upcoming";
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
      const formatTime = (dateString) =>
        new Date(dateString).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });

      return (
        <div className={`modern-event ${getBubbleClass(arg.event)}`}>
          <div className="event-time">{formatTime(arg.event.start)}</div>
          <div className="event-title">
            {arg.event.title}
            {arg.event.extendedProps.isFollowUp && (
              <span className="followup-tag">Follow-Up</span>
            )}
          </div>
          <div className="event-service">
            {arg.event.extendedProps.serviceType}
          </div>
        </div>
      );
    },
    [getBubbleClass]
  );

  const calendarProps = useMemo(
    () => ({
      ref: calendarRef,
      plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
      headerToolbar: {
        start: "prev,next today",
        center: "",
        end: "dayGridMonth,timeGridWeek,timeGridDay",
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
          dayHeaderFormat: {
            weekday: "long",
            day: "numeric",
            month: "short",
          },
        },
        timeGridWeek: {
          titleFormat: { month: "long", year: "numeric" },
          dayHeaderFormat: {
            weekday: "short",
            day: "numeric",
            month: "short",
          },
        },
      },
      events: async (fetchInfo, successCallback, failureCallback) => {
        try {
          const { start, end } = fetchInfo;
          const response = await getApplicationsCalendar({
            start: start.toISOString(),
            end: end.toISOString(),
            status: statusFilter !== "all" ? statusFilter : undefined,
            followup: followUpFilter !== "all" ? followUpFilter : undefined,
            doctorEmail: doctorFilter !== "all" ? doctorFilter : undefined
          });

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
                  app.doctorName?.[lang] || app.doctorName?.en || app.doctor?.email || t("unknown_doctor"),
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
          console.error("Error fetching events:", error);
          failureCallback(error);
        }
      },
      eventContent: renderEventContent,
      eventClick: handleEventClick,
      eventMouseEnter: handleEventMouseEnter,
      eventMouseLeave: handleEventMouseLeave,
      height: "auto",
      dayMaxEvents: 3,
      moreLinkClick: "popover",
    }),
    [
      statusFilter,
      followUpFilter,
      doctorFilter,
      renderEventContent,
      handleEventClick,
      handleEventMouseEnter,
      handleEventMouseLeave,
    ]
  );

  if (isLoading) {
    return (
      <div className="calendar-loading">
        <div className="loading-spinner"></div>
        <p>Loading your appointments...</p>
      </div>
    );
  }

  return (
    <div className="calendar-page">
      <div className="calendar-header">
        <div className="header-content">
          <div className="calendar-title-section">
            <h1 className="calendar-page-title">Calendar</h1>
            <p className="page-subtitle">
              Manage your appointments and schedule
            </p>
          </div>

          <div className="header-actions">
            {/* Filter by Doctor */}
            <div className="filters-row">
              <div className="filter-item">
                <label>Docotor</label>
                <select
                  value={doctorFilter}
                  onChange={(e) => setDoctorFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All Doctors</option>
                  {doctors.map((doc) => (
                    <option key={doc.email} value={doc.email}>
                      {doc.firstName?.[lang] || doc.firstName?.en} {doc.lastName?.[lang] || doc.lastName?.en}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-item">
                <label>Follow-Up</label>
                <select
                  value={followUpFilter}
                  onChange={(e) => setFollowUpFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All</option>
                  <option value="true">Follow-Ups Only</option>
                  <option value="false">Regular Appointments</option>
                </select>
              </div>

              <div className="filter-item">
                <label>Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Unconfirmed">Unconfirmed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <div className="filter-item">
                <label>From</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>

              <div className="filter-item">
                <label>To</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>

              <button
                className="apply-filters-btn"
                onClick={handleApplyFilters}
              >
                Apply
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

      <div className="calendar-container">
        <FullCalendar {...calendarProps} />
      </div>

      {hoveredEvent && (
        <EventTooltip
          event={hoveredEvent}
          position={tooltipPosition}
          onClose={handleEventMouseLeave}
        />
      )}
    </div>
  );
};

export default React.memo(Calendar);
