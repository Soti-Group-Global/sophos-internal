import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
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
  getEarlyDetectionScheduleFileUrl,
  saveEarlyDetectionSpecialistHistoryForm,
  getPatientByEmail,
  getEarlyDetectionBookingById,
  getAssistantDoctors,
} from "../utils/api";
import { createPortal } from "react-dom";
import GeneralInformationTab from "./AppointmentDetails/GeneralInformationTab";
import CustomCalendar from "../components/CustomCalendar/CustomCalendar";
import CustomTimePicker from "../components/CustomTimePicker/CustomTimePicker";
import RichTextEditor from "../components/RichTextEditor/RichTextEditor";
import SpecialistHistoryForm from "../components/SpecialistHistoryForm/SpecialistHistoryForm";
import "../styles/EarlyDetectionBookingDetails.css";
import "./AppointmentDetailsPage.css";
import EarlyDetectionReportTab from "./EarlyDetectionReportTab";

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
  const specialties = Array.isArray(doctor?.specialtyIds)
    ? doctor.specialtyIds
    : [];
  const subSpecialties = Array.isArray(doctor?.subSpecialityIds)
    ? doctor.subSpecialityIds
    : [];

  return [...specialties, ...subSpecialties]
    .flatMap((specialty) => [specialty?.name_en, specialty?.name_ru])
    .filter(Boolean)
    .map(normalizeMatchText);
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
  const [searchParams, setSearchParams] = useSearchParams();
  const allowedTabs = new Set([
    "patient",
    "appointmentDetails",
    "medicalHistory",
    "history",
    "notes",
  ]);
  const [booking, setBooking] = useState(null);
  const [patientDetails, setPatientDetails] = useState(null);
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
  const [activeTab, setActiveTab] = useState(() => {
    const tabFromUrl = searchParams.get("tab");
    return tabFromUrl && allowedTabs.has(tabFromUrl) ? tabFromUrl : "patient";
  });
  const [activeScheduleTab, setActiveScheduleTab] = useState("laboratoryTests");
  const [activeSpecialistTab, setActiveSpecialistTab] = useState(0);

  useEffect(() => {
    if (activeTab !== "medicalHistory" && activeScheduleTab !== "laboratoryTests") {
      setActiveScheduleTab("laboratoryTests");
    }
  }, [activeTab, activeScheduleTab]);
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
  // null = loading, "all" = unrestricted, Set = allowed doctor emails
  const [accessibleDoctorEmails, setAccessibleDoctorEmails] = useState(null);
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
    const currentTab = searchParams.get("tab");
    if (currentTab === activeTab) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", activeTab);
    setSearchParams(nextParams, { replace: true });
  }, [activeTab, searchParams, setSearchParams]);

  useEffect(() => {
    const tabFromUrl = searchParams.get("tab");
    const nextTab =
      tabFromUrl && allowedTabs.has(tabFromUrl) ? tabFromUrl : "patient";
    setActiveTab((prev) => (prev === nextTab ? prev : nextTab));
  }, [searchParams]);

  // Fetch the current assistant's accessible doctor emails
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const email = String(user?.email || "")
      .trim()
      .toLowerCase();
    const role = String(user?.role || "")
      .trim()
      .toLowerCase();

    // Non-assistant users are unrestricted here
    if (!email || role !== "assistant") {
      setAccessibleDoctorEmails("all");
      return;
    }

    getAssistantDoctors(email)
      .then((entries) => {
        const now = new Date();
        const normalizeAccessStatus = (status) =>
          String(status || "")
            .toLowerCase()
            .replace(/[_-]+/g, " ")
            .trim();

        const isDoctorAccessAllowed = (status) => {
          if (!status) return true;
          const normalized = normalizeAccessStatus(status);
          return [
            "accepted",
            "access granted",
            "granted",
            "approved",
            "active",
          ].includes(normalized);
        };

        const isWithinAccessWindow = (startDateTime, endDateTime) => {
          const start = startDateTime ? new Date(startDateTime) : null;
          const end = endDateTime ? new Date(endDateTime) : null;

          const startValid = !start || Number.isNaN(start.getTime()) || now >= start;
          const endValid = !end || Number.isNaN(end.getTime()) || now <= end;

          return startValid && endValid;
        };

        const emails = new Set(
          (entries || [])
            .filter(
              (e) =>
                isDoctorAccessAllowed(e?.status) &&
                isWithinAccessWindow(e?.startDateTime, e?.endDateTime),
            )
              .map((e) => String(e?.doctorEmail || "").trim().toLowerCase())
              .filter(Boolean),
        );
        console.log("[EDBookingAccess] assistant access fetched", {
          assistantEmail: email,
          role,
          totalEntries: Array.isArray(entries) ? entries.length : 0,
          allowedDoctorEmails: Array.from(emails),
          now: now.toISOString(),
          rawEntries: entries,
        });
        setAccessibleDoctorEmails(emails);
      })
      .catch((err) => {
        console.log("[EDBookingAccess] failed to fetch assistant doctors", {
          assistantEmail: email,
          role,
          error: err?.response?.data || err?.message || err,
        });
        setAccessibleDoctorEmails(new Set());
      });
  }, []);

  useEffect(() => {
    console.log("[EDBookingAccess] accessibleDoctorEmails state", {
      value:
        accessibleDoctorEmails === "all"
          ? "all"
          : accessibleDoctorEmails instanceof Set
            ? Array.from(accessibleDoctorEmails)
            : accessibleDoctorEmails,
      type:
        accessibleDoctorEmails === "all"
          ? "all"
          : accessibleDoctorEmails instanceof Set
            ? "set"
            : typeof accessibleDoctorEmails,
    });
  }, [accessibleDoctorEmails]);

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
      const listBooking = Array.isArray(list)
        ? list.find((b) => {
            const currentId = String(bookingId || "");
            return (
              String(b?._id || "") === currentId ||
              String(b?.invoiceNumber || "") === currentId ||
              String(b?.bookingNumber || "") === currentId ||
              String(b?.applicationId || "") === currentId
            );
          })
        : null;

      let fullBooking = null;
      if (bookingId) {
        try {
          fullBooking = await getEarlyDetectionBookingById(bookingId);
        } catch {
          fullBooking = null;
        }
      }

      const foundBooking = fullBooking || listBooking;

      if (foundBooking) {
        setBooking(foundBooking);

        const email =
          foundBooking?.patient?.email || foundBooking?.customer?.email || "";

        if (email) {
          try {
            const patRes = await getPatientByEmail(email);
            const fullPatient = patRes?.patient || patRes;
            if (
              fullPatient &&
              typeof fullPatient === "object" &&
              (fullPatient.firstName ||
                fullPatient.lastName ||
                fullPatient.email)
            ) {
              setPatientDetails(fullPatient);
            } else {
              setPatientDetails(null);
            }
          } catch {
            setPatientDetails(null);
          }
        } else {
          setPatientDetails(null);
        }

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
            `/early-detection/${bookingId}${window.location.search || ""}`,
          );
        }
      } else {
        setPatientDetails(null);
        toast.error(t("earlyDiagnosis.bookingNotFound"));
        navigate("/early-detection");
      }
    } catch (error) {
      setPatientDetails(null);
      toast.error(t("earlyDiagnosis.failedToLoadBooking"));
      navigate("/early-detection");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedBookingId) {
      setLoading(false);
      return;
    }

    loadBookingDetails(selectedBookingId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBookingId]);

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
      const list = Array.isArray(response?.data) ? response.data : [];
      setManagedTests((prev) => ({ ...prev, [section]: list }));
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load tests");
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

  const showSidebarTabs = ["history", "notes"].includes(activeTab);
  const isConclusionTabActive =
    activeTab === "medicalHistory" && activeScheduleTab === "conclusion";

  useEffect(() => {
    document.body.classList.add("hide-global-sidebar");
    return () => {
      document.body.classList.remove("hide-global-sidebar");
    };
  }, []);

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

  const getDoctorsForScheduleItem = (item) =>
    doctors.filter((doctor) =>
      doctorMatchesScheduleTitle(doctor, item?.title || ""),
    );

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
    if (typeof doctorValue === "object") {
      if (doctorValue?.email) return doctorValue;

      const byEmbeddedId = doctors.find(
        (d) => normalizeId(d?._id) === normalizeId(doctorValue?._id || doctorValue?.id),
      );
      if (byEmbeddedId) return byEmbeddedId;

      return doctorValue;
    }
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
    return String(
      doctorObj?.email ||
        (typeof doctorValue === "string" && doctorValue.includes("@")
          ? doctorValue
          : ""),
    )
      .trim()
      .toLowerCase();
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

  const getManagedTestTitle = (entry, section) => {
    const direct = readLocalizedName(entry?.item?.name);
    if (direct && direct !== "-") return direct;

    const itemId = normalizeId(entry?.item?._id || entry?.item);
    if (!itemId) return "-";

    const list = Array.isArray(managedTests?.[section])
      ? managedTests[section]
      : [];
    const matched = list.find((test) => normalizeId(test?._id) === itemId);
    return readLocalizedName(matched?.name);
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
      const res = await saveEarlyDetectionSpecialistHistoryForm(booking._id, idx, formData);
      toast.success(t("earlyDiagnosis.save", "Saved"));
      // Refresh booking + specialist forms from response so verified badge updates immediately
      const updatedBooking = res?.data?.data || res?.data;
      if (updatedBooking && updatedBooking._id) {
        setBooking(updatedBooking);
        const consultations = Array.isArray(updatedBooking?.schedule?.specialistConsultations)
          ? updatedBooking.schedule.specialistConsultations
          : [];
        const formsMap = {};
        consultations.forEach((c, i) => { formsMap[i] = c?.historyForm || {}; });
        setSpecialistForms(formsMap);
      }
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

  const resolvedPatient = (() => {
    const fetchedPatient = patientDetails;
    if (
      fetchedPatient &&
      typeof fetchedPatient === "object" &&
      !Array.isArray(fetchedPatient) &&
      Object.keys(fetchedPatient).length > 0
    ) {
      return fetchedPatient;
    }

    const patientCandidate = booking?.patient;
    if (
      patientCandidate &&
      typeof patientCandidate === "object" &&
      !Array.isArray(patientCandidate) &&
      Object.keys(patientCandidate).length > 0
    ) {
      return patientCandidate;
    }

    const customerCandidate = booking?.customer;
    if (
      customerCandidate &&
      typeof customerCandidate === "object" &&
      !Array.isArray(customerCandidate) &&
      Object.keys(customerCandidate).length > 0
    ) {
      return customerCandidate;
    }

    return {};
  })();

  const resolvedPatientId =
    normalizeId(resolvedPatient?._id) ||
    normalizeId(resolvedPatient?.id) ||
    normalizeId(patientDetails?._id) ||
    normalizeId(patientDetails?.id) ||
    normalizeId(booking?.patient?._id) ||
    normalizeId(booking?.patient);

  const patientForGeneralTab = {
    ...resolvedPatient,
    _id: resolvedPatientId || resolvedPatient?._id || resolvedPatient?.id,
    email:
      resolvedPatient?.email ||
      patientDetails?.email ||
      booking?.patient?.email ||
      booking?.customer?.email ||
      "",
  };

  const patientDisplayName =
    [
      patientForGeneralTab.firstName,
      patientForGeneralTab.middleName,
      patientForGeneralTab.lastName,
    ]
      .map(readNameField)
      .filter(Boolean)
      .join(" ")
      .trim() ||
    patientForGeneralTab.email ||
    "Unknown patient";

  const dobHeader = patientForGeneralTab?.dateOfBirth
    ? new Date(patientForGeneralTab.dateOfBirth).toLocaleDateString(
        i18n.language === "ru" ? "ru-RU" : "en-US",
        {
          month: "long",
          day: "numeric",
          year: "numeric",
        },
      )
    : null;

  return (
    <div className="booking-details-page edb-booking-details-page booking-details-page--compact">
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar />
      <div
        className="edb-tab-bar"
        role="tablist"
        aria-label="Booking details tabs"
      >
        <button
          type="button"
          className={`edb-tab ${activeTab === "patient" ? "active" : ""}`}
          data-label={t("earlyDiagnosis.patientInformation") || "Patient details"}
          onClick={() => setActiveTab("patient")}
        >
          <span className="edb-tab-icon">
            <User size={15} />
          </span>
          {t("earlyDiagnosis.patientInformation") || "Patient details"}
        </button>
        <button
          type="button"
          className={`edb-tab edb-tab--section ${activeTab === "appointmentDetails" ? "active" : ""}`}
          data-label={t("earlyDiagnosis.appointmentDetails") || "Appointment Details"}
          onClick={() => setActiveTab("appointmentDetails")}
        >
          <span className="edb-tab-icon">
            <Calendar size={15} />
          </span>
          {t("earlyDiagnosis.appointmentDetails") ||
            "Appointment Details"}
        </button>
        <button
          type="button"
          className={`edb-tab edb-tab--section ${activeTab === "medicalHistory" ? "active" : ""}`}
          data-label={t("earlyDiagnosis.medicalHistory") || "Medical History"}
          onClick={() => setActiveTab("medicalHistory")}
        >
          <span className="edb-tab-icon">
            <FileText size={15} />
          </span>
          {t("earlyDiagnosis.medicalHistory") || "Medical History"}
        </button>
        <button
          type="button"
          className={`edb-tab edb-tab--section ${activeTab === "history" ? "active" : ""}`}
          data-label={t("earlyDiagnosis.historyLogs") || "History"}
          onClick={() => setActiveTab("history")}
        >
          <span className="edb-tab-icon">
            <Clock size={15} />
          </span>
          {t("earlyDiagnosis.historyLogs") || "History"}
        </button>
        <button
          type="button"
          className={`edb-tab edb-tab--section ${activeTab === "notes" ? "active" : ""}`}
          data-label={t("earlyDiagnosis.internalNotes") || "Notes"}
          onClick={() => setActiveTab("notes")}
        >
          <span className="edb-tab-icon">
            <Edit2 size={15} />
          </span>
          {t("earlyDiagnosis.internalNotes") || "Notes"}
        </button>
      </div>
      <div className="adp-top-header">
        <button
          className="adp-back-btn"
          onClick={() => navigate("/early-detection")}
        >
          <ArrowLeft size={14} />
          <span>{t("earlyDiagnosis.backToSchedule", "Back to Schedule")}</span>
        </button>

        <div className="adp-header-divider" />

        <div className="adp-header-center">
          <div className="adp-header-name-row">
            <h1 className="adp-patient-title">
              {t("earlyDiagnosis.patientLabel", "Patient")}: <strong>{patientDisplayName}</strong>
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
            No.{booking.invoiceNumber || booking.bookingNumber} &nbsp;·&nbsp;
            {t("earlyDiagnosis.addedToSystemOn", "Added to system on")} {formatDate(booking.createdAt)}
          </span>
        </div>

        {dobHeader && (
          <div className="adp-header-right">
            <span className="adp-dob-value">{dobHeader}</span>
            <span className="adp-dob-label">{t("earlyDiagnosis.dateOfBirth", "Date of Birth")}</span>
          </div>
        )}
      </div>

      <div className="booking-details-content edb-booking-details-content">
        <div
          className={`ed-details-body edb-details-body${isConclusionTabActive ? " edb-details-body--conclusion-full ed-details-body--full-width" : ""}`}
        >


          <div
            className="booking-details-layout edb-booking-details-layout booking-details-layout--single"
          >
            {/* Left Column */}
            {!showSidebarTabs && (
              <div
                className={`booking-details-main edb-booking-details-main${isConclusionTabActive ? " edb-booking-details-main--conclusion-full" : ""}`}
              >
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
                  <div className="edb-patient-tab-content">
                    <GeneralInformationTab
                      application={{
                        createdAt: booking.createdAt,
                        applicationId:
                          booking.invoiceNumber || booking.bookingNumber,
                      }}
                      patient={patientForGeneralTab}
                    />
                  </div>
                )}

                {activeTab === "appointmentDetails" && (
                  <>
                    {/* Appointment Details */}
                    <div className="detail-section ed-medical-history-section">
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
                                                    dateFormat="yyyy-MM-dd"
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
                  <>
                    <div className="ed-medical-history-layout">
                      <aside className="ed-medical-history-sidebar">
                        <div className="ed-schedule-tabs ed-schedule-tabs--vertical">
                        {[
                          [
                            "laboratoryTests",
                            t(
                              "earlyDiagnosis.laboratoryTests",
                              "Laboratory analysis",
                            ),
                          ],
                          [
                            "instrumentalAnalysis",
                            t(
                              "earlyDiagnosis.instrumentalAnalysis",
                              "Исследования/манипуляции",
                            ),
                          ],
                          [
                            "morphologicalResearch",
                            t(
                              "earlyDiagnosis.morphologicalResearch",
                              "Morphological research",
                            ),
                          ],
                          [
                            "proceduresAndManipulations",
                            t(
                              "earlyDiagnosis.proceduresAndManipulations",
                              "Procedures and manipulations",
                            ),
                          ],
                          [
                            "specialistConsultation",
                            t(
                              "earlyDiagnosis.specialistConsultation",
                              "Specialist Consultation",
                            ),
                          ],
                          [
                            "conclusion",
                            t(
                              "earlyDiagnosis.conclusion",
                              "Conclusion",
                            ),
                          ],
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
                                title={t(
                                  "earlyDiagnosis.manageTests",
                                  "Manage tests",
                                )}
                              >
                                <Settings size={14} />
                              </span>
                            )}
                          </button>
                        ))}
                        </div>
                      </aside>

                      <div className="ed-medical-history-content">
                        <div className="detail-section">

                      {activeScheduleTab === "laboratoryTests" && (
                        <div className="ed-schedule-section-list">
                          <div className="ed-section-actions-row">
                            <button
                              type="button"
                              className="ed-upload-btn"
                              onClick={() =>
                                openUploadSectionModal("laboratoryTests")
                              }
                            >
                              {t("earlyDiagnosis.uploadFile", "Upload file")}
                            </button>
                          </div>
                          {(booking?.schedule?.laboratoryTests || []).length ===
                          0 ? (
                            <div className="ed-schedule-empty">
                              {t("earlyDiagnosis.noFiles", "No files")}
                            </div>
                          ) : (
                            (booking?.schedule?.laboratoryTests || []).map(
                              (entry, index) => (
                                <div
                                  className="ed-section-card ed-test-card"
                                  key={entry?._id || `lab-${index}`}
                                >
                                  <div className="ed-test-card-head">
                                    <div className="ed-test-icon-wrap">
                                      <FileText size={18} />
                                    </div>
                                    <div className="ed-test-head-main">
                                      <div className="ed-section-title">
                                        {getManagedTestTitle(
                                          entry,
                                          "laboratoryTests",
                                        )}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      className="ed-test-more-btn"
                                      aria-label="More"
                                    >
                                      <MoreVertical size={16} />
                                    </button>
                                  </div>

                                  {Array.isArray(entry?.files) &&
                                    entry.files.length > 0 && (
                                      <ul className="ed-files-list ed-test-files-list">
                                        {entry.files.map((file, fileIndex) => (
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
                                                {getFileExtension(
                                                  file,
                                                ).toUpperCase()}
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
                                                  href={getSectionFileUrl(
                                                    file,
                                                    false,
                                                  )}
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
                                              {getSectionFileUrl(
                                                file,
                                                true,
                                              ) && (
                                                <a
                                                  href={getSectionFileUrl(
                                                    file,
                                                    true,
                                                  )}
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
                                    )}
                                </div>
                              ),
                            )
                          )}
                        </div>
                      )}

                      {activeScheduleTab === "instrumentalAnalysis" && (
                        <div className="ed-schedule-section-list">
                          <div className="ed-section-actions-row">
                            <button
                              type="button"
                              className="ed-upload-btn"
                              onClick={() =>
                                openUploadSectionModal("instrumentalAnalysis")
                              }
                            >
                              {t("earlyDiagnosis.uploadFile", "Upload file")}
                            </button>
                          </div>
                          {(booking?.schedule?.instrumentalAnalysis || [])
                            .length === 0 ? (
                            <div className="ed-schedule-empty">
                              {t("earlyDiagnosis.noFiles", "No files")}
                            </div>
                          ) : (
                            (booking?.schedule?.instrumentalAnalysis || []).map(
                              (entry, index) => (
                                <div
                                  className="ed-section-card ed-test-card"
                                  key={entry?._id || `inst-${index}`}
                                >
                                  <div className="ed-test-card-head">
                                    <div className="ed-test-icon-wrap">
                                      <FileText size={18} />
                                    </div>
                                    <div className="ed-test-head-main">
                                      <div className="ed-section-title">
                                        {getManagedTestTitle(
                                          entry,
                                          "instrumentalAnalysis",
                                        )}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      className="ed-test-more-btn"
                                      aria-label="More"
                                    >
                                      <MoreVertical size={16} />
                                    </button>
                                  </div>

                                  {Array.isArray(entry?.files) &&
                                    entry.files.length > 0 && (
                                      <ul className="ed-files-list ed-test-files-list">
                                        {entry.files.map((file, fileIndex) => (
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
                                                {getFileExtension(
                                                  file,
                                                ).toUpperCase()}
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
                                                  href={getSectionFileUrl(
                                                    file,
                                                    false,
                                                  )}
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
                                              {getSectionFileUrl(
                                                file,
                                                true,
                                              ) && (
                                                <a
                                                  href={getSectionFileUrl(
                                                    file,
                                                    true,
                                                  )}
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
                                    )}
                                </div>
                              ),
                            )
                          )}
                        </div>
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

                      {activeScheduleTab === "specialistConsultation" && (
                        <div className="detail-section">
                          <div className="ed-schedule-tabs ed-specialist-tabs">
                            {Array.isArray(
                              booking?.schedule?.specialistConsultations,
                            )
                              ? booking.schedule.specialistConsultations.map(
                                  (s, i) => {
                                    const tabDoctorEmail = resolveDoctorEmail(
                                      s?.doctor,
                                    );
                                    const tabCanEdit =
                                      !!tabDoctorEmail &&
                                      (accessibleDoctorEmails === "all" ||
                                        (accessibleDoctorEmails instanceof Set &&
                                          accessibleDoctorEmails.has(
                                            tabDoctorEmail,
                                          )));
                                    console.log("[EDBookingAccess] specialist tab decision", {
                                      index: i,
                                      title: s?.title,
                                      doctorRef: s?.doctor,
                                      resolvedDoctorEmail: tabDoctorEmail,
                                      accessibleDoctorEmails:
                                        accessibleDoctorEmails === "all"
                                          ? "all"
                                          : accessibleDoctorEmails instanceof Set
                                            ? Array.from(accessibleDoctorEmails)
                                            : accessibleDoctorEmails,
                                      tabCanEdit,
                                    });
                                    return (
                                      <button
                                        key={`specialist_${i}`}
                                        type="button"
                                        className={`ed-schedule-tab-btn ${
                                          activeSpecialistTab === i
                                            ? "active"
                                            : ""
                                        }${!tabCanEdit ? " ed-specialist-tab-locked" : ""}`}
                                        onClick={() =>
                                          setActiveSpecialistTab(i)
                                        }
                                        title={
                                          !tabCanEdit
                                            ? t(
                                                "earlyDiagnosis.viewOnlyNoEditAccess",
                                                "View Only — you do not have edit access for this doctor",
                                              )
                                            : undefined
                                        }
                                      >
                                        <span>
                                          {s?.title
                                            ? t(
                                                `earlyDiagnosis.specialist_${normalizeSpecialistTitle(s.title)}`,
                                                s.title,
                                              )
                                            : `Specialist ${i + 1}`}
                                        </span>
                                        {!tabCanEdit && (
                                          <Lock
                                            size={10}
                                            className="ed-specialist-lock-icon"
                                          />
                                        )}
                                      </button>
                                    );
                                  },
                                )
                              : null}
                          </div>

                          {activeSpecialistTab !== null &&
                            (() => {
                              const specialist =
                                booking?.schedule?.specialistConsultations?.[
                                  activeSpecialistTab
                                ];
                              if (!specialist) return null;
                              const specialistDoctorEmail = String(
                                resolveDoctorEmail(specialist?.doctor) || "",
                              );
                              const canEdit =
                                !!specialistDoctorEmail &&
                                (accessibleDoctorEmails === "all" ||
                                  (accessibleDoctorEmails instanceof Set &&
                                    accessibleDoctorEmails.has(
                                      specialistDoctorEmail,
                                    )));
                              return (
                                <div className="ed-specialist-consultation-wrapper">
                                  <div className="ed-specialist-type-header">
                                    <span className="ed-specialist-type-name">
                                      {specialist.title
                                        ? t(
                                            `earlyDiagnosis.specialist_${normalizeSpecialistTitle(specialist.title)}`,
                                            specialist.title,
                                          )
                                        : specialist.title}
                                    </span>
                                  </div>
                                  <SpecialistHistoryForm
                                    key={`specialist_form_${activeSpecialistTab}`}
                                    specialistTitle={
                                      specialist.title
                                        ? t(
                                            `earlyDiagnosis.specialist_${normalizeSpecialistTitle(specialist.title)}`,
                                            specialist.title,
                                          )
                                        : specialist.title
                                    }
                                    historyForm={
                                      specialistForms[activeSpecialistTab] ||
                                      specialist.historyForm ||
                                      {}
                                    }
                                    isSaving={
                                      !!specialistFormSaving[activeSpecialistTab]
                                    }
                                    readOnly={!canEdit}
                                    onSave={(formData) =>
                                      handleSaveSpecialistForm(
                                        activeSpecialistTab,
                                        formData,
                                      )
                                    }
                                  />
                                </div>
                              );
                            })()}
                        </div>
                      )}

                      {activeScheduleTab === "conclusion" && (
                        <div className="ed-schedule-section-list ed-conclusion-report-tab">
                          <EarlyDetectionReportTab booking={booking} />
                        </div>
                      )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Right Column */}
            {showSidebarTabs && (
              <div className="booking-details-sidebar booking-details-sidebar--full">
                {/* Payment Summary */}
                {false && activeTab === "payments" && (
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
                                  handleGeneratePaymentLink();
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

                    {/* Payment Links Table — shows paymentLinks + paymentHistory fallback */}
                    {(() => {
                      const linkRows = booking.payment?.paymentLinks || [];
                      // Fallback: build rows from paymentHistory for old/manual records not in paymentLinks
                      const historyRows = (booking.paymentHistory || [])
                        .filter(
                          (h) =>
                            !linkRows.some(
                              (l) => l.paymentId === h.transactionId,
                            ),
                        )
                        .map((h, i) => ({
                          paymentId: h.transactionId || `hist-${i}`,
                          orderId: booking.invoiceNumber || "",
                          paymentUrl: "",
                          amount:
                            (booking.totalAmount ||
                              booking.package?.price ||
                              0) * 100,
                          status: h.status,
                          createdAt: h.changedAt,
                          notes: h.notes,
                          isHistory: true,
                        }));

                      // Fallback: synthesize a row from payment.tbank / payment.paymentLink
                      // when paymentLinks array is empty but a payment link exists
                      const tbankFallback = [];
                      if (
                        linkRows.length === 0 &&
                        historyRows.length === 0 &&
                        (booking.payment?.paymentLink ||
                          booking.payment?.tbank?.paymentId ||
                          booking.payment?.transactionId)
                      ) {
                        tbankFallback.push({
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
                          notes: "",
                          isTbankFallback: true,
                        });
                      }

                      const tableRows = [
                        ...linkRows,
                        ...historyRows,
                        ...tbankFallback,
                      ];
                      if (tableRows.length === 0) return null;
                      return (
                        <div className="payment-links-table">
                          <table>
                            <thead>
                              <tr>
                                <th>{t("earlyDiagnosis.created")}</th>
                                <th>{t("earlyDiagnosis.amount")}</th>
                                <th>{t("earlyDiagnosis.status")}</th>
                                <th>{t("earlyDiagnosis.actions")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tableRows.map((link, index) => {
                                const isEditingThis =
                                  editingRowId === (link.paymentId || index);
                                const hasUrl = !!link.paymentUrl;
                                return (
                                  <tr key={link.paymentId || index}>
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
                                      {(
                                        (link.amount || 0) / 100
                                      ).toLocaleString()}{" "}
                                      ₽
                                    </td>
                                    <td>
                                      {isEditingThis ? (
                                        <select
                                          value={editingRowStatus}
                                          onChange={(e) =>
                                            setEditingRowStatus(e.target.value)
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
                                          <button
                                            onClick={() =>
                                              handleRowEditSave(link)
                                            }
                                            className="action-btn save-row-btn"
                                            title="Save"
                                          >
                                            <Save size={14} />
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() => {
                                              setEditingRowId(
                                                link.paymentId || index,
                                              );
                                              setEditingRowStatus(
                                                link.status || "pending",
                                              );
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
                  <div className="sidebar-section edb-history-section">
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
                  <div className="sidebar-section edb-notes-section">
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
