import { useState, useEffect, useContext, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { AuthContext } from "../context/AuthContext";
import { getBoardNotes, createBoardNote, updateBoardNote, deleteBoardNote } from "../utils/api";
import CommonRichTextEditor from "../components/RichTextEditor/CommonRichTextEditor";
import {
  Pin, Trash2, Edit3, User, Users, Lock, X, Check,
} from "lucide-react";
import "../styles/BoardPage.css";

// Display groups: each chip controls one or more DB roles
const ROLE_GROUPS = [
  { key: "role_super_admin",     values: ["super_admin"] },
  { key: "role_manager",         values: ["manager"] },
  { key: "role_head_manager",    values: ["head_manager"] },
  { key: "role_content_manager", values: ["content_manager"] },
  { key: "role_doctor",          values: ["doctor", "head_doctor"] },
  { key: "role_assistant",       values: ["assistant", "head_assistant"] },
];

// For badge display: map a role value to its translation key
const roleKeyMap = {};
ROLE_GROUPS.forEach((g) => g.values.forEach((v) => { roleKeyMap[v] = g.key; }));

function RoleSelect({ selected, onChange }) {
  const { t } = useTranslation();
  const toggleGroup = (values) => {
    const allOn = values.every((v) => selected.includes(v));
    if (allOn) {
      onChange(selected.filter((v) => !values.includes(v)));
    } else {
      const merged = [...selected, ...values.filter((v) => !selected.includes(v))];
      onChange(merged);
    }
  };
  return (
    <div className="bp-role-select">
      {ROLE_GROUPS.map((g) => {
        const allOn = g.values.every((v) => selected.includes(v));
        return (
          <button
            key={g.key}
            type="button"
            className={`bp-role-chip${allOn ? " bp-role-chip--on" : ""}`}
            onClick={() => toggleGroup(g.values)}
          >
            {t(`board.${g.key}`)}
          </button>
        );
      })}
    </div>
  );
}

function NoteCard({ note, currentUserEmail, onEdit, onDelete, onPin }) {
  const { t } = useTranslation();
  const isOwner = note.createdBy === currentUserEmail;

  return (
    <div className={`bp-card${note.pinned ? " bp-card--pinned" : ""}`}>
      <div className="bp-card-header">
        <div className="bp-card-meta">
          {note.pinned && <span className="bp-pin-badge"><Pin size={11} /></span>}
          {note.isPersonal
            ? <span className="bp-badge bp-badge--personal"><Lock size={11} /> {t("board.personal")}</span>
            : note.visibleTo?.length > 0
              ? <span className="bp-badge bp-badge--roles"><Users size={11} /> {[...new Set(note.visibleTo.map((r) => t(`board.${roleKeyMap[r]}`) || r))].join(", ")}</span>
              : <span className="bp-badge bp-badge--all"><Users size={11} /> {t("board.allRoles")}</span>
          }
        </div>
        {isOwner && (
          <div className="bp-card-actions">
            <button className="bp-card-btn" title={note.pinned ? "Unpin" : "Pin"} onClick={() => onPin(note)}><Pin size={14} /></button>
            <button className="bp-card-btn" title="Edit" onClick={() => onEdit(note)}><Edit3 size={14} /></button>
            <button className="bp-card-btn bp-card-btn--danger" title="Delete" onClick={() => onDelete(note._id)}><Trash2 size={14} /></button>
          </div>
        )}
      </div>
      {note.title && <h4 className="bp-card-title">{note.title}</h4>}
      <div className="bp-card-content" dangerouslySetInnerHTML={{ __html: note.content }} />
      <div className="bp-card-footer">
        <User size={11} /> {note.createdByName || note.createdBy}
        <span className="bp-card-date">{new Date(note.createdAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

const EMPTY_FORM = { title: "", content: "", isPersonal: false, visibleTo: [] };

export default function BoardPage({ onClose }) {
  const { t } = useTranslation();
  const { user } = useContext(AuthContext);

  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Inline form state
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState(null); // null = new
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBoardNotes();
      setNotes(res.data?.notes || []);
    } catch {
      toast.error(t("board.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const openAdd = () => {
    setEditingNote(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (note) => {
    setEditingNote(note);
    setForm({
      title: note.title || "",
      content: note.content || "",
      isPersonal: note.isPersonal ?? false,
      visibleTo: note.visibleTo || [],
    });
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingNote(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    if (!form.content || form.content === "<p></p>") {
      toast.error(t("board.contentRequired"));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        content: form.content,
        isPersonal: form.isPersonal,
        visibleTo: form.isPersonal ? [] : form.visibleTo,
      };
      if (editingNote?._id) {
        const res = await updateBoardNote(editingNote._id, payload);
        setNotes((prev) => prev.map((n) => n._id === editingNote._id ? res.data.note : n));
      } else {
        const res = await createBoardNote(payload);
        setNotes((prev) => [res.data.note, ...prev]);
      }
      toast.success(t("board.saved"));
      cancelForm();
    } catch {
      toast.error(t("board.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t("board.deleteConfirm"))) return;
    await deleteBoardNote(id);
    setNotes((prev) => prev.filter((n) => n._id !== id));
    toast.success(t("board.deleted"));
  };

  const handlePin = async (note) => {
    const res = await updateBoardNote(note._id, { pinned: !note.pinned });
    setNotes((prev) => {
      const updated = prev.map((n) => n._id === note._id ? res.data.note : n);
      return [...updated].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    });
  };

  return (
    <div className="bp-page">
      {/* Page header */}
      <div className="bp-page-header">
        <div>
          <h1 className="bp-page-title">{t("board.pageTitle")}</h1>
          <p className="bp-page-sub">{t("board.pageSubtitle")}</p>
        </div>
        <div className="bp-header-actions">
          {!showForm && (
            <button className="bp-add-btn" onClick={openAdd}>
              + {t("board.addNote")}
            </button>
          )}
          {onClose && (
            <button className="bp-drawer-close-btn" onClick={onClose} title="Close">
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Inline note form */}
      {showForm && (
        <div className="bp-form-panel">
          <div className="bp-form-header">
            <h3>{editingNote ? t("board.editNote") : t("board.addNote")}</h3>
            <button className="bp-form-close" onClick={cancelForm}><X size={18} /></button>
          </div>



          {/* Rich text editor */}
          <div className="bp-field">
            <label className="bp-label">{t("board.contentLabel")} *</label>
            <CommonRichTextEditor
              value={form.content}
              onChange={(html) => setForm((f) => ({ ...f, content: html }))}
              placeholder={t("board.contentPlaceholder", "Write your note here…")}
            />
          </div>

          {/* Visibility */}
          <div className="bp-field">
            <label className="bp-label">{t("board.visibilityLabel")}</label>
            <div className="bp-visibility-row">
              <button
                type="button"
                className={`bp-vis-btn${form.isPersonal ? " bp-vis-btn--active" : ""}`}
                onClick={() => setForm((f) => ({ ...f, isPersonal: true }))}
              >
                <Lock size={14} /> {t("board.personal")}
              </button>
              <button
                type="button"
                className={`bp-vis-btn${!form.isPersonal ? " bp-vis-btn--active" : ""}`}
                onClick={() => setForm((f) => ({ ...f, isPersonal: false }))}
              >
                <Users size={14} /> {t("board.roles")}
              </button>
            </div>
            {!form.isPersonal && (
              <div className="bp-field-sub">
                <p className="bp-sublabel">{t("board.selectRoles")}</p>
                <RoleSelect
                  selected={form.visibleTo}
                  onChange={(val) => setForm((f) => ({ ...f, visibleTo: val }))}
                />
              </div>
            )}
          </div>

          {/* Form actions */}
          <div className="bp-form-actions">
            <button className="bp-btn-cancel" onClick={cancelForm}>{t("board.cancel")}</button>
            <button className="bp-btn-save" onClick={handleSave} disabled={saving}>
              {saving ? "..." : <><Check size={14} /> {t("board.save")}</>}
            </button>
          </div>
        </div>
      )}

      {/* Notes grid */}
      {loading ? (
        <div className="bp-loading"><div className="bp-spinner" /></div>
      ) : notes.length === 0 ? (
        <div className="bp-empty"><p>{t("board.noNotes")}</p></div>
      ) : (
        <div className="bp-grid">
          {notes.map((note) => (
            <NoteCard
              key={note._id}
              note={note}
              currentUserEmail={user?.email}
              onEdit={openEdit}
              onDelete={handleDelete}
              onPin={handlePin}
            />
          ))}
        </div>
      )}
    </div>
  );
}
