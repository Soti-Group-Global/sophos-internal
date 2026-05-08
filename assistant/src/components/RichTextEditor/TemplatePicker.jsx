import React, { useState, useRef, useEffect, useCallback } from "react";
import { FiTrash2, FiPlus, FiCheck, FiX, FiRotateCcw, FiEdit2, FiCopy } from "react-icons/fi";
import { LuClipboardList } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import "./TemplatePicker.css";

/**
 * TemplatePicker
 *
 * Props:
 *   templates    – array of { _id, name, content } for this specific field
 *   currentValue – current HTML content of the editor (used when saving)
 *   onApply(content)           – called when the user selects a template
 *   onSave(name, content)      – called when the user saves a new template
 *   onDelete(id)               – called when the user deletes a template
 */
const TemplatePicker = ({ templates = [], currentValue = "", onApply, onSave, onUpdate, onDelete, onDuplicate, editorOpen = false }) => {
  const { t } = useTranslation("rich_text_editor");
  const [open, setOpen] = useState(false);
  const [saveMode, setSaveMode] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [saving, setSaving] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  /* snapshot of the content that existed BEFORE the last template was applied */
  const [prevContent, setPrevContent] = useState(null);
  /* full edit mode: load template into editor, update name+content on save */
  const [editingTpl, setEditingTpl] = useState(null); // { _id, name } | null
  const editOriginalContent = useRef("");             // content before edit started

  const btnRef = useRef(null);
  const dropdownRef = useRef(null);

  /* ── Position the dropdown using fixed coords to escape overflow:hidden ── */
  const updateDropdownPos = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
      zIndex: 9999,
    });
  }, []);

  /* ── Close on outside click ── */
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        btnRef.current?.contains(e.target) ||
        dropdownRef.current?.contains(e.target)
      ) return;
      setOpen(false);
      setSaveMode(false);
      setTemplateName("");
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  /* ── Reposition on scroll / resize ── */
  useEffect(() => {
    if (!open) return;
    const reposition = () => updateDropdownPos();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, updateDropdownPos]);

  const handleToggle = (e) => {
    e.stopPropagation();
    if (!open) {
      updateDropdownPos();
      setSaveMode(false);
      setTemplateName("");
    }
    setOpen((o) => !o);
  };

  const handleApply = (tpl) => {
    setPrevContent(currentValue);  // snapshot so user can restore
    setOpen(false);
    onApply?.(tpl.content);
  };

  const handleRestore = (e) => {
    e.stopPropagation();
    onApply?.(prevContent);
    setPrevContent(null);
    setOpen(false);
  };

  const handleSave = async () => {
    const name = templateName.trim();
    if (!name) return;
    setSaving(true);
    try {
      await onSave?.(name, currentValue);
      setTemplateName("");
      setSaveMode(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    onDelete?.(id);
  };

  const handleDuplicate = (e, tpl) => {
    e.stopPropagation();
    onDuplicate?.(tpl);
  };

  /* ── Edit mode: load content into editor, show update bar ── */
  const handleEditStart = (e, tpl) => {
    e.stopPropagation();
    setPrevContent(null);                          // hide Restore — not needed during edit mode
    editOriginalContent.current = currentValue;    // remember what was there before
    setEditingTpl({ _id: tpl._id, name: tpl.name });
    setOpen(false);
    onApply?.(tpl.content);                        // load template into editor
  };

  const handleUpdateSave = async () => {
    const name = editingTpl.name.trim();
    if (!name) return;
    await onUpdate?.(editingTpl._id, { name, content: currentValue });
    setEditingTpl(null);
    onApply?.(editOriginalContent.current);        // restore original content
    editOriginalContent.current = "";
  };

  const handleUpdateCancel = () => {
    onApply?.(editOriginalContent.current);        // restore original content
    editOriginalContent.current = "";
    setEditingTpl(null);
  };

  return (
    <div className="tp-wrap" onClick={(e) => e.stopPropagation()}>
      {/* ── Editing bar ── shown while editing a template */}
      {editingTpl !== null && (
        <div className="tp-editing-bar">
          <FiEdit2 size={11} className="tp-editing-icon" />
          <input
            type="text"
            className="tp-editing-name"
            value={editingTpl.name}
            maxLength={120}
            onChange={(e) => setEditingTpl((prev) => ({ ...prev, name: e.target.value }))}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") handleUpdateSave();
              if (e.key === "Escape") handleUpdateCancel();
            }}
          />
          <button
            type="button"
            className="tp-editing-update"
            onClick={handleUpdateSave}
            disabled={!editingTpl.name.trim()}
            title={t("template_picker.update_title")}
          >
            <FiCheck size={11} />
            {t("template_picker.update_label")}
          </button>
          <button
            type="button"
            className="tp-editing-cancel"
            onClick={handleUpdateCancel}
            title={t("template_picker.cancel_title")}
          >
            <FiX size={11} />
          </button>
        </div>
      )}

      {/* ── Restore previous ── */}
      {prevContent !== null && (
        <button
          type="button"
          className="tp-restore"
          onClick={handleRestore}
          title={t("template_picker.restore_title")}
        >
          <FiRotateCcw size={11} />
          {t("template_picker.restore_label")}
        </button>
      )}

      {/* ── Trigger button ── */}
      <button
        ref={btnRef}
        type="button"
        className={`tp-btn${open ? " tp-btn--open" : ""}${templates.length > 0 ? " tp-btn--has" : ""}`}
        onClick={handleToggle}
        title={t("template_picker.trigger_title")}
      >
        <LuClipboardList size={13} />
        <span className="tp-btn-label">{t("template_picker.trigger_label")}</span>
        {templates.length > 0 && (
          <span className="tp-count">{templates.length}</span>
        )}
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div
          ref={dropdownRef}
          className="tp-dropdown"
          style={dropdownStyle}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="tp-dropdown-head">
            <span>{t("template_picker.header")}</span>
            <button
              type="button"
              className="tp-dropdown-close"
              onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            >
              <FiX size={12} />
            </button>
          </div>

          {/* Template list */}
          {templates.length === 0 ? (
            <div className="tp-empty">{t("template_picker.empty")}</div>
          ) : (
            <ul className="tp-list">
              {templates.map((tpl) => (
                <li key={tpl._id} className={`tp-item${editingTpl?._id === tpl._id ? " tp-item--editing" : ""}`}>
                  <button
                    type="button"
                    className="tp-item-apply"
                    onClick={() => handleApply(tpl)}
                    title={t("template_picker.load_title", { name: tpl.name })}
                  >
                    <LuClipboardList size={11} className="tp-item-icon" />
                    <span className="tp-item-name">{tpl.name}</span>
                    {tpl.isDefault && (
                      <span className="tp-item-default-badge">Default</span>
                    )}
                  </button>
                  <button
                    type="button"
                    className="tp-item-edit"
                    onClick={(e) => handleEditStart(e, tpl)}
                    title={t("template_picker.edit_title")}
                  >
                    <FiEdit2 size={11} />
                  </button>
                  <button
                    type="button"
                    className="tp-item-dup"
                    onClick={(e) => handleDuplicate(e, tpl)}
                    title="Duplicate template"
                  >
                    <FiCopy size={11} />
                  </button>
                  <button
                    type="button"
                    className="tp-item-del"
                    onClick={(e) => handleDelete(e, tpl._id)}
                    title={t("template_picker.delete_title")}
                  >
                    <FiTrash2 size={11} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Save section — only when the editor is open */}
          {editorOpen && (
          <div className="tp-save">
            {!saveMode ? (
              <button
                type="button"
                className="tp-save-trigger"
                onClick={(e) => { e.stopPropagation(); setSaveMode(true); }}
              >
                <FiPlus size={12} />
                {t("template_picker.save_trigger")}
              </button>
            ) : (
              <div className="tp-save-form">
                <input
                  autoFocus
                  type="text"
                  className="tp-save-input"
                  placeholder={t("template_picker.save_placeholder")}
                  value={templateName}
                  maxLength={120}
                  onChange={(e) => setTemplateName(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") handleSave();
                    if (e.key === "Escape") {
                      setSaveMode(false);
                      setTemplateName("");
                    }
                  }}
                />
                <button
                  type="button"
                  className="tp-save-ok"
                  onClick={handleSave}
                  disabled={saving || !templateName.trim()}
                  title={t("template_picker.save_title")}
                >
                  {saving ? <span className="tp-spinner" /> : <FiCheck size={12} />}
                </button>
                <button
                  type="button"
                  className="tp-save-cancel"
                  onClick={(e) => { e.stopPropagation(); setSaveMode(false); setTemplateName(""); }}
                  title={t("template_picker.cancel_title")}
                >
                  <FiX size={12} />
                </button>
              </div>
            )}
          </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TemplatePicker;
