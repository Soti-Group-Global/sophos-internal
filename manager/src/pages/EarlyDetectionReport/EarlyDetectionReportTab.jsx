import React, { useRef, useState, useEffect, useCallback } from "react";
import { Download, FileText, Plus, Trash2 } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import RichTextEditor from "../../components/RichTextEditor/RichTextEditor";
import TemplatePicker from "../../components/RichTextEditor/TemplatePicker";
import {
  getEarlyDetectionManagedTests,
  getEarlyDetectionReport,
  saveEarlyDetectionReport,
  getEarlyDetectionTemplates,
  createEarlyDetectionTemplate,
  updateEarlyDetectionTemplate,
  deleteEarlyDetectionTemplate,
} from "../../utils/api";
import "./EarlyDetectionReportTab.css";

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


function calcAge(dob) {
  if (!dob) return "";
  const diff = Date.now() - new Date(dob).getTime();
  return String(Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)));
}


function ConclusionPages({ items, PageHeader, PageFooter, startPage = 4 }) {
  const measureRef = useRef(null);
  const bodyProbeRef = useRef(null); // measures actual available body height
  const slotsRef = useRef([]); // persists across renders
  const [pageGroups, setPageGroups] = useState(null);
  const measured = useRef(false);

  useEffect(() => {
    if (measured.current) return;
    const timer = setTimeout(() => {
      if (!measureRef.current) return;
      const children = Array.from(measureRef.current.children);
      if (!children.length) return;

      // Measure real available body height from the actual probe page body div
      const rawBodyH = bodyProbeRef.current
        ? bodyProbeRef.current.getBoundingClientRect().height
        : 800;
      const LINE_H = 24; // approximate line height for snapping
      // Snap bodyH down to nearest full line, then subtract one more line as safety
      const bodyH = Math.floor((rawBodyH - LINE_H) / LINE_H) * LINE_H;

      const heights = children.map(el => Math.ceil(el.getBoundingClientRect().height));

      // Build slots with awareness of preceding header heights.
      // prevHeaderH: if this item follows a keepWithNext header, its first slice
      // must be smaller to leave room for the header on the same page.
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

      // Pack slots into pages
      const groups = [];
      let current = [];
      let usedH = 0;

      slots.forEach((slot, si) => {
        const h = slot.sliceH;
        const wouldOverflow = current.length > 0 && usedH + h > bodyH;

        if (!wouldOverflow) {
          current.push(si);
          usedH += h;

          // If we just added a keepWithNext header, check remaining space
          if (items[slot.itemIdx]?.keepWithNext) {
            const nextSi = si + 1;
            const nextSlot = nextSi < slots.length ? slots[nextSi] : null;
            const remaining = bodyH - usedH;
            if (!nextSlot || remaining < LINE_H * 3) {
              // Header stranded at bottom — move to next page
              current.pop();
              usedH -= h;
              if (current.length > 0) groups.push([...current]);
              current = [si];
              usedH = h;
            }
          }
          return;
        }

        // Overflow: check if prev slot was a keepWithNext header
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
      <div className="ed-signature-block">
        <div className="ed-signature-line">………………………………</div>
        <strong>Глотов Михаил Николаевич</strong>
        <div className="ed-signature-role">Врач-терапевт.</div>
      </div>
      <div className="ed-signature-block">
        <div className="ed-signature-line">………………………………</div>
        <strong>Субраманиан Сомасундарам</strong>
        <div className="ed-signature-role">Генеральный директор</div>
      </div>
    </div>
  );

  return (
    <>
      {/* Probe page: renders invisibly to measure real available body height — NOT an .ed-page so PDF skips it */}
      <div
        className="ed-page-probe"
        style={{ position: "fixed", top: 0, left: -9999, width: 794, height: 1123, padding: "45px 53px 30px 53px", boxSizing: "border-box", display: "flex", flexDirection: "column", visibility: "hidden", pointerEvents: "none", zIndex: -1 }}
      >
        <PageHeader />
        <div ref={bodyProbeRef} className="ed-conclusions-body" />
        <PageFooter pageNum={0} />
      </div>

      {/* Hidden content measurement container */}
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
              // Always use a clip container — for full items it's transparent (no height set),
              // for sliced items it clips to the exact slice window
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

export default function EarlyDetectionReportTab({ booking }) {
  const reportRef = useRef(null);
  const [generating, setGenerating] = useState(false);

  const patient = booking?.patient || {};
  const fullName = [patient.firstName, patient.middleName, patient.lastName]
    .filter(Boolean).join(" ").trim() || "—";
  const dob = patient.dateOfBirth ? formatDate(patient.dateOfBirth) : "—";
  const phone = patient.phone || "—";
  const email = patient.email || "—";
  const patientId = patient.patientId || patient._id || "—";
  const programName = booking?.package?.name || "Ранняя диагностика «ПРЕДИКТ»";
  const examDate = booking?.scheduledDate
    ? formatDate(booking.scheduledDate)
    : booking?.createdAt ? formatDate(booking.createdAt) : "—";

  // Editable form fields
  const [coverFields, setCoverFields] = useState({
    fullName, dob, gender: patient.gender === "female" ? "Женский" : patient.gender === "male" ? "Мужской" : "—",
    phone, email, patientId, programName, examDate,
  });
  const [introText, setIntroText] = useState(
    `<p>Уважаемый(ая) ${patient.firstName || fullName}!</p><p>Благодарим Вас за выбор Индивидуальной ранней диагностики «ПРЕДИКТ», разработанной для того, чтобы помочь Вам внести позитивные изменения в Ваше здоровье.</p><p>Быть здоровым — значит делать разумный выбор, и Вы сделали первый шаг, выбрав эту программу.</p>`
  );
  const [labCardStatus, setLabCardStatus] = useState({
    blood: "", glands: "", heart: "", eyes: "", stomach: "", kidney: "", bones: "", ent: "", skin: "",
  });

  const [vitals, setVitals] = useState({
    age: calcAge(patient.dateOfBirth),
    gender: patient.gender === "female" ? "FEMALE" : patient.gender === "male" ? "MALE" : "",
    height: "",
    weight: "",
  });

  // Page 4 — test entries
  const [availableTests, setAvailableTests] = useState({ lab: [], instrumental: [] });
  const [page4Entries, setPage4Entries] = useState([]);
  const [diagnosisText, setDiagnosisText] = useState("");
  const [followUpText, setFollowUpText] = useState("");
  const [recommendationsText, setRecommendationsText] = useState("");

  // Templates
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    getEarlyDetectionTemplates().then(data => setTemplates(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  const getFieldTemplates = (fieldKey) => templates.filter(t => t.fieldKey === fieldKey);

  const handleSaveTemplate = useCallback(async (fieldKey, name, content) => {
    const tpl = await createEarlyDetectionTemplate({ fieldKey, name, content });
    setTemplates(prev => [...prev, tpl]);
  }, []);

  const handleUpdateTemplate = useCallback(async (id, data) => {
    const tpl = await updateEarlyDetectionTemplate(id, data);
    setTemplates(prev => prev.map(t => t._id === id ? tpl : t));
  }, []);

  const handleDeleteTemplate = useCallback(async (id) => {
    await deleteEarlyDetectionTemplate(id);
    setTemplates(prev => prev.filter(t => t._id !== id));
  }, []);

  useEffect(() => {
    Promise.all([
      getEarlyDetectionManagedTests("laboratoryTests"),
      getEarlyDetectionManagedTests("instrumentalAnalysis"),
    ]).then(([labRes, instrRes]) => {
      setAvailableTests({
        lab: labRes?.data || [],
        instrumental: instrRes?.data || [],
      });
    }).catch(() => {});
  }, []);

  // Load saved report on mount
  useEffect(() => {
    if (!booking?._id) return;
    getEarlyDetectionReport(booking._id).then(res => {
      const d = res?.data;
      if (!d) return;
      if (d.coverFields) setCoverFields(prev => ({ ...prev, ...d.coverFields }));
      if (d.introText) setIntroText(d.introText);
      if (d.vitals) setVitals(d.vitals);
      if (d.labCardStatus) setLabCardStatus(d.labCardStatus);
      if (d.page4Entries?.length) setPage4Entries(d.page4Entries);
      if (d.diagnosisText) setDiagnosisText(d.diagnosisText);
      if (d.followUpText) setFollowUpText(d.followUpText);
      if (d.recommendationsText) setRecommendationsText(d.recommendationsText);
    }).catch(() => {});
  }, [booking?._id]);

  // Debounced auto-save
  useEffect(() => {
    if (!booking?._id) return;
    const timer = setTimeout(() => {
      saveEarlyDetectionReport(booking._id, {
        coverFields, introText, vitals, labCardStatus,
        page4Entries, diagnosisText, followUpText, recommendationsText,
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [coverFields, introText, vitals, labCardStatus, page4Entries, diagnosisText, followUpText, recommendationsText]);

  const addPage4Entry = (type = "lab") => {
    setPage4Entries(entries => [...entries, { id: Date.now(), testId: "", testName: "", type, text: "" }]);
  };

  const updatePage4Entry = (id, key, val) => {
    setPage4Entries(entries => entries.map(e => e.id === id ? { ...e, [key]: val } : e));
  };

  const removePage4Entry = (id) => {
    setPage4Entries(entries => entries.filter(e => e.id !== id));
  };

  const updateCover = (key, val) => setCoverFields(f => ({ ...f, [key]: val }));
  const updateVital = (key, val) => setVitals(v => ({ ...v, [key]: val }));

  const handleDownload = async () => {
    if (!reportRef.current) return;
    setGenerating(true);
    try {
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const A4_W_MM = 210, A4_H_MM = 297;
      const SCALE = 2;
      const PAGE_H_PX = 1123;
      const pageEls = Array.from(reportRef.current.querySelectorAll(".ed-page"));

      // Strip margins from all pages before any capture so html2canvas
      // doesn't include the gap in the rendered output
      pageEls.forEach(el => { el.style.marginBottom = "0"; });
      // Force reflow so offsetHeight reflects the removed margin
      reportRef.current.getBoundingClientRect();

      for (let i = 0; i < pageEls.length; i++) {
        const el = pageEls[i];
        // getBoundingClientRect().height = content+padding+border, no margin
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
      // Always restore margins
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

  const bmi = vitals.height && vitals.weight
    ? (vitals.weight / ((vitals.height / 100) ** 2)).toFixed(2)
    : "—";

  return (
    <div className="ed-report-tab ed-report-two-panel">

      {/* ── LEFT: Form panel ── */}
      <div className="ed-form-panel">
        <div className="ed-form-toolbar">
          <h3 className="ed-form-panel-title"><FileText size={15} /> Редактировать отчёт</h3>
          <button className="ed-report-download-btn" onClick={handleDownload} disabled={generating}>
            <Download size={14} />
            {generating ? "Генерация..." : "Скачать PDF"}
          </button>
        </div>

        {/* Page 1 fields */}
        <div className="ed-form-section">
          <div className="ed-form-section-label">Страница 1 — Данные пациента</div>
          {[
            { key: "fullName",     label: "ФИО" },
            { key: "phone",        label: "Телефон" },
            { key: "email",        label: "Электронная почта" },
            { key: "patientId",    label: "ID пациента" },
            { key: "programName",  label: "Название программы" },
          ].map(({ key, label }) => (
            <div className="ed-form-field" key={key}>
              <label className="ed-form-label">{label}</label>
              <input
                className="ed-form-input"
                value={coverFields[key]}
                onChange={e => updateCover(key, e.target.value)}
              />
            </div>
          ))}
          {/* Date of birth — date picker */}
          <div className="ed-form-field">
            <label className="ed-form-label">Дата рождения</label>
            <input
              type="date"
              className="ed-form-input"
              value={coverFields.dob
                ? coverFields.dob.split(".").reverse().join("-")
                : ""}
              onChange={e => {
                const [y, m, d] = e.target.value.split("-");
                updateCover("dob", e.target.value ? `${d}.${m}.${y}` : "");
              }}
            />
          </div>
          {/* Exam date — date picker */}
          <div className="ed-form-field">
            <label className="ed-form-label">Дата обследования</label>
            <input
              type="date"
              className="ed-form-input"
              value={coverFields.examDate
                ? coverFields.examDate.split(".").reverse().join("-")
                : ""}
              onChange={e => {
                const [y, m, d] = e.target.value.split("-");
                updateCover("examDate", e.target.value ? `${d}.${m}.${y}` : "");
              }}
            />
          </div>
          <div className="ed-form-field">
            <label className="ed-form-label">Пол</label>
            <select className="ed-form-input" value={coverFields.gender} onChange={e => updateCover("gender", e.target.value)}>
              <option value="—">—</option>
              <option value="Мужской">Мужской</option>
              <option value="Женский">Женский</option>
            </select>
          </div>
        </div>

        {/* Page 2 intro text */}
        <div className="ed-form-section">
          <div className="ed-form-section-label-row">
            <span className="ed-form-section-label">Страница 2 — Вводный текст</span>
            <TemplatePicker
              templates={getFieldTemplates("ed_intro")}
              currentValue={introText}
              isEditing={true}
              onApply={setIntroText}
              onSave={(name, content) => handleSaveTemplate("ed_intro", name, content)}
              onUpdate={(id, data) => handleUpdateTemplate(id, data)}
              onDelete={(id) => handleDeleteTemplate(id)}
            />
          </div>
          <RichTextEditor
            value={introText}
            onChange={setIntroText}
            placeholder="Введите вводный текст..."
          />
        </div>

        {/* Page 3 vitals */}
        <div className="ed-form-section">
          <div className="ed-form-section-label">Страница 3 — Показатели</div>
          <div className="ed-form-field">
            <label className="ed-form-label">Возраст (лет)</label>
            <input className="ed-form-input" value={vitals.age} onChange={e => updateVital("age", e.target.value)} />
          </div>
          <div className="ed-form-field">
            <label className="ed-form-label">Пол</label>
            <select className="ed-form-input" value={vitals.gender} onChange={e => updateVital("gender", e.target.value)}>
              <option value="">—</option>
              <option value="МУЖСКОЙ">МУЖСКОЙ</option>
              <option value="ЖЕНСКИЙ">ЖЕНСКИЙ</option>
            </select>
          </div>
          <div className="ed-form-field">
            <label className="ed-form-label">Рост (см)</label>
            <input className="ed-form-input" type="number" value={vitals.height} onChange={e => updateVital("height", e.target.value)} />
          </div>
          <div className="ed-form-field">
            <label className="ed-form-label">Вес (кг)</label>
            <input className="ed-form-input" type="number" value={vitals.weight} onChange={e => updateVital("weight", e.target.value)} />
          </div>
          {/* Lab card statuses */}
          {[
            { id: "blood",   label: "🩸 Кровь и профиль анемии" },
            { id: "glands",  label: "🦋 Железы, эндокринная и гормональная система" },
            { id: "heart",   label: "❤️ Сердечно-сосудистая система" },
            { id: "eyes",    label: "👁 Офтальмологические симптомы" },
            { id: "stomach", label: "🫁 Желудок и печень/пищеварительная система" },
            { id: "kidney",  label: "🫘 Почки/мочевыделительная система" },
            { id: "bones",   label: "🦴 Кости и суставы/скелетная система" },
            { id: "ent",     label: "👂 ЛОР система" },
            { id: "skin",    label: "🧴 Дерматологические находки" },
          ].map(({ id, label }) => (
            <div className="ed-form-field" key={id}>
              <label className="ed-form-label">{label}</label>
              <select
                className="ed-form-input"
                value={labCardStatus[id]}
                onChange={e => setLabCardStatus(s => ({ ...s, [id]: e.target.value }))}
              >
                <option value="">— Не выбрано —</option>
                <option value="normal">Норма</option>
                <option value="attention">Требует внимания (плановое)</option>
                <option value="urgent">Требует неотложного внимания</option>
              </select>
            </div>
          ))}
        </div>

        {/* Page 4 — lab entries */}
        <div className="ed-form-section">
          <div className="ed-form-section-label">Страница 4 — Параметры, требующие внимания</div>

          <div className="ed-p4-subsection">
            <span className="ed-form-label">Лабораторные параметры, требующие внимания</span>
            {page4Entries.filter(entry => entry.type === "lab").map((entry) => {
              const usedLabIds = new Set(page4Entries.filter(e => e.type === "lab" && e.id !== entry.id && e.testId).map(e => e.testId));
              return (
              <div key={entry.id} className="ed-p4-entry">
                <div className="ed-p4-entry-row">
                  <select
                    className="ed-form-input"
                    value={entry.testId}
                    onChange={e => {
                      const opt = e.target.options[e.target.selectedIndex];
                      setPage4Entries(entries => entries.map(en =>
                        en.id === entry.id ? { ...en, testId: e.target.value, testName: opt.text } : en
                      ));
                    }}
                  >
                    <option value="">— Выберите параметр —</option>
                    {availableTests.lab.length > 0 && (
                      <optgroup label="Лабораторные тесты">
                        {availableTests.lab.filter(t => !usedLabIds.has(t._id)).map(t => (
                          <option key={t._id} value={t._id}>{t.name?.ru || t.name?.en || t._id}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <button className="ed-p4-remove-btn" onClick={() => removePage4Entry(entry.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
                {entry.testId && (
                  <div className="ed-p4-richtext">
                    <div className="ed-form-section-label-row" style={{ marginBottom: 4 }}>
                      <span />
                      <TemplatePicker
                        templates={getFieldTemplates(`ed_lab_${entry.testId}`)}
                        currentValue={entry.text}
                        isEditing={true}
                        onApply={val => updatePage4Entry(entry.id, "text", val)}
                        onSave={(name, content) => handleSaveTemplate(`ed_lab_${entry.testId}`, name, content)}
                        onUpdate={(id, data) => handleUpdateTemplate(id, data)}
                        onDelete={(id) => handleDeleteTemplate(id)}
                      />
                    </div>
                    <RichTextEditor
                      value={entry.text}
                      onChange={val => updatePage4Entry(entry.id, "text", val)}
                      placeholder="Введите описание..."
                    />
                  </div>
                )}
              </div>
            );})}
            <button className="ed-p4-add-btn" onClick={() => addPage4Entry("lab")}>
              <Plus size={14} /> Добавить
            </button>
          </div>

          <div className="ed-p4-subsection">
            <span className="ed-form-label">Инструментальные параметры, требующие внимания</span>
            {page4Entries.filter(entry => entry.type === "instrumental").map((entry) => {
              const usedInstrIds = new Set(page4Entries.filter(e => e.type === "instrumental" && e.id !== entry.id && e.testId).map(e => e.testId));
              return (
              <div key={entry.id} className="ed-p4-entry">
                <div className="ed-p4-entry-row">
                  <select
                    className="ed-form-input"
                    value={entry.testId}
                    onChange={e => {
                      const opt = e.target.options[e.target.selectedIndex];
                      setPage4Entries(entries => entries.map(en =>
                        en.id === entry.id ? { ...en, testId: e.target.value, testName: opt.text } : en
                      ));
                    }}
                  >
                    <option value="">— Выберите параметр —</option>
                    {availableTests.instrumental.length > 0 && (
                      <optgroup label="Инструментальные анализы">
                        {availableTests.instrumental.filter(t => !usedInstrIds.has(t._id)).map(t => (
                          <option key={t._id} value={t._id}>{t.name?.ru || t.name?.en || t._id}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <button className="ed-p4-remove-btn" onClick={() => removePage4Entry(entry.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
                {entry.testId && (
                  <div className="ed-p4-richtext">
                    <div className="ed-form-section-label-row" style={{ marginBottom: 4 }}>
                      <span />
                      <TemplatePicker
                        templates={getFieldTemplates(`ed_instr_${entry.testId}`)}
                        currentValue={entry.text}
                        isEditing={true}
                        onApply={val => updatePage4Entry(entry.id, "text", val)}
                        onSave={(name, content) => handleSaveTemplate(`ed_instr_${entry.testId}`, name, content)}
                        onUpdate={(id, data) => handleUpdateTemplate(id, data)}
                        onDelete={(id) => handleDeleteTemplate(id)}
                      />
                    </div>
                    <RichTextEditor
                      value={entry.text}
                      onChange={val => updatePage4Entry(entry.id, "text", val)}
                      placeholder="Введите описание..."
                    />
                  </div>
                )}
              </div>
            );})}
            <button className="ed-p4-add-btn" onClick={() => addPage4Entry("instrumental")}>
              <Plus size={14} /> Добавить
            </button>
          </div>

          <div className="ed-form-section ed-page4-conclusion-section">
            <div className="ed-form-section-label-row">
              <span className="ed-form-section-label">Диагноз</span>
              <TemplatePicker
                templates={getFieldTemplates("ed_diagnosis")}
                currentValue={diagnosisText}
                isEditing={true}
                onApply={setDiagnosisText}
                onSave={(name, content) => handleSaveTemplate("ed_diagnosis", name, content)}
                onUpdate={(id, data) => handleUpdateTemplate(id, data)}
                onDelete={(id) => handleDeleteTemplate(id)}
              />
            </div>
            <RichTextEditor
              value={diagnosisText}
              onChange={setDiagnosisText}
              placeholder="Введите текст для Диагноза"
            />
          </div>
          <div className="ed-form-section ed-page4-conclusion-section">
            <div className="ed-form-section-label-row">
              <span className="ed-form-section-label">План наблюдения</span>
              <TemplatePicker
                templates={getFieldTemplates("ed_followup")}
                currentValue={followUpText}
                isEditing={true}
                onApply={setFollowUpText}
                onSave={(name, content) => handleSaveTemplate("ed_followup", name, content)}
                onUpdate={(id, data) => handleUpdateTemplate(id, data)}
                onDelete={(id) => handleDeleteTemplate(id)}
              />
            </div>
            <RichTextEditor
              value={followUpText}
              onChange={setFollowUpText}
              placeholder="Введите текст для Плана наблюдения"
            />
          </div>
          <div className="ed-form-section ed-page4-conclusion-section">
            <div className="ed-form-section-label-row">
              <span className="ed-form-section-label">Назначения и рекомендации</span>
              <TemplatePicker
                templates={getFieldTemplates("ed_recommendations")}
                currentValue={recommendationsText}
                isEditing={true}
                onApply={setRecommendationsText}
                onSave={(name, content) => handleSaveTemplate("ed_recommendations", name, content)}
                onUpdate={(id, data) => handleUpdateTemplate(id, data)}
                onDelete={(id) => handleDeleteTemplate(id)}
              />
            </div>
            <RichTextEditor
              value={recommendationsText}
              onChange={setRecommendationsText}
              placeholder="Введите текст для Назначений и рекомендаций"
            />
          </div>
        </div>
      </div>

      {/* ── RIGHT: PDF preview ── */}
      <div className="ed-report-preview-wrapper">
        <div ref={reportRef} className="ed-report-doc">

          {/* ─── PAGE 1: Cover ─── */}
          <div className="ed-page ed-cover-page">

            {/* Top-left gradient corner */}
            <div className="ed-cover-corner-tl" aria-hidden="true" />
            {/* Bottom-right gradient corner */}
            <div className="ed-cover-corner-br" aria-hidden="true" />

            {/* Content layer */}
            <div className="ed-cover-content">

              {/* Top: title left | divider | logo right */}
              <div className="ed-cover-top">
                <div className="ed-cover-top-left">
                  <div className="ed-cover-top-title">Индивидуальная ранняя<br />диагностика заболеваний</div>
                  <div className="ed-cover-top-predict">«ПРЕДИКТ»</div>
                </div>
                <div className="ed-cover-top-divider" />
                <div className="ed-cover-top-right">
                  <img src="/logo_ru.png" alt="SOFOS" className="ed-cover-sophos-logo" crossOrigin="anonymous" />
                </div>
              </div>

              <hr className="ed-cover-rule" />

              {/* Patient info */}
              <div className="ed-cover-info">
                <div className="ed-cover-info-row"><strong>ФИО:</strong> {coverFields.fullName}</div>
                <div className="ed-cover-info-row"><strong>Дата рождения:</strong> {coverFields.dob} год</div>
                <div className="ed-cover-info-row"><strong>Телефон:</strong> {coverFields.phone !== "—" ? coverFields.phone : ""}</div>
                <div className="ed-cover-info-row"><strong>Электронная почта:</strong> {coverFields.email !== "—" ? coverFields.email : ""}</div>
                <div className="ed-cover-info-row"><strong>ID пациента:</strong> {coverFields.patientId}</div>
                <div className="ed-cover-info-row"><strong>Название программы:</strong> {coverFields.programName}</div>
                <div className="ed-cover-info-row"><strong>Дата обследования:</strong> {coverFields.examDate} год</div>
              </div>

              {/* Clinic address */}
              <div className="ed-cover-clinic">
                <div className="ed-cover-clinic-name">Медицинский центр «СОФОС»</div>
                <div className="ed-cover-clinic-line">Бизнес-центр «Квартал West»</div>
                <div className="ed-cover-clinic-line">Аминьевское шоссе, 6, г. Москва, Российская Федерация, 119517</div>
                <div className="ed-cover-clinic-line">☎ +7-495-324-11-11; contact@sophos-med.ru</div>
                <div className="ed-cover-clinic-line">⊕ www.sophos-med.ru</div>
              </div>

            </div>
          </div>

          {/* ─── PAGE 2: Introduction ─── */}
          <div className="ed-page">
            <PageHeader />
            <div className="ed-intro-body">
              <div
                className="ed-intro-text-content"
                dangerouslySetInnerHTML={{ __html: introText }}
              />
            </div>
            <PageFooter pageNum={2} />
          </div>

          {/* ─── PAGE 3: Health map ─── */}
          <div className="ed-page">
            <PageHeader />
            <div className="ed-health-map-body">
              <div className="ed-status-badges-row">
                <div className="ed-status-badge ed-status-normal"><span className="ed-status-badge-icon">👍</span><span>Норма</span></div>
                <div className="ed-status-badge ed-status-attention"><span className="ed-status-badge-icon">👁</span><span>Требует внимания (плановое)</span></div>
                <div className="ed-status-badge ed-status-urgent"><span className="ed-status-badge-icon">⚠</span><span>Требует неотложного внимания</span></div>
              </div>
              <div className="ed-vitals-bmi-row">
                <div className="ed-vitals-box">
                  <div className="ed-vitals-grid">
                    <div className="ed-vital-item"><span className="ed-vital-label">ВОЗРАСТ</span><span className="ed-vital-value">{vitals.age ? `${vitals.age} лет` : "— лет"}</span></div>
                    <div className="ed-vital-item"><span className="ed-vital-label">ПОЛ</span><span className="ed-vital-value">{vitals.gender || "—"}</span></div>
                    <div className="ed-vital-item"><span className="ed-vital-label">РОСТ</span><span className="ed-vital-value">{vitals.height ? `${vitals.height} см` : "— см"}</span></div>
                    <div className="ed-vital-item"><span className="ed-vital-label">ВЕС</span><span className="ed-vital-value">{vitals.weight ? `${vitals.weight} кг` : "— кг"}</span></div>
                  </div>
                </div>
                <div className="ed-bmi-box">
                  <div className="ed-bmi-label">Индекс массы тела</div>
                  <div className="ed-bmi-value">{bmi}</div>
                  <div className="ed-bmi-bar-wrap">
                    {/* Arrow indicator */}
                    {(() => {
                      const minBmi = 14, maxBmi = 29;
                      const bmiNum = parseFloat(bmi);
                      const pct = isNaN(bmiNum)
                        ? 50
                        : Math.min(100, Math.max(0, ((bmiNum - minBmi) / (maxBmi - minBmi)) * 100));
                      // Match bar segment: seg1=red(14-18), seg2=green(18-24), seg3=orange(24-27), seg4=red(27-29)
                      const arrowColor = isNaN(bmiNum)
                        ? "#22c55e"
                        : bmiNum < 18
                          ? "#ef4444"
                          : bmiNum <= 24
                            ? "#22c55e"
                            : bmiNum <= 27
                              ? "#f59e0b"
                              : "#ef4444";
                      return (
                        <div className="ed-bmi-arrow-row">
                          <div className="ed-bmi-arrow-track">
                            <span className="ed-bmi-arrow" style={{ left: `${pct}%`, color: arrowColor }}>▼</span>
                          </div>
                        </div>
                      );
                    })()}
                    {/* Colored bar */}
                    <div className="ed-bmi-bar">
                      <div className="ed-bmi-segment ed-bmi-seg1" />
                      <div className="ed-bmi-segment ed-bmi-seg2" />
                      <div className="ed-bmi-segment ed-bmi-seg3" />
                      <div className="ed-bmi-segment ed-bmi-seg4" />
                    </div>
                    {/* Scale numbers */}
                    <div className="ed-bmi-scale">
                      <span>14.0</span><span>18.0</span><span>24.0</span><span>29.0</span>
                    </div>
                    {/* Normal range pill */}
                    <div className="ed-bmi-range-bar">18 – 24 (норма)</div>
                  </div>
                </div>
              </div>
              <div className="ed-lab-summary-title">Сводка лабораторных показателей</div>
              <div className="ed-lab-summary-layout">

                {/* Row 1: left | image | right */}
                <div className="ed-lab-summary-row1">
                  {/* Left: 4 cards */}
                  <div className="ed-lab-summary-left">
                    {[
                      { id: "blood",  icon: "🩸", title: "Кровь и\nпрофиль анемии" },
                      { id: "glands", icon: "🦋", title: "Железы,\nэндокринная и\nгормональная система" },
                      { id: "heart",  icon: "❤️", title: "Сердечно-\nсосудистая\nсистема" },
                      { id: "eyes",   icon: "👁", title: "Офтальмологические\nсимптомы" },
                    ].map(({ id, icon, title }) => (
                      <div className="ed-lab-card" key={id}>
                        <div className="ed-lab-card-header">
                          <span className="ed-lab-dot">{icon}</span>
                          <span className="ed-lab-card-title">{title.split("\n").map((l, i) => <span key={i}>{l}<br /></span>)}</span>
                        </div>
                        <div className="ed-lab-card-status">
                          {labCardStatus[id] === "normal" && <span className="ed-status-pill ed-status-normal">Норма</span>}
                          {labCardStatus[id] === "attention" && <span className="ed-status-pill ed-status-attention">Требует внимания</span>}
                          {labCardStatus[id] === "urgent" && <span className="ed-status-pill ed-status-urgent">Неотложно</span>}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Center: body image only */}
                  <div className="ed-lab-summary-center">
                    <img src="/Human anatomy with circulatory system diagram.png" alt="Human anatomy" className="ed-human-anatomy" crossOrigin="anonymous" />
                  </div>

                  {/* Right: 4 cards */}
                  <div className="ed-lab-summary-right">
                    {[
                      { id: "stomach", icon: "🫁", title: "Желудок и\nпечень/пищеварение" },
                      { id: "kidney",  icon: "🫘", title: "Почки/\nмочевыделительная\nсистема" },
                      { id: "bones",   icon: "🦴", title: "Кости и\nсуставы/\nскелет" },
                      { id: "ent",     icon: "👂", title: "ЛОР\nсистема" },
                    ].map(({ id, icon, title }) => (
                      <div className="ed-lab-card" key={id}>
                        <div className="ed-lab-card-header">
                          <span className="ed-lab-dot">{icon}</span>
                          <span className="ed-lab-card-title">{title.split("\n").map((l, i) => <span key={i}>{l}<br /></span>)}</span>
                        </div>
                        <div className="ed-lab-card-status">
                          {labCardStatus[id] === "normal" && <span className="ed-status-pill ed-status-normal">Норма</span>}
                          {labCardStatus[id] === "attention" && <span className="ed-status-pill ed-status-attention">Требует внимания</span>}
                          {labCardStatus[id] === "urgent" && <span className="ed-status-pill ed-status-urgent">Неотложно</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Row 2: single bottom card centered below image */}
                <div className="ed-lab-summary-row2">
                  <div className="ed-lab-card ed-lab-card-bottom">
                    <div className="ed-lab-card-header">
                      <span className="ed-lab-dot">🧴</span>
                      <span className="ed-lab-card-title">Дерматологические находки</span>
                    </div>
                    <div className="ed-lab-card-status">
                      {labCardStatus["skin"] === "normal" && <span className="ed-status-pill ed-status-normal">Норма</span>}
                      {labCardStatus["skin"] === "attention" && <span className="ed-status-pill ed-status-attention">Требует внимания</span>}
                      {labCardStatus["skin"] === "urgent" && <span className="ed-status-pill ed-status-urgent">Неотложно</span>}
                    </div>
                  </div>
                </div>

              </div>
            </div>
            <PageFooter pageNum={3} />
          </div>

          {/* ─── PAGE 4+: Conclusions ─── */}
          {(() => {
            const labEntries = page4Entries.filter(e => e.testId && e.type !== "instrumental");
            const instrEntries = page4Entries.filter(e => e.testId && e.type === "instrumental");

            // Build flat list of items — each measured individually for page splitting
            const items = [];

            // keepWithNext: true means this item must stay on the same page as the next item
            // Lab section header + first entry grouped
            items.push({ key: "lab-hdr", keepWithNext: true, el: <div className="ed-section-header-box"><h2 className="ed-section-header-title">Лабораторные параметры, требующие внимания</h2></div> });
            if (labEntries.length > 0) {
              labEntries.forEach((entry) => items.push({
                key: `lab-${entry.id}`,
                keepWithNext: false,
                el: <div className="ed-p4-pdf-entry">
                  <div className="ed-p4-pdf-entry-name">{entry.testName}</div>
                  {entry.text && <div className="ed-p4-pdf-entry-text" dangerouslySetInnerHTML={{ __html: entry.text }} />}
                </div>
              }));
            } else {
              items.push({ key: "lab-empty", keepWithNext: false, el: <div className="ed-section-content-empty" /> });
            }

            // Instrumental section header
            items.push({ key: "instr-hdr", keepWithNext: true, el: <div className="ed-section-header-box"><h2 className="ed-section-header-title">Инструментальные параметры, требующие внимания</h2></div> });
            if (instrEntries.length > 0) {
              instrEntries.forEach((entry) => items.push({
                key: `instr-${entry.id}`,
                keepWithNext: false,
                el: <div className="ed-p4-pdf-entry">
                  <div className="ed-p4-pdf-entry-name">{entry.testName}</div>
                  {entry.text && <div className="ed-p4-pdf-entry-text" dangerouslySetInnerHTML={{ __html: entry.text }} />}
                </div>
              }));
            } else {
              items.push({ key: "instr-empty", keepWithNext: false, el: <div className="ed-section-content-empty" /> });
            }

            // Diagnosis — only show if filled
            if (diagnosisText) {
              items.push({ key: "diag-hdr", keepWithNext: true, el: <div className="ed-section-header-box"><h2 className="ed-section-header-title">Диагноз</h2></div> });
              items.push({ key: "diag-body", keepWithNext: false, el: <div className="ed-section-content-text" dangerouslySetInnerHTML={{ __html: diagnosisText }} /> });
            }

            // Follow-up — only show if filled
            if (followUpText) {
              items.push({ key: "plan-hdr", keepWithNext: true, el: <div className="ed-section-header-box"><h2 className="ed-section-header-title">План наблюдения</h2></div> });
              items.push({ key: "plan-body", keepWithNext: false, el: <div className="ed-section-content-text" dangerouslySetInnerHTML={{ __html: followUpText }} /> });
            }

            // Recommendations — only show if filled
            if (recommendationsText) {
              items.push({ key: "rec-hdr", keepWithNext: true, el: <div className="ed-section-header-box"><h2 className="ed-section-header-title">Назначения и рекомендации</h2></div> });
              items.push({ key: "rec-body", keepWithNext: false, el: <div className="ed-section-content-text" dangerouslySetInnerHTML={{ __html: recommendationsText }} /> });
            }

            const contentKey = page4Entries.map(e => e.testId + e.text).join(",")
              + "|" + diagnosisText + "|" + followUpText + "|" + recommendationsText
;

            return <ConclusionPages key={contentKey} items={items} PageHeader={PageHeader} PageFooter={PageFooter} startPage={4} />;
          })()}

        </div>
      </div>
    </div>
  );
}
