import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const GenderIcon = ({ gender }) => {
  const g = (gender || "").toLowerCase();
  if (g === "male")   return <span className="adp-header-gender-icon adp-header-gender-icon--male">♂</span>;
  if (g === "female") return <span className="adp-header-gender-icon adp-header-gender-icon--female">♀</span>;
  return null;
};

const EDHeader = ({ booking, patientDisplayName, dobHeader, formatDate, patientGender, patientAge }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const statusLabel =
    {
      confirmed: t("earlyDiagnosis.confirmed"),
      pending: t("earlyDiagnosis.pendingStatus"),
      cancelled: t("earlyDiagnosis.cancelled"),
      completed: t("earlyDiagnosis.completed"),
    }[booking?.status?.toLowerCase()] ||
    booking?.status ||
    "Active";

  return (
    <div className="adp-top-header">
      <button
        className="adp-back-btn"
        onClick={() => navigate("/early-detection")}
      >
        <ArrowLeft size={14} />
        <span>{t("earlyDiagnosis.backToSchedule", "Back to Schedule")}</span>
      </button>

      <div className="adp-header-divider" />

      <div className="adp-header-center">
        <div className="adp-header-name-row">
          <h1 className="adp-patient-title">
            <GenderIcon gender={patientGender} />
            {t("earlyDiagnosis.patientLabel", "Patient")}:{" "}
            <strong>{patientDisplayName}</strong>
          </h1>
          <span className="adp-status-badge-header">{statusLabel}</span>
        </div>
        <span className="adp-added-date">
          No.{booking?.invoiceNumber || booking?.bookingNumber}&nbsp;·&nbsp;
          {t("earlyDiagnosis.addedToSystemOn", "Added to system on")}{" "}
          {formatDate(booking?.createdAt)}
        </span>
      </div>

      {dobHeader && (
        <div className="adp-header-right">
          <div className="adp-dob-row">
            <span className="adp-dob-value">{dobHeader}</span>
            {patientAge !== null && patientAge !== undefined && (
              <span className="adp-age-badge">{patientAge} y.o.</span>
            )}
          </div>
          <span className="adp-dob-label">
            {t("earlyDiagnosis.dateOfBirth", "Date of Birth")}
          </span>
        </div>
      )}
    </div>
  );
};

export default EDHeader;
