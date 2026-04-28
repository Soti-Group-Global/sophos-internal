import React, { useEffect, useState } from "react";
import { getPatientByEmail } from "../../utils/api";
import { useTranslation } from "react-i18next";
import "../../styles/PatientDetailsTab.css";

const EarlyDetectionPatientDetails = ({ patientEmail }) => {
  const { t } = useTranslation();
  const [patient, setPatient] = useState(null);

  useEffect(() => {
    const fetchPatient = async () => {
      try {
        const patient = await getPatientByEmail(patientEmail);
        setPatient(patient.patient);
      } catch (error) {
      }
    };

    if (patientEmail) fetchPatient();
  }, [patientEmail]);

  const calculateAge = (dob) => {
    if (!dob) return t("common.notAvailable");
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const formatDate = (date) => {
    if (!date) return t("common.notAvailable");
    return new Date(date).toLocaleDateString("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatPhone = (phone) => {
    if (!phone) return t("common.notAvailable");
    const digits = phone.replace(/\D/g, "");
    return digits.length === 10
      ? digits.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3")
      : phone;
  };

  if (!patient) return <p>{t("common.loading")}</p>;

  return (
    <div className="patient-details-modern">
      <div className="patient-header-modern">
        <h1 className="patient-name-modern">
          {[patient.firstName, patient.middleName, patient.lastName]
            .filter(Boolean)
            .join(" ") || t("patients.unnamed")}
        </h1>
        <div className="patient-meta-modern">
          {patient.gender && (
            <span>{t(`common.gender.${patient.gender.toLowerCase()}`)}</span>
          )}
          {patient.dateOfBirth && (
            <span>
              {t("patients.age", { age: calculateAge(patient.dateOfBirth) })}
            </span>
          )}
          {patient._id && (
            <span>
              {t("patients.id")}: {patient._id}
            </span>
          )}
        </div>
      </div>

      <div className="detail-list-modern">
        <div className="detail-row-modern">
          <span className="detail-label-modern">{t("patients.dob")}</span>
          <span className="detail-value-modern">
            {formatDate(patient.dateOfBirth)}
          </span>
        </div>

        <div className="detail-row-modern">
          <span className="detail-label-modern">{t("patients.age")}</span>
          <span className="detail-value-modern highlight">
            {patient.dateOfBirth
              ? t("patients.age", { age: calculateAge(patient.dateOfBirth) })
              : t("common.notAvailable")}
          </span>
        </div>

        <div className="detail-row-modern">
          <span className="detail-label-modern">{t("patients.gender")}</span>
          <span className="detail-value-modern">
            {patient.gender
              ? t(`common.gender.${patient.gender.toLowerCase()}`)
              : t("common.notAvailable")}
          </span>
        </div>

        <div className="detail-row-modern">
          <span className="detail-label-modern">
            {t("patients.primaryPhone")}
          </span>
          <span className="detail-value-modern highlight">
            {formatPhone(patient.telephone)}
          </span>
        </div>

        <div className="detail-row-modern">
          <span className="detail-label-modern">
            {t("patients.secondaryPhone")}
          </span>
          <span className="detail-value-modern">
            {formatPhone(patient.additionalPhone)}
          </span>
        </div>

        <div className="detail-row-modern">
          <span className="detail-label-modern">{t("patients.email")}</span>
          <span className="detail-value-modern highlight">
            {patient.email || t("common.notAvailable")}
          </span>
        </div>

        <div className="detail-row-modern">
          <span className="detail-label-modern">{t("patients.address")}</span>
          <span className="detail-value-modern">
            {patient.address || t("common.notAvailable")}
          </span>
        </div>

        <div className="detail-row-modern">
          <span className="detail-label-modern">{t("patients.comments")}</span>
          <span className="detail-value-modern">
            {patient.comments || (
              <span style={{ color: "#999" }}>{t("common.noComments")}</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
};

export default EarlyDetectionPatientDetails;
