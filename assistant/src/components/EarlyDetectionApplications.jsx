import React, { useEffect, useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "../styles/EarlyDetectionApplications.css";
import { useTranslation } from "react-i18next";

const StatusBadge = ({ status, t }) => {
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
      {t(`application.status.${status?.toLowerCase()}`, { defaultValue: status }) || "Unknown"}
    </span>
  );
};

const EarlyDetectionApplications = ({ bookings = [], loading = true }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [applications, setApplications] = useState(bookings);

  useEffect(() => { setApplications(bookings || []); }, [bookings]);

  const formatDateDDMMYYYY = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
  };

  const formatTime = (value) => {
    if (!value) return "—";
    if (/^\d{1,2}:\d{2}$/.test(String(value).trim())) return value;
    const d = new Date(value);
    if (isNaN(d)) return value;
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });
  };

  const calculateAge = (dob) => {
    if (!dob) return null;
    const birth = new Date(dob);
    if (isNaN(birth)) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age >= 0 ? age : null;
  };

  const getPatientFirstName = (appt) => {
    if (appt.patientDetails?.firstName) return appt.patientDetails.firstName?.en || appt.patientDetails.firstName || "";
    return (appt.patientName || "").split(" ")[0] || "";
  };

  const getPatientLastName = (appt) => {
    if (appt.patientDetails?.lastName) return appt.patientDetails.lastName?.en || appt.patientDetails.lastName || "";
    return (appt.patientName || "").split(" ").slice(1).join(" ") || "";
  };

  if (loading) return <p className="early-detect-loading">{t("EarlyDetectionApplications.loading")}</p>;
  if (applications.length === 0) return <p className="early-detect-empty">{t("EarlyDetectionApplications.noApplications")}</p>;

  return (
    <div className="appt-table-wrap">
      <table className="appt-table">
        <thead>
          <tr>
            <th>{t("appointments.patient", "PATIENT").toUpperCase()}</th>
            <th>{t("appointments.sex", "SEX").toUpperCase()}</th>
            <th>{t("appointments.age", "AGE").toUpperCase()}</th>
            <th>{t("appointments.appointment", "APPOINTMENT").toUpperCase()}</th>
            <th>{t("appointments.typeOfService", "TYPE OF SERVICE").toUpperCase()}</th>
            <th>{t("appointments.date", "DATE").toUpperCase()}</th>
            <th>{t("appointments.status", "STATUS").toUpperCase()}</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((appt) => (
            <tr
              key={appt.applicationId || appt._id}
              className="appt-row"
              onClick={() => navigate(`/early-detection/${encodeURIComponent(appt.applicationId)}`, {
                state: { doctorEmail: appt.doctorEmail, patientEmail: appt.patientEmail },
              })}
            >
              <td>
                <div className="patient-name-cell">
                  <span className="patient-name-primary">{getPatientFirstName(appt) || t("appointment.unknownPatient", "Unknown")}</span>
                  {getPatientLastName(appt) && <span className="patient-name-secondary">{getPatientLastName(appt)}</span>}
                </div>
              </td>
              <td>
                {(() => {
                  const g = (appt.patientDetails?.gender || "").toLowerCase();
                  if (g === "male") return <span className="sex-icon sex-icon--male">♂</span>;
                  if (g === "female") return <span className="sex-icon sex-icon--female">♀</span>;
                  return <span className="sex-icon sex-icon--unknown">—</span>;
                })()}
              </td>
              <td>
                <span className="age-text">
                  {appt.patientDetails?.dateOfBirth ? calculateAge(appt.patientDetails.dateOfBirth) ?? "—" : "—"}
                </span>
              </td>
              <td><span className="appt-cell-id">#{appt.applicationId || appt._id}</span></td>
              <td><span className="appointment-type-label">{appt.serviceType || t("appointments.types.earlyDetection", "Early Detection")}</span></td>
              <td>
                <div className="appt-date-cell">
                  <span className="appt-date-text">{formatDateDDMMYYYY(appt.date)}</span>
                  {(appt.startTime || appt.endTime) && (
                    <span className="appt-time-sub">
                      {formatTime(appt.startTime)}{appt.endTime ? " – " + formatTime(appt.endTime) : ""}
                    </span>
                  )}
                </div>
              </td>
              <td><StatusBadge status={appt.appointmentStatus} t={t} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default EarlyDetectionApplications;
