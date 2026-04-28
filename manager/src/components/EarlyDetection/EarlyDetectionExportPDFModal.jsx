import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { X, FileText, CheckSquare, Square } from "lucide-react";
import { useTranslation } from "react-i18next";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import "../Applications/ExportPDFModal.css";

function toStableDate(value) {
  if (!value) return null;

  if (typeof value === "string") {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const [, y, mo, d] = m;
      return new Date(Number(y), Number(mo) - 1, Number(d));
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function fmtDate(value, locale) {
  const date = toStableDate(value);
  if (!date) return "";
  return date.toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });
}

function fmtDateTime(value, locale) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toMoney(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? `${num.toLocaleString()} ₽` : "";
}

function stripHtml(value) {
  if (!value) return "";
  return String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function getPatient(booking) {
  return booking?.patient || booking?.customer || null;
}

function readText(value) {
  if (!value) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") {
    if (typeof value.en === "string") return value.en;
    if (typeof value.ru === "string") return value.ru;
    const firstText = Object.values(value).find((v) => typeof v === "string" || typeof v === "number");
    return firstText !== undefined ? String(firstText) : "";
  }
  return "";
}

function getDoctorDisplayName(doctor) {
  if (!doctor) return "";
  if (typeof doctor === "string") return doctor;

  const fullName = [
    readText(doctor.lastName),
    readText(doctor.firstName),
    readText(doctor.middleName),
  ].filter(Boolean).join(" ").trim();

  if (fullName) return fullName;
  return readText(doctor.name) || readText(doctor.email) || "";
}

const FIELD_SECTIONS = [
  {
    id: "booking",
    labelEn: "Booking Info",
    labelRu: "Информация о записи",
    fields: [
      { id: "invoiceNumber", labelEn: "Invoice Number", labelRu: "Номер счёта", getValue: (b) => b.invoiceNumber || "" },
      { id: "bookingNumber", labelEn: "Booking Number", labelRu: "Номер записи", getValue: (b) => b.bookingNumber || "" },
      { id: "bookingStatus", labelEn: "Booking Status", labelRu: "Статус записи", getValue: (b) => b.status || "" },
      { id: "createdAt", labelEn: "Created At", labelRu: "Создано", getValue: (b, l) => fmtDateTime(b.createdAt, l) },
      { id: "appointmentDate", labelEn: "Appointment Date", labelRu: "Дата приёма", getValue: (b, l) => fmtDate(b.appointmentDate, l) },
      { id: "appointmentTime", labelEn: "Appointment Time", labelRu: "Время приёма", getValue: (b) => b.appointmentTime || "" },
    ],
  },
  {
    id: "patient",
    labelEn: "Patient Details",
    labelRu: "Данные пациента",
    fields: [
      {
        id: "patientName",
        labelEn: "Patient Name",
        labelRu: "ФИО пациента",
        getValue: (b) => {
          const p = getPatient(b);
          if (!p) return "";
          return [p.lastName, p.firstName, p.middleName].filter(Boolean).join(" ");
        },
      },
      { id: "patientEmail", labelEn: "Patient Email", labelRu: "Email пациента", getValue: (b) => getPatient(b)?.email || "" },
      {
        id: "patientPhone",
        labelEn: "Patient Phone",
        labelRu: "Телефон пациента",
        getValue: (b) => getPatient(b)?.phone || getPatient(b)?.phoneNumber || "",
      },
      { id: "patientDOB", labelEn: "Date of Birth", labelRu: "Дата рождения", getValue: (b, l) => fmtDate(getPatient(b)?.dateOfBirth, l) },
    ],
  },
  {
    id: "package",
    labelEn: "Package & Add-ons",
    labelRu: "Пакет и доп. опции",
    fields: [
      { id: "packageName", labelEn: "Package", labelRu: "Пакет", getValue: (b) => b.package?.name || "" },
      { id: "packagePrice", labelEn: "Package Price", labelRu: "Стоимость пакета", getValue: (b) => toMoney(b.package?.price) },
      {
        id: "addons",
        labelEn: "Add-ons",
        labelRu: "Дополнительные опции",
        getValue: (b) => (b.addOns || []).map((a) => `${a.name} (${toMoney(a.price)})`).join(", "),
      },
      { id: "totalAmount", labelEn: "Total Amount", labelRu: "Общая сумма", getValue: (b) => toMoney(b.totalAmount || b.package?.price) },
    ],
  },
  {
    id: "payment",
    labelEn: "Payment Details",
    labelRu: "Информация об оплате",
    fields: [
      { id: "paymentStatus", labelEn: "Payment Status", labelRu: "Статус оплаты", getValue: (b) => b.payment?.status || "" },
      { id: "paymentMethod", labelEn: "Payment Method", labelRu: "Способ оплаты", getValue: (b) => b.payment?.paymentMethod || "" },
      { id: "paymentLink", labelEn: "Payment Link", labelRu: "Ссылка на оплату", getValue: (b) => b.payment?.paymentLink || "" },
      { id: "paidAt", labelEn: "Paid At", labelRu: "Дата оплаты", getValue: (b, l) => fmtDateTime(b.payment?.paidAt, l) },
      { id: "transactionId", labelEn: "Transaction ID", labelRu: "ID транзакции", getValue: (b) => b.payment?.transactionId || "" },
    ],
  },
  {
    id: "schedule",
    labelEn: "Schedule Summary",
    labelRu: "Сводка расписания",
    fields: [
      {
        id: "specialistCount",
        labelEn: "Specialist Consultations",
        labelRu: "Консультаций специалистов",
        getValue: (b) => String((b.schedule?.specialistConsultations || []).length || 0),
      },
      {
        id: "labTestsCount",
        labelEn: "Laboratory Tests",
        labelRu: "Лабораторных тестов",
        getValue: (b) => String((b.schedule?.laboratoryTests || []).length || 0),
      },
      {
        id: "instrumentalCount",
        labelEn: "Studies/Manipulations",
        labelRu: "Исследований/манипуляций",
        getValue: (b) => String((b.schedule?.instrumentalAnalysis || []).length || 0),
      },
      {
        id: "internalNotesCount",
        labelEn: "Internal Notes",
        labelRu: "Внутренних заметок",
        getValue: (b) => String((b.internalNotes || []).length || 0),
      },
    ],
  },
  {
    id: "specialistDetails",
    labelEn: "Specialist Consultation Details",
    labelRu: "Детали консультаций специалистов",
    fields: [
      {
        id: "specialistConsultationDetails",
        labelEn: "Include all specialist consultation fields",
        labelRu: "Включить все поля консультаций специалистов",
        getValue: () => "",
      },
    ],
  },
];

function labelFor(item, isRu) {
  return isRu ? item.labelRu : item.labelEn;
}

const DEFAULT_CHECKED = new Set([
  "invoiceNumber",
  "bookingStatus",
  "createdAt",
  "appointmentDate",
  "patientName",
  "patientEmail",
  "patientPhone",
  "packageName",
  "totalAmount",
  "paymentStatus",
  "paymentMethod",
  "paidAt",
  "specialistConsultationDetails",
]);

function buildDefaultSelection() {
  const selected = {};
  FIELD_SECTIONS.forEach((section) => {
    section.fields.forEach((field) => {
      selected[field.id] = DEFAULT_CHECKED.has(field.id);
    });
  });
  return selected;
}

const tdLbl = {
  width: "22%",
  padding: "4px 8px",
  fontWeight: "bold",
  color: "#475569",
  background: "#f1f5f9",
  borderBottom: "1px solid #eef2f7",
  verticalAlign: "top",
  fontSize: "9px",
  lineHeight: "1.4",
};
const tdVal = {
  width: "28%",
  padding: "4px 8px",
  color: "#0f172a",
  borderBottom: "1px solid #eef2f7",
  verticalAlign: "top",
  fontSize: "9px",
  lineHeight: "1.4",
};

function PdfPreview({ bookings, activeFields, pdfRef, isRu, locale }) {
  const now = new Date().toLocaleString(locale);
  const title = isRu ? "Записи ранней диагностики" : "Early Detection Bookings";
  const exportedBy = isRu ? "Экспортировано" : "Exported";
  const records = isRu ? "записей" : "records";
  const fieldsLabel = isRu ? "полей" : "fields";
  const empty = "—";

  const activeSections = FIELD_SECTIONS.map((section) => ({
    ...section,
    activeFields: section.fields.filter((field) => activeFields.find((af) => af.id === field.id)),
  })).filter((section) => section.activeFields.length > 0);
  const includeSpecialistDetails = activeFields.some((field) => field.id === "specialistConsultationDetails");

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
      <div style={{ fontSize: "17px", fontWeight: "bold", color: "#0a2e5d", marginBottom: "3px" }}>
        {title}
      </div>
      <div style={{ fontSize: "9px", color: "#64748b", marginBottom: "18px" }}>
        {exportedBy}: {now}&nbsp;&nbsp;|&nbsp;&nbsp;{bookings.length} {records}&nbsp;&nbsp;|&nbsp;&nbsp;{activeFields.length} {fieldsLabel}
      </div>

      {bookings.map((booking, idx) => (
        <div
          key={booking?._id || booking?.bookingNumber || idx}
          className="ed-export-booking-card"
          style={{
            marginBottom: "20px",
            border: "1px solid #cbd5e1",
            borderRadius: "8px",
            overflow: "hidden",
            pageBreakBefore: idx === 0 ? "auto" : "always",
            breakBefore: idx === 0 ? "auto" : "page",
            pageBreakInside: "avoid",
            breakInside: "avoid-page",
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
              {idx + 1}.&nbsp;&nbsp;{booking?.invoiceNumber || booking?.bookingNumber || empty}
            </span>
            <span style={{ background: "rgba(255,255,255,0.18)", padding: "2px 10px", borderRadius: "10px", fontSize: "9px", whiteSpace: "nowrap" }}>
              {booking?.payment?.status || empty}
            </span>
            <span style={{ fontSize: "9px", whiteSpace: "nowrap" }}>
              {fmtDate(booking?.appointmentDate, locale)}
            </span>
          </div>

          {activeSections.map((section, secIdx) => {
            if (section.id === "specialistDetails") return null;

            const pairs = [];
            for (let i = 0; i < section.activeFields.length; i += 2) {
              pairs.push([section.activeFields[i], section.activeFields[i + 1] || null]);
            }

            return (
              <div key={section.id} style={{ borderTop: secIdx === 0 ? "none" : "2px solid #e2e8f0" }}>
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
                  {labelFor(section, isRu)}
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {pairs.map(([f1, f2], rowIdx) => (
                      <tr key={rowIdx} style={{ background: rowIdx % 2 === 0 ? "#fff" : "#f8fafc" }}>
                        <td style={tdLbl}>{labelFor(f1, isRu)}</td>
                        <td style={tdVal}>{f1.getValue(booking, locale, isRu) || empty}</td>
                        <td style={tdLbl}>{f2 ? labelFor(f2, isRu) : ""}</td>
                        <td style={tdVal}>{f2 ? (f2.getValue(booking, locale, isRu) || empty) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          {includeSpecialistDetails && (
            <div style={{ borderTop: "2px solid #e2e8f0" }}>
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
                {isRu ? "Детали консультаций специалистов" : "Specialist Consultation Details"}
              </div>

              {(booking?.schedule?.specialistConsultations || []).length === 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    <tr>
                      <td style={tdLbl}>{isRu ? "Консультации" : "Consultations"}</td>
                      <td style={{ ...tdVal, width: "78%" }} colSpan={3}>{empty}</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                (booking?.schedule?.specialistConsultations || []).map((consultation, consultationIndex) => {
                  const doctorName = getDoctorDisplayName(consultation?.doctor);

                  const historyForm = consultation?.historyForm || {};
                  const rows = [
                    [isRu ? "Специалист" : "Specialist", consultation?.title || ""],
                    [isRu ? "Статус" : "Status", consultation?.isCompleted ? (isRu ? "Завершено" : "Completed") : (isRu ? "В процессе" : "Pending")],
                    [isRu ? "Дата" : "Date", fmtDate(consultation?.date, locale)],
                    [isRu ? "Время" : "Time", [consultation?.startTime, consultation?.endTime].filter(Boolean).join(" - ")],
                    [isRu ? "Врач" : "Doctor", doctorName],
                    [isRu ? "Первичный приём" : "First appointment", historyForm?.isFirstAppointment ? (isRu ? "Да" : "Yes") : (isRu ? "Нет" : "No")],
                    [isRu ? "Повторный приём" : "Repetitive appointment", historyForm?.isRepetitiveAppointment ? (isRu ? "Да" : "Yes") : (isRu ? "Нет" : "No")],
                    [isRu ? "Жалобы" : "Complaints", stripHtml(historyForm?.complaints?.value)],
                    [isRu ? "Анамнез заболевания" : "Anamnesis morbi", stripHtml(historyForm?.anamnesisMorbi?.value)],
                    [isRu ? "Анамнез жизни" : "Anamnesis vitae", stripHtml(historyForm?.anamnesisVitae?.value)],
                    [isRu ? "Физикальное обследование" : "Physical exam", stripHtml(historyForm?.physicalExam?.value)],
                    [isRu ? "Дыхательная система" : "Respiratory", stripHtml(historyForm?.respiratory?.value)],
                    [isRu ? "Сердечно-сосудистая система" : "Circulatory", stripHtml(historyForm?.circulatory?.value)],
                    [isRu ? "Пищеварительная система" : "Digestive", stripHtml(historyForm?.digestive?.value)],
                    [isRu ? "Мочевыделительная система" : "Urinary", stripHtml(historyForm?.urinary?.value)],
                    [isRu ? "Эндокринная система" : "Endocrine", stripHtml(historyForm?.endocrine?.value)],
                    [isRu ? "Предварительный диагноз" : "Preliminary diagnosis", stripHtml(historyForm?.preliminaryDiagnosis?.value)],
                    [isRu ? "План обследования" : "Examination plan", stripHtml(historyForm?.examinationPlan?.value)],
                    [isRu ? "Результаты обследования" : "Examination results", stripHtml(historyForm?.examinationResults?.value)],
                    [isRu ? "Клинический диагноз" : "Clinical diagnosis", stripHtml(historyForm?.clinicalDiagnosis?.value)],
                    [isRu ? "План лечения" : "Treatment plan", stripHtml(historyForm?.treatmentPlan?.value)],
                    [isRu ? "Консультация специалиста" : "Specialist consultation", stripHtml(historyForm?.specialistConsultation?.value)],
                  ];

                  return (
                    <div key={consultation?._id || consultationIndex} style={{ borderTop: consultationIndex === 0 ? "none" : "1px solid #e2e8f0" }}>
                      <div
                        style={{
                          background: "#f8fafc",
                          padding: "6px 10px",
                          fontSize: "8px",
                          fontWeight: "bold",
                          color: "#334155",
                          textTransform: "uppercase",
                          letterSpacing: "0.4px",
                        }}
                      >
                        {isRu ? `Консультация #${consultationIndex + 1}` : `Consultation #${consultationIndex + 1}`}
                      </div>

                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <tbody>
                          {rows.map(([label, value], rowIndex) => (
                            <tr key={`${consultationIndex}-${rowIndex}`} style={{ background: rowIndex % 2 === 0 ? "#fff" : "#f8fafc" }}>
                              <td style={tdLbl}>{label}</td>
                              <td style={{ ...tdVal, width: "78%" }} colSpan={3}>{value || empty}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function EarlyDetectionExportPDFModal({ bookings = [], onClose }) {
  const { i18n } = useTranslation();
  const isRu = i18n.language?.startsWith("ru");
  const locale = isRu ? "ru-RU" : "en-GB";

  const [selected, setSelected] = useState(buildDefaultSelection);
  const [exporting, setExporting] = useState(false);
  const pdfRef = useRef(null);

  const toggleField = (id) => setSelected((prev) => ({ ...prev, [id]: !prev[id] }));

  const toggleSection = (section) => {
    const allSelected = section.fields.every((field) => selected[field.id]);
    const patch = {};
    section.fields.forEach((field) => {
      patch[field.id] = !allSelected;
    });
    setSelected((prev) => ({ ...prev, ...patch }));
  };

  const selectAll = () => {
    const patch = {};
    FIELD_SECTIONS.forEach((section) => section.fields.forEach((field) => {
      patch[field.id] = true;
    }));
    setSelected(patch);
  };

  const deselectAll = () => {
    const patch = {};
    FIELD_SECTIONS.forEach((section) => section.fields.forEach((field) => {
      patch[field.id] = false;
    }));
    setSelected(patch);
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  const activeFields = [];
  FIELD_SECTIONS.forEach((section) => {
    section.fields.forEach((field) => {
      if (selected[field.id]) activeFields.push(field);
    });
  });

  const handleExport = async () => {
    if (!activeFields.length || !pdfRef.current) return;
    setExporting(true);
    try {
      const cards = Array.from(pdfRef.current.querySelectorAll(".ed-export-booking-card"));
      if (!cards.length) return;

      const pdf = new jsPDF("p", "mm", "a4");
      const margin = 10;
      const pageWidthMm = 210;
      const pageHeightMm = 297;
      const printableWidthMm = pageWidthMm - margin * 2;
      const printableHeightMm = pageHeightMm - margin * 2;

      for (let cardIndex = 0; cardIndex < cards.length; cardIndex += 1) {
        const cardEl = cards[cardIndex];

        if (cardIndex > 0) {
          pdf.addPage();
        }

        const canvas = await html2canvas(cardEl, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          windowWidth: 718,
        });

        const pxPerMm = canvas.width / printableWidthMm;
        const pageSliceHeightPx = Math.floor(printableHeightMm * pxPerMm);

        let offsetY = 0;
        let sliceIndex = 0;

        while (offsetY < canvas.height) {
          const sliceHeight = Math.min(pageSliceHeightPx, canvas.height - offsetY);
          const pageCanvas = document.createElement("canvas");
          pageCanvas.width = canvas.width;
          pageCanvas.height = sliceHeight;

          const ctx = pageCanvas.getContext("2d");
          if (!ctx) break;

          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(
            canvas,
            0,
            offsetY,
            canvas.width,
            sliceHeight,
            0,
            0,
            canvas.width,
            sliceHeight,
          );

          if (sliceIndex > 0) {
            pdf.addPage();
          }

          const imageData = pageCanvas.toDataURL("image/jpeg", 0.98);
          const renderedHeightMm = sliceHeight / pxPerMm;

          pdf.addImage(
            imageData,
            "JPEG",
            margin,
            margin,
            printableWidthMm,
            renderedHeightMm,
          );

          offsetY += sliceHeight;
          sliceIndex += 1;
        }
      }

      pdf.save(`early_detection_bookings_detailed_${Date.now()}.pdf`);
      onClose();
    } finally {
      setExporting(false);
    }
  };

  const modal = (
    <div className="epdf-overlay" onClick={onClose}>
      <div className="epdf-modal" onClick={(e) => e.stopPropagation()}>
        <div className="epdf-header">
          <div className="epdf-header-left">
            <FileText size={18} />
            <span>{isRu ? "Детальный экспорт PDF" : "Detailed PDF Export"}</span>
          </div>
          <button className="epdf-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="epdf-subheader">
          <span className="epdf-meta">
            {bookings.length} {isRu ? "записей" : "bookings"}&nbsp;&bull;&nbsp;
            {selectedCount} {isRu ? "полей выбрано" : "fields selected"}
          </span>
          <div className="epdf-bulk-actions">
            <button className="epdf-link-btn" onClick={selectAll}>{isRu ? "Выбрать все" : "Select all"}</button>
            <span className="epdf-divider">|</span>
            <button className="epdf-link-btn" onClick={deselectAll}>{isRu ? "Снять все" : "Deselect all"}</button>
          </div>
        </div>

        <div className="epdf-body">
          {FIELD_SECTIONS.map((section) => {
            const allChecked = section.fields.every((field) => selected[field.id]);
            const someChecked = section.fields.some((field) => selected[field.id]);
            const checkedCount = section.fields.filter((field) => selected[field.id]).length;

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
                  <span className="epdf-section-label">{labelFor(section, isRu)}</span>
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
                      <span className="epdf-field-label">{labelFor(field, isRu)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="epdf-footer">
          <button className="epdf-cancel-btn" onClick={onClose} disabled={exporting}>
            {isRu ? "Отмена" : "Cancel"}
          </button>
          <button
            className="epdf-export-btn"
            onClick={handleExport}
            disabled={selectedCount === 0 || bookings.length === 0 || exporting}
          >
            <FileText size={14} />
            {exporting ? (isRu ? "Генерация..." : "Generating...") : (isRu ? "Экспорт PDF" : "Export PDF")}
          </button>
        </div>
      </div>
    </div>
  );

  const hiddenPreview = activeFields.length > 0 ? (
    <div
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        width: "1px",
        height: "1px",
        overflow: "hidden",
        zIndex: -1,
        pointerEvents: "none",
      }}
    >
      <PdfPreview
        bookings={bookings}
        activeFields={activeFields}
        pdfRef={pdfRef}
        isRu={isRu}
        locale={locale}
      />
    </div>
  ) : null;

  return createPortal(<>{hiddenPreview}{modal}</>, document.body);
}
