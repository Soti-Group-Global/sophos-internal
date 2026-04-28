import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  Users,
  ChevronLeft,
  ChevronRight,
  X,
  MapPin,
  Filter,
} from "lucide-react";
import "../styles/ScheduleManagement.css";
import {
  getEmployeeAvailability,
  getDoctorAppointmentsByDate,
} from "../utils/api";
import AssistantDetailsModal from "./AssistantDetailsModal";
import Schedule from "./Schedule";
import HeadAssistantSchedule from "./HeadAssistantSchedule";
import { useTranslation } from "react-i18next";
import { useBranch } from "../context/BranchContext";

const ScheduleManagement = () => {
  const { t } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState("weekly");
  const [employees, setEmployees] = useState([]);
  const [selectedShift, setSelectedShift] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState("all");
  const [selectedAssistant, setSelectedAssistant] = useState(null);
  const [selectedDoctorEmail, setSelectedDoctorEmail] = useState(null);
  const [selectedHeadAssistantEmail, setSelectedHeadAssistantEmail] = useState(null);
  const { selectedBranch } = useBranch();

  const colorPalette = [
    { primary: "#3B82F6", light: "#60A5FA" },
    { primary: "#10B981", light: "#34D399" },
    { primary: "#F59E0B", light: "#FBBF24" },
    { primary: "#EF4444", light: "#F87171" },
    { primary: "#8B5CF6", light: "#A78BFA" },
    { primary: "#06B6D4", light: "#22D3EE" },
    { primary: "#F97316", light: "#FB923C" },
    { primary: "#84CC16", light: "#A3E635" },
    { primary: "#EC4899", light: "#F472B6" },
    { primary: "#14B8A6", light: "#2DD4BF" },
  ];

  const roleColors = {
    doctor: { primary: "#3B82F6", light: "#60A5FA" },
    manager: { primary: "#10B981", light: "#34D399" },
    headAssistant: { primary: "#F59E0B", light: "#FBBF24" },
  };

  const getWeekRange = (date) => {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
  };

const handleSeeSelectedShift = async (shiftData) => {
    setSelectedShift(shiftData);
    setAppointments([]);
    setLoadingAppointments(true);

    try {
      const params = {
        branch: selectedBranch !== "All" ? selectedBranch : undefined,
      };

      const response = await getDoctorAppointmentsByDate(
        shiftData.employee.email,
        shiftData.date,
        params
      );

      setAppointments(response.data || []);
    } catch (error) {
    } finally {
      setLoadingAppointments(false);
    }
  };


  // Split a single shift into hourly sub-slots
  const splitShiftIntoHours = (shift) => {
    const slots = [];
    const startTime = new Date(`2000-01-01T${shift.start}`);
    const endTime = new Date(`2000-01-01T${shift.end}`);

    let current = new Date(startTime);
    while (current < endTime) {
      const next = new Date(current);
      next.setHours(current.getHours() + 1);

      // Stop if next exceeds the shift end
      if (next > endTime) next.setTime(endTime.getTime());

      const startFormatted = current.toTimeString().slice(0, 5);
      const endFormatted = next.toTimeString().slice(0, 5);

      slots.push({
        id: `${shift.id}-${startFormatted}`,
        date: shift.date,
        start: startFormatted,
        end: endFormatted,
        type: shift.type,
        location: shift.location,
      });

      current = next;
    }
    return slots;
  };



useEffect(() => {
  const fetchAvailability = async () => {
    try {
      setIsLoading(true);

      const { start, end } = getWeekRange(currentDate);

      //  Build params cleanly
      const params = {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        ...(selectedBranch && selectedBranch !== "All" && { branch: selectedBranch }),
      };

      // API call (api.js should define axios.get("/api/employees/availability", { params }))
      const response = await getEmployeeAvailability(params);
      const data = response?.data || [];

      // Group employees by email
      const grouped = data.reduce((acc, curr, index) => {
        if (!acc[curr.email]) {
          const fullName = [curr.firstName, curr.middleName, curr.lastName]
            .filter(Boolean)
            .join(" ")
            .trim();

          acc[curr.email] = {
            id: curr.email,
            name: fullName || curr.email.split("@")[0],
            position: curr.role
              ? curr.role.charAt(0).toUpperCase() + curr.role.slice(1)
              : "Unknown",
            avatar: fullName
              ? fullName
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()
              : curr.email.slice(0, 2).toUpperCase(),
            email: curr.email,
            color:
              roleColors[curr.role] || {
                primary: "#8B5CF6",
                light: "#A78BFA",
              },
            shifts: [],
          };
        }

        const startDate = new Date(curr.start);
        const endDate = new Date(curr.end);

        const uniqueKey = `${curr.email}-${startDate.toISOString()}-${endDate.toISOString()}-${curr._id || curr.status}-${index}`;

        acc[curr.email].shifts.push({
          id: uniqueKey,
          date: startDate.toISOString().split("T")[0],
          start: startDate.toISOString().split("T")[1].slice(0, 5),
          end: endDate.toISOString().split("T")[1].slice(0, 5),
          type: curr.status || "Unavailable",
          location: curr.notes || t("na"),
        });

        return acc;
      }, {});

      const allEmployees = Object.values(grouped);

      setEmployees(allEmployees);
      setFilteredEmployees(allEmployees);
    } catch (error) {
      setEmployees([]);
      setFilteredEmployees([]);
    } finally {
      setIsLoading(false);
    }
  };

  fetchAvailability();
}, [currentDate, selectedBranch, t]);

  useEffect(() => {
    if (selectedRoleFilter === "all") {
      setFilteredEmployees(employees);
    } else {
      setFilteredEmployees(
        employees.filter((emp) =>
          emp.position.toLowerCase().includes(selectedRoleFilter)
        )
      );
    }
  }, [selectedRoleFilter, employees]);

  const getFormattedDate = (daysFromToday) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromToday);
    return date.toISOString().split("T")[0];
  };

  const goToPrevious = () => {
    const newDate = new Date(currentDate);
    if (view === "weekly") {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentDate);
    if (view === "weekly") {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getWeekDates = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      weekDates.push(date);
    }
    return weekDates;
  };

  const formatTime = (timeString) => {
    const [hours, minutes] = timeString.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getShiftsForDate = (employee, date) => {
    const dateString = date.toISOString().split("T")[0];
    return employee.shifts.filter((shift) => shift.date === dateString);
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Get translated day name
  const getTranslatedDayName = (date) => {
    const dayIndex = date.getDay();
    const days = [
      t("scheduleManagement.days.sunday"),
      t("scheduleManagement.days.monday"),
      t("scheduleManagement.days.tuesday"),
      t("scheduleManagement.days.wednesday"),
      t("scheduleManagement.days.thursday"),
      t("scheduleManagement.days.friday"),
      t("scheduleManagement.days.saturday"),
    ];
    return days[dayIndex];
  };

  // Get translated month name
  const getTranslatedMonthName = (date) => {
    const monthIndex = date.getMonth();
    const months = [
      t("scheduleManagement.months.january"),
      t("scheduleManagement.months.february"),
      t("scheduleManagement.months.march"),
      t("scheduleManagement.months.april"),
      t("scheduleManagement.months.may"),
      t("scheduleManagement.months.june"),
      t("scheduleManagement.months.july"),
      t("scheduleManagement.months.august"),
      t("scheduleManagement.months.september"),
      t("scheduleManagement.months.october"),
      t("scheduleManagement.months.november"),
      t("scheduleManagement.months.december"),
    ];
    return months[monthIndex];
  };

  useEffect(() => {
    const wrapper = document.querySelector(".daily-scroll-wrapper");
    const header = document.querySelector(".daily-view-header");

    if (wrapper && header) {
      wrapper.addEventListener("scroll", () => {
        header.scrollLeft = wrapper.scrollLeft;
      });
    }
  }, []);

  const renderWeeklyView = () => {
    const weekDates = getWeekDates();

    return (
      <div className="weekly-view">
        <div className="schedule-calendar-header">
          <div className="employee-header">
            <Users size={16} />
            <span>{t("scheduleManagement.headers.team")}</span>
          </div>
          {weekDates.map((date, index) => (
            <div
              key={index}
              className={`day-header ${isToday(date) ? "today" : ""}`}
            >
              <div className="day-name">{getTranslatedDayName(date)}</div>
              <div className="date-number">{date.getDate()}</div>
              <div className="month-name">{getTranslatedMonthName(date)}</div>
            </div>
          ))}
        </div>

        <div className="calendar-body">
          {filteredEmployees.map((employee) => (
            <div key={employee.id} className="employee-row">
              <div className="employee-info">
                <div
                  className="employee-avatar"
                  style={{ backgroundColor: employee.color.primary }}
                >
                  {employee.avatar}
                </div>
                <div className="employee-details">
                  <div className="employee-name">{employee.name}</div>
                  <div className="employee-position">{employee.position}</div>
                </div>
              </div>
              {weekDates.map((date, dayIndex) => {
                const shifts = getShiftsForDate(employee, date);
                return (
                  <div
                    key={dayIndex}
                    className={`day-cell ${isToday(date) ? "today" : ""}`}
                  >
                    {shifts.map((shift) => (
                      <div
                        key={shift.id}
                        className="shift-card hover-bubble-container"
                        style={{
                          background: `linear-gradient(135deg, ${employee.color.primary}20, ${employee.color.light}20)`,
                          borderLeft: `4px solid ${employee.color.primary}`,
                        }}
                      >
                        <div className="shift-time">
                          <Clock size={12} />
                          {formatTime(shift.start)} - {formatTime(shift.end)}
                        </div>
                        <div className="shift-type">{shift.type}</div>
                        <div className="shift-location">
                          <MapPin size={10} />
                          {shift.location}
                        </div>

                        {/* Hover bubble */}
                        <div className="hover-bubble">
                          {["doctor", "headdoctor", "head doctor"].includes(
                            employee.position.replace(/\s+/g, "").toLowerCase()
                          ) ? (
                            <button
                              className="bubble-btn primary"
                              onClick={() =>
                                setSelectedDoctorEmail(employee.email)
                              }
                            >
                              {t("scheduleManagement.buttons.seeFullSchedule")}
                            </button>
                          ) : [
                              "assistant",
                              "headassistant",
                              "head assistant",
                            ].includes(
                              employee.position
                                .replace(/\s+/g, "")
                                .toLowerCase()
                            ) ? (
                            <button
                              className="bubble-btn primary"
                              onClick={() =>
                                setSelectedHeadAssistantEmail(employee.email)
                              }
                            >
                              {t("scheduleManagement.buttons.seeFullSchedule")}
                            </button>
                          ) : null}

                          {["doctor", "headdoctor", "head doctor"].includes(
                            employee.position.replace(/\s+/g, "").toLowerCase()
                          ) ? (
                            <button
                              className="bubble-btn secondary"
                              onClick={() =>
                                handleSeeSelectedShift({
                                  ...shift,
                                  employee,
                                })
                              }
                            >
                              {t(
                                "scheduleManagement.buttons.seeSelectedSchedule"
                              )}
                            </button>
                          ) : ["assistant"].includes(
                              employee.position
                                .replace(/\s+/g, "")
                                .toLowerCase()
                            ) ? (
                            <button
                              className="bubble-btn secondary"
                              onClick={() => setSelectedAssistant(employee)}
                            >
                              {t("scheduleManagement.buttons.seeAccess")}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                    {shifts.length === 0 && (
                      <div className="no-shift">
                        {t("scheduleManagement.shift.noShift")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDailyView = () => {
    const timeSlots = [];
    for (let hour = 9; hour <= 21; hour++) {
      timeSlots.push(`${hour.toString().padStart(2, "0")}:00`);
    }

    return (
      <div className="daily-view-container">
        <div className="daily-scroll-wrapper">
          <div className="daily-view-header">
            <div className="time-column-header">
              <Clock size={16} />
              <span>{t("scheduleManagement.headers.time")}</span>
            </div>
            <div className="employees-header-row">
              {filteredEmployees.map((employee) => (
                <div key={employee.id} className="employee-column-header">
                  <div
                    className="employee-avatar-small"
                    style={{ backgroundColor: employee.color.primary }}
                  >
                    {employee.avatar}
                  </div>
                  <div className="employee-details-small">
                    <div className="employee-name">{employee.name}</div>
                    <div className="employee-position">{employee.position}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="daily-view-body">
            <div className="time-slots-column">
              {timeSlots.map((time) => (
                <div key={time} className="time-slot">
                  <div className="time-marker"></div>
                  <span>{formatTime(time)}</span>
                </div>
              ))}
            </div>
            <div className="schedule-employees-grid">
              {employees.map((employee) => (
                <div key={employee.id} className="employee-column">
                  {timeSlots.map((time, index) => {
                    const shifts = getShiftsForDate(employee, currentDate);
                    const currentShift = shifts.find((shift) => {
                      const shiftStart = parseInt(shift.start.split(":")[0]);
                      const shiftEnd = parseInt(shift.end.split(":")[0]);
                      const currentHour = parseInt(time.split(":")[0]);
                      return (
                        currentHour >= shiftStart && currentHour < shiftEnd
                      );
                    });

                    return (
                      <div
                        key={index}
                        className="time-cell"
                        style={{
                          background: currentShift
                            ? `linear-gradient(135deg, ${employee.color.primary}15, ${employee.color.light}15)`
                            : "transparent",
                        }}
                      >
                        {currentShift &&
                          parseInt(time.split(":")[0]) ===
                            parseInt(currentShift.start.split(":")[0]) && (
                            <div
                              key={currentShift.id}
                              className="shift-card hover-bubble-container"
                              style={{
                                background: `linear-gradient(135deg, ${employee.color.primary}20, ${employee.color.light}20)`,
                                borderLeft: `4px solid ${employee.color.primary}`,
                              }}
                            >
                              <div className="shift-time">
                                <Clock size={12} />
                                {formatTime(currentShift.start)} -{" "}
                                {formatTime(currentShift.end)}
                              </div>
                              <div className="shift-type">
                                {currentShift.type}
                              </div>
                              <div className="shift-location">
                                <MapPin size={10} />
                                {currentShift.location}
                              </div>

                              <div className="hover-bubble">
                                {[
                                  "doctor",
                                  "headdoctor",
                                  "head doctor",
                                ].includes(
                                  employee.position
                                    .replace(/\s+/g, "")
                                    .toLowerCase()
                                ) ? (
                                  <button
                                    className="bubble-btn primary"
                                    onClick={() =>
                                      setSelectedDoctorEmail(employee.email)
                                    }
                                  >
                                    {t(
                                      "scheduleManagement.buttons.seeFullSchedule"
                                    )}
                                  </button>
                                ) : [
                                    "assistant",
                                    "headassistant",
                                    "head assistant",
                                  ].includes(
                                    employee.position
                                      .replace(/\s+/g, "")
                                      .toLowerCase()
                                  ) ? (
                                  <button
                                    className="bubble-btn primary"
                                    onClick={() =>
                                      setSelectedHeadAssistantEmail(
                                        employee.email
                                      )
                                    }
                                  >
                                    {t(
                                      "scheduleManagement.buttons.seeFullSchedule"
                                    )}
                                  </button>
                                ) : null}

                                {[
                                  "doctor",
                                  "headdoctor",
                                  "head doctor",
                                ].includes(
                                  employee.position
                                    .replace(/\s+/g, "")
                                    .toLowerCase()
                                ) ? (
                                  <button
                                    className="bubble-btn secondary"
                                    onClick={() =>
                                      handleSeeSelectedShift({
                                        ...shift,
                                        employee,
                                      })
                                    }
                                  >
                                    {t(
                                      "scheduleManagement.buttons.seeSelectedSchedule"
                                    )}
                                  </button>
                                ) : ["assistant"].includes(
                                    employee.position
                                      .replace(/\s+/g, "")
                                      .toLowerCase()
                                  ) ? (
                                  <button
                                    className="bubble-btn secondary"
                                    onClick={() =>
                                      setSelectedAssistant(employee)
                                    }
                                  >
                                    {t("scheduleManagement.buttons.seeAccess")}
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {employees.length > 6 && (
          <div className="scroll-indicator">
            <span>{t("scheduleManagement.scrollIndicator")}</span>
          </div>
        )}
      </div>
    );
  };

  const renderSkeleton = () => {
    return (
      <div className="skeleton-container">
        <div className="skeleton-header">
          <div className="skeleton-button-group">
            <div className="skeleton-button"></div>
            <div className="skeleton-button"></div>
          </div>
          <div className="skeleton-nav">
            <div className="skeleton-button"></div>
            <div className="skeleton-button"></div>
            <div className="skeleton-button"></div>
          </div>
          <div className="skeleton-title"></div>
        </div>
        <div className="skeleton-content">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton-row">
              <div className="skeleton-avatar"></div>
              <div className="skeleton-details">
                <div className="skeleton-line"></div>
                <div className="skeleton-line short"></div>
              </div>
              {[...Array(7)].map((_, j) => (
                <div key={j} className="skeleton-cell"></div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  /* Utility function for time overlap checking */
  const timeOverlaps = (apptStart, apptEnd, slotStart, slotEnd, date) => {
    try {
      const apptStartTime = new Date(apptStart);
      const apptEndTime = new Date(apptEnd);

      // Ensure both use the same date base (selectedShift.date)
      const baseDate = date ? new Date(date) : new Date();

      const slotStartTime = new Date(
        `${baseDate.toISOString().split("T")[0]}T${slotStart}`
      );
      const slotEndTime = new Date(
        `${baseDate.toISOString().split("T")[0]}T${slotEnd}`
      );

      return apptStartTime < slotEndTime && apptEndTime > slotStartTime;
    } catch (err) {
      return false;
    }
  };

  return (
    <div className="employee-schedule-modern">
      <div className="schedule-header-modern">
        <div className="header-left">
          <h1 className="app-title">{t("scheduleManagement.title")}</h1>
        </div>

        <div className="header-center">
          <div className="date-navigation-modern">
            <button className="nav-btn-modern" onClick={goToPrevious}>
              <ChevronLeft size={20} />
            </button>
            <button className="today-btn-modern" onClick={goToToday}>
              {t("scheduleManagement.buttons.today")}
            </button>
            <button className="nav-btn-modern" onClick={goToNext}>
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="current-period-modern">
            {view === "weekly"
              ? `Week of ${getWeekDates()[0].toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })} - ${getWeekDates()[6].toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}`
              : currentDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
          </div>
        </div>
        <div className="view-controls-modern">
          <button
            className={`view-btn-modern ${view === "weekly" ? "active" : ""}`}
            onClick={() => setView("weekly")}
          >
            <Calendar size={18} />
            {t("scheduleManagement.views.weekly")}
          </button>
          <button
            className={`view-btn-modern ${view === "daily" ? "active" : ""}`}
            onClick={() => setView("daily")}
          >
            <Clock size={18} />
            {t("scheduleManagement.views.daily")}
          </button>
        </div>
        <div className="employee-filter">
          <Filter size={16} />
          <select
            className="employee-filter-select"
            value={selectedRoleFilter}
            onChange={(e) => setSelectedRoleFilter(e.target.value)}
          >
            <option value="all">
              {t("scheduleManagement.filters.allEmployees")}
            </option>
            <option value="doctor">
              {t("scheduleManagement.filters.doctors")}
            </option>
            <option value="head doctor">
              {t("scheduleManagement.filters.headDoctors")}
            </option>
            <option value="assistant">
              {t("scheduleManagement.filters.assistants")}
            </option>
            <option value="head assistant">
              {t("scheduleManagement.filters.headAssistants")}
            </option>
            <option value="manager">
              {t("scheduleManagement.filters.managers")}
            </option>
          </select>
        </div>
      </div>

      <div className="schedule-content-modern">
        {isLoading
          ? renderSkeleton()
          : view === "weekly"
          ? renderWeeklyView(filteredEmployees)
          : renderDailyView(filteredEmployees)}
      </div>

      {selectedShift && (
        <div className="modal-overlay" onClick={() => setSelectedShift(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="modal-header">
              <h2>
                {t("scheduleManagement.modal.shiftDetails")} –{" "}
                {selectedShift.employee.name}
              </h2>
              <button
                className="schedule-close-btn"
                onClick={() => setSelectedShift(null)}
              >
                <X size={20} />
              </button>
            </div>

            {/* Unified layout */}
            <div className="slots-table">
              <div className="table-header">
                <h3>{t("scheduleManagement.modal.timeSlots")}</h3>
                <h3>{t("scheduleManagement.modal.bookingInfo")}</h3>
              </div>

              {splitShiftIntoHours(selectedShift).map((slot, idx) => {
                const bookedAppt = appointments.find((appt) =>
                  timeOverlaps(
                    appt.startTime,
                    appt.endTime,
                    slot.start,
                    slot.end,
                    selectedShift.date
                  )
                );

                const isBooked = !!bookedAppt;

                return (
                  <div
                    key={idx}
                    className={`slot-row ${isBooked ? "booked" : "available"}`}
                  >
                    {/* Time Cell */}
                    <div className="slot-time">
                      {formatTime(slot.start)} – {formatTime(slot.end)}
                    </div>

                    {/* Status / Appointment Cell */}
                    <div className="slot-booking">
                      {isBooked ? (
                        <div className="booked-details">
                          <div className="booking-info">
                            <div className="patient-email">
                              {bookedAppt.applicationId}
                            </div>
                            <div className="patient-email">
                              {bookedAppt.patientDetails
                                ? `${
                                    bookedAppt.patientDetails.firstName || ""
                                  } ${
                                    bookedAppt.patientDetails.middleName || ""
                                  } ${
                                    bookedAppt.patientDetails.lastName || ""
                                  }`.trim()
                                : bookedAppt.patientEmail.split("@")[0]}
                            </div>

                            <div className="booking-time">
                              {new Date(
                                bookedAppt.startTime
                              ).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}{" "}
                              –{" "}
                              {new Date(bookedAppt.endTime).toLocaleTimeString(
                                [],
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </div>
                          </div>
                          <div
                            className={`status-tag ${bookedAppt.appointmentStatus.toLowerCase()}`}
                          >
                            {bookedAppt.appointmentStatus}
                          </div>
                          <button className="details-btn">
                            {t("scheduleManagement.modal.seeDetails")}
                          </button>
                        </div>
                      ) : (
                        <div className="available-cell">
                          <span className="available-badge">
                            {t("scheduleManagement.status.available")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {selectedAssistant && (
        <AssistantDetailsModal
          assistant={selectedAssistant}
          isOpen={!!selectedAssistant}
          onClose={() => setSelectedAssistant(null)}
        />
      )}

      {selectedDoctorEmail && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedDoctorEmail(null)}
        >
          <div
            className="modal-container large"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>{t("scheduleManagement.modal.fullSchedule")}</h2>
              <button
                className="schedule-close-btn"
                onClick={() => setSelectedDoctorEmail(null)}
              >
                <X size={20} />
              </button>
            </div>

            {/* Render your existing Schedule component, passing the email */}
            <div className="modal-body">
              <Schedule email={selectedDoctorEmail} />
            </div>
          </div>
        </div>
      )}

      {selectedHeadAssistantEmail && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedHeadAssistantEmail(null)}
        >
          <div
            className="modal-container large"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>{t("scheduleManagement.modal.headAssistantSchedule")}</h2>
              <button
                className="schedule-close-btn"
                onClick={() => setSelectedHeadAssistantEmail(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <HeadAssistantSchedule email={selectedHeadAssistantEmail} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleManagement;
