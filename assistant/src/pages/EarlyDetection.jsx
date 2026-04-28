import React, { useEffect, useState, useCallback, useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  FiSearch,
  FiCalendar,
  FiClock,
  FiDownload,
  FiChevronLeft,
  FiChevronRight,
  FiUser,
  FiList,
} from "react-icons/fi";
import { AuthContext } from "../context/AuthContext";
import {
  getEarlyDetectionBookingsByDoctor,
  getAssistantDoctors,
} from "../utils/api";
import EarlyDetectionCalendarView from "../components/EarlyDetectionCalendarView";
import "../styles/Appointments.css";
import "../styles/EarlyDetection.css";

const EarlyDetection = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "ru" ? "ru" : "en";

  const [view, setView] = useState("calendar"); // "table" | "calendar"
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState("all");

  const recordsPerPage = 21;

  const normalizeAccessStatus = (status) =>
    String(status || "")
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .trim();

  const isDoctorAccessAllowed = (status) => {
    if (!status) return true;
    const normalized = normalizeAccessStatus(status);
    return ["accepted", "access granted", "granted", "approved", "active"].includes(normalized);
  };

  const isDoctorAccessWithinWindow = (entry) => {
    const now = new Date();
    const start = entry?.startDateTime ? new Date(entry.startDateTime) : null;
    const end = entry?.endDateTime ? new Date(entry.endDateTime) : null;

    const startValid = !start || Number.isNaN(start.getTime()) || now >= start;
    const endValid = !end || Number.isNaN(end.getTime()) || now <= end;

    return startValid && endValid;
  };

  const dedupeDoctors = (items) => {
    const map = new Map();
    (Array.isArray(items) ? items : []).forEach((item) => {
      const email = String(item?.doctorEmail || item?.email || "").toLowerCase().trim();
      if (!email) return;
      if (!map.has(email)) map.set(email, item);
    });
    return [...map.values()];
  };

  // Debounce search term
  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timerId);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDoctor, filter, debouncedSearchTerm]);

  // Fetch doctors list
  useEffect(() => {
    const fetchDoctors = async () => {
      if (!user?.email) return;
      try {
        if (user.role === "assistant" || user.role === "head_assistant") {
          const res = await getAssistantDoctors(user.email);
          const list = dedupeDoctors(Array.isArray(res) ? res : []);
          const accessEntries = list.filter(
            (d) => isDoctorAccessAllowed(d?.status) && isDoctorAccessWithinWindow(d),
          );
          setDoctors(accessEntries);
          return;
        }

        setDoctors([]);
      } catch (err) {
        console.error("Failed to fetch doctors:", err);
      }
    };
    fetchDoctors();
  }, [user?.email, user?.role]);

  // Fetch bookings
  const fetchBookings = useCallback(async () => {
    console.log("[EarlyDetection] fetchBookings() started", {
      userEmail: user?.email,
      role: user?.role,
    });

    if (!user?.email) {
      setError(t("EarlyDetectionApplications.errorAuth", { defaultValue: "Not authenticated." }));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let emails = [];
      if (user.role === "assistant" || user.role === "head_assistant") {
        const res = await getAssistantDoctors(user.email);
        const list = dedupeDoctors(Array.isArray(res) ? res : []);
        const accessEntries = list.filter(
          (d) => isDoctorAccessAllowed(d?.status) && isDoctorAccessWithinWindow(d),
        );
        emails = [...new Set(accessEntries.map((d) => d.doctorEmail || d.email).filter(Boolean))];
        console.log("[EarlyDetection] assistant doctor access entries", {
          totalEntries: Array.isArray(res) ? res.length : 0,
          uniqueEntries: list.length,
          acceptedEntries: accessEntries.length,
          statuses: list.map((d) => d?.status),
          doctorEmails: emails,
        });
      } else {
        emails = [user.email];
        console.log("[EarlyDetection] non-assistant flow, using own email", {
          doctorEmails: emails,
        });
      }

      const all = [];
      for (const email of emails) {
        const res = await getEarlyDetectionBookingsByDoctor(email);
        console.log("[EarlyDetection] bookings API response", {
          email,
          count: Array.isArray(res?.data) ? res.data.length : 0,
        });
        all.push(...(res.data || []));
      }
      console.log("[EarlyDetection] combined bookings count", { total: all.length });
      setBookings(all);
    } catch (err) {
      console.error("[EarlyDetection] fetchBookings() failed", err);
      setError(err.message || t("EarlyDetectionApplications.errorLoad", { defaultValue: "Failed to load bookings" }));
    } finally {
      setLoading(false);
    }
  }, [user?.email, user?.role, t]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // ── Filter + Search ──
  const filteredBookings = useMemo(() => {
    let list = bookings;

    // Status filter
    if (filter !== "all") {
      list = list.filter(
        (b) => b.appointmentStatus?.toLowerCase() === filter
      );
    }

    // Doctor filter
    if (selectedDoctor !== "all") {
      list = list.filter(
        (b) => b.doctorEmail?.toLowerCase() === selectedDoctor.toLowerCase() ||
               (b.doctors || []).some((d) => d.toLowerCase() === selectedDoctor.toLowerCase())
      );
    }

    // Search
    if (debouncedSearchTerm) {
      const q = debouncedSearchTerm.toLowerCase();
      list = list.filter(
        (b) =>
          (b.patientName || "").toLowerCase().includes(q) ||
          (b.patientEmail || "").toLowerCase().includes(q) ||
          (b.serviceType || "").toLowerCase().includes(q) ||
          (b.applicationId || "").toLowerCase().includes(q) ||
          (b.invoiceNumber || "").toLowerCase().includes(q) ||
          (b.bookingNumber || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [bookings, filter, selectedDoctor, debouncedSearchTerm]);

  // ── Pagination ──
  const totalRecords = filteredBookings.length;
  const totalPages = Math.ceil(totalRecords / recordsPerPage);
  const paginatedBookings = useMemo(() => {
    const start = (currentPage - 1) * recordsPerPage;
    return filteredBookings.slice(start, start + recordsPerPage);
  }, [filteredBookings, currentPage]);

  const paginate = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  // ── Helpers ──
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString(
        lang === "ru" ? "ru-RU" : "en-US",
        { month: "long", day: "numeric", year: "numeric" }
      );
    } catch {
      return "Invalid date";
    }
  };

  const formatTime = (value) => {
    if (!value) return "—";
    if (/^\d{1,2}:\d{2}$/.test(String(value).trim())) return value;
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
    return clean.split(" ").filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const StatusBadge = ({ status }) => {
    const config = {
      confirmed:   { dot: "#00C853", bg: "#e8f5e9", color: "#1b5e20" },
      completed:   { dot: "#3b82f6", bg: "#eff6ff", color: "#1e40af" },
      cancelled:   { dot: "#FF1744", bg: "#fce4ec", color: "#b71c1c" },
      upcoming:    { dot: "#FFD600", bg: "#fffde7", color: "#f57f17" },
      pending:     { dot: "#FF9800", bg: "#fff3e0", color: "#e65100" },
      unconfirmed: { dot: "#FF9800", bg: "#fff3e0", color: "#e65100" },
    }[status?.toLowerCase()] || { dot: "#9ca3af", bg: "#f9fafb", color: "#6b7280" };
    return (
      <span className="appt-status-badge" style={{ background: config.bg, color: config.color }}>
        <span className="appt-status-dot" style={{ background: config.dot }} />
        {t(`application.status.${status?.toLowerCase()}`, { defaultValue: status }) || t("appointments.unknown")}
      </span>
    );
  };

  const formatDateTimeForCSV = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleString("en-US", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hour12: false,
      });
    } catch {
      return "Invalid date";
    }
  };

  // ── Export CSV ──
  const exportToCSV = () => {
    if (filteredBookings.length === 0) {
      toast.info(t("EarlyDetectionApplications.noDataToExport", { defaultValue: "No data to export" }));
      return;
    }

    const headers = [
      t("EarlyDetectionApplications.csv.id"),
      t("EarlyDetectionApplications.csv.patientName"),
      t("EarlyDetectionApplications.csv.patientEmail"),
      t("EarlyDetectionApplications.csv.serviceType"),
      t("EarlyDetectionApplications.csv.date"),
      t("EarlyDetectionApplications.csv.startTime"),
      t("EarlyDetectionApplications.csv.endTime"),
      t("EarlyDetectionApplications.csv.status"),
      t("EarlyDetectionApplications.csv.createdAt"),
    ];

    const rows = filteredBookings.map((b) => [
      b.applicationId || b._id || "N/A",
      b.patientName || "Unknown",
      b.patientEmail || "No email",
      b.serviceType || "Not specified",
      formatDate(b.date),
      b.startTime ? formatDateTimeForCSV(b.startTime) : "N/A",
      b.endTime ? formatDateTimeForCSV(b.endTime) : "N/A",
      b.appointmentStatus || "Unknown",
      b.createdAt ? formatDateTimeForCSV(b.createdAt) : "N/A",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `early_detection_export_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(t("EarlyDetectionApplications.exportSuccess", { defaultValue: "Exported successfully" }));
  };

  return (
    <div className={`appt-page${view === "calendar" ? " appt-page--calendar" : ""}`}>
      <ToastContainer position="top-right" autoClose={3000} />

      {/* ── Header ── */}
      <div className="appt-header">
        <div className="appt-header-left">
          <h1 className="appt-title">{t("EarlyDetectionApplications.header")}</h1>
          {totalRecords > 0 && <span className="appt-total-pill">{totalRecords}</span>}
        </div>
        <div className="appt-header-right">
          <div className="appt-search-box">
            <FiSearch className="appt-search-icon" size={15} />
            <input
              type="text"
              className="appt-search-input"
              placeholder={t("EarlyDetectionApplications.searchPlaceholder", { defaultValue: "Search by patient, service, or ID..." })}
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
            {doctors.map((doc, idx) => (
              <option key={`${doc.doctorEmail || doc.email}-${idx}`} value={doc.doctorEmail || doc.email}>
                {doc.name?.[lang] || doc.name?.en || doc.doctorEmail || doc.email}
              </option>
            ))}
          </select>
          {filteredBookings.length > 0 && (
            <button className="appt-export-btn" onClick={exportToCSV}>
              <FiDownload size={14} />
              <span className="appt-export-label">{t("EarlyDetectionApplications.exportCSV")}</span>
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
      {view === "calendar" && <EarlyDetectionCalendarView />}

      {/* ── Table view ── */}
      {view === "table" && (
        <>
          {/* Filter tabs */}
          <div className="appt-filter-tabs">
            {["all", "pending", "confirmed", "completed", "cancelled"].map((f) => (
              <button
                key={f}
                className={`appt-tab ${filter === f ? "active" : ""}`}
                onClick={() => setFilter(f)}
              >
                {t(`appointments.filters.${f}`, { defaultValue: f.charAt(0).toUpperCase() + f.slice(1) })}
              </button>
            ))}
          </div>

          {/* Loading */}
          {loading && (
            <div className="appt-state">
              <div className="appt-spinner" />
              <p className="appt-state-text">{t("EarlyDetectionApplications.loading")}</p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="appt-state">
              <p className="appt-error-msg">{error}</p>
              <button className="appt-action-btn" onClick={fetchBookings}>
                {t("appointments.retry")}
              </button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && filteredBookings.length === 0 && (
            <div className="appt-state">
              <div className="appt-empty-icon"><FiCalendar size={36} /></div>
              <p className="appt-state-title">{t("EarlyDetectionApplications.noApplications")}</p>
              <button className="appt-action-btn" onClick={() => { setSearchTerm(""); setFilter("all"); setSelectedDoctor("all"); }}>
                {t("appointments.clearFilters")}
              </button>
            </div>
          )}

          {/* Table */}
          {!loading && !error && paginatedBookings.length > 0 && (
            <>
              <div className="appt-table-wrap">
                <table className="appt-table">
                  <thead>
                    <tr>
                      <th>{t("appointments.columns.appointment")}</th>
                      <th>{t("appointments.columns.patient")}</th>
                      <th>{t("appointments.columns.dateTime")}</th>
                      <th>{t("appointments.columns.doctorService", { defaultValue: "Package / Service" })}</th>
                      <th>{t("appointments.columns.status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedBookings.map((b) => {
                      const patientName = b.patientName || "N/A";
                      return (
                        <tr
                          key={b._id}
                          className="appt-row"
                          onClick={() =>
                            navigate(
                              `/early-detection/${encodeURIComponent(b.applicationId || b._id)}`,
                              { state: { doctorEmail: b.doctorEmail, patientEmail: b.patientEmail } }
                            )
                          }
                        >
                          {/* ID */}
                          <td>
                            <span className="appt-cell-id">
                              #{b.applicationId || b.invoiceNumber || b._id || "N/A"}
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
                                <div className="appt-person-sub">{b.patientEmail || ""}</div>
                              </div>
                            </div>
                          </td>

                          {/* Date & Time */}
                          <td>
                            <div className="appt-datetime-cell">
                              <div className="appt-date-row">
                                <FiCalendar size={12} />
                                {formatDate(b.date)}
                              </div>
                              <div className="appt-time-row">
                                <FiClock size={12} />
                                {b.appointmentTime
                                  ? b.appointmentTime
                                  : `${formatTime(b.startTime)} – ${formatTime(b.endTime)}`}{" "}
                                MSK
                              </div>
                            </div>
                          </td>

                          {/* Service / Package */}
                          <td>
                            <div className="appt-doctor-cell">
                              <div>
                                <div className="appt-person-name">
                                  {b.serviceType || "Early Detection"}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Status */}
                          <td>
                            <div className="appt-status-cell">
                              <StatusBadge status={b.appointmentStatus} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
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

export default EarlyDetection;
