import React from "react";
import { useTranslation } from "react-i18next";

const AppointmentPDFTemplate = ({ appointment, patient }) => {
  const { t } = useTranslation();
  if (!appointment) return null;

  const {
    date,
    startTime,
    endTime,
    serviceType,
    appointmentMode,
    meetingLink,
    prescription,
    conclusion,
    appointmentStatus,
    doctor,
    location,
  } = appointment;

  return (
    <div
      id="appointment-pdf-content"
      style={{
        position: "absolute",
        top: "-9999px",
        left: "-9999px",
        width: "210mm",   // A4 width
        padding: "20px",
        fontFamily: "Arial",
        background: "#fff"  // important for PDF background
      }}
      
    >
      <h1 style={{ textAlign: "center" }}>{t("appointmentPdf.title")}</h1>

      <h2>{t("appointmentPdf.patientInfo")}</h2>
      <p><strong>{t("appointmentPdf.name")}</strong> {patient?.name || t("common.notSpecified")}</p>
      <p><strong>{t("appointmentPdf.email")}</strong> {patient?.email || t("common.notSpecified")}</p>
      <p><strong>{t("appointmentPdf.phone")}</strong> {patient?.phone || t("common.notSpecified")}</p>

      <h2>{t("appointmentPdf.details")}</h2>
      <p><strong>{t("appointmentPdf.date")}</strong> {date || t("common.notSpecified")}</p>
      <p><strong>{t("appointmentPdf.time")}</strong> {startTime || "--"} - {endTime || "--"}</p>
      <p><strong>{t("appointmentPdf.serviceType")}</strong> {serviceType || t("common.notSpecified")}</p>
      <p><strong>{t("appointmentPdf.mode")}</strong> {appointmentMode || t("common.notSpecified")}</p>
      <p><strong>{t("appointmentPdf.doctor")}</strong> {doctor?.email || t("common.notSpecified")}</p>
      <p><strong>{t("appointmentPdf.status")}</strong> {appointmentStatus || t("common.notSpecified")}</p>

      <h2>{t("appointmentPdf.prescription")}</h2>
      <p>{prescription?.text || t("appointmentPdf.noPrescription")}</p>

      <h2>{t("appointmentPdf.conclusion")}</h2>
      <p>{conclusion?.text || t("appointmentPdf.noConclusion")}</p>
    </div>
  );
};

export default AppointmentPDFTemplate;
