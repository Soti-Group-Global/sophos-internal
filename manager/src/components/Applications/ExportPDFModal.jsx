import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { X, FileText, CheckSquare, Square } from "lucide-react";
import { useTranslation } from "react-i18next";
import html2pdf from "html2pdf.js";
import "./ExportPDFModal.css";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(val, locale) {
  if (!val) return "";
  const d = new Date(val);
  return isNaN(d) ? String(val) : d.toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });
}

function fmtDateTime(val, locale) {
  if (!val) return "";
  const d = new Date(val);
  return isNaN(d) ? "" : d.toLocaleString(locale, { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtTimeRange(date, startTime, endTime, locale) {
  try {
    if (!date) return "";
    const dateObj = new Date(date);
    if (isNaN(dateObj)) return "";
    const formatted = dateObj.toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });
    const toTime = (v) => {
      if (!v) return null;
      if (/^\d{1,2}:\d{2}/.test(v)) return v.slice(0, 5);
      const d = new Date(v);
      return isNaN(d) ? null : d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    };
    const s = toTime(startTime);
    const e = toTime(endTime);
    if (s && e) return `${formatted}, ${s} – ${e}`;
    if (s) return `${formatted}, ${s}`;
    return formatted;
  } catch { return ""; }
}

function getLatestPayment(payments) {
  if (!Array.isArray(payments) || !payments.length) return null;
  const valid = payments.filter((p) => p.invoiceNumber && p.status);
  return valid.length ? valid[valid.length - 1] : null;
}

function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// Boolean → localised Yes/No
function bool(val, isRu) {
  if (val === true)  return isRu ? "Да"  : "Yes";
  if (val === false) return isRu ? "Нет" : "No";
  return "";
}

// ─── Field Sections — bilingual labels ───────────────────────────────────────

const FIELD_SECTIONS = [
  {
    id: "appointment",
    labelEn: "Appointment Info",
    labelRu: "Информация о приёме",
    fields: [
      { id: "applicationId",     labelEn: "Application ID",        labelRu: "Номер заявки",            getValue: (a)       => a.applicationId || "" },
      { id: "appointmentStatus", labelEn: "Appointment Status",    labelRu: "Статус приёма",           getValue: (a)       => a.appointmentStatus || "" },
      { id: "appointmentMode",   labelEn: "Appointment Mode",      labelRu: "Режим приёма",            getValue: (a)       => a.appointmentMode || "" },
      { id: "serviceType",       labelEn: "Service Type",          labelRu: "Тип услуги",              getValue: (a)       => a.serviceType || "" },
      { id: "branch",            labelEn: "Branch",                labelRu: "Филиал",                  getValue: (a)       => a.branch || "" },
      { id: "date",              labelEn: "Date",                  labelRu: "Дата",                    getValue: (a, l)    => fmtDate(a.date, l) },
      { id: "timeRange",         labelEn: "Time (Start – End)",    labelRu: "Время (начало – конец)",  getValue: (a, l)    => fmtTimeRange(a.date, a.startTime, a.endTime, l) },
      { id: "createdAt",         labelEn: "Created At",            labelRu: "Создано",                 getValue: (a, l)    => fmtDateTime(a.createdAt, l) },
      { id: "updatedAt",         labelEn: "Updated At",            labelRu: "Обновлено",               getValue: (a, l)    => fmtDateTime(a.updatedAt, l) },
    ],
  },
  {
    id: "patient",
    labelEn: "Patient Details",
    labelRu: "Данные пациента",
    fields: [
      { id: "patientName",  labelEn: "Patient Name",  labelRu: "ФИО пациента",   getValue: (a)    => a.patientName || "" },
      { id: "patientEmail", labelEn: "Patient Email", labelRu: "Email пациента", getValue: (a)    => a.patient?.email || a.patientEmail || "" },
      { id: "patientPhone", labelEn: "Patient Phone", labelRu: "Телефон",        getValue: (a)    => a.patient?.phoneNumber || "" },
      { id: "patientDOB",   labelEn: "Date of Birth", labelRu: "Дата рождения",  getValue: (a, l) => fmtDate(a.patient?.dateOfBirth, l) },
    ],
  },
  {
    id: "consultation",
    labelEn: "Doctor & Service",
    labelRu: "Врач и услуга",
    fields: [
      { id: "doctorName",  labelEn: "Doctor Name",  labelRu: "ФИО врача",       getValue: (a) => a.doctorName || a.doctors?.[0]?.doctorName || "" },
      { id: "doctorEmail", labelEn: "Doctor Email", labelRu: "Email врача",     getValue: (a) => a.doctor?.email || a.doctors?.[0]?.doctorEmail || "" },
      { id: "specialty",   labelEn: "Specialty",    labelRu: "Специальность",   getValue: (a) => a.specialty || a.doctor?.specialty || "" },
      { id: "serviceName", labelEn: "Service Name", labelRu: "Название услуги", getValue: (a) => a.doctors?.[0]?.serviceName || "" },
    ],
  },
  {
    id: "payment",
    labelEn: "Payment Details",
    labelRu: "Оплата",
    fields: [
      { id: "paymentStatus", labelEn: "Payment Status", labelRu: "Статус оплаты",  getValue: (a)    => getLatestPayment(a.payments)?.status || "" },
      { id: "invoiceNumber", labelEn: "Invoice Number",  labelRu: "Номер счёта",   getValue: (a)    => getLatestPayment(a.payments)?.invoiceNumber || "" },
      { id: "amount",        labelEn: "Amount",          labelRu: "Сумма",         getValue: (a)    => { const p = getLatestPayment(a.payments); return p ? String(p.amount ?? "") : ""; } },
      { id: "discount",      labelEn: "Discount",        labelRu: "Скидка",        getValue: (a)    => { const p = getLatestPayment(a.payments); return p ? String(p.discount ?? 0) : ""; } },
      { id: "finalAmount",   labelEn: "Final Amount",    labelRu: "Итоговая сумма",getValue: (a)    => { const p = getLatestPayment(a.payments); return p ? String(p.finalAmount ?? "") : ""; } },
      { id: "currency",      labelEn: "Currency",        labelRu: "Валюта",        getValue: (a)    => getLatestPayment(a.payments)?.currency || "" },
      { id: "paymentType",   labelEn: "Payment Type",    labelRu: "Тип оплаты",    getValue: (a)    => getLatestPayment(a.payments)?.type || "" },
      { id: "paidAt",        labelEn: "Paid At",         labelRu: "Дата оплаты",   getValue: (a, l) => fmtDateTime(getLatestPayment(a.payments)?.paidAt, l) },
    ],
  },
  {
    id: "serviceOrder",
    labelEn: "Service Order",
    labelRu: "Заказ услуги",
    fields: [
      { id: "entranceDiagnosis",   labelEn: "Entrance Diagnosis",    labelRu: "Входящий диагноз",         getValue: (a) => a.serviceOrders?.[0]?.entranceDiagnosis || "" },
      { id: "briefHistory",        labelEn: "Brief History",         labelRu: "Краткий анамнез",          getValue: (a) => a.serviceOrders?.[0]?.briefHistory || "" },
      { id: "promoCode",           labelEn: "Promo Code",            labelRu: "Промокод",                 getValue: (a) => a.serviceOrders?.[0]?.promoCode || "" },
      { id: "expertReviewService", labelEn: "Expert Review Service", labelRu: "Услуга экспертной оценки", getValue: (a) => a.serviceOrders?.[0]?.expertReviewService || "" },
      { id: "pathologicalService", labelEn: "Pathological Service",  labelRu: "Патологическая услуга",    getValue: (a) => a.serviceOrders?.[0]?.pathologicaService || "" },
    ],
  },
  {
    id: "followUp",
    labelEn: "Follow-up",
    labelRu: "Повторный приём",
    fields: [
      { id: "followUpNeeded",  labelEn: "Follow-up Needed",  labelRu: "Требуется повторный приём", getValue: (a, _, isRu) => bool(a.followUp?.needed,  isRu) },
      { id: "followUpBooked",  labelEn: "Follow-up Booked",  labelRu: "Записан повторный приём",   getValue: (a, _, isRu) => bool(a.followUp?.booked,   isRu) },
      { id: "followUpComment", labelEn: "Follow-up Comment", labelRu: "Комментарий",               getValue: (a)          => a.followUp?.comment || "" },
    ],
  },
  {
    id: "meeting",
    labelEn: "Meeting",
    labelRu: "Встреча",
    fields: [
      { id: "meetingStatus",    labelEn: "Meeting Status",     labelRu: "Статус встречи",   getValue: (a)    => a.meeting?.status || "" },
      { id: "meetingStartedAt", labelEn: "Meeting Started At", labelRu: "Начало встречи",   getValue: (a, l) => fmtDateTime(a.meeting?.startedAt, l) },
      { id: "meetingEndedAt",   labelEn: "Meeting Ended At",   labelRu: "Конец встречи",    getValue: (a, l) => fmtDateTime(a.meeting?.endedAt, l) },
      { id: "meetingNotes",     labelEn: "Meeting Notes",      labelRu: "Заметки встречи",  getValue: (a)    => a.meeting?.notes || "" },
    ],
  },
  {
    id: "medicalHistory",
    labelEn: "Medical History",
    labelRu: "Медицинская история",
    fields: [
      { id: "isFirstAppt",          labelEn: "First Appointment",      labelRu: "Первичный приём",           getValue: (a, _, isRu) => bool(a.historyForm?.isFirstAppointment,      isRu) },
      { id: "isRepetitiveAppt",     labelEn: "Repetitive Appointment", labelRu: "Повторный приём",           getValue: (a, _, isRu) => bool(a.historyForm?.isRepetitiveAppointment,  isRu) },
      { id: "complaints",           labelEn: "Complaints",             labelRu: "Жалобы",                    getValue: (a) => stripHtml(a.historyForm?.complaints?.value) },
      { id: "anamnesisMorbi",       labelEn: "Anamnesis Morbi",        labelRu: "Анамнез заболевания",       getValue: (a) => stripHtml(a.historyForm?.anamnesisMorbi?.value) },
      { id: "anamnesisVitae",       labelEn: "Anamnesis Vitae",        labelRu: "Анамнез жизни",             getValue: (a) => stripHtml(a.historyForm?.anamnesisVitae?.value) },
      { id: "preliminaryDiagnosis", labelEn: "Preliminary Diagnosis",  labelRu: "Предварительный диагноз",   getValue: (a) => stripHtml(a.historyForm?.preliminaryDiagnosis?.value) },
      { id: "examinationPlan",      labelEn: "Examination Plan",       labelRu: "План обследования",         getValue: (a) => stripHtml(a.historyForm?.examinationPlan?.value) },
      { id: "examinationResults",   labelEn: "Examination Results",    labelRu: "Результаты обследования",   getValue: (a) => stripHtml(a.historyForm?.examinationResults?.value) },
      { id: "clinicalDiagnosis",    labelEn: "Clinical Diagnosis",     labelRu: "Клинический диагноз",       getValue: (a) => stripHtml(a.historyForm?.clinicalDiagnosis?.value) },
      { id: "treatmentPlan",        labelEn: "Treatment Plan",         labelRu: "План лечения",              getValue: (a) => stripHtml(a.historyForm?.treatmentPlan?.value) },
    ],
  },
];

// Helper: pick label by language
function lbl(field, isRu) {
  return isRu ? field.labelRu : field.labelEn;
}

// ─── Default selection ────────────────────────────────────────────────────────

const DEFAULT_CHECKED = new Set([
  "applicationId", "appointmentStatus", "appointmentMode", "serviceType",
  "branch", "timeRange",
  "patientName", "patientEmail", "patientPhone",
  "doctorName", "specialty", "serviceName",
  "paymentStatus", "invoiceNumber", "finalAmount", "currency",
]);

function buildDefaultSelection() {
  const sel = {};
  FIELD_SECTIONS.forEach((sec) =>
    sec.fields.forEach((f) => { sel[f.id] = DEFAULT_CHECKED.has(f.id); })
  );
  return sel;
}

// ─── Shared table cell styles ─────────────────────────────────────────────────
const tdLbl = { width: "22%", padding: "4px 8px", fontWeight: "bold", color: "#475569", background: "#f1f5f9", borderBottom: "1px solid #eef2f7", verticalAlign: "top", fontSize: "9px", lineHeight: "1.4" };
const tdVal = { width: "28%", padding: "4px 8px", color: "#0f172a", borderBottom: "1px solid #eef2f7", verticalAlign: "top", fontSize: "9px", lineHeight: "1.4" };

// ─── PDF Preview (real DOM element → html2canvas) ─────────────────────────────

function PdfPreview({ applications, activeFields, pdfRef, isRu, locale }) {
  const now        = new Date().toLocaleString(locale);
  const title      = isRu ? "Список заявок"  : "Applications List";
  const exportedBy = isRu ? "Экспортировано" : "Exported";
  const records    = isRu ? "записей"         : "records";
  const fieldsLbl  = isRu ? "полей"           : "fields";
  const empty      = "—";

  // Build per-section field groups (only sections that have ≥1 selected field)
  const activeSections = FIELD_SECTIONS.map((sec) => ({
    ...sec,
    activeFields: sec.fields.filter((f) => activeFields.find((af) => af.id === f.id)),
  })).filter((sec) => sec.activeFields.length > 0);

  return (
    <div
      ref={pdfRef}
      style={{
        /* A4 portrait 210mm − 2×10mm margins = 190mm ≈ 718px at 96 dpi */
        width: "718px",
        padding: "20px 0",
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: "10px",
        color: "#1e293b",
        background: "#fff",
      }}
    >
      {/* Document title */}
      <div style={{ fontSize: "17px", fontWeight: "bold", color: "#0a2e5d", marginBottom: "3px" }}>
        {title}
      </div>
      <div style={{ fontSize: "9px", color: "#64748b", marginBottom: "18px" }}>
        {exportedBy}: {now}&nbsp;&nbsp;|&nbsp;&nbsp;{applications.length} {records}&nbsp;&nbsp;|&nbsp;&nbsp;{activeFields.length} {fieldsLbl}
      </div>

      {/* One block per application */}
      {applications.map((app, appIdx) => (
        <div
          key={app._id || appIdx}
          style={{ marginBottom: "20px", border: "1px solid #cbd5e1", borderRadius: "8px", overflow: "hidden" }}
        >
          {/* ── Application master header ── */}
          <div style={{
            background: "#0a2e5d", color: "#fff",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "8px 14px", gap: "12px",
          }}>
            <span style={{ fontSize: "11px", fontWeight: "bold", flex: 1 }}>
              {appIdx + 1}.&nbsp;&nbsp;{app.applicationId || empty}
            </span>
            <span style={{ background: "rgba(255,255,255,0.18)", padding: "2px 10px", borderRadius: "10px", fontSize: "9px", whiteSpace: "nowrap" }}>
              {app.appointmentStatus || ""}
            </span>
            <span style={{ fontSize: "9px", whiteSpace: "nowrap" }}>
              {fmtTimeRange(app.date, app.startTime, app.endTime, locale)}
            </span>
          </div>

          {/* ── One section per data category ── */}
          {activeSections.map((sec, secIdx) => {
            const pairs = [];
            for (let i = 0; i < sec.activeFields.length; i += 2) {
              pairs.push([sec.activeFields[i], sec.activeFields[i + 1] || null]);
            }
            return (
              <div key={sec.id} style={{ borderTop: secIdx === 0 ? "none" : "2px solid #e2e8f0" }}>
                {/* Section label row */}
                <div style={{
                  background: "#0a2e5d",
                  padding: "5px 10px",
                  fontSize: "8.5px",
                  fontWeight: "bold",
                  color: "#ffffff",
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                  borderBottom: "none",
                }}>
                  {lbl(sec, isRu)}
                </div>

                {/* Field rows */}
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {pairs.map(([f1, f2], rowIdx) => (
                      <tr key={rowIdx} style={{ background: rowIdx % 2 === 0 ? "#fff" : "#f8fafc" }}>
                        <td style={tdLbl}>{lbl(f1, isRu)}</td>
                        <td style={tdVal}>{f1.getValue(app, locale, isRu) || empty}</td>
                        <td style={tdLbl}>{f2 ? lbl(f2, isRu) : ""}</td>
                        <td style={tdVal}>{f2 ? (f2.getValue(app, locale, isRu) || empty) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExportPDFModal({ applications = [], onClose }) {
  const { i18n } = useTranslation();
  const isRu   = i18n.language?.startsWith("ru");
  const locale = isRu ? "ru-RU" : "en-GB";

  const [selected, setSelected] = useState(buildDefaultSelection);
  const [exporting, setExporting] = useState(false);
  const pdfRef = useRef(null);

  const toggleField = (id) => setSelected((p) => ({ ...p, [id]: !p[id] }));

  const toggleSection = (section) => {
    const allOn = section.fields.every((f) => selected[f.id]);
    const patch = {};
    section.fields.forEach((f) => { patch[f.id] = !allOn; });
    setSelected((p) => ({ ...p, ...patch }));
  };

  const selectAll = () => {
    const patch = {};
    FIELD_SECTIONS.forEach((s) => s.fields.forEach((f) => { patch[f.id] = true; }));
    setSelected(patch);
  };

  const deselectAll = () => {
    const patch = {};
    FIELD_SECTIONS.forEach((s) => s.fields.forEach((f) => { patch[f.id] = false; }));
    setSelected(patch);
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  const activeFields = [];
  FIELD_SECTIONS.forEach((sec) =>
    sec.fields.forEach((f) => { if (selected[f.id]) activeFields.push(f); })
  );

  const handleExport = async () => {
    if (!activeFields.length || !pdfRef.current) return;
    setExporting(true);
    try {
      await html2pdf()
        .from(pdfRef.current)
        .set({
          margin: 10,
          filename: `applications_${Date.now()}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, windowWidth: 718 },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .save();
      onClose();
    } finally {
      setExporting(false);
    }
  };

  const modal = (
    <div className="epdf-overlay" onClick={onClose}>
      <div className="epdf-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="epdf-header">
          <div className="epdf-header-left">
            <FileText size={18} />
            <span>{isRu ? "Экспорт в PDF" : "Export as PDF"}</span>
          </div>
          <button className="epdf-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Sub-header */}
        <div className="epdf-subheader">
          <span className="epdf-meta">
            {applications.length} {isRu ? "заявок" : "applications"}&nbsp;&bull;&nbsp;
            {selectedCount} {isRu ? "полей выбрано" : "fields selected"}
          </span>
          <div className="epdf-bulk-actions">
            <button className="epdf-link-btn" onClick={selectAll}>
              {isRu ? "Выбрать все" : "Select all"}
            </button>
            <span className="epdf-divider">|</span>
            <button className="epdf-link-btn" onClick={deselectAll}>
              {isRu ? "Снять все" : "Deselect all"}
            </button>
          </div>
        </div>

        {/* Sections */}
        <div className="epdf-body">
          {FIELD_SECTIONS.map((section) => {
            const allChecked  = section.fields.every((f) => selected[f.id]);
            const someChecked = section.fields.some((f) => selected[f.id]);
            const checkedCount = section.fields.filter((f) => selected[f.id]).length;

            return (
              <div key={section.id} className="epdf-section">
                <div className="epdf-section-header" onClick={() => toggleSection(section)}>
                  <span className="epdf-section-check">
                    {allChecked
                      ? <CheckSquare size={15} className="epdf-check-icon checked" />
                      : someChecked
                        ? <CheckSquare size={15} className="epdf-check-icon partial" />
                        : <Square size={15} className="epdf-check-icon" />}
                  </span>
                  <span className="epdf-section-label">{lbl(section, isRu)}</span>
                  <span className="epdf-section-count">{checkedCount}/{section.fields.length}</span>
                </div>

                <div className="epdf-fields-grid">
                  {section.fields.map((field) => (
                    <div
                      key={field.id}
                      className={`epdf-field-item${selected[field.id] ? " epdf-field-item--on" : ""}`}
                      onClick={() => toggleField(field.id)}
                    >
                      <span className="epdf-field-check">
                        {selected[field.id]
                          ? <CheckSquare size={14} className="epdf-field-icon checked" />
                          : <Square size={14} className="epdf-field-icon" />}
                      </span>
                      <span className="epdf-field-label">{lbl(field, isRu)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="epdf-footer">
          <button className="epdf-cancel-btn" onClick={onClose} disabled={exporting}>
            {isRu ? "Отмена" : "Cancel"}
          </button>
          <button
            className="epdf-export-btn"
            onClick={handleExport}
            disabled={selectedCount === 0 || applications.length === 0 || exporting}
          >
            <FileText size={14} />
            {exporting
              ? (isRu ? "Генерация..." : "Generating...")
              : (isRu ? "Экспорт PDF"  : "Export PDF")}
          </button>
        </div>
      </div>
    </div>
  );

  // Hidden — must be in DOM for html2canvas to capture it
  const hiddenPreview = activeFields.length > 0 ? (
    <div style={{ position: "fixed", left: "-9999px", top: 0, zIndex: -1, pointerEvents: "none" }}>
      <PdfPreview
        applications={applications}
        activeFields={activeFields}
        pdfRef={pdfRef}
        isRu={isRu}
        locale={locale}
      />
    </div>
  ) : null;

  return createPortal(
    <>{hiddenPreview}{modal}</>,
    document.body
  );
}
