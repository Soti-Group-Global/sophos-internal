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

/* ────────────────────────────────────────────────────────────
   SpecialistHistoryForm
   Props:
     historyForm  – initial saved data object (from booking.schedule.specialistConsultations[i].historyForm)
     onSave       – async (formData) => void  called when user clicks Save
     isSaving     – boolean controlled by parent
     specialistTitle – string label shown in the header
   ──────────────────────────────────────────────────────────── */
const SpecialistHistoryForm = ({ historyForm: initialHistoryForm, onSave, isSaving, specialistTitle }) => {
  const { t } = useTranslation("history_tab");

  /* ── Init form from saved data ── */
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
  const [editingFields, setEditingFields] = useState({});

  /* Re-sync when parent data changes (e.g. booking reloads) */
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
    // Reset editing fields on specialist switch
    setEditingFields({});
  }, [initialHistoryForm]);

  /* Close editing when clicking outside field cards */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        e.target.closest("[data-ht-field]") ||
        e.target.closest(".ht-section-header--clickable") ||
        e.target.closest(".rte-color-dropdown") ||
        e.target.closest(".rte-select")
      ) return;
      setEditingFields({});
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const setFieldEditing = useCallback((key, val) => {
    setEditingFields((prev) => ({ ...prev, [key]: val }));
  }, []);

  const handleEditorChange = useCallback((key, html) => {
    setForm((prev) => ({ ...prev, [key]: { ...prev[key], value: html } }));
  }, []);

  const handleSave = useCallback(() => {
    onSave?.({ ...form });
  }, [form, onSave]);

  /* ── Verify toggle (local only — parent save persists it) ── */
  const VerifyBadge = ({ fieldKey }) => {
    const verified = !!form[fieldKey]?.isVerified;
    return (
      <button
        type="button"
        className={`ht-verify-btn${verified ? " ht-verify-btn--verified" : " ht-verify-btn--pending"}`}
        onClick={(e) => {
          e.stopPropagation();
          setForm((prev) => ({
            ...prev,
            [fieldKey]: { ...prev[fieldKey], isVerified: !verified },
          }));
        }}
        title={verified ? t("verify_title_verified") : t("verify_title_pending")}
      >
        {verified ? t("verify_verified") : t("verify_pending")}
      </button>
    );
  };

  /* ── Render one section (with optional subsections) ── */
  const renderSection = (section, level = 0) => {
    const isSingleField = section.fields?.length === 1 && !section.fields[0].labelKey && !section.subsections?.length;
    const singleKey = isSingleField ? section.fields[0].key : null;
    const singleEditing = singleKey ? !!editingFields[singleKey] : false;

    return (
      <div
        key={section.id}
        className={`ht-section${level > 0 ? " ht-subsection" : ""}${singleEditing ? " ht-section--editing" : ""}`}
      >
        <div
          className={`ht-section-header${level > 0 ? " ht-subsection-header" : ""}${isSingleField ? " ht-section-header--clickable" : ""}`}
          onClick={isSingleField ? () => setFieldEditing(singleKey, !singleEditing) : undefined}
        >
          <span className={level > 0 ? "ht-subsection-title" : "ht-section-title"}>
            {t(section.titleKey)}
          </span>
          {isSingleField && (
            <div className="ht-section-header-actions">
              {form[singleKey]?.value?.replace(/<[^>]*>/g, "").trim() && (
                <VerifyBadge fieldKey={singleKey} />
              )}
              <span className={`ht-field-toggle ${singleEditing ? "ht-field-toggle--active" : ""}`}>
                {singleEditing ? "✕" : "✎"}
              </span>
            </div>
          )}
        </div>

        <div className="ht-section-body">
          {isSingleField ? (
            singleEditing ? (
              <div data-ht-field>
                <RichTextEditor
                  value={form[singleKey]?.value || ""}
                  onChange={(html) => handleEditorChange(singleKey, html)}
                  placeholder={t("enter_text")}
                />
              </div>
            ) : (
              <div
                data-ht-field
                className={`ht-preview${!form[singleKey]?.value ? " ht-preview--empty" : ""}`}
                onClick={() => setFieldEditing(singleKey, true)}
                dangerouslySetInnerHTML={{
                  __html: form[singleKey]?.value ||
                    `<span class='ht-preview-placeholder'>${t("click_to_edit")}</span>`,
                }}
              />
            )
          ) : (
            <>
              {section.fields?.map((f) => (
                <div
                  key={f.key}
                  className={`ht-field${editingFields[f.key] ? " ht-field--editing" : ""}`}
                  data-ht-field
                >
                  {editingFields[f.key] ? (
                    <RichTextEditor
                      value={form[f.key]?.value || ""}
                      onChange={(html) => handleEditorChange(f.key, html)}
                      placeholder={t("enter_text")}
                    />
                  ) : (
                    <div
                      data-ht-field
                      className={`ht-preview${!form[f.key]?.value ? " ht-preview--empty" : ""}`}
                      onClick={() => setFieldEditing(f.key, true)}
                      dangerouslySetInnerHTML={{
                        __html: form[f.key]?.value ||
                          `<span class='ht-preview-placeholder'>${t("click_to_edit")}</span>`,
                      }}
                    />
                  )}
                </div>
              ))}
              {section.subsections?.map((sub) => renderSection(sub, level + 1))}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="shf-wrap">
      {/* ── Save row ── */}
      <div className="shf-header-row">
        <div className="shf-header-actions">
          <label className="ht-first-appt-label">
            <input
              type="checkbox"
              className="ht-first-appt-checkbox"
              checked={!!form.isFirstAppointment}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  isFirstAppointment: e.target.checked,
                  isRepetitiveAppointment: e.target.checked ? false : prev.isRepetitiveAppointment,
                }))
              }
            />
            <span>{t("first_appointment")}</span>
          </label>
          <label className="ht-first-appt-label">
            <input
              type="checkbox"
              className="ht-first-appt-checkbox"
              checked={!!form.isRepetitiveAppointment}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  isRepetitiveAppointment: e.target.checked,
                  isFirstAppointment: e.target.checked ? false : prev.isFirstAppointment,
                }))
              }
            />
            <span>{t("repetitive_appointment")}</span>
          </label>
          <button
            type="button"
            className="save-btn"
            onClick={handleSave}
            disabled={!!isSaving}
          >
            {isSaving ? t("footer.saving", { ns: "appointment_details_general" }) : t("footer.save", { ns: "appointment_details_general" })}
          </button>
        </div>
      </div>

      {/* ── History sections ── */}
      <div className="ht-container" style={{ paddingBottom: 24 }}>
        {HISTORY_SECTIONS.map((s) => renderSection(s))}
      </div>
    </div>
  );
};

export default SpecialistHistoryForm;
