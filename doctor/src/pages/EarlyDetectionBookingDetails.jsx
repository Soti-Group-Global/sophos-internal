import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
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
  Lock,
} from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import {
  getEarlyDetectionBookings,
  getEarlyDetectionBookingById,
  getEarlyDetectionApplication,
  getEmailFromToken,
  getEarlyDetectionDoctors,
  updateEarlyDetectionBooking,
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
  fetchEarlyDetectionScheduleFile,
  getEarlyDetectionScheduleFileUrl,
  saveEarlyDetectionSpecialistHistoryForm,
} from "../utils/api";
import { createPortal } from "react-dom";
import GeneralInformationTab from "../components/GeneralInformationTab";
import CustomCalendar from "../components/CustomCalendar";
import CustomTimePicker from "../components/CustomTimePicker";
import RichTextEditor from "../components/RichTextEditor";
import SpecialistHistoryForm from "../components/SpecialistHistoryForm";
import EarlyDetectionReportTab from "./EarlyDetectionReportTab";
import "../styles/EarlyDetectionBookingDetails.css";
import "../styles/AppointmentDetails.css";

const ED_PACKAGES = [{ id: "predict", name: { en: "PREDICT", ru: "«ПРЕДИКТ»" }, price: 99500 }];

const ED_ADDONS = [
  { id: "predict-plus", name: { en: "Upgrade PREDICT+5", ru: "Апгрейд «ПРЕДИКТ+5»" }, price: 98000 },
  { id: "ct", name: { en: "Chest LDCT", ru: "НДКТ грудной клетки" }, price: 11700 },
  { id: "mri", name: { en: "Brain MRI", ru: "МРТ головного мозга" }, price: 12000 },
  { id: "endoscopy", name: { en: "Gastroscopy + Colonoscopy", ru: "Гастроскопия + колоноскопия" }, price: 28500 },
  { id: "mammography", name: { en: "Mammography with Tomosynthesis", ru: "Маммография с томосинтезом" }, price: 12000 },
  { id: "oncosearch", name: { en: "Oncosearch", ru: "Онкопоиск" }, price: 50000 },
  { id: "insurance", name: { en: "Onco-insurance", ru: "Онкострахование" }, price: 35000 },
];

const SPECIALTY_ALIASES = {
  ultrasound: ["ultrasound", "ultrasound diagnostics", "sonologist", "ultrasonography", "diagnostic", "узи", "ультразв", "ультразву"],
  gynecologist: ["gynecologist", "gynaecologist", "gynecology", "oncogynecology", "obstetric", "гинеколог", "гинекологи", "онкогинек"],
  therapist: ["therapist", "therapy", "internal medicine", "general practitioner", "general practice", "physician", "терапевт", "терапия"],
  dermatologist: ["dermatologist", "dermatology", "dermatovenerology", "дерматолог", "дерматологи", "дерматовенер"],
  ophthalmologist: ["ophthalmologist", "ophthalmology", "oculist", "офтальмолог", "офтальмологи"],
  surgeon: ["surgeon", "surgery", "surgical", "хирург", "хирурги", "хирургия"],
  ent: ["ent", "otolaryngologist", "otorhinolaryngologist", "otorhinolaryngology", "лор", "оториноларинголог", "отоларинголог"],
};

const normalizeDoctorEmail = (doctor) => {
  if (!doctor) {
    console.log("[DEBUG] normalizeDoctorEmail: doctor is null/undefined");
    return null;
  }

  if (typeof doctor === "string") {
    console.log("[DEBUG] normalizeDoctorEmail: doctor is string:", doctor);
    return doctor.toLowerCase();
  }

  if (doctor?.email) {
    const normalizedEmail = doctor.email.toLowerCase();
    console.log("[DEBUG] normalizeDoctorEmail: extracted email from doctor.email:", normalizedEmail);
    return normalizedEmail;
  }

  if (doctor?.doctorEmail) {
    const normalizedEmail = doctor.doctorEmail.toLowerCase();
    console.log("[DEBUG] normalizeDoctorEmail: extracted email from doctor.doctorEmail:", normalizedEmail);
    return normalizedEmail;
  }

  // If doctor is an object but has no email fields
  console.log("[DEBUG] normalizeDoctorEmail: doctor is object but has no email:", {
    keys: Object.keys(doctor),
    type: typeof doctor,
    hasId: !!doctor._id,
    hasEmail: !!doctor.email,
    hasDoctorEmail: !!doctor.doctorEmail,
  });

  return null;
};


const formatNoteText = (value) => {
  if (value === null || value === undefined) return "";

  if (typeof value === "string") {
    const trimmed = value.trim();

    // If the value is a JSON string containing localized names, parse and format.
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        const parsed = JSON.parse(trimmed);
        const parsedText = formatNoteText(parsed);
        if (parsedText) return parsedText;
      } catch {
        // Not valid JSON; continue
      }
    }

    return trimmed;
  }

  if (typeof value === "object") {
    // Localized format support
    if (value.en && typeof value.en === "string" && value.en.trim()) return value.en.trim();
    if (value.ru && typeof value.ru === "string" && value.ru.trim()) return value.ru.trim();

    if (typeof value.text === "string" && value.text.trim()) return value.text.trim();
    if (typeof value.value === "string" && value.value.trim()) return value.value.trim();
    if (typeof value.note === "string" && value.note.trim()) return value.note.trim();
    if (typeof value.comment === "string" && value.comment.trim()) return value.comment.trim();

    // Object with nested fields e.g. {name: {en:...}}
    const possibleValues = [
      value.name,
      value.addedBy,
      value.author,
      value.user,
    ];
    for (const candidate of possibleValues) {
      if (candidate) {
        const text = formatNoteText(candidate);
        if (text) return text;
      }
    }

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value).trim();
};

const normalizeInternalNotes = (notes) => {
  if (!Array.isArray(notes)) {
    return [];
  }
  return notes
    .map((note, index) => {
      if (!note || typeof note !== "object") {
        return {
          _id: `note-${index}`,
          note: formatNoteText(note),
          addedBy: t("earlyDiagnosis.unknown"),
          addedAt: new Date().toISOString(),
        };
      }

      return {
        _id: normalizeId(note._id ?? note.id ?? `note-${index}`),
        note: formatNoteText(note.note ?? note.text ?? note.comment),
        addedBy: formatNoteText(note.addedBy ?? note.author ?? t("earlyDiagnosis.unknown")),
        addedAt: note.addedAt ?? note.createdAt ?? new Date().toISOString(),
      };
    })
    .filter((item) => !!item && item.note);
};

const sanitizeBookingData = (bookingData) => {
  if (!bookingData || typeof bookingData !== "object") return bookingData;

  return {
    ...bookingData,
    internalNotes: normalizeInternalNotes(bookingData.internalNotes),
  };
};

const DEFAULT_SPECIALIST_CONSULTATIONS = [
  { title: "Ultrasound" },
  { title: "Gynecologist" },
  { title: "Therapist" },
  { title: "Dermatologist" },
  { title: "Ophthalmologist" },
  { title: "Surgeon" },
  { title: "ENT" },
];

const getVisibleSpecialistConsultations = (booking) => {
  const list = Array.isArray(booking?.schedule?.specialistConsultations)
    ? booking.schedule.specialistConsultations
    : [];
  return list.length > 0 ? list : DEFAULT_SPECIALIST_CONSULTATIONS;
};

const normalizeMatchText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const toLocalDateOnly = (value) => {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatLocalDateOnly = (value, locale = "en-US") => {
  const dateOnly = toLocalDateOnly(value);
  if (!dateOnly) return "-";
  const [y, m, d] = dateOnly.split("-").map(Number);
  const localDate = new Date(y, (m || 1) - 1, d || 1);
  return localDate.toLocaleDateString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

const normalizeId = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);

  if (typeof value === "object") {
    if (typeof value.toHexString === "function") return value.toHexString();
    if (typeof value.$oid === "string") return value.$oid;
    if (typeof value._id === "string" || typeof value._id === "number") return String(value._id);
    if (typeof value.id === "string" || typeof value.id === "number") return String(value.id);
  }

  return "";
};

const getDoctorSpecialtyNames = (doctor) => {
  const specialties = Array.isArray(doctor?.specialtyIds) ? doctor.specialtyIds : [];
  const subSpecialties = Array.isArray(doctor?.subSpecialityIds) ? doctor.subSpecialityIds : [];

  return [...specialties, ...subSpecialties]
    .flatMap((specialty) => [specialty?.name_en, specialty?.name_ru])
    .filter(Boolean)
    .map(normalizeMatchText);
};

const doctorMatchesScheduleTitle = (doctor, title) => {
  const normalizedTitle = normalizeMatchText(title);
  const aliases = (SPECIALTY_ALIASES[normalizedTitle] || [String(title)]).map(normalizeMatchText);
  const specialtyNames = getDoctorSpecialtyNames(doctor);
  return aliases.some((alias) =>
    specialtyNames.some(
      (specialtyName) => specialtyName.includes(alias) || alias.includes(specialtyName),
    ),
  );
};

const normalizeSpecialistTitle = (title) => {
  if (!title) return title;
  const normalizedTitle = normalizeMatchText(title);

  // Map normalized titles to English keys
  const titleMap = {
    "gynecologist": "Gynecologist",
    "therapist": "Therapist",
    "dermatologist": "Dermatologist",
    "ophthalmologist": "Ophthalmologist",
    "surgeon": "Surgeon",
    "ent": "ENT",
    "ultrasound": "Ultrasound",
  };

  return titleMap[normalizedTitle] || title;
};

const EarlyDetectionBookingDetails = () => {
  const { t, i18n } = useTranslation();
  const translateStatus = (status) => {
    const normalized = normalizeStatusValue(status);
    return t(`appointmentStatus.${(normalized || "").toLowerCase()}`, normalized || t("common.unknown"));
  };
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const currentDoctorEmail = (location?.state?.doctorEmail || getEmailFromToken() || "").toLowerCase();

  // DEBUG: Log current doctor email on component load
  useEffect(() => {
    const tokenEmail = getEmailFromToken();
    const stateEmail = location?.state?.doctorEmail;
    console.log("[DEBUG] Email extraction:", {
      fromToken: tokenEmail,
      fromState: stateEmail,
      final: currentDoctorEmail,
      isEmpty: !currentDoctorEmail,
    });
    if (!currentDoctorEmail) {
      console.warn("[WARN] currentDoctorEmail is empty! No email found from token or location state. All specialist tabs will be read-only.");
    }
  }, [currentDoctorEmail]);
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
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
  const [showManualPaymentForm, setShowManualPaymentForm] = useState(false);
  const [manualPayment, setManualPayment] = useState({
    transactionId: "",
    notes: "",
    paymentStatus: "paid",
  });
  const [manualSelectedPkg, setManualSelectedPkg] = useState("predict");
  const [manualSelectedAddons, setManualSelectedAddons] = useState([]);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [editingRowId, setEditingRowId] = useState(null);
  const [editingRowStatus, setEditingRowStatus] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [testToDelete, setTestToDelete] = useState(null);
  const [showDeleteNoteConfirm, setShowDeleteNoteConfirm] = useState(false);
  const [noteIdToDelete, setNoteIdToDelete] = useState(null);
  const [activeTab, setActiveTab] = useState("appointmentDetails");
  const [activeScheduleTab, setActiveScheduleTab] = useState("laboratoryTests");
  const [activeSpecialistTab, setActiveSpecialistTab] = useState(0);
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
  const [uploadFiles, setUploadFiles] = useState([]); // For multiple file uploads with custom names
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
    if (!Array.isArray(patientBookings) || patientBookings.length === 0) return;

    const normalizedSelected = normalizeId(selectedBookingId);
    const hasSelectedBooking = patientBookings.some((item) => {
      const candidateIds = [
        normalizeId(item?._id),
        normalizeId(item?.bookingNumber),
        normalizeId(item?.invoiceNumber),
        normalizeId(item?.applicationId),
        normalizeId(item?.id),
      ].filter(Boolean);
      return normalizedSelected && candidateIds.includes(normalizedSelected);
    });

    if (!hasSelectedBooking) {
      const firstItem = patientBookings[0];
      const firstItemId = normalizeId(
        firstItem?._id || firstItem?.bookingNumber || firstItem?.invoiceNumber || firstItem?.applicationId || firstItem?.id,
      );
      if (firstItemId) {
        setSelectedBookingId(firstItemId);
      }
    }
  }, [patientBookings, selectedBookingId]);

  useEffect(() => {
    // Intentionally disabled for now: backend endpoint is not available yet
    // and this page should still open without network 404 noise.
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
    const consultations = Array.isArray(booking?.schedule?.specialistConsultations)
      ? booking.schedule.specialistConsultations
      : [];
    const formsMap = {};
    consultations.forEach((c, i) => {
      formsMap[i] = c?.historyForm || {};
    });
    setSpecialistForms(formsMap);
  }, [booking]);

  useEffect(() => {
    if (activeScheduleTab !== "specialistConsultation") return;

    const consultations = getVisibleSpecialistConsultations(booking);

    setActiveSpecialistTab((prev) => {
      if (consultations.length === 0) {
        return null;
      }
      if (prev === null || prev < 0 || prev >= consultations.length) {
        return 0;
      }
      return prev;
    });
  }, [activeScheduleTab, booking]);

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
      let foundBooking = null;
      let list = [];
      const normalizedId = normalizeId(bookingId);
      const doctorEmailFromState = location?.state?.doctorEmail || getEmailFromToken();
      const unwrapBookingResponse = (response) => {
        const payload = response?.data?.data ?? response?.data;
        return payload && typeof payload === "object" ? payload : null;
      };

      const buildBookingFromApplication = (applicationData, bookingsList) => {
        if (!applicationData) return null;

        const patientNameParts = String(applicationData?.patientName || "").trim().split(/\s+/).filter(Boolean);
        const patientLastName = patientNameParts[0] || "";
        const patientFirstName = patientNameParts[1] || "";
        const patientMiddleName = patientNameParts.slice(2).join(" ");

        const scheduleItems = Array.isArray(applicationData?.appointments)
          ? applicationData.appointments.map((appt, index) => ({
            _id: normalizeId(appt?._id) || `appt-${index}`,
            title: appt?.title || "Consultation",
            isCompleted: String(appt?.appointmentStatus || "").toLowerCase() === "completed",
            date: appt?.date || null,
            startTime: appt?.startTime || "",
            endTime: appt?.endTime || "",
            doctor: appt?.doctor || appt?.doctorEmail || null,
            historyForm: {},
          }))
          : [];

        // Try to find a real EarlyDetectionBooking from the list to get the correct MongoDB _id
        let realBookingId = null;
        if (bookingsList && Array.isArray(bookingsList)) {
          const appointmentDateStr = scheduleItems?.[0]?.date
            ? new Date(scheduleItems[0].date).toISOString().split('T')[0]
            : null;

          const matchingBooking = bookingsList.find((b) => {
            // Match by appointment date + first specialist consultation date
            if (appointmentDateStr && b?.schedule?.specialistConsultations?.[0]?.date) {
              const bookingDateStr = new Date(b.schedule.specialistConsultations[0].date)
                .toISOString()
                .split('T')[0];
              return bookingDateStr === appointmentDateStr;
            }
            return false;
          });

          if (matchingBooking) {
            realBookingId = normalizeId(matchingBooking._id);
          }
        }

        return {
          _id: realBookingId || applicationData?._id || applicationData?.applicationId || normalizedId,
          _realBookingId: realBookingId, // Store separately so we can use it for API calls
          bookingNumber: applicationData?.applicationId || normalizedId,
          invoiceNumber: applicationData?.applicationId || normalizedId,
          applicationId: applicationData?.applicationId,
          status: "confirmed",
          createdAt: applicationData?.createdAt || new Date().toISOString(),
          appointmentDate: scheduleItems?.[0]?.date || applicationData?.createdAt || new Date().toISOString(),
          patient: {
            firstName: patientFirstName,
            middleName: patientMiddleName,
            lastName: patientLastName,
            email: applicationData?.patientEmail || location?.state?.patientEmail || "",
          },
          schedule: {
            specialistConsultations: scheduleItems,
            laboratoryTests: [],
            instrumentalAnalysis: [],
            morphologicalResearch: { files: [], comment: { value: "", isVerified: false } },
            proceduresAndManipulations: { files: [], comment: { value: "", isVerified: false } },
            surgeries: { files: [], comment: { value: "", isVerified: false } },
          },
          internalNotes: Array.isArray(applicationData?.comments)
            ? applicationData.comments.map((c, i) => ({
              _id: normalizeId(c?._id) || `note-${i}`,
              note: c?.text || c?.comment || "",
              addedBy: c?.addedBy || c?.author || t("earlyDiagnosis.doctor"),
              addedAt: c?.createdAt || c?.addedAt || new Date().toISOString(),
            }))
            : [],
          payment: {
            status: "pending",
            links: [],
          },
          package: ED_PACKAGES[0],
          addOns: [],
          totalAmount: ED_PACKAGES[0]?.price || 0,
        };
      };

      // Try direct booking get (by database _id)
      const isMongoObjectId = /^[a-fA-F0-9]{24}$/.test(normalizedId);
      if (isMongoObjectId) {
        try {
          const response = await getEarlyDetectionBookingById(bookingId);
          foundBooking = unwrapBookingResponse(response);
        } catch (innerErr) {
          if (!innerErr.response || innerErr.response?.status !== 404) {
            throw innerErr;
          }
        }
      }

      // Always fetch list for sidebar + fallback matching
      try {
        const res = await getEarlyDetectionBookings(doctorEmailFromState);
        list = Array.isArray(res?.data || res?.bookings) ? (res?.data || res?.bookings) : [];
      } catch {
        list = [];
      }
      setAllEDBookings(list);

      if (!foundBooking) {

        foundBooking = Array.isArray(list)
          ? list.find((b) => {
            const possibleIds = [
              b?._id,
              b?.bookingNumber,
              b?.invoiceNumber,
              b?.applicationId,
              b?.id,
            ]
              .filter(Boolean)
              .map(normalizeId);
            return possibleIds.includes(normalizedId);
          })
          : null;
      }

      if (!foundBooking && location?.state?.appointmentData) {
        foundBooking = buildBookingFromApplication(location.state.appointmentData, list);
      }

      if (!foundBooking) {
        try {
          const appResponse = await getEarlyDetectionApplication(normalizedId, doctorEmailFromState);
          const appData = appResponse?.data || appResponse;
          foundBooking = buildBookingFromApplication(appData, list);
        } catch {
          // Keep as null; handled below with notFound UI.
        }
      }

      if (foundBooking && !Array.isArray(foundBooking.internalNotes) && foundBooking?._id) {
        try {
          const detailsResponse = await getEarlyDetectionBookingById(foundBooking._id);
          const detailsBooking = unwrapBookingResponse(detailsResponse);
          if (detailsBooking) {
            foundBooking = detailsBooking;

            // DEBUG: Log specialist consultations when booking is fetched
            console.log("[DEBUG] Booking loaded from API, specialist consultations:",
              detailsBooking?.schedule?.specialistConsultations?.map((s, idx) => ({
                index: idx,
                title: s.title,
                doctorId: s.doctor?._id || s.doctor,
                doctorEmail: s.doctor?.email || "NO EMAIL FIELD",
                doctorObject: typeof s.doctor,
                hasDoctor: !!s.doctor,
              }))
            );
          }
        } catch {
          // Ignore and keep fallback booking object
        }
      }

      // IMPORTANT: Always try to load the real booking if we have an ID and specialist consultations are empty
      if (foundBooking?._id && (!foundBooking?.schedule?.specialistConsultations || foundBooking.schedule.specialistConsultations.length === 0)) {
        try {
          console.log("[DEBUG] Specialist consultations empty, trying to fetch full booking from API:", foundBooking._id);
          const detailsResponse = await getEarlyDetectionBookingById(foundBooking._id);
          const detailsBooking = unwrapBookingResponse(detailsResponse);
          if (detailsBooking?.schedule?.specialistConsultations?.length > 0) {
            console.log("[DEBUG] Successfully loaded specialist consultations from API");
            foundBooking = detailsBooking;
          }
        } catch (err) {
          console.warn("[DEBUG] Failed to load full booking details:", err.message);
        }
      }

      if (foundBooking) {
        const fallbackPatientName = String(foundBooking?.patientName || "").trim();
        const fallbackNameParts = fallbackPatientName.split(/\s+/).filter(Boolean);
        const normalizedPatient = {
          ...(foundBooking?.patient && typeof foundBooking.patient === "object" ? foundBooking.patient : {}),
          _id:
            normalizeId(foundBooking?.patient?._id) ||
            normalizeId(foundBooking?.patientId) ||
            normalizeId(foundBooking?.customer?._id) ||
            undefined,
          email:
            foundBooking?.patient?.email ||
            foundBooking?.patientEmail ||
            foundBooking?.customer?.email ||
            "",
          firstName:
            foundBooking?.patient?.firstName ||
            foundBooking?.customer?.firstName ||
            fallbackNameParts[0] ||
            "",
          middleName:
            foundBooking?.patient?.middleName ||
            foundBooking?.customer?.middleName ||
            fallbackNameParts[2] ||
            "",
          lastName:
            foundBooking?.patient?.lastName ||
            foundBooking?.customer?.lastName ||
            fallbackNameParts[1] ||
            "",
        };

        foundBooking = {
          ...foundBooking,
          patient: normalizedPatient,
        };

        setNotFound(false);

        // DEBUG: Log the full booking structure
        console.log("[DEBUG] Full booking object loaded:", {
          id: foundBooking._id,
          bookingNumber: foundBooking.bookingNumber,
          patientEmail: foundBooking?.patient?.email,
          scheduleExists: !!foundBooking.schedule,
          specialistConsultationsLength: foundBooking?.schedule?.specialistConsultations?.length || 0,
          specialistConsultations: foundBooking?.schedule?.specialistConsultations?.map((s, i) => ({
            index: i,
            title: s.title,
            doctor: s.doctor,
            hasHistoryForm: !!s.historyForm,
          })),
          fullBooking: JSON.stringify(foundBooking).substring(0, 500), // First 500 chars
        });

        setBooking(sanitizeBookingData(foundBooking));

        const email = foundBooking?.patient?.email || foundBooking?.customer?.email || "";
        const samePatient = !isInitialLoadFlag && email === prevPatientEmailRef.current;

        if (!samePatient) {
          // New patient (or first load) — fetch all related bookings for the sidebar
          prevPatientEmailRef.current = email || null;

          const normalizePhone = (val) => String(val || "").replace(/\D+/g, "");
          const normalizeName = (val) => String(val || "").trim().toLowerCase().replace(/\s+/g, " ");

          const getIdentity = (entry) => {
            const patient = entry?.patient || {};
            const customer = entry?.customer || {};

            const ids = [
              normalizeId(patient?._id || patient),
              normalizeId(customer?._id || customer),
            ].filter(Boolean);

            const emails = [
              String(patient?.email || "").trim().toLowerCase(),
              String(customer?.email || "").trim().toLowerCase(),
            ].filter(Boolean);

            const phones = [
              normalizePhone(patient?.phone || patient?.phoneNumber),
              normalizePhone(customer?.phone || customer?.phoneNumber),
            ].filter(Boolean);

            const names = [
              normalizeName([patient?.lastName, patient?.firstName, patient?.middleName].filter(Boolean).join(" ")),
              normalizeName([customer?.lastName, customer?.firstName, customer?.middleName].filter(Boolean).join(" ")),
            ].filter(Boolean);

            return { ids, emails, phones, names };
          };

          const baseIdentity = getIdentity(foundBooking);
          const currentBookingId = normalizeId(foundBooking?._id);

          const relatedBookings = (Array.isArray(list) ? list : [])
            .filter((item) => {
              const itemId = normalizeId(item?._id);
              if (currentBookingId && itemId && currentBookingId === itemId) return true;

              const itemIdentity = getIdentity(item);

              const hasIdMatch = baseIdentity.ids.some((v) => itemIdentity.ids.includes(v));
              const hasEmailMatch = baseIdentity.emails.some((v) => itemIdentity.emails.includes(v));
              const hasPhoneMatch = baseIdentity.phones.some((v) => itemIdentity.phones.includes(v));
              const hasNameMatch = baseIdentity.names.some((v) => itemIdentity.names.includes(v));

              return hasIdMatch || hasEmailMatch || hasPhoneMatch || hasNameMatch;
            })
            .sort((a, b) => new Date(b?.appointmentDate || b?.createdAt || 0) - new Date(a?.appointmentDate || a?.createdAt || 0));

          setPatientBookings(relatedBookings);
        }
        // Same patient → only application data updated, no sidebar re-fetch

        const scheduleItems = Array.isArray(foundBooking?.schedule?.specialistConsultations)
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
          window.history.replaceState(null, "", `/early-detection-bookings/${bookingId}`);
        }
      } else {
        setNotFound(true);
        setBooking(null);
        toast.error(t("earlyDiagnosis.bookingNotFound"));
      }
    } catch (error) {
      setNotFound(true);
      setBooking(null);
      toast.error(t("earlyDiagnosis.failedToLoadBooking"));
    } finally {
      setLoading(false);
    }
  };

  const loadDoctors = async () => {
    setLoadingDoctors(true);
    try {
      const response = await getEarlyDetectionDoctors();
      const doctorsData = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
          ? response.data
          : [];
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

  useEffect(() => {
    loadManagedTests("laboratoryTests");
    loadManagedTests("instrumentalAnalysis");
  }, []);

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
        await updateEarlyDetectionManagedTest(settingsSection, editingManagedTestId, {
          name: { en: nameEn, ru: nameRu },
        });
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
    setTestToDelete(testId);
    setShowDeleteConfirm(true);
  };

  const confirmManagedTestDelete = async () => {
    if (!testToDelete) {
      setShowDeleteConfirm(false);
      return;
    }

    setShowDeleteConfirm(false);
    try {
      await deleteEarlyDetectionManagedTest(settingsSection, testToDelete);
      await loadManagedTests(settingsSection);
      toast.success("Deleted");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete test");
    } finally {
      setTestToDelete(null);
    }
  };

  const cancelManagedTestDelete = () => {
    setShowDeleteConfirm(false);
    setTestToDelete(null);
  };

  const multiUploadSections = [
    "laboratoryTests",
    "instrumentalAnalysis",
    "morphologicalResearch",
    "proceduresAndManipulations",
  ];
  const sectionsWithTestSelection = ["laboratoryTests", "instrumentalAnalysis"];
  const manualNameRequiredSections = ["morphologicalResearch", "proceduresAndManipulations"];

  const openUploadSectionModal = (section) => {
    setUploadSection(section);
    setUploadItemId("");
    setUploadCustomName("");
    setUploadFile(null);
    if (multiUploadSections.includes(section)) {
      setUploadFiles([]);
    }
    if (sectionsWithTestSelection.includes(section)) {
      loadManagedTests(section);
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
        const hasEmptyName = uploadFiles.some((fileItem) => !String(fileItem?.customName || "").trim());
        if (hasEmptyName) {
          toast.error("Please enter a file name for each file");
          return;
        }
      }

      setIsUploadingSectionFile(true);
      try {
        // Upload all files one by one using FormData so multipart/form-data is sent correctly.
        for (const fileItem of uploadFiles) {
          if (!fileItem.file) continue;

          const formData = new FormData();
          formData.append("section", uploadSection);
          if (sectionsWithTestSelection.includes(uploadSection) && uploadItemId) {
            formData.append("itemId", uploadItemId);
          }
          if (fileItem.customName) {
            formData.append("customName", fileItem.customName);
          }
          formData.append("file", fileItem.file);

          const response = await uploadEarlyDetectionScheduleFile(booking._id || id, uploadSection, formData);
          const responseData = response?.data;
          const bookingData = responseData?.success ? responseData.data : responseData;
          if (bookingData) {
            setBooking(sanitizeBookingData(bookingData));
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
        const formData = new FormData();
        formData.append("section", uploadSection);
        if (uploadItemId) {
          formData.append("itemId", uploadItemId);
        }
        if (uploadCustomName) {
          formData.append("customName", uploadCustomName);
        }
        formData.append("file", uploadFile);

        const response = await uploadEarlyDetectionScheduleFile(booking._id || id, uploadSection, formData);
        const responseData = response?.data;
        const bookingData = responseData?.success ? responseData.data : responseData;

        if (bookingData) {
          setBooking(sanitizeBookingData(bookingData));
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
    const editor = sectionEditors?.[section] || { value: "", isVerified: false };
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
        setBooking(sanitizeBookingData(response.data));
      } else {
        await loadBookingDetails();
      }
      toast.success(`${getSectionLabel(section)} ${t("earlyDiagnosis.saved", "saved")}`);
    } catch (error) {
      toast.error(error?.response?.data?.message || t("earlyDiagnosis.failedToSaveSection", "Failed to save section"));
    } finally {
      updateSectionEditor(section, { saving: false });
    }
  };

  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString(
      i18n.language === "ru" ? "ru-RU" : "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
      },
    );
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
      const currentSchedule = Array.isArray(booking?.schedule?.specialistConsultations)
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
        setBooking(sanitizeBookingData(response.data));
        const nextSchedule = Array.isArray(response.data?.schedule?.specialistConsultations)
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

  const handleGeneratePaymentLink = async () => {
    if (booking.payment?.status === "paid") {
      toast.error(t("earlyDiagnosis.cannotGenerateForPaid"));
      return;
    }

    setIsGeneratingPayment(true);
    try {
      const response = await generateEDPaymentLink(booking._id);

      if (response.success) {
        toast.success(t("earlyDiagnosis.paymentLinkGenerated"));
        // Reload booking details
        await loadBookingDetails();
      } else {
        toast.error(
          response.message || t("earlyDiagnosis.failedToGenerateLink"),
        );
      }
    } catch (error) {
      toast.error(error.message || t("earlyDiagnosis.failedToGenerateLink"));
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

  const openManualPaymentModal = () => {
    // Pre-fill from booking if available
    setManualSelectedPkg(booking.package?.id || "predict");
    setManualSelectedAddons(booking.addOns?.map((a) => a.id) || []);
    setManualPayment({ transactionId: "", notes: "", paymentStatus: "paid" });
    setShowManualPaymentForm(true);
  };

  const handleManualPaymentSave = async () => {
    if (!manualPayment.paymentStatus) {
      toast.error(t("earlyDiagnosis.selectPaymentStatus"));
      return;
    }
    setIsSavingManual(true);
    try {
      const response = await updateEarlyDetectionPaymentStatus(booking._id, {
        paymentStatus: manualPayment.paymentStatus,
        transactionId: manualPayment.transactionId || undefined,
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

  const handleRowEditSave = async (link) => {
    try {
      const response = await updateEarlyDetectionPaymentStatus(booking._id, {
        paymentStatus: editingRowStatus,
        transactionId: link.paymentId || undefined,
      });
      if (response.success) {
        toast.success(
          t("earlyDiagnosis.paymentStatusUpdated") || "Payment status updated",
        );
        setEditingRowId(null);
        setEditingRowStatus("");
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
      const bookingIdForNotes =
        normalizeId(booking?._realBookingId) || normalizeId(booking?._id) || normalizeId(selectedBookingId) || normalizeId(id);

      if (!bookingIdForNotes) {
        toast.error(t("earlyDiagnosis.bookingNotFound"));
        return;
      }

      const response = await addEarlyDetectionBookingNote(bookingIdForNotes, {
        note: newNote.trim(),
        addedBy,
      });

      // Handle different response structures
      let notesData = [];
      if (response?.data?.success) {
        notesData = Array.isArray(response?.data?.data) ? response.data.data : [];
      } else if (Array.isArray(response?.data)) {
        notesData = response.data;
      } else if (response?.data) {
        notesData = [response.data];
      }

      // Transform notes to ensure proper structure - handle nested and object note values
      const transformedNotes = normalizeInternalNotes(notesData);

      console.log("Transformed notes:", transformedNotes);

      if (transformedNotes.length > 0 || response?.data?.success) {
        setBooking((prev) => ({
          ...prev,
          internalNotes: transformedNotes,
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
      const bookingIdForNotes =
        normalizeId(booking?._realBookingId) || normalizeId(booking?._id) || normalizeId(selectedBookingId) || normalizeId(id);

      if (!bookingIdForNotes) {
        toast.error(t("earlyDiagnosis.bookingNotFound"));
        return;
      }

      const response = await updateEarlyDetectionBookingNote(bookingIdForNotes, noteId, {
        note: editingNoteText.trim(),
      });

      // Handle different response structures
      let notesData = [];
      if (response?.data?.success) {
        notesData = Array.isArray(response?.data?.data) ? response.data.data : [];
      } else if (Array.isArray(response?.data)) {
        notesData = response.data;
      } else if (response?.data) {
        notesData = [response.data];
      }

      // Transform notes to ensure proper structure - handle nested and object note values
      const transformedNotes = normalizeInternalNotes(notesData);

      if (transformedNotes.length > 0 || response?.data?.success) {
        setBooking((prev) => ({
          ...prev,
          internalNotes: transformedNotes,
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
    setNoteIdToDelete(noteId);
    setShowDeleteNoteConfirm(true);
  };

  const cancelDeleteNote = () => {
    setShowDeleteNoteConfirm(false);
    setNoteIdToDelete(null);
  };

  const confirmDeleteNote = async () => {
    if (!noteIdToDelete) {
      return;
    }

    setIsSaving(true);
    try {
      const bookingIdForNotes =
        normalizeId(booking?._realBookingId) || normalizeId(booking?._id) || normalizeId(selectedBookingId) || normalizeId(id);

      if (!bookingIdForNotes) {
        toast.error(t("earlyDiagnosis.bookingNotFound"));
        return;
      }

      const response = await deleteEarlyDetectionBookingNote(bookingIdForNotes, noteIdToDelete);

      console.log("Delete note response:", response);

      // Handle different response structures
      let notesData = [];
      if (response?.data?.success) {
        notesData = Array.isArray(response?.data?.data) ? response.data.data : [];
      } else if (Array.isArray(response?.data)) {
        notesData = response.data;
      } else if (response?.data) {
        notesData = [response.data];
      }

      console.log("Notes data:", notesData);

      // Transform notes to ensure proper structure - handle nested objects
      const transformedNotes = notesData.map((note) => {
        console.log("Processing note:", note, "note.note type:", typeof note.note);

        // Extract note text - handle if it's nested
        let noteText = "";
        if (typeof note.note === "string") {
          noteText = note.note;
        } else if (typeof note.note === "object" && note.note !== null) {
          noteText = note.note.text || note.note.value || note.note.note || note.note.content || JSON.stringify(note.note);
        } else if (typeof note.text === "string") {
          noteText = note.text;
        } else if (typeof note.comment === "string") {
          noteText = note.comment;
        } else {
          noteText = String(note);
        }

        console.log("Extracted noteText:", noteText);

        return {
          _id: note._id || note.id,
          note: String(noteText || "").trim(),
          addedBy: String(note.addedBy || "Unknown"),
          addedAt: note.addedAt || new Date().toISOString(),
        };
      });

      if (response?.data?.success) {
        setBooking((prev) => ({
          ...prev,
          internalNotes: transformedNotes,
        }));
        setShowDeleteNoteConfirm(false);
        setNoteIdToDelete(null);
        toast.success(t("earlyDiagnosis.noteDeletedSuccessfully"));
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || t("earlyDiagnosis.failedToDeleteNote"),
      );
    } finally {
      setIsSaving(false);
      setShowDeleteNoteConfirm(false);
      setNoteIdToDelete(null);
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
  const isConclusionView =
    activeTab === "medicalHistory" && activeScheduleTab === "conclusion";
  const readNameField = (value) => {
    if (!value) return "";
    if (typeof value === "string") return value.trim();
    if (typeof value === "object") {
      const lang = (i18n.language || "en").slice(0, 2);
      const localized = value[lang] || value.en || value.ru;
      if (typeof localized === "string") return localized.trim();
      const firstString = Object.values(value).find((v) => typeof v === "string");
      return firstString ? firstString.trim() : "";
    }
    return "";
  };

  const normalizeStatusValue = (value) => {
    if (!value) return "";
    if (typeof value === "string") return value.trim();
    if (typeof value === "object") {
      return readNameField(value);
    }
    return String(value);
  };

  const getDoctorDisplayName = (doctor) => {
    if (!doctor) return "-";
    if (typeof doctor === "string") {
      const doctorById = doctors.find((item) => String(item?._id) === String(doctor));
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

  const getDoctorsForScheduleItem = (item) =>
    doctors.filter((doctor) => doctorMatchesScheduleTitle(doctor, item?.title || ""));

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

  const toHHmm = (mins) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

  const rangesOverlap = (startA, endA, startB, endB) => startA < endB && endA > startB;

  const resolveDoctorObject = (doctorValue) => {
    if (!doctorValue) return null;
    if (typeof doctorValue === "object") return doctorValue;
    const byId = doctors.find((d) => normalizeId(d?._id) === normalizeId(doctorValue));
    if (byId) return byId;
    const byEmail = doctors.find((d) => String(d?.email || "").toLowerCase() === String(doctorValue).toLowerCase());
    return byEmail || null;
  };

  const resolveDoctorEmail = (doctorValue) => {
    const doctorObj = resolveDoctorObject(doctorValue);
    return doctorObj?.email || (typeof doctorValue === "string" && doctorValue.includes("@") ? doctorValue : "");
  };

  const getAvailabilityKey = (doctorEmail, dateOnly) => `${String(doctorEmail || "").toLowerCase()}_${dateOnly || ""}`;

  useEffect(() => {
    if (!isEditing) return;

    const targets = editedScheduleItems
      .map((item) => {
        const doctorEmail = resolveDoctorEmail(item?.doctor);
        const dateOnly = toLocalDateOnly(item?.date);
        if (!doctorEmail || !dateOnly) return null;
        return { doctorEmail, dateOnly, key: getAvailabilityKey(doctorEmail, dateOnly) };
      })
      .filter(Boolean);

    const uniqueTargets = Array.from(new Map(targets.map((t) => [t.key, t])).values());

    uniqueTargets.forEach(async ({ doctorEmail, dateOnly, key }) => {
      if (doctorAvailabilityCache[key] || availabilityLoadingRef.current[key]) return;

      availabilityLoadingRef.current[key] = true;
      try {
        const [appsRes, breaksRes, leavesRes] = await Promise.all([
          getDoctorAppointmentsByDate(doctorEmail, dateOnly),
          getDoctorBreaks(doctorEmail, dateOnly),
          getDoctorLeaves({ doctorEmail, from: dateOnly, to: dateOnly, status: "Approved" }),
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
    const cached = doctorAvailabilityCache[key] || { appointments: [], breaks: [], onLeave: false };
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
    const doctorEmailLower = String(doctorObj?.email || doctorEmail || "").toLowerCase();

    (allEDBookings || []).forEach((edBooking) => {
      const bookingId = normalizeId(edBooking?._id);
      const consultations = Array.isArray(edBooking?.schedule?.specialistConsultations)
        ? edBooking.schedule.specialistConsultations
        : [];

      consultations.forEach((consultation) => {
        const consultationDate = toLocalDateOnly(consultation?.date);
        if (!consultationDate || consultationDate !== dateOnly) return;

        const consultationId = normalizeId(consultation?._id || consultation?.id);
        if (bookingId === currentBookingId && consultationId && currentItemId && consultationId === normalizeId(currentItemId)) return;

        const cDoctorId = normalizeId(consultation?.doctor?._id || consultation?.doctor);
        const cDoctorEmail = String(consultation?.doctor?.email || "").toLowerCase();
        const isSameDoctor = (doctorId && cDoctorId && doctorId === cDoctorId) ||
          (doctorEmailLower && cDoctorEmail && doctorEmailLower === cDoctorEmail);
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
    return !ranges.some(([busyStart, busyEnd]) => rangesOverlap(startMins, endMins, busyStart, busyEnd));
  };

  const getAvailableStartTimesForItem = (item, currentItemId) => {
    if (!resolveDoctorEmail(item?.doctor) || !toLocalDateOnly(item?.date)) return [];
    const slots = [];
    for (let startMins = 0; startMins <= 24 * 60 - MIN_APPOINTMENT_MINUTES; startMins += SLOT_STEP_MINUTES) {
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

    for (let endMins = minEnd; endMins <= 24 * 60; endMins += SLOT_STEP_MINUTES) {
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
      return value?.[lang] || value?.en || value?.ru || Object.values(value).find((v) => typeof v === "string") || "-";
    }
    return "-";
  };

  const getFileLabel = (file) =>
    file?.customName || file?.filename || file?.url || t("earlyDiagnosis.file");

  const getSectionFileUrl = (file, download = false) => {
    const fileId = normalizeId(file?.fileId);
    if (fileId) return getEarlyDetectionScheduleFileUrl(fileId, download);
    if (file?.url) return file.url;
    return "";
  };

  const getFilenameFromContentDisposition = (contentDisposition, fallbackName) => {
    if (!contentDisposition) return fallbackName || "download";
    const filenameMatch = contentDisposition.match(/filename\*=UTF-8''(.+)$|filename="?([^";]+)"?/i);
    if (filenameMatch) return decodeURIComponent(filenameMatch[1] || filenameMatch[2] || fallbackName || "download");
    return fallbackName || "download";
  };

  const handleProtectedFileAction = async (file, download = false) => {
    const fileId = normalizeId(file?.fileId);
    if (!fileId) {
      const fileUrl = getSectionFileUrl(file, download);
      if (!fileUrl) return;
      if (download) {
        window.location.href = fileUrl;
      } else {
        window.open(fileUrl, "_blank", "noopener,noreferrer");
      }
      return;
    }

    try {
      const response = await fetchEarlyDetectionScheduleFile(fileId);
      const filename = getFilenameFromContentDisposition(response.headers["content-disposition"], getFileLabel(file));
      const blob = new Blob([response.data], { type: response.data.type || "application/octet-stream" });
      const objectUrl = URL.createObjectURL(blob);

      if (download) {
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        window.open(objectUrl, "_blank", "noopener,noreferrer");
      }

      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    } catch (error) {
      console.error("Failed to open protected file", error);
      toast.error(t("earlyDiagnosis.fileOpenFailed", "Could not open file. Please try again."));
    }
  };

  const renderFileActionButtons = (file) => {
    const isProtectedFile = !!normalizeId(file?.fileId);
    return (
      <>
        {isProtectedFile ? (
          <button
            type="button"
            className="ed-file-link-btn ed-file-link-btn--view"
            title={t("earlyDiagnosis.view", "View")}
            onClick={() => handleProtectedFileAction(file, false)}
          >
            <Eye size={14} />
          </button>
        ) : (
          getSectionFileUrl(file, false) && (
            <a
              href={getSectionFileUrl(file, false)}
              target="_blank"
              rel="noopener noreferrer"
              className="ed-file-link-btn ed-file-link-btn--view"
              title={t("earlyDiagnosis.view", "View")}
            >
              <Eye size={14} />
            </a>
          )
        )}

        {isProtectedFile ? (
          <button
            type="button"
            className="ed-file-link-btn ed-file-link-btn--download"
            title={t("earlyDiagnosis.download", "Download")}
            onClick={() => handleProtectedFileAction(file, true)}
          >
            <Download size={14} />
          </button>
        ) : (
          getSectionFileUrl(file, true) && (
            <a
              href={getSectionFileUrl(file, true)}
              download
              className="ed-file-link-btn ed-file-link-btn--download"
              title={t("earlyDiagnosis.download", "Download")}
            >
              <Download size={14} />
            </a>
          )
        )}
      </>
    );
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

  const scheduleItems = Array.isArray(booking?.schedule?.specialistConsultations)
    ? (isEditing ? editedScheduleItems : booking.schedule.specialistConsultations)
    : [];

  const groupedSchedule = {
    1: scheduleItems.filter((item, index) => (item?.day ? Number(item.day) === 1 : index < 3)),
    2: scheduleItems.filter((item, index) => (item?.day ? Number(item.day) === 2 : index >= 3)),
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

  const getSectionLabel = (section) => {
    const labels = {
      morphologicalResearch: t("earlyDiagnosis.morphologicalResearch", "Morphological research"),
      proceduresAndManipulations: t("earlyDiagnosis.proceduresAndManipulations", "Procedures and manipulations"),
    };
    return labels[section] || section;
  };

  const managedSectionTabs = ["laboratoryTests", "instrumentalAnalysis"];

  const handleSaveSpecialistForm = async (idx, formData) => {
    setSpecialistFormSaving((prev) => ({ ...prev, [idx]: true }));
    try {
      const response = await saveEarlyDetectionSpecialistHistoryForm(booking._id || id, idx, formData);
      const responseData = response?.data;
      const bookingData = responseData?.success ? responseData.data : responseData;
      if (bookingData) {
        setBooking(sanitizeBookingData(bookingData));
      } else {
        await loadBookingDetails();
      }
      toast.success(t("earlyDiagnosis.specialistHistorySaved", "Specialist history saved"));
    } catch (err) {
      toast.error(err?.response?.data?.error || t("earlyDiagnosis.failedToSaveSpecialistHistory", "Failed to save specialist history"));
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

  if (notFound) {
    return (
      <div className="booking-details-page">
        <div className="not-found-container">
          <h2>{t("earlyDiagnosis.bookingNotFound")}</h2>
          <p>{t("earlyDiagnosis.bookingNotFoundMessage", "Booking not found for this ID.")}</p>
          <button className="adp-back-btn" onClick={() => navigate("/early-detection")}>{t("common.backToEarlyDetection", "Back to Early Detection")}</button>
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
      .trim() || booking.patient.email || "Unknown patient"
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

  return (
  <div className="booking-details-page">
    <ToastContainer position="top-right" autoClose={3000} />
    <div className="adp-top-header">
      <button
        className="adp-back-btn"
        onClick={() => navigate("/early-detection")}
      >
        <ArrowLeft size={14} />
        <span>{t("earlyDiagnosis.backToSchedule")}</span>
      </button>

      <div className="adp-header-divider" />

      <div className="adp-header-center">
        <div className="adp-header-name-row">
          <h1 className="adp-patient-title">
            {t("earlyDiagnosis.patients")}: <strong>{patientDisplayName}</strong>
          </h1>
          <span className="adp-status-badge-header">
            {(
              {
                confirmed: t("earlyDiagnosis.confirmed"),
                pending: t("earlyDiagnosis.pendingStatus"),
                cancelled: t("earlyDiagnosis.cancelled"),
                completed: t("earlyDiagnosis.completed"),
              }[booking.status?.toLowerCase()] || booking.status || "Active"
            )}
          </span>
        </div>
        <span className="adp-added-date">
          No.{booking.invoiceNumber || booking.bookingNumber} &nbsp;·&nbsp; {t("earlyDiagnosis.addedToSystemOn")} {formatDate(booking.createdAt)}
        </span>
      </div>

      {dobHeader && (
        <div className="adp-header-right">
          <span className="adp-dob-value">{dobHeader}</span>
          <span className="adp-dob-label">{t("earlyDiagnosis.dob")}</span>
        </div>
      )}
    </div>

    <div className="adp-tab-bar" role="tablist" aria-label="Booking details tabs">
      <button
        type="button"
        className={`adp-tab ${activeTab === "patient" ? "active" : ""}`}
        onClick={() => setActiveTab("patient")}
      >
        <span className="adp-tab-icon"><User size={15} /></span>
        {t("earlyDiagnosis.patientInformation")}
      </button>
      <button
        type="button"
        className={`adp-tab ${activeTab === "appointmentDetails" ? "active" : ""}`}
        onClick={() => setActiveTab("appointmentDetails")}
      >
        <span className="adp-tab-icon"><Calendar size={15} /></span>
        {t("earlyDiagnosis.appointmentDetails")}
      </button>
      <button
        type="button"
        className={`adp-tab ${activeTab === "medicalHistory" ? "active" : ""}`}
        onClick={() => setActiveTab("medicalHistory")}
      >
        <span className="adp-tab-icon"><FileText size={15} /></span>
        {t("earlyDiagnosis.medicalHistory")}
      </button>

      <button
        type="button"
        className={`adp-tab ${activeTab === "history" ? "active" : ""}`}
        onClick={() => setActiveTab("history")}
      >
        <span className="adp-tab-icon"><Clock size={15} /></span>
        {t("earlyDiagnosis.historyLogs")}
      </button>
      <button
        type="button"
        className={`adp-tab ${activeTab === "notes" ? "active" : ""}`}
        onClick={() => setActiveTab("notes")}
      >
        <span className="adp-tab-icon"><Edit2 size={15} /></span>
        {t("earlyDiagnosis.internalNotes")}
      </button>
    </div>

    <div className="booking-details-content">
      <div className={`ed-details-body${isConclusionView ? " ed-details-body--full-width" : ""}`}>
        {!isConclusionView && (
        <aside className="ed-appointments-sidebar adp-app-sidebar">
          <div className="ed-appointments-sidebar-title adp-app-sidebar-title">
            {t("sidebar_title", t("earlyDiagnosis.appointments", t("earlyDiagnosis.appointment", "Appointment")))}
          </div>

          <div className="ed-appointments-sidebar-list adp-app-sidebar-list">
            {patientBookings.length === 0 ? (
              <div className="ed-appointments-sidebar-empty adp-app-sidebar-empty">{t("sidebar_empty", t("earlyDiagnosis.noAppointments", "No appointments"))}</div>
            ) : (
              patientBookings.map((item, index) => {
                const rawStatus = item?.status || item?.appointmentStatus || item?.bookingStatus || "pending";
                const statusValue = normalizeStatusValue(rawStatus);
                const itemIds = [
                  normalizeId(item?._id),
                  normalizeId(item?.bookingNumber),
                  normalizeId(item?.invoiceNumber),
                  normalizeId(item?.applicationId),
                  normalizeId(item?.id),
                ].filter(Boolean);
                const itemId = itemIds[0] || normalizeId(item?.bookingNumber) || normalizeId(item?.invoiceNumber) || normalizeId(item?.applicationId) || normalizeId(item?.id) || `booking-${index}`;
                const currentSelected = normalizeId(selectedBookingId);
                const isCurrent = currentSelected && itemIds.includes(currentSelected);
                const bookingRef = String(
                  item?.invoiceNumber ||
                  item?.bookingNumber ||
                  item?.applicationId ||
                  item?._id?.slice(-6) ||
                  "-",
                );
                const displayDate =
                  item?.appointmentDate ||
                  item?.date ||
                  item?.schedule?.specialistConsultations?.[0]?.date ||
                  item?.createdAt;
                const appointment = item;
                const normalizedAppointmentStatus = normalizeStatusValue(
                  appointment.appointmentStatus || statusValue,
                );
                const appointmentIdText = String(
                  appointment.applicationId || bookingRef,
                );
                const doctorNameText =
                  typeof appointment.doctorName === "object"
                    ? readNameField(appointment.doctorName)
                    : appointment.doctorName;
                const doctorDisplay =
                  doctorNameText ||
                  getDoctorDisplayName(
                    appointment?.schedule?.specialistConsultations?.[0]?.doctor,
                  ) ||
                  t("notDefined");
                return (
                  <button
                    key={itemId || `booking-${index}`}
                    type="button"
                    className={`app-sidebar-card${isCurrent ? " current" : ""}`}
                    onClick={() => {
                      if (!isCurrent && itemId) {
                        setSelectedBookingId(itemId);
                      }
                    }}
                  >
                    <div className="app-card-top">
                      <span className="app-card-id">#{appointmentIdText}</span>
                      <span className={`status-badge ${normalizedAppointmentStatus?.toLowerCase()}`}>
                        {translateStatus(normalizedAppointmentStatus)}
                      </span>
                    </div>
                    <div className="app-card-date">
                      {formatDate(
                        appointment.date ||
                        appointment.appointmentDate ||
                        displayDate,
                      )}
                    </div>
                    <div className="app-card-doctor">{doctorDisplay}</div>
                    {isCurrent && (
                      <div className="app-card-current">
                        {t("earlyDiagnosis.current")}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>
        )}

        <div
          className={`booking-details-layout booking-details-layout--single${showSidebarTabs ? " booking-details-layout--sidebar-only" : ""}${isConclusionView ? " booking-details-layout--full-width" : ""}`}
        >
          {/* Left Column */}
          {!showSidebarTabs && (
            <div className="booking-details-main">
              {activeTab === "patient" && (
                <GeneralInformationTab
                  application={{
                    createdAt: booking.createdAt,
                    applicationId: booking.invoiceNumber || booking.bookingNumber,
                    patientName:
                      [booking?.patient?.lastName, booking?.patient?.firstName, booking?.patient?.middleName]
                        .filter(Boolean)
                        .join(" ")
                        .trim() ||
                      booking?.patientName ||
                      "",
                    patientEmail: booking?.patient?.email || booking?.patientEmail || "",
                  }}
                  patient={
                    booking.patient || {
                      _id: booking?.patientId || "",
                      email: booking?.patientEmail || "",
                      firstName: booking?.patientName || "",
                    }
                  }
                  onSave={(updatedPatient) => {
                    setBooking((prev) => ({
                      ...prev,
                      patient: updatedPatient,
                    }));
                  }}
                />
              )}

              {activeTab === "appointmentDetails" && (
                <>
                  {/* Appointment Details */}
                  <div className="ed-schedule-wrapper">
                    {[1, 2].map((day) => (
                      <div key={day} className="ed-day-card">
                        <div className="ed-day-header">
                          <div className="ed-day-header-left">
                            <span className="ed-day-title">{`${t("earlyDiagnosis.dayLabel")} ${day}`}</span>
                            <span className="ed-day-date">{formatDayMetaDate(groupedSchedule[day])}</span>
                          </div>
                          <span className="ed-day-count-badge">
                            {`${groupedSchedule[day].length} ${t("earlyDiagnosis.appointments")}`}
                          </span>
                        </div>
                        <div className="ed-day-body">
                          {groupedSchedule[day].length === 0 ? (
                            <div className="ed-schedule-empty">{t("earlyDiagnosis.noAppointments")}</div>
                          ) : (
                            groupedSchedule[day].map((item, index) => (
                              (() => {
                                const scheduleItemId = normalizeId(item?._id || item?.id) || `${day}-${index}`;
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
                                              {item?.title ? t(`earlyDiagnosis.specialist_${normalizeSpecialistTitle(item.title)}`, item.title) : t("earlyDiagnosis.consultation")}
                                            </span>
                                          </div>
                                          <div className="ed-schedule-view-doctor">{getDoctorDisplayName(item?.doctor)}</div>
                                          <div className="ed-schedule-view-meta">
                                            <span className="ed-schedule-view-meta-item">
                                              <Calendar size={13} />
                                              {item?.date
                                                ? formatLocalDateOnly(item.date, i18n.language === "ru" ? "ru-RU" : "en-US")
                                                : t("earlyDiagnosis.dateNotSet")}
                                            </span>
                                            <span className="ed-schedule-view-meta-item">
                                              <Clock size={13} />
                                              {item?.startTime && item?.endTime ? `${item.startTime} - ${item.endTime}` : t("earlyDiagnosis.notScheduled")}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="ed-schedule-view-right">
                                          <div className="ed-schedule-view-status-label">{t("earlyDiagnosis.status")}</div>
                                          <span className={`ed-schedule-view-status ${item?.isCompleted ? "is-confirmed" : "is-pending"}`}>
                                            <span className="ed-schedule-view-status-dot" />
                                            {item?.isCompleted
                                              ? t("earlyDiagnosis.confirmed")
                                              : t("earlyDiagnosis.pendingStatus")}
                                          </span>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="ed-schedule-head">
                                          <div className="ed-schedule-title">
                                            {item?.title ? t(`earlyDiagnosis.specialist_${normalizeSpecialistTitle(item.title)}`, item.title) : t("earlyDiagnosis.consultation")}
                                          </div>
                                          <label className="ed-process-toggle" title={t("earlyDiagnosis.markAsCompleted")}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={!!item?.isCompleted}
                                              disabled={!isEditing}
                                              onChange={(e) => handleScheduleItemChange(scheduleItemId, "isCompleted", e.target.checked)}
                                            />
                                            <span className="ed-process-toggle-slider" />
                                            <span className="ed-process-toggle-label">
                                              {item?.isCompleted
                                                ? t("earlyDiagnosis.completed")
                                                : t("earlyDiagnosis.pendingStatus")}
                                            </span>
                                          </label>
                                        </div>
                                        <div className="ed-schedule-grid">
                                          <div className="ed-schedule-field">
                                            <label>{t("earlyDiagnosis.dateShort").toUpperCase()}</label>
                                            {isEditing ? (
                                              <CustomCalendar
                                                value={item?.date ? String(item.date).split("T")[0] : ""}
                                                onChange={(date) =>
                                                  setEditedScheduleItems((prev) =>
                                                    prev.map((row) =>
                                                      normalizeId(row?._id || row?.id) === normalizeId(scheduleItemId)
                                                        ? {
                                                          ...row,
                                                          date: toLocalDateOnly(date),
                                                          startTime: "",
                                                          endTime: "",
                                                        }
                                                        : row,
                                                    ),
                                                  )
                                                }
                                                minDate={new Date()}
                                                dateFormat="yyyy-MM-dd"
                                                className="ed-schedule-calendar"
                                              />
                                            ) : (
                                              <span>
                                                {formatLocalDateOnly(
                                                  item?.date,
                                                  i18n.language === "ru" ? "ru-RU" : "en-US",
                                                )}
                                              </span>
                                            )}
                                          </div>
                                          <div className="ed-schedule-field">
                                            <label>{t("earlyDiagnosis.doctorShort").toUpperCase()}</label>
                                            {isEditing ? (
                                              <select
                                                className="ed-schedule-input"
                                                value={
                                                  typeof item?.doctor === "object"
                                                    ? item?.doctor?._id || ""
                                                    : item?.doctor || ""
                                                }
                                                onChange={(e) =>
                                                  setEditedScheduleItems((prev) =>
                                                    prev.map((row) =>
                                                      normalizeId(row?._id || row?.id) === normalizeId(scheduleItemId)
                                                        ? {
                                                          ...row,
                                                          doctor: e.target.value,
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
                                                    ? t("earlyDiagnosis.loadingDoctors")
                                                    : getDoctorsForScheduleItem(item).length
                                                      ? t("earlyDiagnosis.selectDoctor")
                                                      : t("earlyDiagnosis.noMatchingDoctors")}
                                                </option>
                                                {getDoctorsForScheduleItem(item).map((doctor) => (
                                                  <option key={normalizeId(doctor._id) || doctor.email} value={normalizeId(doctor._id) || ""}>
                                                    {getDoctorDisplayName(doctor)}
                                                  </option>
                                                ))}
                                              </select>
                                            ) : (
                                              <span>{getDoctorDisplayName(item?.doctor)}</span>
                                            )}
                                          </div>
                                          <div className="ed-schedule-field">
                                            <label>{t("earlyDiagnosis.startTimeShort").toUpperCase()}</label>
                                            {isEditing ? (
                                              <CustomTimePicker
                                                value={item?.startTime || ""}
                                                onChange={(timeStr) =>
                                                  setEditedScheduleItems((prev) =>
                                                    prev.map((row) => {
                                                      if (normalizeId(row?._id || row?.id) !== normalizeId(scheduleItemId)) return row;
                                                      const nextRow = { ...row, startTime: timeStr };
                                                      const availableEndTimes = getAvailableEndTimesForItem(nextRow, scheduleItemId);
                                                      if (!availableEndTimes.includes(nextRow.endTime)) {
                                                        nextRow.endTime = "";
                                                      }
                                                      return nextRow;
                                                    }),
                                                  )
                                                }
                                                className="ed-schedule-input"
                                                placeholder={t("earlyDiagnosis.selectTime")}
                                                disabled={!resolveDoctorEmail(item?.doctor) || !toLocalDateOnly(item?.date)}
                                                allowedTimes={getAvailableStartTimesForItem(item, scheduleItemId)}
                                              />
                                            ) : (
                                              <span>{item?.startTime || "-"}</span>
                                            )}
                                          </div>
                                          <div className="ed-schedule-field">
                                            <label>{t("earlyDiagnosis.endTimeShort").toUpperCase()}</label>
                                            {isEditing ? (
                                              <CustomTimePicker
                                                value={item?.endTime || ""}
                                                onChange={(timeStr) =>
                                                  handleScheduleItemChange(scheduleItemId, "endTime", timeStr)
                                                }
                                                className="ed-schedule-input"
                                                placeholder={t("earlyDiagnosis.selectTime")}
                                                disabled={!item?.startTime || !resolveDoctorEmail(item?.doctor) || !toLocalDateOnly(item?.date)}
                                                allowedTimes={getAvailableEndTimesForItem(item, scheduleItemId)}
                                              />
                                            ) : (
                                              <span>{item?.endTime || "-"}</span>
                                            )}
                                          </div>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )
                              })()
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {activeTab === "medicalHistory" && (
                <>
                  <div className="detail-section">
                    <div className="ed-schedule-tabs">
                      {[
                        ["specialistConsultation", t("earlyDiagnosis.specialistConsultation")],
                        ["laboratoryTests", t("earlyDiagnosis.laboratoryTests")],
                        ["instrumentalAnalysis", t("earlyDiagnosis.instrumentalAnalysis")],
                        ["morphologicalResearch", t("earlyDiagnosis.morphologicalResearch")],
                        ["proceduresAndManipulations", t("earlyDiagnosis.proceduresAndManipulations")],
                        ["conclusion",t("earlyDiagnosis.conclusion")],
                      ].map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          className={`ed-schedule-tab-btn ${activeScheduleTab === key ? "active" : ""}`}
                          onClick={() => setActiveScheduleTab(key)}
                        >
                          <span>{label}</span>
                          {managedSectionTabs.includes(key) && (
                            <span
                              className="ed-tab-settings-btn"
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                openTestSettingsModal(key);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openTestSettingsModal(key);
                                }
                              }}
                              title={t("earlyDiagnosis.manageTests")}
                            >
                              <Settings size={14} />
                            </span>
                          )}
                        </button>
                      ))}
                    </div>

                    {activeScheduleTab === "laboratoryTests" && (
                      <div className="ed-schedule-section-list">
                        <div className="ed-section-actions-row">
                          <button
                            type="button"
                            className="ed-upload-btn"
                            onClick={() => openUploadSectionModal("laboratoryTests")}
                          >
                            {t("earlyDiagnosis.uploadFile")}
                          </button>
                        </div>
                        {(booking?.schedule?.laboratoryTests || []).length === 0 ? (
                          <div className="ed-schedule-empty">{t("earlyDiagnosis.noFiles")}</div>
                        ) : (
                          (booking?.schedule?.laboratoryTests || []).map((entry, index) => (
                            <div className="ed-section-card ed-test-card" key={entry?._id || `lab-${index}`}>
                              <div className="ed-test-card-head">
                                <div className="ed-test-icon-wrap">
                                  <FileText size={18} />
                                </div>
                                <div className="ed-test-head-main">
                                  <div className="ed-section-title">{readLocalizedName(entry?.item?.name)}</div>
                                  <div className="ed-test-head-sub">
                                    {formatDate(entry?.updatedAt || entry?.createdAt || entry?.date)}
                                    {Array.isArray(entry?.files) && entry.files.length > 0 && (
                                      <span className="ed-test-validated">
                                        <CheckCircle size={12} />
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <button type="button" className="ed-test-more-btn" aria-label={t("earlyDiagnosis.more", "More")}>
                                  <MoreVertical size={16} />
                                </button>
                              </div>

                              {Array.isArray(entry?.files) && entry.files.length > 0 && (
                                <ul className="ed-files-list ed-test-files-list">
                                  {entry.files.map((file, fileIndex) => (
                                    <li key={normalizeId(file?.fileId) || file?._id || fileIndex} className="ed-file-row ed-test-file-row">
                                      <div className="ed-test-file-left">
                                        <span className={`ed-test-file-badge ${getFileExtension(file) === "pdf" ? "is-pdf" : "is-doc"}`}>
                                          {getFileExtension(file).toUpperCase()}
                                        </span>
                                        <span className="ed-test-file-meta">
                                          <span className="ed-test-file-name">{getFileLabel(file)}</span>
                                          <span className="ed-test-file-subtext">
                                            {[formatFileSize(file), file?.uploadedByName || file?.uploadedBy || file?.uploadedByDoctorName].filter(Boolean).join(" • ")}
                                          </span>
                                        </span>
                                      </div>
                                      <span className="ed-file-actions ed-test-file-actions">
                                        {renderFileActionButtons(file)}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {activeScheduleTab === "instrumentalAnalysis" && (
                      <div className="ed-schedule-section-list">
                        <div className="ed-section-actions-row">
                          <button
                            type="button"
                            className="ed-upload-btn"
                            onClick={() => openUploadSectionModal("instrumentalAnalysis")}
                          >
                            {t("earlyDiagnosis.uploadFile")}
                          </button>
                        </div>
                        {(booking?.schedule?.instrumentalAnalysis || []).length === 0 ? (
                          <div className="ed-schedule-empty">{t("earlyDiagnosis.noFiles")}</div>
                        ) : (
                          (booking?.schedule?.instrumentalAnalysis || []).map((entry, index) => (
                            <div className="ed-section-card ed-test-card" key={entry?._id || `inst-${index}`}>
                              <div className="ed-test-card-head">
                                <div className="ed-test-icon-wrap">
                                  <FileText size={18} />
                                </div>
                                <div className="ed-test-head-main">
                                  <div className="ed-section-title">{readLocalizedName(entry?.item?.name)}</div>
                                  <div className="ed-test-head-sub">
                                    {formatDate(entry?.updatedAt || entry?.createdAt || entry?.date)}
                                    {Array.isArray(entry?.files) && entry.files.length > 0 && (
                                      <span className="ed-test-validated">
                                        <CheckCircle size={12} />
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <button type="button" className="ed-test-more-btn" aria-label={t("earlyDiagnosis.more", "More")}>
                                  <MoreVertical size={16} />
                                </button>
                              </div>

                              {Array.isArray(entry?.files) && entry.files.length > 0 && (
                                <ul className="ed-files-list ed-test-files-list">
                                  {entry.files.map((file, fileIndex) => (
                                    <li key={normalizeId(file?.fileId) || file?._id || fileIndex} className="ed-file-row ed-test-file-row">
                                      <div className="ed-test-file-left">
                                        <span className={`ed-test-file-badge ${getFileExtension(file) === "pdf" ? "is-pdf" : "is-doc"}`}>
                                          {getFileExtension(file).toUpperCase()}
                                        </span>
                                        <span className="ed-test-file-meta">
                                          <span className="ed-test-file-name">{getFileLabel(file)}</span>
                                          <span className="ed-test-file-subtext">
                                            {[formatFileSize(file), file?.uploadedByName || file?.uploadedBy || file?.uploadedByDoctorName].filter(Boolean).join(" • ")}
                                          </span>
                                        </span>
                                      </div>
                                      <span className="ed-file-actions ed-test-file-actions">
                                        {renderFileActionButtons(file)}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {activeScheduleTab === "morphologicalResearch" && (
                      <div className="ed-schedule-section-list">
                        <div className="ed-section-actions-row">
                          <button
                            type="button"
                            className="ed-upload-btn"
                            onClick={() => openUploadSectionModal("morphologicalResearch")}
                          >
                            {t("earlyDiagnosis.uploadFile")}
                          </button>
                        </div>
                        {(booking?.schedule?.morphologicalResearch?.files || []).length === 0 ? (
                          <div className="ed-schedule-empty">{t("earlyDiagnosis.noFiles")}</div>
                        ) : (
                          <div className="ed-section-card ed-test-card">
                            <ul className="ed-files-list ed-test-files-list">
                              {(booking?.schedule?.morphologicalResearch?.files || []).map((file, fileIndex) => (
                                <li key={normalizeId(file?.fileId) || file?._id || fileIndex} className="ed-file-row ed-test-file-row">
                                  <div className="ed-test-file-left">
                                    <span className={`ed-test-file-badge ${getFileExtension(file) === "pdf" ? "is-pdf" : "is-doc"}`}>
                                      {getFileExtension(file).toUpperCase()}
                                    </span>
                                    <span className="ed-test-file-meta">
                                      <span className="ed-test-file-name">{getFileLabel(file)}</span>
                                      <span className="ed-test-file-subtext">
                                        {[formatFileSize(file), file?.uploadedByName || file?.uploadedBy || file?.uploadedByDoctorName].filter(Boolean).join(" • ")}
                                      </span>
                                    </span>
                                  </div>
                                  <span className="ed-file-actions ed-test-file-actions">
                                    {renderFileActionButtons(file)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="ed-section-card">
                          <div className="ed-section-head-row">
                            <div className="ed-section-title">{t("earlyDiagnosis.morphologicalResearch")}</div>
                            <div className="ed-history-actions">
                              <button
                                type="button"
                                className="save-btn"
                                onClick={() => handleSaveManagedSectionComment("morphologicalResearch")}
                                disabled={!!sectionEditors?.morphologicalResearch?.saving}
                              >
                                {sectionEditors?.morphologicalResearch?.saving ? t("earlyDiagnosis.saving") : t("earlyDiagnosis.save")}
                              </button>
                            </div>
                          </div>
                          <div className="ed-history-rich-editor">
                            <RichTextEditor
                              value={sectionEditors?.morphologicalResearch?.value || ""}
                              onChange={(html) => updateSectionEditor("morphologicalResearch", { value: html })}
                              placeholder={t("history_tab.enter_text")}
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
                            onClick={() => openUploadSectionModal("proceduresAndManipulations")}
                          >
                            {t("earlyDiagnosis.uploadFile")}
                          </button>
                        </div>

                        {(booking?.schedule?.proceduresAndManipulations?.files || []).length === 0 ? (
                          <div className="ed-schedule-empty">{t("earlyDiagnosis.noFiles")}</div>
                        ) : (
                          <div className="ed-section-card ed-test-card">
                            <ul className="ed-files-list ed-test-files-list">
                              {(booking?.schedule?.proceduresAndManipulations?.files || []).map((file, fileIndex) => (
                                <li key={normalizeId(file?.fileId) || file?._id || fileIndex} className="ed-file-row ed-test-file-row">
                                  <div className="ed-test-file-left">
                                    <span className={`ed-test-file-badge ${getFileExtension(file) === "pdf" ? "is-pdf" : "is-doc"}`}>
                                      {getFileExtension(file).toUpperCase()}
                                    </span>
                                    <span className="ed-test-file-meta">
                                      <span className="ed-test-file-name">{getFileLabel(file)}</span>
                                      <span className="ed-test-file-subtext">
                                        {[formatFileSize(file), file?.uploadedByName || file?.uploadedBy || file?.uploadedByDoctorName].filter(Boolean).join(" • ")}
                                      </span>
                                    </span>
                                  </div>
                                  <span className="ed-file-actions ed-test-file-actions">
                                    {renderFileActionButtons(file)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="ed-section-card">
                          <div className="ed-section-head-row">
                            <div className="ed-section-title">{t("earlyDiagnosis.proceduresAndManipulations")}</div>
                            <div className="ed-history-actions">
                              <button
                                type="button"
                                className="save-btn"
                                onClick={() => handleSaveManagedSectionComment("proceduresAndManipulations")}
                                disabled={!!sectionEditors?.proceduresAndManipulations?.saving}
                              >
                                {sectionEditors?.proceduresAndManipulations?.saving ? t("earlyDiagnosis.saving") : t("earlyDiagnosis.save")}
                              </button>
                            </div>
                          </div>
                          <div className="ed-history-rich-editor">
                            <RichTextEditor
                              value={sectionEditors?.proceduresAndManipulations?.value || ""}
                              onChange={(html) => updateSectionEditor("proceduresAndManipulations", { value: html })}
                              placeholder={t("history_tab.enter_text")}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {activeScheduleTab === "specialistConsultation" && (
                      <div className="detail-section">
                        <div className="ed-schedule-tabs ed-specialist-tabs">
                          {getVisibleSpecialistConsultations(booking).map((s, i) => {
                            const specialistDoctorEmail = normalizeDoctorEmail(s?.doctor);
                            const isOwned = !!currentDoctorEmail && specialistDoctorEmail === currentDoctorEmail;

                            // CRITICAL DEBUG: Log specialist consultation data with currentDoctorEmail
                            if (i === 0) {
                              console.log("[DEBUG-CRITICAL] First specialist tab render:", {
                                currentDoctorEmail: currentDoctorEmail,
                                currentDoctorEmailEmpty: !currentDoctorEmail,
                                currentDoctorEmailLength: currentDoctorEmail.length,
                                specialistDoctorEmail,
                                isOwned,
                                doctorObject: s.doctor,
                              });
                            }

                            console.log(`[DEBUG] Specialist ${i} (${s?.title}):`, {
                              doctorRaw: s?.doctor,
                              specialistDoctorEmail,
                              currentDoctorEmail,
                              isOwned,
                            });
                            const displayTitle = s?.title
                              ? t(`earlyDiagnosis.specialist_${normalizeSpecialistTitle(s.title)}`, s.title)
                              : `${t("earlyDiagnosis.specialist")} ${i + 1}`;

                            return (
                              <button
                                key={`specialist_${i}`}
                                type="button"
                                className={`ed-schedule-tab-btn ${activeSpecialistTab === i ? "active" : ""} ${!isOwned ? "ed-schedule-tab-btn--locked" : ""}`}
                                onClick={() => setActiveSpecialistTab(i)}
                                title={!isOwned ? t("earlyDiagnosis.specialistTabLocked") : displayTitle}
                              >
                                <span>
                                  {displayTitle}
                                  {!isOwned && <Lock size={14} style={{ marginLeft: 6 }} />}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {(() => {
                          const specialistList = getVisibleSpecialistConsultations(booking);

                          if (specialistList.length === 0) {
                            return <div className="ed-schedule-empty">{t("earlyDiagnosis.noSpecialistConsultations")}</div>;
                          }

                          const currentIndex =
                            activeSpecialistTab !== null && activeSpecialistTab >= 0 && activeSpecialistTab < specialistList.length
                              ? activeSpecialistTab
                              : 0;

                          const specialist = specialistList[currentIndex];

                          if (!specialist) {
                            return <div className="ed-schedule-empty">{t("earlyDiagnosis.noSpecialistConsultations")}</div>;
                          }

                          const specialistDoctorEmail = normalizeDoctorEmail(specialist?.doctor);
                          const isSpecialistOwner = !!currentDoctorEmail && specialistDoctorEmail === currentDoctorEmail;

                          return (
                            <SpecialistHistoryForm
                              key={`specialist_form_${currentIndex}`}
                              specialistTitle={specialist.title ? t(`earlyDiagnosis.specialist_${normalizeSpecialistTitle(specialist.title)}`, specialist.title) : specialist.title}
                              historyForm={specialistForms[currentIndex] || specialist.historyForm || {}}
                              isSaving={!!specialistFormSaving[currentIndex]}
                              isEditable={isSpecialistOwner}
                              onSave={(formData) => handleSaveSpecialistForm(currentIndex, formData)}
                            />
                          );
                        })()}
                      </div>
                    )}
                    {activeScheduleTab === "conclusion" && (
                      <div className="ed-report-full-screen">
                        <EarlyDetectionReportTab booking={booking} />
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Right Column */}
          {showSidebarTabs && (
            <div className="booking-details-sidebar">
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
                          <p className="timeline-kicker timeline-kicker--completed">{t("earlyDiagnosis.completed")}</p>
                          <p className="timeline-title">{t("earlyDiagnosis.paymentVerified")}</p>
                          <p className="timeline-description">
                            {(() => {
                              const transactionRef = booking.payment?.transactionId || booking.payment?.tbank?.paymentId || booking.payment?.tbank?.orderId;
                              if (transactionRef) {
                                return `${t("earlyDiagnosis.transaction")} #${transactionRef} ${t("earlyDiagnosis.paymentProcessed")}`;
                              }
                              return t("earlyDiagnosis.paymentStatusUpdated");
                            })()}
                          </p>
                          <div className="timeline-pills">
                            <span className="timeline-pill">{formatDate(booking.payment.paidAt)}</span>
                            <span className="timeline-pill">{new Date(booking.payment.paidAt).toLocaleTimeString(i18n.language === "ru" ? "ru-RU" : "en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="timeline-item timeline-item--milestone">
                      <div className="timeline-dot blue">
                        <Calendar size={12} />
                      </div>
                      <div className="timeline-content timeline-content--plain">
                        <p className="timeline-kicker timeline-kicker--milestone">{t("earlyDiagnosis.nextMilestone")}</p>
                        <p className="timeline-title">{t("earlyDiagnosis.appointmentScheduled")}</p>

                        <div className="timeline-service-list">
                          {[1, 2].map((day) => {
                            const dayItems = groupedSchedule?.[day] || [];
                            if (!dayItems.length) return null;

                            return (
                              <div key={`timeline-day-${day}`} className="timeline-day-group">
                                <p className="timeline-day-title">{`${t("earlyDiagnosis.dayLabel")} ${day}`}</p>
                                {dayItems.map((specialist, idx) => (
                                  <div key={`service-log-${day}-${idx}`} className="timeline-service-card">
                                    <div className="timeline-service-icon">
                                      <FileText size={16} />
                                    </div>
                                    <div className="timeline-service-main">
                                      <p className="timeline-service-title">
                                        {specialist.title
                                          ? t(`earlyDiagnosis.specialist_${normalizeSpecialistTitle(specialist.title)}`, specialist.title)
                                          : `${t("earlyDiagnosis.service")} ${idx + 1}`}
                                      </p>
                                      <p className="timeline-service-sub">
                                        {specialist.date
                                          ? formatDate(specialist.date)
                                          : t("earlyDiagnosis.dateNotSet")}
                                        {specialist.startTime && specialist.endTime ? ` · ${specialist.startTime} - ${specialist.endTime}` : ""}
                                      </p>
                                    </div>
                                    <div className="timeline-service-side">
                                      <p className="timeline-service-doctor">
                                        <User size={12} /> {getDoctorDisplayName(specialist.doctor)}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>

                        <p className="timeline-date">{formatDateTime(booking.appointmentDate)}</p>
                      </div>
                    </div>

                    <div className="timeline-item timeline-item--system">
                      <div className="timeline-dot gray">
                        <Clock size={12} />
                      </div>
                      <div className="timeline-content timeline-content--plain">
                        <p className="timeline-kicker">{t("earlyDiagnosis.systemEvent")}</p>
                        <p className="timeline-title">{t("earlyDiagnosis.bookingCreated")}</p>
                        <p className="timeline-description">
                          {t("earlyDiagnosis.bookingCreateDescription")}
                        </p>
                        <p className="timeline-date">{formatDateTime(booking.createdAt)}</p>
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

                      {Array.isArray(booking.internalNotes) && booking.internalNotes.length > 0 ? (
                        <div className="notes-list notes-list--modern">
                          {booking.internalNotes.map((note, index) => (
                            <article key={note._id || index} className="note-card">
                              <div className="note-card-top">
                                <div className="note-author-block">
                                  <div className="note-avatar">
                                    <User size={14} />
                                  </div>
                                  <div>
                                    <p className="note-author">{note.addedBy}</p>
                                    <p className="note-date">{formatDateTime(note.addedAt)}</p>
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
                                      onClick={() => handleDeleteNote(note._id)}
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
                                    onChange={(e) => setEditingNoteText(e.target.value)}
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
                                      onClick={() => handleUpdateNote(note._id)}
                                      disabled={isSaving || !editingNoteText.trim()}
                                    >
                                      {isSaving
                                        ? t("earlyDiagnosis.saving")
                                        : t("earlyDiagnosis.save")}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <p className="note-text">{formatNoteText(note.note)}</p>
                              )}
                            </article>
                          ))}
                        </div>
                      ) : (
                        <div className="notes-empty">
                          <p className="note-text">{t("earlyDiagnosis.noNotesAdded")}</p>
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
          <div className="mp-modal ed-manage-tests-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mp-modal-header">
              <h3>{t("earlyDiagnosis.manageTests")}</h3>
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
                  onChange={(e) => setTestDraft((prev) => ({ ...prev, en: e.target.value }))}
                  placeholder={t("earlyDiagnosis.testNameEn")}
                />
              </div>
              <div className="mp-field">
                <label className="mp-field-label">RU</label>
                <input
                  className="mp-input"
                  value={testDraft.ru}
                  onChange={(e) => setTestDraft((prev) => ({ ...prev, ru: e.target.value }))}
                  placeholder={t("earlyDiagnosis.testNameRu")}
                />
              </div>

              <div className="ed-manage-tests-actions">
                <button
                  className="save-btn"
                  onClick={handleManagedTestSave}
                  disabled={savingManagedTest}
                >
                  {savingManagedTest ? t("earlyDiagnosis.saving") : t("earlyDiagnosis.save")}
                </button>
                {editingManagedTestId && (
                  <button
                    className="cancel-btn"
                    onClick={() => {
                      setEditingManagedTestId("");
                      setTestDraft({ en: "", ru: "" });
                    }}
                  >
                    {t("earlyDiagnosis.cancel")}
                  </button>
                )}
              </div>

              <div className="ed-managed-tests-list">
                {(managedTests?.[settingsSection] || []).map((item) => (
                  <div className="ed-managed-test-row" key={normalizeId(item?._id)}>
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
                        title={t("earlyDiagnosis.edit")}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        className="delete-note-icon-btn"
                        onClick={() => handleManagedTestDelete(normalizeId(item?._id))}
                        title={t("earlyDiagnosis.delete")}
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
        <div className="mp-modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mp-modal-header">
              <h3>{t("earlyDiagnosis.uploadFile")}</h3>
              <button className="mp-modal-close" onClick={() => setShowUploadModal(false)}>×</button>
            </div>

            <div className="mp-modal-body">
              {sectionsWithTestSelection.includes(uploadSection) && (
                <div className="mp-field">
                  <label className="mp-field-label">{t("earlyDiagnosis.selectTest")}</label>
                  <select
                    className="mp-select"
                    value={uploadItemId}
                    onChange={(e) => setUploadItemId(e.target.value)}
                  >
                    <option value="">{t("earlyDiagnosis.selectTest")}</option>
                    {managedTestOptions.map((item) => (
                      <option key={normalizeId(item?._id)} value={normalizeId(item?._id)}>
                        {readLocalizedName(item?.name)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!multiUploadSections.includes(uploadSection) && (
                <div className="mp-field">
                  <label className="mp-field-label">{t("earlyDiagnosis.customName")}</label>
                  <input
                    className="mp-input"
                    value={uploadCustomName}
                    onChange={(e) => setUploadCustomName(e.target.value)}
                    placeholder={t("earlyDiagnosis.customNameOptional")}
                  />
                </div>
              )}

              {multiUploadSections.includes(uploadSection) ? (
                <>
                  <div className="mp-field">
                    <label className="mp-field-label">{t("earlyDiagnosis.file")}</label>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input
                        type="file"
                        className="mp-input"
                        style={{ flex: 1 }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setUploadFiles((prev) => [...prev, { file, customName: "" }]);
                            e.target.value = "";
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Display added files with custom name inputs */}
                  {uploadFiles.length > 0 && (
                    <div style={{ marginTop: "12px" }}>
                      <label className="mp-field-label">{t("earlyDiagnosis.filesToUpload")}</label>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {uploadFiles.map((fileItem, idx) => (
                          <div key={idx} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <input
                              type="text"
                              className="mp-input"
                              placeholder={t("earlyDiagnosis.customName")}
                              value={fileItem.customName}
                              onChange={(e) => {
                                const newFiles = [...uploadFiles];
                                newFiles[idx].customName = e.target.value;
                                setUploadFiles(newFiles);
                              }}
                              style={{ flex: 1 }}
                            />
                            <span style={{ fontSize: "12px", color: "#6b7280", minWidth: "120px" }}>
                              {fileItem.file.name}
                            </span>
                            <button
                              type="button"
                              className="delete-note-icon-btn"
                              onClick={() => {
                                setUploadFiles((prev) => prev.filter((_, i) => i !== idx));
                              }}
                              title={t("earlyDiagnosis.remove")}
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
                  <label className="mp-field-label">{t("earlyDiagnosis.file")}</label>
                  <input
                    type="file"
                    className="mp-input"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
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
                {t("earlyDiagnosis.cancel")}
              </button>
              <button
                className="mp-btn-save"
                onClick={handleUploadSectionFile}
                disabled={isUploadingSectionFile}
              >
                {isUploadingSectionFile ? t("earlyDiagnosis.saving") : t("earlyDiagnosis.upload")}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

    {showDeleteNoteConfirm &&
      createPortal(
        <div className="mp-modal-overlay" onClick={cancelDeleteNote}>
          <div className="mp-modal ed-manage-tests-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mp-modal-header">
              <h3>{t("earlyDiagnosis.confirmDelete")}</h3>
              <button className="mp-modal-close" onClick={cancelDeleteNote}>×</button>
            </div>
            <div className="mp-modal-body">
              <p>{t("earlyDiagnosis.confirmDeleteNote")}</p>
            </div>
            <div className="mp-modal-footer">
              <button className="mp-btn-cancel" onClick={cancelDeleteNote}>
                {t("earlyDiagnosis.cancel")}
              </button>
              <button className="mp-btn-save mp-btn-danger" onClick={confirmDeleteNote} disabled={isSaving}>
                {isSaving ? t("earlyDiagnosis.deleting") : t("earlyDiagnosis.delete")}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

    {showDeleteConfirm &&
      createPortal(
        <div className="mp-modal-overlay" onClick={cancelManagedTestDelete}>
          <div className="mp-modal ed-manage-tests-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mp-modal-header">
              <h3>{t("earlyDiagnosis.confirmDelete")}</h3>
              <button className="mp-modal-close" onClick={cancelManagedTestDelete}>×</button>
            </div>
            <div className="mp-modal-body">
              <p>{t("earlyDiagnosis.confirmDeleteTest")}</p>
            </div>
            <div className="mp-modal-footer">
              <button className="mp-btn-cancel" onClick={cancelManagedTestDelete}>
                {t("earlyDiagnosis.cancel")}
              </button>
              <button className="mp-btn-save" onClick={confirmManagedTestDelete}>
                {t("earlyDiagnosis.delete")}
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
                      <span className="mp-package-name">{readLocalizedName(pkg.name)}</span>
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
                        <span className="mp-addon-name">{readLocalizedName(addon.name)}</span>
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

                <div className="mp-field">
                  <label className="mp-field-label">
                    {t("earlyDiagnosis.transactionId")}
                  </label>
                  <input
                    type="text"
                    value={manualPayment.transactionId}
                    onChange={(e) =>
                      setManualPayment((p) => ({
                        ...p,
                        transactionId: e.target.value,
                      }))
                    }
                    placeholder={t("earlyDiagnosis.enterTransactionId")}
                    className="mp-input"
                  />
                </div>

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
  </div>
);
};

export default EarlyDetectionBookingDetails;
