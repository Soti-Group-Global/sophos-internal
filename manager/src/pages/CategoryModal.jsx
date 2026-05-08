import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { toast } from "react-toastify";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { createServiceCategory, updateServiceCategory, getAllCategories } from "../utils/api";
import api from "../utils/api";

const EMPTY_FORM = {
  name: "",
  identifier: "",
  comment: "",
  isLinkedWithSpeciality: false,
  specialities: [],
  isActive: true,
};

const ANIM_DURATION = 260; // ms — must match CSS

const CategoryModal = ({ open, editing, currentFolder, onClose, onSaved }) => {
  const { t } = useTranslation("serviceManager");
  const [form, setForm] = useState(EMPTY_FORM);
  const [specialties, setSpecialties] = useState([]);
  const [loadingSpecialties, setLoadingSpecialties] = useState(false);
  const [specialityOwnerMap, setSpecialityOwnerMap] = useState({});
  const [saving, setSaving] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // ── populate form on open ──────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name || "",
        identifier: editing.identifier || "",
        comment: editing.comment || "",
        isLinkedWithSpeciality: !!editing.isLinkedWithSpeciality,
        specialities: Array.isArray(editing.specialities)
          ? editing.specialities.map((s) => (typeof s === "object" ? s._id : s))
          : [],
        isActive: editing.isActive !== undefined ? editing.isActive : true,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, editing]);

  // ── load speciality → category owner map ──────────────────────
  useEffect(() => {
    if (!open || !form.isLinkedWithSpeciality) return;
    const loadLinkedCategories = async () => {
      try {
        const response = await getAllCategories({ linkedOnly: "true" });
        const categories = response?.categories || response || [];
        const editingId = editing?._id?.toString();
        const map = {};
        (categories || []).forEach((cat) => {
          if (cat._id?.toString() === editingId) return;
          (cat.specialities || []).forEach((sp) => {
            const spId = typeof sp === "object" ? sp._id?.toString() : sp?.toString();
            if (spId) {
              if (!map[spId]) map[spId] = [];
              map[spId].push(cat.name);
            }
          });
        });
        setSpecialityOwnerMap(map);
      } catch {
        setSpecialityOwnerMap({});
      }
    };

    loadLinkedCategories();
  }, [open, form.isLinkedWithSpeciality, editing?._id]);

  // ── load specialties ───────────────────────────────────────────
  useEffect(() => {
    if (!open || !form.isLinkedWithSpeciality || specialties.length > 0) return;
    setLoadingSpecialties(true);
    api
      .get("/specialty-master/specialties")
      .then((r) => setSpecialties(Array.isArray(r.data) ? r.data : r.data?.data || []))
      .catch(() => toast.error(t("category.loadSpecialtiesFailed")))
      .finally(() => setLoadingSpecialties(false));
  }, [open, form.isLinkedWithSpeciality]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const allSelected = specialties.length > 0 && form.specialities.length === specialties.length;
  const someSelected = form.specialities.length > 0 && !allSelected;

  const handleSelectAll = () => {
    setForm((prev) => ({
      ...prev,
      specialities: allSelected ? [] : specialties.map((s) => s._id),
    }));
  };

  const toggleSpeciality = (id) => {
    setForm((prev) => ({
      ...prev,
      specialities: prev.specialities.includes(id)
        ? prev.specialities.filter((s) => s !== id)
        : [...prev.specialities, id],
    }));
  };

  // Animate out → then call actual onClose
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, ANIM_DURATION);
  };

  // ── submit ─────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error(t("category.nameRequired")); return; }

    const linkActive = form.isLinkedWithSpeciality;

    const payload = {
      name: form.name.trim(),
      identifier: form.identifier.trim(),
      comment: form.comment.trim(),
      isLinkedWithSpeciality: linkActive,
      specialities: linkActive ? form.specialities : [],
      speciality: null,
      isActive: form.isActive,
      parent: currentFolder || null,
    };

    setSaving(true);
    try {
      if (editing) {
        await updateServiceCategory(editing._id, payload);
        toast.success(t("category.updated"));
      } else {
        await createServiceCategory(payload);
        toast.success(t("category.created"));
      }

      onSaved();
      handleClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || t("category.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const drawer = (
    <>
      <div
        className={`sm-drawer-overlay${isClosing ? " closing" : ""}`}
        onClick={isClosing ? undefined : handleClose}
      />
      <div
        className={`sm-drawer${isClosing ? " closing" : ""}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="sm-modal-header">
          <h2>{editing ? t("category.editTitle") : t("category.addTitle")}</h2>
          <button className="sm-modal-close" onClick={handleClose} aria-label={t("close")}>
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}
        >
          <div className="sm-modal-body">

            {/* Name */}
            <div className="sm-field">
              <label htmlFor="cat-name">
                {t("category.name")} <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                id="cat-name"
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder={t("category.namePlaceholder")}
                autoFocus
              />
            </div>

            {/* Identifier */}
            <div className="sm-field">
              <label htmlFor="cat-identifier">{t("category.identifier")}</label>
              <input
                id="cat-identifier"
                type="text"
                name="identifier"
                value={form.identifier}
                onChange={handleChange}
                placeholder={t("category.identifierPlaceholder")}
              />
            </div>

            {/* Comment */}
            <div className="sm-field">
              <label htmlFor="cat-comment">{t("category.comment")}</label>
              <textarea
                id="cat-comment"
                name="comment"
                value={form.comment}
                onChange={handleChange}
                placeholder={t("category.commentPlaceholder")}
                rows={3}
              />
            </div>

            {/* Toggle — link with speciality */}
            <label className="sm-toggle-row">
              <input
                type="checkbox"
                name="isLinkedWithSpeciality"
                checked={form.isLinkedWithSpeciality}
                onChange={handleChange}
              />
              {t("category.linkedWithSpeciality")}
            </label>

            {/* Speciality multi-select */}
            {form.isLinkedWithSpeciality && (
              <div className="sm-field">
                <label>
                  {t("category.speciality")}
                  {form.specialities.length > 0 && (
                    <span className="sm-speciality-count">{form.specialities.length}</span>
                  )}
                </label>
                {loadingSpecialties ? (
                  <div style={{ fontSize: 13, color: "#94a3b8" }}>
                    {t("category.loadingSpecialties")}
                  </div>
                ) : (
                  <div className="sm-speciality-list">
                    <label className="sm-speciality-item sm-speciality-item--all">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => { if (el) el.indeterminate = someSelected; }}
                        onChange={handleSelectAll}
                      />
                      <span>{t("category.selectAll")}</span>
                    </label>
                    <div className="sm-speciality-divider" />
                    {specialties.map((sp) => {
                      const owners = specialityOwnerMap[sp._id?.toString()];
                      return (
                        <label key={sp._id} className="sm-speciality-item">
                          <input
                            type="checkbox"
                            checked={form.specialities.includes(sp._id)}
                            onChange={() => toggleSpeciality(sp._id)}
                          />
                          <span className="sm-speciality-item-name">{sp.name_ru || sp.name_en || sp._id}</span>
                          {owners?.length > 0 && (
                            <span className="sm-speciality-owner-note">
                              {t("category.alreadyLinked", { name: owners.join(", ") })}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Active */}
            <label className="sm-toggle-row">
              <input
                type="checkbox"
                name="isActive"
                checked={form.isActive}
                onChange={handleChange}
              />
              {t("category.active")}
            </label>

            {/* Footer */}
            <div className="sm-modal-footer">
              <button type="button" className="sm-btn-cancel" onClick={handleClose} disabled={saving}>
                {t("category.cancel")}
              </button>
              <button type="submit" className="sm-btn-submit" disabled={saving}>
                {saving
                  ? t("category.saving")
                  : editing
                  ? t("category.saveChanges")
                  : t("category.create")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );

  return createPortal(drawer, document.body);
};

export default CategoryModal;
