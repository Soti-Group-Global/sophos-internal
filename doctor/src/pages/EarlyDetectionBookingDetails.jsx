import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CheckCircle,
  Clock,
  Edit2,
  Trash2,
  FileText,
  Plus,
  Eye,
  Download,
  X as XIcon,
  Upload,
  Pencil,
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
  addEarlyDetectionTestEntryNote,
  updateEarlyDetectionTestEntryNote,
  deleteEarlyDetectionTestEntryNote,
  saveEarlyDetectionSpecialistHistoryForm,
  getPatientSection,
  uploadPatientSectionFile,
  getPatientSectionFile,
  removePatientSectionFile,
  removePatientSectionEntry,
  updatePatientSectionComment,
} from "../utils/api";
import GeneralInformationTab from "../components/GeneralInformationTab";
import RichTextEditor from "../components/RichTextEditor";
import EDHeader from "../components/EarlyDetection/EDHeader";
import EDIconSidebar from "../components/EarlyDetection/EDIconSidebar";
import EDMedicalSubnav from "../components/EarlyDetection/EDMedicalSubnav";
import EDScheduleTab from "../components/EarlyDetection/EDScheduleTab";
import EDMedicalHistoryContent from "../components/EarlyDetection/EDMedicalHistoryContent";
import EDHistoryNotesTab from "../components/EarlyDetection/EDHistoryNotesTab";
import EDModals from "../components/EarlyDetection/EDModals";
import "../styles/EarlyDetectionBookingDetails.css";
import "../styles/PatientDetailsPage.css";

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
    return null;
  }

  if (typeof doctor === "string") {
    return doctor.toLowerCase();
  }

  if (doctor?.email) {
    const normalizedEmail = doctor.email.toLowerCase();
    return normalizedEmail;
  }

  if (doctor?.doctorEmail) {
    const normalizedEmail = doctor.doctorEmail.toLowerCase();
    return normalizedEmail;
  }



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

const formatLocalDateOnly = (value) => {
  const dateOnly = toLocalDateOnly(value);
  if (!dateOnly) return "-";
  const [y, m, d] = dateOnly.split("-").map(Number);
  if (!y || !m || !d) return "-";
  return `${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}-${y}`;
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

  useEffect(() => {
    document.body.classList.add("hide-global-sidebar");
    const lc = document.querySelector(".layout-content");
    if (lc) lc.classList.add("ed-booking-details-active");
    return () => {
      document.body.classList.remove("hide-global-sidebar");
      if (lc) lc.classList.remove("ed-booking-details-active");
    };
  }, []);
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
  const edAddFileInputRef = useRef(null);
  const [edAddModalOpen, setEdAddModalOpen] = useState(false);
  const [edAddSection, setEdAddSection] = useState("");
  const [edAddItemId, setEdAddItemId] = useState("");
  const [edAddFiles, setEdAddFiles] = useState([]);
  const [edAddText, setEdAddText] = useState("");
  const [edAddSubmitting, setEdAddSubmitting] = useState(false);
  const [edAddSearchQ, setEdAddSearchQ] = useState("");
  const [edAddDropOpen, setEdAddDropOpen] = useState(false);
  const [sectionEditors, setSectionEditors] = useState({
    morphologicalResearch: { value: "", isVerified: false, saving: false },
    proceduresAndManipulations: { value: "", isVerified: false, saving: false },
    surgeries: { value: "", isVerified: false, saving: false },
  });
  const [patientSectionData, setPatientSectionData] = useState({
    laboratoryAnalysis: [],
    studiesManipulations: [],
    morphologicalResearch: { files: [], comment: {} },
    proceduresAndManipulations: { files: [], comment: {} },
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

    setSectionEditors((prev) => ({
      ...prev,
      surgeries: {
        value: booking?.schedule?.surgeries?.comment?.value || "",
        isVerified: !!booking?.schedule?.surgeries?.comment?.isVerified,
        saving: false,
      },
    }));

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
    if (!booking) return;
    const patientId = booking?.patient?.patientId;
    if (patientId) loadPatientSections(patientId);
  }, [booking?._id]);

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

  // Reset schedule sub-tab to Specialist Consultation whenever medical history tab is opened
  useEffect(() => {
    if (activeTab === "medicalHistory") {
      setActiveScheduleTab("specialistConsultation");
      setActiveTestId(null);
    }
  }, [activeTab]);

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


          }
        } catch {
          // Ignore and keep fallback booking object
        }
      }

      // IMPORTANT: Always try to load the real booking if we have an ID and specialist consultations are empty
      if (foundBooking?._id && (!foundBooking?.schedule?.specialistConsultations || foundBooking.schedule.specialistConsultations.length === 0)) {
        try {
          const detailsResponse = await getEarlyDetectionBookingById(foundBooking._id);
          const detailsBooking = unwrapBookingResponse(detailsResponse);
          if (detailsBooking?.schedule?.specialistConsultations?.length > 0) {
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

  const loadPatientSections = async (patientId) => {
    if (!patientId) return;
    try {
      const [labRes, studiesRes, morphRes, procRes] = await Promise.all([
        getPatientSection(patientId, "laboratoryAnalysis"),
        getPatientSection(patientId, "studiesManipulations"),
        getPatientSection(patientId, "morphologicalResearch"),
        getPatientSection(patientId, "proceduresAndManipulations"),
      ]);
      const morphData = morphRes?.data || { files: [], comment: {} };
      const procData = procRes?.data || { files: [], comment: {} };
      setPatientSectionData({
        laboratoryAnalysis: labRes?.data?.entries || [],
        studiesManipulations: studiesRes?.data?.entries || [],
        morphologicalResearch: morphData,
        proceduresAndManipulations: procData,
      });
      setSectionEditors((prev) => ({
        ...prev,
        morphologicalResearch: {
          value: morphData?.comment?.value || "",
          isVerified: !!morphData?.comment?.isVerified,
          saving: false,
        },
        proceduresAndManipulations: {
          value: procData?.comment?.value || "",
          isVerified: !!procData?.comment?.isVerified,
          saving: false,
        },
      }));
    } catch {
      // fail silently — patient sections are optional
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
        await updateEarlyDetectionManagedTest(settingsSection, editingManagedTestId, {
          name: { en: nameEn, ru: nameRu },
        });
      } else {
        await createEarlyDetectionManagedTest(settingsSection, {
          name: { en: nameEn, ru: nameRu },
        });
      }

      await loadManagedTests(settingsSection);
      // If upload modal is open for a different section, also refresh that section
      if (showUploadModal && uploadSection !== settingsSection) {
        await loadManagedTests(uploadSection);
      }
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

  const PATIENT_SECTION_KEYS = {
    laboratoryTests: "laboratoryAnalysis",
    instrumentalAnalysis: "studiesManipulations",
    morphologicalResearch: "morphologicalResearch",
    proceduresAndManipulations: "proceduresAndManipulations",
  };

  const handleUploadSectionFile = async () => {
    const patientId = booking?.patient?.patientId;
    const psSection = PATIENT_SECTION_KEYS[uploadSection];

    if (psSection && patientId) {
      if (sectionsWithTestSelection.includes(uploadSection) && !uploadItemId) {
        toast.error("Select a test");
        return;
      }
      const filesToUpload = uploadFiles.length > 0 ? uploadFiles : (uploadFile ? [{ file: uploadFile, customName: uploadCustomName }] : []);
      if (filesToUpload.length === 0) {
        toast.error("Add at least one file");
        return;
      }
      setIsUploadingSectionFile(true);
      try {
        for (const fileItem of filesToUpload) {
          if (!fileItem.file) continue;
          let label = "";
          if (sectionsWithTestSelection.includes(uploadSection)) {
            const test = (managedTests[uploadSection] || []).find((t) => normalizeId(t?._id) === uploadItemId);
            label = test ? readLocalizedName(test?.name) : "";
          } else {
            label = fileItem.customName || "";
          }
          await uploadPatientSectionFile(patientId, psSection, fileItem.file, label);
        }
        await loadPatientSections(patientId);
        setShowUploadModal(false);
        setUploadFiles([]);
        toast.success("File(s) uploaded");
      } catch (error) {
        toast.error(error?.response?.data?.message || "Failed to upload files");
      } finally {
        setIsUploadingSectionFile(false);
      }
      return;
    }

    // Fallback: booking-level upload for other sections
    if (sectionsWithTestSelection.includes(uploadSection) && !uploadItemId) {
      toast.error("Select a test");
      return;
    }

    if (multiUploadSections.includes(uploadSection)) {
      if (uploadFiles.length === 0) {
        toast.error("Add at least one file");
        return;
      }
      setIsUploadingSectionFile(true);
      try {
        for (const fileItem of uploadFiles) {
          if (!fileItem.file) continue;
          const formData = new FormData();
          formData.append("section", uploadSection);
          if (sectionsWithTestSelection.includes(uploadSection) && uploadItemId) formData.append("itemId", uploadItemId);
          if (fileItem.customName) formData.append("customName", fileItem.customName);
          formData.append("file", fileItem.file);
          const response = await uploadEarlyDetectionScheduleFile(booking._id || id, uploadSection, formData);
          const responseData = response?.data;
          const bookingData = responseData?.success ? responseData.data : responseData;
          if (bookingData) setBooking(sanitizeBookingData(bookingData));
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
      if (!uploadFile) { toast.error("Select a file"); return; }
      setIsUploadingSectionFile(true);
      try {
        const formData = new FormData();
        formData.append("section", uploadSection);
        if (uploadItemId) formData.append("itemId", uploadItemId);
        if (uploadCustomName) formData.append("customName", uploadCustomName);
        formData.append("file", uploadFile);
        const response = await uploadEarlyDetectionScheduleFile(booking._id || id, uploadSection, formData);
        const responseData = response?.data;
        const bookingData = responseData?.success ? responseData.data : responseData;
        if (bookingData) setBooking(sanitizeBookingData(bookingData));
        else await loadBookingDetails();
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
      const patientId = booking?.patient?.patientId;
      const managedPatientSections = ["morphologicalResearch", "proceduresAndManipulations"];

      if (managedPatientSections.includes(section) && patientId) {
        await updatePatientSectionComment(patientId, section, editor.value || "");
        setPatientSectionData((prev) => ({
          ...prev,
          [section]: {
            ...prev[section],
            comment: { ...(prev[section]?.comment || {}), value: editor.value || "" },
          },
        }));
      } else {
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
        if (response?.success && response?.data) setBooking(sanitizeBookingData(response.data));
        else await loadBookingDetails();
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


      // Handle different response structures
      let notesData = [];
      if (response?.data?.success) {
        notesData = Array.isArray(response?.data?.data) ? response.data.data : [];
      } else if (Array.isArray(response?.data)) {
        notesData = response.data;
      } else if (response?.data) {
        notesData = [response.data];
      }


      // Transform notes to ensure proper structure - handle nested objects
      const transformedNotes = notesData.map((note) => {

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
            <Eye size={15} />
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
              <Eye size={15} />
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
            <Download size={15} />
          </button>
        ) : (
          getSectionFileUrl(file, true) && (
            <a
              href={getSectionFileUrl(file, true)}
              download
              className="ed-file-link-btn ed-file-link-btn--download"
              title={t("earlyDiagnosis.download", "Download")}
            >
              <Download size={15} />
            </a>
          )
        )}
      </>
    );
  };

  const renderPatientFileActions = (section, entry) => {
    const patientId = booking?.patient?.patientId;
    if (!patientId) return null;

    const isLabSection = ["laboratoryAnalysis", "studiesManipulations"].includes(section);
    const isTextEntry = isLabSection && entry?.kind === "text";
    const fileId = normalizeId(entry?.fileId);
    const entryId = normalizeId(entry?._id);

    const handleView = async () => {
      if (!fileId) return;
      try {
        const response = await getPatientSectionFile(patientId, section, fileId);
        const blob = new Blob([response.data], { type: response.headers?.["content-type"] || "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank", "noopener,noreferrer");
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } catch {
        toast.error(t("earlyDiagnosis.fileOpenFailed", "Could not open file."));
      }
    };

    const handleDownload = async () => {
      if (!fileId) return;
      try {
        const response = await getPatientSectionFile(patientId, section, fileId);
        const blob = new Blob([response.data], { type: response.headers?.["content-type"] || "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = entry?.filename || entry?.label || "download";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } catch {
        toast.error("Could not download file.");
      }
    };

    const handleDelete = async () => {
      if (!window.confirm("Delete this entry?")) return;
      try {
        if (isLabSection) {
          await removePatientSectionEntry(patientId, section, entryId);
          setPatientSectionData((prev) => ({
            ...prev,
            [section]: (prev[section] || []).filter((e) => normalizeId(e?._id) !== entryId),
          }));
        } else {
          await removePatientSectionFile(patientId, section, fileId || entryId);
          setPatientSectionData((prev) => ({
            ...prev,
            [section]: {
              ...prev[section],
              files: (prev[section]?.files || []).filter(
                (f) => normalizeId(f?.fileId) !== fileId && normalizeId(f?._id) !== entryId,
              ),
            },
          }));
        }
        toast.success(t("earlyDiagnosis.deleted", "Deleted"));
      } catch {
        toast.error("Failed to delete.");
      }
    };

    return (
      <>
        {!isTextEntry && fileId && (
          <>
            <button type="button" className="ed-file-link-btn ed-file-link-btn--view" title={t("earlyDiagnosis.view", "View")} onClick={handleView}>
              <Eye size={15} />
            </button>
            <button type="button" className="ed-file-link-btn ed-file-link-btn--download" title={t("earlyDiagnosis.download", "Download")} onClick={handleDownload}>
              <Download size={15} />
            </button>
          </>
        )}
        <button type="button" className="ed-file-link-btn ed-file-link-btn--delete" title={t("earlyDiagnosis.delete", "Delete")} onClick={handleDelete}>
          <Trash2 size={15} />
        </button>
      </>
    );
  };

  const buildScheduleWithoutFile = (section, entryId, fileId) => {
    const nextSchedule = { ...(booking?.schedule || {}) };
    const sectionEntries = Array.isArray(nextSchedule?.[section]) ? [...nextSchedule[section]] : [];

    nextSchedule[section] = sectionEntries
      .map((entry) => {
        if (normalizeId(entry?._id) !== normalizeId(entryId)) return entry;
        const nextFiles = Array.isArray(entry?.files)
          ? entry.files.filter((file) => normalizeId(file?.fileId) !== normalizeId(fileId) && normalizeId(file?._id) !== normalizeId(fileId))
          : [];
        return {
          ...entry,
          files: nextFiles,
        };
      })
      .filter(Boolean);

    return nextSchedule;
  };

  const refreshBookingFromResponse = (response) => {
    const responseData = response?.data;
    const bookingData = responseData?.success ? responseData.data : responseData;
    if (bookingData) {
      setBooking(sanitizeBookingData(bookingData));
    } else {
      loadBookingDetails();
    }
  };

  const handleDeleteSelectedTestFile = async (section, entryId, file) => {
    if (!file || !entryId) return;

    try {
      const nextSchedule = buildScheduleWithoutFile(section, entryId, file?.fileId || file?._id);
      const response = await updateEarlyDetectionBooking(booking._id || id, {
        schedule: nextSchedule,
      });
      refreshBookingFromResponse(response);
      toast.success(t("earlyDiagnosis.deleted", "Deleted"));
    } catch (error) {
      toast.error(error?.response?.data?.message || t("earlyDiagnosis.failedToDeleteFile", "Failed to delete file"));
    }
  };

  const handleSaveTestNote = async (section, itemId) => {
    if (!String(testNoteDraft || "").trim() || !itemId) return;

    setIsSavingTestNote(true);
    try {
      const selectedEntries = getManagedTestEntries(section, itemId);
      const targetEntry = selectedEntries[0];

      const response = editingTestNoteId && targetEntry
        ? await updateEarlyDetectionTestEntryNote(booking._id || id, section, targetEntry._id, editingTestNoteId, testNoteDraft)
        : await addEarlyDetectionTestEntryNote(booking._id || id, section, itemId, testNoteDraft);

      refreshBookingFromResponse(response);
      setShowTestNoteEditor(false);
      setTestNoteDraft("");
      setEditingTestNoteId(null);
      toast.success(t("earlyDiagnosis.saved", "Saved"));
    } catch (error) {
      toast.error(error?.response?.data?.message || t("earlyDiagnosis.failedToSaveNote", "Failed to save note"));
    } finally {
      setIsSavingTestNote(false);
    }
  };

  const handleDeleteTestNote = async (section, itemId, noteId) => {
    const selectedEntries = getManagedTestEntries(section, itemId);
    const targetEntry = selectedEntries[0];
    if (!targetEntry || !noteId) return;

    setIsSavingTestNote(true);
    try {
      const response = await deleteEarlyDetectionTestEntryNote(booking._id || id, section, targetEntry._id, noteId);
      refreshBookingFromResponse(response);
      if (editingTestNoteId === noteId) {
        setShowTestNoteEditor(false);
        setTestNoteDraft("");
        setEditingTestNoteId(null);
      }
      toast.success(t("earlyDiagnosis.deleted", "Deleted"));
    } catch (error) {
      toast.error(error?.response?.data?.message || t("earlyDiagnosis.failedToDeleteNote", "Failed to delete note"));
    } finally {
      setIsSavingTestNote(false);
    }
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

  const handleEdAddModalSubmit = async () => {
    if (!edAddSection || !edAddItemId) return;
    const hasFiles = edAddFiles.length > 0;
    const textContent = String(edAddText || "").replace(/<[^>]*>/g, "").trim();
    if (!hasFiles && !textContent) return;
    setEdAddSubmitting(true);
    try {
      for (const file of edAddFiles) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("section", edAddSection);
        formData.append("itemId", edAddItemId);
        const res = await uploadEarlyDetectionScheduleFile(booking._id || id, edAddSection, formData);
        refreshBookingFromResponse(res);
      }
      if (textContent) {
        const res = await addEarlyDetectionTestEntryNote(booking._id || id, edAddSection, edAddItemId, edAddText);
        refreshBookingFromResponse(res);
      }
      await loadBookingDetails();
      setEdAddModalOpen(false);
      setEdAddFiles([]);
      setEdAddText("");
      toast.success(t("earlyDiagnosis.saved", "Saved"));
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to upload");
    } finally {
      setEdAddSubmitting(false);
    }
  };

  const groupEdItems = (entries) => {
    const allItems = [
      ...entries.flatMap((e) => (e.files || []).map((f) => ({ ...f, _type: "file", entryId: e._id, _ts: new Date(f.uploadedAt || f.createdAt || 0).getTime() }))),
      ...entries.flatMap((e) => (e.notes || []).map((n) => ({ ...n, _type: "note", entryId: e._id, _ts: new Date(n.createdAt || 0).getTime() }))),
    ];
    allItems.sort((a, b) => a._ts - b._ts);
    const groups = [];
    for (const item of allItems) {
      const last = groups[groups.length - 1];
      if (!last || item._ts - last[last.length - 1]._ts > 10000) groups.push([item]);
      else last.push(item);
    }
    return groups;
  };

  const handleDeleteEdGroup = async (section, group) => {
    try {
      let lastResponse = null;
      for (const item of group) {
        if (item._type === "file") {
          const nextSchedule = buildScheduleWithoutFile(section, item.entryId, item?.fileId || item?._id);
          lastResponse = await updateEarlyDetectionBooking(id, { schedule: nextSchedule });
        } else {
          lastResponse = await deleteEarlyDetectionTestEntryNote(booking._id || id, section, item.entryId, item._id);
        }
      }
      if (lastResponse) refreshBookingFromResponse(lastResponse);
      else await loadBookingDetails();
      toast.success(t("earlyDiagnosis.deleted", "Deleted"));
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete group");
    }
  };

  const getManagedTestEntries = (section, testId) => {
    const sectionEntries = Array.isArray(booking?.schedule?.[section]) ? booking.schedule[section] : [];
    return sectionEntries.filter((entry) => normalizeId(entry?.item?._id) === testId);
  };

  const renderManagedTestSection = (section) => {
    const tests = Array.isArray(managedTests?.[section]) ? managedTests[section] : [];

    if (activeTestId) {
      const selectedTest = tests.find((test) => normalizeId(test?._id) === activeTestId);
      if (selectedTest) {
        const selectedEntries = getManagedTestEntries(section, activeTestId);
        const selectedFiles = selectedEntries.flatMap((entry) => entry?.files || []);
        const selectedNotes = selectedEntries.flatMap((entry) => (Array.isArray(entry?.notes) ? entry.notes.map((note) => ({ ...note, entryId: entry?._id })) : []));

        const noteEditorVisible = showTestNoteEditor;

        return (
          <div className="ed-test-detail-page">
            {(() => {
              const edGroups = groupEdItems(selectedEntries);
              if (edGroups.length === 0) return (
                <div className="ed-section-add-only">
                  <button type="button" className="ed-td-btn" onClick={() => { setEdAddSection(section); setEdAddItemId(activeTestId); setEdAddFiles([]); setEdAddText(""); setEdAddSearchQ(""); setEdAddDropOpen(false); setEdAddModalOpen(true); }}>
                    <Plus size={14} />{t("earlyDiagnosis.add", "Add")}
                  </button>
                </div>
              );
              return (
                <>
                  <div className="ed-test-detail-header">
                    <h2 className="ed-test-detail-title">{readLocalizedName(selectedTest?.name)}</h2>
                  </div>
                  <div className="ed-test-detail-actions">
                    <button type="button" className="ed-td-btn" onClick={() => { setEdAddSection(section); setEdAddItemId(activeTestId); setEdAddFiles([]); setEdAddText(""); setEdAddModalOpen(true); }}>
                      <Plus size={14} />{t("earlyDiagnosis.add", "Add")}
                    </button>
                  </div>
                  <div className="ed-td-list">
                    {edGroups.map((group, gIdx) => {
                      const dt = group[0]._ts ? new Date(group[0]._ts) : null;
                      const dateStr = dt ? `${String(dt.getDate()).padStart(2,"0")}-${String(dt.getMonth()+1).padStart(2,"0")}-${dt.getFullYear()}` : "";
                      const timeStr = dt ? `${String(dt.getHours()).padStart(2,"0")}:${String(dt.getMinutes()).padStart(2,"0")}` : "";
                      return (
                        <div key={gIdx} className="ht-td-group">
                          <div className="ht-td-group-items">
                            <div className="ht-td-group-card-header">
                              <div className="ht-td-group-date"><Clock size={11} /><span>{dateStr} · {timeStr}</span></div>
                              <button type="button" className="ht-td-group-delete-btn" onClick={() => handleDeleteEdGroup(section, group)} aria-label="Delete group"><Trash2 size={13} /></button>
                            </div>
                            <div className="ht-td-group-grid">
                              {group.map((item, iIdx) => item._type === "file" ? (
                                <div key={normalizeId(item?.fileId) || iIdx} className="ht-td-item">
                                  <span className={`ht-td-badge ht-td-badge--${getFileExtension(item)}`}>{getFileExtension(item).toUpperCase()}</span>
                                  <div className="ht-td-item-info"><span className="ht-td-item-name">{getFileLabel(item)}</span></div>
                                  <div className="ht-td-item-actions">
                                    {renderFileActionButtons(item)}
                                    <button type="button" className="ht-td-icon-btn" onClick={() => handleDeleteSelectedTestFile(section, item.entryId, item)}><Trash2 size={14} /></button>
                                  </div>
                                </div>
                              ) : (
                                <div key={String(item._id)} className="ht-td-item">
                                  <span className="ht-td-note-icon"><FileText size={16} /></span>
                                  <div className="ht-td-item-info"><div className="ht-td-item-name" dangerouslySetInnerHTML={{ __html: item.content }} /></div>
                                  <div className="ht-td-item-actions">
                                    <button type="button" className="ht-td-icon-btn" onClick={() => { setEditingTestNoteId(item._id); setTestNoteDraft(item.content || ""); setShowTestNoteEditor(true); }}><Pencil size={14} /></button>
                                    <button type="button" className="ht-td-icon-btn" onClick={() => handleDeleteTestNote(section, item.entryId, item._id)}><Trash2 size={14} /></button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}

            {/* Note edit popup */}
            {showTestNoteEditor && createPortal(
              <>
                <div className="ht-add-overlay" onClick={() => { setShowTestNoteEditor(false); setTestNoteDraft(""); setEditingTestNoteId(null); }} />
                <div className="ht-add-modal ht-add-modal--note">
                  <div className="ht-add-modal-header">
                    <span className="ht-add-modal-title">{editingTestNoteId ? t("earlyDiagnosis.editNote", "Edit Note") : t("earlyDiagnosis.addNote", "Add Note")}</span>
                    <button type="button" className="ht-add-modal-close" onClick={() => { setShowTestNoteEditor(false); setTestNoteDraft(""); setEditingTestNoteId(null); }}><XIcon size={16} /></button>
                  </div>
                  <div className="ht-add-step">
                    <div className="ht-add-rte-wrap">
                      <RichTextEditor value={testNoteDraft} onChange={setTestNoteDraft} placeholder={t("history_tab.enter_text", "Enter text…")} />
                    </div>
                    <div className="ht-add-modal-footer">
                      <button type="button" className="ht-add-btn-secondary" onClick={() => { setShowTestNoteEditor(false); setTestNoteDraft(""); setEditingTestNoteId(null); }}>{t("earlyDiagnosis.cancel", "Cancel")}</button>
                      <button type="button" className="ht-add-btn-primary" disabled={isSavingTestNote || !String(testNoteDraft || "").replace(/<[^>]*>/g,"").trim()} onClick={() => handleSaveTestNote(section, activeTestId)}>
                        {isSavingTestNote ? t("earlyDiagnosis.saving", "Saving…") : t("earlyDiagnosis.save", "Save")}
                      </button>
                    </div>
                  </div>
                </div>
              </>,
              document.body
            )}

            {/* Add modal */}
            {edAddModalOpen && edAddSection === section && createPortal(
              <>
                <div className="ht-add-overlay" onClick={() => setEdAddModalOpen(false)} />
                <div className="ht-add-modal ht-add-modal--wide">
                  <div className="ht-add-modal-header">
                    <span className="ht-add-modal-title">{t("earlyDiagnosis.add", "Add")}</span>
                    <button type="button" className="ht-add-modal-close" onClick={() => setEdAddModalOpen(false)}><XIcon size={16} /></button>
                  </div>
                  <div className="ht-add-step" style={edAddDropOpen ? { overflowY: "visible" } : {}}>
                    <span className="ht-add-section-label">{t("earlyDiagnosis.selectTest", "SELECT TEST")}</span>
                    <div className="ht-test-dropdown" style={{ position: "relative" }}>
                      <button type="button" className="ht-test-dropdown-trigger" onClick={() => setEdAddDropOpen((o) => !o)}>
                        {edAddItemId ? (<span className="ht-test-dropdown-value">{readLocalizedName((managedTests[section] || []).find((it) => normalizeId(it?._id) === edAddItemId)?.name)}</span>) : (<span className="ht-test-dropdown-placeholder">{t("earlyDiagnosis.selectTest", "— select a test —")}</span>)}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                      </button>
                      {edAddDropOpen && (
                        <div className="ht-test-dropdown-menu">
                          <div className="ht-test-dropdown-search-wrap">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                            <input autoFocus className="ht-test-dropdown-search" placeholder={t("common.search", "Search…")} value={edAddSearchQ} onChange={(e) => setEdAddSearchQ(e.target.value)} />
                          </div>
                          {(managedTests[section] || []).filter((it) => readLocalizedName(it?.name)?.toLowerCase().includes(edAddSearchQ.toLowerCase())).map((item) => { const id = normalizeId(item?._id); return (<div key={id} className={`ht-test-dropdown-item${edAddItemId === id ? " selected" : ""}`} onClick={() => { setEdAddItemId(id); setEdAddDropOpen(false); setEdAddSearchQ(""); }}><span className="ht-test-dropdown-item-name">{readLocalizedName(item?.name)}</span></div>); })}
                          {(managedTests[section] || []).filter((it) => readLocalizedName(it?.name)?.toLowerCase().includes(edAddSearchQ.toLowerCase())).length === 0 && (<div className="ht-test-dropdown-empty">{t("common.noResults", "No results")}</div>)}
                        </div>
                      )}
                    </div>
                    <span className="ht-add-section-label">{t("earlyDiagnosis.files", "FILES")}</span>
                    <div className="ht-add-file-zone" style={{ cursor: "pointer" }} onClick={() => edAddFileInputRef.current?.click()}>
                      <Upload size={20} /><span>{t("earlyDiagnosis.clickToUpload", "Click to upload files")}</span>
                    </div>
                    {edAddFiles.length > 0 && (
                      <div className="ht-add-file-list">
                        {edAddFiles.map((f, i) => (
                          <div key={i} className="ht-add-file-item">
                            <span className="ht-add-file-name">{f.name}</span>
                            <button type="button" className="ht-add-file-remove" onClick={() => setEdAddFiles((prev) => prev.filter((_, idx) => idx !== i))}><XIcon size={12} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    <span className="ht-add-section-label">{t("earlyDiagnosis.addText", "ADD TEXT")}</span>
                    <div className="ht-add-rte-wrap">
                      <RichTextEditor value={edAddText} onChange={setEdAddText} placeholder={t("history_tab.enter_text", "Enter text…")} />
                    </div>
                    <div className="ht-add-modal-footer">
                      <button type="button" className="ht-add-btn-secondary" onClick={() => setEdAddModalOpen(false)}>{t("earlyDiagnosis.cancel", "Cancel")}</button>
                      <button type="button" className="ht-add-btn-primary" disabled={edAddSubmitting || !edAddItemId || (edAddFiles.length === 0 && !String(edAddText || "").replace(/<[^>]*>/g,"").trim())} onClick={handleEdAddModalSubmit}>
                        {edAddSubmitting ? t("earlyDiagnosis.saving", "Saving…") : t("earlyDiagnosis.save", "Save")}
                      </button>
                    </div>
                  </div>
                </div>
              </>,
              document.body
            )}
          </div>
        );
      }
    }

    return (
      <div className="ed-schedule-section-list">
        {tests.length === 0 ? (
          <div className="ed-schedule-empty">{t("earlyDiagnosis.noTests", "No tests configured")}</div>
        ) : (
          tests.map((test) => {
            const testId = normalizeId(test?._id);
            const isDone = getManagedTestEntries(section, testId).some((entry) => Array.isArray(entry?.files) && entry.files.length > 0);

            return (
              <button
                key={testId}
                type="button"
                className="ed-test-list-item"
                onClick={() => setActiveTestId(testId)}
              >
                <div className="ed-test-list-item-header">
                  <span className={`ed-test-list-status${isDone ? " ed-test-list-status--done" : ""}`}>
                    {isDone ? <CheckCircle size={15} /> : <span className="ed-test-status-circle" />}
                  </span>
                  <span className="ed-test-list-name">{readLocalizedName(test?.name)}</span>
                </div>
              </button>
            );
          })
        )}
      </div>
    );
  };

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
      <ToastContainer position="top-right" autoClose={3000} />
      <EDHeader
        booking={booking}
        patientDisplayName={patientDisplayName}
        dobHeader={dobHeader}
        formatDate={formatDate}
        patientGender={patientGender}
        patientAge={patientAge}
      />

      <div className="booking-details-content">
        <div className={`ed-details-body${activeTab === "medicalHistory" ? " ed-details-body--with-subnav" : ""}${activeTab === "medicalHistory" && (activeScheduleTab === "specialistConsultation" || managedSectionTabs.includes(activeScheduleTab)) ? " ed-details-body--with-specialist-panel" : ""}${activeTab === "patient" ? " ed-details-body--with-footer" : ""}${navExpanded ? " ed-details-body--sidebar-expanded" : ""}`}>
          <EDIconSidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            patientBookings={patientBookings}
            selectedBookingId={selectedBookingId}
            setSelectedBookingId={setSelectedBookingId}
            formatDate={formatDate}
            normalizeId={normalizeId}
            navExpanded={navExpanded}
            setNavExpanded={setNavExpanded}
          />

          {activeTab === "medicalHistory" && (
            <EDMedicalSubnav
              booking={booking}
              activeScheduleTab={activeScheduleTab}
              setActiveScheduleTab={setActiveScheduleTab}
              activeTestId={activeTestId}
              setActiveTestId={setActiveTestId}
              managedTests={managedTests}
              managedSectionTabs={managedSectionTabs}
              setActiveSpecialistTab={setActiveSpecialistTab}
              openTestSettingsModal={openTestSettingsModal}
              openUploadSectionModal={openUploadSectionModal}
              normalizeId={normalizeId}
              readLocalizedName={readLocalizedName}
              getManagedTestEntries={getManagedTestEntries}
              setShowTestNoteEditor={setShowTestNoteEditor}
              setTestNoteDraft={setTestNoteDraft}
              setEditingTestNoteId={setEditingTestNoteId}
            />
          )}

          {/* Secondary sidebar — specialist list or managed test list */}
          {activeTab === "medicalHistory" && (activeScheduleTab === "specialistConsultation" || managedSectionTabs.includes(activeScheduleTab)) && (
            <div className="ed-specialist-list-panel">
              {activeScheduleTab === "specialistConsultation" ? (
                (booking?.schedule?.specialistConsultations || []).length === 0 ? (
                  <div className="ed-specialist-list-panel-empty">
                    {t("earlyDiagnosis.noSpecialistConsultations", "No consultations")}
                  </div>
                ) : (
                  booking.schedule.specialistConsultations.map((s, i) => {
                    const title = s?.title
                      ? t(`earlyDiagnosis.specialist_${normalizeSpecialistTitle(s.title)}`, s.title)
                      : `Specialist ${i + 1}`;
                    return (
                      <button
                        key={i}
                        type="button"
                        className={`ed-subnav-specialist-item${activeSpecialistTab === i ? " ed-subnav-specialist-item--active" : ""}`}
                        onClick={() => setActiveSpecialistTab(i)}
                      >
                        <span className="ed-subnav-specialist-name">{title}</span>
                      </button>
                    );
                  })
                )
              ) : (
                (managedTests?.[activeScheduleTab] || []).length === 0 ? (
                  <div className="ed-specialist-list-panel-empty">
                    {t("earlyDiagnosis.noTests", "No tests")}
                  </div>
                ) : (
                  (managedTests[activeScheduleTab]).map((test) => {
                    const testId = normalizeId(test?._id);
                    const entries = getManagedTestEntries(activeScheduleTab, testId);
                    const isDone = entries.some((e) => Array.isArray(e.files) && e.files.length > 0);
                    const isActive = activeTestId === testId;
                    return (
                      <button
                        key={testId}
                        type="button"
                        className={`ed-subnav-test-item${isDone ? " ed-subnav-test-item--done" : ""}${isActive ? " ed-subnav-test-item--active" : ""}`}
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
                  })
                )
              )}
            </div>
          )}

          <div
            className={`booking-details-layout booking-details-layout--single${showSidebarTabs ? " booking-details-layout--sidebar-only" : ""}`}
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
                  <EDScheduleTab
                    booking={booking}
                    isEditing={isEditing}
                    groupedSchedule={groupedSchedule}
                    editedScheduleItems={editedScheduleItems}
                    setEditedScheduleItems={setEditedScheduleItems}
                    loadingDoctors={loadingDoctors}
                    formatLocalDateOnly={formatLocalDateOnly}
                    formatDayMetaDate={formatDayMetaDate}
                    toLocalDateOnly={toLocalDateOnly}
                    normalizeId={normalizeId}
                    normalizeSpecialistTitle={normalizeSpecialistTitle}
                    handleScheduleItemChange={handleScheduleItemChange}
                    getDoctorDisplayName={getDoctorDisplayName}
                    getDoctorsForScheduleItem={getDoctorsForScheduleItem}
                    getAvailableStartTimesForItem={getAvailableStartTimesForItem}
                    getAvailableEndTimesForItem={getAvailableEndTimesForItem}
                    resolveDoctorEmail={resolveDoctorEmail}
                    i18nLanguage={i18n.language}
                  />
                )}

                {activeTab === "medicalHistory" && (
                  <EDMedicalHistoryContent
                    booking={booking}
                    activeScheduleTab={activeScheduleTab}
                    activeSpecialistTab={activeSpecialistTab}
                    managedSectionTabs={managedSectionTabs}
                    patientSectionData={patientSectionData}
                    renderPatientFileActions={renderPatientFileActions}
                    sectionEditors={sectionEditors}
                    updateSectionEditor={updateSectionEditor}
                    handleSaveManagedSectionComment={handleSaveManagedSectionComment}
                    openUploadSectionModal={openUploadSectionModal}
                    normalizeId={normalizeId}
                    normalizeSpecialistTitle={normalizeSpecialistTitle}
                    getFileExtension={getFileExtension}
                    getFileLabel={getFileLabel}
                    formatFileSize={formatFileSize}
                    getVisibleSpecialistConsultations={getVisibleSpecialistConsultations}
                    currentDoctorEmail={currentDoctorEmail}
                    normalizeDoctorEmail={normalizeDoctorEmail}
                    specialistForms={specialistForms}
                    specialistFormSaving={specialistFormSaving}
                    handleSaveSpecialistForm={handleSaveSpecialistForm}
                  />
                )}
              </div>
            )}

            {/* Right Column */}
            {showSidebarTabs && (
              <div className="booking-details-sidebar">
                <EDHistoryNotesTab
                  activeTab={activeTab}
                  booking={booking}
                  formatDate={formatDate}
                  formatDateTime={formatDateTime}
                  formatNoteText={formatNoteText}
                  groupedSchedule={groupedSchedule}
                  getDoctorDisplayName={getDoctorDisplayName}
                  normalizeSpecialistTitle={normalizeSpecialistTitle}
                  i18nLanguage={i18n.language}
                  isAddingNote={isAddingNote}
                  setIsAddingNote={setIsAddingNote}
                  newNote={newNote}
                  setNewNote={setNewNote}
                  handleAddNote={handleAddNote}
                  isSaving={isSaving}
                  editingNoteId={editingNoteId}
                  editingNoteText={editingNoteText}
                  setEditingNoteText={setEditingNoteText}
                  setEditingNoteId={setEditingNoteId}
                  handleEditNote={handleEditNote}
                  handleDeleteNote={handleDeleteNote}
                  handleUpdateNote={handleUpdateNote}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden file input for ED add modal — lives outside the portal so React onChange fires reliably */}
      <input
        ref={edAddFileInputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = "";
          setEdAddFiles((prev) => [...prev, ...files]);
        }}
      />

      <EDModals
        showTestSettingsModal={showTestSettingsModal}
        setShowTestSettingsModal={setShowTestSettingsModal}
        settingsSection={settingsSection}
        testDraft={testDraft}
        setTestDraft={setTestDraft}
        editingManagedTestId={editingManagedTestId}
        setEditingManagedTestId={setEditingManagedTestId}
        managedTests={managedTests}
        handleManagedTestSave={handleManagedTestSave}
        handleManagedTestDelete={handleManagedTestDelete}
        savingManagedTest={savingManagedTest}
        normalizeId={normalizeId}
        showUploadModal={showUploadModal}
        setShowUploadModal={setShowUploadModal}
        uploadSection={uploadSection}
        uploadItemId={uploadItemId}
        setUploadItemId={setUploadItemId}
        uploadCustomName={uploadCustomName}
        setUploadCustomName={setUploadCustomName}
        uploadFile={uploadFile}
        setUploadFile={setUploadFile}
        uploadFiles={uploadFiles}
        setUploadFiles={setUploadFiles}
        managedTestOptions={managedTestOptions}
        readLocalizedName={readLocalizedName}
        handleUploadSectionFile={handleUploadSectionFile}
        isUploadingSectionFile={isUploadingSectionFile}
        sectionsWithTestSelection={sectionsWithTestSelection}
        multiUploadSections={multiUploadSections}
        showDeleteNoteConfirm={showDeleteNoteConfirm}
        cancelDeleteNote={cancelDeleteNote}
        confirmDeleteNote={confirmDeleteNote}
        isSaving={isSaving}
        showDeleteConfirm={showDeleteConfirm}
        cancelManagedTestDelete={cancelManagedTestDelete}
        confirmManagedTestDelete={confirmManagedTestDelete}
        showManualPaymentForm={showManualPaymentForm}
        setShowManualPaymentForm={setShowManualPaymentForm}
        manualSelectedPkg={manualSelectedPkg}
        setManualSelectedPkg={setManualSelectedPkg}
        manualSelectedAddons={manualSelectedAddons}
        toggleManualAddon={toggleManualAddon}
        manualTotal={manualTotal}
        manualPayment={manualPayment}
        setManualPayment={setManualPayment}
        handleManualPaymentSave={handleManualPaymentSave}
        isSavingManual={isSavingManual}
        ED_PACKAGES={ED_PACKAGES}
        ED_ADDONS={ED_ADDONS}
      />
    </div>
  );
};

export default EarlyDetectionBookingDetails;
