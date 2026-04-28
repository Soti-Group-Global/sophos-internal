import React, { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { ArrowLeft, LayoutTemplate, ChevronRight } from "lucide-react";
import {
  getDoctorByEmail,
  getHistoryTemplates,
  createHistoryTemplate,
  updateHistoryTemplate,
  deleteHistoryTemplate,
} from "../utils/api";
import RichTextEditor from "../components/RichTextEditor/RichTextEditor";
import TemplatePicker from "../components/RichTextEditor/TemplatePicker";
import "./AppointmentDetails/HistoryTab.css";
import "./DoctorTemplatesPage.css";

/* ─── Section schema — identical to HistoryTab ──────────────── */
const HISTORY_SECTIONS = [
  { id: "complaints",           titleKey: "sections.complaints",           fields: [{ key: "complaints" }] },
  { id: "anamnesisMorbi",       titleKey: "sections.anamnesisMorbi",       fields: [{ key: "anamnesisMorbi" }] },
  { id: "anamnesisVitae",       titleKey: "sections.anamnesisVitae",       fields: [{ key: "anamnesisVitae" }] },
  {
    id: "physicalExam",
    titleKey: "sections.physicalExam",
    fields: [{ key: "physicalExam" }],
    subsections: [
      { id: "respiratory", titleKey: "subsections.respiratory", fields: [{ key: "respiratory" }] },
      { id: "circulatory", titleKey: "subsections.circulatory", fields: [{ key: "circulatory" }] },
      { id: "digestive",   titleKey: "subsections.digestive",   fields: [{ key: "digestive"   }] },
      { id: "urinary",     titleKey: "subsections.urinary",     fields: [{ key: "urinary"     }] },
      { id: "endocrine",   titleKey: "subsections.endocrine",   fields: [{ key: "endocrine"   }] },
    ],
  },
  { id: "preliminaryDiagnosis", titleKey: "sections.preliminaryDiagnosis", fields: [{ key: "preliminaryDiagnosis" }] },
  { id: "examinationPlan",      titleKey: "sections.examinationPlan",      fields: [{ key: "examinationPlan" }] },
  { id: "examinationResults",   titleKey: "sections.examinationResults",   fields: [{ key: "examinationResults" }] },
  { id: "clinicalDiagnosis",    titleKey: "sections.clinicalDiagnosis",    fields: [{ key: "clinicalDiagnosis" }] },
  { id: "treatmentPlan",        titleKey: "sections.treatmentPlan",        fields: [{ key: "treatmentPlan" }] },
];

/* ─── Collect all field keys ────────────────────────────────── */
const collectKeys = (sections) => {
  const keys = [];
  sections.forEach((s) => {
    s.fields?.forEach((f) => keys.push(f.key));
    if (s.subsections) keys.push(...collectKeys(s.subsections));
  });
  return keys;
};
const ALL_KEYS = collectKeys(HISTORY_SECTIONS);

/* ─── Flat sidebar list (sections + subsections) ────────────── */
const buildFlatList = (sections, depth = 0) => {
  const result = [];
  sections.forEach((s) => {
    result.push({ id: s.id, titleKey: s.titleKey, depth });
    if (s.subsections) result.push(...buildFlatList(s.subsections, depth + 1));
  });
  return result;
};
const FLAT_SECTIONS = buildFlatList(HISTORY_SECTIONS);

/* ─── Helpers ────────────────────────────────────────────────── */
const getField = (field) => {
  if (!field) return "";
  if (typeof field === "string") return field;
  return field.en || field.ru || Object.values(field)[0] || "";
};
const getInitials = (doc) =>
  ((getField(doc?.firstName)?.[0] || "") + (getField(doc?.lastName)?.[0] || "")).toUpperCase() || "DR";

/* ─── Find a section/subsection by id recursively ───────────── */
const findSection = (id, sections) => {
  for (const s of sections) {
    if (s.id === id) return s;
    if (s.subsections) {
      const found = findSection(id, s.subsections);
      if (found) return found;
    }
  }
  return null;
};

/* ════════════════════════════════════════════════════════════════
   DoctorTemplatesPage
   ════════════════════════════════════════════════════════════════ */
export default function DoctorTemplatesPage() {
  const { email } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation("history_tab");

  const [doctor,    setDoctor]    = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loading,   setLoading]   = useState(true);

  /* Per-field scratch editor values */
  const [editorValues, setEditorValues] = useState(() =>
    Object.fromEntries(ALL_KEYS.map((k) => [k, ""]))
  );

  /* Per-field open/edit state */
  const [editingFields, setEditingFields] = useState({});

  /* Selected sidebar section */
  const [selectedId, setSelectedId] = useState(HISTORY_SECTIONS[0].id);

  /* Default-mode toggle — saved templates get isDefault: true when ON */
  const [isDefaultMode, setIsDefaultMode] = useState(false);

  /* ── Fetch doctor info ── */
  useEffect(() => {
    if (!email) return;
    getDoctorByEmail(email)
      .then((res) => setDoctor(res?.data?.data || res?.data?.doctor || null))
      .catch(() => setDoctor(null));
  }, [email]);

  /* ── Fetch all templates for this doctor ── */
  useEffect(() => {
    if (!email) return;
    setLoading(true);
    getHistoryTemplates(null, email)
      .then((data) => setTemplates(Array.isArray(data) ? data : []))
      .catch(() => toast.error(t("toast.templates_load_failed")))
      .finally(() => setLoading(false));
  }, [email]);

  /* ── Close editors on outside click ── */
  useEffect(() => {
    const handler = (e) => {
      if (
        e.target.closest("[data-ht-field]") ||
        e.target.closest(".ht-section-header--clickable") ||
        e.target.closest(".rte-color-dropdown") ||
        e.target.closest(".rte-select") ||
        e.target.closest(".tp-wrap") ||
        e.target.closest(".tp-dropdown")
      ) return;
      setEditingFields({});
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── Template CRUD (same callbacks as HistoryTab) ── */
  const getFieldTemplates = useCallback(
    (fieldKey) => templates.filter((t) => t.fieldKey === fieldKey),
    [templates]
  );

  const handleSaveTemplate = useCallback(async (fieldKey, name, content) => {
    const payload = isDefaultMode
      ? { fieldKey, name, content, isDefault: true }
      : { fieldKey, name, content, doctorEmail: email, isDefault: false };
    const tpl = await createHistoryTemplate(payload);
    setTemplates((prev) => [tpl, ...prev]);
    toast.success(t("toast.template_saved"));
  }, [email, isDefaultMode]);

  const handleUpdateTemplate = useCallback(async (id, changes) => {
    try {
      const updated = await updateHistoryTemplate(id, { ...changes, doctorEmail: email });
      setTemplates((prev) => prev.map((t) => (t._id === id ? { ...t, ...updated } : t)));
    } catch {
      toast.error(t("toast.template_update_failed"));
    }
  }, [email]);

  const handleDeleteTemplate = useCallback(async (id) => {
    try {
      await deleteHistoryTemplate(id, email);
      setTemplates((prev) => prev.filter((t) => t._id !== id));
      toast.success(t("toast.template_deleted"));
    } catch {
      toast.error(t("toast.template_delete_failed"));
    }
  }, [email]);

  const handleDuplicateTemplate = useCallback(async (tpl) => {
    try {
      const payload = isDefaultMode
        ? { fieldKey: tpl.fieldKey, name: `${tpl.name} (copy)`, content: tpl.content, isDefault: true }
        : { fieldKey: tpl.fieldKey, name: `${tpl.name} (copy)`, content: tpl.content, doctorEmail: email, isDefault: false };
      const newTpl = await createHistoryTemplate(payload);
      setTemplates((prev) => [newTpl, ...prev]);
      toast.success(t("toast.template_duplicated"));
    } catch {
      toast.error(t("toast.template_duplicate_failed"));
    }
  }, [email, isDefaultMode]);

  const handleEditorChange = useCallback((key, html) => {
    setEditorValues((prev) => ({ ...prev, [key]: html }));
  }, []);

  const setFieldEditing = useCallback((key, value) => {
    setEditingFields((prev) => ({ ...prev, [key]: value }));
  }, []);

  /* ── TemplatePicker builder — identical to HistoryTab ── */
  const makeTemplatePicker = useCallback((fieldKey) => (
    <TemplatePicker
      templates={getFieldTemplates(fieldKey)}
      currentValue={editorValues[fieldKey] || ""}
      onApply={(content) => {
        handleEditorChange(fieldKey, content);
        setFieldEditing(fieldKey, true);
      }}
      onSave={(name, content) => handleSaveTemplate(fieldKey, name, content)}
      onUpdate={(id, changes) => handleUpdateTemplate(id, changes)}
      onDelete={(id) => handleDeleteTemplate(id)}
      onDuplicate={(tpl) => handleDuplicateTemplate(tpl)}
    />
  ), [getFieldTemplates, editorValues, handleEditorChange, setFieldEditing,
      handleSaveTemplate, handleUpdateTemplate, handleDeleteTemplate, handleDuplicateTemplate]);

  /* ── Render a section card (mirrors HistoryTab renderSection) ── */
  const renderSection = (section, level = 0) => {
    const isSingleField =
      section.fields?.length === 1 && !section.fields[0].labelKey && !section.subsections?.length;
    const singleKey    = isSingleField ? section.fields[0].key : null;
    const singleEditing = singleKey ? !!editingFields[singleKey] : false;

    return (
      <div
        key={section.id}
        className={`ht-section${level > 0 ? " ht-subsection" : ""}${singleEditing ? " ht-section--editing" : ""}`}
      >
        {/* Section header */}
        <div
          className={`ht-section-header${level > 0 ? " ht-subsection-header" : ""}${isSingleField ? " ht-section-header--clickable" : ""}`}
          onClick={isSingleField ? () => setFieldEditing(singleKey, !singleEditing) : undefined}
        >
          <span className={level > 0 ? "ht-subsection-title" : "ht-section-title"}>
            {t(section.titleKey)}
          </span>
          {isSingleField && (
            <div className="ht-section-header-actions">
              {makeTemplatePicker(singleKey)}
              <span className={`ht-field-toggle ${singleEditing ? "ht-field-toggle--active" : ""}`}>
                {singleEditing ? "\u2715" : "\u270E"}
              </span>
            </div>
          )}
        </div>

        {/* Section body */}
        <div className="ht-section-body">
          {isSingleField ? (
            singleEditing ? (
              <div data-ht-field>
                <RichTextEditor
                  value={editorValues[singleKey] || ""}
                  onChange={(html) => handleEditorChange(singleKey, html)}
                  placeholder="Write template content here, then save it as a template using the button above…"
                />
              </div>
            ) : (
              <div
                data-ht-field
                className={`ht-preview${!editorValues[singleKey] ? " ht-preview--empty" : ""}`}
                onClick={() => setFieldEditing(singleKey, true)}
                dangerouslySetInnerHTML={{
                  __html: editorValues[singleKey] ||
                    `<span class='ht-preview-placeholder'>Click to open editor — use the <b>template button ▲</b> to manage saved templates…</span>`,
                }}
              />
            )
          ) : (
            /* Section with subsections — render each subsection */
            <>{section.subsections?.map((sub) => renderSection(sub, level + 1))}</>
          )}
        </div>
      </div>
    );
  };

  /* ── Determine what to render in the right panel ── */
  const activeSection = findSection(selectedId, HISTORY_SECTIONS);

  /* ── Doctor display ── */
  const doctorName = doctor
    ? `Dr. ${getField(doctor.firstName)} ${getField(doctor.lastName)}`.trim()
    : email;
  const specialty = doctor ? getField(doctor.specialty) : "";
  const initials  = getInitials(doctor);

  return (
    <div className="dtp-page">
      {/* ── Top Header ── */}
      <div className="dtp-top-header">
        <button className="dtp-back-btn" onClick={() => window.history.length > 1 ? navigate(-1) : navigate(`/doctors/${email}`)}>
          <ArrowLeft size={16} />
          <span>{t("dtp_back")}</span>
        </button>
        <div className="dtp-header-divider" />
        <div className="dtp-header-doctor">
          <div className="dtp-header-avatar">{initials}</div>
          <div className="dtp-header-doctor-info">
            <span className="dtp-header-doctor-name">{doctorName}</span>
            {specialty && <span className="dtp-header-doctor-specialty">{specialty}</span>}
          </div>
        </div>
        <div className="dtp-header-title">
          <LayoutTemplate size={16} />
          <span>{t("dtp_title")}</span>
          {!loading && (
            <span className="dtp-header-total-badge">{templates.length} {t("dtp_total")}</span>
          )}
        </div>
        <div className="dtp-header-default-toggle">
          <span className={`dtp-default-label${isDefaultMode ? " dtp-default-label--on" : ""}`}>
            Default
          </span>
          <button
            className={`dtp-toggle-switch${isDefaultMode ? " dtp-toggle-switch--on" : ""}`}
            onClick={() => setIsDefaultMode((v) => !v)}
            aria-label="Toggle default mode"
            type="button"
          >
            <span className="dtp-toggle-thumb" />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="dtp-body">
        {/* ── Left Sidebar ── */}
        <aside className="dtp-sidebar">
          <div className="dtp-sidebar-title">{t("dtp_sections")}</div>
          <nav className="dtp-nav">
            {FLAT_SECTIONS.map((s) => {
              const count    = templates.filter((tpl) => tpl.fieldKey === s.id).length;
              const isActive = selectedId === s.id;
              return (
                <button
                  key={s.id}
                  className={`dtp-nav-item${s.depth > 0 ? " dtp-nav-item--sub" : ""}${isActive ? " dtp-nav-item--active" : ""}`}
                  onClick={() => setSelectedId(s.id)}
                >
                  <span className="dtp-nav-label">{t(s.titleKey)}</span>
                  {count > 0 && <span className="dtp-nav-badge">{count}</span>}
                  {isActive && <ChevronRight size={12} className="dtp-nav-arrow" />}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ── Right Panel ── */}
        <main className="dtp-main">
          {loading ? (
            <div className="dtp-loading">
              <div className="dtp-spinner" />
              <span>{t("dtp_loading")}</span>
            </div>
          ) : (
            <div className="dtp-sections-container">
              <p className="dtp-hint">
                {t("dtp_hint_before")}<strong>{t("dtp_hint_bold")}</strong>{t("dtp_hint_after")}
              </p>
              {activeSection && renderSection(activeSection)}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
