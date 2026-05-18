import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { getMedicalHistoryByEmail, getPatientByEmail } from "../utils/api";
import { useTranslation } from "react-i18next";
import { FiCalendar, FiUser, FiActivity, FiClipboard, FiArrowLeft,FiClock } from "react-icons/fi";
import { toast } from "react-toastify";
import "../styles/MedicalHistory.css";
import { formatDateISO, formatTimeHHMM } from "../utils/dateFormat";

const MedicalHistory = () => {
  const { patientEmail } = useParams();
  const navigate = useNavigate();
  const locationState = useLocation();
  const [medicalHistory, setMedicalHistory] = useState([]);
  const [patientDetails, setPatientDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("medical");
  const { t } = useTranslation();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch patient details
        const patientData = await getPatientByEmail(patientEmail);
        setPatientDetails(patientData);

        // Fetch medical history
        const response = await getMedicalHistoryByEmail(patientEmail);
        setMedicalHistory(response?.data || []);
      } catch (err) {
        setError(t("medicalHistory.fetchError"));
        toast.error(t("medicalHistory.fetchError"));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [patientEmail]);

  const handleAppointmentClick = (appointmentId) => {
    navigate(`/appointments/${encodeURIComponent(appointmentId)}`, {
      state: {
        activeTab: "medical",
      },
    });
  };

  const formatDate = (dateString) => {
    return formatDateISO(dateString);
  };

  const formatTime = (startTime, endTime) => {
    if (!startTime) return "--";
    const start = formatTimeHHMM(startTime);
    const end = endTime ? formatTimeHHMM(endTime) : "--";
    return `${start} - ${end}`;
  };

  if (loading) {
    return (
      <div className="med-history-loading">
        <div className="med-history-loading-spinner"></div>
        <p>{t("medicalHistory.loading")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="med-history-error">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 8V12M12 16H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z"
            stroke="#EF4444"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <p>{error}</p>
        <button className="med-history-retry-btn" onClick={() => window.location.reload()}>
          {t("medicalHistory.tryAgain")}
        </button>
      </div>
    );
  }

  return (
    <div className="med-history-container">
      <div className="med-history-header">
        <button
          className="med-history-back-btn"
          onClick={() => navigate(-1)}
        >
          <FiArrowLeft size={20} /> {t("appointment.backToAppointments")}
        </button>
        <div className="med-history-header-info">
          <h2>{t("medicalHistory.title")}</h2>
          <div className="med-history-patient-info">
            <FiUser size={20} />
            <span>
              {patientDetails
                ? `${patientDetails.firstName} ${patientDetails.lastName}`
                : patientEmail}
            </span>
          </div>
        </div>
      </div>

      <div className="med-history-tab-nav">
        <button
          className={`med-history-tab ${activeTab === "appointment" ? "active" : ""}`}
          onClick={() => navigate(`/appointments/${encodeURIComponent(locationState.state?.appointmentId || "")}`, { state: { activeTab: "appointment" } })}
        >
          <FiClipboard size={18} />
          {t("appointment.appointmentDetails")}
        </button>
        <button
          className={`med-history-tab ${activeTab === "medical" ? "active" : ""}`}
          onClick={() => setActiveTab("medical")}
        >
          <FiClock size={18} />
          {t("appointment.archive")}
        </button>
      </div>

      {activeTab === "medical" && (
        <div className="med-history-list">
          {medicalHistory.length === 0 ? (
            <div className="med-history-empty">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5M12 12V16M12 16L10 14M12 16L14 14"
                  stroke="#64748B"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <h4>{t("medicalHistory.noMedicalHistory")}</h4>
              <p>{t("medicalHistory.noRecords")}</p>
            </div>
          ) : (
            medicalHistory.map((record, index) => (
              <div
                key={record._id || index}
                className="med-history-card"
                onClick={() => handleAppointmentClick(record.applicationId)}
              >
                <span className="med-history-id">
                  #{record.applicationId}
                </span>
                <div className="med-history-card-header">
                  <div className="med-history-service-type">
                    <span
                      className={`med-history-service-badge ${record.serviceType
                        ?.toLowerCase()
                        .replace(" ", "-")}`}
                    >
                      {record.serviceType || t("common.notAvailable")}
                    </span>
                    <span
                      className={`med-history-mode-indicator ${record.appointmentMode?.toLowerCase()}`}
                    >
                      {record.appointmentMode || t("common.notAvailable")}
                    </span>
                  </div>
                  <span
                    className={`med-history-status-tag ${record.appointmentStatus
                      ?.toLowerCase()
                      .replace(" ", "-")}`}
                  >
                    {record.appointmentStatus || t("common.notAvailable")}
                  </span>
                </div>
                <div className="med-history-card-body">
                  <div className="med-history-date">
                    <FiCalendar size={20} />
                    <span>
                      {formatDate(record.date)} • {formatTime(record.startTime, record.endTime)}
                    </span>
                  </div>
                  <div className="med-history-doctor-info">
                    <div className="med-history-avatar-placeholder"></div>
                    <div>
                      <h4>
                        {t("common.doctorPrefix")} {record.doctorEmail?.split("@")[0].split(".")[0] || t("common.notAvailable")}
                      </h4>
                      <p>{record.doctorEmail || t("common.notAvailable")}</p>
                    </div>
                  </div>
                  <div className="med-history-details">
                    <p>
                      <FiActivity size={14} />
                      <strong>{t("medicalHistory.prescription")}: </strong>
                      {record.prescription?.text || t("common.none")}
                    </p>
                    <p>
                      <FiClipboard size={14} />
                      <strong>{t("medicalHistory.conclusion")}: </strong>
                      {record.conclusion?.text || t("common.none")}
                    </p>
                  </div>
                </div>
                <div className="med-history-card-footer">
                  <button className="med-history-details-btn">
                    {t("appointmentHistory.viewDetails")}
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M9 18L15 12L9 6"
                        stroke="#10B981"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default MedicalHistory;