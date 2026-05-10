import React, {
  useState,
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback,
  useEffect,
} from "react";
import {
  FiEdit2,
  FiChevronUp,
  FiChevronDown,
  FiUser,
  FiPhone,
  FiMail,
  FiMapPin,
  FiCalendar,
  FiFileText,
  FiPaperclip,
  FiCheck,
  FiPlus,
  FiX,
  FiTrash2,
} from "react-icons/fi";
import { MdOutlineCake, MdOutlinePerson } from "react-icons/md";
import { FaMale, FaFemale } from "react-icons/fa";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { useNavigate } from "react-router-dom";
import { patchPatient, getDoctorsLite, updateApplication } from "../../utils/api";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import CustomCalendar from "../../components/CustomCalendar/CustomCalendar";

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

const formatDOB = (dateStr) => {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

/* Collapsible Section wrapper */
const Section = ({ title, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="adp-section">
      <div className="adp-section-header" onClick={() => setOpen((p) => !p)}>
        <span className="adp-section-title">{title}</span>
        <div className="adp-section-header-right">
          <button
            className="adp-edit-btn"
            onClick={(e) => e.stopPropagation()}
            title="Edit"
          >
            <FiEdit2 size={14} />
          </button>
          <button className="adp-collapse-btn">
            {open ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
          </button>
        </div>
      </div>
      {open && <div className="adp-section-body">{children}</div>}
    </div>
  );
};

/* Field display helpers */
const Field = ({ label, value, children }) => (
  <div className="adp-field">
    <span className="adp-field-label">{label}</span>
    <span className="adp-field-value">{children || value || "—"}</span>
  </div>
);

/* Read-only gender pills (view mode) */
const GenderPills = ({ value }) => {
  const { t } = useTranslation("appointment_details_general");
  const genderOpts = [
    { key: "", label: t("common.not_specified") },
    { key: "Male", label: t("common.male") },
    { key: "Female", label: t("common.female") },
  ];
  return (
    <div className="adp-gender-pills">
      {genderOpts.map((g) => (
        <span
          key={g.key}
          className={`adp-gender-pill ${(!value && g.key === "") || value === g.key ? "active" : ""
            }`}
        >
          {g.label}
        </span>
      ))}
    </div>
  );
};

/* Clickable gender toggle (edit mode) */
const GenderPillsEdit = ({ value, onChange }) => {
  const { t } = useTranslation("appointment_details_general");
  const genderOpts = [
    { key: "", label: t("common.not_specified") },
    { key: "Male", label: t("common.male") },
    { key: "Female", label: t("common.female") },
  ];
  return (
    <div className="adp-gender-toggle">
      {genderOpts.map((g) => (
        <button
          key={g.key}
          type="button"
          className={`adp-gender-toggle-btn ${(!value && g.key === "") || value === g.key ? "active" : ""
            }`}
          onClick={() => onChange(g.key)}
        >
          {g.label}
        </button>
      ))}
    </div>
  );
};


const BasicDataSection = forwardRef(({ patient, application }, ref) => {
  const { t, i18n } = useTranslation("appointment_details_general");
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);

  const lang = i18n.language === "ru" ? "ru" : "en";
  const dob = patient?.dateOfBirth
    ? new Date(patient.dateOfBirth).toLocaleDateString(
      lang === "ru" ? "ru-RU" : "en-US",
      { month: "long", day: "numeric", year: "numeric" }
    )
    : null;
  const patientId = patient?._id?.toString().slice(-4) || "—";

  const patientFullName = patient
    ? [patient.firstName, patient.middleName, patient.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    patient.email ||
    t("common.unknown_patient")
    : application?.patientName || t("common.unknown_patient");

  const [form, setForm] = useState({
    lastName: patient?.lastName || "",
    firstName: patient?.firstName || "",
    middleName: patient?.middleName || "",
    dateOfBirth: patient?.dateOfBirth
      ? new Date(patient.dateOfBirth).toISOString().split("T")[0]
      : "",
    gender: patient?.gender || "",
    notes: patient?.notes || "",
  });

  // Sync form when patient prop is updated from parent (e.g. after save)
  useEffect(() => {
    if (!patient) return;
    setForm({
      lastName: patient.lastName || "",
      firstName: patient.firstName || "",
      middleName: patient.middleName || "",
      dateOfBirth: patient.dateOfBirth
        ? new Date(patient.dateOfBirth).toISOString().split("T")[0]
        : "",
      gender: patient.gender || "",
      notes: patient.notes || "",
    });
  }, [patient]);

  useImperativeHandle(ref, () => ({
    getData: () => ({ ...form }),
  }));

  return (
    <div className="adp-section">
      <div className="adp-section-header" onClick={() => setOpen((p) => !p)}>
        <span className="adp-section-title">{t("basic_data.title")}</span>
        <div className="adp-section-header-right">
          <button
            className="adp-edit-btn"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
              setEditing((p) => !p);
            }}
            title={t("basic_data.edit_title")}
          >
            <FiEdit2 size={14} />
          </button>
          <button
            className="adp-collapse-btn"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((p) => !p);
            }}
          >
            {open ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="adp-section-body">
          {editing ? (
            <div className="adp-basic-edit">
              <div className="adp-avatar-col">
                <div className="adp-avatar-circle">
                  <FiUser size={28} />
                </div>
                <button className="adp-change-photo-btn">{t("basic_data.change_photo")}</button>
              </div>

              <div className="adp-basic-edit-fields">
                {/* Name row: LAST NAME | FIRST NAME | MIDDLE NAME */}
                <div className="adp-name-inputs-row">
                  <div className="adp-labeled-input adp-labeled-input--wide">
                    <span className="adp-input-label">{t("common.last_name")}</span>
                    <input
                      className="adp-text-input"
                      placeholder={t("common.last_name_placeholder")}
                      value={form.lastName}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, lastName: e.target.value }))
                      }
                    />
                  </div>
                  <div className="adp-labeled-input adp-labeled-input--wide">
                    <span className="adp-input-label">{t("common.first_name")}</span>
                    <input
                      className="adp-text-input"
                      placeholder={t("common.first_name_placeholder")}
                      value={form.firstName}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, firstName: e.target.value }))
                      }
                    />
                  </div>
                  <div className="adp-labeled-input adp-labeled-input--wide">
                    <span className="adp-input-label">{t("common.middle_name")}</span>
                    <input
                      className="adp-text-input"
                      placeholder={t("common.middle_name_placeholder")}
                      value={form.middleName}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, middleName: e.target.value }))
                      }
                    />
                  </div>
                </div>

                {/* DOB + Gender row */}
                <div className="adp-dob-gender-row">
                  <div className="adp-labeled-input">
                    <span className="adp-input-label">{t("common.date_of_birth")}</span>
                    <CustomCalendar
                      className="adp-dob-input"
                      value={form.dateOfBirth}
                      onChange={(date) =>
                        setForm((f) => ({ ...f, dateOfBirth: date ? date.toISOString().split('T')[0] : '' }))
                      }
                    />
                  </div>
                  <div className="adp-labeled-input">
                    <span className="adp-input-label">{t("common.gender")}</span>
                    <GenderPillsEdit
                      value={form.gender}
                      onChange={(v) => setForm((f) => ({ ...f, gender: v }))}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="adp-labeled-input">
                  <span className="adp-input-label">{t("basic_data.note_label")}</span>
                  <textarea
                    className="adp-textarea adp-textarea--full"
                    rows={4}
                    placeholder={t("basic_data.note_placeholder")}
                    value={form.notes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, notes: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="adp-patient-card">
              <div className="adp-avatar-col">
                <div className="adp-avatar-circle">
                  <FiUser size={28} />
                </div>
              </div>
              <div className="adp-patient-info-col">
                <h2 className="adp-patient-fullname">{patientFullName}</h2>
                <div className="adp-patient-meta-row">
                  {dob && (
                    <span className="adp-meta-item">
                      <FiCalendar size={14} />
                      {dob}
                    </span>
                  )}
                  {patient?.gender && (
                    <span className="adp-meta-item">
                      <FiUser size={14} />
                      {patient.gender === "Male" ? t("common.male") : patient.gender === "Female" ? t("common.female") : patient.gender}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

const StatusBadge = ({ status }) => (
  <span
    className={`adp-status-badge status-${status
      ?.toLowerCase()
      .replace(/\s/g, "-")}`}
  >
    {status || "—"}
  </span>
);

/* ContactsSection: view + edit modes */
const SOCIAL_ICONS = {
  instagram: {
    bg: "adp-social-instagram",
    svg: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  },
  vk: {
    bg: "adp-social-vk",
    svg: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
        <path d="M15.07 2H8.93C3.33 2 2 3.33 2 8.93v6.14C2 20.67 3.33 22 8.93 22h6.14C20.67 22 22 20.67 22 15.07V8.93C22 3.33 20.67 2 15.07 2zm3.08 13.5h-1.6c-.61 0-.79-.48-1.88-1.57-1-.92-1.42-.5-1.42.5v1.07c0 .29-.12.5-.9.5-1.29 0-2.73-.78-3.73-2.23C7.09 11.85 6.5 9.92 6.5 9.67c0-.17.06-.33.37-.33h1.6c.29 0 .39.12.5.42.55 1.58 1.46 2.96 1.83 2.96.14 0 .2-.06.2-.41V10.2c-.04-.77-.42-.84-.42-1.11 0-.14.12-.29.31-.29h2.5c.25 0 .33.13.33.41v2.9c0 .25.11.33.18.33.14 0 .25-.08.52-.35 1.04-1.17 1.79-2.96 1.79-2.96.1-.2.25-.39.54-.39h1.6c.48 0 .58.25.48.58-.2.92-2.04 3.49-2.04 3.49-.17.27-.23.39 0 .69.16.22.7.69 1.05 1.11.65.75 1.15 1.38 1.29 1.81.1.37-.09.56-.42.56z" />
      </svg>
    ),
  },
  facebook: {
    bg: "adp-social-fb",
    svg: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  ok: {
    bg: "adp-social-ok",
    svg: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 6c1.65 0 3 1.35 3 3s-1.35 3-3 3-3-1.35-3-3 1.35-3 3-3zm5 10.5c-.75.75-1.8 1.2-3 1.35l2.55 2.55c.3.3.3.75 0 1.05l-.45.45c-.3.3-.75.3-1.05 0L12 18.9l-3.05 3.05c-.3.3-.75.3-1.05 0l-.45-.45c-.3-.3-.3-.75 0-1.05L10 18c-1.2-.15-2.25-.6-3-1.35-.45-.45-.45-1.2 0-1.65.45-.45 1.2-.45 1.65 0C9.45 15.75 10.65 16.2 12 16.2s2.55-.45 3.35-1.2c.45-.45 1.2-.45 1.65 0 .45.45.45 1.2 0 1.5z" />
      </svg>
    ),
  },
};

const ContactsSection = forwardRef(({ patient }, ref) => {
  const { t } = useTranslation("appointment_details_general");
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);

  const [form, setForm] = useState({
    telephone: patient?.telephone || "",
    additionalPhone: patient?.additionalPhone || "",
    maxId: patient?.maxId || "",
    telegramNickname: patient?.telegramNickname || "",
    telegramId: patient?.telegramId || "",
    email: patient?.email || "",
    newsletter: patient?.newsletter || false,
    egisz: patient?.egisz || false,
    instagram: patient?.instagram || "",
    vk: patient?.vk || "",
    facebook: patient?.facebook || "",
    ok: patient?.ok || "",
    contactPerson: patient?.contactPerson || "",
    contactPersonPhone: patient?.contactPersonPhone || "",
  });

  useImperativeHandle(ref, () => ({
    getData: () => ({ ...form }),
  }));

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setCheck = (key) => () => setForm((f) => ({ ...f, [key]: !f[key] }));

  /* View-mode row helper */
  const ViewRow = ({ label, value, help }) =>
    value ? (
      <div className="adp-contact-form-row">
        <span className="adp-contact-form-label">
          {label}
          {help && (
            <span className="adp-help-icon" title={help}>
              ?
            </span>
          )}
        </span>
        <span className="adp-contact-view-value">{value}</span>
      </div>
    ) : null;

  return (
    <div className="adp-section">
      {/* Header */}
      <div className="adp-section-header" onClick={() => setOpen((p) => !p)}>
        <span className="adp-section-title">{t("contacts.title")}</span>
        <div className="adp-section-header-right">
          <button
            className="adp-edit-btn"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
              setEditing((p) => !p);
            }}
            title={t("contacts.edit_title")}
          >
            <FiEdit2 size={14} />
          </button>
          <button
            className="adp-collapse-btn"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((p) => !p);
            }}
          >
            {open ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="adp-section-body">
          {editing ? (
            <div className="adp-contacts-form">
              <div className="adp-contact-form-row">
                <span className="adp-contact-form-label">{t("contacts.telephone")}</span>
                <PhoneInput
                  country="ru"
                  value={form.telephone}
                  onChange={(v) =>
                    setForm((f) => ({ ...f, telephone: v || "" }))
                  }
                  inputClass="adp-phone-input-field"
                  containerClass="adp-phone-input-container"
                  placeholder={t("contacts.telephone_placeholder")}
                />
              </div>
              <div className="adp-contact-form-row">
                <span className="adp-contact-form-label">
                  {t("contacts.additional_phone")}
                </span>
                <PhoneInput
                  country="ru"
                  value={form.additionalPhone}
                  onChange={(v) =>
                    setForm((f) => ({ ...f, additionalPhone: v || "" }))
                  }
                  inputClass="adp-phone-input-field"
                  containerClass="adp-phone-input-container"
                  placeholder={t("contacts.additional_phone_placeholder")}
                />
              </div>
              <div className="adp-contact-form-row">
                <span className="adp-contact-form-label">
                  {t("contacts.max")}{" "}
                  <span className="adp-help-icon" title={t("contacts.max_help")}>
                    ?
                  </span>
                </span>
                <input
                  className="adp-text-input adp-contact-input"
                  value={form.maxId}
                  onChange={set("maxId")}
                  placeholder={t("contacts.max_placeholder")}
                />
              </div>
              <div className="adp-contact-form-row">
                <span className="adp-contact-form-label">
                  {t("contacts.telegram_nickname")}
                </span>
                <div className="adp-contact-input-pair">
                  <input
                    className="adp-text-input"
                    value={form.telegramNickname}
                    onChange={set("telegramNickname")}
                    placeholder={t("contacts.telegram_nickname_placeholder")}
                  />
                  <input
                    className="adp-text-input"
                    value={form.telegramId}
                    onChange={set("telegramId")}
                    placeholder={t("contacts.telegram_id_placeholder")}
                  />
                </div>
              </div>
              <div className="adp-contact-form-row">
                <span className="adp-contact-form-label">{t("contacts.email")}</span>
                <input
                  className="adp-text-input adp-contact-input"
                  value={form.email}
                  onChange={set("email")}
                  placeholder={t("contacts.email_placeholder")}
                />
              </div>
              <div className="adp-contact-form-row adp-contact-checkboxes-row">
                <span className="adp-contact-form-label" />
                <div className="adp-contact-checkboxes">
                  <label
                    className="adp-newsletter-label"
                    onClick={setCheck("newsletter")}
                  >
                    <span
                      className={`adp-checkbox ${form.newsletter ? "checked" : ""}`}
                    >
                      {form.newsletter && <FiCheck size={11} />}
                    </span>
                    {t("contacts.newsletter_agree")}
                  </label>
                  <label
                    className="adp-newsletter-label"
                    onClick={setCheck("egisz")}
                  >
                    <span
                      className={`adp-checkbox ${form.egisz ? "checked" : ""}`}
                    >
                      {form.egisz && <FiCheck size={11} />}
                    </span>
                    {t("contacts.egisz_agree")}
                  </label>
                </div>
              </div>
              <div className="adp-contact-form-row adp-contact-form-row-top">
                <span className="adp-contact-form-label">{t("contacts.social_networks")}</span>
                <div className="adp-social-grid">
                  {Object.entries(SOCIAL_ICONS).map(([key, { bg, svg }]) => (
                    <div className="adp-social-item" key={key}>
                      <span className={`adp-social-icon ${bg}`}>{svg}</span>
                      <input
                        className="adp-text-input adp-social-input"
                        value={form[key]}
                        onChange={set(key)}
                        placeholder={t("contacts.social_add_link_placeholder")}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="adp-contact-form-row">
                <span className="adp-contact-form-label">
                  {t("contacts.contact_person")}{" "}
                  <span className="adp-help-icon" title={t("contacts.emergency_contact_help")}>
                    ?
                  </span>
                </span>
                <div className="adp-contact-input-pair">
                  <input
                    className="adp-text-input"
                    value={form.contactPerson}
                    onChange={set("contactPerson")}
                    placeholder={t("contacts.contact_person_placeholder")}
                  />
                  <PhoneInput
                    country="ru"
                    value={form.contactPersonPhone}
                    onChange={(v) =>
                      setForm((f) => ({ ...f, contactPersonPhone: v || "" }))
                    }
                    inputClass="adp-phone-input-field"
                    containerClass="adp-phone-input-container"
                    placeholder={t("contacts.contact_person_phone_placeholder")}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="adp-contacts-form">
              <ViewRow label={t("contacts.telephone")} value={form.telephone} />
              <ViewRow label={t("contacts.additional_phone_view")} value={form.additionalPhone} />
              <ViewRow label={t("contacts.max")} value={form.maxId} help={t("contacts.max_help")} />
              {(form.telegramNickname || form.telegramId) && (
                <div className="adp-contact-form-row">
                  <span className="adp-contact-form-label">{t("contacts.telegram_view")}</span>
                  <span className="adp-contact-view-value">
                    {[form.telegramNickname, form.telegramId]
                      .filter(Boolean)
                      .join(" / ")}
                  </span>
                </div>
              )}
              <ViewRow label={t("contacts.email")} value={form.email} />
              {(form.newsletter || form.egisz) && (
                <div className="adp-contact-form-row adp-contact-checkboxes-row">
                  <span className="adp-contact-form-label" />
                  <div className="adp-contact-checkboxes">
                    {form.newsletter && (
                      <label className="adp-newsletter-label">
                        <span className="adp-checkbox checked">
                          <FiCheck size={11} />
                        </span>
                        {t("contacts.newsletter_agree")}
                      </label>
                    )}
                    {form.egisz && (
                      <label className="adp-newsletter-label">
                        <span className="adp-checkbox checked">
                          <FiCheck size={11} />
                        </span>
                        {t("contacts.egisz_short")}
                      </label>
                    )}
                  </div>
                </div>
              )}
              {Object.entries(SOCIAL_ICONS).some(([key]) => form[key]) && (
                <div className="adp-contact-form-row adp-contact-form-row-top">
                  <span className="adp-contact-form-label">
                    {t("contacts.social_networks")}
                  </span>
                  <div className="adp-social-grid">
                    {Object.entries(SOCIAL_ICONS)
                      .filter(([key]) => form[key])
                      .map(([key, { bg, svg }]) => (
                        <div className="adp-social-item" key={key}>
                          <span className={`adp-social-icon ${bg}`}>{svg}</span>
                          <a
                            href={form[key]}
                            className="adp-contact-view-value adp-social-link"
                            target="_blank"
                            rel="noreferrer"
                          >
                            {form[key]}
                          </a>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              <ViewRow
                label={t("contacts.contact_person")}
                value={
                  form.contactPerson
                    ? `${form.contactPerson}${form.contactPersonPhone ? " Â· " + form.contactPersonPhone : ""}`
                    : ""
                }
                help={t("contacts.emergency_contact_help")}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
});

const CITIZENSHIP_OPTIONS = ["Russian Federation", "Other"];
const DOCUMENT_TYPE_OPTIONS = [
  "Passport of a citizen of the Russian Federation",
  "Foreign passport",
  "Birth certificate",
  "Other",
];

const DocumentsSection = forwardRef(({ patient }, ref) => {
  const { t } = useTranslation("appointment_details_general");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const initForm = () => ({
    cmip: patient?.cmip || "",
    cmipDate: patient?.cmipDate ? patient.cmipDate.slice(0, 10) : "",
    cmipOrgCode: patient?.cmipOrgCode || "",
    snils: patient?.snils || "",
    medInsuranceOrg: patient?.medInsuranceOrg || "",
    socialSupportCode: patient?.socialSupportCode || "",
    citizenship: patient?.citizenship || "",
    documentType: patient?.documentType || "",
    documentSeries: patient?.documentSeries || "",
    documentNumber: patient?.documentNumber || "",
    documentIssuedDate: patient?.documentIssuedDate
      ? patient.documentIssuedDate.slice(0, 10)
      : "",
    departmentCode: patient?.departmentCode || "",
    documentIssuedBy: patient?.documentIssuedBy || "",
    inn: patient?.inn || "",
  });

  const [form, setForm] = useState(initForm);

  useImperativeHandle(ref, () => ({
    getData: () => ({ ...form }),
  }));

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  /* View helpers */
  const VField = ({ label, value }) =>
    value ? (
      <div className="adp-field">
        <span className="adp-field-label">{label}</span>
        <span className="adp-field-value">{value}</span>
      </div>
    ) : null;

  const hasData = Object.values(form).some(Boolean);

  return (
    <div className="adp-section">
      {/* Header */}
      <div className="adp-section-header" onClick={() => setOpen((p) => !p)}>
        <span className="adp-section-title">{t("documents.title")}</span>
        <div className="adp-section-header-right">
          <button
            className="adp-edit-btn"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
              setEditing((p) => !p);
            }}
            title={t("common.edit")}
          >
            <FiEdit2 size={14} />
          </button>
          <button
            className="adp-collapse-btn"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((p) => !p);
            }}
          >
            {open ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="adp-section-body">
          {editing ? (
            /* Edit mode */
            <div className="adp-doc-form">
              {/* â–¸ COMPULSORY MEDICAL INSURANCE POLICY */}
              <div className="adp-doc-subsection-label">
                {t("documents.cmip_subsection")}
              </div>

              {/* Row: Policy | Date of issue */}
              <div className="adp-doc-row adp-doc-row--3-1">
                <div className="adp-labeled-input adp-labeled-input--wide">
                  <span className="adp-input-label">
                    {t("documents.cmip_label")}
                  </span>
                  <input
                    className="adp-text-input"
                    placeholder={t("documents.cmip_placeholder")}
                    value={form.cmip}
                    onChange={set("cmip")}
                  />
                </div>
                <div className="adp-labeled-input">
                  <span className="adp-input-label">{t("documents.date_of_issue")}</span>
                  <CustomCalendar
                    value={form.cmipDate}
                    onChange={(date) =>
                      setForm((f) => ({ ...f, cmipDate: date ? date.toISOString().split('T')[0] : '' }))
                    }
                  />
                </div>
              </div>

              {/* Row: Code of org | SNILS */}
              <div className="adp-doc-row adp-doc-row--3-1">
                <div className="adp-labeled-input adp-labeled-input--wide">
                  <span className="adp-input-label">
                    {t("documents.org_code")}
                  </span>
                  <input
                    className="adp-text-input"
                    placeholder={t("documents.org_code_placeholder")}
                    value={form.cmipOrgCode}
                    onChange={set("cmipOrgCode")}
                  />
                </div>
                <div className="adp-labeled-input">
                  <span className="adp-input-label">{t("common.snils")}</span>
                  <input
                    className="adp-text-input"
                    placeholder={t("common.snils_placeholder")}
                    value={form.snils}
                    onChange={set("snils")}
                  />
                </div>
              </div>

              {/* Medical insurance org */}
              <div className="adp-labeled-input">
                <span className="adp-input-label">
                  {t("documents.med_insurance_org")}
                </span>
                <input
                  className="adp-text-input"
                  placeholder={t("documents.med_insurance_org_placeholder")}
                  value={form.medInsuranceOrg}
                  onChange={set("medInsuranceOrg")}
                />
              </div>

              {/* Social support code */}
              <div className="adp-labeled-input">
                <span className="adp-input-label">
                  {t("documents.social_support_code")}
                </span>
                <input
                  className="adp-text-input"
                  placeholder={t("documents.social_support_code_placeholder")}
                  value={form.socialSupportCode}
                  onChange={set("socialSupportCode")}
                />
              </div>

              {/* Identity card */}
              <div
                className="adp-doc-subsection-label"
                style={{ marginTop: 8 }}
              >
                {t("common.identity_card")}
              </div>

              {/* Citizenship select */}
              <div className="adp-labeled-input">
                <span className="adp-input-label">{t("documents.citizenship")}</span>
                <select
                  className="adp-text-input adp-select"
                  value={form.citizenship}
                  onChange={set("citizenship")}
                >
                  <option value="">{t("common.select_default")}</option>
                  {CITIZENSHIP_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>

              {/* Document type select */}
              <div className="adp-labeled-input">
                <span className="adp-input-label">{t("documents.doc_type")}</span>
                <select
                  className="adp-text-input adp-select"
                  value={form.documentType}
                  onChange={set("documentType")}
                >
                  <option value="">{t("common.select_default")}</option>
                  {DOCUMENT_TYPE_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>

              {/* Series | Number */}
              <div className="adp-doc-row adp-doc-row--half">
                <div className="adp-labeled-input adp-labeled-input--wide">
                  <span className="adp-input-label">{t("documents.series")}</span>
                  <input
                    className="adp-text-input"
                    placeholder={t("documents.series_placeholder")}
                    value={form.documentSeries}
                    onChange={set("documentSeries")}
                  />
                </div>
                <div className="adp-labeled-input adp-labeled-input--wide">
                  <span className="adp-input-label">{t("documents.number")}</span>
                  <input
                    className="adp-text-input"
                    placeholder={t("documents.number_placeholder")}
                    value={form.documentNumber}
                    onChange={set("documentNumber")}
                  />
                </div>
              </div>

              {/* When issued | Department code */}
              <div className="adp-doc-row adp-doc-row--half">
                <div className="adp-labeled-input adp-labeled-input--wide">
                  <span className="adp-input-label">{t("documents.when_issued")}</span>
                  <CustomCalendar
                    value={form.documentIssuedDate}
                    onChange={(date) =>
                      setForm((f) => ({ ...f, documentIssuedDate: date ? date.toISOString().split('T')[0] : '' }))
                    }
                  />
                </div>
                <div className="adp-labeled-input adp-labeled-input--wide">
                  <span className="adp-input-label">{t("documents.department_code")}</span>
                  <input
                    className="adp-text-input"
                    placeholder={t("documents.department_code_placeholder")}
                    value={form.departmentCode}
                    onChange={set("departmentCode")}
                  />
                </div>
              </div>

              {/* Issued by textarea */}
              <div className="adp-labeled-input">
                <span className="adp-input-label">{t("documents.issued_by")}</span>
                <textarea
                  className="adp-textarea adp-textarea--full"
                  rows={3}
                  placeholder={t("documents.issued_by_placeholder")}
                  value={form.documentIssuedBy}
                  onChange={set("documentIssuedBy")}
                />
              </div>

              {/* INN */}
              <div className="adp-labeled-input">
                <span className="adp-input-label">
                  {t("documents.inn_label")}
                </span>
                <input
                  className="adp-text-input"
                  placeholder={t("documents.inn_placeholder")}
                  value={form.inn}
                  onChange={set("inn")}
                />
              </div>
            </div>
          ) : (
            /* View mode */
            <div>
              {hasData ? (
                <>
                  <div className="adp-doc-subsection-label">
                    {t("documents.cmip_subsection")}
                  </div>
                  <div className="adp-info-grid">
                    <VField label={t("documents.cmip_view")} value={form.cmip} />
                    <VField
                      label={t("documents.date_of_issue")}
                      value={form.cmipDate ? formatDate(form.cmipDate) : ""}
                    />
                    <VField
                      label={t("documents.org_code_view")}
                      value={form.cmipOrgCode}
                    />
                    <VField label={t("common.snils")} value={form.snils} />
                    <VField
                      label={t("documents.med_insurance_org")}
                      value={form.medInsuranceOrg}
                    />
                    <VField
                      label={t("documents.social_support_code")}
                      value={form.socialSupportCode}
                    />
                  </div>
                  <div
                    className="adp-doc-subsection-label"
                    style={{ marginTop: 16 }}
                  >
                    {t("common.identity_card")}
                  </div>
                  <div className="adp-info-grid">
                    <VField label={t("documents.citizenship")} value={form.citizenship} />
                    <VField label={t("documents.doc_type")} value={form.documentType} />
                    <VField label={t("documents.series")} value={form.documentSeries} />
                    <VField label={t("documents.number")} value={form.documentNumber} />
                    <VField
                      label={t("documents.when_issued")}
                      value={
                        form.documentIssuedDate
                          ? formatDate(form.documentIssuedDate)
                          : ""
                      }
                    />
                    <VField
                      label={t("documents.department_code")}
                      value={form.departmentCode}
                    />
                    <VField label={t("documents.issued_by")} value={form.documentIssuedBy} />
                    <VField label={t("documents.inn_view")} value={form.inn} />
                  </div>
                </>
              ) : (
                <p className="adp-empty-msg">
                  {t("documents.empty_message")}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

/* AddressSection: view + edit modes */
const AddressSection = forwardRef(({ patient }, ref) => {
  const { t } = useTranslation("appointment_details_general");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const initForm = () => ({
    region: patient?.region || "",
    district: patient?.district || "",
    city: patient?.city || "",
    street: patient?.street || "",
    house: patient?.house || "",
    terrain: patient?.terrain || "",
    apartment: patient?.apartment || "",
    index: patient?.postcode || "",
    geocoordinates: patient?.geocoordinates || "",
    registrationChange: patient?.registrationChange || "",
  });

  const [form, setForm] = useState(initForm);

  useImperativeHandle(ref, () => ({
    getData: () => {
      const d = { ...form };
      d.postcode = d.index;
      delete d.index;
      return d;
    },
  }));

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const hasData = Object.values(form).some(Boolean);

  /* Shared icon-prefixed input wrapper */
  const IconInput = ({ icon, ...props }) => (
    <div className="adp-addr-icon-input">
      <span className="adp-addr-icon">{icon}</span>
      <input className="adp-text-input adp-addr-inner" {...props} />
    </div>
  );

  const VField = ({ label, value }) =>
    value ? (
      <div className="adp-field">
        <span className="adp-field-label">{label}</span>
        <span className="adp-field-value">{value}</span>
      </div>
    ) : null;

  return (
    <div className="adp-section">
      <div className="adp-section-header" onClick={() => setOpen((p) => !p)}>
        <span className="adp-section-title">{t("address.title")}</span>
        <div className="adp-section-header-right">
          <button
            className="adp-edit-btn"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
              setEditing((p) => !p);
            }}
            title={t("address.edit_title")}
          >
            <FiEdit2 size={14} />
          </button>
          <button
            className="adp-collapse-btn"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((p) => !p);
            }}
          >
            {open ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="adp-section-body">
          {editing ? (
            /* Edit mode */
            <div className="adp-addr-form">
              {/* 01 REGIONAL LOCATION */}
              <div className="adp-addr-group">
                <div className="adp-addr-group-title">
                  <span className="adp-addr-num">01</span> {t("address.group_01")}
                </div>

                {/* Region | District */}
                <div className="adp-doc-row--half">
                  <div className="adp-labeled-input adp-labeled-input--wide">
                    <span className="adp-input-label">
                      {t("address.region")}
                    </span>
                    <IconInput
                      icon={<FiMapPin size={14} />}
                      placeholder={t("address.region_placeholder")}
                      value={form.region}
                      onChange={set("region")}
                    />
                  </div>
                  <div className="adp-labeled-input adp-labeled-input--wide">
                    <span className="adp-input-label">{t("address.district")}</span>
                    <input
                      className="adp-text-input"
                      placeholder={t("address.district_placeholder")}
                      value={form.district}
                      onChange={set("district")}
                    />
                  </div>
                </div>

                {/* City */}
                <div className="adp-labeled-input adp-labeled-input--wide">
                  <span className="adp-input-label">{t("address.city")}</span>
                  <input
                    className="adp-text-input"
                    placeholder={t("address.city_placeholder")}
                    value={form.city}
                    onChange={set("city")}
                  />
                </div>
              </div>

              {/* 02 STREET ADDRESS */}
              <div className="adp-addr-group">
                <div className="adp-addr-group-title">
                  <span className="adp-addr-num">02</span> {t("address.group_02")}
                </div>

                {/* Street | House */}
                <div className="adp-doc-row--3-1">
                  <div className="adp-labeled-input adp-labeled-input--wide">
                    <span className="adp-input-label">{t("address.street")}</span>
                    <input
                      className="adp-text-input"
                      placeholder={t("address.street_placeholder")}
                      value={form.street}
                      onChange={set("street")}
                    />
                  </div>
                  <div className="adp-labeled-input">
                    <span className="adp-input-label">{t("address.house_number")}</span>
                    <input
                      className="adp-text-input"
                      placeholder={t("address.house_number_placeholder")}
                      value={form.house}
                      onChange={set("house")}
                    />
                  </div>
                </div>

                {/* Terrain | Apartment */}
                <div className="adp-doc-row--3-1">
                  <div className="adp-labeled-input">
                    <span className="adp-input-label">{t("address.terrain_type")}</span>
                    <select
                      className="adp-text-input adp-select"
                      value={form.terrain}
                      onChange={set("terrain")}
                    >
                      <option value="">{t("address.terrain_all")}</option>
                      <option value="urban">{t("address.terrain_urban")}</option>
                      <option value="rural">{t("address.terrain_rural")}</option>
                    </select>
                  </div>
                  <div className="adp-labeled-input adp-labeled-input--wide">
                    <span className="adp-input-label">{t("address.apartment_unit")}</span>
                    <input
                      className="adp-text-input"
                      placeholder={t("address.apartment_placeholder")}
                      value={form.apartment}
                      onChange={set("apartment")}
                    />
                  </div>
                </div>

                {/* Index / Postcode */}
                <div className="adp-labeled-input adp-labeled-input--wide">
                  <span className="adp-input-label">{t("address.index")}</span>
                  <IconInput
                    icon={<FiFileText size={14} />}
                    placeholder={t("address.index_placeholder")}
                    value={form.index}
                    onChange={set("index")}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* â”€â”€ VIEW MODE â”€â”€ */
            <div>
              {hasData ? (
                <>
                  <div className="adp-addr-view-group">
                    <div className="adp-addr-group-title">
                      <span className="adp-addr-num">01</span> {t("address.group_01")}
                    </div>
                    <div className="adp-info-grid">
                      <VField label={t("address.region_view")} value={form.region} />
                      <VField label={t("address.district_view")} value={form.district} />
                      <VField label={t("address.city_view")} value={form.city} />
                    </div>
                  </div>
                  <div className="adp-addr-view-group">
                    <div className="adp-addr-group-title">
                      <span className="adp-addr-num">02</span> {t("address.group_02")}
                    </div>
                    <div className="adp-info-grid">
                      <VField label={t("address.street_view")} value={form.street} />
                      <VField label={t("address.house_view")} value={form.house} />
                      <VField label={t("address.terrain_view")} value={form.terrain} />
                      <VField label={t("address.apartment_view")} value={form.apartment} />
                      <VField label={t("address.index_view")} value={form.index} />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <p className="adp-empty-msg">
                    {t("address.empty_message")}
                  </p>
                  <button
                    className="adp-add-link"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing(true);
                    }}
                  >
                    <FiPlus size={13} /> {t("common.add")}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

/* ── DoctorAutocomplete: combobox with doctor list + free text ── */
const getDoctorDisplayName = (doctor, language) => {
  const lang = language?.startsWith("ru") ? "ru" : "en";
  return doctor.name?.[lang] || doctor.name?.en || doctor.name?.ru || doctor.email || "";
};

const DoctorAutocomplete = ({ value, onChange, onDoctorSelect, doctors, language, placeholder, className }) => {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef(null);

  const filtered = React.useMemo(() => {
    if (!doctors?.length) return [];
    if (!value?.trim()) return doctors.slice(0, 15);
    const q = value.toLowerCase();
    return doctors
      .filter((d) => getDoctorDisplayName(d, language).toLowerCase().includes(q))
      .slice(0, 15);
  }, [doctors, value, language]);

  const handleSelect = (doctor) => {
    onChange(getDoctorDisplayName(doctor, language));
    onDoctorSelect?.(doctor);
    setOpen(false);
  };

  const calcPos = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom, left: rect.left, width: Math.max(rect.width, 220) });
    }
  };

  const openDropdown = () => { calcPos(); setOpen(true); };

  useEffect(() => {
    const close = (e) => {
      if (inputRef.current && !inputRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", calcPos, true);
    window.addEventListener("resize", calcPos);
    return () => {
      window.removeEventListener("scroll", calcPos, true);
      window.removeEventListener("resize", calcPos);
    };
  }, [open]);

  return (
    <div className="adp-autocomplete-wrap">
      <input
        ref={inputRef}
        className={className || "adp-text-input adp-diag-input"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); openDropdown(); }}
        onFocus={openDropdown}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul
          className="adp-autocomplete-dropdown"
          style={{ position: "fixed", top: dropPos.top + 4, left: dropPos.left, minWidth: dropPos.width, maxWidth: 340 }}
        >
          {filtered.map((d) => (
            <li
              key={d._id}
              className="adp-autocomplete-item"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(d); }}
            >
              {getDoctorDisplayName(d, language)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* ── SpecialityAutocomplete: combobox with specialty options + free text ── */
const SpecialityAutocomplete = ({ value, onChange, options, placeholder, className }) => {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef(null);

  const filtered = React.useMemo(() => {
    if (!options?.length) return [];
    if (!value?.trim()) return options;
    const q = value.toLowerCase();
    return options.filter((opt) => opt.toLowerCase().includes(q));
  }, [options, value]);

  const calcPos = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom, left: rect.left, width: Math.max(rect.width, 180) });
    }
  };

  const openDropdown = () => { calcPos(); setOpen(true); };

  useEffect(() => {
    const close = (e) => {
      if (inputRef.current && !inputRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", calcPos, true);
    window.addEventListener("resize", calcPos);
    return () => {
      window.removeEventListener("scroll", calcPos, true);
      window.removeEventListener("resize", calcPos);
    };
  }, [open]);

  return (
    <div className="adp-autocomplete-wrap">
      <input
        ref={inputRef}
        className={className || "adp-text-input adp-diag-input"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); if (options?.length) openDropdown(); }}
        onFocus={() => { if (options?.length) openDropdown(); }}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul
          className="adp-autocomplete-dropdown"
          style={{ position: "fixed", top: dropPos.top + 4, left: dropPos.left, minWidth: dropPos.width, maxWidth: 340 }}
        >
          {filtered.map((opt, i) => (
            <li
              key={i}
              className="adp-autocomplete-item"
              onMouseDown={(e) => { e.preventDefault(); onChange(opt); setOpen(false); }}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* DiseasesSection: view + edit modes*/
const DiseasesSection = forwardRef(({ patient }, ref) => {
  const { t, i18n } = useTranslation("appointment_details_general");
  const mapDisease = (d) => ({
    id: d._id || Date.now() + Math.random(),
    startDate: d.startDate ? new Date(d.startDate).toISOString().split("T")[0] : "",
    endDate: d.endDate ? new Date(d.endDate).toISOString().split("T")[0] : "",
    diagnosis: d.diagnosis || "",
    icdCode: d.icdCode || "",
    doctor: d.doctor || "",
    confirmed: true,
  });

  const initRows = patient?.diseases?.length
    ? patient.diseases.map(mapDisease)
    : [];

  const [open, setOpen] = useState(false);
  const [editingRowIds, setEditingRowIds] = useState(new Set());
  const [rows, setRows] = useState(initRows);
  const [doctors, setDoctors] = useState([]);

  const startEditRow = (id) => {
    setOpen(true);
    setEditingRowIds((prev) => new Set([...prev, id]));
  };

  useEffect(() => {
    getDoctorsLite().then((data) => setDoctors(Array.isArray(data) ? data : [])).catch(() => { });
  }, []);

  useEffect(() => {
    if (patient?.diseases?.length) {
      setRows(patient.diseases.map(mapDisease));
    }
  }, [patient?.diseases]);

  const emptyRow = () => ({
    id: Date.now(),
    startDate: "",
    endDate: "",
    diagnosis: "",
    icdCode: "",
    doctor: "",
    confirmed: false,
  });

  const addRow = () => {
    const newRow = emptyRow();
    setRows((prev) => [...prev, newRow]);
    setOpen(true);
    setEditingRowIds((prev) => new Set([...prev, newRow.id]));
  };

  const updateRow = (id, key, val) =>
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [key]: val } : r)),
    );

  const deleteRow = (id) => setRows((prev) => prev.filter((r) => r.id !== id));

  useImperativeHandle(ref, () => ({
    getData: () => rows.map(({ id, confirmed, ...rest }) => rest),
  }));

  return (
    <div className="adp-section">
      <div className="adp-section-header" onClick={() => setOpen((p) => !p)}>
        <span className="adp-section-title">
          {t("diseases.title")}
        </span>
        <div className="adp-section-header-right">
          <button
            className="adp-edit-btn"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
              if (editingRowIds.size > 0) {
                setEditingRowIds(new Set());
              } else {
                setEditingRowIds(new Set(rows.map((r) => r.id)));
              }
            }}
          >
            <FiEdit2 size={14} />
          </button>
          <button
            className="adp-collapse-btn"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((p) => !p);
            }}
          >
            {open ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="adp-section-body">
          {rows.length === 0 && editingRowIds.size === 0 && (
            <p className="adp-empty-msg">
              {t("diseases.empty_message")}
            </p>
          )}

          {/* Column header strip */}
          {rows.length > 0 && (
            <div className="adp-diag-header-row adp-diag-row--diseases">
              <span className="adp-input-label">{t("diseases.col_start")}</span>
              <span className="adp-input-label">{t("diseases.col_end")}</span>
              <span className="adp-input-label">{t("diseases.col_diagnosis")}</span>
              <span className="adp-input-label">{t("diseases.col_icd_code")}</span>
              <span className="adp-input-label">{t("diseases.col_doctor")}</span>
              <span />
            </div>
          )}

          {rows.map((row) => (
            <div key={row.id} className="adp-diag-row adp-diag-row--diseases">
              {editingRowIds.has(row.id) ? (
                <>
                  <CustomCalendar
                    className="adp-diag-input"
                    value={row.startDate}
                    onChange={(date) =>
                      updateRow(row.id, "startDate", date ? date.toISOString().split('T')[0] : '')
                    }
                  />
                  <CustomCalendar
                    className="adp-diag-input"
                    value={row.endDate}
                    onChange={(date) =>
                      updateRow(row.id, "endDate", date ? date.toISOString().split('T')[0] : '')
                    }
                  />
                  <input
                    className="adp-text-input adp-diag-input"
                    placeholder={t("diseases.placeholder_diagnosis")}
                    value={row.diagnosis}
                    onChange={(e) =>
                      updateRow(row.id, "diagnosis", e.target.value)
                    }
                  />
                  <input
                    className="adp-text-input adp-diag-input"
                    placeholder={t("diseases.placeholder_icd_code")}
                    value={row.icdCode}
                    onChange={(e) =>
                      updateRow(row.id, "icdCode", e.target.value)
                    }
                  />
                  <DoctorAutocomplete
                    value={row.doctor}
                    onChange={(val) => updateRow(row.id, "doctor", val)}
                    doctors={doctors}
                    language={i18n.language}
                    placeholder={t("diseases.placeholder_doctor")}
                  />
                  <div className="adp-diag-row-btns">
                    <button
                      className="adp-diag-save-btn"
                      onClick={() =>
                        setEditingRowIds((prev) => {
                          const s = new Set(prev);
                          s.delete(row.id);
                          return s;
                        })
                      }
                      title={t("common.confirm")}
                    >
                      <FiCheck size={13} />
                    </button>
                    <button
                      className="adp-diag-delete-btn"
                      onClick={() => deleteRow(row.id)}
                    >
                      <FiTrash2 size={13} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="adp-diag-cell">
                    {row.startDate ? formatDate(row.startDate) : "-"}
                  </span>
                  <span className="adp-diag-cell">
                    {row.endDate ? formatDate(row.endDate) : "-"}
                  </span>
                  <span className="adp-diag-cell">
                    {row.diagnosis || "-"}
                  </span>
                  <span className="adp-diag-cell">{row.icdCode || "-"}</span>
                  <span className="adp-diag-cell">{row.doctor || "-"}</span>
                  <div className="adp-diag-row-btns">
                    <button
                      className="adp-diag-edit-btn"
                      onClick={() => startEditRow(row.id)}
                    >
                      <FiEdit2 size={13} />
                    </button>
                    <button
                      className="adp-diag-delete-btn"
                      onClick={() => deleteRow(row.id)}
                    >
                      <FiTrash2 size={13} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}

          <button
            className="adp-add-link"
            style={{ marginTop: rows.length ? 8 : 0 }}
            onClick={addRow}
          >
            <FiPlus size={13} /> {t("diseases.add_disease")}
          </button>
        </div>
      )}
    </div>
  );
});

/*  FinalDiagnosisSection: view + edit modes  */
const FinalDiagnosisSection = forwardRef(({ patient }, ref) => {
  const { t, i18n } = useTranslation("appointment_details_general");
  const mapDiagnosis = (d) => ({
    id: d._id || Date.now() + Math.random(),
    date: d.date ? new Date(d.date).toISOString().split("T")[0] : "",
    diagnosis: d.diagnosis || "",
    icdCode: d.icdCode || "",
    primary: d.primary || "1",
    doctorName: d.doctorName || "",
    jobTitle: d.jobTitle || "",
    speciality: d.speciality || "",
    confirmed: true,
  });

  const initRows = patient?.finalDiagnoses?.length
    ? patient.finalDiagnoses.map(mapDiagnosis)
    : [];

  const [open, setOpen] = useState(false);
  const [editingRowIds, setEditingRowIds] = useState(new Set());
  const [rows, setRows] = useState(initRows);
  const [doctors, setDoctors] = useState([]);
  const [rowDoctorSpecialties, setRowDoctorSpecialties] = useState({});

  const startEditRow = (id) => {
    setOpen(true);
    setEditingRowIds((prev) => new Set([...prev, id]));
  };

  useEffect(() => {
    getDoctorsLite().then((data) => setDoctors(Array.isArray(data) ? data : [])).catch(() => { });
  }, []);

  useEffect(() => {
    if (patient?.finalDiagnoses?.length) {
      setRows(patient.finalDiagnoses.map(mapDiagnosis));
    }
  }, [patient?.finalDiagnoses]);

  const emptyRow = () => ({
    id: Date.now(),
    date: "",
    diagnosis: "",
    icdCode: "",
    primary: "1",
    doctorName: "",
    jobTitle: "",
    speciality: "",
    confirmed: false,
  });

  const addRow = () => {
    const newRow = emptyRow();
    setRows((prev) => [...prev, newRow]);
    setOpen(true);
    setEditingRowIds((prev) => new Set([...prev, newRow.id]));
  };

  const updateRow = (id, key, val) =>
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [key]: val } : r)),
    );

  const handleDoctorSelectForRow = (rowId, doctor) => {
    const specialties = doctor.specialtyIds
      ? doctor.specialtyIds.map((s) => s[`name_${i18n.language?.startsWith("ru") ? "ru" : "en"}`] || s.name_en || "").filter(Boolean)
      : [];
    setRowDoctorSpecialties((prev) => ({ ...prev, [rowId]: specialties }));
  };

  const deleteRow = (id) => setRows((prev) => prev.filter((r) => r.id !== id));

  useImperativeHandle(ref, () => ({
    getData: () => rows.map(({ id, confirmed, ...rest }) => rest),
  }));

  return (
    <div className="adp-section">
      <div className="adp-section-header" onClick={() => setOpen((p) => !p)}>
        <span className="adp-section-title">
          {t("final_diagnosis.title")}
        </span>
        <div className="adp-section-header-right">
          <button
            className="adp-edit-btn"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
              if (editingRowIds.size > 0) {
                setEditingRowIds(new Set());
              } else {
                setEditingRowIds(new Set(rows.map((r) => r.id)));
              }
            }}
          >
            <FiEdit2 size={14} />
          </button>
          <button
            className="adp-collapse-btn"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((p) => !p);
            }}
          >
            {open ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="adp-section-body">
          {rows.length === 0 && editingRowIds.size === 0 && (
            <p className="adp-empty-msg">
              {t("final_diagnosis.empty_message")}
            </p>
          )}

          {rows.length > 0 && (
            <div className="adp-diag-header-row adp-diag-row--final">
              <span className="adp-input-label">{t("final_diagnosis.col_date")}</span>
              <span className="adp-input-label">{t("final_diagnosis.col_diagnosis")}</span>
              <span className="adp-input-label">{t("final_diagnosis.col_icd_code")}</span>
              <span className="adp-input-label">{t("final_diagnosis.col_type")}</span>
              <span className="adp-input-label">{t("final_diagnosis.col_doctor_name")}</span>
              <span className="adp-input-label">{t("final_diagnosis.col_job_title")}</span>
              <span className="adp-input-label">{t("final_diagnosis.col_speciality")}</span>
              <span />
            </div>
          )}

          {rows.map((row) => (
            <div key={row.id} className="adp-diag-row adp-diag-row--final">
              {editingRowIds.has(row.id) ? (
                <>
                  <CustomCalendar
                    className="adp-diag-input"
                    value={row.date}
                    onChange={(date) =>
                      updateRow(row.id, "date", date ? date.toISOString().split('T')[0] : '')
                    }
                  />
                  <input
                    className="adp-text-input adp-diag-input"
                    placeholder={t("final_diagnosis.placeholder_diagnosis")}
                    value={row.diagnosis}
                    onChange={(e) =>
                      updateRow(row.id, "diagnosis", e.target.value)
                    }
                  />
                  <input
                    className="adp-text-input adp-diag-input"
                    placeholder={t("final_diagnosis.placeholder_icd")}
                    value={row.icdCode}
                    onChange={(e) =>
                      updateRow(row.id, "icdCode", e.target.value)
                    }
                  />
                  <select
                    className="adp-text-input adp-diag-input adp-select"
                    value={row.primary}
                    onChange={(e) =>
                      updateRow(row.id, "primary", e.target.value)
                    }
                  >
                    <option value="1">1</option>
                    <option value="2">2</option>
                  </select>
                  <DoctorAutocomplete
                    value={row.doctorName}
                    onChange={(val) => updateRow(row.id, "doctorName", val)}
                    onDoctorSelect={(doctor) => handleDoctorSelectForRow(row.id, doctor)}
                    doctors={doctors}
                    language={i18n.language}
                    placeholder={t("final_diagnosis.placeholder_full_name")}
                  />
                  <input
                    className="adp-text-input adp-diag-input"
                    placeholder={t("final_diagnosis.placeholder_job_title")}
                    value={row.jobTitle}
                    onChange={(e) =>
                      updateRow(row.id, "jobTitle", e.target.value)
                    }
                  />
                  <SpecialityAutocomplete
                    value={row.speciality}
                    onChange={(val) => updateRow(row.id, "speciality", val)}
                    options={rowDoctorSpecialties[row.id] || []}
                    placeholder={t("final_diagnosis.placeholder_speciality")}
                  />
                  <div className="adp-diag-row-btns">
                    <button
                      className="adp-diag-save-btn"
                      onClick={() =>
                        setEditingRowIds((prev) => {
                          const s = new Set(prev);
                          s.delete(row.id);
                          return s;
                        })
                      }
                      title={t("common.confirm")}
                    >
                      <FiCheck size={13} />
                    </button>
                    <button
                      className="adp-diag-delete-btn"
                      onClick={() => deleteRow(row.id)}
                    >
                      <FiTrash2 size={13} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="adp-diag-cell">
                    {row.date ? formatDate(row.date) : "—"}
                  </span>
                  <span className="adp-diag-cell">{row.diagnosis || "—"}</span>
                  <span className="adp-diag-cell">{row.icdCode || "—"}</span>
                  <span className="adp-diag-cell">{row.primary || "—"}</span>
                  <span className="adp-diag-cell">{row.doctorName || "—"}</span>
                  <span className="adp-diag-cell">{row.jobTitle || "—"}</span>
                  <span className="adp-diag-cell">{row.speciality || "—"}</span>
                  <div className="adp-diag-row-btns">
                    <button
                      className="adp-diag-edit-btn"
                      onClick={() => startEditRow(row.id)}
                    >
                      <FiEdit2 size={13} />
                    </button>
                    <button
                      className="adp-diag-delete-btn"
                      onClick={() => deleteRow(row.id)}
                    >
                      <FiTrash2 size={13} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}

          <button
            className="adp-add-link"
            style={{ marginTop: rows.length ? 8 : 0 }}
            onClick={addRow}
          >
            <FiPlus size={13} /> {t("final_diagnosis.add_diagnosis")}
          </button>
        </div>
      )}
    </div>
  );
});
/* PersonalDataSection: view + edit modes*/
const MARITAL_STATUS_OPTIONS = [
  "",
  "Single / Unmarried",
  "Married",
  "Divorced",
  "Widowed",
  "Civil marriage",
];
const EDUCATION_OPTIONS = [
  "",
  "Secondary",
  "Secondary vocational",
  "Incomplete higher",
  "Higher",
  "Postgraduate",
];
const EMPLOYMENT_OPTIONS = [
  "",
  "Employed",
  "Unemployed",
  "Student",
  "Retired",
  "Disabled",
];

const PersonalDataSection = forwardRef(({ patient }, ref) => {
  const { t } = useTranslation("appointment_details_general");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const initForm = () => ({
    maritalStatus: patient?.maritalStatus || "",
    education: patient?.education || "",
    employment: patient?.employment || "",
    placeOfWork: patient?.placeOfWork || "",
    jobTitle: patient?.workSpecialty || "",
    changePlaceOfWork: patient?.changePlaceOfWork || "",
    changeOfPosition: patient?.changeOfPosition || "",
  });

  const [form, setForm] = useState(initForm);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const hasData = Object.values(form).some(Boolean);

  useImperativeHandle(ref, () => ({
    getData: () => ({
      maritalStatus: form.maritalStatus,
      education: form.education,
      employment: form.employment,
      placeOfWork: form.placeOfWork,
      workSpecialty: form.jobTitle,
      changePlaceOfWork: form.changePlaceOfWork,
      changeOfPosition: form.changeOfPosition,
    }),
  }));

  return (
    <div className="adp-section">
      <div className="adp-section-header" onClick={() => setOpen((p) => !p)}>
        <span className="adp-section-title">{t("personal_data.title")}</span>
        <div className="adp-section-header-right">
          <button
            className="adp-edit-btn"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
              setEditing((p) => !p);
            }}
          >
            <FiEdit2 size={14} />
          </button>
          <button
            className="adp-collapse-btn"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((p) => !p);
            }}
          >
            {open ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="adp-section-body">
          {editing ? (
            <div className="adp-pd-grid">
              {/* LEFT: selects */}
              <div className="adp-pd-left">
                <div className="adp-labeled-input">
                  <span className="adp-input-label">{t("personal_data.marital_status")}</span>
                  <select
                    className="adp-text-input adp-select"
                    value={form.maritalStatus}
                    onChange={set("maritalStatus")}
                  >
                    {MARITAL_STATUS_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o || t("common.all_default")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="adp-labeled-input">
                  <span className="adp-input-label">{t("personal_data.education")}</span>
                  <select
                    className="adp-text-input adp-select"
                    value={form.education}
                    onChange={set("education")}
                  >
                    {EDUCATION_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o || t("common.all_default")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="adp-labeled-input">
                  <span className="adp-input-label">{t("personal_data.employment")}</span>
                  <select
                    className="adp-text-input adp-select"
                    value={form.employment}
                    onChange={set("employment")}
                  >
                    {EMPLOYMENT_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o || t("common.all_default")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* RIGHT: editable text fields */}
              <div className="adp-pd-right">
                <div className="adp-pd-right-field">
                  <span className="adp-input-label">{t("personal_data.place_of_work")}</span>
                  <div className="adp-pd-inline-input">
                    <input
                      className="adp-text-input"
                      placeholder={t("personal_data.place_of_work_placeholder")}
                      value={form.placeOfWork}
                      onChange={set("placeOfWork")}
                    />
                  </div>
                </div>
                <div className="adp-pd-right-field">
                  <span className="adp-input-label">{t("personal_data.job_title")}</span>
                  <div className="adp-pd-inline-input">
                    <input
                      className="adp-text-input"
                      placeholder={t("personal_data.job_title_placeholder")}
                      value={form.jobTitle}
                      onChange={set("jobTitle")}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : hasData ? (
            <div className="adp-info-grid">
              {form.maritalStatus && (
                <div className="adp-field">
                  <span className="adp-field-label">{t("personal_data.marital_status")}</span>
                  <span className="adp-field-value">{form.maritalStatus}</span>
                </div>
              )}
              {form.education && (
                <div className="adp-field">
                  <span className="adp-field-label">{t("personal_data.education")}</span>
                  <span className="adp-field-value">{form.education}</span>
                </div>
              )}
              {form.employment && (
                <div className="adp-field">
                  <span className="adp-field-label">{t("personal_data.employment")}</span>
                  <span className="adp-field-value">{form.employment}</span>
                </div>
              )}
              {form.placeOfWork && (
                <div className="adp-field">
                  <span className="adp-field-label">{t("personal_data.place_of_work")}</span>
                  <span className="adp-field-value">{form.placeOfWork}</span>
                </div>
              )}
              {form.jobTitle && (
                <div className="adp-field">
                  <span className="adp-field-label">{t("personal_data.job_title")}</span>
                  <span className="adp-field-value">{form.jobTitle}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="adp-empty-msg">
              {t("personal_data.empty_message")}
            </p>
          )}
        </div>
      )}
    </div>
  );
});

/*  DisabilitySection: view + edit modes */
const DISABILITY_GROUP_OPTIONS = [
  "",
  "Group I",
  "Group II",
  "Group III",
  "Child with disability",
];
const DISABILITY_TYPE_OPTIONS = [
  "",
  "General disease",
  "Occupational disease",
  "Labour injury",
  "Childhood",
  "Military trauma",
];

const DisabilitySection = forwardRef(({ patient }, ref) => {
  const { t } = useTranslation("appointment_details_general");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    isDisabled: patient?.disability === "Yes" || false,
    periodFrom: patient?.disabilityFrom || "",
    periodTo: patient?.disabilityTo || "",
    indefinitely: patient?.disabilityIndefinitely || false,
    group: patient?.invalidGroup || "",
    type: patient?.disabilityType || "",
    primaryRepeated: patient?.disabilityPrimaryRepeated || "",
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const toggle = (key) => () => setForm((f) => ({ ...f, [key]: !f[key] }));

  useImperativeHandle(ref, () => ({
    getData: () => ({
      disability: form.isDisabled ? "Yes" : "No",
      disabilityFrom: form.periodFrom,
      disabilityTo: form.periodTo,
      disabilityIndefinitely: form.indefinitely,
      invalidGroup: form.group,
      disabilityType: form.type,
      disabilityPrimaryRepeated: form.primaryRepeated,
    }),
  }));

  const ViewRow = ({ label, value }) =>
    value ? (
      <div className="adp-contact-form-row">
        <span className="adp-contact-form-label">{label}</span>
        <span className="adp-contact-view-value">{value}</span>
      </div>
    ) : null;

  const hasData =
    form.isDisabled || form.group || form.type || form.primaryRepeated;

  return (
    <div className="adp-section">
      <div className="adp-section-header" onClick={() => setOpen((p) => !p)}>
        <span className="adp-section-title">{t("disability.title")}</span>
        <div className="adp-section-header-right">
          <button
            className="adp-edit-btn"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
              setEditing((p) => !p);
            }}
            title={t("disability.edit_title")}
          >
            <FiEdit2 size={14} />
          </button>
          <button
            className="adp-collapse-btn"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((p) => !p);
            }}
          >
            {open ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="adp-section-body">
          {editing ? (
            <div className="adp-contacts-form">
              <div className="adp-contact-form-row">
                <span className="adp-contact-form-label">{t("disability.disability_label")}</span>
                <label
                  className="adp-newsletter-label"
                  onClick={toggle("isDisabled")}
                >
                  <span
                    className={`adp-checkbox ${form.isDisabled ? "checked" : ""}`}
                  >
                    {form.isDisabled && <FiCheck size={11} />}
                  </span>
                  {t("disability.patient_with_disability")}
                </label>
              </div>
              <div className="adp-contact-form-row adp-contact-form-row-top">
                <span className="adp-contact-form-label">
                  {t("disability.period")}
                </span>
                <div className="adp-disability-period">
                  <div className="adp-disability-period-row">
                    <span className="adp-period-label">{t("disability.period_from")}</span>
                    <CustomCalendar
                      className="adp-period-input"
                      value={form.periodFrom}
                      onChange={(date) =>
                        setForm((f) => ({ ...f, periodFrom: date ? date.toISOString().split('T')[0] : '' }))
                      }
                      disabled={form.indefinitely}
                    />
                    <span className="adp-period-label">{t("disability.period_to")}</span>
                    <CustomCalendar
                      className="adp-period-input"
                      value={form.periodTo}
                      onChange={(date) =>
                        setForm((f) => ({ ...f, periodTo: date ? date.toISOString().split('T')[0] : '' }))
                      }
                      disabled={form.indefinitely}
                    />
                  </div>
                  <label
                    className="adp-newsletter-label"
                    onClick={toggle("indefinitely")}
                  >
                    <span
                      className={`adp-checkbox ${form.indefinitely ? "checked" : ""}`}
                    >
                      {form.indefinitely && <FiCheck size={11} />}
                    </span>
                    {t("disability.indefinitely")}
                  </label>
                </div>
              </div>
              <div className="adp-contact-form-row">
                <span className="adp-contact-form-label">{t("disability.group")}</span>
                <select
                  className="adp-text-input adp-contact-input adp-select"
                  value={form.group}
                  onChange={set("group")}
                >
                  {DISABILITY_GROUP_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o || t("common.all_default")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="adp-contact-form-row">
                <span className="adp-contact-form-label">
                  {t("disability.type_label")}
                </span>
                <select
                  className="adp-text-input adp-contact-input adp-select"
                  value={form.type}
                  onChange={set("type")}
                >
                  {DISABILITY_TYPE_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o || t("common.all_default")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="adp-contact-form-row">
                <span className="adp-contact-form-label" />
                <div className="adp-radio-group">
                  <label className="adp-radio-label">
                    <input
                      type="radio"
                      name="primaryRepeated"
                      value="Primary"
                      checked={form.primaryRepeated === "Primary"}
                      onChange={set("primaryRepeated")}
                    />
                    {t("disability.primary")}
                  </label>
                  <label className="adp-radio-label">
                    <input
                      type="radio"
                      name="primaryRepeated"
                      value="Repeated"
                      checked={form.primaryRepeated === "Repeated"}
                      onChange={set("primaryRepeated")}
                    />
                    {t("disability.repeated")}
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <div className="adp-contacts-form">
              {hasData ? (
                <>
                  {form.isDisabled && (
                    <div className="adp-contact-form-row">
                      <span className="adp-contact-form-label">{t("disability.disability_label")}</span>
                      <span className="adp-contact-view-value">
                        {t("disability.patient_with_disability")}
                      </span>
                    </div>
                  )}
                  {(form.periodFrom || form.periodTo || form.indefinitely) && (
                    <div className="adp-contact-form-row">
                      <span className="adp-contact-form-label">
                        {t("disability.period")}
                      </span>
                      <span className="adp-contact-view-value">
                        {form.indefinitely
                          ? t("disability.indefinitely")
                          : `${form.periodFrom ? formatDate(form.periodFrom) : "-"} â€“ ${form.periodTo ? formatDate(form.periodTo) : "-"}`}
                      </span>
                    </div>
                  )}
                  <ViewRow label={t("disability.group")} value={form.group} />
                  <ViewRow label={t("disability.type_label")} value={form.type} />
                  <ViewRow
                    label={t("disability.primary_repeated_view")}
                    value={form.primaryRepeated}
                  />
                </>
              ) : (
                <p className="adp-empty-msg">
                  {t("disability.empty_message")}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

/*AnamnesisSection: view + edit modes */
const AnamnesisSection = forwardRef(({ patient }, ref) => {
  const { t } = useTranslation("appointment_details_general");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    disability: patient?.anamnesisDisability || "",
    bloodGroup: patient?.bloodGroup || "",
    rhFactor: patient?.rhFactor || "",
    kellAntigen: patient?.kellAntigen || "",
    otherBloodInfo: patient?.otherBloodInfo || "",
    allergicReactions: patient?.allergies || "",
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  useImperativeHandle(ref, () => ({
    getData: () => ({
      anamnesisDisability: form.disability,
      bloodGroup: form.bloodGroup,
      rhFactor: form.rhFactor,
      kellAntigen: form.kellAntigen,
      otherBloodInfo: form.otherBloodInfo,
      allergies: form.allergicReactions,
    }),
  }));

  const ViewRow = ({ label, value }) =>
    value ? (
      <div className="adp-contact-form-row">
        <span className="adp-contact-form-label">{label}</span>
        <span className="adp-contact-view-value">{value}</span>
      </div>
    ) : null;

  const hasData = Object.values(form).some(Boolean);

  return (
    <div className="adp-section">
      <div className="adp-section-header" onClick={() => setOpen((p) => !p)}>
        <span className="adp-section-title">{t("anamnesis.title")}</span>
        <div className="adp-section-header-right">
          <button
            className="adp-edit-btn"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
              setEditing((p) => !p);
            }}
            title={t("anamnesis.edit_title")}
          >
            <FiEdit2 size={14} />
          </button>
          <button
            className="adp-collapse-btn"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((p) => !p);
            }}
          >
            {open ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="adp-section-body">
          {editing ? (
            <div className="adp-contacts-form">
              <div className="adp-contact-form-row">
                <span className="adp-contact-form-label">{t("anamnesis.disability")}</span>
                <input
                  className="adp-text-input adp-contact-input"
                  value={form.disability}
                  onChange={set("disability")}
                  placeholder={t("anamnesis.disability_placeholder")}
                />
              </div>
              <div className="adp-contact-form-row">
                <span className="adp-contact-form-label">{t("anamnesis.blood_group")}</span>
                <input
                  className="adp-text-input adp-contact-input"
                  value={form.bloodGroup}
                  onChange={set("bloodGroup")}
                  placeholder={t("anamnesis.blood_group_placeholder")}
                />
              </div>
              <div className="adp-contact-form-row">
                <span className="adp-contact-form-label">{t("anamnesis.rh_factor")}</span>
                <input
                  className="adp-text-input adp-contact-input"
                  value={form.rhFactor}
                  onChange={set("rhFactor")}
                  placeholder={t("anamnesis.rh_factor_placeholder")}
                />
              </div>
              <div className="adp-contact-form-row">
                <span className="adp-contact-form-label">{t("anamnesis.kell_antigen")}</span>
                <input
                  className="adp-text-input adp-contact-input"
                  value={form.kellAntigen}
                  onChange={set("kellAntigen")}
                  placeholder={t("anamnesis.kell_antigen_placeholder")}
                />
              </div>
              <div className="adp-contact-form-row">
                <span className="adp-contact-form-label">
                  {t("anamnesis.other_blood_info")}
                </span>
                <input
                  className="adp-text-input adp-contact-input"
                  value={form.otherBloodInfo}
                  onChange={set("otherBloodInfo")}
                  placeholder={t("anamnesis.other_blood_info_placeholder")}
                />
              </div>
              <div className="adp-contact-form-row adp-contact-form-row-top">
                <span className="adp-contact-form-label">
                  {t("anamnesis.allergies")}
                </span>
                <textarea
                  className="adp-textarea adp-contact-input"
                  value={form.allergicReactions}
                  onChange={set("allergicReactions")}
                  placeholder={t("anamnesis.allergies_placeholder")}
                  rows={3}
                />
              </div>
            </div>
          ) : (
            <div className="adp-contacts-form">
              {hasData ? (
                <>
                  <ViewRow label={t("anamnesis.disability")} value={form.disability} />
                  <ViewRow label={t("anamnesis.blood_group")} value={form.bloodGroup} />
                  <ViewRow label={t("anamnesis.rh_factor")} value={form.rhFactor} />
                  <ViewRow label={t("anamnesis.kell_antigen")} value={form.kellAntigen} />
                  <ViewRow
                    label={t("anamnesis.other_blood_info_view")}
                    value={form.otherBloodInfo}
                  />
                  <ViewRow
                    label={t("anamnesis.allergies")}
                    value={form.allergicReactions}
                  />
                </>
              ) : (
                <p className="adp-empty-msg">
                  {t("anamnesis.empty_message")}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

/* RadiationDosesSection: view + edit modes */
const RadiationDosesSection = forwardRef(({ patient }, ref) => {
  const { t } = useTranslation("appointment_details_general");
  const mapDose = (d) => ({
    id: d._id || Date.now() + Math.random(),
    date: d.date ? new Date(d.date).toISOString().split("T")[0] : "",
    researchType: d.researchType || "",
    effectiveDose: d.effectiveDose || "",
    note: d.note || "",
    confirmed: true,
  });

  const initRows = patient?.radiationDoses?.length
    ? patient.radiationDoses.map(mapDose)
    : [];

  const [open, setOpen] = useState(false);
  const [editingRowIds, setEditingRowIds] = useState(new Set());
  const [rows, setRows] = useState(initRows);

  const startEditRow = (id) => {
    setOpen(true);
    setEditingRowIds((prev) => new Set([...prev, id]));
  };

  useEffect(() => {
    if (patient?.radiationDoses?.length) {
      setRows(patient.radiationDoses.map(mapDose));
    }
  }, [patient?.radiationDoses]);

  const emptyRow = () => ({
    id: Date.now(),
    date: "",
    researchType: "",
    effectiveDose: "",
    note: "",
    confirmed: false,
  });

  const addRow = () => {
    const newRow = emptyRow();
    setRows((prev) => [...prev, newRow]);
    setOpen(true);
    setEditingRowIds((prev) => new Set([...prev, newRow.id]));
  };

  const updateRow = (id, key, val) =>
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [key]: val } : r)),
    );

  const deleteRow = (id) => setRows((prev) => prev.filter((r) => r.id !== id));

  useImperativeHandle(ref, () => ({
    getData: () => rows.map(({ id, confirmed, ...rest }) => rest),
  }));

  return (
    <div className="adp-section">
      <div className="adp-section-header" onClick={() => setOpen((p) => !p)}>
        <span className="adp-section-title">
          {t("radiation_doses.title")}
        </span>
        <div className="adp-section-header-right">
          <button
            className="adp-edit-btn"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
              if (editingRowIds.size > 0) {
                setEditingRowIds(new Set());
              } else {
                setEditingRowIds(new Set(rows.map((r) => r.id)));
              }
            }}
            title={t("radiation_doses.edit_title")}
          >
            <FiEdit2 size={14} />
          </button>
          <button
            className="adp-collapse-btn"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((p) => !p);
            }}
          >
            {open ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="adp-section-body">
          {rows.length === 0 && editingRowIds.size === 0 && (
            <p className="adp-empty-msg">
              {t("diseases.empty_message")}
            </p>
          )}

          {rows.length > 0 && (
            <div className="adp-diag-header-row adp-diag-row--radiation">
              <span className="adp-input-label">{t("radiation_doses.col_no")}</span>
              <span className="adp-input-label">{t("radiation_doses.col_date")}</span>
              <span className="adp-input-label">{t("radiation_doses.col_type")}</span>
              <span className="adp-input-label">
                {t("radiation_doses.col_effective_dose")}{" "}
                <span className="adp-help-icon" title={t("radiation_doses.effective_dose_tooltip")}>
                  ?
                </span>
              </span>
              <span className="adp-input-label">{t("radiation_doses.col_note")}</span>
              <span />
            </div>
          )}

          {rows.map((row, idx) => (
            <div key={row.id} className="adp-diag-row adp-diag-row--radiation">
              {editingRowIds.has(row.id) ? (
                <>
                  <span className="adp-diag-cell" style={{ fontWeight: 600 }}>
                    {idx + 1}
                  </span>
                  <CustomCalendar
                    className="adp-diag-input"
                    value={row.date}
                    onChange={(date) =>
                      updateRow(row.id, "date", date ? date.toISOString().split('T')[0] : '')
                    }
                  />
                  <input
                    className="adp-text-input adp-diag-input"
                    placeholder={t("radiation_doses.placeholder_type")}
                    value={row.researchType}
                    onChange={(e) =>
                      updateRow(row.id, "researchType", e.target.value)
                    }
                  />
                  <input
                    className="adp-text-input adp-diag-input"
                    placeholder={t("radiation_doses.placeholder_dose")}
                    value={row.effectiveDose}
                    onChange={(e) =>
                      updateRow(row.id, "effectiveDose", e.target.value)
                    }
                  />
                  <input
                    className="adp-text-input adp-diag-input"
                    placeholder={t("radiation_doses.placeholder_note")}
                    value={row.note}
                    onChange={(e) => updateRow(row.id, "note", e.target.value)}
                  />
                  <div className="adp-diag-row-btns">
                    <button
                      className="adp-diag-save-btn"
                      onClick={() =>
                        setEditingRowIds((prev) => {
                          const s = new Set(prev);
                          s.delete(row.id);
                          return s;
                        })
                      }
                      title={t("common.confirm")}
                    >
                      <FiCheck size={13} />
                    </button>
                    <button
                      className="adp-diag-delete-btn"
                      onClick={() => deleteRow(row.id)}
                    >
                      <FiTrash2 size={13} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="adp-diag-cell" style={{ fontWeight: 600 }}>
                    {idx + 1}
                  </span>
                  <span className="adp-diag-cell">
                    {row.date ? formatDate(row.date) : "—"}
                  </span>
                  <span className="adp-diag-cell">
                    {row.researchType || "—"}
                  </span>
                  <span className="adp-diag-cell">
                    {row.effectiveDose || "—"}
                  </span>
                  <span className="adp-diag-cell">{row.note || "—"}</span>
                  <div className="adp-diag-row-btns">
                    <button
                      className="adp-diag-edit-btn"
                      onClick={() => startEditRow(row.id)}
                    >
                      <FiEdit2 size={13} />
                    </button>
                    <button
                      className="adp-diag-delete-btn"
                      onClick={() => deleteRow(row.id)}
                    >
                      <FiTrash2 size={13} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}

          <button
            className="adp-add-link"
            style={{ marginTop: rows.length ? 8 : 0 }}
            onClick={addRow}
          >
            <FiPlus size={13} /> {t("radiation_doses.add_record")}
          </button>
        </div>
      )}
    </div>
  );
});

const EMPTY_REP = {
  lastName: "",
  firstName: "",
  middleName: "",
  isCurrent: false,
  birthday: "",
  gender: "",
  relationship: "",
  attitudeToPatient: "",
  documentOfAuthority: "",
  documentType: "",
  series: "",
  number: "",
  whenIssued: "",
  issuedBy: "",
  snils: "",
  address: "",
  addressType: "",
  tenant: "",
  subjectOfRussia: "",
  district: "",
  city: "",
  settlement: "",
  street: "",
  house: "",
  apartment: "",
  state: "",
};

const LegalRepresentativeSection = forwardRef(({ patient }, ref) => {
  const { t } = useTranslation("appointment_details_general");
  const initReps = patient?.legalRepresentatives?.length
    ? patient.legalRepresentatives.map((r) => ({
      lastName: r.lastName || "",
      firstName: r.firstName || "",
      middleName: r.middleName || "",
      isCurrent: r.isCurrent || false,
      birthday: r.birthday
        ? new Date(r.birthday).toISOString().split("T")[0]
        : "",
      gender: r.gender || "",
      relationship: r.relationship || "",
      attitudeToPatient: r.attitudeToPatient || "",
      documentOfAuthority: r.documentOfAuthority || "",
      documentType: r.documentType || "",
      series: r.series || "",
      number: r.number || "",
      whenIssued: r.whenIssued
        ? new Date(r.whenIssued).toISOString().split("T")[0]
        : "",
      issuedBy: r.issuedBy || "",
      snils: r.snils || "",
      address: r.address || "",
      addressType: r.addressType || "",
      tenant: r.tenant || "",
      subjectOfRussia: r.subjectOfRussia || "",
      district: r.district || "",
      city: r.city || "",
      settlement: r.settlement || "",
      street: r.street || "",
      house: r.house || "",
      apartment: r.apartment || "",
      state: r.state || "",
    }))
    : [{ ...EMPTY_REP }];

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reps, setReps] = useState(initReps);
  const [editReps, setEditReps] = useState(initReps.map((r) => ({ ...r })));

  // Sync state when patient data arrives asynchronously or changes after save
  useEffect(() => {
    if (patient?.legalRepresentatives?.length) {
      const mapped = patient.legalRepresentatives.map((r) => ({
        lastName: r.lastName || "",
        firstName: r.firstName || "",
        middleName: r.middleName || "",
        isCurrent: r.isCurrent || false,
        birthday: r.birthday
          ? new Date(r.birthday).toISOString().split("T")[0]
          : "",
        gender: r.gender || "",
        relationship: r.relationship || "",
        attitudeToPatient: r.attitudeToPatient || "",
        documentOfAuthority: r.documentOfAuthority || "",
        documentType: r.documentType || "",
        series: r.series || "",
        number: r.number || "",
        whenIssued: r.whenIssued
          ? new Date(r.whenIssued).toISOString().split("T")[0]
          : "",
        issuedBy: r.issuedBy || "",
        snils: r.snils || "",
        address: r.address || "",
        addressType: r.addressType || "",
        tenant: r.tenant || "",
        subjectOfRussia: r.subjectOfRussia || "",
        district: r.district || "",
        city: r.city || "",
        settlement: r.settlement || "",
        street: r.street || "",
        house: r.house || "",
        apartment: r.apartment || "",
        state: r.state || "",
      }));
      setReps(mapped);
      if (!editing) {
        setEditReps(mapped.map((r) => ({ ...r })));
      }
    }
  }, [patient?.legalRepresentatives]);

  const startEdit = () => {
    setEditReps(reps.map((r) => ({ ...r })));
    setOpen(true);
    setEditing(true);
  };

  const handleAddInViewMode = () => {
    const copied = reps.map((r) => ({ ...r }));
    copied.push({ ...EMPTY_REP });
    setEditReps(copied);
    setOpen(true);
    setEditing(true);
  };

  const setField = (idx, key) => (e) =>
    setEditReps((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [key]: e.target.value } : r)),
    );

  const setCheck = (idx, key) => (e) =>
    setEditReps((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [key]: e.target.checked } : r)),
    );

  const setGender = (idx, val) =>
    setEditReps((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, gender: val } : r)),
    );

  const addRep = () => setEditReps((prev) => [...prev, { ...EMPTY_REP }]);

  const removeRep = (idx) =>
    setEditReps((prev) => prev.filter((_, i) => i !== idx));

  useImperativeHandle(
    ref,
    () => ({
      getData: () => (editing ? editReps : reps),
      commitEdit: () => {
        setReps(editReps.map((r) => ({ ...r })));
        setEditing(false);
      },
    }),
    [editing, editReps, reps],
  );

  return (
    <div className="adp-section">
      {/* Header */}
      <div className="adp-section-header" onClick={() => setOpen((p) => !p)}>
        <span className="adp-section-title">{t("legal_representative.title")}</span>
        <div className="adp-section-header-right">
          <button
            className="adp-edit-btn"
            onClick={(e) => {
              e.stopPropagation();
              if (editing) {
                setReps(editReps.map((r) => ({ ...r })));
                setEditing(false);
              } else {
                startEdit();
              }
            }}
            title={t("common.edit")}
          >
            <FiEdit2 size={14} />
          </button>
          <button
            className="adp-collapse-btn"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((p) => !p);
            }}
          >
            {open ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="adp-section-body">
          {editing ? (
            <div className="adp-rep-edit-list">
              {editReps.map((rep, idx) => (
                <div
                  key={idx}
                  className={`adp-rep-edit-card${idx > 0 ? " adp-rep-edit-card--divided" : ""}`}
                >
                  {editReps.length > 1 && (
                    <div className="adp-rep-edit-card-header">
                      <span className="adp-rep-edit-label">
                        {t("legal_representative.representative")} {idx + 1}
                      </span>
                      <button
                        className="adp-remove-rep-btn"
                        onClick={() => removeRep(idx)}
                      >
                        <FiTrash2 size={14} /> {t("common.remove")}
                      </button>
                    </div>
                  )}

                  {/* Name row */}
                  <div className="adp-name-inputs-row">
                    <div className="adp-labeled-input adp-labeled-input--wide">
                      <span className="adp-input-label">{t("common.last_name")}</span>
                      <input
                        className="adp-text-input"
                        placeholder={t("common.last_name_placeholder")}
                        value={rep.lastName}
                        onChange={setField(idx, "lastName")}
                      />
                    </div>
                    <div className="adp-labeled-input adp-labeled-input--wide">
                      <span className="adp-input-label">{t("common.first_name")}</span>
                      <input
                        className="adp-text-input"
                        placeholder={t("common.first_name_placeholder")}
                        value={rep.firstName}
                        onChange={setField(idx, "firstName")}
                      />
                    </div>
                    <div className="adp-labeled-input adp-labeled-input--wide">
                      <span className="adp-input-label">{t("common.middle_name")}</span>
                      <input
                        className="adp-text-input"
                        placeholder={t("common.middle_name_placeholder")}
                        value={rep.middleName}
                        onChange={setField(idx, "middleName")}
                      />
                    </div>
                  </div>

                  {/* Current checkbox */}
                  <label className="adp-rep-checkbox-row">
                    <input
                      type="checkbox"
                      checked={rep.isCurrent}
                      onChange={setCheck(idx, "isCurrent")}
                    />
                    <span>{t("legal_representative.current_legal_rep")}</span>
                  </label>

                  {/* Birthday + Gender */}
                  <div className="adp-dob-gender-row">
                    <div className="adp-labeled-input">
                      <span className="adp-input-label">{t("legal_representative.birthday")}</span>
                      <CustomCalendar
                        value={rep.birthday}
                        onChange={(date) =>
                          setEditReps((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, birthday: date ? date.toISOString().split('T')[0] : '' } : r))
                          )
                        }
                      />
                    </div>
                    <div className="adp-labeled-input">
                      <span className="adp-input-label">{t("legal_representative.floor_gender")}</span>
                      <GenderPillsEdit
                        value={rep.gender}
                        onChange={(v) => setGender(idx, v)}
                      />
                    </div>
                  </div>

                  {/* Relationship + Attitude + Document of authority */}
                  <div className="adp-name-inputs-row">
                    <div className="adp-labeled-input adp-labeled-input--wide">
                      <span className="adp-input-label">{t("legal_representative.relationship")}</span>
                      <input
                        className="adp-text-input"
                        placeholder={t("legal_representative.relationship_placeholder")}
                        value={rep.relationship}
                        onChange={setField(idx, "relationship")}
                      />
                    </div>
                    <div className="adp-labeled-input adp-labeled-input--wide">
                      <span className="adp-input-label">
                        {t("legal_representative.attitude")}
                      </span>
                      <input
                        className="adp-text-input"
                        placeholder={t("legal_representative.attitude_placeholder")}
                        value={rep.attitudeToPatient}
                        onChange={setField(idx, "attitudeToPatient")}
                      />
                    </div>
                    <div className="adp-labeled-input adp-labeled-input--wide">
                      <span className="adp-input-label">
                        {t("legal_representative.document_of_authority")}
                      </span>
                      <input
                        className="adp-text-input"
                        placeholder={t("legal_representative.document_of_authority_placeholder")}
                        value={rep.documentOfAuthority}
                        onChange={setField(idx, "documentOfAuthority")}
                      />
                    </div>
                  </div>

                  {/* Identity card */}
                  <div className="adp-rep-subsection">{t("common.identity_card")}</div>
                  <div className="adp-name-inputs-row">
                    <div className="adp-labeled-input adp-labeled-input--wide">
                      <span className="adp-input-label">{t("common.document_type")}</span>
                      <input
                        className="adp-text-input"
                        placeholder={t("common.document_type_placeholder")}
                        value={rep.documentType}
                        onChange={setField(idx, "documentType")}
                      />
                    </div>
                    <div className="adp-labeled-input adp-labeled-input--wide">
                      <span className="adp-input-label">{t("common.series")}</span>
                      <input
                        className="adp-text-input"
                        placeholder={t("common.series_placeholder")}
                        value={rep.series}
                        onChange={setField(idx, "series")}
                      />
                    </div>
                    <div className="adp-labeled-input adp-labeled-input--wide">
                      <span className="adp-input-label">{t("common.number")}</span>
                      <input
                        className="adp-text-input"
                        placeholder={t("common.number_placeholder")}
                        value={rep.number}
                        onChange={setField(idx, "number")}
                      />
                    </div>
                  </div>
                  <div className="adp-dob-gender-row">
                    <div className="adp-labeled-input">
                      <span className="adp-input-label">{t("common.when_issued")}</span>
                      <CustomCalendar
                        value={rep.whenIssued}
                        onChange={(date) =>
                          setEditReps((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, whenIssued: date ? date.toISOString().split('T')[0] : '' } : r))
                          )
                        }
                      />
                    </div>
                    <div className="adp-labeled-input" style={{ flex: 1 }}>
                      <span className="adp-input-label">{t("common.issued_by")}</span>
                      <input
                        className="adp-text-input"
                        placeholder={t("common.issued_by_placeholder")}
                        value={rep.issuedBy}
                        onChange={setField(idx, "issuedBy")}
                      />
                    </div>
                  </div>

                  {/* Representative information */}
                  <div className="adp-rep-subsection">
                    {t("legal_representative.representative_info")}
                  </div>
                  <div className="adp-name-inputs-row">
                    <div className="adp-labeled-input" style={{ flex: "1 1 100%" }}>
                      <span className="adp-input-label">{t("common.snils")}</span>
                      <input
                        className="adp-text-input"
                        placeholder={t("common.snils_placeholder")}
                        value={rep.snils}
                        onChange={setField(idx, "snils")}
                      />
                    </div>
                  </div>
                  <div className="adp-name-inputs-row">
                    <div className="adp-labeled-input adp-labeled-input--wide">
                      <span className="adp-input-label">
                        {t("legal_representative.subject_of_russia")}
                      </span>
                      <input
                        className="adp-text-input"
                        placeholder={t("legal_representative.subject_of_russia_placeholder")}
                        value={rep.subjectOfRussia}
                        onChange={setField(idx, "subjectOfRussia")}
                      />
                    </div>
                    <div className="adp-labeled-input adp-labeled-input--wide">
                      <span className="adp-input-label">{t("common.district")}</span>
                      <input
                        className="adp-text-input"
                        placeholder={t("common.district_placeholder")}
                        value={rep.district}
                        onChange={setField(idx, "district")}
                      />
                    </div>
                  </div>
                  <div className="adp-name-inputs-row">
                    <div className="adp-labeled-input adp-labeled-input--wide">
                      <span className="adp-input-label">{t("common.city")}</span>
                      <input
                        className="adp-text-input"
                        placeholder={t("common.city_placeholder")}
                        value={rep.city}
                        onChange={setField(idx, "city")}
                      />
                    </div>
                    <div className="adp-labeled-input adp-labeled-input--wide">
                      <span className="adp-input-label">{t("common.street")}</span>
                      <input
                        className="adp-text-input"
                        placeholder={t("common.street_placeholder")}
                        value={rep.street}
                        onChange={setField(idx, "street")}
                      />
                    </div>
                  </div>
                  <div className="adp-name-inputs-row">
                    <div className="adp-labeled-input adp-labeled-input--wide">
                      <span className="adp-input-label">{t("common.house")}</span>
                      <input
                        className="adp-text-input"
                        placeholder={t("common.house_placeholder")}
                        value={rep.house}
                        onChange={setField(idx, "house")}
                      />
                    </div>
                    <div className="adp-labeled-input adp-labeled-input--wide">
                      <span className="adp-input-label">{t("common.apartment")}</span>
                      <input
                        className="adp-text-input"
                        placeholder={t("common.apartment_placeholder")}
                        value={rep.apartment}
                        onChange={setField(idx, "apartment")}
                      />
                    </div>
                    <div className="adp-labeled-input adp-labeled-input--wide">
                      <span className="adp-input-label">{t("legal_representative.state")}</span>
                      <input
                        className="adp-text-input"
                        placeholder={t("legal_representative.state_placeholder")}
                        value={rep.state}
                        onChange={setField(idx, "state")}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                className="adp-add-link"
                onClick={(e) => {
                  e.stopPropagation();
                  addRep();
                }}
              >
                <FiPlus size={13} /> {t("legal_representative.add_representation")}
              </button>
            </div>
          ) : (
            /* â”€â”€ VIEW MODE â”€â”€ */
            <div>
              {reps.map((rep, i) => (
                <div key={i} className={i > 0 ? "adp-rep-view-divider" : ""}>
                  <div className="adp-info-grid">
                    <Field label={t("common.last_name_placeholder")} value={rep.lastName} />
                    <Field label={t("common.first_name_placeholder")} value={rep.firstName} />
                    <Field label={t("common.middle_name_placeholder")} value={rep.middleName} />
                    {rep.isCurrent && (
                      <div className="adp-field adp-field-full">
                        <label className="adp-newsletter-label">
                          <span className="adp-checkbox adp-checkbox--checked">
                            <FiCheck size={11} />
                          </span>
                          {t("legal_representative.current_legal_rep")}
                        </label>
                      </div>
                    )}
                    <Field label={t("legal_representative.birthday")} value={rep.birthday} />
                    <div className="adp-field">
                      <span className="adp-field-label">{t("legal_representative.floor_view")}</span>
                      <GenderPills value={rep.gender || null} />
                    </div>
                    <Field label={t("legal_representative.relationship_view")} value={rep.relationship} />
                    <Field
                      label={t("legal_representative.attitude_view")}
                      value={rep.attitudeToPatient}
                    />
                    <Field
                      label={t("legal_representative.document_of_authority_view")}
                      value={rep.documentOfAuthority}
                    />
                  </div>
                  <div className="adp-subsection-title">{t("common.identity_card")}</div>
                  <div className="adp-info-grid">
                    <Field label={t("common.document_type_placeholder")} value={rep.documentType} />
                    <Field label={t("common.series_placeholder")} value={rep.series} />
                    <Field label={t("common.number_placeholder")} value={rep.number} />
                    <Field label={t("common.when_issued")} value={rep.whenIssued} />
                    <Field label={t("common.issued_by_placeholder")} value={rep.issuedBy} />
                  </div>
                  <div className="adp-subsection-title">
                    {t("legal_representative.representative_info")}
                  </div>
                  <div className="adp-info-grid">
                    <Field label={t("common.snils")} value={rep.snils} />
                    <Field
                      label={t("legal_representative.subject_of_russia_view")}
                      value={rep.subjectOfRussia}
                    />
                    <Field label={t("common.district_placeholder")} value={rep.district} />
                    <Field label={t("common.city_placeholder")} value={rep.city} />
                    <Field label={t("common.street_placeholder")} value={rep.street} />
                    <Field label={t("common.house_placeholder")} value={rep.house} />
                    <Field label={t("common.apartment_placeholder")} value={rep.apartment} />
                    <Field label={t("legal_representative.state_view")} value={rep.state} />
                  </div>
                </div>
              ))}
              <button
                className="adp-add-link"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddInViewMode();
                }}
              >
                <FiPlus size={13} /> {t("legal_representative.add_representation")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

const GeneralInformationTab = ({ application, patient, onSave, saving, onSaved }) => {
  const { t } = useTranslation("appointment_details_general");
  const dob = formatDOB(patient?.dateOfBirth);
  const createdAt = formatDate(application?.createdAt);
  const recordNo =
    application?.applicationId || application?._id?.toString().slice(-6);
  const doctor = application?.doctors?.[0];
  const doctorName = doctor?.doctorName || t("common.unknown_doctor");

  const patientFullName = patient
    ? [patient.lastName, patient.firstName, patient.middleName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    patient.email ||
    t("common.unknown_patient")
    : application?.patientName || t("common.unknown_patient");

  /* refs for each section */
  const basicRef = useRef();
  const contactsRef = useRef();
  const documentsRef = useRef();
  const addressRef = useRef();
  const diseasesRef = useRef();
  const diagnosesRef = useRef();
  const personalRef = useRef();
  const disabilityRef = useRef();
  const anamnesisRef = useRef();
  const radiationRef = useRef();
  const legalRepRef = useRef();

  const [savingAction, setSavingAction] = useState(null); // 'save' | 'saveAndClose' | null

  const handleSaveAll = useCallback(async () => {
    if (!patient?.patientId) {
      toast.error(t("footer.patient_not_found"));
      return;
    }
    try {
      setSavingAction('save');
      const payload = {
        ...(basicRef.current?.getData() || {}),
        ...(contactsRef.current?.getData() || {}),
        ...(documentsRef.current?.getData() || {}),
        ...(addressRef.current?.getData() || {}),
        ...(personalRef.current?.getData() || {}),
        ...(disabilityRef.current?.getData() || {}),
        ...(anamnesisRef.current?.getData() || {}),
        diseases: diseasesRef.current?.getData() || [],
        finalDiagnoses: diagnosesRef.current?.getData() || [],
        radiationDoses: radiationRef.current?.getData() || [],
        legalRepresentatives: legalRepRef.current?.getData() || [],
      };
      const updated = await patchPatient(patient.patientId, payload);
      legalRepRef.current?.commitEdit?.();
      onSaved?.(updated);
      toast.success(t("footer.save_success"));
    } catch (err) {
      console.error("Save error:", err);
      toast.error(err?.response?.data?.error || t("footer.save_error"));
    } finally {
      setSavingAction(null);
    }
  }, [patient, onSaved]);

  const navigate = useNavigate();

  const handleSaveAndCompleted = useCallback(async () => {
    if (!patient?.patientId) {
      toast.error(t("footer.patient_not_found"));
      return;
    }
    try {
      setSavingAction('saveAndCompleted');
      const payload = {
        ...(basicRef.current?.getData() || {}),
        ...(contactsRef.current?.getData() || {}),
        ...(documentsRef.current?.getData() || {}),
        ...(addressRef.current?.getData() || {}),
        ...(personalRef.current?.getData() || {}),
        ...(disabilityRef.current?.getData() || {}),
        ...(anamnesisRef.current?.getData() || {}),
        diseases: diseasesRef.current?.getData() || [],
        finalDiagnoses: diagnosesRef.current?.getData() || [],
        radiationDoses: radiationRef.current?.getData() || [],
        legalRepresentatives: legalRepRef.current?.getData() || [],
      };
      const updated = await patchPatient(patient.patientId, payload);
      legalRepRef.current?.commitEdit?.();
      onSaved?.(updated);
      if (application?.applicationId) {
        await updateApplication(application.applicationId, { appointmentStatus: "Completed" });
      }
      toast.success(t("footer.save_success"));
      navigate(-1);
    } catch (err) {
      console.error("Save error:", err);
      toast.error(err?.response?.data?.error || t("footer.save_error"));
    } finally {
      setSavingAction(null);
    }
  }, [patient, application, navigate, onSaved]);

  return (
    <>
      <div className="adp-record-header">
        <span className="adp-record-title">
          {t("record_header.title")} <strong>{t("record_header.record_no")}{recordNo}</strong> {t("record_header.from")}{" "}
          {createdAt}
        </span>
      </div>

      <BasicDataSection
        ref={basicRef}
        patient={patient}
        application={application}
      />

      <LegalRepresentativeSection ref={legalRepRef} patient={patient} />

      <ContactsSection ref={contactsRef} patient={patient} />

      <DocumentsSection ref={documentsRef} patient={patient} />

      <AddressSection ref={addressRef} patient={patient} />

      <DiseasesSection ref={diseasesRef} patient={patient} />

      <FinalDiagnosisSection ref={diagnosesRef} patient={patient} />

      <PersonalDataSection ref={personalRef} patient={patient} />

      <DisabilitySection ref={disabilityRef} patient={patient} />

      <AnamnesisSection ref={anamnesisRef} patient={patient} />

      <RadiationDosesSection ref={radiationRef} patient={patient} />

      {/* Sticky footer */}
      <div className="adp-sticky-footer">
        <button
          className="adp-footer-btn adp-footer-save-btn"
          onClick={handleSaveAll}
          disabled={savingAction !== null}
        >
          {savingAction === 'save' ? t("footer.saving") : t("footer.save")}
        </button>
        <button
          className="adp-footer-btn adp-footer-save-close-btn"
          onClick={handleSaveAndCompleted}
          disabled={savingAction !== null}
        >
          {savingAction === 'saveAndCompleted' ? t("footer.saving") : t("footer.save_and_completed", { defaultValue: "Save and completed" })}
        </button>
      </div>
    </>
  );
};

export default GeneralInformationTab;
