import React, { useEffect, useState, useContext } from "react";
import ReactDOM from "react-dom";
import { AuthContext } from "../context/AuthContext";
import {
  getAssistantDoctors,
  getDoctorsLite,
  sendAccessRequest,
} from "../utils/api";
import { FiShield, FiX, FiChevronDown, FiChevronUp, FiDownload } from "react-icons/fi";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../styles/MySpace.css";
import { useTranslation } from "react-i18next";
import moment from "moment-timezone";

// Show in Moscow time (UTC+3)
const formatDateTime = (v, locale) => {
  if (!v) return "—";
  return moment.utc(v).tz("Europe/Moscow").format("DD/MM/YYYY HH:mm");
};

// Format Moscow time for CSV export
const formatDateTimeForCSV = (v) => {
  if (!v) return "N/A";
  try {
    return moment.utc(v).tz("Europe/Moscow").format("MM/DD/YYYY HH:mm");
  } catch {
    return "Invalid date";
  }
};

const StatusBadge = ({ status = "Unknown", t }) => {
  const statusKey = status.toLowerCase().replace(/\s+/g, '_');
  const displayStatus = t(`status.${statusKey}`, status);
  
  const classes =
    status === "Access Granted" || status === "Active"
      ? "badge badge--success"
      : status === "Access Revoked" || status === "Disapproved"
      ? "badge badge--danger"
      : status === "Pending" ||
        status === "Under Review" ||
        status === "Requested" ||
        status === "Request Sent"
      ? "badge badge--warning"
      : "badge badge--neutral";
  return <span className={classes}>{displayStatus}</span>;
};

const MySpace = () => {
  const { t, i18n } = useTranslation();
  const { user, isLoading: authLoading } = useContext(AuthContext);

  // Resolve { en, ru } name objects to plain strings
  const lang = i18n.language?.startsWith("ru") ? "ru" : "en";
  const resolveName = (name) => {
    if (!name) return "";
    if (typeof name === "string") return name;
    if (typeof name === "object") return name[lang] || name.en || name.ru || "";
    return String(name);
  };

  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [expanded, setExpanded] = useState({});
  const [modalOpen, setModalOpen] = useState(false);

  const openModal = () => {
    document.body.classList.add("modal-open");
    setModalOpen(true);
  };
  const closeModal = () => {
    document.body.classList.remove("modal-open");
    setModalOpen(false);
  };

  const [allDoctors, setAllDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [startDateTime, setStartDateTime] = useState("");
  const [endDateTime, setEndDateTime] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Fetch assistant's doctors
  useEffect(() => {
    const run = async () => {
      if (!user?.email) {
        setDoctors([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError("");
        const doctorList = await getAssistantDoctors(user.email);
        setDoctors(doctorList || []);
      } catch (e) {
        setDoctors([]);
        setError(e?.message || t("errors.failed_to_load_doctors"));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [user?.email, t]);

  const toggle = (idx) => setExpanded((s) => ({ ...s, [idx]: !s[idx] }));

  // Load list of all doctors for the modal
  useEffect(() => {
    if (!modalOpen) return;
    let mounted = true;
    (async () => {
      try {
        const list = await getDoctorsLite();
        if (mounted) setAllDoctors(list || []);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [modalOpen]);

const handleSendRequest = async () => {
  if (!selectedDoctor || !user?.email || !startDateTime || !endDateTime)
    return;

  try {
    setSubmitting(true);

    // Treat user input as Moscow time and convert to UTC
    const utcStartDateTime = moment.tz(startDateTime, "Europe/Moscow").utc().toISOString();
    const utcEndDateTime = moment.tz(endDateTime, "Europe/Moscow").utc().toISOString();

    const response = await sendAccessRequest({
      assistantEmail: user.email,
      doctorEmail: selectedDoctor,
      startDateTime: utcStartDateTime,
      endDateTime: utcEndDateTime,
    });

    if (response.ok) {
      toast.success(t("messages.request_sent_successfully"));

      // Only close modal if request succeeded
      closeModal();
      setSelectedDoctor("");
      setStartDateTime("");
      setEndDateTime("");

      const updated = await getAssistantDoctors(user.email);
      setDoctors(updated || []);
    } else {
      toast.warn(response.message || t("messages.request_not_accepted"));
      // Do NOT close the modal if request not accepted
    }
  } catch (e) {
    console.error(e);
    const msg =
      e?.response?.data?.message || e.message || t("errors.failed_to_send_request");
    toast.error(msg);
    // Do NOT close the modal on error
  } finally {
    setSubmitting(false);
  }
};

  // Function to export access requests data as CSV
  const exportToCSV = () => {
    if (doctors.length === 0) {
      toast.info(t("myspace.noDataToExport"));
      return;
    }
    
    // Prepare CSV content
    const headers = [
      t("myspace.csv.doctorName"),
      t("myspace.csv.doctorEmail"),
      t("myspace.csv.startDateTime"),
      t("myspace.csv.endDateTime"),
      t("myspace.csv.status"),
      t("myspace.csv.requestDate"),
    ];
    
    const rows = doctors.map(item => [
      resolveName(item.name) || "N/A",
      item.doctorEmail || "N/A",
      formatDateTimeForCSV(item.startDateTime),
      formatDateTimeForCSV(item.endDateTime),
      item.status || "Unknown",
      item.requestDate ? formatDateTimeForCSV(item.requestDate) : "N/A",
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
    link.setAttribute("download", `access_requests_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(t("myspace.exportSuccess"));
  };

  return (
    <div className="myspace">
      <ToastContainer position="top-right" autoClose={2000} />

      <div className="myspace__header">
        <h2 className="myspace__title">{t("myspace.title")}</h2>
        <div className="myspace__actions">
          {doctors.length > 0 && (
            <button className="btn btn--primary" onClick={exportToCSV}>
              <FiDownload className="icon-left" /> {t("myspace.exportCSV")}
            </button>
          )}
          <button className="btn btn--primary" onClick={openModal}>
            <FiShield className="icon-left" /> {t("myspace.request_access")}
          </button>
        </div>
      </div>

      {authLoading || loading ? (
        <div className="card">{t("common.loading")}</div>
      ) : error ? (
        <div className="card card--error">{error}</div>
      ) : doctors.length === 0 ? (
        <div className="emptystate">
          <div className="emptystate__title">{t("myspace.no_assignments")}</div>
          <div className="emptystate__subtitle">
            {t("myspace.assignments_description")}
          </div>
        </div>
      ) : (
        <div className="history">
          {doctors
            .sort(
              (a, b) => new Date(b.startDateTime) - new Date(a.startDateTime)
            )
            .map((item, idx) => {
              const open = !!expanded[idx];
              return (
                <div
                  className="card"
                  key={`${item.doctorEmail}-${item.startDateTime}-${idx}`}
                >
                  <div className="history__row">
                    <div className="history__info">
                      <div className="history__doctor">
                        {resolveName(item.name) || item.doctorEmail}
                      </div>
                      <div className="history__dates">
<div className="history__dates">
  {formatDateTime(item.startDateTime, i18n.language)} →{" "}
  {formatDateTime(item.endDateTime, i18n.language)}
</div>

                      </div>
                    </div>
                    <div className="history__actions">
                      <StatusBadge status={item.status} t={t} />
                    </div>
                  </div>
                
                </div>
              );
            })}
        </div>
      )}

      {modalOpen && ReactDOM.createPortal(
        <div className="assistant__modal" onClick={closeModal}>
          <div className="modal__content" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h3 className="modal__title">{t("modal.request_access_title")}</h3>
              <button
                className="modal__close"
                onClick={closeModal}
              >&times;</button>
            </div>

            <div className="modal__body">
              <label className="field">
                <span className="field__label">{t("modal.select_doctor")}</span>
                <select
                  className="field__select"
                  value={selectedDoctor}
                  onChange={(e) => setSelectedDoctor(e.target.value)}
                >
                  <option value="">— {t("modal.choose")} —</option>
                  {allDoctors.map((d) => (
                    <option key={d.email} value={d.email}>
                      {resolveName(d.name) || d.email}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field__label">{t("modal.start_datetime")}</span>
                <input
                  type="datetime-local"
                  className="field__input"
                  value={startDateTime}
                  onChange={(e) => {
                    const start = e.target.value;
                    setStartDateTime(start);

                    // Auto-set end date 7 days later (same time)
                    if (start) {
                      const startDate = new Date(start);
                      const endDate = new Date(startDate.getTime() + (7 * 24 * 60 * 60 * 1000));
                      
                      // Format as YYYY-MM-DDTHH:MM for datetime-local input
                      const endISO = endDate.toISOString().slice(0, 16);
                      setEndDateTime(endISO);
                    }
                  }}/>
              </label>

              <label className="field">
                <span className="field__label">{t("modal.end_datetime")}</span>
                <input
                  type="datetime-local"
                  className="field__input"
                  value={endDateTime}
                  onChange={(e) => setEndDateTime(e.target.value)}
                />
              </label>
            </div>

            <div className="modal__footer">
              <button
                className="btn btn--ghost"
                onClick={closeModal}
              >{t("common.cancel")}</button>
              <button
                className="btn btn--success"
                onClick={handleSendRequest}
                disabled={
                  !selectedDoctor ||
                  !startDateTime ||
                  !endDateTime ||
                  submitting ||
                  !user?.email
                }
              >
                {submitting ? t("common.sending") : t("common.send_request")}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

export default MySpace;