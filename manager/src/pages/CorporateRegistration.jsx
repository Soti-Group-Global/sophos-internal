import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
  Plus,
  Trash2,
  Edit2,
  Building,
  Mail,
  Phone,
  Percent,
  Link,
  Copy,
  Check,
  X,
  ChevronRight,
  Users,
  Tag,
} from "lucide-react";
import {
  getCorporateRegistrations,
  createCorporateRegistration,
  updateCorporateRegistration,
  deleteCorporateRegistration,
  getCorporateFormSubmissions,
} from "../utils/api";
import LoadingComponent from "../components/Loading/LoadingComponent";
import "../styles/CorporateRegistration.css";

const EMPTY_FORM = {
  link: "",
  corporateName: "",
  hr: { firstName: "", lastName: "", middleName: "" },
  email: "",
  phone: "",
  discountPercentage: "",
};

const CorporateRegistration = () => {
  const { t } = useTranslation();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // Split view state
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const res = await getCorporateRegistrations();
      setRecords(res.data || []);
    } catch {
      toast.error(t("corporate_registration.load_error"));
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissions = useCallback(async (link) => {
    try {
      setSubmissionsLoading(true);
      const res = await getCorporateFormSubmissions(link);
      setSubmissions(res.data || []);
    } catch {
      setSubmissions([]);
    } finally {
      setSubmissionsLoading(false);
    }
  }, []);

  const handleSelectCompany = (rec) => {
    if (selectedCompany?._id === rec._id) {
      setSelectedCompany(null);
      setSubmissions([]);
      return;
    }
    setSelectedCompany(rec);
    fetchSubmissions(rec.link);
  };

  const closePanel = () => {
    setSelectedCompany(null);
    setSubmissions([]);
  };

  const openCreate = () => {
    setEditingRecord(null);
    setForm(EMPTY_FORM);
    setIsModalOpen(true);
  };

  const openEdit = (rec, e) => {
    e.stopPropagation();
    setEditingRecord(rec);
    setForm({
      link: rec.link,
      corporateName: rec.corporateName,
      hr: {
        firstName: rec.hr?.firstName || "",
        lastName: rec.hr?.lastName || "",
        middleName: rec.hr?.middleName || "",
      },
      email: rec.email,
      phone: rec.phone || "",
      discountPercentage: rec.discountPercentage ?? "",
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRecord(null);
    setForm(EMPTY_FORM);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith("hr.")) {
      const field = name.split(".")[1];
      setForm((prev) => ({ ...prev, hr: { ...prev.hr, [field]: value } }));
    } else if (name === "link") {
      const formatted = value.toLowerCase().replace(/\s+/g, "-");
      setForm((prev) => ({ ...prev, link: formatted }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingRecord) {
        await updateCorporateRegistration(editingRecord._id, form);
        toast.success(t("corporate_registration.update_success"));
        if (selectedCompany?._id === editingRecord._id) {
          setSelectedCompany((prev) => ({ ...prev, ...form }));
        }
      } else {
        await createCorporateRegistration(form);
        toast.success(t("corporate_registration.create_success"));
      }
      closeModal();
      fetchRecords();
    } catch (err) {
      toast.error(err?.response?.data?.message || t("corporate_registration.save_error"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm(t("corporate_registration.delete_confirm"))) return;
    try {
      await deleteCorporateRegistration(id);
      toast.success(t("corporate_registration.delete_success"));
      if (selectedCompany?._id === id) closePanel();
      fetchRecords();
    } catch {
      toast.error(t("corporate_registration.delete_error"));
    }
  };

  const copyLink = (link, id, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`https://forms.sophos-med.ru/${link}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  if (loading) return <LoadingComponent message={t("corporate_registration.title")} />;

  const isEdit = !!editingRecord;
  const splitView = !!selectedCompany;

  return (
    <div className="corp-reg-page">
      {/* Header */}
      <div className="corp-reg-header">
        <div>
          <h1 className="corp-reg-title">{t("corporate_registration.title")}</h1>
          <p className="corp-reg-subtitle">{t("corporate_registration.subtitle")}</p>
        </div>
        <button className="corp-reg-create-btn" onClick={openCreate}>
          <Plus size={16} />
          <span>{t("corporate_registration.new_registration")}</span>
        </button>
      </div>

      {/* Split view container */}
      <div className={`corp-reg-split${splitView ? " corp-reg-split--active" : ""}`}>

        {/* Left: Company table */}
        <div className="corp-reg-left">
          {records.length === 0 ? (
            <div className="corp-reg-empty">
              <Building size={48} />
              <h3>{t("corporate_registration.empty_title")}</h3>
              <p>{t("corporate_registration.empty_subtitle")}</p>
              <button className="corp-reg-create-btn" onClick={openCreate}>
                <Plus size={16} /> {t("corporate_registration.new_registration")}
              </button>
            </div>
          ) : (
            <div className="corp-reg-table-wrapper">
              <table className="corp-reg-table">
                <thead>
                  <tr>
                    <th>{t("corporate_registration.col_corporate_name")}</th>
                    {!splitView && <th>{t("corporate_registration.col_hr")}</th>}
                    {!splitView && <th>{t("corporate_registration.col_email")}</th>}
                    {!splitView && <th>{t("corporate_registration.col_phone")}</th>}
                    <th>{t("corporate_registration.col_discount")}</th>
                    {!splitView && <th>{t("corporate_registration.col_form_link")}</th>}
                    <th>{t("corporate_registration.col_actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec) => (
                    <tr
                      key={rec._id}
                      className={`corp-reg-row-clickable${selectedCompany?._id === rec._id ? " corp-reg-row-selected" : ""}`}
                      onClick={() => handleSelectCompany(rec)}
                    >
                      <td>
                        <div className="corp-reg-name">
                          <Building size={14} />
                          <span>{rec.corporateName}</span>
                          <ChevronRight size={13} className="corp-reg-row-chevron" />
                        </div>
                      </td>
                      {!splitView && (
                        <td>
                          {rec.hr
                            ? [rec.hr.lastName, rec.hr.firstName, rec.hr.middleName].filter(Boolean).join(" ")
                            : "—"}
                        </td>
                      )}
                      {!splitView && (
                        <td>
                          <div className="corp-reg-cell-icon">
                            <Mail size={13} />
                            {rec.email}
                          </div>
                        </td>
                      )}
                      {!splitView && (
                        <td>
                          {rec.phone ? (
                            <div className="corp-reg-cell-icon">
                              <Phone size={13} />
                              {rec.phone}
                            </div>
                          ) : "—"}
                        </td>
                      )}
                      <td>
                        {rec.discountPercentage != null ? (
                          <div className="corp-reg-cell-icon">
                            <Percent size={13} />
                            {rec.discountPercentage}%
                          </div>
                        ) : "—"}
                      </td>
                      {!splitView && (
                        <td>
                          <div className="corp-reg-link-cell">
                            <span className="corp-reg-link-text">
                              forms.sophos-med.ru/{rec.link}
                            </span>
                            <button
                              className="corp-reg-copy-btn"
                              onClick={(e) => copyLink(rec.link, rec._id, e)}
                              title={t("corporate_registration.copy_link")}
                            >
                              {copiedId === rec._id ? <Check size={13} /> : <Copy size={13} />}
                            </button>
                          </div>
                        </td>
                      )}
                      <td>
                        <div className="corp-reg-action-btns">
                          <button
                            className="corp-reg-edit-btn"
                            onClick={(e) => openEdit(rec, e)}
                            title={t("corporate_registration.edit_registration")}
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            className="corp-reg-delete-btn"
                            onClick={(e) => handleDelete(rec._id, e)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: Submissions panel */}
        {splitView && (
          <div className="corp-reg-right">
            <div className="corp-reg-panel-header">
              <div className="corp-reg-panel-title">
                <Users size={16} />
                <span>{selectedCompany.corporateName}</span>
              </div>
              <button className="corp-reg-panel-close" onClick={closePanel}>
                <X size={16} />
              </button>
            </div>

            {submissionsLoading ? (
              <div className="corp-reg-panel-loading">Loading...</div>
            ) : submissions.length === 0 ? (
              <div className="corp-reg-panel-empty">
                <Users size={32} />
                <p>No submissions yet</p>
              </div>
            ) : (
              <div className="corp-reg-submissions-table-wrapper">
                <table className="corp-reg-table">
                  <thead>
                    <tr>
                      <th>{t("corporate_registration.patientName")}</th>
                      <th>{t("corporate_registration.email")}</th>
                      <th>{t("corporate_registration.phone")}</th>
                      <th><Tag size={12} /> {t("corporate_registration.coupon")}</th>
                      <th>{t("corporate_registration.date")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((s) => (
                      <tr key={s._id}>
                        <td>
                          {[s.lastName, s.firstName, s.middleName].filter(Boolean).join(" ")}
                        </td>
                        <td>
                          <div className="corp-reg-cell-icon">
                            <Mail size={12} />
                            {s.email}
                          </div>
                        </td>
                        <td>{s.phone || "—"}</td>
                        <td>
                          <span className="corp-reg-coupon">{s.couponCode}</span>
                        </td>
                        <td>{formatDate(s.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && createPortal(
        <div className="corp-reg-modal-overlay" onClick={closeModal}>
          <div className="corp-reg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="corp-reg-modal-header">
              <h2>
                {isEdit
                  ? t("corporate_registration.edit_registration")
                  : t("corporate_registration.new_registration_modal_title")}
              </h2>
              <button className="corp-reg-modal-close" onClick={closeModal}>×</button>
            </div>

            <form onSubmit={handleSubmit} className="corp-reg-form">
              <div className="corp-reg-field">
                <label>
                  <Link size={13} /> {t("corporate_registration.link_slug_label")} <span className="required">*</span>
                </label>
                <div className={`corp-reg-link-input-wrapper${isEdit ? " disabled" : ""}`}>
                  <span className="corp-reg-link-prefix">forms.sophos-med.ru/</span>
                  <input
                    name="link"
                    value={form.link}
                    onChange={handleChange}
                    placeholder={t("corporate_registration.link_slug_placeholder")}
                    required
                    pattern="[a-z0-9\-]+"
                    title={t("corporate_registration.link_slug_hint")}
                    readOnly={isEdit}
                    disabled={isEdit}
                  />
                </div>
                {isEdit && (
                  <span className="corp-reg-field-hint">
                    {t("corporate_registration.link_readonly_hint")}
                  </span>
                )}
              </div>

              <div className="corp-reg-field">
                <label>
                  <Building size={13} /> {t("corporate_registration.corporate_name_label")} <span className="required">*</span>
                </label>
                <input
                  name="corporateName"
                  value={form.corporateName}
                  onChange={handleChange}
                  placeholder={t("corporate_registration.corporate_name_placeholder")}
                  required
                />
              </div>

              <div className="corp-reg-field-group">
                <label>{t("corporate_registration.hr_name_label")} <span className="required">*</span></label>
                <div className="corp-reg-row corp-reg-row-3">
                  <input
                    name="hr.lastName"
                    value={form.hr.lastName}
                    onChange={handleChange}
                    placeholder={`${t("corporate_registration.last_name_placeholder")} *`}
                    required
                  />
                  <input
                    name="hr.firstName"
                    value={form.hr.firstName}
                    onChange={handleChange}
                    placeholder={`${t("corporate_registration.first_name_placeholder")} *`}
                    required
                  />
                  <input
                    name="hr.middleName"
                    value={form.hr.middleName}
                    onChange={handleChange}
                    placeholder={t("corporate_registration.middle_name_placeholder")}
                  />
                </div>
              </div>

              <div className="corp-reg-field">
                <label>
                  <Mail size={13} /> {t("corporate_registration.email_label")} <span className="required">*</span>
                </label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder={t("corporate_registration.email_placeholder")}
                  required
                />
              </div>

              <div className="corp-reg-field">
                <label>
                  <Phone size={13} /> {t("corporate_registration.phone_label")}
                </label>
                <PhoneInput
                  country={"ru"}
                  value={form.phone}
                  onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))}
                  inputProps={{ name: "phone" }}
                  containerClass="corp-reg-phone-container"
                  inputClass="corp-reg-phone-input"
                />
              </div>

              <div className="corp-reg-field">
                <label>
                  <Percent size={13} /> {t("corporate_registration.discount_label")}
                </label>
                <input
                  name="discountPercentage"
                  type="number"
                  min="0"
                  max="100"
                  value={form.discountPercentage}
                  onChange={handleChange}
                  placeholder="0"
                />
              </div>

              <div className="corp-reg-modal-actions">
                <button type="button" className="corp-reg-cancel-btn" onClick={closeModal}>
                  {t("corporate_registration.cancel")}
                </button>
                <button type="submit" className="corp-reg-submit-btn" disabled={submitting}>
                  {submitting
                    ? isEdit ? t("corporate_registration.saving") : t("corporate_registration.creating")
                    : isEdit ? t("corporate_registration.save_changes") : t("corporate_registration.create_send")}
                </button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

export default CorporateRegistration;
