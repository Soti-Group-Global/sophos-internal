import React, { useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
  updatePatientHistoryForm as updateHistoryForm,
  getHistoryTemplates,
  createHistoryTemplate,
  updateHistoryTemplate,
  deleteHistoryTemplate, 
} from "../utils/api";
import RichTextEditor from "./RichTextEditor";
import TemplatePicker from "./TemplatePicker";
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
    titleKey: "history_tab.sections.complaints",
    fields: [{ key: "complaints" }],
  },
  /* 2 */
  {
    id: "anamnesisMorbi",
    titleKey: "history_tab.sections.anamnesisMorbi",
    fields: [{ key: "anamnesisMorbi" }],
  },
  /* 3 */
  {
    id: "anamnesisVitae",
    titleKey: "history_tab.sections.anamnesisVitae",
    fields: [{ key: "anamnesisVitae" }],
  },
  /* 4 */
  {
    id: "physicalExam",
    titleKey: "history_tab.sections.physicalExam",
    fields: [{ key: "physicalExam" }],
    subsections: [
      {
        id: "respiratory",
        titleKey: "history_tab.subsections.respiratory",
        fields: [{ key: "respiratory" }],
      },
      {
        id: "circulatory",
        titleKey: "history_tab.subsections.circulatory",
        fields: [{ key: "circulatory" }],
      },
      {
        id: "digestive",
        titleKey: "history_tab.subsections.digestive",
        fields: [{ key: "digestive" }],
      },
      {
        id: "urinary",
        titleKey: "history_tab.subsections.urinary",
        fields: [{ key: "urinary" }],
      },
      {
        id: "endocrine",
        titleKey: "history_tab.subsections.endocrine",
        fields: [{ key: "endocrine" }],
      },
    ],
  },
  /* 5 */
  {
    id: "preliminaryDiagnosis",
    titleKey: "history_tab.sections.preliminaryDiagnosis",
    fields: [{ key: "preliminaryDiagnosis" }],
  },
  /* 6 */
  {
    id: "examinationPlan",
    titleKey: "history_tab.sections.examinationPlan",
    fields: [{ key: "examinationPlan" }],
  },
  /* 7 */
  {
    id: "examinationResults",
    titleKey: "history_tab.sections.examinationResults",
    fields: [{ key: "examinationResults" }],
  },
  /* 8 */
  {
    id: "clinicalDiagnosis",
    titleKey: "history_tab.sections.clinicalDiagnosis",
    fields: [{ key: "clinicalDiagnosis" }],
  },
  /* 9 */
  {
    id: "treatmentPlan",
    titleKey: "history_tab.sections.treatmentPlan",
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
const RichTextField = React.memo(({ label, value, editing, onToggle, onChange, placeholder, emptyPlaceholder }) => (
  <div className={`ht-field${editing ? " ht-field--editing" : ""}`} data-ht-field>
    {label && (
      <div className="ht-field-header" onClick={onToggle}>
        <label className="ht-field-label">{label}</label>
        <span className={`ht-field-toggle ${editing ? "ht-field-toggle--active" : ""}`}>
          {editing ? "✕" : "✎"}
        </span>
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
const HistoryTab = forwardRef(({ application, patient }, ref) => {
  const { t } = useTranslation();

  /* Initialise from application.historyForm (per-appointment), fallback to patient.historyForm */
  const STORAGE_KEY = application?.applicationId
    ? `historyDraft_${application.applicationId}`
    : null;

  const initForm = () => {
    const saved = application?.historyForm || patient?.historyForm || {};
    const form = {};
    ALL_KEYS.forEach((k) => {
      const field = saved[k];
      form[k] = (field && typeof field === "object") ? (field.value || "") : (field || "");
    });
    form.isFirstAppointment = !!saved.isFirstAppointment;
    form.isRepetitiveAppointment = !!saved.isRepetitiveAppointment;

    // merge any draft from localStorage
    if (STORAGE_KEY) {
      try {
        const draft = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (draft && draft.form) {
          Object.assign(form, draft.form);
          if (draft.isFirstAppointment !== undefined) {
            form.isFirstAppointment = draft.isFirstAppointment;
          }
          if (draft.isRepetitiveAppointment !== undefined) {
            form.isRepetitiveAppointment = draft.isRepetitiveAppointment;
          }
        }
      } catch (e) {
        console.warn("Failed to parse history draft", e);
      }
    }

    return form;
  };

  const initVerified = () => {
    const saved = application?.historyForm || patient?.historyForm || {};
    const vs = {};
    ALL_KEYS.forEach((k) => {
      const field = saved[k];
      vs[k] = field?.isVerified ?? false;
    });

    // Override with localStorage draft so pending state survives refresh
    if (STORAGE_KEY) {
      try {
        const draft = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (draft?.verifiedStatus) {
          ALL_KEYS.forEach((k) => {
            if (draft.verifiedStatus[k] !== undefined) {
              vs[k] = draft.verifiedStatus[k];
            }
          });
        }
      } catch (e) {
        console.warn("Failed to parse history draft for verifiedStatus", e);
      }
    }

    return vs;
  };

  const [form, setForm] = useState(initForm);
  const [verifiedStatus, setVerifiedStatus] = useState(initVerified);

  // persist drafts whenever form or verifiedStatus changes
  useEffect(() => {
    if (!STORAGE_KEY) return;
    const payload = { form, verifiedStatus, isFirstAppointment: form.isFirstAppointment, isRepetitiveAppointment: form.isRepetitiveAppointment };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn("Unable to save history draft", e);
    }
  }, [form, verifiedStatus, STORAGE_KEY]);

  // templates stored per field key
  const [templatesByField, setTemplatesByField] = useState({});

  // load all templates on mount (could be optimized to load on demand)
  useEffect(() => {
    ALL_KEYS.forEach(async (key) => {
      try {
        const data = await getHistoryTemplates(key);
        setTemplatesByField((prev) => ({ ...prev, [key]: data }));
      } catch (err) {
        console.error("Failed to load templates for", key, err);
      }
    });
  }, []);

  // helpers for template CRUD
  const handleTemplateSave = async (fieldKey, name, content) => {
    const tpl = await createHistoryTemplate({ fieldKey, name, content });
    setTemplatesByField((prev) => {
      const arr = prev[fieldKey] || [];
      return { ...prev, [fieldKey]: [...arr, tpl] };
    });
    return tpl;
  };

  const handleTemplateUpdate = async (fieldKey, id, data) => {
    const updated = await updateHistoryTemplate(id, data);
    setTemplatesByField((prev) => {
      const arr = prev[fieldKey] || [];
      return {
        ...prev,
        [fieldKey]: arr.map((t) => (t._id === id ? updated : t)),
      };
    });
    return updated;
  };

  const handleTemplateDelete = async (fieldKey, id) => {
    await deleteHistoryTemplate(id);
    setTemplatesByField((prev) => {
      const arr = prev[fieldKey] || [];
      return { ...prev, [fieldKey]: arr.filter((t) => t._id !== id) };
    });
  };

  /* Re-sync form + verified status whenever the saved historyForm changes.
     Always prefer any existing localStorage draft over the DB values so that
     in-progress edits survive navigation / refresh. */
  useEffect(() => {
    const saved = application?.historyForm || patient?.historyForm || {};

    // Load draft once so we can prefer it over the DB snapshot
    let draft = null;
    if (STORAGE_KEY) {
      try { draft = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) {}
    }

    setForm((prev) => {
      const next = { ...prev };
      ALL_KEYS.forEach((k) => {
        if (draft?.form?.[k] !== undefined) {
          // Draft exists for this key — keep the user's edited value
          next[k] = draft.form[k];
        } else {
          const field = saved[k];
          next[k] = (field && typeof field === "object") ? (field.value ?? prev[k] ?? "") : (field ?? prev[k] ?? "");
        }
      });
      next.isFirstAppointment =
        draft?.form?.isFirstAppointment !== undefined
          ? draft.form.isFirstAppointment
          : (saved.isFirstAppointment ?? prev.isFirstAppointment ?? false);
      next.isRepetitiveAppointment =
        draft?.form?.isRepetitiveAppointment !== undefined
          ? draft.form.isRepetitiveAppointment
          : (saved.isRepetitiveAppointment ?? prev.isRepetitiveAppointment ?? false);
      return next;
    });
    setVerifiedStatus((prev) => {
      const next = { ...prev };
      ALL_KEYS.forEach((k) => {
        if (draft?.verifiedStatus?.[k] !== undefined) {
          // Preserve the pending/verified state the user last set
          next[k] = draft.verifiedStatus[k];
        } else {
          const field = saved[k];
          next[k] = field?.isVerified ?? prev[k] ?? false;
        }
      });
      return next;
    });
  }, [application?.historyForm]);

  /* Track which individual fields are in edit mode */
  const [editingFields, setEditingFields] = useState({});
  const containerRef = useRef(null);

  /* Close all editing fields when clicking outside any field */
  useEffect(() => {
    const handleClickOutside = (e) => {
      /* If click is inside any field card or inside a dropdown/color picker, ignore */
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

  const setFieldEditing = useCallback((fieldKey, value) => {
    setEditingFields((prev) => ({ ...prev, [fieldKey]: value }));
   
  }, []);


  /* Editor change handler */
  const handleEditorChange = useCallback((key, html) => {
    setForm((prev) => ({ ...prev, [key]: html }));
  }, []);

  /* Expose data for parent save */
  useImperativeHandle(ref, () => ({
    getData: () => ({ historyForm: { ...form } }),
  }));

  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveCloseConfirm, setShowSaveCloseConfirm] = useState(false);

  /* Toggle a single field's verified status and persist immediately */
  const handleToggleVerify = useCallback(async (key) => {
    if (!application?.applicationId) return;
    if (!navigator.onLine) {
      toast.error(t("history_tab.footer.no_connection"));
      return;
    }
    // if already verified, do not allow toggling back to pending
    if (verifiedStatus[key]) return;

    const newVerified = true; // only transition pending -> verified
    setVerifiedStatus((prev) => ({ ...prev, [key]: newVerified }));
    try {
      await updateHistoryForm(application.applicationId, {
        [key]: { value: form[key] || "", isVerified: newVerified },
      });
    } catch (err) {
      console.error("Verify toggle failed:", err);
      toast.error(t("history_tab.footer.save_error") || "Unable to save");
      // revert on error
      setVerifiedStatus((prev) => ({ ...prev, [key]: false }));
    }
  }, [application, form, verifiedStatus, t]);

  const doSave = useCallback(async () => {
    if (!application?.applicationId) {
      toast.error(t("history_tab.footer.patient_not_found"));
      return false;
    }
    if (!navigator.onLine) {
      toast.error(t("history_tab.footer.no_connection"));
      return false;
    }
    setIsSaving(true);
    try {
      // Wrap each field as { value, isVerified: true } — saving auto-verifies
      const payload = {};
      ALL_KEYS.forEach((k) => {
        payload[k] = { value: form[k] || "", isVerified: !!(form[k]) };
      });
      payload.isFirstAppointment = form.isFirstAppointment;
      payload.isRepetitiveAppointment = form.isRepetitiveAppointment;
      await updateHistoryForm(application.applicationId, payload);
      // Update local verified state
      setVerifiedStatus((prev) => {
        const next = { ...prev };
        ALL_KEYS.forEach((k) => { if (form[k]) next[k] = true; });
        return next;
      });
      // also clear draft after verifying
      if (STORAGE_KEY) localStorage.removeItem(STORAGE_KEY);
      toast.success(t("history_tab.footer.save_success"));
      // clear draft storage on successful save
      if (STORAGE_KEY) localStorage.removeItem(STORAGE_KEY);
      return true;
    } catch (err) {
      console.error("Save history error:", err);
      toast.error(err?.response?.data?.error || t("history_tab.footer.save_error"));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [application, form, t]);

  const handleSaveAll = useCallback(async () => {
    await doSave();
  }, [doSave]);

  const performSaveAndClose = useCallback(async () => {
    const ok = await doSave();
    if (ok) navigate(-1);
    setShowSaveCloseConfirm(false);
  }, [doSave, navigate]);

  const handleSaveAndClose = useCallback(() => {
    setShowSaveCloseConfirm(true);
  }, []);

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
          placeholder={t("history_tab.enter_text")}
          emptyPlaceholder={t("history_tab.click_to_edit")}
        />
      ))}
    </div>
  );

  const renderSection = (section, level = 0) => {
    const isSingleField = section.fields?.length === 1 && !section.fields[0].labelKey && !section.subsections?.length;
    const singleKey = isSingleField ? section.fields[0].key : null;
    const singleEditing = singleKey ? !!editingFields[singleKey] : false;
    const fieldKey = section.id;
    const hasContent = !!(form[fieldKey]);
    const isVerified = verifiedStatus[fieldKey];

    return (
      <div
        key={section.id}
        className={`ht-section${level > 0 ? " ht-subsection" : ""}${singleEditing ? " ht-section--editing" : ""}`}
      >
        {/* ── Header ── */}
        <div
          className={`ht-section-header${level > 0 ? " ht-subsection-header" : ""}${isSingleField ? " ht-section-header--clickable" : ""}`}
          onClick={isSingleField ? () => setFieldEditing(singleKey, !singleEditing) : undefined}
        >
          <span className={level > 0 ? "ht-subsection-title" : "ht-section-title"}>
            {t(section.titleKey)}
          </span>

          {/* Right-side actions: status badge → template picker → edit icon */}
          <div className="ht-header-actions">
            {(hasContent && (templatesByField[section.id] || []).length > 0) && (
              <span
                className={`ht-status-badge ${isVerified ? "ht-status-verified" : "ht-status-pending"}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isVerified) handleToggleVerify(fieldKey);
                }}
                title={isVerified ? "Verified" : "Pending — click to mark as verified"}
              >
                {isVerified ? "✓ Verified" : "🟡"+t("pending")}
              </span>
            )}
            <TemplatePicker
              templates={templatesByField[section.id] || []}
              currentValue={form[section.id] || ""}
              onApply={(html) => handleEditorChange(section.id, html)}
              onSave={(name, content) => handleTemplateSave(section.id, name, content)}
              onUpdate={(id, data) => handleTemplateUpdate(section.id, id, data)}
              onDelete={(id) => handleTemplateDelete(section.id, id)}
            />
            {isSingleField && (
              <span
                className={`ht-field-toggle ${singleEditing ? "ht-field-toggle--active" : ""}`}
                onClick={(e) => { e.stopPropagation(); setFieldEditing(singleKey, !singleEditing); }}
              >
                {singleEditing ? "\u2715" : "\u270E"}
              </span>
            )}
          </div>
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
                  placeholder={t("history_tab.enter_text")}
                />
              </div>
            ) : (
              <div
                data-ht-field
                className={`ht-preview${!form[singleKey] ? " ht-preview--empty" : ""}`}
                onClick={() => setFieldEditing(singleKey, true)}
                dangerouslySetInnerHTML={{ __html: form[singleKey] || `<span class='ht-preview-placeholder'>${t("history_tab.click_to_edit")}</span>` }}
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
        {/* first‑appointment toggle — doctor can mark/unmark */}
        <div className="check-box">
          <div className="ht-first-appointment">
          <label>
            <input
              type="checkbox"
              checked={form.isFirstAppointment}
              onChange={async (e) => {
                const checked = e.target.checked;
                setForm(prev => ({
                  ...prev,
                  isFirstAppointment: checked,
                  ...(checked ? { isRepetitiveAppointment: false } : {}),
                }));
                toast.info(
                  checked
                    ? t("history_tab.toast.markedFirst")
                    : t("history_tab.toast.unmarkedFirst")
                );
                // persist immediately
                if (application?.applicationId) {
                  try {
                    await updateHistoryForm(application.applicationId, {
                      isFirstAppointment: checked,
                    });
                  } catch (err) {
                    console.error("Failed to update firstAppointment", err);
                    toast.error(
                      t("history_tab.toast.updateError") ||
                        "Unable to save flag"
                    );
                  }
                }
              }}
            />
            {t("history_tab.firstAppointment")}
          </label>
        </div>
        <div className="ht-first-appointment">
          <label>
            <input
              type="checkbox"
              checked={form.isRepetitiveAppointment}
              onChange={async (e) => {
                const checked = e.target.checked;
                setForm(prev => ({
                  ...prev,
                  isRepetitiveAppointment: checked,
                  ...(checked ? { isFirstAppointment: false } : {}),
                }));
                toast.info(
                  checked
                    ? t("history_tab.toast.markedRepetitive")
                    : t("history_tab.toast.unmarkedRepetitive")
                );
                // persist immediately
                if (application?.applicationId) {
                  try {
                    await updateHistoryForm(application.applicationId, {
                      isRepetitiveAppointment: checked,
                    });
                  } catch (err) {
                    console.error("Failed to update isRepetitiveAppointment", err);
                    toast.error(
                      t("history_tab.toast.updateError") ||
                        "Unable to save flag"
                    );
                  }
                }
              }}
            />
            {t("history_tab.repetitiveAppointment")}
          </label>
        </div>
        </div>
        
        {HISTORY_SECTIONS.map((s) => renderSection(s))}
      </div>
      {/* Always-visible sticky footer */}
      <div className="adp-sticky-footer">
        <button
          className="adp-btn-save-outline"
          onClick={handleSaveAll}
          disabled={isSaving}
        >
          {isSaving
            ? t("history_tab.footer.saving")
            : t("history_tab.footer.save")}
        </button>
        <button
          className="adp-btn-save-primary"
          onClick={handleSaveAndClose}
          disabled={isSaving}
        >
          {isSaving
            ? t("history_tab.footer.saving")
            : t("history_tab.footer.save_and_close")}
        </button>
      </div>

      {showSaveCloseConfirm && (
        <div className="custom-confirm-overlay">
          <div className="custom-confirm-modal">
            <h3>{t("history_tab.footer.confirm_title", "Confirm Save and Close")}</h3>
            <p>
              {t(
                "history_tab.footer.confirm_save_and_close",
                "Do you want to save changes and close this window?",
              )}
            </p>
            <div className="custom-confirm-actions">
              <button
                className="adp-btn-save-outline"
                onClick={() => setShowSaveCloseConfirm(false)}
                disabled={isSaving}
              >
                {t("footer.cancel", "Cancel")}
              </button>
              <button
                className="adp-btn-save-primary"
                onClick={performSaveAndClose}
                disabled={isSaving}
              >
                {isSaving
                  ? t("history_tab.footer.saving")
                  : t("footer.confirm", "Confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default HistoryTab;
