import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, FileText, CheckSquare, Square } from "lucide-react";
import { useTranslation } from "react-i18next";
import html2pdf from "html2pdf.js";
import api from "../../utils/api";

function fmtDate(value, locale) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
}

function fmtDateTime(value, locale) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function fmtTime(value) {
  if (!value) return "";
  if (/^\d{1,2}:\d{2}$/.test(value)) return value;
  if (/^\d{1,2}:\d{2}:\d{2}/.test(value)) return value.slice(0, 5);
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function calcAge(dob) {
  if (!dob) return "";
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  if (
    today.getMonth() < date.getMonth() ||
    (today.getMonth() === date.getMonth() && today.getDate() < date.getDate())
  )
    age -= 1;
  return String(age);
}

function bool(value, isRu) {
  if (value === true) return isRu ? "Да" : "Yes";
  if (value === false) return isRu ? "Нет" : "No";
  return "";
}

function stripHtml(html) {
  if (!html) return "";
  const withSpacing = String(html)
    .replace(/<(br|\/p|\/div|\/li)>/gi, " ")
    .replace(/<li>/gi, " ");

  if (typeof document !== "undefined") {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = withSpacing;
    return textarea.value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }

  return withSpacing
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fullName(patient) {
  return [patient.firstName, patient.middleName, patient.lastName]
    .filter(Boolean)
    .join(" ");
}

function getLatestPayment(payments) {
  if (!Array.isArray(payments) || !payments.length) return null;
  const valid = payments.filter(
    (payment) => payment && (payment.status || payment.invoiceNumber),
  );
  return valid.length ? valid[valid.length - 1] : null;
}

function getAppointmentKey(appointment) {
  return (
    appointment?._id ||
    appointment?.applicationId ||
    `${appointment?.patientEmail || "unknown"}-${appointment?.date || ""}-${appointment?.startTime || ""}`
  );
}

function getAppointmentTimestamp(appointment) {
  const datePart = appointment?.date;
  const timePart = appointment?.startTime || appointment?.endTime || "00:00";
  if (!datePart) return 0;

  const normalizedTime = /^\d{1,2}:\d{2}/.test(timePart)
    ? timePart.slice(0, 5)
    : "00:00";
  const timestamp = new Date(`${datePart}T${normalizedTime}`).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function isCompletedAppointment(appointment) {
  const status = String(appointment?.appointmentStatus || "").trim().toLowerCase();
  if (status === "completed") return true;

  const timestamp = getAppointmentTimestamp(appointment);
  if (!timestamp) return false;

  return timestamp <= Date.now();
}

function getCompletedAppointments(appointments) {
  return Array.isArray(appointments)
    ? appointments.filter(
        (appointment) => isCompletedAppointment(appointment),
      ).sort(
        (left, right) =>
          getAppointmentTimestamp(right) - getAppointmentTimestamp(left),
      )
    : [];
}

function getLabel(item, isRu) {
  return isRu ? (item.labelRu || item.label) : item.label;
}

// [id, labelEn, labelRu, getValue]
const patientSections = [
  {
    id: "basic",
    label: "Basic Information",
    labelRu: "Основная информация",
    fields: [
      ["fullName", "Full Name", "ФИО", (p) => fullName(p)],
      ["email", "Email", "Email", (p) => p.email || ""],
      ["phone", "Phone", "Телефон", (p) => p.phoneNumber || ""],
      ["dob", "Date of Birth", "Дата рождения", (p, l) => fmtDate(p.dateOfBirth, l)],
      ["age", "Age", "Возраст", (p) => calcAge(p.dateOfBirth)],
      ["gender", "Gender", "Пол", (p) => p.gender || ""],
      ["maxId", "MAX ID", "MAX ID", (p) => p.maxId || ""],
      ["notificationLanguage", "Notification Language", "Язык уведомлений", (p) => p.notificationLanguage || ""],
      ["createdAt", "Created At", "Создан", (p, l) => fmtDateTime(p.createdAt, l)],
      ["updatedAt", "Updated At", "Обновлён", (p, l) => fmtDateTime(p.updatedAt, l)],
    ],
  },
  {
    id: "contact",
    label: "Contact Details",
    labelRu: "Контактные данные",
    fields: [
      ["addPhone", "Additional Phone", "Доп. телефон", (p) => p.additionalPhone || ""],
      ["telegram", "Telegram", "Telegram", (p) => p.telegramNickname || p.telegramId || ""],
      ["instagram", "Instagram", "Instagram", (p) => p.instagram || ""],
      ["vk", "VK", "ВКонтакте", (p) => p.vk || ""],
      ["facebook", "Facebook", "Facebook", (p) => p.facebook || ""],
      ["ok", "Odnoklassniki", "Одноклассники", (p) => p.ok || ""],
      ["newsletter", "Newsletter", "Рассылка", (p, _l, isRu) => bool(p.newsletter, isRu)],
      ["egisz", "EGISZ", "ЕГИСЗ", (p, _l, isRu) => bool(p.egisz, isRu)],
      ["contactPerson", "Emergency Contact", "Контактное лицо", (p) => p.contactPerson || ""],
      ["contactPersonPhone", "Emergency Phone", "Телефон контакта", (p) => p.contactPersonPhone || ""],
    ],
  },
  {
    id: "personal",
    label: "Personal Details",
    labelRu: "Личные данные",
    fields: [
      ["maritalStatus", "Marital Status", "Семейное положение", (p) => p.maritalStatus || ""],
      ["education", "Education", "Образование", (p) => p.education || ""],
      ["employment", "Employment", "Трудоустройство", (p) => p.employment || ""],
      ["placeOfWork", "Place of Work", "Место работы", (p) => p.placeOfWork || ""],
      ["workSpecialty", "Work Specialty", "Специальность", (p) => p.workSpecialty || ""],
      ["changePlaceOfWork", "Change of Workplace", "Смена места работы", (p) => p.changePlaceOfWork || ""],
      ["changeOfPosition", "Change of Position", "Смена должности", (p) => p.changeOfPosition || ""],
      ["citizenship", "Citizenship", "Гражданство", (p) => p.citizenship || ""],
    ],
  },
  {
    id: "documents",
    label: "Documents",
    labelRu: "Документы",
    fields: [
      ["docType", "Document Type", "Тип документа", (p) => p.documentType || ""],
      ["docSeries", "Series", "Серия", (p) => p.documentSeries || ""],
      ["docNumber", "Number", "Номер", (p) => p.documentNumber || ""],
      ["docIssuedDate", "Issued Date", "Дата выдачи", (p, l) => fmtDate(p.documentIssuedDate, l)],
      ["departmentCode", "Department Code", "Код подразделения", (p) => p.departmentCode || ""],
      ["docIssued", "Issued By", "Выдан", (p) => p.documentIssuedBy || ""],
      ["snils", "SNILS", "СНИЛС", (p) => p.snils || ""],
      ["inn", "INN", "ИНН", (p) => p.inn || ""],
      ["cmip", "CMIP / Polis", "ОМС / Полис", (p) => p.cmip || ""],
      ["cmipDate", "CMIP Date", "Дата ОМС", (p, l) => fmtDate(p.cmipDate, l)],
      ["cmipOrgCode", "CMIP Org Code", "Код орг. ОМС", (p) => p.cmipOrgCode || ""],
      ["medInsurance", "Med. Insurance Org.", "Страховая организация", (p) => p.medInsuranceOrg || ""],
      ["socialSupportCode", "Social Support Code", "Код соц. поддержки", (p) => p.socialSupportCode || ""],
    ],
  },
  {
    id: "address",
    label: "Address",
    labelRu: "Адрес",
    fields: [
      ["addressType", "Address Type", "Тип адреса", (p) => p.addressType || ""],
      ["region", "Region", "Регион", (p) => p.region || ""],
      ["district", "District", "Район", (p) => p.district || ""],
      ["city", "City", "Город", (p) => p.city || ""],
      ["settlement", "Settlement", "Населённый пункт", (p) => p.settlement || ""],
      ["terrain", "Terrain", "Местность", (p) => p.terrain || ""],
      ["street", "Street", "Улица", (p) => p.street || ""],
      ["house", "House", "Дом", (p) => p.house || ""],
      ["apartment", "Apartment", "Квартира", (p) => p.apartment || ""],
      ["postcode", "Postcode", "Индекс", (p) => p.postcode || ""],
      ["geocoordinates", "Geocoordinates", "Геокоординаты", (p) => p.geocoordinates || ""],
      ["registrationChange", "Registration Change", "Изменение регистрации", (p) => p.registrationChange || ""],
    ],
  },
  {
    id: "medical",
    label: "Medical Information",
    labelRu: "Медицинская информация",
    fields: [
      ["bloodGroup", "Blood Group", "Группа крови", (p) => p.bloodGroup || ""],
      ["rhFactor", "Rh Factor", "Резус-фактор", (p) => p.rhFactor || ""],
      ["kellAntigen", "Kell Antigen", "Антиген Келл", (p) => p.kellAntigen || ""],
      ["otherBloodInfo", "Other Blood Info", "Прочая кровь", (p) => p.otherBloodInfo || ""],
      ["allergies", "Allergies", "Аллергии", (p) => p.allergies || ""],
      ["anamnesisDisability", "Anamnesis / Disability", "Анамнез / инвалидность", (p) => p.anamnesisDisability || ""],
      ["disability", "Disability", "Инвалидность", (p) => p.disability || ""],
      ["disabilityFrom", "Disability From", "Инвалидность с", (p, l) => fmtDate(p.disabilityFrom, l)],
      ["disabilityTo", "Disability To", "Инвалидность по", (p, l) => fmtDate(p.disabilityTo, l)],
      ["disabilityIndefin", "Disability Indefinitely", "Бессрочно", (p, _l, isRu) => bool(p.disabilityIndefinitely, isRu)],
      ["invalidGroup", "Disability Group", "Группа инвалидности", (p) => p.invalidGroup || ""],
      ["disabilityType", "Disability Type", "Тип инвалидности", (p) => p.disabilityType || ""],
      ["disabilityPrimary", "Primary / Repeated", "Первичная / повторная", (p) => p.disabilityPrimaryRepeated || ""],
    ],
  },
  {
    id: "notes",
    label: "Notes & Comments",
    labelRu: "Заметки и комментарии",
    fields: [
      ["notes", "Notes", "Заметки", (p) => p.notes || ""],
      ["comments", "Comments", "Комментарии", (p) => p.comments || ""],
    ],
  },
].map((section) => ({
  ...section,
  fields: section.fields.map(([id, label, labelRu, getValue]) => ({
    id,
    label,
    labelRu,
    getValue,
  })),
}));

// [id, labelEn, labelRu]
const appointmentFields = [
  ["apt_applicationId", "Application ID", "ID записи"],
  ["apt_date", "Date", "Дата"],
  ["apt_time", "Time", "Время"],
  ["apt_status", "Status", "Статус"],
  ["apt_mode", "Mode", "Режим"],
  ["apt_doctor", "Doctor", "Врач"],
  ["apt_doctorEmail", "Doctor Email", "Email врача"],
  ["apt_specialty", "Specialty", "Специальность"],
  ["apt_service", "Service", "Услуга"],
  ["apt_branch", "Branch", "Филиал"],
  ["apt_serviceType", "Service Type", "Тип услуги"],
  ["apt_paymentStatus", "Payment Status", "Статус оплаты"],
  ["apt_amount", "Amount", "Сумма"],
  ["apt_invoiceNumber", "Invoice Number", "Номер счёта"],
  ["apt_currency", "Currency", "Валюта"],
  ["apt_createdAt", "Created At", "Создан"],
  ["apt_updatedAt", "Updated At", "Обновлён"],
  ["apt_historyFirst", "First Appointment", "Первичный приём"],
  ["apt_historyRepeat", "Repetitive Appointment", "Повторный приём"],
  ["apt_complaints", "Complaints", "Жалобы"],
  ["apt_anamnesisMorbi", "Anamnesis Morbi", "Anamnesis Morbi"],
  ["apt_anamnesisVitae", "Anamnesis Vitae", "Anamnesis Vitae"],
  ["apt_physicalExam", "Physical Exam", "Физикальный осмотр"],
  ["apt_respiratory", "Respiratory", "Дыхательная система"],
  ["apt_circulatory", "Circulatory", "Сердечно-сосудистая"],
  ["apt_digestive", "Digestive", "Пищеварительная"],
  ["apt_urinary", "Urinary", "Мочевыделительная"],
  ["apt_endocrine", "Endocrine", "Эндокринная"],
  ["apt_preliminaryDiagnosis", "Preliminary Diagnosis", "Предварительный диагноз"],
  ["apt_examinationPlan", "Examination Plan", "План обследования"],
  ["apt_examinationResults", "Examination Results", "Результаты обследования"],
  ["apt_clinicalDiagnosis", "Clinical Diagnosis", "Клинический диагноз"],
  ["apt_treatmentPlan", "Treatment Plan", "План лечения"],
].map(([id, label, labelRu]) => ({ id, label, labelRu }));

const sections = [
  ...patientSections,
  {
    id: "appointments",
    label: "Completed Appointments",
    labelRu: "Завершённые приёмы",
    fields: appointmentFields,
  },
];

const appointmentFieldIds = new Set(appointmentFields.map((field) => field.id));
const summaryAppointmentFieldIds = new Set([
  "apt_applicationId",
  "apt_date",
  "apt_time",
  "apt_status",
  "apt_mode",
  "apt_doctor",
  "apt_doctorEmail",
  "apt_specialty",
  "apt_serviceType",
  "apt_paymentStatus",
  "apt_amount",
  "apt_invoiceNumber",
]);

const defaultChecked = new Set([
  "fullName",
  "email",
  "phone",
  "dob",
  "age",
  "gender",
  "addPhone",
  "telegram",
  "maritalStatus",
  "employment",
  "bloodGroup",
  "rhFactor",
  "allergies",
  "apt_applicationId",
  "apt_date",
  "apt_time",
  "apt_status",
  "apt_mode",
  "apt_doctor",
  "apt_specialty",
  "apt_service",
  "apt_paymentStatus",
  "apt_amount",
]);

function buildDefaultSelection() {
  const selected = {};
  sections.forEach((section) =>
    section.fields.forEach((field) => {
      selected[field.id] = defaultChecked.has(field.id);
    }),
  );
  return selected;
}

function getAppointmentFieldValue(fieldId, appointment, locale, isRu) {
  const payment = getLatestPayment(appointment?.payments);
  const timeRange =
    appointment?.startTime && appointment?.endTime
      ? `${fmtTime(appointment.startTime)} - ${fmtTime(appointment.endTime)}`
      : fmtTime(appointment?.startTime) || "";
  return (
    {
      apt_applicationId: appointment?.applicationId || "",
      apt_date: fmtDate(appointment?.date, locale),
      apt_time: timeRange,
      apt_status: appointment?.appointmentStatus || "",
      apt_mode: appointment?.appointmentMode || "",
      apt_doctor:
        appointment?.doctorName || appointment?.doctors?.[0]?.doctorName || "",
      apt_doctorEmail:
        appointment?.doctor?.email ||
        appointment?.doctors?.[0]?.doctorEmail ||
        appointment?.doctorEmail ||
        "",
      apt_specialty:
        appointment?.specialty || appointment?.doctor?.specialty || "",
      apt_service: appointment?.doctors?.[0]?.serviceName || "",
      apt_branch: appointment?.branch || "",
      apt_serviceType: appointment?.serviceType || "",
      apt_paymentStatus: payment?.status || "",
      apt_amount: payment
        ? String(payment.finalAmount ?? payment.amount ?? "")
        : "",
      apt_invoiceNumber: payment?.invoiceNumber || "",
      apt_currency: payment?.currency || "",
      apt_createdAt: fmtDateTime(appointment?.createdAt, locale),
      apt_updatedAt: fmtDateTime(appointment?.updatedAt, locale),
      apt_historyFirst: bool(appointment?.historyForm?.isFirstAppointment, isRu),
      apt_historyRepeat: bool(appointment?.historyForm?.isRepetitiveAppointment, isRu),
      apt_complaints: stripHtml(appointment?.historyForm?.complaints?.value),
      apt_anamnesisMorbi: stripHtml(appointment?.historyForm?.anamnesisMorbi?.value),
      apt_anamnesisVitae: stripHtml(appointment?.historyForm?.anamnesisVitae?.value),
      apt_physicalExam: stripHtml(appointment?.historyForm?.physicalExam?.value),
      apt_respiratory: stripHtml(appointment?.historyForm?.respiratory?.value),
      apt_circulatory: stripHtml(appointment?.historyForm?.circulatory?.value),
      apt_digestive: stripHtml(appointment?.historyForm?.digestive?.value),
      apt_urinary: stripHtml(appointment?.historyForm?.urinary?.value),
      apt_endocrine: stripHtml(appointment?.historyForm?.endocrine?.value),
      apt_preliminaryDiagnosis: stripHtml(appointment?.historyForm?.preliminaryDiagnosis?.value),
      apt_examinationPlan: stripHtml(appointment?.historyForm?.examinationPlan?.value),
      apt_examinationResults: stripHtml(appointment?.historyForm?.examinationResults?.value),
      apt_clinicalDiagnosis: stripHtml(appointment?.historyForm?.clinicalDiagnosis?.value),
      apt_treatmentPlan: stripHtml(appointment?.historyForm?.treatmentPlan?.value),
    }[fieldId] || ""
  );
}

function AppointmentsExport({ appointments, activeFields, locale, isRu }) {
  if (!appointments.length)
    return (
      <div
        style={{
          padding: "8px 12px",
          fontSize: "9px",
          color: "#64748b",
          fontStyle: "italic",
        }}
      >
        {isRu ? "Нет завершённых приёмов" : "No completed appointment records"}
      </div>
    );
  const summaryFields = activeFields.filter((field) =>
    summaryAppointmentFieldIds.has(field.id),
  );
  const detailFields = activeFields.filter(
    (field) => !summaryAppointmentFieldIds.has(field.id),
  );
  const tdLabel = {
    width: "22%",
    padding: "4px 8px",
    fontWeight: "bold",
    color: "#475569",
    background: "#f1f5f9",
    borderBottom: "1px solid #eef2f7",
    verticalAlign: "top",
    fontSize: "9px",
    lineHeight: "1.4",
    whiteSpace: "normal",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
  };
  const tdValue = {
    width: "28%",
    padding: "4px 8px",
    color: "#0f172a",
    borderBottom: "1px solid #eef2f7",
    verticalAlign: "top",
    fontSize: "9px",
    lineHeight: "1.4",
    whiteSpace: "normal",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {summaryFields.length > 0 && (
        <table
          style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}
        >
          <thead>
            <tr style={{ background: "#e2e8f0" }}>
              {summaryFields.map((field) => (
                <th
                  key={field.id}
                  style={{
                    padding: "4px 6px",
                    fontSize: "8px",
                    fontWeight: "bold",
                    color: "#334155",
                    textAlign: "left",
                    border: "1px solid #cbd5e1",
                  }}
                >
                  {getLabel(field, isRu)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {appointments.map((appointment, index) => (
              <tr
                key={getAppointmentKey(appointment) || index}
                style={{ background: index % 2 === 0 ? "#fff" : "#f8fafc" }}
              >
                {summaryFields.map((field) => (
                  <td
                    key={field.id}
                    style={{
                      padding: "4px 6px",
                      fontSize: "8.5px",
                      color: "#0f172a",
                      border: "1px solid #e2e8f0",
                      verticalAlign: "top",
                      whiteSpace: "normal",
                      wordBreak: "break-word",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {getAppointmentFieldValue(field.id, appointment, locale, isRu) || "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {detailFields.length > 0 &&
        appointments.map((appointment, index) => {
          const filledDetailFields = detailFields.filter(
            (f) => !!getAppointmentFieldValue(f.id, appointment, locale, isRu),
          );
          if (!filledDetailFields.length) return null;
          return (
            <div
              key={`details-${getAppointmentKey(appointment) || index}`}
              style={{
                border: "1px solid #dbe4f0",
                borderRadius: "8px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  background: "#eff6ff",
                  padding: "6px 10px",
                  fontSize: "9px",
                  fontWeight: "600",
                  color: "#0a2e5d",
                }}
              >
                {appointment.applicationId || "-"} •{" "}
                {fmtDate(appointment.date, locale) || "-"}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  background: "#fff",
                }}
              >
                {filledDetailFields.map((field, i) => (
                  <div
                    key={field.id}
                    style={{
                      padding: "7px 10px",
                      borderBottom: "1px solid #eef2f7",
                      background: i % 2 === 0 ? "#fff" : "#f8fafc",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "8px",
                        fontWeight: "700",
                        color: "#64748b",
                        textTransform: "uppercase",
                        letterSpacing: "0.4px",
                        marginBottom: "3px",
                      }}
                    >
                      {getLabel(field, isRu)}
                    </div>
                    <div
                      style={{
                        fontSize: "9.5px",
                        color: "#0f172a",
                        lineHeight: "1.5",
                        wordBreak: "break-word",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {getAppointmentFieldValue(field.id, appointment, locale, isRu)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
    </div>
  );
}

function PdfPreview({
  patients,
  patientAppointments,
  selectedAppointments,
  activeFields,
  pdfRef,
  locale,
  isRu,
}) {
  const patientFields = activeFields.filter(
    (field) => !appointmentFieldIds.has(field.id),
  );
  const activeSections = patientSections
    .map((section) => ({
      ...section,
      activeFields: section.fields.filter((field) =>
        patientFields.some((activeField) => activeField.id === field.id),
      ),
    }))
    .filter((section) => section.activeFields.length > 0);
  const activeAppointmentFields = activeFields.filter((field) =>
    appointmentFieldIds.has(field.id),
  );
  return (
    <div
      ref={pdfRef}
      style={{
        width: "718px",
        padding: "20px 0",
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: "10px",
        color: "#1e293b",
        background: "#fff",
      }}
    >
      <div
        style={{
          fontSize: "17px",
          fontWeight: "bold",
          color: "#0a2e5d",
          marginBottom: "3px",
        }}
      >
        {isRu ? "Список пациентов" : "Patient List"}
      </div>
      <div style={{ fontSize: "9px", color: "#64748b", marginBottom: "18px" }}>
        {isRu ? "Экспорт:" : "Exported:"} {new Date().toLocaleString(locale)} | {patients.length}{" "}
        {isRu ? "записей" : "records"} | {activeFields.length} {isRu ? "полей" : "fields"}
      </div>
      {patients.map((patient, index) => {
        const appointments = getCompletedAppointments(
          patientAppointments[patient.email],
        ).filter(
          (appointment) =>
            selectedAppointments[patient.email]?.[
              getAppointmentKey(appointment)
            ],
        );
        return (
          <div
            key={patient._id || patient.email || index}
            style={{
              marginBottom: "20px",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              overflow: "hidden",
              pageBreakInside: "avoid",
            }}
          >
            <div
              style={{
                background: "#0a2e5d",
                color: "#fff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 14px",
                gap: "12px",
              }}
            >
              <span style={{ fontSize: "11px", fontWeight: "bold", flex: 1 }}>
                {index + 1}. {fullName(patient) || "-"}
              </span>
              <span
                style={{
                  background: "rgba(255,255,255,0.18)",
                  padding: "2px 10px",
                  borderRadius: "10px",
                  fontSize: "9px",
                  whiteSpace: "nowrap",
                }}
              >
                {patient.gender || ""}
              </span>
              <span style={{ fontSize: "9px", whiteSpace: "nowrap" }}>
                {fmtDate(patient.dateOfBirth, locale)}{" "}
                {patient.dateOfBirth
                  ? `(${calcAge(patient.dateOfBirth)} ${isRu ? "лет" : "yrs"})`
                  : ""}
              </span>
            </div>
            {activeSections.map((section, sectionIndex) => {
              // Filter to fields with non-empty values for this patient
              const filledFields = section.activeFields.filter(
                (field) => !!field.getValue(patient, locale, isRu),
              );
              if (!filledFields.length) return null;

              const pairs = [];
              for (let i = 0; i < filledFields.length; i += 2)
                pairs.push([filledFields[i], filledFields[i + 1] || null]);
              return (
                <div
                  key={section.id}
                  style={{
                    borderTop:
                      sectionIndex === 0 ? "none" : "2px solid #e2e8f0",
                    pageBreakInside: "avoid",
                  }}
                >
                  <div
                    style={{
                      background: "#0a2e5d",
                      padding: "5px 10px",
                      fontSize: "8.5px",
                      fontWeight: "bold",
                      color: "#ffffff",
                      letterSpacing: "0.5px",
                      textTransform: "uppercase",
                    }}
                  >
                    {getLabel(section, isRu)}
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <tbody>
                      {pairs.map(([fieldOne, fieldTwo], rowIndex) => (
                        <tr
                          key={`${section.id}-${rowIndex}`}
                          style={{
                            background: rowIndex % 2 === 0 ? "#fff" : "#f8fafc",
                          }}
                        >
                          <td
                            style={{
                              width: "22%",
                              padding: "4px 8px",
                              fontWeight: "bold",
                              color: "#475569",
                              background: "#f1f5f9",
                              borderBottom: "1px solid #eef2f7",
                              verticalAlign: "top",
                              fontSize: "9px",
                              lineHeight: "1.4",
                            }}
                          >
                            {getLabel(fieldOne, isRu)}
                          </td>
                          <td
                            style={{
                              width: "28%",
                              padding: "4px 8px",
                              color: "#0f172a",
                              borderBottom: "1px solid #eef2f7",
                              verticalAlign: "top",
                              fontSize: "9px",
                              lineHeight: "1.4",
                            }}
                          >
                            {fieldOne.getValue(patient, locale, isRu)}
                          </td>
                          <td
                            style={{
                              width: "22%",
                              padding: "4px 8px",
                              fontWeight: "bold",
                              color: "#475569",
                              background: "#f1f5f9",
                              borderBottom: "1px solid #eef2f7",
                              verticalAlign: "top",
                              fontSize: "9px",
                              lineHeight: "1.4",
                            }}
                          >
                            {fieldTwo ? getLabel(fieldTwo, isRu) : ""}
                          </td>
                          <td
                            style={{
                              width: "28%",
                              padding: "4px 8px",
                              color: "#0f172a",
                              borderBottom: "1px solid #eef2f7",
                              verticalAlign: "top",
                              fontSize: "9px",
                              lineHeight: "1.4",
                            }}
                          >
                            {fieldTwo ? fieldTwo.getValue(patient, locale, isRu) : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
            {activeAppointmentFields.length > 0 && (
              <div
                style={{
                  borderTop: "2px solid #e2e8f0",
                  pageBreakInside: "avoid",
                }}
              >
                <div
                  style={{
                    background: "#0a2e5d",
                    padding: "5px 10px",
                    fontSize: "8.5px",
                    fontWeight: "bold",
                    color: "#ffffff",
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                  }}
                >
                  {isRu ? "Завершённые приёмы" : "Completed Appointments"} ({appointments.length})
                </div>
                <AppointmentsExport
                  appointments={appointments}
                  activeFields={activeAppointmentFields}
                  locale={locale}
                  isRu={isRu}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function PatientExportPDFModal({ patients = [], onClose }) {
  const { i18n } = useTranslation();
  const isRu = i18n.language?.startsWith("ru");
  const locale = isRu ? "ru-RU" : "en-GB";
  const [selected, setSelected] = useState(buildDefaultSelection);
  const [patientAppointments, setPatientAppointments] = useState({});
  const [selectedAppointments, setSelectedAppointments] = useState({});
  const [aptLoading, setAptLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const pdfRef = useRef(null);

  useEffect(() => {
    if (!patients.length) {
      setPatientAppointments({});
      setSelectedAppointments({});
      return;
    }
    setAptLoading(true);
    Promise.all(
      patients.map((patient) =>
        patient.email
          ? api
              .get(
                `/applications/by-patient-email/${encodeURIComponent(patient.email)}`,
              )
              .then((response) => ({
                email: patient.email,
                data: response.data || [],
              }))
              .catch(() => ({ email: patient.email, data: [] }))
          : Promise.resolve({ email: patient.email || "", data: [] }),
      ),
    )
      .then((results) => {
        const appointmentsMap = {};
        const selectedMap = {};
        results.forEach(({ email, data }) => {
          appointmentsMap[email] = data;
          selectedMap[email] = {};
          getCompletedAppointments(data).forEach((appointment) => {
            selectedMap[email][getAppointmentKey(appointment)] = true;
          });
        });
        setPatientAppointments(appointmentsMap);
        setSelectedAppointments(selectedMap);
      })
      .finally(() => setAptLoading(false));
  }, [patients]);

  const toggleField = (id) =>
    setSelected((current) => ({ ...current, [id]: !current[id] }));
  const toggleSection = (section) => {
    const allSelected = section.fields.every((field) => selected[field.id]);
    const next = {};
    section.fields.forEach((field) => {
      next[field.id] = !allSelected;
    });
    setSelected((current) => ({ ...current, ...next }));
  };
  const toggleAppointment = (email, appointmentKey) =>
    setSelectedAppointments((current) => ({
      ...current,
      [email]: {
        ...(current[email] || {}),
        [appointmentKey]: !current[email]?.[appointmentKey],
      },
    }));
  const selectAll = () => {
    const next = {};
    sections.forEach((section) =>
      section.fields.forEach((field) => {
        next[field.id] = true;
      }),
    );
    setSelected(next);
  };
  const deselectAll = () => {
    const next = {};
    sections.forEach((section) =>
      section.fields.forEach((field) => {
        next[field.id] = false;
      }),
    );
    setSelected(next);
  };

  const activeFields = sections.flatMap((section) =>
    section.fields.filter((field) => selected[field.id]),
  );
  const selectedCount = Object.values(selected).filter(Boolean).length;
  const selectedAppointmentCount = Object.values(selectedAppointments).reduce(
    (sum, patientMap) =>
      sum + Object.values(patientMap || {}).filter(Boolean).length,
    0,
  );
  const hasActiveAppointmentFields = activeFields.some((field) =>
    appointmentFieldIds.has(field.id),
  );
  const exportDisabled =
    selectedCount === 0 ||
    patients.length === 0 ||
    exporting ||
    aptLoading;

  const handleExport = async () => {
    if (!activeFields.length || !pdfRef.current || exportDisabled) return;
    setExporting(true);
    try {
      await html2pdf()
        .from(pdfRef.current)
        .set({
          margin: 10,
          filename: `patients_${Date.now()}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, windowWidth: 718 },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["avoid-all", "css", "legacy"] },
        })
        .save();
      onClose();
    } finally {
      setExporting(false);
    }
  };

  const modal = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          width: "100%",
          maxWidth: "620px",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
          overflow: "hidden",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            background: "#0a2e5d",
            color: "#fff",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "15px",
              fontWeight: "600",
            }}
          >
            <FileText size={18} />
            <span>{isRu ? "Экспорт пациентов в PDF" : "Export Patients as PDF"}</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.8)",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <X size={18} />
          </button>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 20px",
            borderBottom: "1px solid #e5e7eb",
            background: "#f8fafc",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: "12px", color: "#6b7280" }}>
            {patients.length} {isRu ? "пациентов" : "patients"} •{" "}
            {selectedCount} {isRu ? "полей выбрано" : "fields selected"}{" "}
            {hasActiveAppointmentFields && !aptLoading
              ? `• ${selectedAppointmentCount} ${isRu ? "приёмов выбрано" : "appointments selected"}`
              : ""}
            {aptLoading ? (isRu ? " (загрузка приёмов...)" : " (loading appointments...)") : ""}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              onClick={selectAll}
              style={{
                background: "none",
                border: "none",
                color: "#0a2e5d",
                fontSize: "12px",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              {isRu ? "Выбрать все" : "Select all"}
            </button>
            <span style={{ color: "#d1d5db", fontSize: "12px" }}>|</span>
            <button
              onClick={deselectAll}
              style={{
                background: "none",
                border: "none",
                color: "#0a2e5d",
                fontSize: "12px",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              {isRu ? "Снять все" : "Deselect all"}
            </button>
          </div>
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "14px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            background: "#f1f5f9",
          }}
        >
          {sections.map((section) => {
            const allChecked = section.fields.every(
              (field) => selected[field.id],
            );
            const someChecked = section.fields.some(
              (field) => selected[field.id],
            );
            const checkedCount = section.fields.filter(
              (field) => selected[field.id],
            ).length;
            const isAppointmentSection = section.id === "appointments";
            return (
              <div
                key={section.id}
                style={{
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  overflow: "visible",
                }}
              >
                <div
                  onClick={() => toggleSection(section)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 14px",
                    background: isAppointmentSection ? "#f0f7ff" : "#f8fafc",
                    borderBottom: "1px solid #e2e8f0",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    {allChecked ? (
                      <CheckSquare size={15} style={{ color: "#0a2e5d" }} />
                    ) : someChecked ? (
                      <CheckSquare size={15} style={{ color: "#f59e0b" }} />
                    ) : (
                      <Square size={15} style={{ color: "#94a3b8" }} />
                    )}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: "13px",
                      fontWeight: "600",
                      color: isAppointmentSection ? "#0a2e5d" : "#1e293b",
                    }}
                  >
                    {getLabel(section, isRu)}
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "500",
                      color: "#64748b",
                      background: "#e2e8f0",
                      padding: "2px 8px",
                      borderRadius: "10px",
                    }}
                  >
                    {checkedCount}/{section.fields.length}
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    padding: "8px 10px 10px",
                  }}
                >
                  {section.fields.map((field) => (
                    <div
                      key={field.id}
                      onClick={() => toggleField(field.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "7px 8px",
                        borderRadius: "6px",
                        cursor: "pointer",
                        background: selected[field.id]
                          ? "#eff6ff"
                          : "transparent",
                      }}
                    >
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          flexShrink: 0,
                        }}
                      >
                        {selected[field.id] ? (
                          <CheckSquare size={14} style={{ color: "#0a2e5d" }} />
                        ) : (
                          <Square size={14} style={{ color: "#cbd5e1" }} />
                        )}
                      </span>
                      <span
                        style={{
                          fontSize: "12.5px",
                          color: "#374151",
                          lineHeight: "1.3",
                        }}
                      >
                        {getLabel(field, isRu)}
                      </span>
                    </div>
                  ))}
                </div>
                {isAppointmentSection && !aptLoading && (
                  <div
                    style={{
                      borderTop: "1px solid #e2e8f0",
                      padding: "10px",
                      background: "#f8fafc",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "#0a2e5d",
                        marginBottom: "8px",
                      }}
                    >
                      {isRu
                        ? "Выберите завершённые приёмы для экспорта"
                        : "Select completed appointments to export"}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        maxHeight: "180px",
                        overflowY: "auto",
                      }}
                    >
                      {patients.map((patient) => {
                        const completedAppointments = getCompletedAppointments(
                          patientAppointments[patient.email],
                        );
                        if (!completedAppointments.length) return null;
                        return (
                          <div
                            key={patient.email || patient._id}
                            style={{
                              background: "#fff",
                              border: "1px solid #dbe4f0",
                              borderRadius: "8px",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                padding: "8px 10px",
                                fontSize: "11px",
                                fontWeight: "600",
                                color: "#1e293b",
                                background: "#eff6ff",
                                borderBottom: "1px solid #dbe4f0",
                              }}
                            >
                              {fullName(patient) || patient.email}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                              }}
                            >
                              {completedAppointments.map((appointment) => {
                                const appointmentKey =
                                  getAppointmentKey(appointment);
                                const checked =
                                  !!selectedAppointments[patient.email]?.[
                                    appointmentKey
                                  ];
                                return (
                                  <label
                                    key={appointmentKey}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "8px",
                                      padding: "8px 10px",
                                      cursor: "pointer",
                                      borderTop: "1px solid #eef2f7",
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() =>
                                        toggleAppointment(
                                          patient.email,
                                          appointmentKey,
                                        )
                                      }
                                    />
                                    <span
                                      style={{
                                        fontSize: "11px",
                                        color: "#334155",
                                        lineHeight: "1.4",
                                      }}
                                    >
                                      {appointment.applicationId || "N/A"} •{" "}
                                      {fmtDate(appointment.date, locale) ||
                                        "N/A"}{" "}
                                      •{" "}
                                      {fmtTime(appointment.startTime) || "N/A"}{" "}
                                      •{" "}
                                      {appointment.doctors?.[0]?.doctorName ||
                                        appointment.doctorName ||
                                        "N/A"}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "10px",
            padding: "14px 20px",
            borderTop: "1px solid #e5e7eb",
            background: "#f8fafc",
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            disabled={exporting}
            style={{
              padding: "8px 18px",
              background: "none",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              color: "#6b7280",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            {isRu ? "Отмена" : "Cancel"}
          </button>
          <button
            onClick={handleExport}
            disabled={exportDisabled}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 20px",
              background: exportDisabled ? "#94a3b8" : "#0a2e5d",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: exportDisabled ? "not-allowed" : "pointer",
            }}
          >
            <FileText size={14} />
            {exporting
              ? (isRu ? "Создание..." : "Generating...")
              : (isRu ? "Экспорт PDF" : "Export PDF")}
          </button>
        </div>
      </div>
    </div>
  );

  const hiddenPreview =
    activeFields.length > 0 ? (
      <div
        style={{
          position: "fixed",
          left: "-9999px",
          top: 0,
          zIndex: -1,
          pointerEvents: "none",
        }}
      >
        <PdfPreview
          patients={patients}
          patientAppointments={patientAppointments}
          selectedAppointments={selectedAppointments}
          activeFields={activeFields}
          pdfRef={pdfRef}
          locale={locale}
          isRu={isRu}
        />
      </div>
    ) : null;
  return createPortal(
    <>
      {hiddenPreview}
      {modal}
    </>,
    document.body,
  );
}
