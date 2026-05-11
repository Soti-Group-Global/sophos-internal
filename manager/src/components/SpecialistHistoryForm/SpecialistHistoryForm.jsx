import React, { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import RichTextEditor from "../RichTextEditor/RichTextEditor";
import "../../pages/AppointmentDetails/HistoryTab.css";

/* ── History sections schema (mirrors HistoryTab) ── */
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
      { id: "digestive",   titleKey: "subsections.digestive",   fields: [{ key: "digestive" }] },
      { id: "urinary",     titleKey: "subsections.urinary",     fields: [{ key: "urinary" }] },
      { id: "endocrine",   titleKey: "subsections.endocrine",   fields: [{ key: "endocrine" }] },
    ],
  },
  { id: "preliminaryDiagnosis", titleKey: "sections.preliminaryDiagnosis", fields: [{ key: "preliminaryDiagnosis" }] },
  { id: "examinationPlan",      titleKey: "sections.examinationPlan",      fields: [{ key: "examinationPlan" }] },
  { id: "examinationResults",   titleKey: "sections.examinationResults",   fields: [{ key: "examinationResults" }] },
  { id: "clinicalDiagnosis",    titleKey: "sections.clinicalDiagnosis",    fields: [{ key: "clinicalDiagnosis" }] },
  { id: "treatmentPlan",        titleKey: "sections.treatmentPlan",        fields: [{ key: "treatmentPlan" }] },
];

const collectKeys = (sections) => {
  const keys = [];
  sections.forEach((s) => {
    s.fields?.forEach((f) => keys.push(f.key));
    if (s.subsections) keys.push(...collectKeys(s.subsections));
  });
  return keys;
};
const ALL_KEYS = collectKeys(HISTORY_SECTIONS);

const SpecialistHistoryForm = ({ historyForm: initialHistoryForm, onSave, isSaving, specialistTitle = "", readOnly = false }) => {
  const { t } = useTranslation("history_tab");

  const buildForm = (saved) => {
    const form = {
      isFirstAppointment:      saved?.isFirstAppointment      ?? false,
      isRepetitiveAppointment: saved?.isRepetitiveAppointment ?? false,
    };
    ALL_KEYS.forEach((k) => {
      const f = saved?.[k];
      form[k] = {
        value:      (typeof f === "object" ? f?.value : f) || "",
        isVerified: f?.isVerified || false,
        verifiedBy: f?.verifiedBy || null,
        verifiedAt: f?.verifiedAt || null,
      };
    });
    return form;
  };

  const [form, setForm] = useState(() => buildForm(initialHistoryForm));
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    setForm((prev) => {
      const saved = initialHistoryForm || {};
      const next = {
        ...prev,
        isFirstAppointment:      saved.isFirstAppointment      ?? prev.isFirstAppointment      ?? false,
        isRepetitiveAppointment: saved.isRepetitiveAppointment ?? prev.isRepetitiveAppointment ?? false,
      };
      ALL_KEYS.forEach((k) => {
        const f = saved[k];
        next[k] = {
          value:      (typeof f === "object" ? f?.value : f) || prev[k]?.value || "",
          isVerified: f?.isVerified ?? prev[k]?.isVerified ?? false,
          verifiedBy: f?.verifiedBy ?? prev[k]?.verifiedBy ?? null,
          verifiedAt: f?.verifiedAt ?? prev[k]?.verifiedAt ?? null,
        };
      });
      return next;
    });
    setIsEditMode(false);
  }, [initialHistoryForm]);

  const handleEditorChange = useCallback((key, html) => {
    setForm((prev) => ({ ...prev, [key]: { ...prev[key], value: html } }));
  }, []);

  const handleSave = useCallback(async () => {
    await onSave?.({ ...form });
    setIsEditMode(false);
  }, [form, onSave]);

  /* True when at least one field has saved content */
  const hasAnyContent = ALL_KEYS.some((k) => !!form[k]?.value);

  /* If nothing is filled yet, always show in edit mode (unless readOnly) */
  const effectiveEditMode = !readOnly && (isEditMode || !hasAnyContent);

  /* Check if a section (or any of its subsections) has content */
  const sectionHasContent = (section) => {
    const fieldsFilled = section.fields?.some((f) => !!form[f.key]?.value);
    const subsFilled = section.subsections?.some((sub) => sectionHasContent(sub));
    return !!(fieldsFilled || subsFilled);
  };

  /* ── Render one section ── */
  const renderSection = (section, level = 0) => {
    /* In view mode, skip sections with no content entirely */
    if (!effectiveEditMode && !sectionHasContent(section)) return null;

    const titleClass = level > 0 ? "ht-subsection-title" : "ht-section-title";
    const sectionClass = `ht-section${level > 0 ? " ht-subsection" : ""}`;

    return (
      <div key={section.id} className={sectionClass}>
        <div className={`ht-section-header${level > 0 ? " ht-subsection-header" : ""}`}>
          <span className={titleClass}>{t(section.titleKey)}</span>
        </div>

        <div className="ht-section-body">
          {section.fields?.map((f) => {
            /* In view mode, skip empty fields */
            if (!effectiveEditMode && !form[f.key]?.value) return null;

            return effectiveEditMode ? (
              <div key={f.key} className="ht-field ht-field--editing">
                <RichTextEditor
                  value={form[f.key]?.value || ""}
                  onChange={(html) => handleEditorChange(f.key, html)}
                  placeholder={t("enter_text")}
                />
              </div>
            ) : (
              <div
                key={f.key}
                className="shf-view-text"
                dangerouslySetInnerHTML={{ __html: form[f.key]?.value }}
              />
            );
          })}
          {section.subsections?.map((sub) => renderSection(sub, level + 1))}
        </div>
      </div>
    );
  };

  return (
    <div className="shf-wrap">
      <div className="shf-header-row">
        {specialistTitle && (
          <span className="shf-specialist-title">{specialistTitle}</span>
        )}
        {!readOnly && (effectiveEditMode ? (
          <button
            type="button"
            className="save-btn"
            onClick={handleSave}
            disabled={!!isSaving}
            style={{ marginLeft: "auto" }}
          >
            {isSaving
              ? t("footer.saving", { ns: "appointment_details_general" })
              : t("footer.save", { ns: "appointment_details_general" })}
          </button>
        ) : (
          <button
            type="button"
            className="shf-edit-btn"
            onClick={() => setIsEditMode(true)}
            style={{ marginLeft: "auto" }}
          >
            ✎ {t("footer.edit", { ns: "appointment_details_general", defaultValue: "Edit" })}
          </button>
        ))}
      </div>

      <div className={`ht-container${!effectiveEditMode ? " shf-view-mode" : ""}`} style={{ paddingTop: effectiveEditMode ? 16 : 8, paddingBottom: 16 }}>
        {HISTORY_SECTIONS.map((s) => renderSection(s))}
      </div>
    </div>
  );
};

export default SpecialistHistoryForm;
