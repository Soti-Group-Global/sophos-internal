import { useState, useEffect, useRef, useMemo, createContext, useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import CustomCalendar from "../components/CustomCalendar/CustomCalendar";
import { addPatient, getPatient, updatePatient, getDoctorsProfileData } from "../utils/api";
import { FaTimes, FaChevronDown, FaChevronUp } from "react-icons/fa";
import { FiPlus, FiX } from "react-icons/fi";
import "../styles/PatientForm.css";
import DiseaseCodeSearch from "../components/DiseaseCodeSearch/DiseaseCodeSearch";

/* ─────────────────────── helpers ─────────────────────── */
const GENDER_OPTIONS = ["Male", "Female", "Other"];
const GENDER_TOGGLES = ["not_specified", "Male", "Female"];

const SOCIAL_ICONS = [
  {
    key: "instagram", bg: "pf-social-instagram",
    svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>,
  },
  {
    key: "vk", bg: "pf-social-vk",
    svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M15.07 2H8.93C3.33 2 2 3.33 2 8.93v6.14C2 20.67 3.33 22 8.93 22h6.14C20.67 22 22 20.67 22 15.07V8.93C22 3.33 20.67 2 15.07 2zm3.08 13.5h-1.6c-.61 0-.79-.48-1.88-1.57-1-.92-1.42-.5-1.42.5v1.07c0 .29-.12.5-.9.5-1.29 0-2.73-.78-3.73-2.23C7.09 11.85 6.5 9.92 6.5 9.67c0-.17.06-.33.37-.33h1.6c.29 0 .39.12.5.42.55 1.58 1.46 2.96 1.83 2.96.14 0 .2-.06.2-.41V10.2c-.04-.77-.42-.84-.42-1.11 0-.14.12-.29.31-.29h2.5c.25 0 .33.13.33.41v2.9c0 .25.11.33.18.33.14 0 .25-.08.52-.35 1.04-1.17 1.79-2.96 1.79-2.96.1-.2.25-.39.54-.39h1.6c.48 0 .58.25.48.58-.2.92-2.04 3.49-2.04 3.49-.17.27-.23.39 0 .69.16.22.7.69 1.05 1.11.65.75 1.15 1.38 1.29 1.81.1.37-.09.56-.42.56z" /></svg>,
  },
  {
    key: "facebook", bg: "pf-social-fb",
    svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>,
  },
  {
    key: "ok", bg: "pf-social-ok",
    svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 6c1.65 0 3 1.35 3 3s-1.35 3-3 3-3-1.35-3-3 1.35-3 3-3zm5 10.5c-.75.75-1.8 1.2-3 1.35l2.55 2.55c.3.3.3.75 0 1.05l-.45.45c-.3.3-.75.3-1.05 0L12 18.9l-3.05 3.05c-.3.3-.75.3-1.05 0l-.45-.45c-.3-.3-.3-.75 0-1.05L10 18c-1.2-.15-2.25-.6-3-1.35-.45-.45-.45-1.2 0-1.65.45-.45 1.2-.45 1.65 0C9.45 15.75 10.65 16.2 12 16.2s2.55-.45 3.35-1.2c.45-.45 1.2-.45 1.65 0 .45.45.45 1.2 0 1.5z" /></svg>,
  },
];

const INITIAL_STATE = {
  // Basic
  firstName: "", middleName: "", lastName: "",
  gender: "", dateOfBirth: "", notes: "",
  // Contacts
  email: "", phoneNumber: "", additionalPhone: "",
  maxId: "", telegramNickname: "", telegramId: "",
  newsletter: false, egisz: false,
  instagram: "", vk: "", facebook: "", ok: "",
  contactPerson: "", contactPersonPhone: "",
  // Documents
  cmip: "", cmipDate: "", cmipOrgCode: "",
  snils: "", medInsuranceOrg: "", socialSupportCode: "",
  citizenship: "", documentType: "", documentSeries: "",
  documentNumber: "", documentIssuedDate: "", departmentCode: "",
  documentIssuedBy: "", inn: "",
  // Address
  addressType: "", region: "", district: "", city: "",
  settlement: "", street: "", house: "", terrain: "",
  apartment: "", postcode: "", geocoordinates: "", registrationChange: "",
  // Personal
  maritalStatus: "", education: "", employment: "",
  placeOfWork: "", workSpecialty: "", changePlaceOfWork: "", changeOfPosition: "",
  // Disability
  disability: "", disabilityFrom: "", disabilityTo: "",
  disabilityIndefinitely: false, invalidGroup: "",
  disabilityType: "", disabilityPrimaryRepeated: "",
  // Anamnesis
  anamnesisDisability: "", bloodGroup: "", rhFactor: "",
  kellAntigen: "", otherBloodInfo: "", allergies: "",
  // System
  comments: "", notificationLanguage: "en",
  profileImage: null,
};

/* ─────────────── select option arrays ─────────────── */
const CITIZENSHIP_OPTIONS = [
  { key: "Russian Federation", labelKey: "documents.citizenship_rf" },
  { key: "Other", labelKey: "documents.citizenship_other" },
];
const DOCUMENT_TYPE_OPTIONS = [
  { key: "Passport of a citizen of the Russian Federation", labelKey: "documents.doc_type_passport_rf" },
  { key: "Foreign passport", labelKey: "documents.doc_type_foreign_passport" },
  { key: "Birth certificate", labelKey: "documents.doc_type_birth_certificate" },
  { key: "Other", labelKey: "documents.doc_type_other" },
];
const MARITAL_STATUS_OPTIONS = [
  { key: "Single / Unmarried", labelKey: "personal_data.marital_single" },
  { key: "Married", labelKey: "personal_data.marital_married" },
  { key: "Divorced", labelKey: "personal_data.marital_divorced" },
  { key: "Widowed", labelKey: "personal_data.marital_widowed" },
  { key: "Civil marriage", labelKey: "personal_data.marital_civil" },
];
const EDUCATION_OPTIONS = [
  { key: "Secondary", labelKey: "personal_data.edu_secondary" },
  { key: "Secondary vocational", labelKey: "personal_data.edu_secondary_vocational" },
  { key: "Incomplete higher", labelKey: "personal_data.edu_incomplete_higher" },
  { key: "Higher", labelKey: "personal_data.edu_higher" },
  { key: "Postgraduate", labelKey: "personal_data.edu_postgraduate" },
];
const EMPLOYMENT_OPTIONS = [
  { key: "Employed", labelKey: "personal_data.emp_employed" },
  { key: "Unemployed", labelKey: "personal_data.emp_unemployed" },
  { key: "Student", labelKey: "personal_data.emp_student" },
  { key: "Retired", labelKey: "personal_data.emp_retired" },
  { key: "Disabled", labelKey: "personal_data.emp_disabled" },
];
const DISABILITY_GROUP_OPTIONS = [
  { key: "Group I", labelKey: "disability.group_i" },
  { key: "Group II", labelKey: "disability.group_ii" },
  { key: "Group III", labelKey: "disability.group_iii" },
  { key: "Child with disability", labelKey: "disability.group_child" },
];
const DISABILITY_TYPE_OPTIONS = [
  { key: "General disease", labelKey: "disability.type_general" },
  { key: "Occupational disease", labelKey: "disability.type_occupational" },
  { key: "Labour injury", labelKey: "disability.type_labour" },
  { key: "Childhood", labelKey: "disability.type_childhood" },
  { key: "Military trauma", labelKey: "disability.type_military" },
];

/* Turn ISO "2003-04-01T00:00:00.000Z" → "2003-04-01" for <input type="date"> */
function isoToDateInput(val) {
  if (!val) return "";
  const s = typeof val === "string" ? val : new Date(val).toISOString();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

function toDateOnly(date) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* ─────────────────── collapsible section ─────────────────── */
function Section({ id: sId, title, open, onToggle, children }) {
  return (
    <div className="pf-section">
      <button type="button" className="pf-section-hdr" onClick={() => onToggle(sId)}>
        <span>{title}</span>
        {open ? <FaChevronUp size={14} /> : <FaChevronDown size={14} />}
      </button>
      {open && <div className="pf-section-body">{children}</div>}
    </div>
  );
}

const PatientFormUiContext = createContext(null);

function Field({ name, label, required, type = "text", half, ...rest }) {
  const { form, errors, onChange, submitting } = useContext(PatientFormUiContext);
  return (
    <div className={`pf-field${half ? " pf-half" : ""}`}>
      <label className="pf-label">
        {label} {required && <span className="pf-req">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={form[name]}
        onChange={onChange}
        className={`pf-input${errors[name] ? " pf-input--error" : ""}`}
        disabled={submitting}
        {...rest}
      />
      {errors[name] && <span className="pf-error">{errors[name]}</span>}
    </div>
  );
}

function TextArea({ name, label, rows = 3 }) {
  const { form, errors, onChange, submitting } = useContext(PatientFormUiContext);
  return (
    <div className="pf-field pf-full">
      <label className="pf-label">{label}</label>
      <textarea
        name={name}
        value={form[name]}
        onChange={onChange}
        rows={rows}
        className={`pf-textarea${errors[name] ? " pf-input--error" : ""}`}
        disabled={submitting}
      />
      {errors[name] && <span className="pf-error">{errors[name]}</span>}
    </div>
  );
}

function Checkbox({ name, label }) {
  const { form, onCheck, submitting } = useContext(PatientFormUiContext);
  return (
    <label className="pf-checkbox">
      <input type="checkbox" name={name} checked={!!form[name]} onChange={onCheck} disabled={submitting} />
      <span>{label}</span>
    </label>
  );
}

/* ── DoctorDropdown: searchable dropdown picking from doctor profiles ── */
function DoctorDropdown({ value, onChange, doctors, getDoctorDisplayName, placeholder, disabled, onDoctorSelect }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const filtered = useMemo(() => {
    if (!doctors?.length) return [];
    const named = doctors.filter((d) => getDoctorDisplayName(d));
    if (!value?.trim()) return named.slice(0, 15);
    const q = value.toLowerCase();
    return named.filter((d) => getDoctorDisplayName(d).toLowerCase().includes(q)).slice(0, 15);
  }, [doctors, value, getDoctorDisplayName]);

  useEffect(() => {
    const close = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="pf-autocomplete-wrap" ref={wrapRef}>
      <input
        className="pf-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        disabled={disabled}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="pf-autocomplete-dropdown">
          {filtered.map((d) => (
            <li key={d._id} className="pf-autocomplete-item" onMouseDown={(e) => {
              e.preventDefault();
              onChange(getDoctorDisplayName(d));
              onDoctorSelect?.(d);
              setOpen(false);
            }}>
              {getDoctorDisplayName(d)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── SpecialityDropdown: searchable dropdown for specialties ── */
function SpecialityDropdown({ value, onChange, options, placeholder, disabled }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const filtered = useMemo(() => {
    if (!options?.length) return [];
    if (!value?.trim()) return options;
    const q = value.toLowerCase();
    return options.filter((opt) => opt.toLowerCase().includes(q));
  }, [options, value]);

  useEffect(() => {
    const close = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="pf-autocomplete-wrap" ref={wrapRef}>
      <input
        className="pf-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); if (options?.length) setOpen(true); }}
        onFocus={() => { if (options?.length) setOpen(true); }}
        disabled={disabled}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="pf-autocomplete-dropdown">
          {filtered.map((opt, i) => (
            <li key={i} className="pf-autocomplete-item" onMouseDown={(e) => {
              e.preventDefault();
              onChange(opt);
              setOpen(false);
            }}>
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─────────────────────── component ─────────────────────── */
function PatientForm() {
  const { t, i18n } = useTranslation("patient_form");
  const { t: tg } = useTranslation("appointment_details_general");
  const genderLabel = (g) => {
    if (g === "not_specified") return tg("common.not_specified");
    if (g === "Male") return tg("common.male");
    return tg("common.female");
  };
  const navigate = useNavigate();
  const { id } = useParams();          // present only on edit
  const isEdit = Boolean(id);

  const [form, setForm] = useState(INITIAL_STATE);
  const [previewImage, setPreviewImage] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Collapsible sections — basic & contacts open by default
  const [openSections, setOpenSections] = useState({
    basic: true, contacts: true,
    legalRep: false, documents: false, address: false,
    diseases: false, finalDiagnosis: false,
    personal: false, disability: false, anamnesis: false,
    radiationDoses: false, system: false,
  });

  /* ── array states for dynamic table sections ── */
  const [diseases, setDiseases] = useState([]);
  const [finalDiagnoses, setFinalDiagnoses] = useState([]);
  const [radiationDoses, setRadiationDoses] = useState([]);
  const [legalReps, setLegalReps] = useState([]);

  const toggle = (key) =>
    setOpenSections((p) => ({ ...p, [key]: !p[key] }));

  /* ── doctors list for autocomplete ── */
  const [doctorsList, setDoctorsList] = useState([]);
  const lang = i18n.language?.startsWith("ru") ? "ru" : "en";
  useEffect(() => {
    getDoctorsProfileData()
      .then((res) => setDoctorsList(res?.data || []))
      .catch(() => {});
  }, []);

  const getDoctorDisplayName = (doctor) => {
    const l = lang;
    if (doctor.displayName) return doctor.displayName[l] || doctor.displayName.en || doctor.displayName.ru || "";
    const name = [
      doctor.lastName?.[l] || doctor.lastName?.en || doctor.lastName?.ru,
      doctor.firstName?.[l] || doctor.firstName?.en || doctor.firstName?.ru,
      doctor.middleName?.[l] || doctor.middleName?.en || doctor.middleName?.ru,
    ].filter(Boolean).join(" ");
    return name || doctor.email || "";
  };

  /* ── track per-row specialties for final diagnosis ── */
  const [rowDoctorSpecialties, setRowDoctorSpecialties] = useState({});

  /* ── fetch patient on edit ── */
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      setLoading(true);
      try {
        const res = await getPatient(id);
        const p = res.data.patient;
        setForm({
          firstName: p.firstName || "",
          middleName: p.middleName || "",
          lastName: p.lastName || "",
          gender: p.gender || "",
          dateOfBirth: isoToDateInput(p.dateOfBirth),
          notes: p.notes || "",
          email: p.email || "",
          phoneNumber: p.phoneNumber || "",
          additionalPhone: p.additionalPhone || "",
          maxId: p.maxId || "",
          telegramNickname: p.telegramNickname || "",
          telegramId: p.telegramId || "",
          newsletter: p.newsletter || false,
          egisz: p.egisz || false,
          instagram: p.instagram || "",
          vk: p.vk || "",
          facebook: p.facebook || "",
          ok: p.ok || "",
          contactPerson: p.contactPerson || "",
          contactPersonPhone: p.contactPersonPhone || "",
          cmip: p.cmip || "",
          cmipDate: isoToDateInput(p.cmipDate),
          cmipOrgCode: p.cmipOrgCode || "",
          snils: p.snils || "",
          medInsuranceOrg: p.medInsuranceOrg || "",
          socialSupportCode: p.socialSupportCode || "",
          citizenship: p.citizenship || "",
          documentType: p.documentType || "",
          documentSeries: p.documentSeries || "",
          documentNumber: p.documentNumber || "",
          documentIssuedDate: isoToDateInput(p.documentIssuedDate),
          departmentCode: p.departmentCode || "",
          documentIssuedBy: p.documentIssuedBy || "",
          inn: p.inn || "",
          addressType: p.addressType || "",
          region: p.region || "",
          district: p.district || "",
          city: p.city || "",
          settlement: p.settlement || "",
          street: p.street || "",
          house: p.house || "",
          terrain: p.terrain || "",
          apartment: p.apartment || "",
          postcode: p.postcode || "",
          geocoordinates: p.geocoordinates || "",
          registrationChange: p.registrationChange || "",
          maritalStatus: p.maritalStatus || "",
          education: p.education || "",
          employment: p.employment || "",
          placeOfWork: p.placeOfWork || "",
          workSpecialty: p.workSpecialty || "",
          changePlaceOfWork: p.changePlaceOfWork || "",
          changeOfPosition: p.changeOfPosition || "",
          disability: p.disability || "",
          disabilityFrom: isoToDateInput(p.disabilityFrom),
          disabilityTo: isoToDateInput(p.disabilityTo),
          disabilityIndefinitely: p.disabilityIndefinitely || false,
          invalidGroup: p.invalidGroup || "",
          disabilityType: p.disabilityType || "",
          disabilityPrimaryRepeated: p.disabilityPrimaryRepeated || "",
          anamnesisDisability: p.anamnesisDisability || "",
          bloodGroup: p.bloodGroup || "",
          rhFactor: p.rhFactor || "",
          kellAntigen: p.kellAntigen || "",
          otherBloodInfo: p.otherBloodInfo || "",
          allergies: p.allergies || "",
          comments: p.comments || "",
          notificationLanguage: p.notificationLanguage || "en",
          profileImage: null,
        });
        /* array sections */
        if (p.diseases?.length) setDiseases(p.diseases.map((d, i) => ({ ...d, _uid: Date.now() + i })));
        if (p.finalDiagnoses?.length) setFinalDiagnoses(p.finalDiagnoses.map((d, i) => ({ ...d, _uid: Date.now() + 1000 + i })));
        if (p.radiationDoses?.length) setRadiationDoses(p.radiationDoses.map((d, i) => ({ ...d, _uid: Date.now() + 2000 + i })));
        if (p.legalRepresentatives?.length) setLegalReps(p.legalRepresentatives.map((d, i) => ({ ...d, _uid: Date.now() + 3000 + i })));

        if (p.profilePicture) {
          setPreviewImage(`data:image/jpeg;base64,${p.profilePicture}`);
        }
      } catch {
        toast.error(t("error_fetch"));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit, t]);

  /* ── generic handlers ── */
  const set = (name, value) => {
    setForm((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: "" }));
  };

  const onChange = (e) => set(e.target.name, e.target.value);
  const onCheck = (e) => set(e.target.name, e.target.checked);

  const onImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error(t("image_size_error")); return; }
    if (!/image\/(jpeg|jpg|png)/.test(file.type)) { toast.error(t("image_type_error")); return; }
    set("profileImage", file);
    setPreviewImage(URL.createObjectURL(file));
  };

  /* ── validate ── */
  const validate = () => {
    const e = {};
    if (!form.firstName.trim()) e.firstName = t("first_name_required");
    if (!form.lastName.trim()) e.lastName = t("last_name_required");
    if (!form.gender) e.gender = t("gender_required");
    if (!form.dateOfBirth) e.dateOfBirth = t("dob_required");
    if (!form.phoneNumber.trim()) e.phoneNumber = t("phone_required");
    if (form.email.trim() && !/\S+@\S+\.\S+/.test(form.email)) e.email = t("email_invalid");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ── submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      // Append every field from INITIAL_STATE (except profileImage)
      Object.keys(INITIAL_STATE).forEach((key) => {
        if (key === "profileImage") return;
        const val = form[key];
        if (typeof val === "boolean") fd.append(key, val ? "true" : "false");
        else fd.append(key, val ?? "");
      });
      if (form.profileImage) fd.append("profileImage", form.profileImage);

      /* array sections — send as JSON strings */
      fd.append("diseases", JSON.stringify(diseases.map(({ _uid, ...rest }) => rest)));
      fd.append("finalDiagnoses", JSON.stringify(finalDiagnoses.map(({ _uid, ...rest }) => rest)));
      fd.append("radiationDoses", JSON.stringify(radiationDoses.map(({ _uid, ...rest }) => rest)));
      fd.append("legalRepresentatives", JSON.stringify(legalReps.map(({ _uid, ...rest }) => rest)));

      if (isEdit) {
        await updatePatient(id, fd);
        toast.success(t("success_update"));
      } else {
        await addPatient(fd);
        toast.success(t("success_create"));
      }
      navigate("/patients");
    } catch (err) {
      toast.error(err.response?.data?.message || t("failed"));
    } finally {
      setSubmitting(false);
    }
  };

  /* Section is defined outside PatientForm to keep a stable reference */

  if (loading) {
    return (
      <div className="pf-container">
        <div className="pf-card">
          <div className="pf-loading"><div className="pf-spinner" /><span>{t("loading")}</span></div>
        </div>
      </div>
    );
  }

  return (
    <PatientFormUiContext.Provider value={{ form, errors, onChange, onCheck, submitting }}>
      <div className="pf-container">
        <div className="pf-card">
        {/* Header */}
        <div className="pf-header">
          <h2 className="pf-title">{isEdit ? t("title_edit") : t("title_add")}</h2>
          <div className="pf-header-actions">
            <button
              type="submit"
              form="patient-form"
              className="pf-submit-top"
              disabled={submitting}
            >
              {submitting ? t("saving") : (isEdit ? t("save_changes") : t("create_patient"))}
            </button>
            <button
              type="button"
              className="pf-close"
              onClick={() => navigate("/patients")}
              disabled={submitting}
            >
              <FaTimes />
            </button>
          </div>
        </div>

        {/* Photo */}
        <div className="pf-photo-wrap">
          <div className="pf-photo-circle">
            {previewImage ? (
              <img src={previewImage} alt="" className="pf-photo-img" />
            ) : (
              <div className="pf-photo-placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pf-cam-icon">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span className="pf-photo-text">{t("add_photo")}</span>
              </div>
            )}
            <input type="file" accept="image/jpeg,image/jpg,image/png" className="pf-photo-input" onChange={onImageChange} disabled={submitting} />
          </div>
        </div>

        {/* Form */}
        <form id="patient-form" onSubmit={handleSubmit} className="pf-form">

          {/* ═══ BASIC ═══ */}
          <Section id="basic" title={tg("basic_data.title")} open={openSections.basic} onToggle={toggle}>
            <div className="pf-row pf-row--thirds">
              <Field name="lastName" label={tg("common.last_name")} required />
              <Field name="firstName" label={tg("common.first_name")} required />
              <Field name="middleName" label={tg("common.middle_name")} />
            </div>
            <div className="pf-row">
              <div className="pf-field pf-half">
                <label className="pf-label">{tg("common.date_of_birth")} <span className="pf-req">*</span></label>
                <CustomCalendar
                  value={form.dateOfBirth}
                  onChange={(date) => set("dateOfBirth", toDateOnly(date))}
                  maxDate={new Date()}
                  dateFormat="yyyy-MM-dd"
                  className={errors.dateOfBirth ? "pf-input--error" : ""}
                  disabled={submitting}
                />
                {errors.dateOfBirth && <span className="pf-error">{errors.dateOfBirth}</span>}
              </div>
              <div className="pf-field pf-half">
                <label className="pf-label">{tg("common.gender")} <span className="pf-req">*</span></label>
                <div className="pf-gender-toggle">
                  {GENDER_TOGGLES.map((g) => (
                    <button
                      key={g}
                      type="button"
                      className={`pf-gender-btn${(g === "not_specified" ? !form.gender : form.gender === g) ? " pf-gender-btn--active" : ""}`}
                      onClick={() => set("gender", g === "not_specified" ? "" : g)}
                      disabled={submitting}
                    >
                      {genderLabel(g)}
                    </button>
                  ))}
                </div>
                {errors.gender && <span className="pf-error">{errors.gender}</span>}
              </div>
            </div>
            <TextArea name="notes" label={tg("basic_data.note_label")} />
          </Section>

          {/* ═══ LEGAL REPRESENTATIVE ═══ */}
          <Section id="legalRep" title={tg("legal_representative.title")} open={openSections.legalRep} onToggle={toggle}>
            {legalReps.map((rep, idx) => (
              <div className="pf-table-card" key={rep._uid || idx}>
                <div className="pf-table-card-header">
                  <span className="pf-label">{tg("legal_representative.representative")} {idx + 1}</span>
                  <button type="button" className="pf-table-remove-btn" onClick={() => setLegalReps((p) => p.filter((_, i) => i !== idx))} disabled={submitting}><FiX size={14} /></button>
                </div>
                <div className="pf-row pf-row--thirds">
                  <div className="pf-field"><label className="pf-label">{tg("common.last_name")}</label><input className="pf-input" value={rep.lastName || ""} onChange={(e) => setLegalReps((p) => p.map((r, i) => i === idx ? { ...r, lastName: e.target.value } : r))} disabled={submitting} /></div>
                  <div className="pf-field"><label className="pf-label">{tg("common.first_name")}</label><input className="pf-input" value={rep.firstName || ""} onChange={(e) => setLegalReps((p) => p.map((r, i) => i === idx ? { ...r, firstName: e.target.value } : r))} disabled={submitting} /></div>
                  <div className="pf-field"><label className="pf-label">{tg("common.middle_name")}</label><input className="pf-input" value={rep.middleName || ""} onChange={(e) => setLegalReps((p) => p.map((r, i) => i === idx ? { ...r, middleName: e.target.value } : r))} disabled={submitting} /></div>
                </div>
                <div className="pf-row">
                  <div className="pf-field pf-half">
                    <label className="pf-label">{tg("legal_representative.birthday")}</label>
                    <CustomCalendar
                      value={rep.birthday ? isoToDateInput(rep.birthday) : ""}
                      onChange={(date) => setLegalReps((p) => p.map((r, i) => i === idx ? { ...r, birthday: toDateOnly(date) } : r))}
                      dateFormat="yyyy-MM-dd"
                      disabled={submitting}
                    />
                  </div>
                  <div className="pf-field pf-half">
                    <label className="pf-label">{tg("common.gender")}</label>
                    <div className="pf-gender-toggle">
                      {GENDER_TOGGLES.map((g) => (
                        <button key={g} type="button" className={`pf-gender-btn${(g === "not_specified" ? !rep.gender : rep.gender === g) ? " pf-gender-btn--active" : ""}`} onClick={() => setLegalReps((p) => p.map((r, i) => i === idx ? { ...r, gender: g === "not_specified" ? "" : g } : r))} disabled={submitting}>{genderLabel(g)}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="pf-row pf-row--thirds">
                  <div className="pf-field"><label className="pf-label">{tg("legal_representative.relationship")}</label><input className="pf-input" value={rep.relationship || ""} onChange={(e) => setLegalReps((p) => p.map((r, i) => i === idx ? { ...r, relationship: e.target.value } : r))} disabled={submitting} /></div>
                  <div className="pf-field"><label className="pf-label">{tg("legal_representative.attitude")}</label><input className="pf-input" value={rep.attitudeToPatient || ""} onChange={(e) => setLegalReps((p) => p.map((r, i) => i === idx ? { ...r, attitudeToPatient: e.target.value } : r))} disabled={submitting} /></div>
                  <div className="pf-field"><label className="pf-label">{tg("legal_representative.document_of_authority")}</label><input className="pf-input" value={rep.documentOfAuthority || ""} onChange={(e) => setLegalReps((p) => p.map((r, i) => i === idx ? { ...r, documentOfAuthority: e.target.value } : r))} disabled={submitting} /></div>
                </div>
                <div className="pf-row pf-checkboxes">
                  <label className="pf-checkbox"><input type="checkbox" checked={!!rep.isCurrent} onChange={(e) => setLegalReps((p) => p.map((r, i) => i === idx ? { ...r, isCurrent: e.target.checked } : r))} disabled={submitting} /><span>{t("legal_rep_current")}</span></label>
                </div>

                {/* Identity card */}
                <div className="pf-addr-group-title" style={{ marginTop: 12 }}>{tg("common.identity_card")}</div>
                <div className="pf-row pf-row--thirds">
                  <div className="pf-field"><label className="pf-label">{tg("common.document_type")}</label><input className="pf-input" placeholder={tg("common.document_type_placeholder")} value={rep.documentType || ""} onChange={(e) => setLegalReps((p) => p.map((r, i) => i === idx ? { ...r, documentType: e.target.value } : r))} disabled={submitting} /></div>
                  <div className="pf-field"><label className="pf-label">{tg("common.series")}</label><input className="pf-input" placeholder={tg("common.series_placeholder")} value={rep.series || ""} onChange={(e) => setLegalReps((p) => p.map((r, i) => i === idx ? { ...r, series: e.target.value } : r))} disabled={submitting} /></div>
                  <div className="pf-field"><label className="pf-label">{tg("common.number")}</label><input className="pf-input" placeholder={tg("common.number_placeholder")} value={rep.number || ""} onChange={(e) => setLegalReps((p) => p.map((r, i) => i === idx ? { ...r, number: e.target.value } : r))} disabled={submitting} /></div>
                </div>
                <div className="pf-row">
                  <div className="pf-field pf-half">
                    <label className="pf-label">{tg("common.when_issued")}</label>
                    <CustomCalendar
                      value={rep.whenIssued ? isoToDateInput(rep.whenIssued) : ""}
                      onChange={(date) => setLegalReps((p) => p.map((r, i) => i === idx ? { ...r, whenIssued: toDateOnly(date) } : r))}
                      dateFormat="yyyy-MM-dd"
                      disabled={submitting}
                    />
                  </div>
                  <div className="pf-field pf-half">
                    <label className="pf-label">{tg("common.issued_by")}</label>
                    <input className="pf-input" placeholder={tg("common.issued_by_placeholder")} value={rep.issuedBy || ""} onChange={(e) => setLegalReps((p) => p.map((r, i) => i === idx ? { ...r, issuedBy: e.target.value } : r))} disabled={submitting} />
                  </div>
                </div>

                {/* Representative information */}
                <div className="pf-addr-group-title" style={{ marginTop: 12 }}>{tg("legal_representative.representative_info")}</div>
                <div className="pf-row pf-row--thirds">
                  <div className="pf-field"><label className="pf-label">{tg("legal_representative.subject_of_russia")}</label><input className="pf-input" placeholder={tg("legal_representative.subject_of_russia_placeholder")} value={rep.subjectOfRussia || ""} onChange={(e) => setLegalReps((p) => p.map((r, i) => i === idx ? { ...r, subjectOfRussia: e.target.value } : r))} disabled={submitting} /></div>
                  <div className="pf-field"><label className="pf-label">{tg("common.district")}</label><input className="pf-input" placeholder={tg("common.district_placeholder")} value={rep.district || ""} onChange={(e) => setLegalReps((p) => p.map((r, i) => i === idx ? { ...r, district: e.target.value } : r))} disabled={submitting} /></div>
                  <div className="pf-field"><label className="pf-label">{tg("common.city")}</label><input className="pf-input" placeholder={tg("common.city_placeholder")} value={rep.city || ""} onChange={(e) => setLegalReps((p) => p.map((r, i) => i === idx ? { ...r, city: e.target.value } : r))} disabled={submitting} /></div>
                </div>
                <div className="pf-row pf-row--thirds">
                  <div className="pf-field"><label className="pf-label">{tg("common.street")}</label><input className="pf-input" placeholder={tg("common.street_placeholder")} value={rep.street || ""} onChange={(e) => setLegalReps((p) => p.map((r, i) => i === idx ? { ...r, street: e.target.value } : r))} disabled={submitting} /></div>
                  <div className="pf-field"><label className="pf-label">{tg("common.house")}</label><input className="pf-input" placeholder={tg("common.house_placeholder")} value={rep.house || ""} onChange={(e) => setLegalReps((p) => p.map((r, i) => i === idx ? { ...r, house: e.target.value } : r))} disabled={submitting} /></div>
                  <div className="pf-field"><label className="pf-label">{tg("common.apartment")}</label><input className="pf-input" placeholder={tg("common.apartment_placeholder")} value={rep.apartment || ""} onChange={(e) => setLegalReps((p) => p.map((r, i) => i === idx ? { ...r, apartment: e.target.value } : r))} disabled={submitting} /></div>
                </div>
                <div className="pf-row">
                  <div className="pf-field pf-half">
                    <label className="pf-label">{tg("legal_representative.state")}</label>
                    <input className="pf-input" placeholder={tg("legal_representative.state_placeholder")} value={rep.state || ""} onChange={(e) => setLegalReps((p) => p.map((r, i) => i === idx ? { ...r, state: e.target.value } : r))} disabled={submitting} />
                  </div>
                </div>
              </div>
            ))}
            <button type="button" className="pf-add-row-btn" onClick={() => setLegalReps((p) => [...p, { _uid: Date.now(), lastName: "", firstName: "", middleName: "", birthday: "", gender: "", relationship: "", attitudeToPatient: "", documentOfAuthority: "", isCurrent: false, documentType: "", series: "", number: "", whenIssued: "", issuedBy: "", subjectOfRussia: "", district: "", city: "", street: "", house: "", apartment: "", state: "" }])} disabled={submitting}><FiPlus size={14} /> {tg("legal_representative.add_representation")}</button>
          </Section>

          {/* ═══ CONTACTS ═══ */}
          <Section id="contacts" title={tg("contacts.title")} open={openSections.contacts} onToggle={toggle}>
            <div className="pf-row">
              <div className="pf-field pf-half">
                <label className="pf-label">{tg("contacts.telephone")} <span className="pf-req">*</span></label>
                <PhoneInput
                  country="ru"
                  value={form.phoneNumber}
                  onChange={(v) => set("phoneNumber", v)}
                  containerClass="pf-phone-container"
                  inputClass={errors.phoneNumber ? "pf-phone-error" : ""}
                  disabled={submitting}
                />
                {errors.phoneNumber && <span className="pf-error">{errors.phoneNumber}</span>}
              </div>
              <div className="pf-field pf-half">
                <label className="pf-label">{tg("contacts.additional_phone")}</label>
                <PhoneInput
                  country="ru"
                  value={form.additionalPhone}
                  onChange={(v) => set("additionalPhone", v)}
                  containerClass="pf-phone-container"
                  disabled={submitting}
                />
              </div>
            </div>
            <div className="pf-row">
              <Field name="maxId" label={tg("contacts.max")} half />
              <Field name="email" label={tg("contacts.email")} type="email" half />
            </div>
            <div className="pf-row">
              <Field name="telegramId" label={tg("contacts.telegram_id_placeholder")} />
            </div>
            <div className="pf-row pf-checkboxes">
              <Checkbox name="newsletter" label={tg("contacts.newsletter_agree")} />
              <Checkbox name="egisz" label={tg("contacts.egisz_short")} />
            </div>
            <div className="pf-social-section">
              <label className="pf-label">{tg("contacts.social_networks")}</label>
              <div className="pf-social-grid">
                {SOCIAL_ICONS.map(({ key, bg, svg }) => (
                  <div className="pf-social-item" key={key}>
                    <span className={`pf-social-icon ${bg}`}>{svg}</span>
                    <input
                      className="pf-input pf-social-input"
                      name={key}
                      value={form[key]}
                      onChange={onChange}
                      placeholder={tg("contacts.social_add_link_placeholder")}
                      disabled={submitting}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="pf-row">
              <Field name="contactPerson" label={tg("contacts.contact_person")} half />
              <div className="pf-field pf-half">
                <label className="pf-label">{tg("contacts.contact_person_phone_placeholder")}</label>
                <PhoneInput
                  country="ru"
                  value={form.contactPersonPhone}
                  onChange={(v) => set("contactPersonPhone", v)}
                  containerClass="pf-phone-container"
                  disabled={submitting}
                />
              </div>
            </div>
          </Section>

          {/* ═══ DOCUMENTS ═══ */}
          <Section id="documents" title={tg("documents.title")} open={openSections.documents} onToggle={toggle}>
            <div className="pf-row">
              <Field name="cmip" label={tg("documents.cmip_label")} half />
              <div className="pf-field pf-half">
                <label className="pf-label">{tg("documents.date_of_issue")}</label>
                <CustomCalendar
                  value={form.cmipDate}
                  onChange={(date) => set("cmipDate", toDateOnly(date))}
                  dateFormat="yyyy-MM-dd"
                  disabled={submitting}
                />
              </div>
            </div>
            <div className="pf-row">
              <Field name="cmipOrgCode" label={tg("documents.org_code")} half />
              <Field name="snils" label={tg("common.snils")} half />
            </div>
            <div className="pf-row">
              <Field name="medInsuranceOrg" label={tg("documents.med_insurance_org")} half />
              <Field name="socialSupportCode" label={tg("documents.social_support_code")} half />
            </div>
            <div className="pf-row">
              <div className="pf-field pf-half">
                <label className="pf-label">{tg("documents.citizenship")}</label>
                <select
                  name="citizenship"
                  className="pf-input"
                  value={form.citizenship}
                  onChange={onChange}
                  disabled={submitting}
                >
                  <option value="">{tg("common.select_default")}</option>
                  {CITIZENSHIP_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>{tg(o.labelKey)}</option>
                  ))}
                </select>
              </div>
              <div className="pf-field pf-half">
                <label className="pf-label">{tg("common.document_type")}</label>
                <select
                  name="documentType"
                  className="pf-input"
                  value={form.documentType}
                  onChange={onChange}
                  disabled={submitting}
                >
                  <option value="">{tg("common.select_default")}</option>
                  {DOCUMENT_TYPE_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>{tg(o.labelKey)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="pf-row">
              <Field name="documentSeries" label={tg("documents.series")} half />
              <Field name="documentNumber" label={tg("documents.number")} half />
            </div>
            <div className="pf-row">
              <div className="pf-field pf-half">
                <label className="pf-label">{tg("documents.when_issued")}</label>
                <CustomCalendar
                  value={form.documentIssuedDate}
                  onChange={(date) => set("documentIssuedDate", toDateOnly(date))}
                  dateFormat="yyyy-MM-dd"
                  disabled={submitting}
                />
              </div>
              <Field name="departmentCode" label={tg("documents.department_code")} half />
            </div>
            <div className="pf-row">
              <Field name="documentIssuedBy" label={tg("documents.issued_by")} half />
              <Field name="inn" label={tg("documents.inn_label")} half />
            </div>
          </Section>

          {/* ═══ ADDRESS ═══ */}
          <Section id="address" title={tg("address.title")} open={openSections.address} onToggle={toggle}>
            {/* Group 01 — Regional Location */}
            <div className="pf-addr-group">
              <div className="pf-addr-group-title">
                <span className="pf-addr-num">01</span> {tg("address.group_01")}
              </div>
              <div className="pf-row">
                <Field name="region" label={tg("address.region")} half />
                <Field name="district" label={tg("address.district")} half />
              </div>
              <div className="pf-row">
                <Field name="city" label={tg("address.city")} />
              </div>
            </div>

            {/* Group 02 — Street Address */}
            <div className="pf-addr-group">
              <div className="pf-addr-group-title">
                <span className="pf-addr-num">02</span> {tg("address.group_02")}
              </div>
              <div className="pf-row pf-row--3-1">
                <Field name="street" label={tg("address.street")} />
                <Field name="house" label={tg("address.house_number")} />
              </div>
              <div className="pf-row">
                <div className="pf-field pf-half">
                  <label className="pf-label">{tg("address.terrain_type")}</label>
                  <select
                    name="terrain"
                    className="pf-input"
                    value={form.terrain || ""}
                    onChange={onChange}
                    disabled={submitting}
                  >
                    <option value="">{tg("address.terrain_all")}</option>
                    <option value="urban">{tg("address.terrain_urban")}</option>
                    <option value="rural">{tg("address.terrain_rural")}</option>
                  </select>
                </div>
                <Field name="apartment" label={tg("address.apartment_unit")} half />
              </div>
              <Field name="postcode" label={tg("address.index")} />
            </div>
          </Section>

          {/* ═══ DISEASES ═══ */}
          <Section id="diseases" title={tg("diseases.title")} open={openSections.diseases} onToggle={toggle}>
            {diseases.length > 0 && (
              <div className="pf-table-header pf-table-row--diseases">
                <span className="pf-label">{tg("diseases.col_start")}</span>
                <span className="pf-label">{tg("diseases.col_end")}</span>
                <span className="pf-label">{tg("diseases.col_diagnosis")}</span>
                <span className="pf-label">{tg("diseases.col_icd_code")}</span>
                <span className="pf-label">{tg("diseases.col_doctor")}</span>
                <span />
              </div>
            )}
            {diseases.map((row, idx) => (
              <div className="pf-table-row pf-table-row--diseases" key={row._uid || idx}>
                <CustomCalendar
                  value={isoToDateInput(row.startDate)}
                  onChange={(date) => setDiseases((p) => p.map((r, i) => i === idx ? { ...r, startDate: toDateOnly(date) } : r))}
                  dateFormat="yyyy-MM-dd"
                  disabled={submitting}
                />
                <CustomCalendar
                  value={isoToDateInput(row.endDate)}
                  onChange={(date) => setDiseases((p) => p.map((r, i) => i === idx ? { ...r, endDate: toDateOnly(date) } : r))}
                  dateFormat="yyyy-MM-dd"
                  disabled={submitting}
                />
                <DiseaseCodeSearch
                  displayMode="name"
                  placeholder={tg("diseases.placeholder_diagnosis")}
                  value={row.diagnosis || ""}
                  onChange={(val) => setDiseases((p) => p.map((r, i) => i === idx ? { ...r, diagnosis: val } : r))}
                  onSelect={({ code, name }) => setDiseases((p) => p.map((r, i) => i === idx ? { ...r, diagnosis: name, icdCode: code } : r))}
                  disabled={submitting}
                />
                <DiseaseCodeSearch
                  displayMode="code"
                  placeholder={tg("diseases.placeholder_icd_code")}
                  value={row.icdCode || ""}
                  onChange={(val) => setDiseases((p) => p.map((r, i) => i === idx ? { ...r, icdCode: val } : r))}
                  onSelect={({ code, name }) => setDiseases((p) => p.map((r, i) => i === idx ? { ...r, icdCode: code, diagnosis: name } : r))}
                  disabled={submitting}
                />
                <DoctorDropdown
                  value={row.doctor || ""}
                  onChange={(val) => setDiseases((p) => p.map((r, i) => i === idx ? { ...r, doctor: val } : r))}
                  doctors={doctorsList}
                  getDoctorDisplayName={getDoctorDisplayName}
                  placeholder={tg("diseases.placeholder_doctor")}
                  disabled={submitting}
                />
                <button type="button" className="pf-table-remove-btn" onClick={() => setDiseases((p) => p.filter((_, i) => i !== idx))} disabled={submitting}><FiX size={14} /></button>
              </div>
            ))}
            <button type="button" className="pf-add-row-btn" onClick={() => setDiseases((p) => [...p, { _uid: Date.now(), startDate: "", endDate: "", diagnosis: "", icdCode: "", doctor: "" }])} disabled={submitting}><FiPlus size={14} /> {tg("diseases.add_disease")}</button>
          </Section>

          {/* ═══ FINAL DIAGNOSIS ═══ */}
          <Section id="finalDiagnosis" title={tg("final_diagnosis.title")} open={openSections.finalDiagnosis} onToggle={toggle}>
            {finalDiagnoses.length > 0 && (
              <div className="pf-table-header pf-table-row--diagnosis">
                <span className="pf-label">{tg("final_diagnosis.col_date")}</span>
                <span className="pf-label">{tg("final_diagnosis.col_diagnosis")}</span>
                <span className="pf-label">{tg("final_diagnosis.col_icd_code")}</span>
                <span className="pf-label">{tg("final_diagnosis.col_type")}</span>
                <span className="pf-label">{tg("final_diagnosis.col_doctor_name")}</span>
                <span className="pf-label">{tg("final_diagnosis.col_speciality")}</span>
                <span />
              </div>
            )}
            {finalDiagnoses.map((row, idx) => (
              <div className="pf-table-row pf-table-row--diagnosis" key={row._uid || idx}>
                <CustomCalendar
                  value={isoToDateInput(row.date)}
                  onChange={(date) => setFinalDiagnoses((p) => p.map((r, i) => i === idx ? { ...r, date: toDateOnly(date) } : r))}
                  dateFormat="yyyy-MM-dd"
                  disabled={submitting}
                />
                <input className="pf-input" placeholder={tg("final_diagnosis.placeholder_diagnosis")} value={row.diagnosis || ""} onChange={(e) => setFinalDiagnoses((p) => p.map((r, i) => i === idx ? { ...r, diagnosis: e.target.value } : r))} disabled={submitting} />
                <DiseaseCodeSearch
                  placeholder={tg("final_diagnosis.placeholder_icd")}
                  value={row.icdCode || ""}
                  onChange={(val) => setFinalDiagnoses((p) => p.map((r, i) => i === idx ? { ...r, icdCode: val } : r))}
                  disabled={submitting}
                />
                <select className="pf-input" value={row.primary || "1"} onChange={(e) => setFinalDiagnoses((p) => p.map((r, i) => i === idx ? { ...r, primary: e.target.value } : r))} disabled={submitting}><option value="1">1</option><option value="2">2</option></select>
                <DoctorDropdown
                  value={row.doctorName || ""}
                  onChange={(val) => setFinalDiagnoses((p) => p.map((r, i) => i === idx ? { ...r, doctorName: val } : r))}
                  doctors={doctorsList}
                  getDoctorDisplayName={getDoctorDisplayName}
                  placeholder={tg("final_diagnosis.placeholder_full_name")}
                  disabled={submitting}
                  onDoctorSelect={(doctor) => {
                    const specialties = (doctor.specialtyIds || []).map(s => s[`name_${lang}`] || s.name_en || "").filter(Boolean);
                    setRowDoctorSpecialties((prev) => ({ ...prev, [row._uid]: specialties }));
                  }}
                />
                <SpecialityDropdown
                  value={row.speciality || ""}
                  onChange={(val) => setFinalDiagnoses((p) => p.map((r, i) => i === idx ? { ...r, speciality: val } : r))}
                  options={rowDoctorSpecialties[row._uid] || []}
                  placeholder={tg("final_diagnosis.placeholder_speciality")}
                  disabled={submitting}
                />
                <button type="button" className="pf-table-remove-btn" onClick={() => setFinalDiagnoses((p) => p.filter((_, i) => i !== idx))} disabled={submitting}><FiX size={14} /></button>
              </div>
            ))}
            <button type="button" className="pf-add-row-btn" onClick={() => setFinalDiagnoses((p) => [...p, { _uid: Date.now(), date: "", diagnosis: "", icdCode: "", primary: "1", doctorName: "", speciality: "" }])} disabled={submitting}><FiPlus size={14} /> {tg("final_diagnosis.add_diagnosis")}</button>
          </Section>

          {/* ═══ PERSONAL ═══ */}
          <Section id="personal" title={tg("personal_data.title")} open={openSections.personal} onToggle={toggle}>
            <div className="pf-row">
              <div className="pf-field pf-half">
                <label className="pf-label">{tg("personal_data.marital_status")}</label>
                <select
                  name="maritalStatus"
                  className="pf-input"
                  value={form.maritalStatus}
                  onChange={onChange}
                  disabled={submitting}
                >
                  <option value="">{tg("common.select_default")}</option>
                  {MARITAL_STATUS_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>{tg(o.labelKey)}</option>
                  ))}
                </select>
              </div>
              <div className="pf-field pf-half">
                <label className="pf-label">{tg("personal_data.education")}</label>
                <select
                  name="education"
                  className="pf-input"
                  value={form.education}
                  onChange={onChange}
                  disabled={submitting}
                >
                  <option value="">{tg("common.select_default")}</option>
                  {EDUCATION_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>{tg(o.labelKey)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="pf-row">
              <div className="pf-field pf-half">
                <label className="pf-label">{tg("personal_data.employment")}</label>
                <select
                  name="employment"
                  className="pf-input"
                  value={form.employment}
                  onChange={onChange}
                  disabled={submitting}
                >
                  <option value="">{tg("common.select_default")}</option>
                  {EMPLOYMENT_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>{tg(o.labelKey)}</option>
                  ))}
                </select>
              </div>
              <Field name="placeOfWork" label={tg("personal_data.place_of_work")} half />
            </div>
            <div className="pf-row">
              <Field name="workSpecialty" label={tg("personal_data.job_title")} half />
              <Field name="changePlaceOfWork" label={tg("personal_data.change_place_of_work")} half />
            </div>
            <div className="pf-row">
              <Field name="changeOfPosition" label={tg("personal_data.change_of_position")} half />
            </div>
          </Section>

          {/* ═══ DISABILITY ═══ */}
          <Section id="disability" title={tg("disability.title")} open={openSections.disability} onToggle={toggle}>
            <div className="pf-row">
              <div className="pf-field pf-half">
                <label className="pf-label">{tg("disability.disability_label")}</label>
                <div className="pf-gender-toggle">
                  {["", "Yes", "No"].map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={`pf-gender-btn${form.disability === v ? " pf-gender-btn--active" : ""}`}
                      onClick={() => set("disability", v)}
                      disabled={submitting}
                    >
                      {v === "" ? tg("common.not_specified") : t(`disability_${v.toLowerCase()}`)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="pf-row">
              <div className="pf-field pf-half">
                <label className="pf-label">{tg("disability.period_from")}</label>
                <CustomCalendar
                  value={form.disabilityFrom}
                  onChange={(date) => set("disabilityFrom", toDateOnly(date))}
                  dateFormat="yyyy-MM-dd"
                  disabled={submitting}
                />
              </div>
              <div className="pf-field pf-half">
                <label className="pf-label">{tg("disability.period_to")}</label>
                <CustomCalendar
                  value={form.disabilityTo}
                  onChange={(date) => set("disabilityTo", toDateOnly(date))}
                  dateFormat="yyyy-MM-dd"
                  disabled={submitting}
                />
              </div>
            </div>
            <div className="pf-row pf-checkboxes">
              <Checkbox name="disabilityIndefinitely" label={tg("disability.indefinitely")} />
            </div>
            <div className="pf-row">
              <div className="pf-field pf-half">
                <label className="pf-label">{tg("disability.group")}</label>
                <select
                  name="invalidGroup"
                  className="pf-input"
                  value={form.invalidGroup}
                  onChange={onChange}
                  disabled={submitting}
                >
                  <option value="">{tg("common.select_default")}</option>
                  {DISABILITY_GROUP_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>{tg(o.labelKey)}</option>
                  ))}
                </select>
              </div>
              <div className="pf-field pf-half">
                <label className="pf-label">{tg("disability.type_label")}</label>
                <select
                  name="disabilityType"
                  className="pf-input"
                  value={form.disabilityType}
                  onChange={onChange}
                  disabled={submitting}
                >
                  <option value="">{tg("common.select_default")}</option>
                  {DISABILITY_TYPE_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>{tg(o.labelKey)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="pf-row">
              <div className="pf-field pf-half">
                <label className="pf-label">{tg("disability.primary_repeated_view")}</label>
                <div className="pf-gender-toggle">
                  {["Primary", "Repeated"].map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={`pf-gender-btn${form.disabilityPrimaryRepeated === v ? " pf-gender-btn--active" : ""}`}
                      onClick={() => set("disabilityPrimaryRepeated", form.disabilityPrimaryRepeated === v ? "" : v)}
                      disabled={submitting}
                    >
                      {v === "Primary" ? tg("disability.primary") : tg("disability.repeated")}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* ═══ ANAMNESIS ═══ */}
          <Section id="anamnesis" title={tg("anamnesis.title")} open={openSections.anamnesis} onToggle={toggle}>
            <TextArea name="anamnesisDisability" label={tg("anamnesis.disability")} />
            <div className="pf-row">
              <Field name="bloodGroup" label={tg("anamnesis.blood_group")} half />
              <Field name="rhFactor" label={tg("anamnesis.rh_factor")} half />
            </div>
            <div className="pf-row">
              <Field name="kellAntigen" label={tg("anamnesis.kell_antigen")} half />
              <Field name="otherBloodInfo" label={tg("anamnesis.other_blood_info")} half />
            </div>
            <TextArea name="allergies" label={tg("anamnesis.allergies")} />
          </Section>

          {/* ═══ RADIATION DOSES ═══ */}
          <Section id="radiationDoses" title={tg("radiation_doses.title")} open={openSections.radiationDoses} onToggle={toggle}>
            {radiationDoses.length > 0 && (
              <div className="pf-table-header pf-table-row--radiation">
                <span className="pf-label">{tg("radiation_doses.col_date")}</span>
                <span className="pf-label">{tg("radiation_doses.col_type")}</span>
                <span className="pf-label">{tg("radiation_doses.col_effective_dose")}</span>
                <span className="pf-label">{tg("radiation_doses.col_note")}</span>
                <span />
              </div>
            )}
            {radiationDoses.map((row, idx) => (
              <div className="pf-table-row pf-table-row--radiation" key={row._uid || idx}>
                <CustomCalendar
                  value={isoToDateInput(row.date)}
                  onChange={(date) => setRadiationDoses((p) => p.map((r, i) => i === idx ? { ...r, date: toDateOnly(date) } : r))}
                  dateFormat="yyyy-MM-dd"
                  disabled={submitting}
                />
                <input className="pf-input" placeholder={tg("radiation_doses.placeholder_type")} value={row.researchType || ""} onChange={(e) => setRadiationDoses((p) => p.map((r, i) => i === idx ? { ...r, researchType: e.target.value } : r))} disabled={submitting} />
                <input className="pf-input" placeholder={tg("radiation_doses.placeholder_dose")} value={row.effectiveDose || ""} onChange={(e) => setRadiationDoses((p) => p.map((r, i) => i === idx ? { ...r, effectiveDose: e.target.value } : r))} disabled={submitting} />
                <input className="pf-input" placeholder={tg("radiation_doses.placeholder_note")} value={row.note || ""} onChange={(e) => setRadiationDoses((p) => p.map((r, i) => i === idx ? { ...r, note: e.target.value } : r))} disabled={submitting} />
                <button type="button" className="pf-table-remove-btn" onClick={() => setRadiationDoses((p) => p.filter((_, i) => i !== idx))} disabled={submitting}><FiX size={14} /></button>
              </div>
            ))}
            <button type="button" className="pf-add-row-btn" onClick={() => setRadiationDoses((p) => [...p, { _uid: Date.now(), date: "", researchType: "", effectiveDose: "", note: "" }])} disabled={submitting}><FiPlus size={14} /> {tg("radiation_doses.add_record")}</button>
          </Section>

          {/* ═══ COMMENTS ═══ */}
          <Section id="system" title={t("comments")} open={openSections.system} onToggle={toggle}>
            <TextArea name="comments" label={t("comments")} />
            <div className="pf-row">
              <div className="pf-field pf-half">
                <label className="pf-label">{t("notification_language")}</label>
                <div className="pf-gender-toggle">
                  {[{ v: "en", l: "English" }, { v: "ru", l: "Русский" }].map(({ v, l }) => (
                    <button
                      key={v}
                      type="button"
                      className={`pf-gender-btn${form.notificationLanguage === v ? " pf-gender-btn--active" : ""}`}
                      onClick={() => set("notificationLanguage", v)}
                      disabled={submitting}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Section>
        </form>
        </div>
      </div>
    </PatientFormUiContext.Provider>
  );
}

export default PatientForm;
