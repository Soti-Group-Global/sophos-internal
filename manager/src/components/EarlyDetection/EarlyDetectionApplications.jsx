import React, { useEffect, useState, useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import { getAllEarlyDetectionApplications } from "../../utils/api";
import { useNavigate } from "react-router-dom";
import "./EarlyDetectionApplications.css";
import { useTranslation } from "react-i18next";
import { getApptStatusClass } from "../../utils/appointmentStatus";

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
  const { t } = useTranslation();
  const className = getApptStatusClass(status);

  const statusKey = status?.toLowerCase().replace(/\s+/g, "_") || "";
  const translatedStatus = t(`applications.status_${statusKey}`, status || "Unknown");

  return (
    <span className={`appt-status-badge ${className}`}>
      {translatedStatus}
    </span>
  );
};

const EarlyDetectionApplications = () => {
  const { user } = useContext(AuthContext);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        const response = await getAllEarlyDetectionApplications();

        // Flatten appointments for display
        const flattenedApplications = response.flatMap((app) =>
          app.appointments.map((appt) => ({
            applicationId: app.applicationId,
            patientEmail: app.patientEmail,
            patientName: app.patientName,
            appointmentStatus: appt.appointmentStatus,
            serviceType: app.serviceType,
            date: appt.date,
            startTime: appt.startTime,
            endTime: appt.endTime,
            doctorEmail: appt.doctorEmail,
          }))
        );
        setApplications(flattenedApplications);
      } catch (error) {
        
      } finally {
        setLoading(false);
      }
    };

    fetchApplications();
  }, []);

  return (
    <div className="early-detect-container">
      <h2 className="early-detect-heading">
        {t("EarlyDetectionApplications.header")}
      </h2>

      {loading ? (
        <p className="early-detect-loading">
          {t("EarlyDetectionApplications.loading")}
        </p>
      ) : applications.length === 0 ? (
        <p className="early-detect-empty">
          {t("EarlyDetectionApplications.noApplications")}
        </p>
      ) : (
        <div className="early-detect-grid">
          {applications.map((appt, index) => (
            <div
              key={`${appt.applicationId}-${appt.doctorEmail}-${index}`}
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
                  <p>{t("application.service")}:</p>
                  <span>{appt.serviceType || "Not specified"}</span>
                </div>

                <div className="early-detect-details">
                  <div className="early-detect-item">
                    <p>{t("application.date")}</p>
                    <span>{formatDate(appt.date)}</span>
                  </div>
                  <div className="early-detect-item">
                    <p>{t("application.time")}</p>
                    <p>
                      {formatTime(appt.startTime)} - {formatTime(appt.endTime)}
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
