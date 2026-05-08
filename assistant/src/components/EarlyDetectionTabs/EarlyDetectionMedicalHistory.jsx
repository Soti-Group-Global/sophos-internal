import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMedicalHistoryByEmail } from "../../utils/api";
import "../../styles/MedicalHistoryTab.css";
import { useTranslation } from "react-i18next";

const EarlyDetectionMedicalHistory = ({ patientEmail }) => {
  const [medicalHistory, setMedicalHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const fetchMedicalHistory = async () => {
      if (!patientEmail) {
        setError("No patient email provided");
        setLoading(false);
        return;
      }

      try {
        const data = await getMedicalHistoryByEmail(patientEmail);
        const history = Array.isArray(data.data) ? data.data : [];
        setMedicalHistory(history);
        setFilteredHistory(history); // Initialize filtered data with all records
      } catch (err) {
        console.error("Failed to fetch medical history:", err);
        setError("Failed to load appointment history");
      } finally {
        setLoading(false);
      }
    };

    fetchMedicalHistory();
  }, [patientEmail]);

  // Apply filtering whenever activeFilter or medicalHistory changes
  useEffect(() => {
    const history = Array.isArray(medicalHistory) ? medicalHistory : [];

    if (activeFilter === "all") {
      setFilteredHistory(history);
    } else if (activeFilter === "upcoming") {
      const upcoming = history.filter(
        (appt) => new Date(appt.date) > new Date()
      );
      setFilteredHistory(upcoming);
    } else if (activeFilter === "completed") {
      const completed = history.filter(
        (appt) =>
          new Date(appt.date) <= new Date() &&
          appt.appointmentStatus !== "Cancelled"
      );
      setFilteredHistory(completed);
    } else if (activeFilter === "cancelled") {
      const cancelled = history.filter(
        (appt) => appt.appointmentStatus === "Cancelled"
      );
      setFilteredHistory(cancelled);
    }
  }, [activeFilter, medicalHistory]);

  const formatDate = (dateString) => {
    const options = { year: "numeric", month: "short", day: "numeric" };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const handleFilterClick = (filterType) => {
    setActiveFilter(filterType);
  };

  const handleViewDetails = (appointmentId) => {
    navigate(`/appointments/${encodeURIComponent(appointmentId)}`, {
      state: {
        appointmentId,
        activeTab: "medical",
      },
    });
  };

  if (loading)
    return (
      <div className="modern-loading">
        <div className="loading-spinner"></div>
        <p>Loading your appointments...</p>
      </div>
    );

  if (error)
    return (
      <div className="modern-error">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 8V12M12 16H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z"
            stroke="#DC2626"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <p>{error}</p>
      </div>
    );

  if (!medicalHistory.length)
    return (
      <div className="modern-empty">
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
        <h4>No appointments found</h4>
        <p>You don't have any medical history records yet</p>
      </div>
    );

  return (
    <div className="modern-medical-history">
      <div className="modern-header">
        <h2>{t("appointmentHistory.history.title")}</h2>
        <div className="stats-summary">
          <div className="stat-item">
            <span>{t("appointmentHistory.history.total")}</span>
            <strong>{medicalHistory.length}</strong>
          </div>
          <div className="stat-item">
            <span>{t("appointmentHistory.history.upcoming")}</span>
            <strong>
              {
                (Array.isArray(medicalHistory) ? medicalHistory : []).filter((a) => new Date(a.date) > new Date())
                  .length
              }
            </strong>
          </div>
        </div>
      </div>

      <div className="appointment-filters">
        <button
          className={`filter-btn ${activeFilter === "all" ? "active" : ""}`}
          onClick={() => handleFilterClick("all")}
        >
          {t("appointmentHistory.filters.all")}
        </button>
        <button
          className={`filter-btn ${
            activeFilter === "upcoming" ? "active" : ""
          }`}
          onClick={() => handleFilterClick("upcoming")}
        >
          {t("appointmentHistory.filters.upcoming")}
        </button>
        <button
          className={`filter-btn ${
            activeFilter === "completed" ? "active" : ""
          }`}
          onClick={() => handleFilterClick("completed")}
        >
          {t("appointmentHistory.filters.completed")}
        </button>
        <button
          className={`filter-btn ${
            activeFilter === "cancelled" ? "active" : ""
          }`}
          onClick={() => handleFilterClick("cancelled")}
        >
          {t("appointmentHistory.filters.cancelled")}
        </button>
      </div>

      <div className="appointment-list">
        {filteredHistory.length > 0 ? (
          filteredHistory.map((appointment) => (
            <div
              key={appointment._id || appointment.id}
              className="appointment-card"
            >
              <span className="appointment-id">
                #{appointment.applicationId}
              </span>      

              <div className="appointment-card-header">
                <div className="service-type">
                  <span
                    className={`service-badge ${appointment.serviceType
                      .toLowerCase()
                      .replace(" ", "-")}`}
                  >
                    {appointment.serviceType}
                  </span>
                  <span
                    className={`mode-indicator ${appointment.appointmentMode.toLowerCase()}`}
                  >
                    {appointment.appointmentMode}
                  </span>
                  
                </div>
                <span
                  className={`status-tag ${appointment.appointmentStatus
                    .toLowerCase()
                    .replace(" ", "-")}`}
                >
                  {appointment.appointmentStatus}
                </span>
              </div>

              <div className="card-body">
                <div className="appointment-date">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M8 2V5M16 2V5M3.5 9.09H20.5M21 8.5V17C21 20 19.5 22 16 22H8C4.5 22 3 20 3 17V8.5C3 5.5 4.5 3.5 8 3.5H16C19.5 3.5 21 5.5 21 8.5Z"
                      stroke="#10B981"
                      strokeWidth="1.5"
                      strokeMiterlimit="10"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M15.6947 13.7H15.7037M15.6947 16.7H15.7037M11.9955 13.7H12.0045M11.9955 16.7H12.0045M8.29431 13.7H8.30329M8.29431 16.7H8.30329"
                      stroke="#10B981"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                 <span>
  {formatDate(appointment.date)} •{" "}
  {new Date(appointment.startTime).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })} -{" "}
  {appointment.endTime
    ? new Date(appointment.endTime).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "--"}
</span>

                </div>

                <div className="doctor-info">
                  <div className="avatar-placeholder"></div>
                  <div>
                    <h4>
                      Dr. {appointment.doctorEmail.split("@")[0].split(".")[0]}
                    </h4>
                    <p>{appointment.doctorEmail}</p>
                  </div>
                </div>
              </div>

              <div className="card-footer">
                <span className="appointment-id"></span>
                <button
                  className="details-btn"
                  onClick={() => handleViewDetails(appointment.applicationId)}
                >
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
        ) : (
          <div className="no-results">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z"
                stroke="#64748B"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p>No appointments match your filter criteria</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EarlyDetectionMedicalHistory;
