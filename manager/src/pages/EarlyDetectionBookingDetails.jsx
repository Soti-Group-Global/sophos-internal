import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getApptStatusClass } from "../utils/appointmentStatus";
import {
  ArrowLeft,
  User,
  Calendar,
  CheckCircle,
  Clock,
  Edit2,
  Trash2,
  FileText,
  Copy,
  Check,
  Plus,
  ExternalLink,
  ChevronDown,
  Save,
  Eye,
  Download,
  MoreVertical,
  Globe,
  Pencil,
  Settings,
  X,
  ChevronsRight,
  ChevronsLeft,
} from "lucide-react";
import { toast } from "react-toastify";
import {
  getEarlyDetectionBookings,
  getEarlyDetectionDoctors,
  updateEarlyDetectionBooking,
  updateEarlyDetectionBookingStatus,
  addEarlyDetectionBookingNote,
  updateEarlyDetectionBookingNote,
  deleteEarlyDetectionBookingNote,
  generateEDPaymentLink,
  updateEarlyDetectionPaymentStatus,
  getEarlyDetectionManagedTests,
  createEarlyDetectionManagedTest,
  updateEarlyDetectionManagedTest,
  deleteEarlyDetectionManagedTest,
  getDoctorAppointmentsByDate,
  getDoctorBreaks,
  getDoctorLeaves,
  uploadEarlyDetectionScheduleFile,
  getEarlyDetectionScheduleFileUrl,
  saveEarlyDetectionSpecialistHistoryForm,
  addEarlyDetectionTestEntryNote,
  updateEarlyDetectionTestEntryNote,
  deleteEarlyDetectionTestEntryNote,
} from "../utils/api";
import { createPortal } from "react-dom";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import GeneralInformationTab from "./AppointmentDetails/GeneralInformationTab";
import CustomCalendar from "../components/CustomCalendar/CustomCalendar";
import CustomTimePicker from "../components/CustomTimePicker/CustomTimePicker";
import RichTextEditor from "../components/RichTextEditor/RichTextEditor";
import SpecialistHistoryForm from "../components/SpecialistHistoryForm/SpecialistHistoryForm";
import EarlyDetectionReportTab from "./EarlyDetectionReport/EarlyDetectionReportTab";
import "../styles/EarlyDetectionBookingDetails.css";
import "./AppointmentDetailsPage.css";

const CLINIC_INFO_ED = {
  name: "Медицинский центр «СОФОС»",
  phone: "+7-495-324-11-11",
  website: "www.sophos-med.ru",
  address: "ООО «ЭЙЧДИ КЛИНИК» · Бизнес-центр 'Квартал West' · Аминьевское Шоссе, 6, Москва, 119517",
  email: "contact@sophos-med.ru",
};

function EDSectionPDFModal({ title, commentHtml, files, booking, onClose }) {
  const reportRef = useRef(null);
  const [generating, setGenerating] = useState(false);
  const bookingNum = booking?.invoiceNumber || booking?.bookingNumber || booking?._id || "report";

  const handleDownload = async () => {
    if (!reportRef.current) return;
    setGenerating(true);
    try {
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const A4_W_MM = 210, A4_H_MM = 297, SCALE = 2, PAGE_H_PX = 1123;
      const pageEls = Array.from(reportRef.current.querySelectorAll(".ed-page"));
      for (let i = 0; i < pageEls.length; i++) {
        const el = pageEls[i];
        const elH = Math.round(el.getBoundingClientRect().height);
        const canvas = await html2canvas(el, { scale: SCALE, useCORS: true, allowTaint: true, backgroundColor: "#ffffff", width: 794, height: elH });
        const canvasPageH = PAGE_H_PX * SCALE;
        const totalSlices = Math.max(1, Math.ceil(canvas.height / canvasPageH));
        for (let s = 0; s < totalSlices; s++) {
          if (i > 0 || s > 0) pdf.addPage();
          const srcY = s * canvasPageH;
          const srcH = Math.min(canvasPageH, canvas.height - srcY);
          if (srcH <= 0) break;
          const sc = document.createElement("canvas");
          sc.width = canvas.width; sc.height = srcH;
          const ctx = sc.getContext("2d");
          ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, sc.width, srcH);
          ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
          pdf.addImage(sc.toDataURL("image/jpeg", 0.98), "JPEG", 0, 0, A4_W_MM, (srcH / canvasPageH) * A4_H_MM);
        }
      }
      pdf.save(`section_${bookingNum}.pdf`);
    } finally { setGenerating(false); }
  };

  return createPortal(
    <div className="ht-spdf-overlay" onClick={onClose}>
      <div className="ht-spdf-container" onClick={(e) => e.stopPropagation()}>
        <div className="ht-spdf-toolbar">
          <button className="ht-spdf-download-btn" onClick={handleDownload} disabled={generating}>
            <Download size={14} />{generating ? "Генерация..." : "Скачать PDF"}
          </button>
          <button className="ht-spdf-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="ht-spdf-preview">
          <div ref={reportRef} className="ed-report-doc">
            <div className="ed-page">
              <div className="ed-page-header">
                <img src="/logo_ru.png" alt="Logo" className="ed-header-logo" />
                <div className="ed-header-clinic">
                  <span className="ed-header-clinic-name">{CLINIC_INFO_ED.name}</span>
                  <span className="ed-header-clinic-contact">{CLINIC_INFO_ED.phone} &nbsp; | &nbsp; {CLINIC_INFO_ED.website}</span>
                </div>
              </div>
              <hr className="ed-header-line" />
              <div className="ed-conclusions-body">
                <div className="ed-field-title" style={{ marginBottom: 16 }}>{title}</div>
                <div className="ed-section-content-text" dangerouslySetInnerHTML={{ __html: commentHtml || "<p>—</p>" }} />
              </div>
              <div className="ed-page-footer">
                <span>{CLINIC_INFO_ED.address}</span>
                <span>тел: <strong>{CLINIC_INFO_ED.phone}</strong> &nbsp;|&nbsp; {CLINIC_INFO_ED.website}</span>
              </div>
              <div className="ed-page-footer-bar">
                ИНН 9727077651 &nbsp;·&nbsp; ОГРН 1247700412068 &nbsp;·&nbsp; Ежедневно с 09:00 до 21:00
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

const ED_PACKAGES = [{ id: "predict", name: "«ПРЕДИКТ»", price: 99500 }];

const ED_ADDONS = [
  { id: "predict-plus", name: "Апгрейд «ПРЕДИКТ+5»", price: 98000 },
  { id: "ct", name: "НДКТ грудной клетки", price: 11700 },
  { id: "mri", name: "МРТ головного мозга", price: 12000 },
  { id: "endoscopy", name: "Гастроскопия + колоноскопия", price: 28500 },
  { id: "mammography", name: "Маммография с томосинтезом", price: 12000 },
  { id: "oncosearch", name: "Онкопоиск", price: 50000 },
  { id: "insurance", name: "Онкострахование", price: 35000 },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: "tbank", label: "T-Bank" },
  { value: "vtb", label: "VTB" },
  { value: "yandex", label: "Yandex" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cash", label: "Cash" },
  { value: "payment_terminal", label: "Payment Terminal" },
  { value: "manual_admin", label: "Manual (Admin)" },
];


const SPECIALTY_ALIASES = {
  ultrasound: [
    "ultrasound",
    "ultrasound diagnostics",
    "sonologist",
    "ultrasonography",
    "diagnostic",
    "узи",
    "ультразв",
    "ультразву",
    "ультразвуковая",
    "ультразвуковой",
    "функциональная диагностика",
    "функцион",
  ],
  gynecologist: [
    "gynecologist",
    "gynaecologist",
    "gynecology",
    "oncogynecology",
    "obstetric",
    "гинеколог",
    "гинекологи",
    "онкогинек",
  ],
  therapist: [
    "therapist",
    "therapy",
    "internal medicine",
    "general practitioner",
    "general practice",
    "physician",
    "терапевт",
    "терапия",
  ],
  dermatologist: [
    "dermatologist",
    "dermatology",
    "dermatovenerology",
    "дерматолог",
    "дерматологи",
    "дерматовенер",
  ],
  ophthalmologist: [
    "ophthalmologist",
    "ophthalmology",
    "oculist",
    "офтальмолог",
    "офтальмологи",
  ],
  surgeon: ["surgeon", "surgery", "surgical", "хирург", "хирурги", "хирургия"],
  ent: [
    "ent",
    "otolaryngologist",
    "otorhinolaryngologist",
    "otorhinolaryngology",
    "лор",
    "оториноларинголог",
    "отоларинголог",
  ],
};

const normalizeMatchText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const toLocalDateOnly = (value) => {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
    return value;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatLocalDateOnly = (value) => {
  const dateOnly = toLocalDateOnly(value);
  if (!dateOnly) return "-";
  const [y, m, d] = dateOnly.split("-").map(Number);
  if (!y || !m || !d) return "-";
  return `${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}-${y}`;
};

const normalizeId = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number")
    return String(value);

  if (typeof value === "object") {
    if (typeof value.toHexString === "function") return value.toHexString();
    if (typeof value.$oid === "string") return value.$oid;
    if (typeof value._id === "string" || typeof value._id === "number")
      return String(value._id);
    if (typeof value.id === "string" || typeof value.id === "number")
      return String(value.id);
  }

  return "";
};

const getDoctorSpecialtyNames = (doctor) => {
  const specialties = Array.isArray(doctor?.specialtyIds) ? doctor.specialtyIds : [];
  const subSpecialties = Array.isArray(doctor?.subSpecialityIds) ? doctor.subSpecialityIds : [];

  const names = [...specialties, ...subSpecialties]
    .flatMap((s) => {
      if (!s) return [];
      if (typeof s === "object") return [s.name_en, s.name_ru, s.name, s.title];
      return [];
    })
    .filter(Boolean);

  const pos = doctor?.position;
  if (pos) {
    if (typeof pos === "string") names.push(pos);
    else if (typeof pos === "object") {
      if (pos.en) names.push(pos.en);
      if (pos.ru) names.push(pos.ru);
    }
  }

  if (doctor?.specialty && typeof doctor.specialty === "string") {
    names.push(doctor.specialty);
  }

  const result = names.map(normalizeMatchText).filter(Boolean);
  console.log(`[getDoctorSpecialtyNames] ${doctor?.email} →`, result);
  return result;
};

const doctorMatchesScheduleTitle = (doctor, title) => {
  const normalizedTitle = normalizeMatchText(title);
  const aliases = (SPECIALTY_ALIASES[normalizedTitle] || [String(title)]).map(
    normalizeMatchText,
  );
  const specialtyNames = getDoctorSpecialtyNames(doctor);
  return aliases.some((alias) =>
    specialtyNames.some(
      (specialtyName) =>
        specialtyName.includes(alias) || alias.includes(specialtyName),
    ),
  );
};

const normalizeSpecialistTitle = (title) => {
  if (!title) return title;
  const normalizedTitle = normalizeMatchText(title);

  // Map normalized titles to English keys
  const titleMap = {
    gynecologist: "Gynecologist",
    therapist: "Therapist",
    dermatologist: "Dermatologist",
    ophthalmologist: "Ophthalmologist",
    surgeon: "Surgeon",
    ent: "ENT",
    ultrasound: "Ultrasound",
  };

  return titleMap[normalizedTitle] || title;
};

const EarlyDetectionBookingDetails = () => {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const lang = new URLSearchParams(window.location.search).get("lang");
    if (lang && lang !== i18n.language) i18n.changeLanguage(lang);
  }, []);
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  const [copiedPaymentLink, setCopiedPaymentLink] = useState(false);
  const [copiedLinkId, setCopiedLinkId] = useState(null);
  const [isGeneratingPayment, setIsGeneratingPayment] = useState(false);
  const [showPaymentDropdown, setShowPaymentDropdown] = useState(false);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [pendingPaymentAction, setPendingPaymentAction] = useState(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("tbank");
  const [showManualPaymentForm, setShowManualPaymentForm] = useState(false);
  const [manualPayment, setManualPayment] = useState({
    notes: "",
    paymentStatus: "paid",
    paymentDate: "",
    paymentMethod: "manual_admin",
  });
  const [manualSelectedPkg, setManualSelectedPkg] = useState("predict");
  const [manualSelectedAddons, setManualSelectedAddons] = useState([]);
  const [onlineSelectedPkg, setOnlineSelectedPkg] = useState("predict");
  const [onlineSelectedAddons, setOnlineSelectedAddons] = useState([]);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [editingRows, setEditingRows] = useState({}); // { rowKey: status }
  const [activeTab, setActiveTab] = useState("patient");
  const [navExpanded, setNavExpanded] = useState(false);
  const [activeScheduleTab, setActiveScheduleTab] = useState("specialistConsultation");
  const [activeTestId, setActiveTestId] = useState(null);
  const [showTestNoteEditor, setShowTestNoteEditor] = useState(false);
  const [testNoteDraft, setTestNoteDraft] = useState("");
  const [editingTestNoteId, setEditingTestNoteId] = useState(null);
  const [isSavingTestNote, setIsSavingTestNote] = useState(false);
  const [activeSpecialistTab, setActiveSpecialistTab] = useState(0);
  const [specialistAccordionOpen, setSpecialistAccordionOpen] = useState(true);
  const [editedScheduleItems, setEditedScheduleItems] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [managedTests, setManagedTests] = useState({
    laboratoryTests: [],
    instrumentalAnalysis: [],
  });
  const [showTestSettingsModal, setShowTestSettingsModal] = useState(false);
  const [settingsSection, setSettingsSection] = useState("laboratoryTests");
  const [testDraft, setTestDraft] = useState({ en: "", ru: "" });
  const [editingManagedTestId, setEditingManagedTestId] = useState("");
  const [savingManagedTest, setSavingManagedTest] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadSection, setUploadSection] = useState("laboratoryTests");
  const [uploadItemId, setUploadItemId] = useState("");
  const [uploadCustomName, setUploadCustomName] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [isUploadingSectionFile, setIsUploadingSectionFile] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [edSectionPdfModal, setEdSectionPdfModal] = useState(null);
  const [sectionEditors, setSectionEditors] = useState({
    morphologicalResearch: { value: "", isVerified: false, saving: false },
    proceduresAndManipulations: { value: "", isVerified: false, saving: false },
    surgeries: { value: "", isVerified: false, saving: false },
  });
  const [specialistForms, setSpecialistForms] = useState({});
  const [specialistFormSaving, setSpecialistFormSaving] = useState({});
  const [patientBookings, setPatientBookings] = useState([]);
  const [allEDBookings, setAllEDBookings] = useState([]);
  const [doctorAvailabilityCache, setDoctorAvailabilityCache] = useState({});
  const [selectedBookingId, setSelectedBookingId] = useState(id);
  const availabilityLoadingRef = useRef({});
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const prevPatientEmailRef = React.useRef(null);

  // Only update selectedBookingId from URL on initial mount
  useEffect(() => {
    if (isInitialLoad) {
      setSelectedBookingId(id);
      setIsInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    loadBookingDetails(selectedBookingId);
  }, [selectedBookingId]);

  useEffect(() => {
    loadDoctors();
  }, []);

  useEffect(() => {
    loadManagedTests("laboratoryTests");
    loadManagedTests("instrumentalAnalysis");
  }, []);

  useEffect(() => {
    if (!booking) return;

    const readSection = (sectionKey) => ({
      value: booking?.schedule?.[sectionKey]?.comment?.value || "",
      isVerified: !!booking?.schedule?.[sectionKey]?.comment?.isVerified,
      saving: false,
    });

    setSectionEditors({
      morphologicalResearch: readSection("morphologicalResearch"),
      proceduresAndManipulations: readSection("proceduresAndManipulations"),
      surgeries: readSection("surgeries"),
    });

    // Populate specialist consultation history forms
    const consultations = Array.isArray(
      booking?.schedule?.specialistConsultations,
    )
      ? booking.schedule.specialistConsultations
      : [];
    const formsMap = {};
    consultations.forEach((c, i) => {
      formsMap[i] = c?.historyForm || {};
    });
    setSpecialistForms(formsMap);
  }, [booking]);

  // Close payment dropdown on outside click
  useEffect(() => {
    if (!showPaymentDropdown) return;
    const handleClick = (e) => {
      if (!e.target.closest(".new-payment-dropdown-wrapper")) {
        setShowPaymentDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPaymentDropdown]);

  const loadBookingDetails = async (bookingId = selectedBookingId) => {
    const isInitialLoadFlag = isInitialLoad;

    // Only show full-page loading on the very first load
    if (isInitialLoadFlag) setLoading(true);

    try {
      const res = await getEarlyDetectionBookings();
      const list = res?.data || res?.bookings || [];
      setAllEDBookings(Array.isArray(list) ? list : []);
      const foundBooking = Array.isArray(list)
        ? list.find((b) => b._id === bookingId)
        : null;

      if (foundBooking) {
        setBooking(foundBooking);

        const email =
          foundBooking?.patient?.email || foundBooking?.customer?.email || "";
        const samePatient =
          !isInitialLoadFlag && email === prevPatientEmailRef.current;

        if (!samePatient) {
          // New patient (or first load) — fetch all related bookings for the sidebar
          prevPatientEmailRef.current = email || null;

          const normalizePhone = (val) => String(val || "").replace(/\D+/g, "");
          const normalizeName = (val) =>
            String(val || "")
              .trim()
              .toLowerCase()
              .replace(/\s+/g, " ");

          const getIdentity = (entry) => {
            const patient = entry?.patient || {};
            const customer = entry?.customer || {};

            const ids = [
              normalizeId(patient?._id || patient),
              normalizeId(customer?._id || customer),
            ].filter(Boolean);

            const emails = [
              String(patient?.email || "")
                .trim()
                .toLowerCase(),
              String(customer?.email || "")
                .trim()
                .toLowerCase(),
            ].filter(Boolean);

            const phones = [
              normalizePhone(patient?.phone || patient?.phoneNumber),
              normalizePhone(customer?.phone || customer?.phoneNumber),
            ].filter(Boolean);

            const names = [
              normalizeName(
                [patient?.lastName, patient?.firstName, patient?.middleName]
                  .filter(Boolean)
                  .join(" "),
              ),
              normalizeName(
                [customer?.lastName, customer?.firstName, customer?.middleName]
                  .filter(Boolean)
                  .join(" "),
              ),
            ].filter(Boolean);

            return { ids, emails, phones, names };
          };

          const baseIdentity = getIdentity(foundBooking);
          const currentBookingId = normalizeId(foundBooking?._id);

          const relatedBookings = (Array.isArray(list) ? list : [])
            .filter((item) => {
              const itemId = normalizeId(item?._id);
              if (currentBookingId && itemId && currentBookingId === itemId)
                return true;

              const itemIdentity = getIdentity(item);

              const hasIdMatch = baseIdentity.ids.some((v) =>
                itemIdentity.ids.includes(v),
              );
              const hasEmailMatch = baseIdentity.emails.some((v) =>
                itemIdentity.emails.includes(v),
              );
              const hasPhoneMatch = baseIdentity.phones.some((v) =>
                itemIdentity.phones.includes(v),
              );
              const hasNameMatch = baseIdentity.names.some((v) =>
                itemIdentity.names.includes(v),
              );

              return (
                hasIdMatch || hasEmailMatch || hasPhoneMatch || hasNameMatch
              );
            })
            .sort(
              (a, b) =>
                new Date(b?.appointmentDate || b?.createdAt || 0) -
                new Date(a?.appointmentDate || a?.createdAt || 0),
            );

          setPatientBookings(relatedBookings);
        }
        // Same patient → only application data updated, no sidebar re-fetch

        const scheduleItems = Array.isArray(
          foundBooking?.schedule?.specialistConsultations,
        )
          ? foundBooking.schedule.specialistConsultations
          : [];

        setEditedScheduleItems(
          scheduleItems.map((item) => ({
            ...(item || {}),
            date: toLocalDateOnly(item?.date),
            doctor:
              typeof item?.doctor === "object"
                ? item?.doctor?._id || item?.doctor
                : item?.doctor || null,
          })),
        );

        // Update browser URL silently without triggering route change
        if (bookingId !== id) {
          window.history.replaceState(
            null,
            "",
            `/early-detection-bookings/${bookingId}`,
          );
        }
      } else {
        toast.error(t("earlyDiagnosis.bookingNotFound"));
        navigate("/early-detection-bookings");
      }
    } catch (error) {
      toast.error(t("earlyDiagnosis.failedToLoadBooking"));
      navigate("/early-detection-bookings");
    } finally {
      setLoading(false);
    }
  };

  const loadDoctors = async () => {
    setLoadingDoctors(true);
    try {
      const response = await getEarlyDetectionDoctors();
      console.log("[loadDoctors] raw response:", response);
      const doctorsData = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
          ? response.data
          : [];
      console.log("[loadDoctors] doctorsData count:", doctorsData.length, doctorsData);
      setDoctors(doctorsData);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load doctors");
      setDoctors([]);
    } finally {
      setLoadingDoctors(false);
    }
  };

  const loadManagedTests = async (section) => {
    try {
      const response = await getEarlyDetectionManagedTests(section);
      const list = Array.isArray(response?.data?.data)
        ? response.data.data
        : Array.isArray(response?.data)
          ? response.data
          : [];
      setManagedTests((prev) => ({ ...prev, [section]: list }));
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load tests");
    }
  };

  const handleSaveTestNote = async (section) => {
    if (!testNoteDraft.trim() || !activeTestId) return;
    setIsSavingTestNote(true);
    try {
      let result;
      if (editingTestNoteId) {
        const entries = booking?.schedule?.[section] || [];
        const entry = entries.find((e) => normalizeId(e?.item?._id) === activeTestId);
        if (!entry) { toast.error("Entry not found"); return; }
        result = await updateEarlyDetectionTestEntryNote(booking._id, section, entry._id, editingTestNoteId, testNoteDraft);
      } else {
        result = await addEarlyDetectionTestEntryNote(booking._id, section, activeTestId, testNoteDraft);
      }
      if (result?.data) setBooking(result.data);
      setShowTestNoteEditor(false);
      setTestNoteDraft("");
      setEditingTestNoteId(null);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save note");
    } finally {
      setIsSavingTestNote(false);
    }
  };

  const handleDeleteTestNote = async (section, entryId, noteId) => {
    if (!window.confirm("Delete this note?")) return;
    try {
      const result = await deleteEarlyDetectionTestEntryNote(booking._id, section, entryId, noteId);
      if (result?.data) setBooking(result.data);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete note");
    }
  };

  const openTestSettingsModal = (section) => {
    setSettingsSection(section);
    setEditingManagedTestId("");
    setTestDraft({ en: "", ru: "" });
    setShowTestSettingsModal(true);
  };

  const handleManagedTestSave = async () => {
    const nameEn = String(testDraft?.en || "").trim();
    const nameRu = String(testDraft?.ru || "").trim();

    if (!nameEn || !nameRu) {
      toast.error("Both English and Russian names are required");
      return;
    }

    setSavingManagedTest(true);
    try {
      if (editingManagedTestId) {
        await updateEarlyDetectionManagedTest(
          settingsSection,
          editingManagedTestId,
          {
            name: { en: nameEn, ru: nameRu },
          },
        );
      } else {
        await createEarlyDetectionManagedTest(settingsSection, {
          name: { en: nameEn, ru: nameRu },
        });
      }

      await loadManagedTests(settingsSection);
      setEditingManagedTestId("");
      setTestDraft({ en: "", ru: "" });
      toast.success("Saved");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save test");
    } finally {
      setSavingManagedTest(false);
    }
  };

  const handleManagedTestDelete = async (testId) => {
    if (!window.confirm("Delete this test?")) return;
    try {
      await deleteEarlyDetectionManagedTest(settingsSection, testId);
      await loadManagedTests(settingsSection);
      toast.success("Deleted");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete test");
    }
  };

  const multiUploadSections = [
    "laboratoryTests",
    "instrumentalAnalysis",
    "morphologicalResearch",
    "proceduresAndManipulations",
  ];
  const sectionsWithTestSelection = ["laboratoryTests", "instrumentalAnalysis"];
  const manualNameRequiredSections = [
    "morphologicalResearch",
    "proceduresAndManipulations",
  ];

  const openUploadSectionModal = (section) => {
    setUploadSection(section);
    setUploadItemId("");
    setUploadCustomName("");
    setUploadFile(null);
    if (multiUploadSections.includes(section)) {
      setUploadFiles([]);
    }
    setShowUploadModal(true);
  };

  const handleUploadSectionFile = async () => {
    if (sectionsWithTestSelection.includes(uploadSection) && !uploadItemId) {
      toast.error("Select a test");
      return;
    }

    if (multiUploadSections.includes(uploadSection)) {
      if (uploadFiles.length === 0) {
        toast.error("Add at least one file");
        return;
      }

      if (manualNameRequiredSections.includes(uploadSection)) {
        const hasEmptyName = uploadFiles.some(
          (fileItem) => !String(fileItem?.customName || "").trim(),
        );
        if (hasEmptyName) {
          toast.error("Please enter a file name for each file");
          return;
        }
      }

      setIsUploadingSectionFile(true);
      try {
        // Upload all files
        for (const fileItem of uploadFiles) {
          if (!fileItem.file) continue;

          const response = await uploadEarlyDetectionScheduleFile(booking._id, {
            section: uploadSection,
            itemId: sectionsWithTestSelection.includes(uploadSection)
              ? uploadItemId
              : undefined,
            customName: fileItem.customName || "",
            file: fileItem.file,
          });

          if (response?.success && response?.data) {
            setBooking(response.data);
          }
        }

        await loadBookingDetails();
        setShowUploadModal(false);
        setUploadFiles([]);
        toast.success(`${uploadFiles.length} file(s) uploaded`);
      } catch (error) {
        toast.error(error?.response?.data?.message || "Failed to upload files");
      } finally {
        setIsUploadingSectionFile(false);
      }
    } else {
      // Single file upload fallback
      if (!uploadFile) {
        toast.error("Select a file");
        return;
      }

      setIsUploadingSectionFile(true);
      try {
        const response = await uploadEarlyDetectionScheduleFile(booking._id, {
          section: uploadSection,
          itemId: uploadItemId,
          customName: uploadCustomName,
          file: uploadFile,
        });

        if (response?.success && response?.data) {
          setBooking(response.data);
        } else {
          await loadBookingDetails();
        }

        setShowUploadModal(false);
        toast.success("File uploaded");
      } catch (error) {
        toast.error(error?.response?.data?.message || "Failed to upload file");
      } finally {
        setIsUploadingSectionFile(false);
      }
    }
  };

  const updateSectionEditor = (section, patch) => {
    setSectionEditors((prev) => ({
      ...prev,
      [section]: {
        ...(prev?.[section] || { value: "", isVerified: false, saving: false }),
        ...patch,
      },
    }));
  };

  const handleSaveManagedSectionComment = async (section) => {
    const editor = sectionEditors?.[section] || {
      value: "",
      isVerified: false,
    };
    updateSectionEditor(section, { saving: true });

    try {
      const existingSection = booking?.schedule?.[section] || {};
      const response = await updateEarlyDetectionBooking(id, {
        schedule: {
          [section]: {
            ...existingSection,
            comment: {
              ...(existingSection?.comment || {}),
              value: editor.value || "",
              isVerified: !!editor.isVerified,
              verifiedAt: editor.isVerified ? new Date().toISOString() : null,
            },
          },
        },
      });

      if (response?.success && response?.data) {
        setBooking(response.data);
      } else {
        await loadBookingDetails();
      }
      toast.success(t("earlyDiagnosis.bookingUpdatedSuccessfully"));
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
        t("earlyDiagnosis.failedToUpdateBooking"),
      );
    } finally {
      updateSectionEditor(section, { saving: false });
    }
  };

  const formatDate = (date) => {
    if (!date) return "-";
    try {
      const iso = String(date).split("T")[0];
      const [y, m, d] = iso.split("-").map(Number);
      if (!y || !m || !d) return "-";
      return `${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}-${y}`;
    } catch { return "-"; }
  };

  const formatDateTime = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleString(
      i18n.language === "ru" ? "ru-RU" : "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      },
    );
  };
  const handleScheduleItemChange = (itemId, field, value) => {
    setEditedScheduleItems((prev) =>
      prev.map((item) =>
        normalizeId(item?._id || item?.id) === normalizeId(itemId)
          ? { ...item, [field]: value }
          : item,
      ),
    );
  };

  const handleEditToggle = () => {
    if (isEditing) {
      const currentSchedule = Array.isArray(
        booking?.schedule?.specialistConsultations,
      )
        ? booking.schedule.specialistConsultations
        : [];
      setEditedScheduleItems(
        currentSchedule.map((item) => ({
          ...(item || {}),
          date: toLocalDateOnly(item?.date),
          doctor:
            typeof item?.doctor === "object"
              ? item?.doctor?._id || item?.doctor
              : item?.doctor || null,
        })),
      );
    }
    setIsEditing((prev) => !prev);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updateData = {
        schedule: {
          specialistConsultations: editedScheduleItems.map((item) => ({
            ...item,
            date: item?.date ? `${item.date}T00:00:00` : null,
            doctor:
              typeof item?.doctor === "object"
                ? item?.doctor?._id || null
                : item?.doctor || null,
          })),
        },
      };

      const response = await updateEarlyDetectionBooking(id, updateData);

      if (response.success && response.data) {
        setBooking(response.data);
        const nextSchedule = Array.isArray(
          response.data?.schedule?.specialistConsultations,
        )
          ? response.data.schedule.specialistConsultations
          : [];
        setEditedScheduleItems(
          nextSchedule.map((item) => ({
            ...(item || {}),
            date: toLocalDateOnly(item?.date),
            doctor:
              typeof item?.doctor === "object"
                ? item?.doctor?._id || item?.doctor
                : item?.doctor || null,
          })),
        );
        toast.success(t("earlyDiagnosis.bookingUpdatedSuccessfully"));
      } else {
        toast.success(t("earlyDiagnosis.bookingUpdatedSuccessfully"));
        await loadBookingDetails();
      }

      setIsEditing(false);
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
        t("earlyDiagnosis.failedToUpdateBooking"),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyPaymentLink = () => {
    const paymentLink =
      booking?.payment?.paymentLink || booking?.payment?.tbank?.paymentUrl;
    if (paymentLink) {
      navigator.clipboard.writeText(paymentLink);
      setCopiedPaymentLink(true);
      toast.success(t("earlyDiagnosis.paymentLinkCopied"));
      setTimeout(() => setCopiedPaymentLink(false), 2000);
    }
  };

  const handleCopySpecificLink = (linkId, url) => {
    navigator.clipboard.writeText(url);
    setCopiedLinkId(linkId);
    toast.success(t("earlyDiagnosis.paymentLinkCopied"));
    setTimeout(() => setCopiedLinkId(null), 2000);
  };

  const handleGeneratePaymentLink = async (paymentMethod = "tbank", overrides = {}) => {
    if (booking.payment?.status === "paid") {
      toast.error(t("earlyDiagnosis.cannotGenerateForPaid"));
      return;
    }

    setIsGeneratingPayment(true);
    try {
      const response = await generateEDPaymentLink(booking._id, "", paymentMethod, overrides);

      if (response.success) {
        toast.success(t("earlyDiagnosis.paymentLinkGenerated"));
        // Reload booking details
        await loadBookingDetails();
      } else {
        toast.error(
          response.message || t("earlyDiagnosis.failedToGenerateLink"),
        );
        await loadBookingDetails();
      }
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
        error?.message ||
        t("earlyDiagnosis.failedToGenerateLink"),
      );
      await loadBookingDetails();
    } finally {
      setIsGeneratingPayment(false);
    }
  };

  const manualTotal = (() => {
    const pkg = ED_PACKAGES.find((p) => p.id === manualSelectedPkg);
    const pkgPrice = pkg ? pkg.price : 0;
    const addonsPrice = manualSelectedAddons.reduce((sum, aid) => {
      const a = ED_ADDONS.find((x) => x.id === aid);
      return sum + (a ? a.price : 0);
    }, 0);
    return pkgPrice + addonsPrice;
  })();

  const toggleManualAddon = (addonId) => {
    setManualSelectedAddons((prev) =>
      prev.includes(addonId)
        ? prev.filter((x) => x !== addonId)
        : [...prev, addonId],
    );
  };

  const onlineTotal = (() => {
    const pkg = ED_PACKAGES.find((p) => p.id === onlineSelectedPkg);
    const pkgPrice = pkg ? pkg.price : 0;
    const addonsPrice = onlineSelectedAddons.reduce((sum, aid) => {
      const a = ED_ADDONS.find((x) => x.id === aid);
      return sum + (a ? a.price : 0);
    }, 0);
    return pkgPrice + addonsPrice;
  })();

  const toggleOnlineAddon = (addonId) => {
    setOnlineSelectedAddons((prev) =>
      prev.includes(addonId)
        ? prev.filter((x) => x !== addonId)
        : [...prev, addonId],
    );
  };

  const openManualPaymentModal = () => {
    // Pre-fill from booking if available
    setManualSelectedPkg(booking.package?.id || "predict");
    setManualSelectedAddons(booking.addOns?.map((a) => a.id) || []);
    setManualPayment({ notes: "", paymentStatus: "paid", paymentDate: "", paymentMethod: "manual_admin" });
    setShowManualPaymentForm(true);
  };

  const openPaymentMethodModal = (actionType) => {
    setPendingPaymentAction(actionType);
    setSelectedPaymentMethod(actionType === "online" ? "tbank" : "manual_admin");
    if (actionType === "online") {
      setOnlineSelectedPkg(booking.package?.id || "predict");
      setOnlineSelectedAddons(booking.addOns?.map((a) => a.id) || []);
    }
    setShowPaymentMethodModal(true);
  };

  const handleConfirmPaymentMethod = () => {
    const action = pendingPaymentAction;
    const method = selectedPaymentMethod;

    setShowPaymentMethodModal(false);
    setPendingPaymentAction(null);

    if (action === "online") {
      handleGeneratePaymentLink(method, {
        amount: Math.max(0, Number(onlineTotal || 0)) * 100,
        packageId: onlineSelectedPkg,
        addonIds: onlineSelectedAddons,
      });
      return;
    }

    if (action === "manual") {
      setManualSelectedPkg(booking.package?.id || "predict");
      setManualSelectedAddons(booking.addOns?.map((a) => a.id) || []);
      setManualPayment({
        notes: "",
        paymentStatus: "paid",
        paymentDate: "",
        paymentMethod: method || "manual_admin",
      });
      setShowManualPaymentForm(true);
    }
  };

  const paymentMethodOptionsForAction = PAYMENT_METHOD_OPTIONS;

  const handleManualPaymentSave = async () => {
    if (!manualPayment.paymentStatus) {
      toast.error(t("earlyDiagnosis.selectPaymentStatus"));
      return;
    }
    if (!manualPayment.paymentMethod) {
      toast.error(t("earlyDiagnosis.paymentMethod") || "Please select payment method");
      return;
    }
    if (manualPayment.paymentStatus === "paid" && !manualPayment.paymentDate) {
      toast.error(t("earlyDiagnosis.paymentDateRequired"));
      return;
    }
    setIsSavingManual(true);
    try {
      const response = await updateEarlyDetectionPaymentStatus(booking._id, {
        createNewEntry: true,
        paymentStatus: manualPayment.paymentStatus,
        amount: Math.max(0, Number(manualTotal || 0)) * 100,
        paymentDate:
          manualPayment.paymentStatus === "paid"
            ? manualPayment.paymentDate
            : undefined,
        paymentMethod: manualPayment.paymentMethod || undefined,
        notes: manualPayment.notes || undefined,
      });
      if (response.success) {
        toast.success(t("earlyDiagnosis.paymentStatusUpdated"));
        setShowManualPaymentForm(false);
        await loadBookingDetails();
      } else {
        toast.error(
          response.message || t("earlyDiagnosis.failedToUpdatePayment"),
        );
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
        t("earlyDiagnosis.failedToUpdatePayment"),
      );
    } finally {
      setIsSavingManual(false);
    }
  };

  const handleRowEditSave = async (link, index) => {
    // Use the same key logic as in table rendering
    const rowKey = `payment-row-${index}`;
    const editingStatus = editingRows[rowKey];
    try {
      const response = await updateEarlyDetectionPaymentStatus(booking._id, {
        paymentStatus: editingStatus,
        paymentHistoryId: link.historyId || undefined,
        transactionId: link.paymentId || undefined,
      });
      if (response.success) {
        toast.success(
          t("earlyDiagnosis.paymentStatusUpdated") || "Payment status updated",
        );
        setEditingRows((prev) => {
          const updated = { ...prev };
          delete updated[rowKey];
          return updated;
        });
        await loadBookingDetails();
      } else {
        toast.error(response.message || "Failed to update");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update");
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) {
      toast.error(t("earlyDiagnosis.pleaseEnterNote"));
      return;
    }

    setIsSaving(true);
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const addedBy = user.name || user.firstName || "Admin";

      const response = await addEarlyDetectionBookingNote(id, {
        note: newNote.trim(),
        addedBy,
      });

      if (response.success) {
        setBooking((prev) => ({
          ...prev,
          internalNotes: response.data,
        }));
        setNewNote("");
        setIsAddingNote(false);
        toast.success(t("earlyDiagnosis.noteAddedSuccessfully"));
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || t("earlyDiagnosis.failedToAddNote"),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditNote = (note) => {
    setEditingNoteId(note._id);
    setEditingNoteText(note.note);
  };

  const handleUpdateNote = async (noteId) => {
    if (!editingNoteText.trim()) {
      toast.error(t("earlyDiagnosis.pleaseEnterNote"));
      return;
    }

    setIsSaving(true);
    try {
      const response = await updateEarlyDetectionBookingNote(id, noteId, {
        note: editingNoteText.trim(),
      });

      if (response.success) {
        setBooking((prev) => ({
          ...prev,
          internalNotes: response.data,
        }));
        setEditingNoteId(null);
        setEditingNoteText("");
        toast.success(t("earlyDiagnosis.noteUpdatedSuccessfully"));
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || t("earlyDiagnosis.failedToUpdateNote"),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm(t("earlyDiagnosis.confirmDeleteNote"))) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await deleteEarlyDetectionBookingNote(id, noteId);

      if (response.success) {
        setBooking((prev) => ({
          ...prev,
          internalNotes: response.data,
        }));
        toast.success(t("earlyDiagnosis.noteDeletedSuccessfully"));
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || t("earlyDiagnosis.failedToDeleteNote"),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (customer) => {
    if (!customer) return "?";
    const firstName = customer.firstName || "";
    const lastName = customer.lastName || "";
    if (firstName && lastName) {
      return (firstName[0] + lastName[0]).toUpperCase();
    }
    return "?";
  };

  const getFullName = (customer) => {
    if (!customer) return "N/A";
    const parts = [
      customer.lastName,
      customer.firstName,
      customer.middleName,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : "N/A";
  };

  const showSidebarTabs = ["payments", "history", "notes"].includes(activeTab);
  const readNameField = (value) => {
    if (!value) return "";
    if (typeof value === "string") return value.trim();
    if (typeof value === "object") {
      const lang = (i18n.language || "en").slice(0, 2);
      const localized = value[lang] || value.en || value.ru;
      if (typeof localized === "string") return localized.trim();
      const firstString = Object.values(value).find(
        (v) => typeof v === "string",
      );
      return firstString ? firstString.trim() : "";
    }
    return "";
  };

  const getDoctorDisplayName = (doctor) => {
    if (!doctor) return "-";
    if (typeof doctor === "string") {
      const doctorById = doctors.find(
        (item) => String(item?._id) === String(doctor),
      );
      if (!doctorById) return "-";
      doctor = doctorById;
    }
    const fullName = [doctor.firstName, doctor.middleName, doctor.lastName]
      .map(readNameField)
      .filter(Boolean)
      .join(" ")
      .trim();
    return fullName || doctor.email || "-";
  };

  const getDoctorsForScheduleItem = (item) => {
    const title = item?.title || "";
    const matched = doctors.filter((doctor) => doctorMatchesScheduleTitle(doctor, title));
    console.log(`[getDoctorsForScheduleItem] title="${title}" → ${matched.length} match(es):`, matched.map((d) => d.email));
    return matched;
  };

  const SLOT_STEP_MINUTES = 30;
  const MIN_APPOINTMENT_MINUTES = 60;

  const toMinutes = (timeValue) => {
    if (!timeValue) return null;
    const timeStr = String(timeValue);
    if (timeStr.includes("T")) {
      const d = new Date(timeStr);
      if (Number.isNaN(d.getTime())) return null;
      return d.getUTCHours() * 60 + d.getUTCMinutes();
    }
    const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  };

  const toHHmm = (mins) =>
    `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

  const rangesOverlap = (startA, endA, startB, endB) =>
    startA < endB && endA > startB;

  const resolveDoctorObject = (doctorValue) => {
    if (!doctorValue) return null;
    if (typeof doctorValue === "object") return doctorValue;
    const byId = doctors.find(
      (d) => normalizeId(d?._id) === normalizeId(doctorValue),
    );
    if (byId) return byId;
    const byEmail = doctors.find(
      (d) =>
        String(d?.email || "").toLowerCase() ===
        String(doctorValue).toLowerCase(),
    );
    return byEmail || null;
  };

  const resolveDoctorEmail = (doctorValue) => {
    const doctorObj = resolveDoctorObject(doctorValue);
    return (
      doctorObj?.email ||
      (typeof doctorValue === "string" && doctorValue.includes("@")
        ? doctorValue
        : "")
    );
  };

  const getAvailabilityKey = (doctorEmail, dateOnly) =>
    `${String(doctorEmail || "").toLowerCase()}_${dateOnly || ""}`;

  useEffect(() => {
    if (!isEditing) return;

    const targets = editedScheduleItems
      .map((item) => {
        const doctorEmail = resolveDoctorEmail(item?.doctor);
        const dateOnly = toLocalDateOnly(item?.date);
        if (!doctorEmail || !dateOnly) return null;
        return {
          doctorEmail,
          dateOnly,
          key: getAvailabilityKey(doctorEmail, dateOnly),
        };
      })
      .filter(Boolean);

    const uniqueTargets = Array.from(
      new Map(targets.map((t) => [t.key, t])).values(),
    );

    uniqueTargets.forEach(async ({ doctorEmail, dateOnly, key }) => {
      if (doctorAvailabilityCache[key] || availabilityLoadingRef.current[key])
        return;

      availabilityLoadingRef.current[key] = true;
      try {
        const [appsRes, breaksRes, leavesRes] = await Promise.all([
          getDoctorAppointmentsByDate(doctorEmail, dateOnly),
          getDoctorBreaks(doctorEmail, dateOnly),
          getDoctorLeaves({
            doctorEmail,
            from: dateOnly,
            to: dateOnly,
            status: "Approved",
          }),
        ]);

        const appointments = Array.isArray(appsRes?.data)
          ? appsRes.data
          : Array.isArray(appsRes?.data?.applications)
            ? appsRes.data.applications
            : [];

        const breaks = Array.isArray(breaksRes?.data?.breaks)
          ? breaksRes.data.breaks
          : [];

        const leaves = Array.isArray(leavesRes?.data?.leaves)
          ? leavesRes.data.leaves
          : [];

        setDoctorAvailabilityCache((prev) => ({
          ...prev,
          [key]: {
            appointments,
            breaks,
            onLeave: leaves.length > 0,
          },
        }));
      } catch {
        setDoctorAvailabilityCache((prev) => ({
          ...prev,
          [key]: {
            appointments: [],
            breaks: [],
            onLeave: false,
          },
        }));
      } finally {
        availabilityLoadingRef.current[key] = false;
      }
    });
  }, [isEditing, editedScheduleItems, doctors, doctorAvailabilityCache]);

  const getConflictRanges = (item, currentItemId) => {
    const doctorObj = resolveDoctorObject(item?.doctor);
    const doctorEmail = resolveDoctorEmail(item?.doctor);
    const dateOnly = toLocalDateOnly(item?.date);
    if (!doctorEmail || !dateOnly) return { ranges: [], onLeave: false };

    const key = getAvailabilityKey(doctorEmail, dateOnly);
    const cached = doctorAvailabilityCache[key] || {
      appointments: [],
      breaks: [],
      onLeave: false,
    };
    const ranges = [];

    (cached.appointments || []).forEach((app) => {
      const startMins = toMinutes(app?.startTime);
      const endMins = toMinutes(app?.endTime);
      if (startMins !== null && endMins !== null && endMins > startMins) {
        ranges.push([startMins, endMins]);
      }
    });

    (cached.breaks || []).forEach((b) => {
      const startMins = toMinutes(b?.startTime);
      const endMins = toMinutes(b?.endTime);
      if (startMins !== null && endMins !== null && endMins > startMins) {
        ranges.push([startMins, endMins]);
      }
    });

    const currentBookingId = normalizeId(booking?._id);
    const doctorId = normalizeId(doctorObj?._id || item?.doctor);
    const doctorEmailLower = String(
      doctorObj?.email || doctorEmail || "",
    ).toLowerCase();

    (allEDBookings || []).forEach((edBooking) => {
      const bookingId = normalizeId(edBooking?._id);
      const consultations = Array.isArray(
        edBooking?.schedule?.specialistConsultations,
      )
        ? edBooking.schedule.specialistConsultations
        : [];

      consultations.forEach((consultation) => {
        const consultationDate = toLocalDateOnly(consultation?.date);
        if (!consultationDate || consultationDate !== dateOnly) return;

        const consultationId = normalizeId(
          consultation?._id || consultation?.id,
        );
        if (
          bookingId === currentBookingId &&
          consultationId &&
          currentItemId &&
          consultationId === normalizeId(currentItemId)
        )
          return;

        const cDoctorId = normalizeId(
          consultation?.doctor?._id || consultation?.doctor,
        );
        const cDoctorEmail = String(
          consultation?.doctor?.email || "",
        ).toLowerCase();
        const isSameDoctor =
          (doctorId && cDoctorId && doctorId === cDoctorId) ||
          (doctorEmailLower &&
            cDoctorEmail &&
            doctorEmailLower === cDoctorEmail);
        if (!isSameDoctor) return;

        const startMins = toMinutes(consultation?.startTime);
        const endMins = toMinutes(consultation?.endTime);
        if (startMins !== null && endMins !== null && endMins > startMins) {
          ranges.push([startMins, endMins]);
        }
      });
    });

    return { ranges, onLeave: !!cached.onLeave };
  };

  const isRangeFreeForItem = (item, currentItemId, startMins, endMins) => {
    const { ranges, onLeave } = getConflictRanges(item, currentItemId);
    if (onLeave) return false;
    return !ranges.some(([busyStart, busyEnd]) =>
      rangesOverlap(startMins, endMins, busyStart, busyEnd),
    );
  };

  const getAvailableStartTimesForItem = (item, currentItemId) => {
    if (!resolveDoctorEmail(item?.doctor) || !toLocalDateOnly(item?.date))
      return [];
    const slots = [];
    for (
      let startMins = 0;
      startMins <= 24 * 60 - MIN_APPOINTMENT_MINUTES;
      startMins += SLOT_STEP_MINUTES
    ) {
      const endMins = startMins + MIN_APPOINTMENT_MINUTES;
      if (isRangeFreeForItem(item, currentItemId, startMins, endMins)) {
        slots.push(toHHmm(startMins));
      }
    }
    return slots;
  };

  const getAvailableEndTimesForItem = (item, currentItemId) => {
    const startMins = toMinutes(item?.startTime);
    if (startMins === null) return [];
    const minEnd = startMins + MIN_APPOINTMENT_MINUTES;
    const slots = [];

    for (
      let endMins = minEnd;
      endMins <= 24 * 60;
      endMins += SLOT_STEP_MINUTES
    ) {
      if (isRangeFreeForItem(item, currentItemId, startMins, endMins)) {
        slots.push(toHHmm(endMins));
      }
    }
    return slots;
  };

  const readLocalizedName = (value) => {
    if (!value) return "-";
    if (typeof value === "string") return value;
    if (typeof value === "object") {
      const lang = (i18n.language || "en").slice(0, 2);
      return (
        value?.[lang] ||
        value?.en ||
        value?.ru ||
        Object.values(value).find((v) => typeof v === "string") ||
        "-"
      );
    }
    return "-";
  };

  const getFileLabel = (file) =>
    file?.customName || file?.filename || file?.url || "File";

  const getSectionFileUrl = (file, download = false) => {
    const fileId = normalizeId(file?.fileId);
    if (fileId) return getEarlyDetectionScheduleFileUrl(fileId, download);
    if (file?.url) return file.url;
    return "";
  };

  const getFileExtension = (file) => {
    const label = getFileLabel(file);
    const match = String(label).match(/\.([a-zA-Z0-9]+)$/);
    return match ? match[1].toLowerCase() : "file";
  };

  const formatFileSize = (file) => {
    const bytes = Number(file?.size || file?.fileSize || file?.length || 0);
    if (!bytes || Number.isNaN(bytes)) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const scheduleItems = Array.isArray(
    booking?.schedule?.specialistConsultations,
  )
    ? isEditing
      ? editedScheduleItems
      : booking.schedule.specialistConsultations
    : [];

  const groupedSchedule = {
    1: scheduleItems.filter((item, index) =>
      item?.day ? Number(item.day) === 1 : index < 3,
    ),
    2: scheduleItems.filter((item, index) =>
      item?.day ? Number(item.day) === 2 : index >= 3,
    ),
  };

  const formatDayMetaDate = (items = []) => {
    const firstDateItem = items.find((entry) => entry?.date);
    const dateValue = firstDateItem?.date || booking?.appointmentDate;
    if (!dateValue) return "";
    const locale = i18n.language === "ru" ? "ru-RU" : "en-US";
    return new Date(dateValue).toLocaleDateString(locale, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  };

  const managedSectionTabs = ["laboratoryTests", "instrumentalAnalysis"];

  const handleSaveSpecialistForm = async (idx, formData) => {
    setSpecialistFormSaving((prev) => ({ ...prev, [idx]: true }));
    try {
      await saveEarlyDetectionSpecialistHistoryForm(booking._id, idx, formData);
      toast.success(t("earlyDiagnosis.save", "Saved"));
    } catch (err) {
      toast.error(
        err?.response?.data?.error ||
        t("earlyDiagnosis.saveError", "Save failed"),
      );
    } finally {
      setSpecialistFormSaving((prev) => ({ ...prev, [idx]: false }));
    }
  };

  if (loading) {
    return (
      <div className="booking-details-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading booking details...</p>
        </div>
      </div>
    );
  }

  if (!booking) {
    return null;
  }

  const managedTestOptions = managedTests?.[uploadSection] || [];

  const patientDisplayName = booking?.patient
    ? [
      booking.patient.firstName,
      booking.patient.middleName,
      booking.patient.lastName,
    ]
      .map(readNameField)
      .filter(Boolean)
      .join(" ")
      .trim() ||
    booking.patient.email ||
    "Unknown patient"
    : "Unknown patient";

  const dobHeader = booking?.patient?.dateOfBirth
    ? new Date(booking.patient.dateOfBirth).toLocaleDateString(
      i18n.language === "ru" ? "ru-RU" : "en-US",
      {
        month: "long",
        day: "numeric",
        year: "numeric",
      },
    )
    : null;

  const patientGender = booking?.patient?.gender || null;
  const patientAge = (() => {
    const dob = booking?.patient?.dateOfBirth;
    if (!dob) return null;
    const birth = new Date(dob);
    if (isNaN(birth)) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age >= 0 ? age : null;
  })();

  return (
    <div className="booking-details-page">
      <div className="adp-top-header">
        <button
          className="adp-back-btn"
          onClick={() => navigate("/early-detection-bookings")}
        >
          <ArrowLeft size={14} />
          <span>{t("earlyDiagnosis.backToSchedule", "Back to Schedule")}</span>
        </button>

        <div className="adp-header-divider" />

        <div className="adp-header-center">
          <div className="adp-header-name-row">
            <h1 className="adp-patient-title">
              {patientGender?.toLowerCase() === "male" && <span className="adp-header-gender-icon adp-header-gender-icon--male">♂</span>}
              {patientGender?.toLowerCase() === "female" && <span className="adp-header-gender-icon adp-header-gender-icon--female">♀</span>}
              {t("earlyDiagnosis.patient", "Patient")}: <strong>{patientDisplayName}</strong>
            </h1>
            <span className="adp-status-badge-header">
              {{
                confirmed: t("earlyDiagnosis.confirmed"),
                pending: t("earlyDiagnosis.pendingStatus"),
                cancelled: t("earlyDiagnosis.cancelled"),
                completed: t("earlyDiagnosis.completed"),
              }[booking.status?.toLowerCase()] ||
                booking.status ||
                "Active"}
            </span>
          </div>
          <span className="adp-added-date">
            {t("earlyDiagnosis.recordNo", "No.")}
            {booking.invoiceNumber || booking.bookingNumber} &nbsp;·&nbsp;
            {t("earlyDiagnosis.addedToSystemOn", "Added to system on")} {formatDate(booking.createdAt)}
          </span>
        </div>

        {dobHeader && (
          <div className="adp-header-right">
            <div className="adp-dob-row">
              <span className="adp-dob-value">{dobHeader}</span>
              {patientAge !== null && patientAge !== undefined && (
                <span className="adp-age-badge">{patientAge} y.o.</span>
              )}
            </div>
            <span className="adp-dob-label">{t("earlyDiagnosis.dateOfBirth", "Date of Birth")}</span>
          </div>
        )}
      </div>

      <div className="booking-details-content">
        <div className={`ed-details-body${activeTab === "medicalHistory" ? " ed-details-body--with-subnav" : ""}${activeTab === "patient" ? " ed-details-body--with-footer" : ""}${navExpanded ? " ed-details-body--sidebar-expanded" : ""}`}>
          <aside className={`ed-appointments-sidebar adp-app-sidebar${navExpanded ? " ed-appointments-sidebar--expanded" : ""}`}>
            <div className="ed-appointments-sidebar-tabs">
              <button
                type="button"
                className="ed-sidebar-nav-toggle"
                onClick={() => setNavExpanded((v) => !v)}
                title={navExpanded ? "Collapse" : "Expand"}
              >
                {navExpanded ? <ChevronsLeft size={15} /> : <ChevronsRight size={15} />}
              </button>
              {[
                { key: "patient",            Icon: User,     label: t("earlyDiagnosis.patientInformation", "Patient details") },
                { key: "appointmentDetails", Icon: Calendar, label: t("earlyDiagnosis.appointmentDetails", "Appointment Details") },
                { key: "medicalHistory",     Icon: FileText, label: t("earlyDiagnosis.medicalHistory", "Medical History") },
                { key: "payments",           Icon: CheckCircle, label: t("earlyDiagnosis.paymentSummary", "Payments") },
                { key: "history",            Icon: Clock,    label: t("earlyDiagnosis.historyLogs", "History") },
                { key: "notes",              Icon: Edit2,    label: t("earlyDiagnosis.internalNotes", "Notes") },
              ].map(({ key, Icon, label }) => (
                <button
                  key={key}
                  type="button"
                  className={`ed-appointments-sidebar-tab ${activeTab === key ? "active" : ""}`}
                  onClick={() => setActiveTab(key)}
                  title={navExpanded ? undefined : label}
                  aria-label={label}
                >
                  <span className="ed-appointments-sidebar-tab-icon"><Icon size={18} /></span>
                  {navExpanded && <span className="ed-sidebar-tab-label">{label}</span>}
                </button>
              ))}
            </div>

            <div className="ed-appointments-sidebar-list adp-app-sidebar-list">
              {patientBookings.length === 0 ? (
                <div className="ed-appointments-sidebar-empty adp-app-sidebar-empty">
                  {t(
                    "sidebar_empty",
                    t("earlyDiagnosis.noAppointments", "No appointments"),
                  )}
                </div>
              ) : (
                patientBookings.map((item) => {
                  const itemId = normalizeId(item?._id);
                  const isCurrent =
                    itemId && itemId === normalizeId(selectedBookingId);
                  const bookingRef =
                    item?.invoiceNumber ||
                    item?.bookingNumber ||
                    item?._id?.slice(-6) ||
                    "-";
                  const statusLabel =
                    {
                      confirmed: t("earlyDiagnosis.confirmed"),
                      pending: t("earlyDiagnosis.pendingStatus"),
                      cancelled: t("earlyDiagnosis.cancelled"),
                      completed: t("earlyDiagnosis.completed"),
                    }[String(item?.status || "").toLowerCase()] ||
                    item?.status ||
                    "-";

                  return (
                    <button
                      key={itemId || bookingRef}
                      type="button"
                      className={`adp-app-card${isCurrent ? " adp-app-card--active" : ""}`}
                      onClick={() => {
                        if (!isCurrent && itemId) {
                          setSelectedBookingId(itemId);
                        }
                      }}
                    >
                      <div className="adp-app-card-top">
                        <span className="adp-app-card-id">#{bookingRef}</span>
                        <span
                          className={`appt-status-badge ${getApptStatusClass(item?.status)}`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      <div className="adp-app-card-date">
                        {formatDate(item?.appointmentDate || item?.createdAt)}
                      </div>
                      {isCurrent && (
                        <div className="adp-app-card-current-label">
                          {t("sidebar_current", "Current")}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {activeTab === "medicalHistory" && (
            <aside className="ed-medical-history-sidebar">
              <div className="ed-schedule-tabs ed-schedule-tabs--vertical">
                {[
                  ["specialistConsultation", t("earlyDiagnosis.specialistConsultation", "Specialist Consultation")],
                  ["laboratoryTests", t("earlyDiagnosis.laboratoryTests", "Laboratory analysis")],
                  ["instrumentalAnalysis", t("earlyDiagnosis.instrumentalAnalysis", "Исследования/манипуляции")],
                  ["morphologicalResearch", t("earlyDiagnosis.morphologicalResearch", "Morphological research")],
                  ["proceduresAndManipulations", t("earlyDiagnosis.proceduresAndManipulations", "Procedures and manipulations")],
                  ["conclusion", t("earlyDiagnosis.conclusion", "Conclusion")],
                ].map(([key, label]) => (
                  <React.Fragment key={key}>
                    <button
                      type="button"
                      className={`ed-schedule-tab-btn ${activeScheduleTab === key ? "active" : ""}`}
                      onClick={() => {
                        if (key === "specialistConsultation") {
                          if (activeScheduleTab === key) {
                            setSpecialistAccordionOpen((o) => !o);
                          } else {
                            setActiveScheduleTab(key);
                            setSpecialistAccordionOpen(true);
                          }
                          setActiveTestId(null); setShowTestNoteEditor(false); setTestNoteDraft(""); setEditingTestNoteId(null);
                        } else if (managedSectionTabs.includes(key)) {
                          setActiveScheduleTab(key);
                          const firstTest = (managedTests?.[key] || [])[0];
                          setActiveTestId(firstTest ? normalizeId(firstTest._id) : null);
                          setShowTestNoteEditor(false); setTestNoteDraft(""); setEditingTestNoteId(null);
                        } else {
                          setActiveScheduleTab(key); setActiveTestId(null); setShowTestNoteEditor(false); setTestNoteDraft(""); setEditingTestNoteId(null);
                        }
                      }}
                    >
                      <span>{label}</span>
                      {key === "specialistConsultation" && (
                        <ChevronDown
                          size={13}
                          className="ed-tab-chevron"
                          style={{ transform: (activeScheduleTab === key && specialistAccordionOpen) ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
                        />
                      )}
                      {managedSectionTabs.includes(key) && (
                        <span
                          className="ed-tab-settings-btn"
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); openTestSettingsModal(key); }}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); openTestSettingsModal(key); } }}
                          title={t("earlyDiagnosis.manageTests", "Manage tests")}
                        >
                          <Settings size={14} />
                        </span>
                      )}
                    </button>

                    {/* Specialist consultation accordion sub-items */}
                    {key === "specialistConsultation" && activeScheduleTab === "specialistConsultation" && specialistAccordionOpen &&
                      Array.isArray(booking?.schedule?.specialistConsultations) &&
                      booking.schedule.specialistConsultations.length > 0 && (
                        <div className="ed-subnav-test-list">
                          {booking.schedule.specialistConsultations.map((s, i) => {
                            const title = s?.title
                              ? t(`earlyDiagnosis.specialist_${normalizeSpecialistTitle(s.title)}`, s.title)
                              : `Specialist ${i + 1}`;
                            return (
                              <button
                                key={i}
                                type="button"
                                className={`ed-subnav-test-item${activeSpecialistTab === i ? " ed-subnav-test-item--active" : ""}`}
                                onClick={() => setActiveSpecialistTab(i)}
                              >
                                <span className="ed-subnav-test-name">{title}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                    {/* Lab / test sub-items — only filled tests, only for the active section */}
                    {managedSectionTabs.includes(key) && activeScheduleTab === key && (() => {
                      const filledTests = (managedTests?.[key] || []).filter((test) => {
                        const testId = normalizeId(test?._id);
                        const entries = (booking?.schedule?.[key] || []).filter(
                          (entry) => normalizeId(entry?.item?._id) === testId,
                        );
                        return entries.some(
                          (e) =>
                            (Array.isArray(e.files) && e.files.length > 0) ||
                            (Array.isArray(e.notes) && e.notes.length > 0),
                        );
                      });
                      if (filledTests.length === 0) return null;
                      return (
                        <div className="ed-subnav-test-list">
                          {filledTests.map((test) => {
                            const testId = normalizeId(test?._id);
                            const isActive = activeTestId === testId;
                            return (
                              <button
                                key={testId}
                                type="button"
                                className={`ed-subnav-test-item ed-subnav-test-item--done${isActive ? " ed-subnav-test-item--active" : ""}`}
                                onClick={() => {
                                  setActiveTestId(isActive ? null : testId);
                                  setShowTestNoteEditor(false);
                                  setTestNoteDraft("");
                                  setEditingTestNoteId(null);
                                }}
                              >
                                <span className="ed-subnav-test-name">{readLocalizedName(test?.name)}</span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </React.Fragment>
                ))}
              </div>
            </aside>
          )}

          <div
            className={`booking-details-layout booking-details-layout--single${showSidebarTabs ? " booking-details-layout--sidebar-only" : ""}`}
          >
            {/* Left Column */}
            {!showSidebarTabs && (
              <div className="booking-details-main">
                {/*
          <div className="booking-status-header">
            <CheckCircle size={24} className="status-icon" />
            <div className="status-info">
              <h2 className="status-title">
                {t("earlyDiagnosis.bookingConfirmed")}
              </h2>
              <p className="status-subtitle">
                {t("earlyDiagnosis.scheduledFor")}{" "}
                {formatDate(booking.appointmentDate)} {t("earlyDiagnosis.at")}{" "}
                {booking.appointmentTime || "09:00"}
              </p>
            </div>
            <div className="status-badges">
              <span
                className={`appt-status-badge ${getApptStatusClass(booking.payment?.status)}`}
              >
                {(
                  t(
                    `earlyDiagnosis.status_${booking.payment?.status || "pending"}`,
                  ) ||
                  booking.payment?.status ||
                  "PENDING"
                ).toUpperCase()}
              </span>
              <span
                className={`appt-status-badge ${getApptStatusClass(booking.status)}`}
              >
                {(
                  {
                    confirmed: t("earlyDiagnosis.confirmed"),
                    pending: t("earlyDiagnosis.pendingStatus"),
                    cancelled: t("earlyDiagnosis.cancelled"),
                    completed: t("earlyDiagnosis.completed"),
                  }[booking.status?.toLowerCase()] ||
                  booking.status ||
                  "PENDING"
                ).toUpperCase()}
              </span>
            </div>
          </div>
          */}

                {activeTab === "patient" && (
                  <GeneralInformationTab
                    application={{
                      createdAt: booking.createdAt,
                      applicationId:
                        booking.invoiceNumber || booking.bookingNumber,
                    }}
                    patient={booking.patient || {}}
                    onSaveAndComplete={async () => {
                      await updateEarlyDetectionBookingStatus(booking._id, { status: "completed" });
                      toast.success(t("earlyDiagnosis.completed", "Application marked as completed"));
                      await loadBookingDetails();
                    }}
                  />
                )}

                {activeTab === "appointmentDetails" && (
                  <>
                    {/* Appointment Details */}
                    <div className="detail-section ed-medical-history-section">
                      {!isEditing ? (
                        <button
                          className="ed-appt-edit-btn ed-appt-standalone-edit-btn"
                          onClick={handleEditToggle}
                        >
                          {t("earlyDiagnosis.editProfile")}
                        </button>
                      ) : (
                        <div className="ed-appt-actions ed-appt-standalone-edit-actions">
                          <button
                            className="ed-appt-cancel-btn"
                            onClick={handleEditToggle}
                            disabled={isSaving}
                          >
                            {t("earlyDiagnosis.cancel")}
                          </button>
                          <button
                            className="ed-appt-save-btn"
                            onClick={handleSave}
                            disabled={isSaving}
                          >
                            {isSaving
                              ? t("earlyDiagnosis.saving")
                              : t("earlyDiagnosis.save")}
                          </button>
                        </div>
                      )}

                      <div className="ed-schedule-wrapper">
                        {[1, 2].map((day) => (
                          <div key={day} className="ed-day-card">
                            <div className="ed-day-header">
                              <div className="ed-day-header-left">
                                <span className="ed-day-title">{`${t("earlyDiagnosis.dayLabel", "Day")} ${day}`}</span>
                                <span className="ed-day-date">
                                  {formatDayMetaDate(groupedSchedule[day])}
                                </span>
                              </div>
                              <span className="ed-day-count-badge">
                                {`${groupedSchedule[day].length} ${t("earlyDiagnosis.appointments", "Appointments")}`}
                              </span>
                            </div>
                            <div className="ed-day-body">
                              {groupedSchedule[day].length === 0 ? (
                                <div className="ed-schedule-empty">
                                  {t(
                                    "earlyDiagnosis.noAppointments",
                                    "No appointments",
                                  )}
                                </div>
                              ) : (
                                groupedSchedule[day].map((item, index) =>
                                  (() => {
                                    const scheduleItemId =
                                      normalizeId(item?._id || item?.id) ||
                                      `${day}-${index}`;
                                    return (
                                      <div
                                        key={scheduleItemId}
                                        className="ed-schedule-item"
                                      >
                                        {!isEditing ? (
                                          <div className="ed-schedule-view-card">
                                            <div className="ed-schedule-view-icon">
                                              <FileText size={18} />
                                            </div>
                                            <div className="ed-schedule-view-main">
                                              <div className="ed-schedule-view-topline">
                                                <span className="ed-schedule-view-specialty">
                                                  {item?.title
                                                    ? t(
                                                      `earlyDiagnosis.specialist_${normalizeSpecialistTitle(item.title)}`,
                                                      item.title,
                                                    )
                                                    : "Consultation"}
                                                </span>
                                              </div>
                                              <div className="ed-schedule-view-doctor">
                                                {getDoctorDisplayName(
                                                  item?.doctor,
                                                )}
                                              </div>
                                              <div className="ed-schedule-view-meta">
                                                <span className="ed-schedule-view-meta-item">
                                                  <span className="ed-schedule-view-meta-item">
                                                    <Calendar size={13} />
                                                    {item?.date
                                                      ? formatLocalDateOnly(
                                                        item.date,
                                                        i18n.language === "ru"
                                                          ? "ru-RU"
                                                          : "en-US",
                                                      )
                                                      : t(
                                                        "earlyDiagnosis.dateNotSet",
                                                        "Date not set",
                                                      )}
                                                  </span>
                                                  <Clock size={13} />
                                                  {item?.startTime &&
                                                    item?.endTime
                                                    ? `${item.startTime} - ${item.endTime}`
                                                    : t(
                                                      "earlyDiagnosis.notScheduled",
                                                      "Not Scheduled",
                                                    )}
                                                </span>
                                              </div>
                                            </div>
                                            <div className="ed-schedule-view-right">
                                              <div className="ed-schedule-view-status-label">
                                                {t(
                                                  "earlyDiagnosis.status",
                                                  "Status",
                                                )}
                                              </div>
                                              <span
                                                className={`ed-schedule-view-status ${item?.isCompleted ? "is-confirmed" : "is-pending"}`}
                                              >
                                                <span className="ed-schedule-view-status-dot" />
                                                {item?.isCompleted
                                                  ? t(
                                                    "earlyDiagnosis.confirmed",
                                                    "Confirmed",
                                                  )
                                                  : t(
                                                    "earlyDiagnosis.pendingStatus",
                                                    "Pending",
                                                  )}
                                              </span>
                                            </div>
                                          </div>
                                        ) : (
                                          <>
                                            <div className="ed-schedule-head">
                                              <div className="ed-schedule-title">
                                                {item?.title
                                                  ? t(
                                                    `earlyDiagnosis.specialist_${normalizeSpecialistTitle(item.title)}`,
                                                    item.title,
                                                  )
                                                  : "Consultation"}
                                              </div>
                                              <label
                                                className="ed-process-toggle"
                                                title={t(
                                                  "earlyDiagnosis.markAsCompleted",
                                                  "Mark as completed",
                                                )}
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={!!item?.isCompleted}
                                                  disabled={!isEditing}
                                                  onChange={(e) =>
                                                    handleScheduleItemChange(
                                                      scheduleItemId,
                                                      "isCompleted",
                                                      e.target.checked,
                                                    )
                                                  }
                                                />
                                                <span className="ed-process-toggle-slider" />
                                                <span className="ed-process-toggle-label">
                                                  {item?.isCompleted
                                                    ? t(
                                                      "earlyDiagnosis.completed",
                                                      "Completed",
                                                    )
                                                    : t(
                                                      "earlyDiagnosis.pendingStatus",
                                                      "Pending",
                                                    )}
                                                </span>
                                              </label>
                                            </div>
                                            <div className="ed-schedule-grid">
                                              <div className="ed-schedule-field">
                                                <label>
                                                  {t(
                                                    "earlyDiagnosis.dateShort",
                                                    "Date",
                                                  ).toUpperCase()}
                                                </label>
                                                {isEditing ? (
                                                  <CustomCalendar
                                                    value={
                                                      item?.date
                                                        ? String(
                                                          item.date,
                                                        ).split("T")[0]
                                                        : ""
                                                    }
                                                    onChange={(date) =>
                                                      setEditedScheduleItems(
                                                        (prev) =>
                                                          prev.map((row) =>
                                                            normalizeId(
                                                              row?._id ||
                                                              row?.id,
                                                            ) ===
                                                              normalizeId(
                                                                scheduleItemId,
                                                              )
                                                              ? {
                                                                ...row,
                                                                date: toLocalDateOnly(
                                                                  date,
                                                                ),
                                                                startTime: "",
                                                                endTime: "",
                                                              }
                                                              : row,
                                                          ),
                                                      )
                                                    }
                                                    minDate={new Date()}
                                                    dateFormat="dd-MM-yyyy"
                                                    className="ed-schedule-calendar"
                                                  />
                                                ) : (
                                                  <span>
                                                    {formatLocalDateOnly(
                                                      item?.date,
                                                      i18n.language === "ru"
                                                        ? "ru-RU"
                                                        : "en-US",
                                                    )}
                                                  </span>
                                                )}
                                              </div>
                                              <div className="ed-schedule-field">
                                                <label>
                                                  {t(
                                                    "earlyDiagnosis.doctorShort",
                                                    "Doctor",
                                                  ).toUpperCase()}
                                                </label>
                                                {isEditing ? (
                                                  <select
                                                    className="ed-schedule-input"
                                                    value={
                                                      typeof item?.doctor ===
                                                        "object"
                                                        ? item?.doctor?._id ||
                                                        ""
                                                        : item?.doctor || ""
                                                    }
                                                    onChange={(e) =>
                                                      setEditedScheduleItems(
                                                        (prev) =>
                                                          prev.map((row) =>
                                                            normalizeId(
                                                              row?._id ||
                                                              row?.id,
                                                            ) ===
                                                              normalizeId(
                                                                scheduleItemId,
                                                              )
                                                              ? {
                                                                ...row,
                                                                doctor:
                                                                  e.target
                                                                    .value,
                                                                startTime: "",
                                                                endTime: "",
                                                              }
                                                              : row,
                                                          ),
                                                      )
                                                    }
                                                  >
                                                    <option value="">
                                                      {loadingDoctors
                                                        ? t(
                                                          "earlyDiagnosis.loadingDoctors",
                                                          "Loading doctors...",
                                                        )
                                                        : getDoctorsForScheduleItem(
                                                          item,
                                                        ).length
                                                          ? t(
                                                            "earlyDiagnosis.selectDoctor",
                                                            "Select doctor",
                                                          )
                                                          : t(
                                                            "earlyDiagnosis.noMatchingDoctors",
                                                            "No matching doctors",
                                                          )}
                                                    </option>
                                                    {getDoctorsForScheduleItem(
                                                      item,
                                                    ).map((doctor) => (
                                                      <option
                                                        key={
                                                          normalizeId(
                                                            doctor._id,
                                                          ) || doctor.email
                                                        }
                                                        value={
                                                          normalizeId(
                                                            doctor._id,
                                                          ) || ""
                                                        }
                                                      >
                                                        {getDoctorDisplayName(
                                                          doctor,
                                                        )}
                                                      </option>
                                                    ))}
                                                  </select>
                                                ) : (
                                                  <span>
                                                    {getDoctorDisplayName(
                                                      item?.doctor,
                                                    )}
                                                  </span>
                                                )}
                                              </div>
                                              <div className="ed-schedule-field">
                                                <label>
                                                  {t(
                                                    "earlyDiagnosis.startTimeShort",
                                                    "Start Time",
                                                  ).toUpperCase()}
                                                </label>
                                                {isEditing ? (
                                                  <CustomTimePicker
                                                    value={
                                                      item?.startTime || ""
                                                    }
                                                    onChange={(timeStr) =>
                                                      setEditedScheduleItems(
                                                        (prev) =>
                                                          prev.map((row) => {
                                                            if (
                                                              normalizeId(
                                                                row?._id ||
                                                                row?.id,
                                                              ) !==
                                                              normalizeId(
                                                                scheduleItemId,
                                                              )
                                                            )
                                                              return row;
                                                            const nextRow = {
                                                              ...row,
                                                              startTime:
                                                                timeStr,
                                                            };
                                                            const availableEndTimes =
                                                              getAvailableEndTimesForItem(
                                                                nextRow,
                                                                scheduleItemId,
                                                              );
                                                            if (
                                                              !availableEndTimes.includes(
                                                                nextRow.endTime,
                                                              )
                                                            ) {
                                                              nextRow.endTime =
                                                                "";
                                                            }
                                                            return nextRow;
                                                          }),
                                                      )
                                                    }
                                                    className="ed-schedule-input"
                                                    placeholder={t(
                                                      "earlyDiagnosis.selectTime",
                                                      "Select time",
                                                    )}
                                                    disabled={
                                                      !resolveDoctorEmail(
                                                        item?.doctor,
                                                      ) ||
                                                      !toLocalDateOnly(
                                                        item?.date,
                                                      )
                                                    }
                                                    allowedTimes={getAvailableStartTimesForItem(
                                                      item,
                                                      scheduleItemId,
                                                    )}
                                                  />
                                                ) : (
                                                  <span>
                                                    {item?.startTime || "-"}
                                                  </span>
                                                )}
                                              </div>
                                              <div className="ed-schedule-field">
                                                <label>
                                                  {t(
                                                    "earlyDiagnosis.endTimeShort",
                                                    "End Time",
                                                  ).toUpperCase()}
                                                </label>
                                                {isEditing ? (
                                                  <CustomTimePicker
                                                    value={item?.endTime || ""}
                                                    onChange={(timeStr) =>
                                                      handleScheduleItemChange(
                                                        scheduleItemId,
                                                        "endTime",
                                                        timeStr,
                                                      )
                                                    }
                                                    className="ed-schedule-input"
                                                    placeholder={t(
                                                      "earlyDiagnosis.selectTime",
                                                      "Select time",
                                                    )}
                                                    disabled={
                                                      !item?.startTime ||
                                                      !resolveDoctorEmail(
                                                        item?.doctor,
                                                      ) ||
                                                      !toLocalDateOnly(
                                                        item?.date,
                                                      )
                                                    }
                                                    allowedTimes={getAvailableEndTimesForItem(
                                                      item,
                                                      scheduleItemId,
                                                    )}
                                                  />
                                                ) : (
                                                  <span>
                                                    {item?.endTime || "-"}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    );
                                  })(),
                                )
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {activeTab === "medicalHistory" && (
                  <div className={`ed-medical-history-content${activeScheduleTab === "conclusion" ? " ed-medical-history-content--conclusion" : ""}`}>
                    <div className={`detail-section${activeScheduleTab === "conclusion" ? " detail-section--compact" : ""}`}>
                      {activeScheduleTab === "laboratoryTests" && (
                        activeTestId ? (() => {
                          const selTest = (managedTests?.laboratoryTests || []).find((t) => normalizeId(t?._id) === activeTestId);
                          const selEntries = (booking?.schedule?.laboratoryTests || []).filter((e) => normalizeId(e?.item?._id) === activeTestId);
                          const selFiles = selEntries.flatMap((e) => e?.files || []);
                          const selNotes = selEntries.flatMap((e) => e?.notes || []);
                          const hasItems = selFiles.length > 0 || selNotes.length > 0;
                          return (
                            <div className="ed-test-detail-page">
                              <div className="ed-test-detail-header">
                                <h2 className="ed-test-detail-title">{readLocalizedName(selTest?.name)}</h2>
                              </div>
                              <div className="ed-test-detail-actions">
                                <button type="button" className="ed-td-btn" onClick={() => { setUploadSection("laboratoryTests"); setUploadItemId(activeTestId); setUploadFiles([]); setShowUploadModal(true); }}>
                                  <Plus size={14} />{t("earlyDiagnosis.uploadFile", "Upload file")}
                                </button>
                                <button type="button" className="ed-td-btn" onClick={() => { setShowTestNoteEditor(true); setEditingTestNoteId(null); setTestNoteDraft(""); }}>
                                  <FileText size={14} />{t("earlyDiagnosis.addText", "Add text")}
                                </button>
                              </div>
                              <div className="ed-td-list">
                                {!hasItems && !showTestNoteEditor && (
                                  <div className="ed-td-empty">{t("earlyDiagnosis.noEntries", "No entries yet")}</div>
                                )}
                                {selFiles.map((file, fi) => (
                                  <div key={normalizeId(file?.fileId) || file?._id || fi} className="ed-td-item">
                                    <span className={`ed-td-badge ed-td-badge--${getFileExtension(file)}`}>{getFileExtension(file).toUpperCase()}</span>
                                    <div className="ed-td-item-info">
                                      <span className="ed-td-item-name">{getFileLabel(file)}</span>
                                      <span className="ed-td-item-meta"><Clock size={11} />{formatDateTime(file?.uploadedAt)}</span>
                                    </div>
                                    <div className="ed-td-item-actions">
                                      {getSectionFileUrl(file) && (<a href={getSectionFileUrl(file, false)} target="_blank" rel="noopener noreferrer" className="ed-td-icon-btn"><Eye size={15} /></a>)}
                                      {getSectionFileUrl(file, true) && (<a href={getSectionFileUrl(file, true)} download className="ed-td-icon-btn"><Download size={15} /></a>)}
                                      <button type="button" className="ed-td-icon-btn ed-td-icon-btn--delete"><Trash2 size={15} /></button>
                                    </div>
                                  </div>
                                ))}
                                {selNotes.map((note) => (
                                  <div key={String(note._id)} className="ed-td-item ed-td-item--note">
                                    <span className="ed-td-note-icon"><FileText size={18} /></span>
                                    <div className="ed-td-item-info">
                                      <div className="ed-td-item-name" dangerouslySetInnerHTML={{ __html: note.content }} />
                                      <span className="ed-td-item-meta"><Clock size={11} />{formatDateTime(note?.createdAt)}</span>
                                    </div>
                                    <div className="ed-td-item-actions">
                                      <button type="button" className="ed-td-icon-btn" onClick={() => { setEditingTestNoteId(note._id); setTestNoteDraft(note.content || ""); setShowTestNoteEditor(true); }}><Edit2 size={15} /></button>
                                      <button type="button" className="ed-td-icon-btn ed-td-icon-btn--delete" onClick={() => { const entry = selEntries.find((e) => (e.notes || []).some((n) => String(n._id) === String(note._id))); if (entry) handleDeleteTestNote("laboratoryTests", entry._id, note._id); }}><Trash2 size={15} /></button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {showTestNoteEditor && (
                                <div className="ed-td-note-editor">
                                  <RichTextEditor value={testNoteDraft} onChange={setTestNoteDraft} placeholder={t("history_tab.enter_text", "Enter text…")} />
                                  <div className="ed-td-note-editor-actions">
                                    <button type="button" className="ed-td-save-btn" disabled={isSavingTestNote} onClick={() => handleSaveTestNote("laboratoryTests")}>{isSavingTestNote ? t("earlyDiagnosis.saving", "Saving…") : t("earlyDiagnosis.save", "Save")}</button>
                                    <button type="button" className="ed-td-cancel-btn" onClick={() => { setShowTestNoteEditor(false); setTestNoteDraft(""); setEditingTestNoteId(null); }}>{t("earlyDiagnosis.cancel", "Cancel")}</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })() : (
                          <div className="ed-schedule-section-list">
                            {(managedTests?.laboratoryTests || []).length === 0 ? (
                              <div className="ed-schedule-empty">{t("earlyDiagnosis.noTests", "No tests configured")}</div>
                            ) : (
                              (managedTests?.laboratoryTests || []).map((test) => {
                                const testId = normalizeId(test?._id);
                                const isDone = (booking?.schedule?.laboratoryTests || []).filter((e) => normalizeId(e?.item?._id) === testId).flatMap((e) => e?.files || []).length > 0;
                                return (
                                  <div className="ed-test-list-item" key={testId}>
                                    <div className="ed-test-list-item-header">
                                      <span className={`ed-test-list-status${isDone ? " ed-test-list-status--done" : ""}`}>
                                        {isDone ? <CheckCircle size={15} /> : <span className="ed-test-status-circle" />}
                                      </span>
                                      <span className="ed-test-list-name">{readLocalizedName(test?.name)}</span>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )
                      )}

                      {activeScheduleTab === "instrumentalAnalysis" && (
                        activeTestId ? (() => {
                          const selTest = (managedTests?.instrumentalAnalysis || []).find((t) => normalizeId(t?._id) === activeTestId);
                          const selEntries = (booking?.schedule?.instrumentalAnalysis || []).filter((e) => normalizeId(e?.item?._id) === activeTestId);
                          const selFiles = selEntries.flatMap((e) => e?.files || []);
                          const selNotes = selEntries.flatMap((e) => e?.notes || []);
                          const hasItems = selFiles.length > 0 || selNotes.length > 0;
                          return (
                            <div className="ed-test-detail-page">
                              <div className="ed-test-detail-header">
                                <h2 className="ed-test-detail-title">{readLocalizedName(selTest?.name)}</h2>
                              </div>
                              <div className="ed-test-detail-actions">
                                <button type="button" className="ed-td-btn" onClick={() => { setUploadSection("instrumentalAnalysis"); setUploadItemId(activeTestId); setUploadFiles([]); setShowUploadModal(true); }}>
                                  <Plus size={14} />{t("earlyDiagnosis.uploadFile", "Upload file")}
                                </button>
                                <button type="button" className="ed-td-btn" onClick={() => { setShowTestNoteEditor(true); setEditingTestNoteId(null); setTestNoteDraft(""); }}>
                                  <FileText size={14} />{t("earlyDiagnosis.addText", "Add text")}
                                </button>
                              </div>
                              <div className="ed-td-list">
                                {!hasItems && !showTestNoteEditor && (
                                  <div className="ed-td-empty">{t("earlyDiagnosis.noEntries", "No entries yet")}</div>
                                )}
                                {selFiles.map((file, fi) => (
                                  <div key={normalizeId(file?.fileId) || file?._id || fi} className="ed-td-item">
                                    <span className={`ed-td-badge ed-td-badge--${getFileExtension(file)}`}>{getFileExtension(file).toUpperCase()}</span>
                                    <div className="ed-td-item-info">
                                      <span className="ed-td-item-name">{getFileLabel(file)}</span>
                                      <span className="ed-td-item-meta"><Clock size={11} />{formatDateTime(file?.uploadedAt)}</span>
                                    </div>
                                    <div className="ed-td-item-actions">
                                      {getSectionFileUrl(file) && (<a href={getSectionFileUrl(file, false)} target="_blank" rel="noopener noreferrer" className="ed-td-icon-btn"><Eye size={15} /></a>)}
                                      {getSectionFileUrl(file, true) && (<a href={getSectionFileUrl(file, true)} download className="ed-td-icon-btn"><Download size={15} /></a>)}
                                      <button type="button" className="ed-td-icon-btn ed-td-icon-btn--delete"><Trash2 size={15} /></button>
                                    </div>
                                  </div>
                                ))}
                                {selNotes.map((note) => (
                                  <div key={String(note._id)} className="ed-td-item ed-td-item--note">
                                    <span className="ed-td-note-icon"><FileText size={18} /></span>
                                    <div className="ed-td-item-info">
                                      <div className="ed-td-item-name" dangerouslySetInnerHTML={{ __html: note.content }} />
                                      <span className="ed-td-item-meta"><Clock size={11} />{formatDateTime(note?.createdAt)}</span>
                                    </div>
                                    <div className="ed-td-item-actions">
                                      <button type="button" className="ed-td-icon-btn" onClick={() => { setEditingTestNoteId(note._id); setTestNoteDraft(note.content || ""); setShowTestNoteEditor(true); }}><Edit2 size={15} /></button>
                                      <button type="button" className="ed-td-icon-btn ed-td-icon-btn--delete" onClick={() => { const entry = selEntries.find((e) => (e.notes || []).some((n) => String(n._id) === String(note._id))); if (entry) handleDeleteTestNote("instrumentalAnalysis", entry._id, note._id); }}><Trash2 size={15} /></button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {showTestNoteEditor && (
                                <div className="ed-td-note-editor">
                                  <RichTextEditor value={testNoteDraft} onChange={setTestNoteDraft} placeholder={t("history_tab.enter_text", "Enter text…")} />
                                  <div className="ed-td-note-editor-actions">
                                    <button type="button" className="ed-td-save-btn" disabled={isSavingTestNote} onClick={() => handleSaveTestNote("instrumentalAnalysis")}>{isSavingTestNote ? t("earlyDiagnosis.saving", "Saving…") : t("earlyDiagnosis.save", "Save")}</button>
                                    <button type="button" className="ed-td-cancel-btn" onClick={() => { setShowTestNoteEditor(false); setTestNoteDraft(""); setEditingTestNoteId(null); }}>{t("earlyDiagnosis.cancel", "Cancel")}</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })() : (
                          <div className="ed-schedule-section-list">
                            {(managedTests?.instrumentalAnalysis || []).length === 0 ? (
                              <div className="ed-schedule-empty">{t("earlyDiagnosis.noTests", "No tests configured")}</div>
                            ) : (
                              (managedTests?.instrumentalAnalysis || []).map((test) => {
                                const testId = normalizeId(test?._id);
                                const isDone = (booking?.schedule?.instrumentalAnalysis || []).filter((e) => normalizeId(e?.item?._id) === testId).flatMap((e) => e?.files || []).length > 0;
                                return (
                                  <div className="ed-test-list-item" key={testId}>
                                    <div className="ed-test-list-item-header">
                                      <span className={`ed-test-list-status${isDone ? " ed-test-list-status--done" : ""}`}>
                                        {isDone ? <CheckCircle size={15} /> : <span className="ed-test-status-circle" />}
                                      </span>
                                      <span className="ed-test-list-name">{readLocalizedName(test?.name)}</span>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )
                      )}

                      {activeScheduleTab === "morphologicalResearch" && (
                        <div className="ed-schedule-section-list">
                          <div className="ed-section-actions-row">
                            <button
                              type="button"
                              className="ed-upload-btn"
                              onClick={() =>
                                openUploadSectionModal("morphologicalResearch")
                              }
                            >
                              {t("earlyDiagnosis.uploadFile", "Upload file")}
                            </button>
                          </div>

                          {(
                            booking?.schedule?.morphologicalResearch?.files ||
                            []
                          ).length === 0 ? (
                            <div className="ed-schedule-empty">
                              {t("earlyDiagnosis.noFiles", "No files")}
                            </div>
                          ) : (
                            <div className="ed-section-card ed-test-card">
                              <ul className="ed-files-list ed-test-files-list">
                                {(
                                  booking?.schedule?.morphologicalResearch
                                    ?.files || []
                                ).map((file, fileIndex) => (
                                  <li
                                    key={
                                      normalizeId(file?.fileId) ||
                                      file?._id ||
                                      fileIndex
                                    }
                                    className="ed-file-row ed-test-file-row"
                                  >
                                    <div className="ed-test-file-left">
                                      <span
                                        className={`ed-test-file-badge ${getFileExtension(file) === "pdf" ? "is-pdf" : "is-doc"}`}
                                      >
                                        {getFileExtension(file).toUpperCase()}
                                      </span>
                                      <span className="ed-test-file-meta">
                                        <span className="ed-test-file-name">
                                          {getFileLabel(file)}
                                        </span>
                                        <span className="ed-test-file-subtext">
                                          {[
                                            formatFileSize(file),
                                            file?.uploadedByName ||
                                            file?.uploadedBy ||
                                            file?.uploadedByDoctorName,
                                          ]
                                            .filter(Boolean)
                                            .join(" • ")}
                                        </span>
                                      </span>
                                    </div>
                                    <span className="ed-file-actions ed-test-file-actions">
                                      {getSectionFileUrl(file) && (
                                        <a
                                          href={getSectionFileUrl(file, false)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="ed-file-link-btn ed-file-link-btn--view"
                                          title={t(
                                            "earlyDiagnosis.view",
                                            "View",
                                          )}
                                        >
                                          <Eye size={14} />
                                        </a>
                                      )}
                                      {getSectionFileUrl(file, true) && (
                                        <a
                                          href={getSectionFileUrl(file, true)}
                                          download
                                          className="ed-file-link-btn ed-file-link-btn--download"
                                          title={t(
                                            "earlyDiagnosis.download",
                                            "Download",
                                          )}
                                        >
                                          <Download size={14} />
                                        </a>
                                      )}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div className="ed-section-card">
                            <div className="ed-section-head-row">
                              <div className="ed-section-title">
                                {t(
                                  "earlyDiagnosis.morphologicalResearch",
                                  "Morphological research",
                                )}
                              </div>
                              <div className="ed-history-actions">
                                <button
                                  type="button"
                                  className="save-btn"
                                  onClick={() =>
                                    handleSaveManagedSectionComment(
                                      "morphologicalResearch",
                                    )
                                  }
                                  disabled={
                                    !!sectionEditors?.morphologicalResearch
                                      ?.saving
                                  }
                                >
                                  {sectionEditors?.morphologicalResearch?.saving
                                    ? t("earlyDiagnosis.saving", "Saving...")
                                    : t("earlyDiagnosis.save", "Save")}
                                </button>
                                <button
                                  type="button"
                                  className="ht-sp-pdf-btn"
                                  title={t("history_tab.export_pdf", "Export PDF")}
                                  onClick={() => setEdSectionPdfModal({
                                    title: t("earlyDiagnosis.morphologicalResearch", "Morphological research"),
                                    commentHtml: sectionEditors?.morphologicalResearch?.value || "",
                                    files: booking?.schedule?.morphologicalResearch?.files || [],
                                  })}
                                >
                                  <Download size={14} />
                                </button>
                              </div>
                            </div>
                            <div className="ed-history-rich-editor">
                              <RichTextEditor
                                value={
                                  sectionEditors?.morphologicalResearch
                                    ?.value || ""
                                }
                                onChange={(html) =>
                                  updateSectionEditor("morphologicalResearch", {
                                    value: html,
                                  })
                                }
                                placeholder={t(
                                  "history_tab.enter_text",
                                  "Enter text...",
                                )}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {activeScheduleTab === "proceduresAndManipulations" && (
                        <div className="ed-schedule-section-list">
                          <div className="ed-section-actions-row">
                            <button
                              type="button"
                              className="ed-upload-btn"
                              onClick={() =>
                                openUploadSectionModal(
                                  "proceduresAndManipulations",
                                )
                              }
                            >
                              {t("earlyDiagnosis.uploadFile", "Upload file")}
                            </button>
                          </div>

                          {(
                            booking?.schedule?.proceduresAndManipulations
                              ?.files || []
                          ).length === 0 ? (
                            <div className="ed-schedule-empty">
                              {t("earlyDiagnosis.noFiles", "No files")}
                            </div>
                          ) : (
                            <div className="ed-section-card ed-test-card">
                              <ul className="ed-files-list ed-test-files-list">
                                {(
                                  booking?.schedule?.proceduresAndManipulations
                                    ?.files || []
                                ).map((file, fileIndex) => (
                                  <li
                                    key={
                                      normalizeId(file?.fileId) ||
                                      file?._id ||
                                      fileIndex
                                    }
                                    className="ed-file-row ed-test-file-row"
                                  >
                                    <div className="ed-test-file-left">
                                      <span
                                        className={`ed-test-file-badge ${getFileExtension(file) === "pdf" ? "is-pdf" : "is-doc"}`}
                                      >
                                        {getFileExtension(file).toUpperCase()}
                                      </span>
                                      <span className="ed-test-file-meta">
                                        <span className="ed-test-file-name">
                                          {getFileLabel(file)}
                                        </span>
                                        <span className="ed-test-file-subtext">
                                          {[
                                            formatFileSize(file),
                                            file?.uploadedByName ||
                                            file?.uploadedBy ||
                                            file?.uploadedByDoctorName,
                                          ]
                                            .filter(Boolean)
                                            .join(" • ")}
                                        </span>
                                      </span>
                                    </div>
                                    <span className="ed-file-actions ed-test-file-actions">
                                      {getSectionFileUrl(file) && (
                                        <a
                                          href={getSectionFileUrl(file, false)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="ed-file-link-btn ed-file-link-btn--view"
                                          title={t(
                                            "earlyDiagnosis.view",
                                            "View",
                                          )}
                                        >
                                          <Eye size={14} />
                                        </a>
                                      )}
                                      {getSectionFileUrl(file, true) && (
                                        <a
                                          href={getSectionFileUrl(file, true)}
                                          download
                                          className="ed-file-link-btn ed-file-link-btn--download"
                                          title={t(
                                            "earlyDiagnosis.download",
                                            "Download",
                                          )}
                                        >
                                          <Download size={14} />
                                        </a>
                                      )}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div className="ed-section-card">
                            <div className="ed-section-head-row">
                              <div className="ed-section-title">
                                {t(
                                  "earlyDiagnosis.proceduresAndManipulations",
                                  "Procedures and manipulations",
                                )}
                              </div>
                              <div className="ed-history-actions">
                                <button
                                  type="button"
                                  className="save-btn"
                                  onClick={() =>
                                    handleSaveManagedSectionComment(
                                      "proceduresAndManipulations",
                                    )
                                  }
                                  disabled={
                                    !!sectionEditors?.proceduresAndManipulations
                                      ?.saving
                                  }
                                >
                                  {sectionEditors?.proceduresAndManipulations
                                    ?.saving
                                    ? t("earlyDiagnosis.saving", "Saving...")
                                    : t("earlyDiagnosis.save", "Save")}
                                </button>
                                <button
                                  type="button"
                                  className="ht-sp-pdf-btn"
                                  title={t("history_tab.export_pdf", "Export PDF")}
                                  onClick={() => setEdSectionPdfModal({
                                    title: t("earlyDiagnosis.proceduresAndManipulations", "Procedures and manipulations"),
                                    commentHtml: sectionEditors?.proceduresAndManipulations?.value || "",
                                    files: booking?.schedule?.proceduresAndManipulations?.files || [],
                                  })}
                                >
                                  <Download size={14} />
                                </button>
                              </div>
                            </div>
                            <div className="ed-history-rich-editor">
                              <RichTextEditor
                                value={
                                  sectionEditors?.proceduresAndManipulations
                                    ?.value || ""
                                }
                                onChange={(html) =>
                                  updateSectionEditor(
                                    "proceduresAndManipulations",
                                    { value: html },
                                  )
                                }
                                placeholder={t(
                                  "history_tab.enter_text",
                                  "Enter text...",
                                )}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {activeScheduleTab === "specialistConsultation" && (() => {
                        const specialist = booking?.schedule?.specialistConsultations?.[activeSpecialistTab];
                        if (!specialist) return null;
                        const displaySpecialistTitle = specialist.title
                          ? t(`earlyDiagnosis.specialist_${normalizeSpecialistTitle(specialist.title)}`, specialist.title)
                          : specialist.title;
                        return (
                          <SpecialistHistoryForm
                            key={`specialist_form_${activeSpecialistTab}`}
                            specialistTitle={displaySpecialistTitle}
                            historyForm={specialistForms[activeSpecialistTab] || specialist.historyForm || {}}
                            isSaving={!!specialistFormSaving[activeSpecialistTab]}
                            onSave={(formData) => handleSaveSpecialistForm(activeSpecialistTab, formData)}
                            readOnly
                          />
                        );
                      })()}
                    </div>
                    {activeScheduleTab === "conclusion" && (
                      <EarlyDetectionReportTab booking={booking} />
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Right Column */}
            {showSidebarTabs && (
              <div className="booking-details-sidebar booking-details-sidebar--full">
                {/* Payment Summary */}
                {activeTab === "payments" && (
                  <div className="sidebar-section">
                    <div className="sidebar-header">
                      <h3 className="sidebar-title">
                        {t("earlyDiagnosis.paymentSummary").toUpperCase()}
                      </h3>
                      {booking.payment?.status !== "paid" && (
                        <div className="new-payment-dropdown-wrapper">
                          <button
                            onClick={() => setShowPaymentDropdown((v) => !v)}
                            disabled={isGeneratingPayment}
                            className="generate-payment-btn"
                          >
                            <Plus size={16} />
                            {isGeneratingPayment
                              ? t("earlyDiagnosis.generating")
                              : t("earlyDiagnosis.newPayment")}
                            <ChevronDown size={14} />
                          </button>
                          {showPaymentDropdown && (
                            <div className="new-payment-dropdown">
                              <button
                                className="dropdown-item"
                                onClick={() => {
                                  setShowPaymentDropdown(false);
                                  openPaymentMethodModal("online");
                                }}
                              >
                                <Globe size={14} />
                                {t("earlyDiagnosis.onlinePayment") || "Online"}
                              </button>
                              <button
                                className="dropdown-item"
                                onClick={() => {
                                  setShowPaymentDropdown(false);
                                  openManualPaymentModal();
                                }}
                              >
                                <Pencil size={14} />
                                {t("earlyDiagnosis.manualPayment") || "Manual"}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Payment table — single source from paymentHistory */}
                    {(() => {
                      const historyRows = (booking.paymentHistory || []).map(
                        (h, i) => ({
                          historyId: h._id ? String(h._id) : null,
                          paymentId:
                            h.paymentId || h.transactionId || `hist-${i}`,
                          orderId: h.orderId || booking.invoiceNumber || "",
                          paymentUrl: h.paymentUrl || h.paymentLink || "",
                          amount:
                            h.amount ||
                            (booking.totalAmount ||
                              booking.package?.price ||
                              0) * 100,
                          status: h.status,
                          createdAt: h.createdAt || h.changedAt,
                          paidAt: h.paidAt,
                          notes: h.notes,
                          isHistory: true,
                        }),
                      );

                      // Fallback: synthesize one row from current payment state when history is empty
                      const tbankFallback = [];
                      if (
                        historyRows.length === 0 &&
                        (booking.payment?.paymentLink ||
                          booking.payment?.tbank?.paymentId ||
                          booking.payment?.transactionId)
                      ) {
                        tbankFallback.push({
                          historyId: null,
                          paymentId:
                            booking.payment?.tbank?.paymentId ||
                            booking.payment?.transactionId ||
                            `pay-${booking._id}`,
                          orderId:
                            booking.payment?.tbank?.orderId ||
                            booking.invoiceNumber ||
                            "",
                          paymentUrl:
                            booking.payment?.paymentLink ||
                            booking.payment?.tbank?.paymentUrl ||
                            "",
                          amount:
                            booking.payment?.tbank?.amount ||
                            (booking.totalAmount ||
                              booking.package?.price ||
                              0) * 100,
                          status: booking.payment?.status,
                          createdAt:
                            booking.payment?.paidAt ||
                            booking.updatedAt ||
                            booking.createdAt,
                          paidAt: booking.payment?.paidAt,
                          notes: "",
                          isTbankFallback: true,
                        });
                      }

                      const tableRows = [...historyRows, ...tbankFallback];
                      if (tableRows.length === 0) return null;
                      return (
                        <div className="payment-links-table">
                          <table>
                            <thead>
                              <tr>
                                <th>{t("earlyDiagnosis.created")}</th>
                                <th>{t("earlyDiagnosis.paidAt", "Paid At")}</th>
                                <th>{t("earlyDiagnosis.amount")}</th>
                                <th>{t("earlyDiagnosis.status")}</th>
                                <th>{t("earlyDiagnosis.actions")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tableRows.map((link, index) => {
                                // Use index as the unique key to ensure each row is distinct
                                const rowKey = `payment-row-${index}`;
                                const isEditingThis = rowKey in editingRows;
                                const editingStatus =
                                  editingRows[rowKey] ||
                                  link.status ||
                                  "pending";
                                const hasUrl = !!String(
                                  link.paymentUrl || "",
                                ).trim();
                                return (
                                  <tr
                                    key={
                                      link.historyId ||
                                      `${link.paymentId || "row"}-${index}`
                                    }
                                  >
                                    <td>
                                      {new Date(link.createdAt).toLocaleString(
                                        i18n.language === "ru"
                                          ? "ru-RU"
                                          : "en-US",
                                        {
                                          month: "short",
                                          day: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        },
                                      )}
                                    </td>
                                    <td>
                                      {link.paidAt
                                        ? new Date(link.paidAt).toLocaleString(
                                          i18n.language === "ru"
                                            ? "ru-RU"
                                            : "en-US",
                                          {
                                            month: "short",
                                            day: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          },
                                        )
                                        : "—"}
                                    </td>
                                    <td>
                                      {(
                                        (link.amount || 0) / 100
                                      ).toLocaleString()}{" "}
                                      ₽
                                    </td>
                                    <td>
                                      {isEditingThis ? (
                                        <select
                                          value={editingStatus}
                                          onChange={(e) =>
                                            setEditingRows((prev) => ({
                                              ...prev,
                                              [rowKey]: e.target.value,
                                            }))
                                          }
                                          className="row-status-select"
                                        >
                                          <option value="pending">
                                            {t(
                                              "earlyDiagnosis.status_pending",
                                            ) || "Pending"}
                                          </option>
                                          <option value="paid">
                                            {t("earlyDiagnosis.status_paid") ||
                                              "Paid"}
                                          </option>
                                          <option value="processing">
                                            {t(
                                              "earlyDiagnosis.status_processing",
                                            ) || "Processing"}
                                          </option>
                                          <option value="failed">
                                            {t(
                                              "earlyDiagnosis.status_failed",
                                            ) || "Failed"}
                                          </option>
                                          <option value="refunded">
                                            {t(
                                              "earlyDiagnosis.status_refunded",
                                            ) || "Refunded"}
                                          </option>
                                        </select>
                                      ) : (
                                        <span
                                          className={`appt-status-badge ${getApptStatusClass(link.status)}`}
                                        >
                                          {(
                                            t(
                                              `earlyDiagnosis.status_${link.status?.toLowerCase()}`,
                                            ) ||
                                            link.status ||
                                            ""
                                          ).toUpperCase()}
                                        </span>
                                      )}
                                    </td>
                                    <td>
                                      <div className="payment-actions">
                                        {isEditingThis ? (
                                          <>
                                            <button
                                              onClick={() =>
                                                handleRowEditSave(link, index)
                                              }
                                              className="action-btn save-row-btn"
                                              title="Save"
                                            >
                                              <Save size={14} />
                                            </button>
                                            <button
                                              onClick={() =>
                                                setEditingRows((prev) => {
                                                  const next = { ...prev };
                                                  delete next[rowKey];
                                                  return next;
                                                })
                                              }
                                              className="action-btn cancel-row-btn"
                                              title="Cancel"
                                            >
                                              <X size={14} />
                                            </button>
                                          </>
                                        ) : (
                                          <button
                                            onClick={() => {
                                              setEditingRows((prev) => ({
                                                ...prev,
                                                [rowKey]:
                                                  link.status || "pending",
                                              }));
                                            }}
                                            className="action-btn edit-row-btn"
                                            title="Edit"
                                          >
                                            <Edit2 size={14} />
                                          </button>
                                        )}
                                        {hasUrl && (
                                          <>
                                            <button
                                              onClick={() =>
                                                handleCopySpecificLink(
                                                  link.paymentId,
                                                  link.paymentUrl,
                                                )
                                              }
                                              className="action-btn copy-btn"
                                              title="Copy link"
                                            >
                                              {copiedLinkId ===
                                                link.paymentId ? (
                                                <Check size={14} />
                                              ) : (
                                                <Copy size={14} />
                                              )}
                                            </button>
                                            <a
                                              href={link.paymentUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="action-btn open-btn"
                                              title="Open link"
                                            >
                                              <ExternalLink size={14} />
                                            </a>
                                          </>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}

                    <div className="payment-row">
                      <span className="payment-label">
                        {t("earlyDiagnosis.packagePrice")}
                      </span>
                      <span className="payment-value">
                        {(booking.package?.price || 0).toLocaleString()} ₽
                      </span>
                    </div>
                    {booking.addOns &&
                      booking.addOns.length > 0 &&
                      booking.addOns.map((addon, idx) => (
                        <div className="payment-row" key={addon.id || idx}>
                          <span className="payment-label">{addon.name}</span>
                          <span className="payment-value">
                            {(addon.price || 0).toLocaleString()} ₽
                          </span>
                        </div>
                      ))}
                    <div className="payment-row">
                      <span className="payment-label">
                        {t("earlyDiagnosis.taxesFees")}
                      </span>
                      <span className="payment-value">0 ₽</span>
                    </div>
                    <div className="payment-divider"></div>
                    <div className="payment-total">
                      <span className="total-label">
                        {t("earlyDiagnosis.totalPaid")}
                      </span>
                      <span className="total-value">
                        {(
                          booking.totalAmount ||
                          booking.package?.price ||
                          0
                        ).toLocaleString()}{" "}
                        ₽
                      </span>
                    </div>
                  </div>
                )}

                {/* History & Logs */}
                {activeTab === "history" && (
                  <div className="sidebar-section">
                    <h3 className="sidebar-title">
                      {t("earlyDiagnosis.historyLogs").toUpperCase()}
                    </h3>
                    <div className="history-timeline">
                      {booking.payment?.status === "paid" && (
                        <div className="timeline-item timeline-item--completed">
                          <div className="timeline-dot green">
                            <CheckCircle size={12} />
                          </div>
                          <div className="timeline-content timeline-content--plain">
                            <p className="timeline-kicker timeline-kicker--completed">
                              {t("earlyDiagnosis.completed", "Completed")}
                            </p>
                            <p className="timeline-title">
                              {t("earlyDiagnosis.paymentVerified")}
                            </p>
                            <p className="timeline-description">
                              {(() => {
                                const transactionRef =
                                  booking.payment?.transactionId ||
                                  booking.payment?.tbank?.paymentId ||
                                  booking.payment?.tbank?.orderId;
                                if (transactionRef) {
                                  return `${t("earlyDiagnosis.transaction", "Transaction")} #${transactionRef} ${t("earlyDiagnosis.paymentProcessed", "successfully processed for this booking.")}`;
                                }
                                return t(
                                  "earlyDiagnosis.paymentStatusUpdated",
                                  "Payment was successfully verified for this booking.",
                                );
                              })()}
                            </p>
                            <div className="timeline-pills">
                              <span className="timeline-pill">
                                {formatDate(booking.payment.paidAt)}
                              </span>
                              <span className="timeline-pill">
                                {new Date(
                                  booking.payment.paidAt,
                                ).toLocaleTimeString(
                                  i18n.language === "ru" ? "ru-RU" : "en-US",
                                  { hour: "2-digit", minute: "2-digit" },
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="timeline-item timeline-item--milestone">
                        <div className="timeline-dot blue">
                          <Calendar size={12} />
                        </div>
                        <div className="timeline-content timeline-content--plain">
                          <p className="timeline-kicker timeline-kicker--milestone">
                            {t(
                              "earlyDiagnosis.nextMilestone",
                              "Next milestone",
                            )}
                          </p>
                          <p className="timeline-title">
                            {t("earlyDiagnosis.appointmentScheduled")}
                          </p>

                          <div className="timeline-service-list">
                            {[1, 2].map((day) => {
                              const dayItems = groupedSchedule?.[day] || [];
                              if (!dayItems.length) return null;

                              return (
                                <div
                                  key={`timeline-day-${day}`}
                                  className="timeline-day-group"
                                >
                                  <p className="timeline-day-title">{`${t("earlyDiagnosis.dayLabel", "Day")} ${day}`}</p>
                                  {dayItems.map((specialist, idx) => (
                                    <div
                                      key={`service-log-${day}-${idx}`}
                                      className="timeline-service-card"
                                    >
                                      <div className="timeline-service-icon">
                                        <FileText size={16} />
                                      </div>
                                      <div className="timeline-service-main">
                                        <p className="timeline-service-title">
                                          {specialist.title
                                            ? t(
                                              `earlyDiagnosis.specialist_${normalizeSpecialistTitle(specialist.title)}`,
                                              specialist.title,
                                            )
                                            : `${t("earlyDiagnosis.service", "Service")} ${idx + 1}`}
                                        </p>
                                        <p className="timeline-service-sub">
                                          {specialist.date
                                            ? formatDate(specialist.date)
                                            : t(
                                              "earlyDiagnosis.dateNotSet",
                                              "Date not set",
                                            )}
                                          {specialist.startTime &&
                                            specialist.endTime
                                            ? ` · ${specialist.startTime} - ${specialist.endTime}`
                                            : ""}
                                        </p>
                                      </div>
                                      <div className="timeline-service-side">
                                        <p className="timeline-service-doctor">
                                          <User size={12} />{" "}
                                          {getDoctorDisplayName(
                                            specialist.doctor,
                                          )}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </div>

                          <p className="timeline-date">
                            {formatDateTime(booking.appointmentDate)}
                          </p>
                        </div>
                      </div>

                      <div className="timeline-item timeline-item--system">
                        <div className="timeline-dot gray">
                          <Clock size={12} />
                        </div>
                        <div className="timeline-content timeline-content--plain">
                          <p className="timeline-kicker">
                            {t("earlyDiagnosis.systemEvent", "System event")}
                          </p>
                          <p className="timeline-title">
                            {t("earlyDiagnosis.bookingCreated")}
                          </p>
                          <p className="timeline-description">
                            {t(
                              "earlyDiagnosis.bookingCreateDescription",
                              "Initial booking record created in system.",
                            )}
                          </p>
                          <p className="timeline-date">
                            {formatDateTime(booking.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Internal Notes */}
                {activeTab === "notes" && (
                  <div className="sidebar-section">
                    <div className="notes-shell">
                      <div className="notes-toolbar">
                        <h3 className="sidebar-title notes-title">
                          {t("earlyDiagnosis.internalNotes").toUpperCase()}
                        </h3>
                        {!isAddingNote && (
                          <button
                            className="notes-add-btn"
                            onClick={() => setIsAddingNote(true)}
                          >
                            <Plus size={14} />
                            {t("earlyDiagnosis.addNote")}
                          </button>
                        )}
                      </div>

                      <div className="notes-content">
                        {isAddingNote && (
                          <div className="add-note-form note-add-card">
                            <textarea
                              className="note-textarea"
                              placeholder={t("earlyDiagnosis.enterNoteHere")}
                              value={newNote}
                              onChange={(e) => setNewNote(e.target.value)}
                              rows={4}
                            />
                            <div className="note-actions">
                              <button
                                className="cancel-note-btn"
                                onClick={() => {
                                  setIsAddingNote(false);
                                  setNewNote("");
                                }}
                                disabled={isSaving}
                              >
                                {t("earlyDiagnosis.cancel")}
                              </button>
                              <button
                                className="save-note-btn"
                                onClick={handleAddNote}
                                disabled={isSaving || !newNote.trim()}
                              >
                                {isSaving
                                  ? t("earlyDiagnosis.saving")
                                  : t("earlyDiagnosis.saveNote")}
                              </button>
                            </div>
                          </div>
                        )}

                        {booking.internalNotes &&
                          booking.internalNotes.length > 0 ? (
                          <div className="notes-list notes-list--modern">
                            {booking.internalNotes.map((note, index) => (
                              <article
                                key={note._id || index}
                                className="note-card"
                              >
                                <div className="note-card-top">
                                  <div className="note-author-block">
                                    <div className="note-avatar">
                                      <User size={14} />
                                    </div>
                                    <div>
                                      <p className="note-author">
                                        {note.addedBy}
                                      </p>
                                      <p className="note-date">
                                        {formatDateTime(note.addedAt)}
                                      </p>
                                    </div>
                                  </div>

                                  {editingNoteId !== note._id && (
                                    <div className="note-buttons">
                                      <button
                                        className="edit-note-icon-btn"
                                        onClick={() => handleEditNote(note)}
                                        title={t("earlyDiagnosis.editNote")}
                                      >
                                        <Edit2 size={14} />
                                      </button>
                                      <button
                                        className="delete-note-icon-btn"
                                        onClick={() =>
                                          handleDeleteNote(note._id)
                                        }
                                        title={t("earlyDiagnosis.deleteNote")}
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {editingNoteId === note._id ? (
                                  <div className="edit-note-form note-edit-form">
                                    <textarea
                                      className="note-textarea"
                                      value={editingNoteText}
                                      onChange={(e) =>
                                        setEditingNoteText(e.target.value)
                                      }
                                      rows={3}
                                    />
                                    <div className="note-actions">
                                      <button
                                        className="cancel-note-btn"
                                        onClick={() => {
                                          setEditingNoteId(null);
                                          setEditingNoteText("");
                                        }}
                                        disabled={isSaving}
                                      >
                                        {t("earlyDiagnosis.cancel")}
                                      </button>
                                      <button
                                        className="save-note-btn"
                                        onClick={() =>
                                          handleUpdateNote(note._id)
                                        }
                                        disabled={
                                          isSaving || !editingNoteText.trim()
                                        }
                                      >
                                        {isSaving
                                          ? t("earlyDiagnosis.saving")
                                          : t("earlyDiagnosis.save")}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="note-text">{note.note}</p>
                                )}
                              </article>
                            ))}
                          </div>
                        ) : (
                          <div className="notes-empty">
                            <p className="note-text">
                              {t("earlyDiagnosis.noNotesAdded")}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showTestSettingsModal &&
        createPortal(
          <div
            className="mp-modal-overlay"
            onClick={() => setShowTestSettingsModal(false)}
          >
            <div
              className="mp-modal ed-manage-tests-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mp-modal-header">
                <h3>{t("earlyDiagnosis.manageTests", "Manage tests")}</h3>
                <button
                  className="mp-modal-close"
                  onClick={() => setShowTestSettingsModal(false)}
                >
                  ×
                </button>
              </div>

              <div className="mp-modal-body">
                <div className="mp-field">
                  <label className="mp-field-label">EN</label>
                  <input
                    className="mp-input"
                    value={testDraft.en}
                    onChange={(e) =>
                      setTestDraft((prev) => ({ ...prev, en: e.target.value }))
                    }
                    placeholder="Test name (EN)"
                  />
                </div>
                <div className="mp-field">
                  <label className="mp-field-label">RU</label>
                  <input
                    className="mp-input"
                    value={testDraft.ru}
                    onChange={(e) =>
                      setTestDraft((prev) => ({ ...prev, ru: e.target.value }))
                    }
                    placeholder="Название теста (RU)"
                  />
                </div>

                <div className="ed-manage-tests-actions">
                  <button
                    className="save-btn"
                    onClick={handleManagedTestSave}
                    disabled={savingManagedTest}
                  >
                    {savingManagedTest
                      ? t("earlyDiagnosis.saving", "Saving...")
                      : t("earlyDiagnosis.save", "Save")}
                  </button>
                  {editingManagedTestId && (
                    <button
                      className="cancel-btn"
                      onClick={() => {
                        setEditingManagedTestId("");
                        setTestDraft({ en: "", ru: "" });
                      }}
                    >
                      {t("earlyDiagnosis.cancel", "Cancel")}
                    </button>
                  )}
                </div>

                <div className="ed-managed-tests-list">
                  {(managedTests?.[settingsSection] || []).map((item) => (
                    <div
                      className="ed-managed-test-row"
                      key={normalizeId(item?._id)}
                    >
                      <div className="ed-managed-test-name">
                        <strong>{item?.name?.en}</strong>
                        <span>{item?.name?.ru}</span>
                      </div>
                      <div className="ed-managed-test-buttons">
                        <button
                          className="edit-note-icon-btn"
                          onClick={() => {
                            setEditingManagedTestId(normalizeId(item?._id));
                            setTestDraft({
                              en: item?.name?.en || "",
                              ru: item?.name?.ru || "",
                            });
                          }}
                          title={t("earlyDiagnosis.edit", "Edit")}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="delete-note-icon-btn"
                          onClick={() =>
                            handleManagedTestDelete(normalizeId(item?._id))
                          }
                          title={t("earlyDiagnosis.delete", "Delete")}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {showUploadModal &&
        createPortal(
          <div
            className="mp-modal-overlay"
            onClick={() => setShowUploadModal(false)}
          >
            <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
              <div className="mp-modal-header">
                <h3>{t("earlyDiagnosis.uploadFile", "Upload file")}</h3>
                <button
                  className="mp-modal-close"
                  onClick={() => setShowUploadModal(false)}
                >
                  ×
                </button>
              </div>

              <div className="mp-modal-body">
                {sectionsWithTestSelection.includes(uploadSection) && (
                  <div className="mp-field">
                    <label className="mp-field-label">
                      {t("earlyDiagnosis.selectTest", "Select test")}
                    </label>
                    <select
                      className="mp-select"
                      value={uploadItemId}
                      onChange={(e) => setUploadItemId(e.target.value)}
                    >
                      <option value="">
                        {t("earlyDiagnosis.selectTest", "Select test")}
                      </option>
                      {managedTestOptions.map((item) => (
                        <option
                          key={normalizeId(item?._id)}
                          value={normalizeId(item?._id)}
                        >
                          {readLocalizedName(item?.name)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {!multiUploadSections.includes(uploadSection) && (
                  <div className="mp-field">
                    <label className="mp-field-label">
                      {t("earlyDiagnosis.customName", "Custom name")}
                    </label>
                    <input
                      className="mp-input"
                      value={uploadCustomName}
                      onChange={(e) => setUploadCustomName(e.target.value)}
                      placeholder={t(
                        "earlyDiagnosis.customNameOptional",
                        "Optional",
                      )}
                    />
                  </div>
                )}

                {multiUploadSections.includes(uploadSection) ? (
                  <>
                    <div className="mp-field">
                      <label className="mp-field-label">
                        {t("earlyDiagnosis.file", "File")}
                      </label>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <input
                          type="file"
                          className="mp-input"
                          style={{ flex: 1 }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setUploadFiles((prev) => [
                                ...prev,
                                { file, customName: "" },
                              ]);
                              e.target.value = "";
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Display added files with custom name inputs */}
                    {uploadFiles.length > 0 && (
                      <div style={{ marginTop: "12px" }}>
                        <label className="mp-field-label">
                          {t("earlyDiagnosis.files", "Files to upload")}
                        </label>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                          }}
                        >
                          {uploadFiles.map((fileItem, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: "flex",
                                gap: "8px",
                                alignItems: "center",
                              }}
                            >
                              <input
                                type="text"
                                className="mp-input"
                                placeholder={t(
                                  "earlyDiagnosis.customName",
                                  "Custom name",
                                )}
                                value={fileItem.customName}
                                onChange={(e) => {
                                  const newFiles = [...uploadFiles];
                                  newFiles[idx].customName = e.target.value;
                                  setUploadFiles(newFiles);
                                }}
                                style={{ flex: 1 }}
                              />
                              <span
                                style={{
                                  fontSize: "12px",
                                  color: "#6b7280",
                                  minWidth: "120px",
                                }}
                              >
                                {fileItem.file.name}
                              </span>
                              <button
                                type="button"
                                className="delete-note-icon-btn"
                                onClick={() => {
                                  setUploadFiles((prev) =>
                                    prev.filter((_, i) => i !== idx),
                                  );
                                }}
                                title={t("earlyDiagnosis.remove", "Remove")}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="mp-field">
                    <label className="mp-field-label">
                      {t("earlyDiagnosis.file", "File")}
                    </label>
                    <input
                      type="file"
                      className="mp-input"
                      onChange={(e) =>
                        setUploadFile(e.target.files?.[0] || null)
                      }
                    />
                  </div>
                )}
              </div>

              <div className="mp-modal-footer">
                <button
                  className="mp-btn-cancel"
                  onClick={() => setShowUploadModal(false)}
                  disabled={isUploadingSectionFile}
                >
                  {t("earlyDiagnosis.cancel", "Cancel")}
                </button>
                <button
                  className="mp-btn-save"
                  onClick={handleUploadSectionFile}
                  disabled={isUploadingSectionFile}
                >
                  {isUploadingSectionFile
                    ? t("earlyDiagnosis.saving", "Saving...")
                    : t("earlyDiagnosis.upload", "Upload")}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Manual Payment Modal */}
      {showManualPaymentForm &&
        createPortal(
          <div
            className="mp-modal-overlay"
            onClick={() => setShowManualPaymentForm(false)}
          >
            <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
              <div className="mp-modal-header">
                <h3>{t("earlyDiagnosis.manualPaymentEntry")}</h3>
                <button
                  className="mp-modal-close"
                  onClick={() => setShowManualPaymentForm(false)}
                >
                  ×
                </button>
              </div>

              <div className="mp-modal-body">
                {/* Package Selection */}
                <div className="mp-section">
                  <h4 className="mp-section-title">
                    {t("earlyDiagnosis.selectPackageAddons")}
                  </h4>

                  <label className="mp-field-label">
                    {t("earlyDiagnosis.mainPackage")}
                  </label>
                  <div className="mp-packages">
                    {ED_PACKAGES.map((pkg) => (
                      <label
                        key={pkg.id}
                        className={`mp-package-card${manualSelectedPkg === pkg.id ? " mp-package-card--active" : ""}`}
                      >
                        <input
                          type="radio"
                          name="mp-pkg"
                          value={pkg.id}
                          checked={manualSelectedPkg === pkg.id}
                          onChange={() => setManualSelectedPkg(pkg.id)}
                          style={{ display: "none" }}
                        />
                        <span className="mp-package-name">{pkg.name}</span>
                        <span className="mp-package-price">
                          {pkg.price.toLocaleString()} ₽
                        </span>
                      </label>
                    ))}
                  </div>

                  <label
                    className="mp-field-label"
                    style={{ marginTop: "12px" }}
                  >
                    {t("earlyDiagnosis.addons")}
                  </label>
                  <div className="mp-addons">
                    {ED_ADDONS.map((addon) => {
                      const isOn = manualSelectedAddons.includes(addon.id);
                      return (
                        <label
                          key={addon.id}
                          className={`mp-addon-row${isOn ? " mp-addon-row--active" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={isOn}
                            onChange={() => toggleManualAddon(addon.id)}
                          />
                          <span className="mp-addon-name">{addon.name}</span>
                          <span className="mp-addon-price">
                            {addon.price.toLocaleString()} ₽
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="mp-total-row">
                    <span>{t("earlyDiagnosis.selectedTotal")}</span>
                    <span className="mp-total-value">
                      {manualTotal.toLocaleString()} ₽
                    </span>
                  </div>
                </div>

                {/* Payment Details */}
                <div className="mp-section">
                  <div className="mp-field">
                    <label className="mp-field-label">
                      {t("earlyDiagnosis.paymentMethod") || "Payment Method"}
                    </label>
                    <select
                      value={manualPayment.paymentMethod || "manual_admin"}
                      onChange={(e) =>
                        setManualPayment((p) => ({
                          ...p,
                          paymentMethod: e.target.value,
                        }))
                      }
                      className="mp-select"
                    >
                      {PAYMENT_METHOD_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {t(`earlyDiagnosis.paymentMethods.${opt.value}`) || opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mp-field">
                    <label className="mp-field-label">
                      {t("earlyDiagnosis.paymentStatusLabel")}
                    </label>
                    <select
                      value={manualPayment.paymentStatus}
                      onChange={(e) =>
                        setManualPayment((p) => ({
                          ...p,
                          paymentStatus: e.target.value,
                        }))
                      }
                      className="mp-select"
                    >
                      <option value="paid">
                        {t("earlyDiagnosis.status_paid")}
                      </option>
                      <option value="pending">
                        {t("earlyDiagnosis.status_pending")}
                      </option>
                      <option value="processing">
                        {t("earlyDiagnosis.status_processing")}
                      </option>
                      <option value="failed">
                        {t("earlyDiagnosis.status_failed")}
                      </option>
                      <option value="refunded">
                        {t("earlyDiagnosis.status_refunded")}
                      </option>
                    </select>
                  </div>

                  {manualPayment.paymentStatus === "paid" && (
                    <div className="mp-field">
                      <label className="mp-field-label">
                        {t("earlyDiagnosis.paymentDateLabel")}
                      </label>
                      <input
                        type="date"
                        value={manualPayment.paymentDate}
                        onChange={(e) =>
                          setManualPayment((p) => ({
                            ...p,
                            paymentDate: e.target.value,
                          }))
                        }
                        className="mp-input"
                      />
                    </div>
                  )}

                  <div className="mp-field">
                    <label className="mp-field-label">
                      {t("earlyDiagnosis.notesLabel")}
                    </label>
                    <textarea
                      value={manualPayment.notes}
                      onChange={(e) =>
                        setManualPayment((p) => ({
                          ...p,
                          notes: e.target.value,
                        }))
                      }
                      placeholder={t("earlyDiagnosis.enterNotes")}
                      className="mp-textarea"
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              <div className="mp-modal-footer">
                <button
                  className="mp-btn-cancel"
                  onClick={() => setShowManualPaymentForm(false)}
                  disabled={isSavingManual}
                >
                  {t("earlyDiagnosis.cancel")}
                </button>
                <button
                  className="mp-btn-save"
                  onClick={handleManualPaymentSave}
                  disabled={isSavingManual}
                >
                  {isSavingManual
                    ? t("earlyDiagnosis.saving")
                    : t("earlyDiagnosis.savePayment")}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {showPaymentMethodModal &&
        createPortal(
          <div
            className="mp-modal-overlay"
            onClick={() => setShowPaymentMethodModal(false)}
          >
            <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
              <div className="mp-modal-header">
                <h3>{t("earlyDiagnosis.paymentMethod") || "Payment Method"}</h3>
                <button
                  className="mp-modal-close"
                  onClick={() => setShowPaymentMethodModal(false)}
                >
                  ×
                </button>
              </div>

              <div className="mp-modal-body">
                {/* Package & Add-on selection for online payments */}
                {pendingPaymentAction === "online" && (
                  <div className="mp-section">
                    <h4 className="mp-section-title">
                      {t("earlyDiagnosis.selectPackageAddons")}
                    </h4>

                    <label className="mp-field-label">
                      {t("earlyDiagnosis.mainPackage")}
                    </label>
                    <div className="mp-packages">
                      {ED_PACKAGES.map((pkg) => (
                        <label
                          key={pkg.id}
                          className={`mp-package-card${onlineSelectedPkg === pkg.id ? " mp-package-card--active" : ""}`}
                        >
                          <input
                            type="radio"
                            name="online-pkg"
                            value={pkg.id}
                            checked={onlineSelectedPkg === pkg.id}
                            onChange={() => setOnlineSelectedPkg(pkg.id)}
                            style={{ display: "none" }}
                          />
                          <span className="mp-package-name">{pkg.name}</span>
                          <span className="mp-package-price">
                            {pkg.price.toLocaleString()} ₽
                          </span>
                        </label>
                      ))}
                    </div>

                    <label className="mp-field-label" style={{ marginTop: "12px" }}>
                      {t("earlyDiagnosis.addons")}
                    </label>
                    <div className="mp-addons">
                      {ED_ADDONS.map((addon) => {
                        const isOn = onlineSelectedAddons.includes(addon.id);
                        return (
                          <label
                            key={addon.id}
                            className={`mp-addon-row${isOn ? " mp-addon-row--active" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={isOn}
                              onChange={() => toggleOnlineAddon(addon.id)}
                            />
                            <span className="mp-addon-name">{addon.name}</span>
                            <span className="mp-addon-price">
                              {addon.price.toLocaleString()} ₽
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    <div className="mp-total-row">
                      <span>{t("earlyDiagnosis.selectedTotal")}</span>
                      <span className="mp-total-value">
                        {onlineTotal.toLocaleString()} ₽
                      </span>
                    </div>
                  </div>
                )}

                <div className="mp-field">
                  <label className="mp-field-label">
                    {t("earlyDiagnosis.paymentMethod") || "Payment Method"}
                  </label>
                  <select
                    value={selectedPaymentMethod}
                    onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                    className="mp-select"
                  >
                    {paymentMethodOptionsForAction.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {t(`earlyDiagnosis.paymentMethods.${opt.value}`) || opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mp-modal-footer">
                <button
                  className="mp-btn-cancel"
                  onClick={() => setShowPaymentMethodModal(false)}
                >
                  {t("earlyDiagnosis.cancel")}
                </button>
                <button className="mp-btn-save" onClick={handleConfirmPaymentMethod}>
                  {pendingPaymentAction === "online"
                    ? t("earlyDiagnosis.generate", "Generate")
                    : t("earlyDiagnosis.create", "Create")}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {edSectionPdfModal && (
        <EDSectionPDFModal
          title={edSectionPdfModal.title}
          commentHtml={edSectionPdfModal.commentHtml}
          files={edSectionPdfModal.files || []}
          booking={booking}
          onClose={() => setEdSectionPdfModal(null)}
        />
      )}
    </div>
  );
};

export default EarlyDetectionBookingDetails;
