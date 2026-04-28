import React, { useEffect, useState, useCallback } from "react";
import {
  getAppointmentsByDoctor,
  getEmailFromToken,
  getDoctors,
} from "../utils/api";
import "../styles/Appointments.css";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer, toast } from "react-toastify";
import { FiSearch, FiCalendar, FiClock, FiDownload, FiChevronLeft, FiChevronRight, FiUser, FiList } from "react-icons/fi";
import AppointmentsCalendarView from "../components/AppointmentsCalendarView";

const Appointments = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState("all");
  const [view, setView] = useState("calendar"); // "table" | "calendar"

  const navigate = useNavigate();
  const recordsPerPage = 21;
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'ru' ? 'ru' : 'en';

  // Debounce search term
  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timerId);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDoctor]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, debouncedSearchTerm]);

  const assistantEmail = getEmailFromToken();

  const fetchAppointments = useCallback(async () => {
  if (!assistantEmail) {
    setError("Assistant not authenticated.");
    setLoading(false);
    return;
  }

  setLoading(true);
  try {
    const { appointments: data, totalCount } = await getAppointmentsByDoctor(
      assistantEmail,
      currentPage,
      recordsPerPage,
      filter,
      debouncedSearchTerm,
      selectedDoctor // Make sure this is passed here
    );

    if (!Array.isArray(data))
      throw new Error("Received invalid appointments data");


    setAppointments(data);
    setTotalRecords(totalCount);
  } catch (err) {
    setError(err.message || "Failed to load appointments");
  } finally {
    setLoading(false);
  }
}, [currentPage, filter, debouncedSearchTerm, selectedDoctor]);


  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "Invalid date";
    }
  };

  // Handles both "09:00" plain strings and full ISO/Date timestamps
  const formatTime = (value) => {
    if (!value) return "—";
    // Already a plain HH:mm string
    if (/^\d{1,2}:\d{2}$/.test(String(value).trim())) return value;
    // Full date string — extract HH:mm in Moscow time
    const d = new Date(value);
    if (isNaN(d)) return value;
    return d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Moscow",
    });
  };

  const getInitials = (name) => {
    if (!name || name === "N/A") return "?";
    const clean = name.replace(/\(.*?\)/g, "").trim();
    return clean.split(" ").filter(Boolean).map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const StatusBadge = ({ status }) => {
    const config = {
      confirmed:   { dot: "#00C853", bg: "#e8f5e9", color: "#1b5e20" },
      completed:   { dot: "#3b82f6", bg: "#eff6ff", color: "#1e40af" },
      cancelled:   { dot: "#FF1744", bg: "#fce4ec", color: "#b71c1c" },
      upcoming:    { dot: "#FFD600", bg: "#fffde7", color: "#f57f17" },
      unconfirmed: { dot: "#FF9800", bg: "#fff3e0", color: "#e65100" },
    }[status?.toLowerCase()] || { dot: "#9ca3af", bg: "#f9fafb", color: "#6b7280" };
    return (
      <span className="appt-status-badge" style={{ background: config.bg, color: config.color }}>
        <span className="appt-status-dot" style={{ background: config.dot }} />
        {t(`application.status.${status?.toLowerCase()}`, { defaultValue: status }) || t("appointments.unknown")}
      </span>
    );
  };

  const getPatientName = (appt) => {
    if (appt.patientName) return appt.patientName;
    if (appt.patientDetails?.firstName) {
      return `${appt.patientDetails.firstName} ${appt.patientDetails.lastName}`;
    }
    return appt.patient || "Unknown Patient";
  };

  const totalPages = Math.ceil(totalRecords / recordsPerPage);

  const paginate = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const res = await getDoctors(assistantEmail); // res = { doctors: [...] }
        setDoctors(res?.doctors || []);
      } catch (err) {
        console.error("Failed to fetch doctors:", err);
      }
    };

    fetchDoctors();
  }, []);


    const formatDateTimeForCSV = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return "Invalid date";
    }
  };


   // Function to export appointments data as CSV
  const exportToCSV = () => {
    if (appointments.length === 0) {
      toast.info(t("appointments.noDataToExport"));
      return;
    }
    
    // Prepare CSV content
    const headers = [
      t("appointments.csv.id"),
      t("appointments.csv.patientName"),
      t("appointments.csv.patientEmail"),
      t("appointments.csv.serviceType"),
      t("appointments.csv.date"),
      t("appointments.csv.startTime"),
      t("appointments.csv.endTime"),
      t("appointments.csv.status"),
      t("appointments.csv.createdAt"),
    ];
    
    const rows = appointments.map(appt => [
      appt.applicationId || appt._id || "N/A",
      getPatientName(appt),
      appt.patientEmail || "No email",
      appt.serviceType || "Not specified",
      formatDate(appt.date),
      appt.startTime ? formatDateTimeForCSV(appt.startTime) : "N/A",
      appt.endTime ? formatDateTimeForCSV(appt.endTime) : "N/A",
      appt.appointmentStatus || "Unknown",
      appt.createdAt ? formatDateTimeForCSV(appt.createdAt) : "N/A",
    ]);
    
    // Create CSV content
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    
    // Create download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `appointments_export_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(t("appointments.exportSuccess"));
  };

  return (
    <div className={`appt-page${view === "calendar" ? " appt-page--calendar" : ""}`}>
      <ToastContainer position="top-right" autoClose={3000} />

      {/* â”€â”€ Header â”€â”€ */}
      <div className="appt-header">
        <div className="appt-header-left">
          <h1 className="appt-title">{t("appointments.title")}</h1>
          {totalRecords > 0 && <span className="appt-total-pill">{totalRecords}</span>}
        </div>
        <div className="appt-header-right">
          <div className="appt-search-box">
            <FiSearch className="appt-search-icon" size={15} />
            <input
              type="text"
              className="appt-search-input"
              placeholder={t("appointments.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="appt-doctor-select"
            value={selectedDoctor}
            onChange={(e) => setSelectedDoctor(e.target.value)}
          >
            <option value="all">{t("appointments.allDoctors")}</option>
            {doctors.map((doc) => (
              <option key={doc.email} value={doc.email}>
                {doc.firstName?.[lang] || doc.firstName?.en} {doc.lastName?.[lang] || doc.lastName?.en}
              </option>
            ))}
          </select>
          {appointments.length > 0 && (
            <button className="appt-export-btn" onClick={exportToCSV}>
              <FiDownload size={14} />
              <span className="appt-export-label">{t("appointments.exportCSV")}</span>
            </button>
          )}
          {/* View toggle */}
          <div className="appt-view-toggle">
            <button
              className={`appt-view-btn ${view === "table" ? "active" : ""}`}
              onClick={() => setView("table")}
              title={t("appointments.tableView")}
            >
              <FiList size={16} />
            </button>
            <button
              className={`appt-view-btn ${view === "calendar" ? "active" : ""}`}
              onClick={() => setView("calendar")}
              title={t("appointments.calendarView")}
            >
              <FiCalendar size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Calendar view ── */}
      {view === "calendar" && <AppointmentsCalendarView />}

      {/* ── Table view ── */}
      {view === "table" && (
        <>
      {/* Filter tabs */}
      <div className="appt-filter-tabs">
        {["all", "upcoming", "confirmed", "completed", "cancelled"].map((f) => (
          <button
            key={f}
            className={`appt-tab ${filter === f ? "active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {t(`appointments.filters.${f}`)}
          </button>
        ))}
      </div>

      {/* â”€â”€ Loading â”€â”€ */}
      {loading && (
        <div className="appt-state">
          <div className="appt-spinner" />
          <p className="appt-state-text">{t("appointments.loading")}</p>
        </div>
      )}

      {/* â”€â”€ Error â”€â”€ */}
      {!loading && error && (
        <div className="appt-state">
          <p className="appt-error-msg">{error}</p>
          <button className="appt-action-btn" onClick={fetchAppointments}>
            {t("appointments.retry")}
          </button>
        </div>
      )}

      {/* â”€â”€ Empty â”€â”€ */}
      {!loading && !error && appointments.length === 0 && (
        <div className="appt-state">
          <div className="appt-empty-icon"><FiCalendar size={36} /></div>
          <p className="appt-state-title">{t("appointments.noResults")}</p>
          <button className="appt-action-btn" onClick={() => { setSearchTerm(""); setFilter("all"); }}>
            {t("appointments.clearFilters")}
          </button>
        </div>
      )}

      {/* â”€â”€ Table â”€â”€ */}
      {!loading && !error && appointments.length > 0 && (
        <>
          <div className="appt-table-wrap">
            <table className="appt-table">
              <thead>
                <tr>
                  <th>{t("appointments.columns.appointment")}</th>
                  <th>{t("appointments.columns.patient")}</th>
                  <th>{t("appointments.columns.dateTime")}</th>
                  <th>{t("appointments.columns.doctorService")}</th>
                  <th>{t("appointments.columns.status")}</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appt) => {
                  const patientName = [
                    appt.patientDetails?.firstName,
                    appt.patientDetails?.middleName,
                    appt.patientDetails?.lastName,
                  ].filter(Boolean).join(" ") || "N/A";

                  const doctorName = [
                    appt.doctorDetails?.firstName?.[lang] || appt.doctorDetails?.firstName?.en,
                    appt.doctorDetails?.middleName?.[lang] || appt.doctorDetails?.middleName?.en,
                    appt.doctorDetails?.lastName?.[lang] || appt.doctorDetails?.lastName?.en,
                  ].filter(Boolean).join(" ") || appt.doctors?.[0]?.doctorName || "N/A";

                  return (
                    <tr
                      key={appt._id || appt.id}
                      className="appt-row"
                      onClick={() =>
                        navigate(
                          `/appointments/${encodeURIComponent(appt.applicationId || appt._id)}`,
                          {
                            state: {
                              doctorName: {
                                en: [appt.doctorDetails?.firstName?.en, appt.doctorDetails?.middleName?.en, appt.doctorDetails?.lastName?.en].filter(Boolean).join(" "),
                                ru: [appt.doctorDetails?.firstName?.ru, appt.doctorDetails?.middleName?.ru, appt.doctorDetails?.lastName?.ru].filter(Boolean).join(" "),
                              },
                            },
                          }
                        )
                      }
                    >
                      {/* Appointment ID */}
                      <td>
                        <span className="appt-cell-id">
                          #{appt.applicationId || appt._id || "N/A"}
                        </span>
                      </td>

                      {/* Patient */}
                      <td>
                        <div className="appt-person-cell">
                          <div className="appt-avatar appt-avatar--patient">
                            {getInitials(patientName)}
                          </div>
                          <div>
                            <div className="appt-person-name">{patientName}</div>
                            <div className="appt-person-sub">{appt.patientEmail || ""}</div>
                          </div>
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td>
                        <div className="appt-datetime-cell">
                          <div className="appt-date-row">
                            <FiCalendar size={12} />
                            {formatDate(appt.date)}
                          </div>
                          <div className="appt-time-row">
                            <FiClock size={12} />
                            {formatTime(appt.startTime)} – {formatTime(appt.endTime)} MSK
                          </div>
                        </div>
                      </td>

                      {/* Doctor & Service */}
                      <td>
                        <div className="appt-doctor-cell">
                          <div className="appt-person-cell">
                            <div className="appt-avatar appt-avatar--doctor">
                              {getInitials(doctorName)}
                            </div>
                            <div>
                              <div className="appt-person-name">{doctorName}</div>
                              {appt.serviceType && (
                                <span className="appt-service-tag">{t(`application.service_type.${appt.serviceType.toLowerCase().replace(/\s+/g, "_")}`, { defaultValue: appt.serviceType })}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        <div className="appt-status-cell">
                          <StatusBadge status={appt.appointmentStatus} />
                          {appt.appointmentMode && (
                            <span className={`appt-mode-tag appt-mode-tag--${appt.appointmentMode?.toLowerCase().replace(/\s+/g, "-") ?? ""}`}>
                              {appt.appointmentMode}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Footer ── */}
          <div className="appt-footer">
            <span className="appt-results-count">
              {t("appointments.resultsCount", {
                from: (currentPage - 1) * recordsPerPage + 1,
                to: Math.min(currentPage * recordsPerPage, totalRecords),
                total: totalRecords,
              })}
            </span>
            {totalPages > 1 && (
              <div className="appt-pagination">
                <button
                  className="appt-page-btn"
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <FiChevronLeft size={15} />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = i + 1;
                  if (totalPages > 5) {
                    if (currentPage <= 3) pageNum = i + 1;
                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={`page-${pageNum}`}
                      className={`appt-page-btn ${currentPage === pageNum ? "active" : ""}`}
                      onClick={() => paginate(pageNum)}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  className="appt-page-btn"
                  onClick={() => paginate(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <FiChevronRight size={15} />
                </button>
              </div>
            )}
          </div>
        </>
      )}
        </>
      )}
    </div>
  );
};

export default Appointments;
