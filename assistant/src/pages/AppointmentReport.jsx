import React, { useRef, useState, useEffect, useMemo } from "react";
import { Download } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import "../styles/AppointmentReport.css";

const CLINIC_INFO = {
  name: "Медицинский центр «СОФОС»",
  phone: "+7-495-324-11-11",
  website: "www.sophos-med.ru",
  address: "ООО «ЭЙЧДИ КЛИНИК» · Бизнес-центр 'Квартал West' · Аминьевское Шоссе, 6, Москва, 119517",
  email: "contact@sophos-med.ru",
};

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function ConclusionPages({ items, PageHeader, PageFooter, startPage = 4, doctorName, doctorRole }) {
  const measureRef = useRef(null);
  const bodyProbeRef = useRef(null);
  const slotsRef = useRef([]);
  const [pageGroups, setPageGroups] = useState(null);
  const measured = useRef(false);

  useEffect(() => {
    if (measured.current) return;
    const timer = setTimeout(() => {
      if (!measureRef.current) return;
      const children = Array.from(measureRef.current.children);
      if (!children.length) return;

      const rawBodyH = bodyProbeRef.current
        ? bodyProbeRef.current.getBoundingClientRect().height
        : 800;
      const LINE_H = 24;
      const bodyH = Math.floor((rawBodyH - LINE_H) / LINE_H) * LINE_H;

      const heights = children.map(el => Math.ceil(el.getBoundingClientRect().height));

      const buildSlots = () => {
        const result = [];
        for (let i = 0; i < items.length; i++) {
          const h = heights[i];
          const prevItem = i > 0 ? items[i - 1] : null;
          const prevH = i > 0 ? heights[i - 1] : 0;
          const followsHeader = prevItem?.keepWithNext;
          const firstPageBudget = followsHeader ? bodyH - prevH : bodyH;

          if (h <= bodyH) {
            result.push({ itemIdx: i, offset: 0, sliceH: h, isFull: true });
          } else {
            let consumed = 0;
            let isFirst = true;
            while (consumed < h) {
              const budget = isFirst ? Math.max(firstPageBudget, LINE_H * 3) : bodyH;
              const rawSlice = Math.min(budget, h - consumed);
              const isLast = consumed + rawSlice >= h;
              const sliceH = isLast ? rawSlice : Math.floor(rawSlice / LINE_H) * LINE_H;
              if (sliceH <= 0) { consumed += LINE_H; isFirst = false; continue; }
              result.push({ itemIdx: i, offset: consumed, sliceH, isFull: false });
              consumed += sliceH;
              isFirst = false;
            }
          }
        }
        return result;
      };

      const slots = buildSlots();
      const groups = [];
      let current = [];
      let usedH = 0;

      slots.forEach((slot, si) => {
        const h = slot.sliceH;
        const wouldOverflow = current.length > 0 && usedH + h > bodyH;

        if (!wouldOverflow) {
          current.push(si);
          usedH += h;

          if (items[slot.itemIdx]?.keepWithNext) {
            const nextSi = si + 1;
            const nextSlot = nextSi < slots.length ? slots[nextSi] : null;
            const remaining = bodyH - usedH;
            if (!nextSlot || remaining < LINE_H * 3) {
              current.pop();
              usedH -= h;
              if (current.length > 0) groups.push([...current]);
              current = [si];
              usedH = h;
            }
          }
          return;
        }

        const prevSlot = current.length > 0 ? slots[current[current.length - 1]] : null;
        const prevIsHeader = prevSlot && items[prevSlot.itemIdx]?.keepWithNext;
        if (prevIsHeader && current.length > 1) {
          const headerSlotIdx = current.pop();
          const headerH = slots[headerSlotIdx].sliceH;
          usedH -= headerH;
          if (current.length > 0) groups.push([...current]);
          current = [headerSlotIdx, si];
          usedH = headerH + h;
        } else {
          if (current.length > 0) groups.push([...current]);
          current = [si];
          usedH = h;
        }
      });
      if (current.length > 0) groups.push([...current]);

      slotsRef.current = slots;
      measured.current = true;
      setPageGroups(groups.length > 0 ? groups : [slots.map((_, i) => i)]);
    }, 80);
    return () => clearTimeout(timer);
  }, []);

  const signatures = (
    <div className="ed-signatures-row">
      {(doctorName || doctorRole) && (
        <div className="ed-signature-block">
          <div className="ed-signature-line">………………………………</div>
          {doctorName && <strong>{doctorName}</strong>}
          {doctorRole && <div className="ed-signature-role">{doctorRole}</div>}
        </div>
      )}
    </div>
  );

  return (
    <>
      <div
        className="ed-page-probe"
        style={{ position: "fixed", top: 0, left: -9999, width: 794, height: 1123, padding: "45px 53px 30px 53px", boxSizing: "border-box", display: "flex", flexDirection: "column", visibility: "hidden", pointerEvents: "none", zIndex: -1 }}
      >
        <PageHeader />
        <div ref={bodyProbeRef} className="ed-conclusions-body" />
        <PageFooter pageNum={0} />
      </div>

      <div
        ref={measureRef}
        style={{
          position: "fixed", top: 0, left: -9999,
          width: 688,
          visibility: "hidden", pointerEvents: "none", zIndex: -1,
        }}
      >
        {items.map((item) => <div key={item.key}>{item.el}</div>)}
      </div>

      {pageGroups && pageGroups.map((slotIdxs, pi) => (
        <div key={pi} className="ed-page ed-page-conclusions-fixed">
          <PageHeader />
          <div className="ed-conclusions-body">
            {slotIdxs.map(si => {
              const slot = slotsRef.current[si];
              if (!slot) return null;
              const item = items[slot.itemIdx];
              if (slot.isFull) {
                return (
                  <div key={`${item.key}-${si}`} style={{ overflow: "hidden", flexShrink: 0 }}>
                    {item.el}
                  </div>
                );
              }
              return (
                <div key={`${item.key}-${si}`} style={{ overflow: "hidden", height: slot.sliceH, flexShrink: 0 }}>
                  <div style={{ transform: `translateY(-${slot.offset}px)` }}>
                    {item.el}
                  </div>
                </div>
              );
            })}
            {pi === pageGroups.length - 1 && signatures}
          </div>
          <PageFooter pageNum={startPage + pi} />
        </div>
      ))}
    </>
  );
}

export default function AppointmentReport({ booking, patient: patientProp = null, className = "" }) {
  const reportRef = useRef(null);
  const [generating, setGenerating] = useState(false);

  const coverFields = useMemo(() => {
    const embeddedPatient = booking?.patient || {};
    const p = patientProp || embeddedPatient;
    const fullName = [p.firstName, p.middleName, p.lastName]
      .filter(Boolean).join(" ").trim() || booking?.patientName || "—";
    const dob = p.dateOfBirth ? formatDate(p.dateOfBirth) : "—";
    const phone = p.phone || "—";
    const email = p.email || booking?.patientEmail || "—";
    const patientId = p.patientId || p._id || "—";
    const programName = booking?.package?.name || "Ранняя диагностика «ПРЕДИКТ»";
    const examDate = booking?.scheduledDate
      ? formatDate(booking.scheduledDate)
      : booking?.createdAt ? formatDate(booking.createdAt) : "—";
    return {
      fullName, dob,
      gender: p.gender === "female" ? "Женский" : p.gender === "male" ? "Мужской" : "—",
      phone, email, patientId, programName, examDate,
    };
  }, [booking, patientProp]);

  const doctorName = useMemo(() => {
    const d = booking?.doctor;
    if (d) return [d.lastName, d.firstName, d.middleName].filter(Boolean).join(" ") || null;
    const entry = booking?.doctors?.[0];
    return entry?.doctorName || null;
  }, [booking]);
  const doctorRole = booking?.doctor?.specialization || booking?.doctors?.[0]?.specialization || null;

  const [page4Entries] = useState([]);
  const [diagnosisText] = useState("");
  const [followUpText] = useState("");
  const [recommendationsText] = useState("");

  const handleDownload = async () => {
    if (!reportRef.current) return;
    setGenerating(true);
    try {
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const A4_W_MM = 210, A4_H_MM = 297;
      const SCALE = 2;
      const PAGE_H_PX = 1123;
      const pageEls = Array.from(reportRef.current.querySelectorAll(".ed-page"));

      pageEls.forEach(el => { el.style.marginBottom = "0"; });
      reportRef.current.getBoundingClientRect();

      for (let i = 0; i < pageEls.length; i++) {
        const el = pageEls[i];
        const elH = Math.round(el.getBoundingClientRect().height);

        const canvas = await html2canvas(el, {
          scale: SCALE,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          width: 794,
          height: elH,
        });

        const canvasPageH = PAGE_H_PX * SCALE;
        const totalSlices = Math.max(1, Math.ceil(canvas.height / canvasPageH));

        for (let s = 0; s < totalSlices; s++) {
          if (i > 0 || s > 0) pdf.addPage();

          const srcY = s * canvasPageH;
          const srcH = Math.min(canvasPageH, canvas.height - srcY);
          if (srcH <= 0) break;

          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = srcH;
          const ctx = sliceCanvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

          const sliceH_mm = (srcH / canvasPageH) * A4_H_MM;
          pdf.addImage(sliceCanvas.toDataURL("image/jpeg", 0.98), "JPEG", 0, 0, A4_W_MM, sliceH_mm);
        }
      }

      pdf.save(`report_${booking?.invoiceNumber || booking?.bookingNumber || "ED"}.pdf`);
    } finally {
      const pageElsRestore = Array.from(reportRef.current?.querySelectorAll(".ed-page") || []);
      pageElsRestore.forEach(el => { el.style.marginBottom = ""; });
      setGenerating(false);
    }
  };

  const PageHeader = () => (
    <>
      <div className="ed-page-header">
        <img src="/logo_ru.png" alt="Logo" className="ed-header-logo" />
        <div className="ed-header-clinic">
          <span className="ed-header-clinic-name">{CLINIC_INFO.name}</span>
          <span className="ed-header-clinic-contact">{CLINIC_INFO.phone} &nbsp; | &nbsp; {CLINIC_INFO.website}</span>
        </div>
      </div>
      <hr className="ed-header-line" />
    </>
  );

  const PageFooter = ({ pageNum }) => (
    <>
      <div className="ed-page-footer-patient">
        <span>ID: {coverFields.patientId}</span>
        <span>{coverFields.fullName}</span>
        <span>Страница {pageNum}</span>
      </div>
      <div className="ed-page-footer">
        <span>{CLINIC_INFO.address}</span>
        <span>тел: <strong>{CLINIC_INFO.phone}</strong> &nbsp; | &nbsp; Почта: {CLINIC_INFO.email} &nbsp; | &nbsp; <strong>{CLINIC_INFO.website}</strong></span>
      </div>
      <div className="ed-page-footer-bar">
        ИНН 9727077651 &nbsp; · &nbsp; ОГРН 1247700412068 &nbsp; · &nbsp; Ежедневно с 09:00 до 21:00
      </div>
    </>
  );

  return (
    <div className={`ed-report-tab ${className}`.trim()}>

      {/* ── Toolbar ── */}
      <div className="ed-report-toolbar">
        <button className="ed-report-download-btn" onClick={handleDownload} disabled={generating}>
          <Download size={14} />
          {generating ? "Генерация..." : "Скачать PDF"}
        </button>
      </div>

      {/* ── PDF preview ── */}
      <div className="ed-report-preview-wrapper">
        <div ref={reportRef} className="ed-report-doc">

          {/* ─── PAGE 1+: Patient info + Conclusions ─── */}
          {(() => {
            const stripHtml = (html) => html?.replace(/<[^>]*>/g, "").trim() || "";

            const FIELD_LABELS = {
              complaints: "Жалобы",
              anamnesisMorbi: "Анамнез заболевания",
              anamnesisVitae: "Анамнез жизни",
              respiratory: "Дыхательная система",
              circulatory: "Сердечно-сосудистая система",
              digestive: "Пищеварительная система",
              urinary: "Мочевыделительная система",
              endocrine: "Эндокринная система",
              preliminaryDiagnosis: "Предварительный диагноз",
              examinationPlan: "План обследования",
              examinationResults: "Результаты обследования",
              clinicalDiagnosis: "Клинический диагноз",
              treatmentPlan: "План лечения",
            };
            const FIELD_ORDER = [
              "complaints", "anamnesisMorbi", "anamnesisVitae",
              "respiratory", "circulatory", "digestive", "urinary", "endocrine",
              "preliminaryDiagnosis", "examinationPlan", "examinationResults",
              "clinicalDiagnosis", "treatmentPlan",
            ];

            const consultations = booking?.consultations?.length
              ? booking.consultations
              : (booking?.historyForm ? [{ historyForm: booking.historyForm }] : []);

            const items = [];

            // Patient info block as first item
            const hasPatientInfo = (coverFields.fullName && coverFields.fullName !== "—")
              || (coverFields.dob && coverFields.dob !== "—")
              || (coverFields.phone && coverFields.phone !== "—");
            if (hasPatientInfo) {
              items.push({
                key: "patient-info",
                keepWithNext: true,
                el: (
                  <div className="ed-cover-patient-plain" style={{ marginBottom: 16 }}>
                    {coverFields.fullName && coverFields.fullName !== "—" && (
                      <div className="ed-cover-patient-name">
                        <span className="ed-cover-patient-label">ФИО:&nbsp;</span>{coverFields.fullName}
                      </div>
                    )}
                    {coverFields.dob && coverFields.dob !== "—" && (
                      <div className="ed-cover-patient-line">
                        <span className="ed-cover-patient-label">Дата:&nbsp;</span>{coverFields.dob}
                      </div>
                    )}
                    {coverFields.phone && coverFields.phone !== "—" && (
                      <div className="ed-cover-patient-line">
                        <span className="ed-cover-patient-label">Телефон:&nbsp;</span>{coverFields.phone}
                      </div>
                    )}
                  </div>
                ),
              });
            }

            consultations.forEach((c, ci) => {
              const hf = c.historyForm || {};

              FIELD_ORDER.forEach(fieldId => {
                const val = hf[fieldId]?.value;
                if (!stripHtml(val)) return;
                items.push({
                  key: `cons-${ci}-${fieldId}-hdr`,
                  keepWithNext: true,
                  el: <div className="ed-field-title">{FIELD_LABELS[fieldId]}</div>,
                });
                items.push({
                  key: `cons-${ci}-${fieldId}-body`,
                  keepWithNext: false,
                  el: <div className="ed-section-content-text" dangerouslySetInnerHTML={{ __html: val }} />,
                });
              });
            });

            if (diagnosisText) {
              items.push({ key: "diag-hdr", keepWithNext: true, el: <div className="ed-section-header-box"><h2 className="ed-section-header-title">Диагноз</h2></div> });
              items.push({ key: "diag-body", keepWithNext: false, el: <div className="ed-section-content-text" dangerouslySetInnerHTML={{ __html: diagnosisText }} /> });
            }

            if (followUpText) {
              items.push({ key: "plan-hdr", keepWithNext: true, el: <div className="ed-section-header-box"><h2 className="ed-section-header-title">План наблюдения</h2></div> });
              items.push({ key: "plan-body", keepWithNext: false, el: <div className="ed-section-content-text" dangerouslySetInnerHTML={{ __html: followUpText }} /> });
            }

            if (recommendationsText) {
              items.push({ key: "rec-hdr", keepWithNext: true, el: <div className="ed-section-header-box"><h2 className="ed-section-header-title">Назначения и рекомендации</h2></div> });
              items.push({ key: "rec-body", keepWithNext: false, el: <div className="ed-section-content-text" dangerouslySetInnerHTML={{ __html: recommendationsText }} /> });
            }

            const contentKey = consultations.map(c => c._id || c.date).join(",")
              + "|" + page4Entries.map(e => e.name + e.text).join(",")
              + "|" + diagnosisText + "|" + followUpText + "|" + recommendationsText;

            return <ConclusionPages key={contentKey} items={items} PageHeader={PageHeader} PageFooter={PageFooter} startPage={1} doctorName={doctorName} doctorRole={doctorRole} />;
          })()}

        </div>
      </div>
    </div>
  );
}
