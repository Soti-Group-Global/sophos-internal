import React, { useEffect, useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import {
  getEarlyDetectionBookingsByDoctor,
  getDoctors,
} from "../utils/api";
import { useNavigate } from "react-router-dom";
import "../styles/EarlyDetectionApplications.css";
import { useTranslation } from "react-i18next";
import moment from "moment-timezone";

const formatDate = (dateStr) => {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatTime = (timeStr) => {
  if (!timeStr) return "N/A";
  return new Date(timeStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const StatusBadge = ({ status }) => {
  const className =
    {
      upcoming: "status-upcoming",
      completed: "status-completed",
      cancelled: "status-cancelled",
      unconfirmed: "status-unconfirmed",
      confirmed: "status-confirmed",
    }[status?.toLowerCase()] || "status-default";

  return (
    <span className={`early-detect-status-badge ${className}`}>
      {status || "Unknown"}
    </span>
  );
};

const EarlyDetectionApplications = ({ bookings = [], loading = true }) => {
  const { user } = useContext(AuthContext);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [applications, setApplications] = useState(bookings);

  useEffect(() => {
    setApplications(bookings || []);
  }, [bookings]);


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


    // Function to export early detection applications data as CSV
  const exportToCSV = () => {
    if (applications.length === 0) {
      toast.info(t("EarlyDetectionApplications.noDataToExport"));
      return;
    }
    
    // Prepare CSV content
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
    
    const rows = applications.map(appt => [
      appt.applicationId || "N/A",
      appt.patientName || "Unknown Patient",
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
    link.setAttribute("download", `early_detection_applications_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(t("EarlyDetectionApplications.exportSuccess"));
  };

  return (
    <div className="early-detect-container">
        <div className="early-detect-header">
      <h2 className="early-detect-heading">{t("EarlyDetectionApplications.header")}</h2>
        {applications.length > 0 && (
          <button className="export-csv-button" onClick={exportToCSV}>
            <svg
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            {t("EarlyDetectionApplications.exportCSV")}
          </button>
        )}
        </div>

      {loading ? (
        <p className="early-detect-loading">{t("EarlyDetectionApplications.loading")}</p>
      ) : applications.length === 0 ? (
        <p className="early-detect-empty">{t("EarlyDetectionApplications.noApplications")}</p>
      ) : (
        <div className="early-detect-grid">
          {applications.map((appt) => (
            <div
              key={appt.applicationId}
              className="early-detect-card"
              onClick={() =>
                navigate(
                  `/early-detection/${encodeURIComponent(appt.applicationId)}`,
                  {
                    state: {
                      doctorEmail: appt.doctorEmail,
                      patientEmail: appt.patientEmail,
                    },
                  }
                )
              }
            >
              <div className="early-detect-card-header">
                <span className="early-detect-id">#{appt.applicationId}</span>
                <StatusBadge status={appt.appointmentStatus} />
              </div>

              <div className="early-detect-card-body">
                <div className="early-detect-patient">
                  <div className="early-detect-avatar">
                    {appt.patientName?.charAt(0).toUpperCase() || "P"}
                  </div>
                  <div>
                    <h3 className="early-detect-patient-name">
                      {appt.patientName || "Unknown Patient"}
                    </h3>
                    <p className="early-detect-patient-email">
                      {appt.patientEmail}
                    </p>
                  </div>
                </div>

                <div className="appointment-detail-item">
                  <p>{t("appointments.service")}:</p>
                  <span>{appt.serviceType || "Not specified"}</span>
                </div>

                <div className="early-detect-details">
                  <div className="early-detect-item">
                    <p>{t("appointments.date")}</p>
                    <span>{formatDate(appt.date)}</span>
                  </div>
                  <div className="early-detect-item">
                    <p>{t("appointments.time")}</p>
                    <p>
                      {appt.appointmentTime && !appt.startTime
                        ? appt.appointmentTime
                        : appt.startTime
                        ? `${moment(appt.startTime).tz("Europe/Moscow").format("HH:mm")} – ${moment(appt.endTime).tz("Europe/Moscow").format("HH:mm")}`
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EarlyDetectionApplications;
