import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CheckCircle,
  Clock,
  Trash2,
  FileText,
  Plus,
  Eye,
  Download,
  Pencil,
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
  fetchEarlyDetectionScheduleFile,
  getEarlyDetectionScheduleFileUrl,
  addEarlyDetectionTestEntryNote,
  updateEarlyDetectionTestEntryNote,
  deleteEarlyDetectionTestEntryNote,
  saveEarlyDetectionSpecialistHistoryForm,
  getPatientByEmail,
  getEarlyDetectionBookingById,
  getAssistantDoctors,
} from "../utils/api";
import GeneralInformationTab from "./AppointmentDetails/GeneralInformationTab";
import "../styles/EarlyDetectionBookingDetails.css";
import "./AppointmentDetailsPage.css";
import EDHeader from "../components/EarlyDetection/EDHeader";
import EDTabBar from "../components/EarlyDetection/EDTabBar";
import EDMedicalSubnav from "../components/EarlyDetection/EDMedicalSubnav";
import EDMedicalHistoryContent from "../components/EarlyDetection/EDMedicalHistoryContent";
import EDScheduleTab from "../components/EarlyDetection/EDScheduleTab";
import EDHistoryNotesTab from "../components/EarlyDetection/EDHistoryNotesTab";
import EDModals from "../components/EarlyDetection/EDModals";

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
  const [activeTestId, setActiveTestId] = useState(null);
  const [showTestNoteEditor, setShowTestNoteEditor] = useState(false);
  const [testNoteDraft, setTestNoteDraft] = useState("");
  const [editingTestNoteId, setEditingTestNoteId] = useState(null);
  const [isSavingTestNote, setIsSavingTestNote] = useState(false);
  const [activeSpecialistTab, setActiveSpecialistTab] = useState(0);
  const [specialistAccordionOpen, setSpecialistAccordionOpen] = useState(true);
  const [managedAccordion, setManagedAccordion] = useState({});
  const [navExpanded, setNavExpanded] = useState(false);

  useEffect(() => {
    if (activeTab !== "medicalHistory" && activeScheduleTab !== "laboratoryTests") {
      setActiveScheduleTab("laboratoryTests");
      setActiveTestId(null);
    }
  }, [activeTab]);
  const [editedScheduleItems, setEditedScheduleItems] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [managedTests, setManagedTests] = useState({
    laboratoryTests: [],
    instrumentalAnalysis: [],
    morphologicalResearch: [],
    proceduresAndManipulations: [],
  });
  const managedSectionTabs = ["laboratoryTests", "instrumentalAnalysis"];
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
    loadManagedTests("morphologicalResearch");
    loadManagedTests("proceduresAndManipulations");
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
      const list = Array.isArray(response?.data?.data)
        ? response.data.data
        : Array.isArray(response?.data)
          ? response.data
          : [];
      setManagedTests((prev) => ({ ...prev, [section]: list }));
      return list;
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load tests");
      return [];
    }
  };

  const openTestSettingsModal = async (section) => {
    setSettingsSection(section);
    setEditingManagedTestId("");
    setTestDraft({ en: "", ru: "" });
    try {
      await loadManagedTests(section);
    } catch (err) {
      // loadManagedTests will show toast on error
    }
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
      let savedTest = null;
      if (editingManagedTestId) {
        await updateEarlyDetectionManagedTest(
          settingsSection,
          editingManagedTestId,
          {
            name: { en: nameEn, ru: nameRu },
          },
        );
        // refresh list after update
        await loadManagedTests(settingsSection);
      } else {
        const res = await createEarlyDetectionManagedTest(settingsSection, {
          name: { en: nameEn, ru: nameRu },
        });
        savedTest = res?.data?.data || res?.data || res;
        // reload list from server to ensure IDs and ordering are correct
        const fresh = await loadManagedTests(settingsSection);
        // if upload modal is open, refresh its tests too if it's for the same section
        if (showUploadModal && uploadSection === settingsSection) {
          // state should already be updated by loadManagedTests above
          // set auto-select the newly created test
          const createdId = normalizeId(savedTest?._id) || normalizeId(savedTest?.id);
          let pickId = createdId;
          if (!pickId && Array.isArray(fresh) && fresh.length > 0) {
            pickId = normalizeId(fresh[fresh.length - 1]?._id || fresh[fresh.length - 1]?.id);
          }
          if (pickId) {
            setUploadItemId(pickId);
          }
        } else if (showUploadModal && uploadSection !== settingsSection) {
          // If upload modal is for a different section, also refresh that section's tests
          await loadManagedTests(uploadSection);
        }
      }

      setEditingManagedTestId("");
      setTestDraft({ en: "", ru: "" });
      // close settings modal after save
      setShowTestSettingsModal(false);

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



  const formatFileSize = (file) => {
    const bytes = Number(file?.size || file?.fileSize || file?.length || 0);
    if (!bytes || Number.isNaN(bytes)) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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
      setBooking(bookingData);
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
            <div className="ed-test-detail-header">
              <h2 className="ed-test-detail-title">{readLocalizedName(selectedTest?.name)}</h2>
            </div>

            <div className="ed-test-detail-actions">
              <button
                type="button"
                className="ed-td-btn"
                onClick={() => {
                  setUploadSection(section);
                  setUploadItemId(activeTestId);
                  setUploadFiles([]);
                  setShowUploadModal(true);
                }}
              >
                <Plus size={14} />
                {t("earlyDiagnosis.uploadFile", "Upload file")}
              </button>
              <button
                type="button"
                className="ed-td-btn"
                onClick={() => {
                  setShowTestNoteEditor(true);
                  setEditingTestNoteId(null);
                  setTestNoteDraft("");
                }}
              >
                <FileText size={14} />
                {t("earlyDiagnosis.addText", "Add text")}
              </button>
            </div>

            <div className="ed-td-list">
              {selectedFiles.length === 0 ? (
                <div className="ed-td-empty">{t("earlyDiagnosis.noFiles", "No files")}</div>
              ) : (
                selectedFiles.map((file, fileIndex) => {
                  const entry = selectedEntries.find((item) => (item?.files || []).some((entryFile) => normalizeId(entryFile?.fileId) === normalizeId(file?.fileId) || normalizeId(entryFile?._id) === normalizeId(file?._id)));
                  const entryId = entry?._id || selectedEntries[0]?._id;
                  return (
                    <div key={normalizeId(file?.fileId) || file?._id || fileIndex} className="ed-td-item">
                      <span className={`ed-td-badge ed-td-badge--${getFileExtension(file)}`}>{getFileExtension(file).toUpperCase()}</span>
                      <div className="ed-td-item-info">
                        <span className="ed-td-item-name">{getFileLabel(file)}</span>
                        <span className="ed-td-item-meta">
                          <Clock size={11} />
                          {formatDateTime(file?.uploadedAt || file?.createdAt || file?.date)}
                        </span>
                      </div>
                      <div className="ed-td-item-actions">
                        {renderFileActionButtons(file)}
                        <button
                          type="button"
                          className="ed-td-icon-btn ed-td-icon-btn--delete"
                          title={t("earlyDiagnosis.delete", "Delete")}
                          onClick={() => handleDeleteSelectedTestFile(section, entryId, file)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}

              {!selectedNotes.length && !showTestNoteEditor ? (
                <div className="ed-td-empty">{t("earlyDiagnosis.noEntries", "No entries yet")}</div>
              ) : null}

              {selectedNotes.map((note) => (
                <div key={String(note._id)} className="ed-td-item ed-td-item--note">
                  <span className="ed-td-note-icon"><FileText size={18} /></span>
                  <div className="ed-td-item-info">
                    <div className="ed-td-item-name" dangerouslySetInnerHTML={{ __html: note.content }} />
                    <span className="ed-td-item-meta"><Clock size={11} />{formatDateTime(note?.createdAt)}</span>
                  </div>
                  <div className="ed-td-item-actions">
                    <button
                      type="button"
                      className="ed-td-icon-btn"
                      onClick={() => {
                        setEditingTestNoteId(note._id);
                        setTestNoteDraft(note.content || "");
                        setShowTestNoteEditor(true);
                      }}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      className="ed-td-icon-btn ed-td-icon-btn--delete"
                      onClick={() => handleDeleteTestNote(section, note.entryId || selectedEntries[0]?._id, note._id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {noteEditorVisible && (
              <div className="ed-td-note-editor">
                <RichTextEditor
                  value={testNoteDraft}
                  onChange={setTestNoteDraft}
                  placeholder={t("history_tab.enter_text", "Enter text…")}
                />
                <div className="ed-td-note-editor-actions">
                  <button
                    type="button"
                    className="ed-td-save-btn"
                    disabled={isSavingTestNote || !String(testNoteDraft || "").trim()}
                    onClick={() => handleSaveTestNote(section, activeTestId)}
                  >
                    {isSavingTestNote ? t("earlyDiagnosis.saving", "Saving…") : t("earlyDiagnosis.save", "Save")}
                  </button>
                  <button
                    type="button"
                    className="ed-td-cancel-btn"
                    onClick={() => {
                      setShowTestNoteEditor(false);
                      setTestNoteDraft("");
                      setEditingTestNoteId(null);
                    }}
                  >
                    {t("earlyDiagnosis.cancel", "Cancel")}
                  </button>
                </div>
              </div>
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

  const patientGender = patientForGeneralTab?.gender || null;
  const patientAge = (() => {
    const dob = patientForGeneralTab?.dateOfBirth;
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
    <div className={`booking-details-page edb-booking-details-page booking-details-page--compact${navExpanded ? " edb-nav-expanded" : ""}`}>
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar />
      <EDHeader
        booking={booking}
        patientDisplayName={patientDisplayName}
        dobHeader={dobHeader}
        formatDate={formatDate}
        patientGender={patientGender}
        patientAge={patientAge}
      />

      <div className="booking-details-content edb-booking-details-content">
        <EDTabBar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          navExpanded={navExpanded}
          setNavExpanded={setNavExpanded}
        />
        <div
          className={`ed-details-body edb-details-body`}
        >


          <div
            className="booking-details-layout edb-booking-details-layout booking-details-layout--single"
          >
            {/* Left Column */}
            {!showSidebarTabs && (
              <div
                className={`booking-details-main edb-booking-details-main`}
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
                  <EDScheduleTab
                    isEditing={isEditing}
                    groupedSchedule={groupedSchedule}
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
                  <div className="ed-medical-history-layout">
                    <EDMedicalSubnav
                      booking={booking}
                      navExpanded={navExpanded}
                      activeScheduleTab={activeScheduleTab}
                      setActiveScheduleTab={setActiveScheduleTab}
                      activeTestId={activeTestId}
                      setActiveTestId={setActiveTestId}
                      managedTests={managedTests}
                      managedSectionTabs={managedSectionTabs}
                      specialistAccordionOpen={specialistAccordionOpen}
                      setSpecialistAccordionOpen={setSpecialistAccordionOpen}
                      activeSpecialistTab={activeSpecialistTab}
                      setActiveSpecialistTab={setActiveSpecialistTab}
                      openTestSettingsModal={openTestSettingsModal}
                      normalizeId={normalizeId}
                      normalizeSpecialistTitle={normalizeSpecialistTitle}
                      readLocalizedName={readLocalizedName}
                      getManagedTestEntries={getManagedTestEntries}
                      setShowTestNoteEditor={setShowTestNoteEditor}
                      setTestNoteDraft={setTestNoteDraft}
                      setEditingTestNoteId={setEditingTestNoteId}
                    />
                    <EDMedicalHistoryContent
                      booking={booking}
                      activeScheduleTab={activeScheduleTab}
                      activeSpecialistTab={activeSpecialistTab}
                      managedSectionTabs={managedSectionTabs}
                      renderManagedTestSection={renderManagedTestSection}
                      renderFileActionButtons={renderFileActionButtons}
                      sectionEditors={sectionEditors}
                      updateSectionEditor={updateSectionEditor}
                      handleSaveManagedSectionComment={handleSaveManagedSectionComment}
                      openUploadSectionModal={openUploadSectionModal}
                      normalizeId={normalizeId}
                      normalizeSpecialistTitle={normalizeSpecialistTitle}
                      getFileExtension={getFileExtension}
                      getFileLabel={getFileLabel}
                      formatFileSize={formatFileSize}
                      formatDateTime={formatDateTime}
                      accessibleDoctorEmails={accessibleDoctorEmails}
                      resolveDoctorEmail={resolveDoctorEmail}
                      specialistForms={specialistForms}
                      specialistFormSaving={specialistFormSaving}
                      handleSaveSpecialistForm={handleSaveSpecialistForm}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Right Column */}
            {showSidebarTabs && (
              <div className="booking-details-sidebar booking-details-sidebar--full">
                {/* Payment Summary */}

                {/* History & Logs */}
                <EDHistoryNotesTab
                  activeTab={activeTab}
                  booking={booking}
                  formatDate={formatDate}
                  formatDateTime={formatDateTime}
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
