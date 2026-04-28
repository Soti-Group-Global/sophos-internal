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
import { getCalendarApplications } from "../utils/api";
import { FiChevronDown, FiCalendar, FiClock, FiUser } from "react-icons/fi";
import CustomCalendar from "../components/CustomeCalendar";
import "../styles/Calendar.css";
import { formatTimeHHMM } from "../utils/dateFormat";
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

  const formatTime = (dateString) => formatTimeHHMM(dateString);

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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [followUpFilter, setFollowUpFilter] = useState("all");
  const lastFetchedRangeRef = useRef({ start: null, end: null });
  const isProgrammaticNavigationRef = useRef(false);
  const calendarRef = useRef(null);
  const navigate = useNavigate();

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
        const response = await getCalendarApplications({
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          status: statusFilter !== "all" ? statusFilter : undefined,
          followup: followUpFilter !== "all" ? followUpFilter : undefined,
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


  const handleEventClick = useCallback(
    (info) => {
      const applicationId =
        info.event?.extendedProps?.serviceNo || info.event?.id;

      if (!applicationId) return;

      const path = `/appointments/${encodeURIComponent(applicationId)}`;
      if (info.jsEvent?.metaKey || info.jsEvent?.ctrlKey) {
        window.open(path, "_blank");
        return;
      }
      navigate(path, {
        state: { activeTab: "appointment", activeSubTab: "overview" },
      });
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
      const formatTime = (dateString) => formatTimeHHMM(dateString);

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
      events: async (fetchInfo, successCallback, failureCallback) => {
        try {
          const { start, end } = fetchInfo;
          const response = await getCalendarApplications({
            start: start.toISOString(),
            end: end.toISOString(),
            status: statusFilter !== "all" ? statusFilter : undefined,
            followup: followUpFilter !== "all" ? followUpFilter : undefined,
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

          <div className="calendar-legend">
            <div className="legend-item">
              <span className="legend-color legend-confirmed"></span>
              Confirmed
            </div>
            <div className="legend-item">
              <span className="legend-color legend-pending"></span>
              Pending / Unconfirmed
            </div>
            <div className="legend-item">
              <span className="legend-color legend-cancelled"></span>
              Cancelled
            </div>
            <div className="legend-item">
              <span className="legend-color legend-followup"></span>
              Follow-Up
            </div>
          </div>


          <div className="header-actions">
            <div className="filters-row">
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
                  <option value="confirmed">Confirmed</option>
                  <option value="pending">Pending</option>
                  <option value="unconfirmed">Unconfirmed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="filter-item">
                <label>From</label>
                <CustomCalendar
                  value={fromDate ? new Date(fromDate) : null}
                  onChange={(date) => setFromDate(date ? date.toISOString().slice(0, 10) : "")}
                />
              </div>

              <div className="filter-item">
                <label>To</label>
                <CustomCalendar
                  value={toDate ? new Date(toDate) : null}
                  onChange={(date) => setToDate(date ? date.toISOString().slice(0, 10) : "")}
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
