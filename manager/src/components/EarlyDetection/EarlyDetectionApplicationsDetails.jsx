import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiArrowLeft,
  FiClipboard,
  FiUser,
  FiClock,
  FiChevronRight,
} from "react-icons/fi";
import EarlyDetectionApplicationDetail from "./EarlyDetectionApplicationDetail";
import EarlyDetectionPatientDetails from "./EarlyDetectionPatientDetails";
import EarlyDetectionMedicalHistory from "./EarlyDetectionMedicalHistory";
import "./EarlyDetectionApplicationDetails.css";

// Add this utility function
const getEmailFromToken = () => {
  try {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.email || null;
  } catch (error) {
    return null;
  }
};

const EarlyDetectionApplicationDetails = () => {
  const { t } = useTranslation();
  const { applicationId } = useParams();
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const { doctorEmail: doctorEmailFromState } = location.state || {};
  const { patientEmail: patientEmailFromState } = location.state || {};
  const doctorEmail = doctorEmailFromState || getEmailFromToken();
  const patientEmail = patientEmailFromState;

  const [activeTab, setActiveTab] = useState("application");

  useEffect(() => {
    if (!applicationId || !doctorEmail) {
      navigate("/early-detection", { replace: true });
    }
  }, [applicationId, doctorEmail, navigate]);

  const renderTabContent = () => {
    switch (activeTab) {
      case "application":
        return (
          <EarlyDetectionApplicationDetail
            applicationId={applicationId}
            doctorEmail={doctorEmail}
          />
        );
      case "patient":
        return (
          <EarlyDetectionPatientDetails
            applicationId={id}
            patientEmail={patientEmail}
          />
        );
      case "history":
        return (
          <EarlyDetectionMedicalHistory
            applicationId={id}
            patientEmail={patientEmail}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="early-detection-app-container">
      {/* Modern Header */}

      {/* Tab Content */}
      <div className="early-detection-app-content">{renderTabContent()}</div>
    </div>
  );
};

export default EarlyDetectionApplicationDetails;
