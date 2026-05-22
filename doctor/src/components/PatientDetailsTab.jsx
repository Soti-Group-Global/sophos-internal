import React, { useState, useEffect, useRef, useMemo, useContext, createContext, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import DiseaseCodeSearch from "./DiseaseCodeSearch/DiseaseCodeSearch";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
  FiEdit2,
  FiX,
  FiPlus,
  FiTrash2,
  FiChevronDown,
  FiChevronUp,
  FiUser,
  FiPhone,
  FiFileText,
  FiMapPin,
  FiHeart,
  FiActivity,
  FiShield,
  FiBookOpen,
  FiAlertCircle,
  FiCalendar,
  FiCheck,
} from "react-icons/fi";
import {
  FaInstagram,
  FaFacebook,
  FaVk,
  FaOdnoklassniki,
  FaTelegram,
} from "react-icons/fa";
import "../styles/PatientDetailsPage.css";
import {
  updatePatientBasicData,
  updateContactPerson,
  updatePatientDocuments,
  updatePatientAddress,
  updatePatientDiseaseInfo,
  updatePatientFinalDiagnosis,
  updatePatientPersonalData,
  updatePatientDisability,
  updatePatientAnamnesis,
  updatePatientRadiationDoses,
  updateLegalRepresentative,
  createLegalRepresentative,
  getDoctors,
  getSpecialties,
} from "../utils/api";
import { formatDateISO } from "../utils/dateFormat";
import CustomCalendar from "../components/CustomeCalendar";

/* ═══════════════════════════════════════════════════════════════════════════
   GLOBAL SAVE REGISTRY
   All sections register their save handler here; the global footer triggers them.
  ═══════════════════════════════════════════════════════════════════════════ */
const SaveRegistryContext = createContext(null);

/** Call this inside any section to auto-register its save handler. */
function useRegisteredSave(sectionKey, editing, handleSave) {
  const ctx = useContext(SaveRegistryContext);
  const ref = useRef(handleSave);
  ref.current = handleSave; // always points to latest closure
  useEffect(() => {
    if (!editing || !ctx) return;
    ctx.register(sectionKey, () => ref.current());
    return () => ctx.unregister(sectionKey);
  }, [editing, sectionKey, ctx]);
}

/* ═══════════════════════════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════════════════════════ */
const formatDate = (d) => {
  if (!d) return "—";
  try {
    const iso = String(d).split("T")[0];
    const [y, mo, day] = iso.split("-").map(Number);
    if (!y || !mo || !day) return "—";
    return `${String(day).padStart(2, "0")}-${String(mo).padStart(2, "0")}-${y}`;
  } catch { return "—"; }
};

const toInputDate = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt)) return "";
  return dt.toISOString().slice(0, 10);
};

const emptyRow = (fields) => fields.reduce((o, f) => ({ ...o, [f]: "" }), {});

/* ═══════════════════════════════════════════════════════════════════════════
   REUSABLE COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

/** Collapsible section wrapper — matches GeneralInformationTab adp design */
function Section({ icon, title, children, defaultOpen = false, onEdit, editing, onCancel }) {
  const [open, setOpen] = useState(defaultOpen);

  // Auto-open the section body when editing starts (so the user
  // doesn't have to manually expand it first)
  useEffect(() => {
    if (editing) setOpen(true);
  }, [editing]);

  return (
    <div className="adp-section">
      <div className="adp-section-header" onClick={() => !editing && setOpen((p) => !p)}>
        <span className="adp-section-title">{title}</span>
        <div className="adp-section-header-right">
          {editing ? (
            <button
              className="adp-header-action-btn adp-header-cancel-btn"
              onClick={(e) => { e.stopPropagation(); onCancel?.(); }}
              title="Cancel"
            >
              <FiX size={15} />
            </button>
          ) : (
            onEdit && (
              <button
                className="adp-edit-btn"
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                title="Edit"
              >
                <FiEdit2 size={14} />
              </button>
            )
          )}
          <button
            className="adp-collapse-btn"
            onClick={(e) => { e.stopPropagation(); setOpen((p) => !p); }}
          >
            {open ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
          </button>
        </div>
      </div>
      {open && <div className="adp-section-body">{children}</div>}
    </div>
  );
}

/** Single read-only field */
function ReadField({ label, value, wide }) {
  return (
    <div className={`adp-field${wide ? " adp-field-full" : ""}`}>
      <span className="adp-field-label">{label}</span>
      <span className="adp-field-value">{value || "—"}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. BASIC DATA SECTION
   ═══════════════════════════════════════════════════════════════════════════ */
function BasicDataSection({ patient, onRefresh }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: "", middleName: "", lastName: "", dateOfBirth: "", gender: "", notes: "",
  });

  useEffect(() => {
    if (patient) {
      setForm({
        firstName: patient.firstName || "",
        middleName: patient.middleName || "",
        lastName: patient.lastName || "",
        dateOfBirth: toInputDate(patient.dateOfBirth),
        gender: patient.gender || "",
        notes: patient.notes || "",
      });
    }
  }, [patient]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!patient?._id) { toast.error(t("pdtab.common.patientIdNotFound")); return; }
    setSaving(true);
    try {
      await updatePatientBasicData(patient._id, form);
      // toast suppressed; handled by global notification
      setEditing(false);
      onRefresh?.();
    } catch { toast.error(t("pdtab.basic.saveFail")); }
    finally { setSaving(false); }
  };
  useRegisteredSave('basic', editing, handleSave);

  const genderLabel = (g) =>
    g === "Male" ? t("pdtab.gender.male") : g === "Female" ? t("pdtab.gender.female") : t("pdtab.gender.notSpecified");

  const patientFullName = patient
    ? [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(" ").trim() || "—"
    : "—";

  return (
    <Section
      icon={<FiUser size={18} />}
      title={t("pdtab.basic.title")}
      defaultOpen={true}
      onEdit={() => setEditing(true)}
      editing={editing}

      onCancel={() => setEditing(false)}

    >
      {!editing ? (
        <div className="adp-patient-card">
          <div className="adp-avatar-col">
            <div className="adp-avatar-circle">
              <FiUser size={28} />
            </div>
          </div>
          <div className="adp-patient-info-col">
            <h2 className="adp-patient-fullname">{patientFullName}</h2>
            <div className="adp-patient-meta-row">
              {patient?.dateOfBirth && (
                <span className="adp-meta-item">
                  <FiCalendar size={14} />
                  {formatDate(patient.dateOfBirth)}
                </span>
              )}
              {patient?.gender && (
                <span className="adp-meta-item">
                  <FiUser size={14} />
                  {genderLabel(patient.gender)}
                </span>
              )}
            </div>
            {patient?.notes && (
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
                {patient.notes}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="adp-basic-edit">
          <div className="adp-avatar-col">
            <div className="adp-avatar-circle">
              <FiUser size={28} />
            </div>
            <button className="adp-change-photo-btn">Change photo</button>
          </div>
          <div className="adp-basic-edit-fields">
            <div className="adp-name-inputs-row">
              <div className="adp-labeled-input adp-labeled-input--wide">
                <span className="adp-input-label">{t("pdtab.basic.lastName")}</span>
                <input
                  className="adp-text-input"
                  placeholder={t("pdtab.basic.lastNamePh")}
                  value={form.lastName}
                  onChange={(e) => set("lastName", e.target.value)}
                />
              </div>
              <div className="adp-labeled-input adp-labeled-input--wide">
                <span className="adp-input-label">{t("pdtab.basic.firstName")}</span>
                <input
                  className="adp-text-input"
                  placeholder={t("pdtab.basic.firstNamePh")}
                  value={form.firstName}
                  onChange={(e) => set("firstName", e.target.value)}
                />
              </div>
              <div className="adp-labeled-input adp-labeled-input--wide">
                <span className="adp-input-label">{t("pdtab.basic.middleName")}</span>
                <input
                  className="adp-text-input"
                  placeholder={t("pdtab.basic.middleNamePh")}
                  value={form.middleName}
                  onChange={(e) => set("middleName", e.target.value)}
                />
              </div>
            </div>
            <div className="adp-dob-gender-row">
              <div className="adp-labeled-input">
                <span className="adp-input-label">{t("pdtab.basic.dateOfBirth")}</span>
                <CustomCalendar
                  className="adp-text-input adp-dob-input"
                  value={form.dateOfBirth ? new Date(form.dateOfBirth) : null}
                  onChange={(date) => set("dateOfBirth", date ? date.toISOString().slice(0, 10) : "")}
                  dateFormat="dd-MM-yyyy"
                />
              </div>
              <div className="adp-labeled-input">
                <span className="adp-input-label">{t("pdtab.basic.genderLabel")}</span>
                <div className="adp-gender-toggle">
                  {["Not specified", "Male", "Female"].map((g) => (
                    <button
                      key={g}
                      type="button"
                      className={`adp-gender-toggle-btn${
                        (form.gender || "Not specified").toLowerCase() === g.toLowerCase() ? " active" : ""
                      }`}
                      onClick={() => set("gender", g === "Not specified" ? "" : g)}
                    >
                      {g === "Male" ? t("pdtab.gender.male") : g === "Female" ? t("pdtab.gender.female") : t("pdtab.gender.notSpecified")}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="adp-labeled-input">
              <span className="adp-input-label">{t("pdtab.basic.noteToPatient")}</span>
              <textarea
                className="adp-textarea adp-textarea--full"
                rows={4}
                placeholder={t("pdtab.basic.notesPh")}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. CONTACTS SECTION
   ═══════════════════════════════════════════════════════════════════════════ */
function ContactsSection({ patient, onRefresh }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const buildForm = (p) => ({
    phoneNumber: p?.phoneNumber || "",
    additionalPhone: p?.additionalPhone || "",
    maxId: p?.maxId || "",
    telegramNickname: p?.telegramNickname || "",
    telegramId: p?.telegramId || "",
    newsletter: !!p?.newsletter,
    egisz: !!p?.egisz,
    instagram: p?.instagram || "",
    vk: p?.vk || "",
    facebook: p?.facebook || "",
    ok: p?.ok || "",
    contactPerson: p?.contactPerson || "",
    contactPersonPhone: p?.contactPersonPhone || "",
  });

  const [form, setForm] = useState(buildForm(patient));
  useEffect(() => { setForm(buildForm(patient)); }, [patient]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!patient?._id) { toast.error(t("pdtab.common.patientIdNotFound")); return; }
    if (!form.phoneNumber.trim()) { toast.error(t("pdtab.contacts.phoneRequired")); return; }
    setSaving(true);
    try {
      await updateContactPerson(patient._id, form);
      // toast suppressed; handled by global notification
      setEditing(false);
      onRefresh?.();
    } catch { toast.error(t("pdtab.contacts.saveFail")); }
    finally { setSaving(false); }
  };
  useRegisteredSave('contacts', editing, handleSave);

  return (
    <Section
      icon={<FiPhone size={18} />}
      title={t("pdtab.contacts.title")}
      onEdit={() => setEditing(true)}
      editing={editing}

      onCancel={() => setEditing(false)}

    >
      {!editing ? (
        <div className="adp-contacts-form">
          {patient?.phoneNumber && (
            <div className="adp-contact-form-row">
              <span className="adp-contact-form-label">{t("pdtab.contacts.telephone")}</span>
              <span className="adp-contact-view-value">{patient.phoneNumber}</span>
            </div>
          )}
          {patient?.additionalPhone && (
            <div className="adp-contact-form-row">
              <span className="adp-contact-form-label">{t("pdtab.contacts.additionalPhone")}</span>
              <span className="adp-contact-view-value">{patient.additionalPhone}</span>
            </div>
          )}
          {patient?.maxId && (
            <div className="adp-contact-form-row">
              <span className="adp-contact-form-label">{t("pdtab.contacts.max")}</span>
              <span className="adp-contact-view-value">{patient.maxId}</span>
            </div>
          )}
          {(patient?.telegramNickname || patient?.telegramId) && (
            <div className="adp-contact-form-row">
              <span className="adp-contact-form-label">{t("pdtab.contacts.telegramNickname")}</span>
              <span className="adp-contact-view-value">
                {[patient?.telegramNickname, patient?.telegramId].filter(Boolean).join(" / ")}
              </span>
            </div>
          )}
          {patient?.email && (
            <div className="adp-contact-form-row">
              <span className="adp-contact-form-label">{t("pdtab.contacts.email")}</span>
              <span className="adp-contact-view-value">{patient.email}</span>
            </div>
          )}
          {[patient?.instagram, patient?.vk, patient?.facebook, patient?.ok].some(Boolean) && (
            <>
              {patient?.instagram && (
                <div className="adp-contact-form-row">
                  <span className="adp-contact-form-label adp-social-label">
                    <FaInstagram size={16} color="#E1306C" /> Instagram
                  </span>
                  <span className="adp-contact-view-value">{patient.instagram}</span>
                </div>
              )}
              {patient?.vk && (
                <div className="adp-contact-form-row">
                  <span className="adp-contact-form-label adp-social-label">
                    <FaVk size={16} color="#4680C2" /> VK
                  </span>
                  <span className="adp-contact-view-value">{patient.vk}</span>
                </div>
              )}
              {patient?.facebook && (
                <div className="adp-contact-form-row">
                  <span className="adp-contact-form-label adp-social-label">
                    <FaFacebook size={16} color="#1877F2" /> Facebook
                  </span>
                  <span className="adp-contact-view-value">{patient.facebook}</span>
                </div>
              )}
              {patient?.ok && (
                <div className="adp-contact-form-row">
                  <span className="adp-contact-form-label adp-social-label">
                    <FaOdnoklassniki size={16} color="#EF7F1A" /> OK
                  </span>
                  <span className="adp-contact-view-value">{patient.ok}</span>
                </div>
              )}
            </>
          )}
          {patient?.contactPerson && (
            <div className="adp-contact-form-row">
              <span className="adp-contact-form-label">{t("pdtab.contacts.contactPerson")}</span>
              <span className="adp-contact-view-value">
                {patient.contactPerson}{patient?.contactPersonPhone ? " · " + patient.contactPersonPhone : ""}
              </span>
            </div>
          )}
          {(patient?.newsletter || patient?.egisz) && (
            <div className="adp-contact-form-row adp-contact-checkboxes-row">
              <span className="adp-contact-form-label" />
              <div className="adp-contact-checkboxes">
                {patient?.newsletter && (
                  <label className="adp-newsletter-label">
                    <span className="adp-checkbox checked"><FiCheck size={11} /></span>
                    {t("pdtab.contacts.newsletter")}
                  </label>
                )}
                {patient?.egisz && (
                  <label className="adp-newsletter-label">
                    <span className="adp-checkbox checked"><FiCheck size={11} /></span>
                    {t("pdtab.contacts.egiszShort")}
                  </label>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="adp-contacts-form">
          <div className="adp-contact-form-row">
            <span className="adp-contact-form-label">{t("pdtab.contacts.telephone")} *</span>
            <input className="adp-text-input adp-contact-input" value={form.phoneNumber}
              onChange={(e) => set("phoneNumber", e.target.value)} />
          </div>
          <div className="adp-contact-form-row">
            <span className="adp-contact-form-label">{t("pdtab.contacts.additionalPhone")}</span>
            <input className="adp-text-input adp-contact-input" value={form.additionalPhone}
              onChange={(e) => set("additionalPhone", e.target.value)} />
          </div>
          <div className="adp-contact-form-row">
            <span className="adp-contact-form-label">{t("pdtab.contacts.max")}</span>
            <input className="adp-text-input adp-contact-input" value={form.maxId}
              onChange={(e) => set("maxId", e.target.value)} />
          </div>
          <div className="adp-contact-form-row">
            <span className="adp-contact-form-label">{t("pdtab.contacts.telegramNickname")}</span>
            <div className="adp-contact-input-pair">
              <input className="adp-text-input" value={form.telegramNickname}
                placeholder={t("pdtab.contacts.telegramNickname")}
                onChange={(e) => set("telegramNickname", e.target.value)} />
              <input className="adp-text-input" value={form.telegramId}
                placeholder={t("pdtab.contacts.telegramId")}
                onChange={(e) => set("telegramId", e.target.value)} />
            </div>
          </div>
          <div className="adp-contact-form-row adp-contact-form-row-top">
            <span className="adp-contact-form-label">{t("pdtab.contacts.socialNetworks")}</span>
            <div className="adp-social-grid">
              <div className="adp-social-item">
                <FaInstagram size={22} color="#E1306C" className="adp-social-icon-real" />
                <input className="adp-text-input adp-social-input" value={form.instagram}
                  placeholder="Instagram"
                  onChange={(e) => set("instagram", e.target.value)} />
              </div>
              <div className="adp-social-item">
                <FaVk size={22} color="#4680C2" className="adp-social-icon-real" />
                <input className="adp-text-input adp-social-input" value={form.vk}
                  placeholder="VK"
                  onChange={(e) => set("vk", e.target.value)} />
              </div>
              <div className="adp-social-item">
                <FaFacebook size={22} color="#1877F2" className="adp-social-icon-real" />
                <input className="adp-text-input adp-social-input" value={form.facebook}
                  placeholder="Facebook"
                  onChange={(e) => set("facebook", e.target.value)} />
              </div>
              <div className="adp-social-item">
                <FaOdnoklassniki size={22} color="#EF7F1A" className="adp-social-icon-real" />
                <input className="adp-text-input adp-social-input" value={form.ok}
                  placeholder="OK"
                  onChange={(e) => set("ok", e.target.value)} />
              </div>
            </div>
          </div>
          <div className="adp-contact-form-row">
            <span className="adp-contact-form-label">{t("pdtab.contacts.contactPerson")}</span>
            <div className="adp-contact-input-pair">
              <input className="adp-text-input" value={form.contactPerson}
                placeholder={t("pdtab.contacts.contactPerson")}
                onChange={(e) => set("contactPerson", e.target.value)} />
              <input className="adp-text-input" value={form.contactPersonPhone}
                placeholder={t("pdtab.contacts.contactPersonPhonePh")}
                onChange={(e) => set("contactPersonPhone", e.target.value)} />
            </div>
          </div>
          <div className="adp-contact-form-row adp-contact-checkboxes-row">
            <span className="adp-contact-form-label" />
            <div className="adp-contact-checkboxes">
              <label className="adp-newsletter-label" onClick={() => set("newsletter", !form.newsletter)}>
                <span className={`adp-checkbox${form.newsletter ? " checked" : ""}`}>
                  {form.newsletter && <FiCheck size={11} />}
                </span>
                {t("pdtab.contacts.newsletter")}
              </label>
              <label className="adp-newsletter-label" onClick={() => set("egisz", !form.egisz)}>
                <span className={`adp-checkbox${form.egisz ? " checked" : ""}`}>
                  {form.egisz && <FiCheck size={11} />}
                </span>
                {t("pdtab.contacts.egiszShort")}
              </label>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. DOCUMENTS SECTION
   ═══════════════════════════════════════════════════════════════════════════ */
function DocumentsSection({ patient, onRefresh }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const buildForm = (p) => ({
    cmip: p?.cmip || "",
    cmipDate: toInputDate(p?.cmipDate),
    cmipOrgCode: p?.cmipOrgCode || "",
    snils: p?.snils || "",
    medInsuranceOrg: p?.medInsuranceOrg || "",
    socialSupportCode: p?.socialSupportCode || "",
    citizenship: p?.citizenship || "",
    documentType: p?.documentType || "",
    documentSeries: p?.documentSeries || "",
    documentNumber: p?.documentNumber || "",
    documentIssuedDate: toInputDate(p?.documentIssuedDate),
    departmentCode: p?.departmentCode || "",
    documentIssuedBy: p?.documentIssuedBy || "",
    inn: p?.inn || "",
  });

  const [form, setForm] = useState(buildForm(patient));
  useEffect(() => { setForm(buildForm(patient)); }, [patient]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!patient?._id) { toast.error(t("pdtab.common.patientIdNotFound")); return; }
    setSaving(true);
    try {
      await updatePatientDocuments(patient._id, form);
      // toast suppressed; handled by global notification
      setEditing(false);
      onRefresh?.();
    } catch { toast.error(t("pdtab.docs.saveFail")); }
    finally { setSaving(false); }
  };
  useRegisteredSave('documents', editing, handleSave);

  const hasData = patient?.cmip || patient?.snils || patient?.documentNumber || patient?.inn;

  return (
    <Section
      icon={<FiFileText size={18} />}
      title={t("pdtab.docs.title")}
      onEdit={() => setEditing(true)}
      editing={editing}

      onCancel={() => setEditing(false)}

    >
      {!editing ? (
        hasData ? (
          <div className="adp-doc-form">
            <div className="adp-doc-subsection-label">{t("pdtab.docs.cmipSection")}</div>
            <div className="adp-basic-fields-grid">
              <ReadField label={t("pdtab.docs.policy")} value={patient?.cmip} />
              <ReadField label={t("pdtab.docs.dateOfIssue")} value={formatDate(patient?.cmipDate)} />
              <ReadField label={t("pdtab.docs.orgCode")} value={patient?.cmipOrgCode} />
              <ReadField label={t("pdtab.docs.snils")} value={patient?.snils} />
              <ReadField label={t("pdtab.docs.medInsOrg")} value={patient?.medInsuranceOrg} />
              <ReadField label={t("pdtab.docs.socialSupportCode")} value={patient?.socialSupportCode} />
            </div>
            <div className="adp-doc-subsection-label" style={{ marginTop: 16 }}>{t("pdtab.docs.identityCard")}</div>
            <div className="adp-basic-fields-grid">
              <ReadField label={t("pdtab.docs.citizenship")} value={patient?.citizenship} />
              <ReadField label={t("pdtab.docs.documentType")} value={patient?.documentType} />
              <ReadField label={t("pdtab.docs.series")} value={patient?.documentSeries} />
              <ReadField label={t("pdtab.docs.number")} value={patient?.documentNumber} />
              <ReadField label={t("pdtab.docs.whenIssued")} value={formatDate(patient?.documentIssuedDate)} />
              <ReadField label={t("pdtab.docs.departmentCode")} value={patient?.departmentCode} />
              <ReadField label={t("pdtab.docs.issuedBy")} value={patient?.documentIssuedBy} />
              <ReadField label={t("pdtab.docs.inn")} value={patient?.inn} />
            </div>
          </div>
        ) : (
          <p className="adp-empty-msg">{t("pdtab.docs.noData")}</p>
        )
      ) : (
        <div className="adp-doc-form">
          <div className="adp-doc-subsection-label">{t("pdtab.docs.cmipSection")}</div>
          <div className="adp-doc-row--3-1">
            <div className="adp-labeled-input">
              <span className="adp-input-label">{t("pdtab.docs.cmipLabel")}</span>
              <input className="adp-text-input" value={form.cmip} placeholder={t("pdtab.docs.cmipPh")}
                onChange={(e) => set("cmip", e.target.value)} />
            </div>
            <div className="adp-labeled-input">
              <span className="adp-input-label">{t("pdtab.docs.dateOfIssue")}</span>
              <CustomCalendar
                className="adp-text-input"
                value={form.cmipDate ? new Date(form.cmipDate) : null}
                onChange={(date) => set("cmipDate", date ? date.toISOString().slice(0, 10) : "")}
              />
            </div>
          </div>
          <div className="adp-doc-row--half">
            <div className="adp-labeled-input">
              <span className="adp-input-label">{t("pdtab.docs.orgCodeLabel")}</span>
              <input className="adp-text-input" value={form.cmipOrgCode} placeholder={t("pdtab.docs.orgCodePh")}
                onChange={(e) => set("cmipOrgCode", e.target.value)} />
            </div>
            <div className="adp-labeled-input">
              <span className="adp-input-label">{t("pdtab.docs.snils")}</span>
              <input className="adp-text-input" value={form.snils} placeholder={t("pdtab.docs.snilsPh")}
                onChange={(e) => set("snils", e.target.value)} />
            </div>
          </div>
          <div className="adp-doc-row--half">
            <div className="adp-labeled-input">
              <span className="adp-input-label">{t("pdtab.docs.medInsOrg")}</span>
              <input className="adp-text-input" value={form.medInsuranceOrg} placeholder={t("pdtab.docs.medInsOrgPh")}
                onChange={(e) => set("medInsuranceOrg", e.target.value)} />
            </div>
            <div className="adp-labeled-input">
              <span className="adp-input-label">{t("pdtab.docs.socialSupportCode")}</span>
              <input className="adp-text-input" value={form.socialSupportCode} placeholder={t("pdtab.docs.socialSupportCodePh")}
                onChange={(e) => set("socialSupportCode", e.target.value)} />
            </div>
          </div>
          <div className="adp-doc-subsection-label" style={{ marginTop: 8 }}>{t("pdtab.docs.identityCard")}</div>
          <div className="adp-doc-row--half">
            <div className="adp-labeled-input">
              <span className="adp-input-label">{t("pdtab.docs.citizenship")}</span>
              <select className="adp-text-input adp-select" value={form.citizenship}
                onChange={(e) => set("citizenship", e.target.value)}>
                <option value="">{t("pdtab.common.selectPlaceholder")}</option>
                <option value="Russian Federation">{t("pdtab.docs.citizenshipRF")}</option>
                <option value="Other">{t("pdtab.docs.citizenshipOther")}</option>
              </select>
            </div>
            <div className="adp-labeled-input">
              <span className="adp-input-label">{t("pdtab.docs.documentType")}</span>
              <select className="adp-text-input adp-select" value={form.documentType}
                onChange={(e) => set("documentType", e.target.value)}>
                <option value="">{t("pdtab.common.selectPlaceholder")}</option>
                <option value="Passport">{t("pdtab.docs.docTypePassport")}</option>
                <option value="Foreign Passport">{t("pdtab.docs.docTypeForeign")}</option>
                <option value="Birth Certificate">{t("pdtab.docs.docTypeBirth")}</option>
                <option value="Other">{t("pdtab.docs.docTypeOther")}</option>
              </select>
            </div>
          </div>
          <div className="adp-doc-row--half">
            <div className="adp-labeled-input">
              <span className="adp-input-label">{t("pdtab.docs.series")}</span>
              <input className="adp-text-input" value={form.documentSeries}
                onChange={(e) => set("documentSeries", e.target.value)} />
            </div>
            <div className="adp-labeled-input">
              <span className="adp-input-label">{t("pdtab.docs.number")}</span>
              <input className="adp-text-input" value={form.documentNumber}
                onChange={(e) => set("documentNumber", e.target.value)} />
            </div>
          </div>
          <div className="adp-doc-row--half">
            <div className="adp-labeled-input">
              <span className="adp-input-label">{t("pdtab.docs.whenIssued")}</span>
              <CustomCalendar
                className="adp-text-input"
                value={form.documentIssuedDate ? new Date(form.documentIssuedDate) : null}
                onChange={(date) => set("documentIssuedDate", date ? date.toISOString().slice(0, 10) : "")}
              />
            </div>
            <div className="adp-labeled-input">
              <span className="adp-input-label">{t("pdtab.docs.departmentCode")}</span>
              <input className="adp-text-input" value={form.departmentCode} placeholder={t("pdtab.docs.departmentCodePh")}
                onChange={(e) => set("departmentCode", e.target.value)} />
            </div>
          </div>
          <div className="adp-labeled-input">
            <span className="adp-input-label">{t("pdtab.docs.issuedBy")}</span>
            <input className="adp-text-input" value={form.documentIssuedBy} placeholder={t("pdtab.docs.issuedByPh")}
              onChange={(e) => set("documentIssuedBy", e.target.value)} />
          </div>
          <div className="adp-labeled-input">
            <span className="adp-input-label">{t("pdtab.docs.innLabel")}</span>
            <input className="adp-text-input" value={form.inn} placeholder={t("pdtab.docs.innPh")}
              onChange={(e) => set("inn", e.target.value)} />
          </div>
        </div>
      )}
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. ADDRESS SECTION
   ═══════════════════════════════════════════════════════════════════════════ */
function AddressSection({ patient, onRefresh }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const buildForm = (p) => ({
    region: p?.region || "",
    district: p?.district || "",
    city: p?.city || "",
    street: p?.street || "",
    house: p?.house || "",
    terrain: p?.terrain || "",
    apartment: p?.apartment || "",
    postcode: p?.postcode || "",
  });

  const [form, setForm] = useState(buildForm(patient));
  useEffect(() => { setForm(buildForm(patient)); }, [patient]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!patient?._id) { toast.error(t("pdtab.common.patientIdNotFound")); return; }
    setSaving(true);
    try {
      await updatePatientAddress(patient._id, form);
      // toast suppressed; handled by global notification
      setEditing(false);
      onRefresh?.();
    } catch { toast.error(t("pdtab.address.saveFail")); }
    finally { setSaving(false); }
  };
  useRegisteredSave('address', editing, handleSave);

  const hasData = patient?.city || patient?.street || patient?.region;

  return (
    <Section
      icon={<FiMapPin size={18} />}
      title={t("pdtab.address.title")}
      onEdit={() => setEditing(true)}
      editing={editing}

      onCancel={() => setEditing(false)}

    >
      {!editing ? (
        hasData ? (
          <div className="adp-basic-fields-grid">
            <ReadField label={t("pdtab.address.regionView")} value={patient?.region} />
            <ReadField label={t("pdtab.address.district")} value={patient?.district} />
            <ReadField label={t("pdtab.address.city")} value={patient?.city} />
            <ReadField label={t("pdtab.address.street")} value={patient?.street} />
            <ReadField label={t("pdtab.address.house")} value={patient?.house} />
            <ReadField label={t("pdtab.address.terrain")} value={patient?.terrain} />
            <ReadField label={t("pdtab.address.apartmentView")} value={patient?.apartment} />
            <ReadField label={t("pdtab.address.indexPostcode")} value={patient?.postcode} />
          </div>
        ) : (
          <p className="adp-empty-msg">{t("pdtab.address.noData")}</p>
        )
      ) : (
        <div className="adp-addr-form">
          <div className="adp-addr-group">
            <div className="adp-addr-group-title">
              <span className="adp-addr-num">1</span>
              {t("pdtab.address.group01")}
            </div>
            <div className="adp-doc-row--half">
              <div className="adp-labeled-input">
                <span className="adp-input-label">{t("pdtab.address.region")}</span>
                <input className="adp-text-input" value={form.region} placeholder={t("pdtab.address.regionPh")}
                  onChange={(e) => set("region", e.target.value)} />
              </div>
            </div>
            <div className="adp-doc-row--half">
              <div className="adp-labeled-input">
                <span className="adp-input-label">{t("pdtab.address.district")}</span>
                <input className="adp-text-input" value={form.district} placeholder={t("pdtab.address.districtPh")}
                  onChange={(e) => set("district", e.target.value)} />
              </div>
              <div className="adp-labeled-input">
                <span className="adp-input-label">{t("pdtab.address.city")}</span>
                <input className="adp-text-input" value={form.city} placeholder={t("pdtab.address.cityPh")}
                  onChange={(e) => set("city", e.target.value)} />
              </div>
            </div>
          </div>
          <div className="adp-addr-group">
            <div className="adp-addr-group-title">
              <span className="adp-addr-num">2</span>
              {t("pdtab.address.group02")}
            </div>
            <div className="adp-doc-row--half">
              <div className="adp-labeled-input">
                <span className="adp-input-label">{t("pdtab.address.street")}</span>
                <input className="adp-text-input" value={form.street} placeholder={t("pdtab.address.streetPh")}
                  onChange={(e) => set("street", e.target.value)} />
              </div>
              <div className="adp-labeled-input">
                <span className="adp-input-label">{t("pdtab.address.houseNumber")}</span>
                <input className="adp-text-input" value={form.house} placeholder={t("pdtab.address.housePh")}
                  onChange={(e) => set("house", e.target.value)} />
              </div>
            </div>
            <div className="adp-doc-row--half">
              <div className="adp-labeled-input">
                <span className="adp-input-label">{t("pdtab.address.terrainType")}</span>
                <select className="adp-text-input adp-select" value={form.terrain}
                  onChange={(e) => set("terrain", e.target.value)}>
                  <option value="">{t("pdtab.common.selectPlaceholder")}</option>
                  <option value="Urban">{t("pdtab.address.terrainUrban")}</option>
                  <option value="Rural">{t("pdtab.address.terrainRural")}</option>
                </select>
              </div>
              <div className="adp-labeled-input">
                <span className="adp-input-label">{t("pdtab.address.apartment")}</span>
                <input className="adp-text-input" value={form.apartment} placeholder={t("pdtab.address.apartmentPh")}
                  onChange={(e) => set("apartment", e.target.value)} />
              </div>
            </div>
            <div className="adp-labeled-input">
              <span className="adp-input-label">{t("pdtab.address.indexPostcode")}</span>
              <input className="adp-text-input" value={form.postcode} placeholder={t("pdtab.address.indexPh")}
                onChange={(e) => set("postcode", e.target.value)} />
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. DISEASES SECTION (array)
   ═══════════════════════════════════════════════════════════════════════════ */
const DISEASE_FIELDS = ["startDate", "endDate", "diagnosis", "icdCode", "doctor"];

function DiseasesSection({ patient, onRefresh }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);

  // dropdown support for doctor field
  const [doctorOptions, setDoctorOptions] = useState([]);
  const doctorRefs = useRef([]);
  const [openDropdown, setOpenDropdown] = useState(null); // { row, ref }
  const [dropdownStyle, setDropdownStyle] = useState({});

  // load doctors list once
  useEffect(() => {
    const loadDoctors = async () => {
      try {
        const docResp = await getDoctors();
        const docArray = Array.isArray(docResp) ? docResp : (docResp?.doctors || []);
        const docNames = docArray
          .map((d) => {
            const first = d.firstName?.en || d.firstName || "";
            const last = d.lastName?.en || d.lastName || "";
            return `${first} ${last}`.trim();
          })
          .filter(Boolean);
        setDoctorOptions(docNames);
      } catch (err) {
        console.error("[DiseasesSection] Failed to fetch doctors:", err);
      }
    };
    loadDoctors();
  }, []);

  // helpers for dropdown filtering/navigation
  const getFilteredOptions = (currentValue) => {
    if (!currentValue) return doctorOptions;
    return doctorOptions.filter((name) =>
      name.toLowerCase().includes(currentValue.toLowerCase())
    );
  };

  const moveHighlight = (delta) => {
    setOpenDropdown((prev) => {
      if (!prev) return prev;
      const currentVal = rows[prev.row].doctor;
      const filtered = getFilteredOptions(currentVal);
      if (filtered.length === 0) return prev;
      let idx = (prev.highlightIndex || 0) + delta;
      if (idx < 0) idx = filtered.length - 1;
      if (idx >= filtered.length) idx = 0;
      return { ...prev, highlightIndex: idx };
    });
  };

  const chooseHighlighted = () => {
    if (!openDropdown) return;
    const { row, highlightIndex } = openDropdown;
    const currentVal = rows[row].doctor;
    const filtered = getFilteredOptions(currentVal);
    const name = filtered[highlightIndex] || filtered[0];
    if (name) {
      updateRow(row, "doctor", name);
    }
    setOpenDropdown(null);
  };

  useEffect(() => {
    const handler = (e) => {
      if (!openDropdown) return;
      if (e.key === "ArrowDown") { e.preventDefault(); moveHighlight(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); moveHighlight(-1); }
      else if (e.key === "Enter") { e.preventDefault(); chooseHighlighted(); }
      else if (e.key === "Escape") { setOpenDropdown(null); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [openDropdown, rows]);

  const openList = (row, ref) => {
    setOpenDropdown((prev) => {
      if (
        prev &&
        prev.row === row &&
        prev.ref?.current === ref?.current
      ) {
        // toggle off when clicking same control again (including icon)
        return null;
      }
      return { row, ref, highlightIndex: 0 };
    });
  };

  // when openDropdown changes update coordinates for the floating list
  useEffect(() => {
    if (openDropdown?.ref?.current) {
      const rect = openDropdown.ref.current.getBoundingClientRect();
      setDropdownStyle({
        position: "fixed",
        top: rect.bottom + window.scrollY + 2,
        left: rect.left + window.scrollX,
        width: rect.width,
        zIndex: 9999,
      });
    }
  }, [openDropdown]);

  // close on outside click/scroll
  useEffect(() => {
    const clickHandler = (e) => {
      if (!e.target.closest(".adp-combobox-wrapper")) {
        setOpenDropdown(null);
      }
    };
    const scrollHandler = () => {
      setOpenDropdown(null);
    };
    document.addEventListener("mousedown", clickHandler);
    window.addEventListener("scroll", scrollHandler, true);
    return () => {
      document.removeEventListener("mousedown", clickHandler);
      window.removeEventListener("scroll", scrollHandler, true);
    };
  }, []);

  useEffect(() => {
    if (patient?.diseases?.length) {
      setRows(patient.diseases.map((d) => ({
        _id: d._id || "",
        startDate: toInputDate(d.startDate),
        endDate: toInputDate(d.endDate),
        diagnosis: d.diagnosis || "",
        icdCode: d.icdCode || "",
        doctor: d.doctor || "",
      })));
    } else {
      setRows([]);
    }
  }, [patient]);

  const updateRow = (i, k, v) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)));
  const addRow = () => setRows((r) => [...r, emptyRow(DISEASE_FIELDS)]);
  const removeRow = (i) => setRows((r) => r.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!patient?._id) { toast.error(t("pdtab.common.patientIdNotFound")); return; }
    setSaving(true);
    try {
      await updatePatientDiseaseInfo(patient._id, { diseases: rows });
      // toast suppressed; handled by global notification
      setEditing(false);
      onRefresh?.();
    } catch { toast.error(t("pdtab.diseases.saveFail")); }
    finally { setSaving(false); }
  };
  useRegisteredSave('diseases', editing, handleSave);

  return (
    <Section
      icon={<FiHeart size={18} />}
      title={t("pdtab.diseases.title")}
      onEdit={() => setEditing(true)}
      editing={editing}

      onCancel={() => setEditing(false)}

    >
      {!editing ? (
        patient?.diseases?.length ? (
          <div className="adp-table-wrapper">
            <table className="adp-data-table">
              <thead>
                <tr>
                  <th>{t("pdtab.diseases.obsStart")}</th>
                  <th>{t("pdtab.diseases.obsEnd")}</th>
                  <th>{t("pdtab.diseases.diagnosis")}</th>
                  <th>{t("pdtab.diseases.icdCode")}</th>
                  <th>{t("pdtab.diseases.doctor")}</th>
                </tr>
              </thead>
              <tbody>
                {patient.diseases.map((d, i) => (
                  <tr key={d._id || i}>
                    <td>{formatDate(d.startDate)}</td>
                    <td>{formatDate(d.endDate)}</td>
                    <td>{d.diagnosis || "—"}</td>
                    <td>{d.icdCode || "—"}</td>
                    <td>{d.doctor || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="adp-empty-msg">{t("pdtab.common.noRecords")}</p>
        )
      ) : (
        <div className="adp-array-edit">
          {rows.map((row, i) => (
            <div key={i} className="adp-rep-edit-card">
              <div className="adp-rep-edit-card-header">
                <span className="adp-rep-edit-label">
                  {t("pdtab.diseases.addDisease")} #{i + 1}
                </span>
                <button className="adp-remove-rep-btn" onClick={() => removeRow(i)}>
                  <FiTrash2 size={13} /> {t("pdtab.common.remove")}
                </button>
              </div>
              <div className="adp-doc-row--half">
                <div className="adp-labeled-input">
                  <span className="adp-input-label">{t("pdtab.diseases.obsStart")}</span>
                  <CustomCalendar
                    className="adp-text-input"
                    value={row.startDate ? new Date(row.startDate) : null}
                    onChange={(date) => updateRow(i, "startDate", date ? date.toISOString().slice(0, 10) : "")}
                  />
                </div>
                <div className="adp-labeled-input">
                  <span className="adp-input-label">{t("pdtab.diseases.obsEnd")}</span>
                  <CustomCalendar
                    className="adp-text-input"
                    value={row.endDate ? new Date(row.endDate) : null}
                    onChange={(date) => updateRow(i, "endDate", date ? date.toISOString().slice(0, 10) : "")}
                  />
                </div>
              </div>
              <div className="adp-doc-row--half">
                <div className="adp-labeled-input">
                  <span className="adp-input-label">{t("pdtab.diseases.diagnosis")}</span>
                  <DiseaseCodeSearch
                    displayMode="name"
                    placeholder={t("pdtab.diseases.diagnosis")}
                    value={row.diagnosis}
                    onChange={(val) => updateRow(i, "diagnosis", val)}
                    onSelect={({ code, name }) => {
                      updateRow(i, "diagnosis", name);
                      updateRow(i, "icdCode", code);
                    }}
                  />
                </div>
                <div className="adp-labeled-input">
                  <span className="adp-input-label">{t("pdtab.diseases.icdCode")}</span>
                  <DiseaseCodeSearch
                    value={row.icdCode}
                    displayMode="code"
                    placeholder={t("pdtab.diseases.icdCodePh")}
                    onChange={(val) => updateRow(i, "icdCode", val)}
                    onSelect={({ code, name }) => {
                      updateRow(i, "icdCode", code);
                      updateRow(i, "diagnosis", name);
                    }}
                  />
                </div>
              </div>
              <div className="adp-labeled-input adp-combobox-wrapper" style={{ position: "relative" }}>
                <span className="adp-input-label">{t("pdtab.diseases.doctor")}</span>
                <input
                  ref={(el) => (doctorRefs.current[i] = el)}
                  className="adp-text-input adp-combobox-input"
                  style={{ paddingRight: "32px" }}
                  value={row.doctor}
                  placeholder={t("pdtab.diseases.doctorPh") || ""}
                  onChange={(e) => updateRow(i, "doctor", e.target.value)}
                  onFocus={() => openList(i, { current: doctorRefs.current[i] })}
                />
                <FiChevronDown
                  size={16}
                  style={{ position: "absolute", right: 8, top: 28, cursor: "pointer" }}
                  onClick={() => openList(i, { current: doctorRefs.current[i] })}
                />
                {openDropdown?.row === i && (
                  <ul className="adp-dropdown-list" style={dropdownStyle}>
                    {getFilteredOptions(row.doctor).map((name, idx) => (
                      <li
                        key={name}
                        className={
                          "adp-dropdown-item" +
                          (openDropdown?.highlightIndex === idx ? " highlighted" : "")
                        }
                        onMouseDown={() => {
                          updateRow(i, "doctor", name);
                          setOpenDropdown(null);
                        }}
                      >
                        {name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
          <button className="adp-add-link" onClick={addRow}>
            <FiPlus size={14} /> {t("pdtab.diseases.addDisease")}
          </button>
        </div>
      )}
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. FINAL DIAGNOSIS SECTION (array)
   ═══════════════════════════════════════════════════════════════════════════ */
const FINAL_DIAG_FIELDS = ["date", "diagnosis", "icdCode", "primary", "doctorName", "speciality"];

function FinalDiagnosisSection({ patient, onRefresh }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);

  const [doctorOptions, setDoctorOptions] = useState([]); // names for dropdown
  const [specialtyOptions, setSpecialtyOptions] = useState([]);
  const doctorRefs = useRef([]);
  const specialtyRefs = useRef([]);
  const [openDropdown, setOpenDropdown] = useState(null); // { type: "doctor"|"specialty", row: index, ref, highlightIndex }
  const [dropdownStyle, setDropdownStyle] = useState({});

  // when the openDropdown state changes, update the floating list coordinates
  useEffect(() => {
    if (openDropdown?.ref?.current) {
      const rect = openDropdown.ref.current.getBoundingClientRect();
      setDropdownStyle({
        position: "fixed",
        top: rect.bottom + window.scrollY + 2,
        left: rect.left + window.scrollX,
        width: rect.width,
        zIndex: 10000,
      });
    }
  }, [openDropdown]);

  // keyboard navigation for dropdown
  const getFilteredOptions = (type, currentValue) => {
    const opts = type === "doctor" ? doctorOptions : specialtyOptions;
    if (!currentValue) return opts;
    return opts.filter((name) => name.toLowerCase().includes(currentValue.toLowerCase()));
  };

  const moveHighlight = (delta) => {
    setOpenDropdown((prev) => {
      if (!prev) return prev;
      const currentVal = prev.type === "doctor" ? rows[prev.row].doctorName : rows[prev.row].speciality;
      const filtered = getFilteredOptions(prev.type, currentVal);
      if (filtered.length === 0) return prev;
      let idx = (prev.highlightIndex || 0) + delta;
      if (idx < 0) idx = filtered.length - 1;
      if (idx >= filtered.length) idx = 0;
      return { ...prev, highlightIndex: idx };
    });
  };

  const chooseHighlighted = () => {
    if (!openDropdown) return;
    const { type, row, highlightIndex } = openDropdown;
    const currentVal = type === "doctor" ? rows[row].doctorName : rows[row].speciality;
    const filtered = getFilteredOptions(type, currentVal);
    const name = filtered[highlightIndex] || filtered[0];
    if (name) {
      updateRow(row, type === "doctor" ? "doctorName" : "speciality", name);
    }
    setOpenDropdown(null);
  };

  useEffect(() => {
    const handler = (e) => {
      if (!openDropdown) return;
      if (e.key === "ArrowDown") { e.preventDefault(); moveHighlight(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); moveHighlight(-1); }
      else if (e.key === "Enter") { e.preventDefault(); chooseHighlighted(); }
      else if (e.key === "Escape") { setOpenDropdown(null); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [openDropdown, rows]);

  const openList = (type, row, ref) => {
    setOpenDropdown((prev) => {
      if (
        prev &&
        prev.type === type &&
        prev.row === row &&
        prev.ref?.current === ref?.current
      ) {
        // toggle off when clicking same control again (icon or input)
        return null;
      }
      return { type, row, ref, highlightIndex: 0 };
    });
  };

  // Close custom dropdown when clicking outside or scrolling
  useEffect(() => {
    const clickHandler = (e) => {
      if (!e.target.closest(".adp-combobox-wrapper")) {
        setOpenDropdown(null);
      }
    };
    const scrollHandler = () => {
      setOpenDropdown(null);
    };
    document.addEventListener("mousedown", clickHandler);
    window.addEventListener("scroll", scrollHandler, true);
    return () => {
      document.removeEventListener("mousedown", clickHandler);
      window.removeEventListener("scroll", scrollHandler, true);
    };
  }, []);

  // load doctor + specialty lists once
  useEffect(() => {
    const loadLists = async () => {
      try {
        const docResp = await getDoctors();
        const docArray = Array.isArray(docResp) ? docResp : (docResp?.doctors || []);
        const docNames = docArray.map((d) => {
          const first = d.firstName?.en || d.firstName || "";
          const last = d.lastName?.en || d.lastName || "";
          return `${first} ${last}`.trim();
        }).filter(Boolean);
        setDoctorOptions(docNames);
      } catch (err) {
        console.error("[DEBUG] Failed to fetch doctors:", err);
      }
      try {
        const specResp = await getSpecialties();
        const specArray = Array.isArray(specResp) ? specResp : (specResp?.specialties || specResp?.data || []);
        const specNames = specArray.map((s) => s.name).filter(Boolean);
        setSpecialtyOptions(specNames);
      } catch (err) {
        console.error("[DEBUG] Failed to fetch specialties:", err);
      }
    };
    loadLists();
  }, []);

  useEffect(() => {
    if (patient?.finalDiagnoses?.length) {
      setRows(patient.finalDiagnoses.map((d) => ({
        _id: d._id || "",
        date: toInputDate(d.date),
        diagnosis: d.diagnosis || "",
        icdCode: d.icdCode || "",
        primary: d.primary || "1",
        doctorName: d.doctorName || "",
        speciality: d.speciality || "",
      })));
    } else {
      setRows([]);
    }
  }, [patient]);

  const updateRow = (i, k, v) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)));
  const addRow = () => setRows((r) => [...r, { ...emptyRow(FINAL_DIAG_FIELDS), primary: "1" }]);
  const removeRow = (i) => setRows((r) => r.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!patient?._id) { toast.error(t("pdtab.common.patientIdNotFound")); return; }
    setSaving(true);
    try {
      // Strip empty _id from new rows so Mongoose auto-generates proper ObjectIds
      const toSave = rows.map(({ _id, ...rest }) => (_id ? { _id, ...rest } : rest));
      await updatePatientFinalDiagnosis(patient._id, { finalDiagnoses: toSave });
      // toast suppressed; handled by global notification
      setEditing(false);
      onRefresh?.();
    } catch { toast.error(t("pdtab.finalDiag.saveFail")); }
    finally { setSaving(false); }
  };
  useRegisteredSave('finalDiag', editing, handleSave);

  return (
    <Section
      icon={<FiActivity size={18} />}
      title={t("pdtab.finalDiag.title")}
      onEdit={() => setEditing(true)}
      editing={editing}

      onCancel={() => setEditing(false)}

    >
      {!editing ? (
        patient?.finalDiagnoses?.length ? (
          <div className="adp-table-wrapper">
            <table className="adp-data-table">
              <thead>
                <tr>
                  <th>{t("pdtab.finalDiag.date")}</th>
                  <th>{t("pdtab.finalDiag.finalDiagnosis")}</th>
                  <th>{t("pdtab.finalDiag.icdCode")}</th>
                  <th>{t("pdtab.finalDiag.type")}</th>
                  <th>{t("pdtab.finalDiag.doctorName")}</th>
                  <th>{t("pdtab.finalDiag.speciality")}</th>
                </tr>
              </thead>
              <tbody>
                {patient.finalDiagnoses.map((d, i) => (
                  <tr key={d._id || i}>
                    <td>{formatDate(d.date)}</td>
                    <td>{d.diagnosis || "—"}</td>
                    <td>{d.icdCode || "—"}</td>
                    <td>{d.primary === "1" ? "Primary" : "Secondary"}</td>
                    <td>{d.doctorName || "—"}</td>
                    <td>{d.speciality || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="adp-empty-msg">{t("pdtab.common.noRecords")}</p>
        )
      ) : (
        <div className="adp-array-edit">
          {rows.map((row, i) => (
            <div key={i} className="adp-rep-edit-card">
              <div className="adp-rep-edit-card__header">
                <span className="adp-rep-edit-card__title">
                  {t("pdtab.finalDiag.addDiagnosis")} #{i + 1}
                </span>
                <button className="adp-remove-rep-btn" onClick={() => removeRow(i)}>
                  <FiTrash2 size={13} /> {t("pdtab.common.remove")}
                </button>
              </div>
              <div className="adp-doc-row--half">
                <div className="adp-labeled-input">
                  <span className="adp-input-label">{t("pdtab.finalDiag.date")}</span>
                  <CustomCalendar
                    className="adp-text-input"
                    value={row.date ? new Date(row.date) : null}
                    onChange={(date) => updateRow(i, "date", date ? date.toISOString().slice(0, 10) : "")}
                  />
                </div>
                <div className="adp-labeled-input">
                  <span className="adp-input-label">{t("pdtab.finalDiag.icdCode")}</span>
                  <DiseaseCodeSearch
                    value={row.icdCode}
                    displayMode="code"
                    placeholder={t("pdtab.finalDiag.icdPh")}
                    onChange={(val) => updateRow(i, "icdCode", val)}
                    onSelect={({ code, name }) => {
                      updateRow(i, "icdCode", code);
                      updateRow(i, "diagnosis", name);
                    }}
                  />
                </div>
              </div>
              <div className="adp-labeled-input">
                <span className="adp-input-label">{t("pdtab.finalDiag.finalDiagnosis")}</span>
                <DiseaseCodeSearch
                  displayMode="name"
                  placeholder={t("pdtab.finalDiag.finalDiagnosis")}
                  value={row.diagnosis}
                  onChange={(val) => updateRow(i, "diagnosis", val)}
                  onSelect={({ code, name }) => {
                    updateRow(i, "diagnosis", name);
                    updateRow(i, "icdCode", code);
                  }}
                />
              </div>
              <div className="adp-doc-row--half">
                <div className="adp-labeled-input">
                  <span className="adp-input-label">{t("pdtab.finalDiag.type")}</span>
                  <select className="adp-text-input adp-select" value={row.primary}
                    onChange={(e) => updateRow(i, "primary", e.target.value)}>
                    <option value="1">Primary</option>
                    <option value="2">Secondary</option>
                  </select>
                </div>
                <div className="adp-labeled-input adp-combobox-wrapper" style={{ position: "relative" }}>
                  <span className="adp-input-label">{t("pdtab.finalDiag.speciality")}</span>
                  <input
                    ref={(el) => (specialtyRefs.current[i] = el)}
                    className="adp-text-input adp-combobox-input"
                    style={{ paddingRight: "32px" }}
                    value={row.speciality}
                    placeholder={t("pdtab.finalDiag.specialityPh")}
                    onChange={(e) => {
                      updateRow(i, "speciality", e.target.value);
                      openList("specialty", i, { current: specialtyRefs.current[i] });
                    }}
                    onFocus={() => openList("specialty", i, { current: specialtyRefs.current[i] })}
                  />
                  <FiChevronDown
                    size={16}
                    style={{ position: "absolute", right: 8, top: 28, cursor: "pointer" }}
                    onClick={() => openList("specialty", i, { current: specialtyRefs.current[i] })}
                  />
                  {openDropdown?.type === "specialty" && openDropdown?.row === i && (
                    <ul className="adp-dropdown-list" style={dropdownStyle}>
                      {specialtyOptions
                        .filter((name) => !row.speciality || name.toLowerCase().includes(row.speciality.toLowerCase()))
                        .map((name, idx) => (
                          <li
                            key={name}
                            className={"adp-dropdown-item" + (openDropdown?.highlightIndex === idx ? " highlighted" : "")}
                            onMouseDown={() => { updateRow(i, "speciality", name); setOpenDropdown(null); }}
                          >
                            {name}
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className="adp-doc-row--half">
                <div className="adp-labeled-input adp-combobox-wrapper" style={{ position: "relative" }}>
                  <span className="adp-input-label">{t("pdtab.finalDiag.doctorName")}</span>
                  <input
                    ref={(el) => (doctorRefs.current[i] = el)}
                    className="adp-text-input adp-combobox-input"
                    style={{ paddingRight: "32px" }}
                    value={row.doctorName}
                    placeholder={t("pdtab.finalDiag.fullNamePh")}
                    onChange={(e) => {
                      updateRow(i, "doctorName", e.target.value);
                      openList("doctor", i, { current: doctorRefs.current[i] });
                    }}
                    onFocus={() => openList("doctor", i, { current: doctorRefs.current[i] })}
                  />
                  <FiChevronDown
                    size={16}
                    style={{ position: "absolute", right: 8, top: 28, cursor: "pointer" }}
                    onClick={() =>
                      openList("doctor", i, { current: doctorRefs.current[i] })
                    }
                  />
                  {openDropdown?.type === "doctor" && openDropdown?.row === i && (
                    <ul className="adp-dropdown-list" style={dropdownStyle}>
                      {doctorOptions
                        .filter((name) => !row.doctorName || name.toLowerCase().includes(row.doctorName.toLowerCase()))
                        .map((name, idx) => (
                          <li
                            key={name}
                            className={"adp-dropdown-item" + (openDropdown?.highlightIndex === idx ? " highlighted" : "")}
                            onMouseDown={() => { updateRow(i, "doctorName", name); setOpenDropdown(null); }}
                          >
                            {name}
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
                
              </div>
            </div>
          ))}

          <button className="adp-add-link" onClick={addRow}>
            <FiPlus size={14} /> {t("pdtab.finalDiag.addDiagnosis")}
          </button>
        </div>
      )}
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. PERSONAL DATA SECTION
   ═══════════════════════════════════════════════════════════════════════════ */
function PersonalDataSection({ patient, onRefresh }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const buildForm = (p) => ({
    maritalStatus: p?.maritalStatus || "",
    education: p?.education || "",
    employment: p?.employment || "",
    placeOfWork: p?.placeOfWork || "",
    workSpecialty: p?.workSpecialty || "",
  });

  const [form, setForm] = useState(buildForm(patient));
  useEffect(() => { setForm(buildForm(patient)); }, [patient]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!patient?._id) { toast.error(t("pdtab.common.patientIdNotFound")); return; }
    setSaving(true);
    try {
      await updatePatientPersonalData(patient._id, form);
      // toast suppressed; handled by global notification
      setEditing(false);
      onRefresh?.();
    } catch { toast.error(t("pdtab.personal.saveFail")); }
    finally { setSaving(false); }
  };
  useRegisteredSave('personal', editing, handleSave);

  const hasData = patient?.maritalStatus || patient?.education || patient?.employment;

  const maritalOpts = [
    { value: "Single", label: t("pdtab.personal.maritalOpts.single") },
    { value: "Married", label: t("pdtab.personal.maritalOpts.married") },
    { value: "Divorced", label: t("pdtab.personal.maritalOpts.divorced") },
    { value: "Widowed", label: t("pdtab.personal.maritalOpts.widowed") },
    { value: "Civil marriage", label: t("pdtab.personal.maritalOpts.civil") },
  ];

  const educationOpts = [
    { value: "Secondary", label: t("pdtab.personal.educationOpts.secondary") },
    { value: "Secondary vocational", label: t("pdtab.personal.educationOpts.secondaryVoc") },
    { value: "Incomplete higher", label: t("pdtab.personal.educationOpts.incompleteHigher") },
    { value: "Higher", label: t("pdtab.personal.educationOpts.higher") },
    { value: "Postgraduate", label: t("pdtab.personal.educationOpts.postgraduate") },
  ];

  const employmentOpts = [
    { value: "Employed", label: t("pdtab.personal.employmentOpts.employed") },
    { value: "Unemployed", label: t("pdtab.personal.employmentOpts.unemployed") },
    { value: "Student", label: t("pdtab.personal.employmentOpts.student") },
    { value: "Retired", label: t("pdtab.personal.employmentOpts.retired") },
    { value: "Disabled", label: t("pdtab.personal.employmentOpts.disabled") },
  ];

  return (
    <Section
      icon={<FiUser size={18} />}
      title={t("pdtab.personal.title")}
      onEdit={() => setEditing(true)}
      editing={editing}

      onCancel={() => setEditing(false)}

    >
      {!editing ? (
        hasData ? (
          <div className="adp-basic-fields-grid">
            <ReadField label={t("pdtab.personal.maritalStatus")} value={patient?.maritalStatus} />
            <ReadField label={t("pdtab.personal.education")} value={patient?.education} />
            <ReadField label={t("pdtab.personal.employment")} value={patient?.employment} />
            <ReadField label={t("pdtab.personal.placeOfWork")} value={patient?.placeOfWork} />
          </div>
        ) : (
          <p className="adp-empty-msg">{t("pdtab.personal.noData")}</p>
        )
      ) : (
        <div className="adp-doc-form">
          <div className="adp-doc-row--half">
            <div className="adp-labeled-input">
              <span className="adp-input-label">{t("pdtab.personal.maritalStatus")}</span>
              <select className="adp-text-input adp-select" value={form.maritalStatus}
                onChange={(e) => set("maritalStatus", e.target.value)}>
                <option value="">{t("pdtab.common.selectPlaceholder")}</option>
                {maritalOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="adp-labeled-input">
              <span className="adp-input-label">{t("pdtab.personal.education")}</span>
              <select className="adp-text-input adp-select" value={form.education}
                onChange={(e) => set("education", e.target.value)}>
                <option value="">{t("pdtab.common.selectPlaceholder")}</option>
                {educationOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="adp-doc-row--half">
            <div className="adp-labeled-input">
              <span className="adp-input-label">{t("pdtab.personal.employment")}</span>
              <select className="adp-text-input adp-select" value={form.employment}
                onChange={(e) => set("employment", e.target.value)}>
                <option value="">{t("pdtab.common.selectPlaceholder")}</option>
                {employmentOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            
          </div>
          <div className="adp-doc-row--half"> 
          </div>
        </div>
      )}
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   8. DISABILITY SECTION
   ═══════════════════════════════════════════════════════════════════════════ */
function DisabilitySection({ patient, onRefresh }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const buildForm = (p) => ({
    disability: p?.disability || "",
    disabilityFrom: toInputDate(p?.disabilityFrom),
    disabilityTo: toInputDate(p?.disabilityTo),
    disabilityIndefinitely: !!p?.disabilityIndefinitely,
    invalidGroup: p?.invalidGroup || "",
    disabilityType: p?.disabilityType || "",
    disabilityPrimaryRepeated: p?.disabilityPrimaryRepeated || "",
  });

  const [form, setForm] = useState(buildForm(patient));
  useEffect(() => { setForm(buildForm(patient)); }, [patient]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!patient?._id) { toast.error(t("pdtab.common.patientIdNotFound")); return; }
    setSaving(true);
    try {
      await updatePatientDisability(patient._id, form);
      // toast suppressed; handled by global notification
      setEditing(false);
      onRefresh?.();
    } catch { toast.error(t("pdtab.disability.saveFail")); }
    finally { setSaving(false); }
  };
  useRegisteredSave('disability', editing, handleSave);

  const hasData = patient?.disability === "Yes";

  const groupOpts = [
    { value: "Group I", label: t("pdtab.disability.groupOpts.group1") },
    { value: "Group II", label: t("pdtab.disability.groupOpts.group2") },
    { value: "Group III", label: t("pdtab.disability.groupOpts.group3") },
    { value: "Child with disability", label: t("pdtab.disability.groupOpts.child") },
  ];

  const typeOpts = [
    { value: "General disease", label: t("pdtab.disability.typeOpts.general") },
    { value: "Occupational disease", label: t("pdtab.disability.typeOpts.occupational") },
    { value: "Labour injury", label: t("pdtab.disability.typeOpts.labour") },
    { value: "Childhood", label: t("pdtab.disability.typeOpts.childhood") },
    { value: "Military trauma", label: t("pdtab.disability.typeOpts.military") },
  ];

  return (
    <Section
      icon={<FiShield size={18} />}
      title={t("pdtab.disability.title")}
      onEdit={() => setEditing(true)}
      editing={editing}

      onCancel={() => setEditing(false)}

    >
      {!editing ? (
        hasData ? (
          <div className="adp-basic-fields-grid">
            <ReadField label={t("pdtab.disability.disabilityLabel")} value={patient?.disability} />
            <ReadField label={t("pdtab.disability.periodWith")} value={formatDate(patient?.disabilityFrom)} />
            <ReadField label={t("pdtab.disability.periodBy")} value={
              patient?.disabilityIndefinitely ? t("pdtab.disability.indefinitely") : formatDate(patient?.disabilityTo)
            } />
            <ReadField label={t("pdtab.disability.group")} value={patient?.invalidGroup} />
            <ReadField label={t("pdtab.disability.typeOfDisability")} value={patient?.disabilityType} />
            <ReadField label={t("pdtab.disability.primaryRepeated")} value={patient?.disabilityPrimaryRepeated} />
          </div>
        ) : (
          <p className="adp-empty-msg">{t("pdtab.disability.noData")}</p>
        )
      ) : (
        <div className="adp-doc-form">
          <div className="adp-labeled-input">
            <span className="adp-input-label">{t("pdtab.disability.patientWithDisability")}</span>
            <select className="adp-text-input adp-select" value={form.disability}
              onChange={(e) => set("disability", e.target.value)}>
              <option value="">{t("pdtab.common.selectPlaceholder")}</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </div>
          {form.disability === "Yes" && (
            <>
              <div className="adp-disability-period">
                <div className="adp-disability-period-row">
                  <div className="adp-labeled-input">
                    <span className="adp-input-label">{t("pdtab.disability.periodWith")}</span>
                    <CustomCalendar
                      className="adp-text-input"
                      value={form.disabilityFrom ? new Date(form.disabilityFrom) : null}
                      onChange={(date) => set("disabilityFrom", date ? date.toISOString().slice(0, 10) : "")}
                    />
                  </div>
                  <div className="adp-labeled-input">
                    <span className="adp-input-label">{t("pdtab.disability.periodBy")}</span>
                    <CustomCalendar
                      className="adp-text-input"
                      value={form.disabilityTo ? new Date(form.disabilityTo) : null}
                      onChange={(date) => set("disabilityTo", date ? date.toISOString().slice(0, 10) : "")}
                      disabled={form.disabilityIndefinitely}
                    />
                  </div>
                  <label className="adp-radio-label" style={{ alignSelf: "flex-end", paddingBottom: 6 }}>
                    <input type="checkbox" checked={form.disabilityIndefinitely}
                      onChange={(e) => set("disabilityIndefinitely", e.target.checked)} />
                    {t("pdtab.disability.indefinitely")}
                  </label>
                </div>
              </div>
              <div className="adp-doc-row--half">
                <div className="adp-labeled-input">
                  <span className="adp-input-label">{t("pdtab.disability.group")}</span>
                  <select className="adp-text-input adp-select" value={form.invalidGroup}
                    onChange={(e) => set("invalidGroup", e.target.value)}>
                    <option value="">{t("pdtab.common.selectPlaceholder")}</option>
                    {groupOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="adp-labeled-input">
                  <span className="adp-input-label">{t("pdtab.disability.typeOfDisability")}</span>
                  <select className="adp-text-input adp-select" value={form.disabilityType}
                    onChange={(e) => set("disabilityType", e.target.value)}>
                    <option value="">{t("pdtab.common.selectPlaceholder")}</option>
                    {typeOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="adp-labeled-input">
                <span className="adp-input-label">{t("pdtab.disability.primaryRepeated")}</span>
                <div className="adp-radio-group">
                  <label className="adp-radio-label">
                    <input type="radio" name={`disabilityPR_${patient?._id}`} value="Primary"
                      checked={form.disabilityPrimaryRepeated === "Primary"}
                      onChange={() => set("disabilityPrimaryRepeated", "Primary")} />
                    {t("pdtab.disability.primary")}
                  </label>
                  <label className="adp-radio-label">
                    <input type="radio" name={`disabilityPR_${patient?._id}`} value="Repeated"
                      checked={form.disabilityPrimaryRepeated === "Repeated"}
                      onChange={() => set("disabilityPrimaryRepeated", "Repeated")} />
                    {t("pdtab.disability.repeated")}
                  </label>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   9. ANAMNESIS SECTION
   ═══════════════════════════════════════════════════════════════════════════ */
function AnamnesisSection({ patient, onRefresh }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const buildForm = (p) => ({
    anamnesisDisability: p?.anamnesisDisability || "",
    bloodGroup: p?.bloodGroup || "",
    rhFactor: p?.rhFactor || "",
    kellAntigen: p?.kellAntigen || "",
    otherBloodInfo: p?.otherBloodInfo || "",
    allergies: p?.allergies || "",
  });

  const [form, setForm] = useState(buildForm(patient));
  useEffect(() => { setForm(buildForm(patient)); }, [patient]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!patient?._id) { toast.error(t("pdtab.common.patientIdNotFound")); return; }
    setSaving(true);
    try {
      await updatePatientAnamnesis(patient._id, form);
      // toast suppressed; handled by global notification
      setEditing(false);
      onRefresh?.();
    } catch { toast.error(t("pdtab.anamnesis.saveFail")); }
    finally { setSaving(false); }
  };
  useRegisteredSave('anamnesis', editing, handleSave);

  const hasData = patient?.bloodGroup || patient?.allergies || patient?.anamnesisDisability;

  return (
    <Section
      icon={<FiBookOpen size={18} />}
      title={t("pdtab.anamnesis.title")}
      onEdit={() => setEditing(true)}
      editing={editing}

      onCancel={() => setEditing(false)}

    >
      {!editing ? (
        hasData ? (
          <div className="adp-basic-fields-grid">
            <ReadField label={t("pdtab.anamnesis.disability")} value={patient?.anamnesisDisability} wide />
            <ReadField label={t("pdtab.anamnesis.bloodGroup")} value={patient?.bloodGroup} />
            <ReadField label={t("pdtab.anamnesis.rhFactor")} value={patient?.rhFactor} />
            <ReadField label={t("pdtab.anamnesis.kellAntigen")} value={patient?.kellAntigen} />
            <ReadField label={t("pdtab.anamnesis.otherBloodInfoShort")} value={patient?.otherBloodInfo} />
            <ReadField label={t("pdtab.anamnesis.allergicReactions")} value={patient?.allergies} wide />
          </div>
        ) : (
          <p className="adp-empty-msg">{t("pdtab.anamnesis.noData")}</p>
        )
      ) : (
        <div className="adp-doc-form">
          <div className="adp-labeled-input adp-labeled-input--wide">
            <span className="adp-input-label">{t("pdtab.anamnesis.disability")}</span>
            <textarea className="adp-textarea adp-textarea--full" value={form.anamnesisDisability}
              placeholder={t("pdtab.anamnesis.disabilityPh")}
              onChange={(e) => set("anamnesisDisability", e.target.value)} />
          </div>
          <div className="adp-doc-row--half">
            <div className="adp-labeled-input">
              <span className="adp-input-label">{t("pdtab.anamnesis.bloodGroup")}</span>
              <select className="adp-text-input adp-select" value={form.bloodGroup}
                onChange={(e) => set("bloodGroup", e.target.value)}>
                <option value="">{t("pdtab.common.selectPlaceholder")}</option>
                <option value="O(I)">O(I)</option>
                <option value="A(II)">A(II)</option>
                <option value="B(III)">B(III)</option>
                <option value="AB(IV)">AB(IV)</option>
              </select>
            </div>
            <div className="adp-labeled-input">
              <span className="adp-input-label">{t("pdtab.anamnesis.rhFactor")}</span>
              <select className="adp-text-input adp-select" value={form.rhFactor}
                onChange={(e) => set("rhFactor", e.target.value)}>
                <option value="">{t("pdtab.common.selectPlaceholder")}</option>
                <option value="Rh+">Rh+</option>
                <option value="Rh−">Rh−</option>
              </select>
            </div>
          </div>
          <div className="adp-doc-row--half">
            <div className="adp-labeled-input">
              <span className="adp-input-label">{t("pdtab.anamnesis.kellAntigen")}</span>
              <select className="adp-text-input adp-select" value={form.kellAntigen}
                onChange={(e) => set("kellAntigen", e.target.value)}>
                <option value="">{t("pdtab.common.selectPlaceholder")}</option>
                <option value="K+">K+</option>
                <option value="K−">K−</option>
              </select>
            </div>
            <div className="adp-labeled-input">
              <span className="adp-input-label">{t("pdtab.anamnesis.otherBloodInfo")}</span>
              <input className="adp-text-input" value={form.otherBloodInfo}
                placeholder={t("pdtab.anamnesis.otherInfoPh")}
                onChange={(e) => set("otherBloodInfo", e.target.value)} />
            </div>
          </div>
          <div className="adp-labeled-input adp-labeled-input--wide">
            <span className="adp-input-label">{t("pdtab.anamnesis.allergicReactions")}</span>
            <textarea className="adp-textarea adp-textarea--full" value={form.allergies}
              onChange={(e) => set("allergies", e.target.value)} />
          </div>
        </div>
      )}
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   10. RADIATION DOSES SECTION (array)
   ═══════════════════════════════════════════════════════════════════════════ */
const RADIATION_FIELDS = ["date", "researchType", "effectiveDose", "note"];

function RadiationDosesSection({ patient, onRefresh }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (patient?.radiationDoses?.length) {
      setRows(patient.radiationDoses.map((d) => ({
        _id: d._id || "",
        date: toInputDate(d.date),
        researchType: d.researchType || "",
        effectiveDose: d.effectiveDose ?? "",
        note: d.note || "",
      })));
    } else {
      setRows([]);
    }
  }, [patient]);

  const updateRow = (i, k, v) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)));
  const addRow = () => setRows((r) => [...r, emptyRow(RADIATION_FIELDS)]);
  const removeRow = (i) => setRows((r) => r.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!patient?._id) { toast.error(t("pdtab.common.patientIdNotFound")); return; }
    setSaving(true);
    try {
      // Strip empty _id from new rows so Mongoose auto-generates proper ObjectIds
      const toSave = rows.map(({ _id, ...rest }) => (_id ? { _id, ...rest } : rest));
      await updatePatientRadiationDoses(patient._id, { radiationDoses: toSave });
      // toast suppressed; handled by global notification
      setEditing(false);
      onRefresh?.();
    } catch { toast.error(t("pdtab.radiation.saveFail")); }
    finally { setSaving(false); }
  };
  useRegisteredSave('radiation', editing, handleSave);

  return (
    <Section
      icon={<FiAlertCircle size={18} />}
      title={t("pdtab.radiation.title")}
      onEdit={() => setEditing(true)}
      editing={editing}

      onCancel={() => setEditing(false)}

    >
      {!editing ? (
        patient?.radiationDoses?.length ? (
          <div className="adp-table-wrapper">
            <table className="adp-data-table">
              <thead>
                <tr>
                  <th>{t("pdtab.radiation.no")}</th>
                  <th>{t("pdtab.radiation.date")}</th>
                  <th>{t("pdtab.radiation.researchType")}</th>
                  <th>{t("pdtab.radiation.effectiveDose")}</th>
                  <th>{t("pdtab.radiation.note")}</th>
                </tr>
              </thead>
              <tbody>
                {patient.radiationDoses.map((d, i) => (
                  <tr key={d._id || i}>
                    <td>{i + 1}</td>
                    <td>{formatDate(d.date)}</td>
                    <td>{d.researchType || "—"}</td>
                    <td>{d.effectiveDose != null ? d.effectiveDose : "—"}</td>
                    <td>{d.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="adp-empty-msg">{t("pdtab.common.noRecords")}</p>
        )
      ) : (
        <div className="adp-array-edit">
          {rows.map((row, i) => (
            <div key={i} className="adp-rep-edit-card">
              <div className="adp-rep-edit-card__header">
                <span className="adp-rep-edit-card__title">#{i + 1}</span>
                <button className="adp-remove-rep-btn" onClick={() => removeRow(i)}>
                  <FiTrash2 size={13} /> {t("pdtab.common.remove")}
                </button>
              </div>
              <div className="adp-doc-row--half">
                <div className="adp-labeled-input">
                  <span className="adp-input-label">{t("pdtab.radiation.date")}</span>
                  <CustomCalendar
                    className="adp-text-input"
                    value={row.date ? new Date(row.date) : null}
                    onChange={(date) => updateRow(i, "date", date ? date.toISOString().slice(0, 10) : "")}
                  />
                </div>
                <div className="adp-labeled-input">
                  <span className="adp-input-label">{t("pdtab.radiation.researchType")}</span>
                  <input className="adp-text-input" value={row.researchType}
                    onChange={(e) => updateRow(i, "researchType", e.target.value)} />
                </div>
              </div>
              <div className="adp-doc-row--half">
                <div className="adp-labeled-input">
                  <span className="adp-input-label">{t("pdtab.radiation.effectiveDose")}</span>
                  <input className="adp-text-input" type="number" step="0.01" value={row.effectiveDose}
                    onChange={(e) => updateRow(i, "effectiveDose", e.target.value)} />
                </div>
                <div className="adp-labeled-input">
                  <span className="adp-input-label">{t("pdtab.radiation.note")}</span>
                  <input className="adp-text-input" value={row.note}
                    onChange={(e) => updateRow(i, "note", e.target.value)} />
                </div>
              </div>
            </div>
          ))}
          <button className="adp-add-link" onClick={addRow}>
            <FiPlus size={14} /> {t("pdtab.radiation.addRecord")}
          </button>
        </div>
      )}
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   11. LEGAL REPRESENTATIVE SECTION (array of complex objects)
   ═══════════════════════════════════════════════════════════════════════════ */
function LegalRepresentativeSection({ patient, onRefresh }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reps, setReps] = useState([]);

  const blankRep = () => ({
    lastName: "", firstName: "", middleName: "", isCurrent: false, birthday: "",
    gender: "", relationship: "", attitudeToPatient: "", documentOfAuthority: "",
    documentType: "", series: "", number: "", whenIssued: "", issuedBy: "", snils: "", subjectOfRussia: "", district: "",
    city: "", street: "", house: "", apartment: "", state: "",
  });

  useEffect(() => {
    if (patient?.legalRepresentatives?.length) {
      setReps(patient.legalRepresentatives.map((r) => ({
        _id: r._id,
        lastName: r.lastName || "",
        firstName: r.firstName || "",
        middleName: r.middleName || "",
        isCurrent: !!r.isCurrent,
        birthday: toInputDate(r.birthday),
        gender: r.gender || "",
        relationship: r.relationship || "",
        attitudeToPatient: r.attitudeToPatient || "",
        documentOfAuthority: r.documentOfAuthority || "",
        documentType: r.documentType || "",
        series: r.series || "",
        number: r.number || "",
        whenIssued: toInputDate(r.whenIssued),
        issuedBy: r.issuedBy || "",
        snils: r.snils || "",
        subjectOfRussia: r.subjectOfRussia || "",
        district: r.district || "",
        city: r.city || "",
        street: r.street || "",
        house: r.house || "",
        apartment: r.apartment || "",
        state: r.state || "",
      })));
    } else {
      setReps([]);
    }
  }, [patient]);

  const updateRep = (i, k, v) =>
    setReps((arr) => arr.map((rep, idx) => (idx === i ? { ...rep, [k]: v } : rep)));
  const addRep = () => setReps((arr) => [...arr, blankRep()]);
  const removeRep = (i) => setReps((arr) => arr.filter((_, idx) => idx !== i));

  const genderLabel = (g) =>
    g === "Male" ? t("pdtab.gender.male") : g === "Female" ? t("pdtab.gender.female") : t("pdtab.gender.notSpecified");

  const handleSave = async () => {
    if (!patient?._id) { toast.error(t("pdtab.common.patientIdNotFound")); return; }
    setSaving(true);
    try {
      for (const rep of reps) {
        const { _id, ...data } = rep;
        if (_id) {
          await updateLegalRepresentative(patient._id, _id, data);
        } else {
          await createLegalRepresentative(patient._id, data);
        }
      }
      // toast suppressed; handled by global notification
      setEditing(false);
      onRefresh?.();
    } catch { toast.error(t("pdtab.legalRep.saveFail")); }
    finally { setSaving(false); }
  };
  useRegisteredSave('legalRep', editing, handleSave);

  /* view mode for a single representative */
  const renderViewRep = (rep, i) => (
    <div key={rep._id || i} className="adp-rep-view-card">
      <div className="adp-rep-view-card__title">
        {t("pdtab.legalRep.representative", { num: i + 1 })}
        {rep.isCurrent && (
          <span className="adp-rep-current-badge">
            {t("pdtab.legalRep.currentRep")}
          </span>
        )}
      </div>
      <div className="adp-basic-fields-grid">
        <ReadField label={t("pdtab.legalRep.lastNameView")} value={rep.lastName} />
        <ReadField label={t("pdtab.legalRep.firstNameView")} value={rep.firstName} />
        <ReadField label={t("pdtab.legalRep.middleNameView")} value={rep.middleName} />
        <ReadField label={t("pdtab.legalRep.birthdayView")} value={formatDate(rep.birthday)} />
        <ReadField label={t("pdtab.legalRep.floor")} value={genderLabel(rep.gender)} />
        <ReadField label={t("pdtab.legalRep.relationshipView")} value={rep.relationship} />
        <ReadField label={t("pdtab.legalRep.attitudeView")} value={rep.attitudeToPatient} />
        <ReadField label={t("pdtab.legalRep.docOfAuthorityView")} value={rep.documentOfAuthority} />
      </div>
      {(rep.documentType || rep.series || rep.number) && (
        <>
          <div className="adp-rep-subsection">{t("pdtab.legalRep.identityCard")}</div>
          <div className="adp-basic-fields-grid">
            <ReadField label={t("pdtab.legalRep.documentTypeView")} value={rep.documentType} />
            <ReadField label={t("pdtab.legalRep.seriesView")} value={rep.series} />
            <ReadField label={t("pdtab.legalRep.numberView")} value={rep.number} />
            <ReadField label={t("pdtab.legalRep.whenIssuedView")} value={formatDate(rep.whenIssued)} />
            <ReadField label={t("pdtab.legalRep.issuedByView")} value={rep.issuedBy} />
            <ReadField label={t("pdtab.legalRep.snilsView")} value={rep.snils} />
          </div>
        </>
      )}
      {(rep.address || rep.city || rep.street) && (
        <>
          <div className="adp-rep-subsection">{t("pdtab.legalRep.addressView")}</div>
          <div className="adp-basic-fields-grid">
            <ReadField label={t("pdtab.legalRep.subjectView")} value={rep.subjectOfRussia} />
            <ReadField label={t("pdtab.legalRep.districtView")} value={rep.district} />
            <ReadField label={t("pdtab.legalRep.cityView")} value={rep.city} />
            <ReadField label={t("pdtab.legalRep.streetView")} value={rep.street} />
            <ReadField label={t("pdtab.legalRep.houseView")} value={rep.house} />
            <ReadField label={t("pdtab.legalRep.apartmentView")} value={rep.apartment} />
            <ReadField label={t("pdtab.legalRep.stateView")} value={rep.state} />
          </div>
        </>
      )}
    </div>
  );

  /* edit mode for a single representative */
  const renderEditRep = (rep, i) => (
    <div key={i} className="adp-rep-edit-card">
      <div className="adp-rep-edit-card-header">
        <span className="adp-rep-edit-label">
          {t("pdtab.legalRep.representative", { num: i + 1 })}
        </span>
        <button className="adp-remove-rep-btn" onClick={() => removeRep(i)}>
          <FiTrash2 size={13} /> {t("pdtab.common.remove")}
        </button>
      </div>
      <div className="adp-doc-row--half">
        <div className="adp-labeled-input">
          <span className="adp-input-label">{t("pdtab.legalRep.lastName")}</span>
          <input className="adp-text-input" value={rep.lastName}
            onChange={(e) => updateRep(i, "lastName", e.target.value)} />
        </div>
        <div className="adp-labeled-input">
          <span className="adp-input-label">{t("pdtab.legalRep.firstName")}</span>
          <input className="adp-text-input" value={rep.firstName}
            onChange={(e) => updateRep(i, "firstName", e.target.value)} />
        </div>
      </div>
      <div className="adp-doc-row--half">
        <div className="adp-labeled-input">
          <span className="adp-input-label">{t("pdtab.legalRep.middleName")}</span>
          <input className="adp-text-input" value={rep.middleName}
            onChange={(e) => updateRep(i, "middleName", e.target.value)} />
        </div>
        <div className="adp-labeled-input">
          <span className="adp-input-label">{t("pdtab.legalRep.birthday")}</span>
          <CustomCalendar
            className="adp-text-input"
            value={rep.birthday ? new Date(rep.birthday) : null}
            onChange={(date) => updateRep(i, "birthday", date ? date.toISOString().slice(0, 10) : "")}
          />
        </div>
      </div>
      <div className="adp-doc-row--half">
        <div className="adp-labeled-input">
          <span className="adp-input-label">{t("pdtab.legalRep.floorGender")}</span>
          <div className="adp-gender-toggle">
            {["Male", "Female"].map((g) => (
              <button key={g} type="button"
                className={`adp-gender-toggle-btn${rep.gender === g ? " active" : ""}`}
                onClick={() => updateRep(i, "gender", g)}>
                {genderLabel(g)}
              </button>
            ))}
          </div>
        </div>
        <div className="adp-labeled-input">
          <span className="adp-input-label">{t("pdtab.legalRep.relationship")}</span>
          <input className="adp-text-input" value={rep.relationship} placeholder={t("pdtab.legalRep.relationshipPh")}
            onChange={(e) => updateRep(i, "relationship", e.target.value)} />
        </div>
      </div>
      <div className="adp-doc-row--half">
        <div className="adp-labeled-input">
          <span className="adp-input-label">{t("pdtab.legalRep.attitude")}</span>
          <input className="adp-text-input" value={rep.attitudeToPatient} placeholder={t("pdtab.legalRep.attitudePh")}
            onChange={(e) => updateRep(i, "attitudeToPatient", e.target.value)} />
        </div>
        <div className="adp-labeled-input">
          <span className="adp-input-label">{t("pdtab.legalRep.docOfAuthority")}</span>
          <input className="adp-text-input" value={rep.documentOfAuthority} placeholder={t("pdtab.legalRep.docOfAuthorityPh")}
            onChange={(e) => updateRep(i, "documentOfAuthority", e.target.value)} />
        </div>
      </div>
      <label className="adp-radio-label" style={{ marginTop: 4 }}>
        <input type="checkbox" checked={rep.isCurrent}
          onChange={(e) => updateRep(i, "isCurrent", e.target.checked)} />
        {t("pdtab.legalRep.currentRep")}
      </label>

      <div className="adp-rep-subsection">{t("pdtab.legalRep.identityCard")}</div>
      <div className="adp-doc-row--half">
        <div className="adp-labeled-input">
          <span className="adp-input-label">{t("pdtab.legalRep.documentType")}</span>
          <input className="adp-text-input" value={rep.documentType} placeholder={t("pdtab.legalRep.documentTypePh")}
            onChange={(e) => updateRep(i, "documentType", e.target.value)} />
        </div>
        <div className="adp-labeled-input">
          <span className="adp-input-label">{t("pdtab.legalRep.series")}</span>
          <input className="adp-text-input" value={rep.series} placeholder={t("pdtab.legalRep.seriesPh")}
            onChange={(e) => updateRep(i, "series", e.target.value)} />
        </div>
      </div>
      <div className="adp-doc-row--half">
        <div className="adp-labeled-input">
          <span className="adp-input-label">{t("pdtab.legalRep.number")}</span>
          <input className="adp-text-input" value={rep.number} placeholder={t("pdtab.legalRep.numberPh")}
            onChange={(e) => updateRep(i, "number", e.target.value)} />
        </div>
        <div className="adp-labeled-input">
          <span className="adp-input-label">{t("pdtab.legalRep.whenIssued")}</span>
          <CustomCalendar
            className="adp-text-input"
            value={rep.whenIssued ? new Date(rep.whenIssued) : null}
            onChange={(date) => updateRep(i, "whenIssued", date ? date.toISOString().slice(0, 10) : "")}
          />
        </div>
      </div>
      <div className="adp-doc-row--half">
        <div className="adp-labeled-input">
          <span className="adp-input-label">{t("pdtab.legalRep.issuedBy")}</span>
          <input className="adp-text-input" value={rep.issuedBy} placeholder={t("pdtab.legalRep.issuedByPh")}
            onChange={(e) => updateRep(i, "issuedBy", e.target.value)} />
        </div>
        <div className="adp-labeled-input">
          <span className="adp-input-label">{t("pdtab.legalRep.snils")}</span>
          <input className="adp-text-input" value={rep.snils} placeholder={t("pdtab.legalRep.snilsPh")}
            onChange={(e) => updateRep(i, "snils", e.target.value)} />
        </div>
      </div>

      <div className="adp-rep-subsection">{t("pdtab.legalRep.address")}</div>
      
      <div className="adp-doc-row--half">
        
        <div className="adp-labeled-input">
          <span className="adp-input-label">{t("pdtab.legalRep.subjectRF")}</span>
          <input className="adp-text-input" value={rep.subjectOfRussia} placeholder={t("pdtab.legalRep.subjectPh")}
            onChange={(e) => updateRep(i, "subjectOfRussia", e.target.value)} />
        </div>
      </div>
      <div className="adp-doc-row--half">
        <div className="adp-labeled-input">
          <span className="adp-input-label">{t("pdtab.legalRep.district")}</span>
          <input className="adp-text-input" value={rep.district} placeholder={t("pdtab.legalRep.districtPh")}
            onChange={(e) => updateRep(i, "district", e.target.value)} />
        </div>
        <div className="adp-labeled-input">
          <span className="adp-input-label">{t("pdtab.legalRep.city")}</span>
          <input className="adp-text-input" value={rep.city} placeholder={t("pdtab.legalRep.cityPh")}
            onChange={(e) => updateRep(i, "city", e.target.value)} />
        </div>
      </div>
      <div className="adp-doc-row--half">
        <div className="adp-labeled-input">
          <span className="adp-input-label">{t("pdtab.legalRep.street")}</span>
          <input className="adp-text-input" value={rep.street} placeholder={t("pdtab.legalRep.streetPh")}
            onChange={(e) => updateRep(i, "street", e.target.value)} />
        </div>
      </div>
      <div className="adp-doc-row--half">
        <div className="adp-labeled-input">
          <span className="adp-input-label">{t("pdtab.legalRep.house")}</span>
          <input className="adp-text-input" value={rep.house} placeholder={t("pdtab.legalRep.housePh")}
            onChange={(e) => updateRep(i, "house", e.target.value)} />
        </div>
        <div className="adp-labeled-input">
          <span className="adp-input-label">{t("pdtab.legalRep.apartment")}</span>
          <input className="adp-text-input" value={rep.apartment} placeholder={t("pdtab.legalRep.apartmentPh")}
            onChange={(e) => updateRep(i, "apartment", e.target.value)} />
        </div>
      </div>
      <div className="adp-labeled-input">
        <span className="adp-input-label">{t("pdtab.legalRep.state")}</span>
        <input className="adp-text-input" value={rep.state} placeholder={t("pdtab.legalRep.statePh")}
          onChange={(e) => updateRep(i, "state", e.target.value)} />
      </div>
    </div>
  );

  return (
    <Section
      icon={<FiUser size={18} />}
      title={t("pdtab.legalRep.title")}
      onEdit={() => setEditing(true)}
      editing={editing}

      onCancel={() => setEditing(false)}

    >
      {!editing ? (
        patient?.legalRepresentatives?.length ? (
          patient.legalRepresentatives.map((rep, i) => renderViewRep(rep, i))
        ) : (
          <p className="adp-empty-msg">{t("pdtab.common.noRecords")}</p>
        )
      ) : (
        <div className="adp-array-edit">
          {reps.map((rep, i) => renderEditRep(rep, i))}
          <button className="adp-add-link" onClick={addRep}>
            <FiPlus size={14} /> {t("pdtab.legalRep.addRep")}
          </button>
        </div>
      )}
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
export default function PatientDetailsTab({ application, patient, onRefresh }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const saversRef = useRef({});
  const [globalSaving, setGlobalSaving] = useState(false);
  const [showSaveCloseConfirm, setShowSaveCloseConfirm] = useState(false);

  const registry = useMemo(() => ({
    register: (key, fn) => {
      saversRef.current[key] = fn;
    },
    unregister: (key) => {
      delete saversRef.current[key];
    },
  }), []);

  const handleSaveAll = useCallback(async () => {
    const fns = Object.values(saversRef.current);
    if (!fns.length) {
      toast.info(t("pdtab.common.noChanges"));
      return;
    }
    setGlobalSaving(true);
    try {
      await Promise.all(fns.map((fn) => fn()));
      toast.success(t("pdtab.common.allSaved"));
      onRefresh?.();
    } catch {
      toast.error(t("pdtab.common.someFailedToSave"));
    } finally {
      setGlobalSaving(false);
    }
  }, [t, onRefresh]);

  const doSaveAndClose = useCallback(async () => {
    const fns = Object.values(saversRef.current);
    setGlobalSaving(true);
    try {
      if (fns.length) {
        await Promise.all(fns.map((fn) => fn()));
        toast.success(t("pdtab.common.patientUpdated"));
        onRefresh?.();
      }
      navigate(-1);
    } catch {
      toast.error(t("pdtab.common.someFailedToSave"));
    } finally {
      setGlobalSaving(false);
    }
  }, [t, onRefresh, navigate]);

  const confirmSaveAndClose = async () => {
    setShowSaveCloseConfirm(false);
    await doSaveAndClose();
  };

  const patientName = patient
    ? [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(" ")
    : t("pdtab.header.unknownPatient");

  const recordNo = application?.applicationId || application?._id || "—";
  const recordDate = formatDate(application?.createdAt || application?.date);

  return (
    <SaveRegistryContext.Provider value={registry}>
      <div className="adp-content">
        {/* Header — icon + title left-aligned */}
        <div className="adp-record-header">
          <FiFileText size={24} className="adp-record-header__icon" />
          <div className="adp-record-header__info">
            <div className="adp-record-header__title">
              {t("pdtab.header.medicalRecord")} — {patientName}
            </div>
            <div className="adp-record-header__sub">
              {t("pdtab.header.recordNo", { no: recordNo })} {t("pdtab.header.from")} {recordDate}
            </div>
          </div>
        </div>

        {/* Sections — LegalRep immediately after BasicData */}
        <BasicDataSection patient={patient} onRefresh={onRefresh} />
        <LegalRepresentativeSection patient={patient} onRefresh={onRefresh} />
        <ContactsSection patient={patient} onRefresh={onRefresh} />
        <DocumentsSection patient={patient} onRefresh={onRefresh} />
        <AddressSection patient={patient} onRefresh={onRefresh} />
        <DiseasesSection patient={patient} onRefresh={onRefresh} />
        <FinalDiagnosisSection patient={patient} onRefresh={onRefresh} />
        <PersonalDataSection patient={patient} onRefresh={onRefresh} />
        <DisabilitySection patient={patient} onRefresh={onRefresh} />
        <AnamnesisSection patient={patient} onRefresh={onRefresh} />
        <RadiationDosesSection patient={patient} onRefresh={onRefresh} />

        {/* Global save footer — always visible on patient tab */}
        <div className="adp-global-save-footer">
          <button
            className="adp-btn-save-outline"
            onClick={handleSaveAll}
            disabled={globalSaving}
          >
            {globalSaving ? t("pdtab.common.saving") : t("pdtab.common.save")}
          </button>
          <button
            className="adp-btn-save-primary"
            onClick={() => setShowSaveCloseConfirm(true)}
            disabled={globalSaving}
          >
            {globalSaving ? t("pdtab.common.saving") : t("pdtab.common.saveAndClose")}
          </button>
        </div>

        {showSaveCloseConfirm && (
          <div className="custom-modal-overlay" style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.35)", zIndex: 1200, display: "flex", justifyContent: "center", alignItems: "center" }}>
            <div className="custom-modal" style={{ width: 360, background: "#fff", borderRadius: 10, boxShadow: "0 8px 20px rgba(0, 0, 0, 0.25)", padding: "18px 16px", textAlign: "center" }}>
              <h3 style={{ marginBottom: 10 }}>{t("pdtab.common.confirm")}</h3>
              <p style={{ marginBottom: 20 }}>{t("pdtab.common.confirmSaveAndCloseMessage") || "Save changes and close the record?"}</p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  className="adp-btn-save-outline"
                  onClick={() => setShowSaveCloseConfirm(false)}
                  disabled={globalSaving}
                >
                  {t("pdtab.common.cancel")}
                </button>
                <button
                  className="adp-btn-save-primary"
                  onClick={confirmSaveAndClose}
                  disabled={globalSaving}
                >
                  {globalSaving ? t("pdtab.common.saving") : t("pdtab.common.confirm")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SaveRegistryContext.Provider>
  );
}
