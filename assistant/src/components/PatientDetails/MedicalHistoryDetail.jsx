import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAppointmentById } from "../../utils/api";
import { useTab } from "../../context/TabContext";
import "../../styles/MedicalHistoryDetail.css";

const MedicalHistoryDetail = () => {
  const { id } = useParams();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { setActiveTab } = useTab();

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const data = await getAppointmentById(id);
        setRecord(data);
      } catch (err) {
        console.error(err);
        setError("Could not load appointment details.");
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [id]);

  const handleBack = () => {
    setActiveTab("medical");
    navigate(`/patients/${record.patient}`, {
      state: {
        activeTab: "medical",
        appointmentId: id,
      },
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return "N/A";
    return timeString;
  };

  if (loading)
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading appointment details...</p>
      </div>
    );

  if (error || !record)
    return (
      <div className="error-container">
        <div className="error-icon">!</div>
        <p>{error || "Appointment not found"}</p>
        <button onClick={handleBack} className="back-button">
          ← Back to Patient
        </button>
      </div>
    );

  return (
    <div className="medical-history-detail-container">
      <button onClick={handleBack} className="back-button">
        ← Back to Medical history
      </button>

      <div className="detail-header">
        <h2>Appointment Details</h2>
        <div
          className="status-badge"
          data-status={record.appointmentStatus.toLowerCase()}
        >
          {record.appointmentStatus}
        </div>
      </div>

      <div className="detail-grid">
        {/* Basic Information Section */}
        <div className="detail-section">
          <h3>Appointment Information</h3>
          <div className="detail-item">
            <strong>Appointment ID:</strong> {record.applicationId || "N/A"}
          </div>
          <div className="detail-item">
            <strong>Date:</strong> {formatDate(record.date)}
          </div>
          <div className="detail-item">
            <strong>Time:</strong> {formatTime(record.startTime)} -{" "}
            {formatTime(record.endTime)}
          </div>
          <div className="detail-item">
            <strong>Mode:</strong>
            <span
              className={`mode-tag ${record.appointmentMode.toLowerCase()}`}
            >
              {record.appointmentMode}
            </span>
          </div>
          <div className="detail-item">
            <strong>Service Type:</strong> {record.serviceType || "N/A"}
          </div>
          <div className="detail-item">
            <strong>Specialty:</strong> {record.specialty || "N/A"}
          </div>
        </div>

        {/* Participants Section */}
        <div className="detail-section">
          <h3>Participants</h3>
          <div className="detail-item">
            <strong>Patient:</strong> {record.patient || "N/A"}
          </div>
          <div className="detail-item">
            <strong>Doctor:</strong> {record.doctor || "N/A"}
          </div>
        </div>

        {/* Payment Information */}
        {record.payments && record.payments.length > 0 && (
          <div className="detail-section">
            <h3>Payment Information</h3>
            {record.payments.map((payment, index) => (
              <div key={index} className="payment-item">
                <div className="detail-item">
                  <strong>Amount:</strong> ${payment.amount || "0"}
                </div>
                <div className="detail-item">
                  <strong>Status:</strong>
                  <span
                    className={`payment-status ${payment.status.toLowerCase()}`}
                  >
                    {payment.status}
                  </span>
                </div>
                <div className="detail-item">
                  <strong>Method:</strong> {payment.method || "N/A"}
                </div>
                <div className="detail-item">
                  <strong>Paid on:</strong> {formatDate(payment.timestamp)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Medical Information */}
        <div className="detail-section">
          <h3>Medical Notes</h3>
          <div className="detail-item">
            <strong>Conclusion:</strong>
            <div className="text-content">
              {record.conclusion || "No conclusion provided"}
            </div>
          </div>
          <div className="detail-item">
            <strong>Prescription:</strong>
            <div className="text-content">
              {record.prescription || "No prescription provided"}
            </div>
          </div>
        </div>

        {/* Comments Section */}
        {record.comments && record.comments.length > 0 && (
          <div className="detail-section">
            <h3>Comments</h3>
            {record.comments.map((comment, index) => (
              <div key={index} className="comment-item">
                <div className="comment-header">
                  <strong>Doctor:</strong> {comment.doctorEmail}
                  <span className="comment-date">
                    {formatDate(comment.createdAt)}
                  </span>
                </div>
                <div className="comment-text">{comment.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MedicalHistoryDetail;
