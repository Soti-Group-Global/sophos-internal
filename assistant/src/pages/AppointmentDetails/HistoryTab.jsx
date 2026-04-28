import React, { useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { FiCheckCircle, FiCircle } from "react-icons/fi";
import {
  updateHistoryForm,
  verifyHistoryField,
  getHistoryTemplates,
  createHistoryTemplate,
  updateHistoryTemplate,
  deleteHistoryTemplate,
  getEmailFromToken,
} from "../../utils/api";
import { AuthContext } from "../../context/AuthContext";
import RichTextEditor from "../../components/RichTextEditor/RichTextEditor";
import TemplatePicker from "../../components/RichTextEditor/TemplatePicker";
import "./HistoryTab.css";

/* ────────────────────────────────────────────────────────────
   Schema — each section has:
     id, titleKey (i18n key), fields[]  (key, labelKey?)
     optional subsections[] with the same shape
   ──────────────────────────────────────────────────────────── */
const HISTORY_SECTIONS = [
  /* 1 */
  {
    id: "complaints",
    titleKey: "sections.complaints",
    fields: [{ key: "complaints" }],
  },
  /* 2 */
  {
    id: "anamnesisMorbi",
    titleKey: "sections.anamnesisMorbi",
    fields: [{ key: "anamnesisMorbi" }],
  },
  /* 3 */
  {
    id: "anamnesisVitae",
    titleKey: "sections.anamnesisVitae",
    fields: [{ key: "anamnesisVitae" }],
  },
  /* 4 */
  {
    id: "physicalExam",
    titleKey: "sections.physicalExam",
    fields: [{ key: "physicalExam" }],
    subsections: [
      {
        id: "respiratory",
        titleKey: "subsections.respiratory",
        fields: [{ key: "respiratory" }],
      },
      {
        id: "circulatory",
        titleKey: "subsections.circulatory",
        fields: [{ key: "circulatory" }],
      },
      {
        id: "digestive",
        titleKey: "subsections.digestive",
        fields: [{ key: "digestive" }],
      },
      {
        id: "urinary",
        titleKey: "subsections.urinary",
        fields: [{ key: "urinary" }],
      },
      {
        id: "endocrine",
        titleKey: "subsections.endocrine",
        fields: [{ key: "endocrine" }],
      },
    ],
  },
  /* 5 */
  {
    id: "preliminaryDiagnosis",
    titleKey: "sections.preliminaryDiagnosis",
    fields: [{ key: "preliminaryDiagnosis" }],
  },
  /* 6 */
  {
    id: "examinationPlan",
    titleKey: "sections.examinationPlan",
    fields: [{ key: "examinationPlan" }],
  },
  /* 7 */
  {
    id: "examinationResults",
    titleKey: "sections.examinationResults",
    fields: [{ key: "examinationResults" }],
  },
  /* 8 */
  {
    id: "clinicalDiagnosis",
    titleKey: "sections.clinicalDiagnosis",
    fields: [{ key: "clinicalDiagnosis" }],
  },
  /* 9 */
  {
    id: "treatmentPlan",
    titleKey: "sections.treatmentPlan",
    fields: [{ key: "treatmentPlan" }],
  },
];

/* ── Collect every field key from the schema ── */
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
   RichTextField — dual-mode: preview (read) ↔ edit (RichTextEditor)
   ──────────────────────────────────────────────────────────── */
const RichTextField = React.memo(({ label, value, editing, onToggle, onChange, placeholder, emptyPlaceholder, templatePicker }) => (
  <div className={`ht-field${editing ? " ht-field--editing" : ""}`} data-ht-field>
    {label && (
      <div className="ht-field-header" onClick={onToggle}>
        <label className="ht-field-label">{label}</label>
        <div className="ht-field-actions">
          {templatePicker}
          <span className={`ht-field-toggle ${editing ? "ht-field-toggle--active" : ""}`}>
            {editing ? "✕" : "✎"}
          </span>
        </div>
      </div>
    )}
    {editing ? (
      <div className="ht-field-body">
        <RichTextEditor
          value={value}
          onChange={onChange}
          placeholder={placeholder}
        />
      </div>
    ) : (
      <div
        data-ht-field
        className={`ht-preview${!value ? " ht-preview--empty" : ""}`}
        onClick={onToggle}
        dangerouslySetInnerHTML={{ __html: value || `<span class='ht-preview-placeholder'>${emptyPlaceholder}</span>` }}
      />
    )}
  </div>
));

/* ================================================================
   HistoryTab component
   ================================================================ */
// Helper: extract the HTML value from a field that may be String (old) or { value } (new)
const fieldValue = (raw) => {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  return raw.value || "";
};

const HistoryTab = forwardRef(({ application, patient, onSaved }, ref) => {
  const { t } = useTranslation("history_tab");
  const { user } = useContext(AuthContext);
  const isDoctor = user?.role === "doctor";

  /* Initialise from application.historyForm (per-appointment), fallback to patient.historyForm */
  const initForm = () => {
    const saved = application?.historyForm || patient?.historyForm || {};
    const form = { isFirstAppointment: saved.isFirstAppointment ?? false, isRepetitiveAppointment: saved.isRepetitiveAppointment ?? false };
    ALL_KEYS.forEach((k) => {
      form[k] = fieldValue(saved[k]);
    });
    return form;
  };

  const [form, setForm] = useState(initForm);
  // verification state: { [fieldKey]: { isVerified, verifiedBy, verifiedAt } }
  const [verifications, setVerifications] = useState(() => {
    const saved = application?.historyForm || {};
    const v = {};
    ALL_KEYS.forEach((k) => {
      const raw = saved[k];
      v[k] = {
        isVerified: raw?.isVerified ?? false,
        verifiedBy: raw?.verifiedBy ?? null,
        verifiedAt: raw?.verifiedAt ?? null,
      };
    });
    return v;
  });
  const [verifyingField, setVerifyingField] = useState(null);

  /* Re-sync form whenever the saved historyForm from the server changes
     (e.g. after save in parent, or socket push from another session) */
  useEffect(() => {
    const saved = application?.historyForm || patient?.historyForm || {};
    setForm((prev) => {
      const next = { ...prev, isFirstAppointment: saved.isFirstAppointment ?? prev.isFirstAppointment ?? false, isRepetitiveAppointment: saved.isRepetitiveAppointment ?? prev.isRepetitiveAppointment ?? false };
      ALL_KEYS.forEach((k) => {
        next[k] = fieldValue(saved[k]) ?? prev[k] ?? "";
      });
      return next;
    });
    setVerifications(() => {
      const v = {};
      ALL_KEYS.forEach((k) => {
        const raw = saved[k];
        v[k] = {
          isVerified: raw?.isVerified ?? false,
          verifiedBy: raw?.verifiedBy ?? null,
          verifiedAt: raw?.verifiedAt ?? null,
        };
      });
      return v;
    });
  }, [application?.historyForm]);

  /* Track which individual fields are in edit mode */
  const [editingFields, setEditingFields] = useState({});
  const containerRef = useRef(null);

  /* Close all editing fields when clicking outside any field */
  useEffect(() => {
    const handleClickOutside = (e) => {
      /* If click is inside any field card, editor dropdown, or template picker, ignore */
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

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const setFieldEditing = useCallback((fieldKey, value) => {
    setEditingFields((prev) => ({ ...prev, [fieldKey]: value }));
  }, []);

  /* Editor change handler */
  const handleEditorChange = useCallback((key, html) => {
    setForm((prev) => ({ ...prev, [key]: html }));
  }, []);

  /* ── Templates ── */
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const data = await getHistoryTemplates();
        setTemplates(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load history templates:", err);
      }
    };
    fetchTemplates();
  }, []);

  /** Returns templates for a specific field key */
  const getFieldTemplates = useCallback(
    (fieldKey) => templates.filter((t) => t.fieldKey === fieldKey),
    [templates]
  );

  /** Save a new template */
  const handleSaveTemplate = useCallback(async (fieldKey, name, content) => {
    const tpl = await createHistoryTemplate({ fieldKey, name, content });
    setTemplates((prev) => [tpl, ...prev]);
    toast.success(t("toast.template_saved"));
  }, []);

  /** Update a template */
  const handleUpdateTemplate = useCallback(async (id, changes) => {
    try {
      const updated = await updateHistoryTemplate(id, changes);
      setTemplates((prev) => prev.map((t) => (t._id === id ? { ...t, ...updated } : t)));
    } catch (err) {
      toast.error(t("toast.template_update_failed"));
    }
  }, []);

  /** Delete a template */
  const handleDeleteTemplate = useCallback(async (id) => {
    try {
      await deleteHistoryTemplate(id);
      setTemplates((prev) => prev.filter((t) => t._id !== id));
      toast.success(t("toast.template_deleted"));
    } catch (err) {
      toast.error(t("toast.template_delete_failed"));
    }
  }, []);

  /** Duplicate a template */
  const handleDuplicateTemplate = useCallback(async (tpl) => {
    try {
      const newTpl = await createHistoryTemplate({
        fieldKey: tpl.fieldKey,
        name: `${tpl.name} (copy)`,
        content: tpl.content,
        isDefault: false,
      });
      setTemplates((prev) => [newTpl, ...prev]);
      toast.success(t("toast.template_duplicated"));
    } catch (err) {
      toast.error(t("toast.template_duplicate_failed"));
    }
  }, []);

  /** Build a TemplatePicker node for a given field key */
  const makeTemplatePicker = useCallback((fieldKey) => (
    <TemplatePicker
      templates={getFieldTemplates(fieldKey)}
      currentValue={form[fieldKey] || ""}
      editorOpen={!!editingFields[fieldKey]}
      onApply={(content) => {
        handleEditorChange(fieldKey, content);
        setFieldEditing(fieldKey, true);
      }}
      onSave={(name, content) => handleSaveTemplate(fieldKey, name, content)}
      onUpdate={(id, changes) => handleUpdateTemplate(id, changes)}
      onDelete={(id) => handleDeleteTemplate(id)}
      onDuplicate={(tpl) => handleDuplicateTemplate(tpl)}
    />
  ), [getFieldTemplates, form, editingFields, handleEditorChange, setFieldEditing, handleSaveTemplate, handleUpdateTemplate, handleDeleteTemplate, handleDuplicateTemplate]);

  /* Expose data for parent save — send as { value } objects */
  useImperativeHandle(ref, () => ({
    getData: () => ({
      historyForm: Object.fromEntries(
        Object.entries(form).map(([k, v]) =>
          k === "isFirstAppointment" || k === "isRepetitiveAppointment" ? [k, v] : [k, { value: v }]
        )
      ),
    }),
  }));

  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);

  const doSave = useCallback(async () => {
    if (!application?.applicationId) {
      toast.error(t("footer.patient_not_found", { ns: "appointment_details_general" }));
      return false;
    }
    setIsSaving(true);
    try {
      // Wrap each field as { value } so backend can detect content changes
      const payload = { isFirstAppointment: form.isFirstAppointment, isRepetitiveAppointment: form.isRepetitiveAppointment };
      ALL_KEYS.forEach((k) => { payload[k] = { value: form[k] }; });
      const res = await updateHistoryForm(application.applicationId, payload);
      toast.success(t("footer.save_success", { ns: "appointment_details_general" }));
      onSaved?.(res?.historyForm ?? payload);
      return true;
    } catch (err) {
      console.error("Save history error:", err);
      toast.error(err?.response?.data?.error || t("footer.save_error", { ns: "appointment_details_general" }));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [application, form, t]);

  /* Doctor-only: toggle verification on a single field */
  const handleVerifyField = useCallback(async (fieldKey, currentlyVerified) => {
    if (!isDoctor || !application?.applicationId) return;
    setVerifyingField(fieldKey);
    try {
      const doctorEmail = getEmailFromToken();
      const res = await verifyHistoryField(
        application.applicationId,
        fieldKey,
        !currentlyVerified,
        doctorEmail
      );
      const updated = res.historyForm?.[fieldKey];
      setVerifications((prev) => ({
        ...prev,
        [fieldKey]: {
          isVerified: updated?.isVerified ?? !currentlyVerified,
          verifiedBy: updated?.verifiedBy ?? null,
          verifiedAt: updated?.verifiedAt ?? null,
        },
      }));
      toast.success(!currentlyVerified ? t("verify.toast_verified") : t("verify.toast_unverified"));
    } catch {
      toast.error(t("verify.toast_error"));
    } finally {
      setVerifyingField(null);
    }
  }, [isDoctor, application]);

  const handleSaveAll = useCallback(async () => {
    await doSave();
  }, [doSave]);

  const handleSaveAndClose = useCallback(async () => {
    const ok = await doSave();
    if (ok) navigate(-1);
  }, [doSave, navigate]);

  /* ── Render helpers ── */
  const renderFields = (fields) => (
    <div className="ht-fields">
      {fields.map((f) => (
        <RichTextField
          key={f.key}
          label={f.labelKey ? t(f.labelKey) : undefined}
          value={form[f.key] || ""}
          editing={!!editingFields[f.key]}
          onToggle={() => setFieldEditing(f.key, !editingFields[f.key])}
          onChange={(html) => handleEditorChange(f.key, html)}
          placeholder={t("enter_text")}
          emptyPlaceholder={t("click_to_edit")}
          templatePicker={makeTemplatePicker(f.key)}
        />
      ))}
    </div>
  );

  /** Renders the verify badge + button for a single field key */
  const renderVerifyControl = useCallback((fieldKey) => {
    const v = verifications[fieldKey] || {};
    const isVerified = !!v.isVerified;
    const busy = verifyingField === fieldKey;
    return (
      <div className="ht-verify-control">
        {isVerified ? (
          <span className="ht-verify-badge ht-verify-badge--verified">
            <FiCheckCircle size={12} /> {t("verify.badge_verified")}
          </span>
        ) : (
          <span className="ht-verify-badge ht-verify-badge--pending">
            <FiCircle size={12} /> {t("verify.badge_pending")}
          </span>
        )}
        {isDoctor && (
          <button
            className={`ht-verify-btn${isVerified ? " ht-verify-btn--unverify" : ""}`}
            disabled={busy}
            onClick={(e) => { e.stopPropagation(); handleVerifyField(fieldKey, isVerified); }}
            title={isVerified ? t("verify.btn_unverify_title") : t("verify.btn_verify_title")}
          >
            {busy ? "…" : isVerified ? t("verify.btn_unverify") : t("verify.btn_verify")}
          </button>
        )}
      </div>
    );
  }, [verifications, verifyingField, isDoctor, handleVerifyField]);

  const renderSection = (section, level = 0) => {
    const isSingleField = section.fields?.length === 1 && !section.fields[0].labelKey && !section.subsections?.length;
    const singleKey = isSingleField ? section.fields[0].key : null;
    const singleEditing = singleKey ? !!editingFields[singleKey] : false;

    return (
      <div
        key={section.id}
        className={`ht-section${level > 0 ? " ht-subsection" : ""}${singleEditing ? " ht-section--editing" : ""}${singleKey && verifications[singleKey]?.isVerified ? " ht-section--verified" : ""}`}
      >
        {/* ── Header — clickable for single-field sections ── */}
        <div
          className={`ht-section-header${level > 0 ? " ht-subsection-header" : ""}${isSingleField ? " ht-section-header--clickable" : ""}`}
          onClick={isSingleField ? () => setFieldEditing(singleKey, !singleEditing) : undefined}
        >
          <span className={level > 0 ? "ht-subsection-title" : "ht-section-title"}>
            {t(section.titleKey)}
          </span>
          {isSingleField && (
            <div className="ht-section-header-actions">
              {renderVerifyControl(singleKey)}
              {makeTemplatePicker(singleKey)}
              <span className={`ht-field-toggle ${singleEditing ? "ht-field-toggle--active" : ""}`}>
                {singleEditing ? "\u2715" : "\u270E"}
              </span>
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div className="ht-section-body">
          {isSingleField ? (
            /* Single field: editor or preview directly, no extra card */
            singleEditing ? (
              <div data-ht-field>
                <RichTextEditor
                  value={form[singleKey] || ""}
                  onChange={(html) => handleEditorChange(singleKey, html)}
                  placeholder={t("enter_text")}
                />
              </div>
            ) : (
              <div
                data-ht-field
                className={`ht-preview${!form[singleKey] ? " ht-preview--empty" : ""}`}
                onClick={() => setFieldEditing(singleKey, true)}
                dangerouslySetInnerHTML={{ __html: form[singleKey] || `<span class='ht-preview-placeholder'>${t("click_to_edit")}</span>` }}
              />
            )
          ) : (
            <>
              {section.fields && renderFields(section.fields)}
              {section.subsections?.map((sub) => renderSection(sub, level + 1))}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="ht-container">
        {/* ── Appointment type checkboxes (mutually exclusive) ── */}
        <div className="ht-first-appt-bar">
          <label className="ht-first-appt-label">
            <input
              type="checkbox"
              className="ht-first-appt-checkbox"
              checked={!!form.isFirstAppointment}
              onChange={() => setForm((prev) => ({
                ...prev,
                isFirstAppointment: !prev.isFirstAppointment,
                isRepetitiveAppointment: prev.isFirstAppointment ? prev.isRepetitiveAppointment : false,
              }))}
            />
            <span>{t("first_appointment")}</span>
          </label>
          <label className="ht-first-appt-label">
            <input
              type="checkbox"
              className="ht-first-appt-checkbox"
              checked={!!form.isRepetitiveAppointment}
              onChange={() => setForm((prev) => ({
                ...prev,
                isRepetitiveAppointment: !prev.isRepetitiveAppointment,
                isFirstAppointment: prev.isRepetitiveAppointment ? prev.isFirstAppointment : false,
              }))}
            />
            <span>{t("repetitive_appointment")}</span>
          </label>
        </div>

        {HISTORY_SECTIONS.map((s) => renderSection(s))}
      </div>

      {/* Sticky footer — same pattern as GeneralInformationTab */}
      <div className="adp-sticky-footer">
        <button
          className="adp-footer-btn adp-footer-save-btn"
          onClick={handleSaveAll}
          disabled={isSaving}
        >
          {isSaving
            ? t("footer.saving", { ns: "appointment_details_general" })
            : t("footer.save", { ns: "appointment_details_general" })}
        </button>
        <button
          className="adp-footer-btn adp-footer-save-close-btn"
          onClick={handleSaveAndClose}
          disabled={isSaving}
        >
          {isSaving
            ? t("footer.saving", { ns: "appointment_details_general" })
            : t("footer.save_and_close", { ns: "appointment_details_general" })}
        </button>
      </div>
    </>
  );
});

export default HistoryTab;
