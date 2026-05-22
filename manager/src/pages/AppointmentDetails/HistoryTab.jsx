import React, { useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { FiChevronDown, FiSearch, FiSettings, FiEdit2, FiTrash2, FiEye, FiUpload, FiFileText, FiClock, FiX, FiPlus } from "react-icons/fi";
import { Download } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  updateHistoryFieldVerify,
  getHistoryTemplates,
  createHistoryTemplate,
  updateHistoryTemplate,
  deleteHistoryTemplate,
  getApplicationsByPatientId,
  getApplication,
  getAllApplicationLaboratoryTests,
  createApplicationLaboratoryTest,
  updateApplicationLaboratoryTest,
  deleteApplicationLaboratoryTest,
  uploadApplicationLaboratoryTestFile,
  removeApplicationLaboratoryTestFile,
  fetchApplicationLaboratoryTestFile,
  addApplicationLaboratoryTestNote,
  updateApplicationLaboratoryTestNote,
  deleteApplicationLaboratoryTestNote,
  getAllApplicationInstrumentalAnalysis,
  createApplicationInstrumentalAnalysis,
  updateApplicationInstrumentalAnalysis,
  deleteApplicationInstrumentalAnalysis,
  uploadApplicationInstrumentalAnalysisFile,
  removeApplicationInstrumentalAnalysisFile,
  fetchApplicationInstrumentalAnalysisFile,
  addApplicationInstrumentalAnalysisNote,
  updateApplicationInstrumentalAnalysisNote,
  deleteApplicationInstrumentalAnalysisNote,
  getPatientSection,
  uploadPatientSectionFile,
  removePatientSectionFile,
  updatePatientSectionComment,
  updateHistoryForm,
} from "../../utils/api";
import RichTextEditor from "../../components/RichTextEditor/RichTextEditor";
import TemplatePicker from "../../components/RichTextEditor/TemplatePicker";
import AppointmentReport from "../AppointmentReport";
import "./HistoryTab.css";

const SECTION_RU_LABELS = {
  morphologicalResearch: "Морфологическое исследование",
  proceduresManipulations: "Процедуры и манипуляции",
};

const CLINIC_INFO_MGR = {
  name: "Медицинский центр «СОФОС»",
  phone: "+7-495-324-11-11",
  website: "www.sophos-med.ru",
  address: "ООО «ЭЙЧДИ КЛИНИК» · Бизнес-центр 'Квартал West' · Аминьевское Шоссе, 6, Москва, 119517",
  email: "contact@sophos-med.ru",
};

function SectionPDFModal({ title, commentHtml, files, application, patient, onClose }) {
  const reportRef = useRef(null);
  const [generating, setGenerating] = useState(false);

  const bookingNum = application?.applicationId || application?._id || "report";

  const handleDownload = async () => {
    if (!reportRef.current) return;
    setGenerating(true);
    try {
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const A4_W_MM = 210, A4_H_MM = 297;
      const SCALE = 2;
      const PAGE_H_PX = 1123;
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
          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = srcH;
          const ctx = sliceCanvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
          const sliceH_mm = (srcH / canvasPageH) * A4_H_MM;
          pdf.addImage(sliceCanvas.toDataURL("image/jpeg", 0.98), "JPEG", 0, 0, A4_W_MM, sliceH_mm);
        }
      }
      pdf.save(`section_${bookingNum}.pdf`);
    } finally {
      setGenerating(false);
    }
  };

  return createPortal(
    <div className="ht-spdf-overlay" onClick={onClose}>
      <div className="ht-spdf-container" onClick={(e) => e.stopPropagation()}>
        <div className="ht-spdf-toolbar">
          <button className="ht-spdf-download-btn" onClick={handleDownload} disabled={generating}>
            <Download size={14} />
            {generating ? "Генерация..." : "Скачать PDF"}
          </button>
          <button className="ht-spdf-close-btn" onClick={onClose} aria-label="Close">
            <FiX size={18} />
          </button>
        </div>
        <div className="ht-spdf-preview">
          <div ref={reportRef} className="ed-report-doc">
            <div className="ed-page">
              <div className="ed-page-header">
                <img src="/logo_ru.png" alt="Logo" className="ed-header-logo" />
                <div className="ed-header-clinic">
                  <span className="ed-header-clinic-name">{CLINIC_INFO_MGR.name}</span>
                  <span className="ed-header-clinic-contact">{CLINIC_INFO_MGR.phone} &nbsp;|&nbsp; {CLINIC_INFO_MGR.website}</span>
                </div>
              </div>
              <hr className="ed-header-line" />
              <div className="ed-conclusions-body">
                <div className="ed-field-title" style={{ marginBottom: 16 }}>{title}</div>
                <div className="ed-section-content-text" dangerouslySetInnerHTML={{ __html: commentHtml || "<p>—</p>" }} />
              </div>
              <div className="ed-page-footer">
                <span>{CLINIC_INFO_MGR.address}</span>
                <span>тел: <strong>{CLINIC_INFO_MGR.phone}</strong> &nbsp;|&nbsp; Почта: {CLINIC_INFO_MGR.email} &nbsp;|&nbsp; <strong>{CLINIC_INFO_MGR.website}</strong></span>
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

const HISTORY_SECTIONS = [
  /* 1 */
  {
    id: "complaints",
    titleKey: "sections.complaints",
    fields: [{ key: "complaints" }],
  },
  /* 2 */
  {
    id: "anamnesisMorbi",
    titleKey: "sections.anamnesisMorbi",
    fields: [{ key: "anamnesisMorbi" }],
  },
  /* 3 */
  {
    id: "anamnesisVitae",
    titleKey: "sections.anamnesisVitae",
    fields: [{ key: "anamnesisVitae" }],
  },
  /* 4 */
  {
    id: "physicalExam",
    titleKey: "sections.physicalExam",
    fields: [{ key: "physicalExam" }],
    subsections: [
      {
        id: "respiratory",
        titleKey: "subsections.respiratory",
        fields: [{ key: "respiratory" }],
      },
      {
        id: "circulatory",
        titleKey: "subsections.circulatory",
        fields: [{ key: "circulatory" }],
      },
      {
        id: "digestive",
        titleKey: "subsections.digestive",
        fields: [{ key: "digestive" }],
      },
      {
        id: "urinary",
        titleKey: "subsections.urinary",
        fields: [{ key: "urinary" }],
      },
      {
        id: "endocrine",
        titleKey: "subsections.endocrine",
        fields: [{ key: "endocrine" }],
      },
    ],
  },
  /* 5 */
  {
    id: "preliminaryDiagnosis",
    titleKey: "sections.preliminaryDiagnosis",
    fields: [{ key: "preliminaryDiagnosis" }],
  },
  /* 6 */
  {
    id: "examinationPlan",
    titleKey: "sections.examinationPlan",
    fields: [{ key: "examinationPlan" }],
  },
  /* 7 */
  {
    id: "examinationResults",
    titleKey: "sections.examinationResults",
    fields: [{ key: "examinationResults" }],
  },
  /* 8 */
  {
    id: "clinicalDiagnosis",
    titleKey: "sections.clinicalDiagnosis",
    fields: [{ key: "clinicalDiagnosis" }],
  },
  /* 9 */
  {
    id: "treatmentPlan",
    titleKey: "sections.treatmentPlan",
    fields: [{ key: "treatmentPlan" }],
  },
];

/* ── Collect every field key from the schema ── */
const collectKeys = (sections) => {
  const keys = [];
  sections.forEach((s) => {
    s.fields?.forEach((f) => keys.push(f.key));
    if (s.subsections) keys.push(...collectKeys(s.subsections));
  });
  return keys;
};

const ALL_KEYS = collectKeys(HISTORY_SECTIONS);

/* ── Map each field key → its i18n title key ── */
const KEY_TITLE_MAP = {};
(function buildMap(sections) {
  sections.forEach((s) => {
    s.fields?.forEach((f) => { KEY_TITLE_MAP[f.key] = s.titleKey; });
    if (s.subsections) buildMap(s.subsections);
  });
}(HISTORY_SECTIONS));

const HISTORY_NAV_ITEMS = [
  { id: "specialistConsultation", labelKey: "sidebar.specialistConsultation", sectionId: "complaints" },
  { id: "laboratoryAnalysis", labelKey: "sidebar.laboratoryAnalysis", sectionId: "examinationPlan" },
  { id: "studiesManipulations", labelKey: "sidebar.studiesManipulations", sectionId: "physicalExam" },
  { id: "morphologicalResearch", labelKey: "sidebar.morphologicalResearch", sectionId: "examinationResults" },
  { id: "proceduresManipulations", labelKey: "sidebar.proceduresManipulations", sectionId: "treatmentPlan" },
];


const RichTextField = React.memo(({ label, value, editing, onToggle, onChange, placeholder, emptyPlaceholder, templatePicker }) => (
  <div className={`ht-field${editing ? " ht-field--editing" : ""}`} data-ht-field>
    {label && (
      <div className="ht-field-header" onClick={onToggle}>
        <label className="ht-field-label">{label}</label>
        <div className="ht-field-actions">
          {templatePicker}
          <span className={`ht-field-toggle ${editing ? "ht-field-toggle--active" : ""}`}>
            {editing ? "✕" : "✎"}
          </span>
        </div>
      </div>
    )}
    {editing ? (
      <div className="ht-field-body">
        <RichTextEditor
          value={value}
          onChange={onChange}
          placeholder={placeholder}
        />
      </div>
    ) : (
      <div
        data-ht-field
        className={`ht-preview${!value ? " ht-preview--empty" : ""}`}
        onClick={onToggle}
        dangerouslySetInnerHTML={{ __html: value || `<span class='ht-preview-placeholder'>${emptyPlaceholder}</span>` }}
      />
    )}
  </div>
));

/* ================================================================
   HistoryTab component
   ================================================================ */
   
const HistoryTab = forwardRef(({ application, patient, onHistoryFormSaved }, ref) => {
  const { t } = useTranslation("history_tab");

  /* Initialise from application.historyForm (per-appointment), fallback to patient.historyForm */
  const initForm = () => {
    const saved = application?.historyForm || patient?.historyForm || {};
    const form = {
      isFirstAppointment: application?.isFirstAppointment ?? false,
      isRepetitiveAppointment: application?.isRepetitiveAppointment ?? false,
    };
    ALL_KEYS.forEach((k) => {
      const f = saved[k];
      form[k] = {
        value: (typeof f === "object" ? f?.value : f) || "",
        isVerified: f?.isVerified || false,
        verifiedBy: f?.verifiedBy || null,
        verifiedAt: f?.verifiedAt || null,
      };
    });
    return form;
  };

  const [form, setForm] = useState(initForm);

  /* One-time init for checkbox fields once application data arrives (if null on mount) */
  const checkboxLoadedRef = useRef(false);
  useEffect(() => {
    if (checkboxLoadedRef.current || !application?.applicationId) return;
    checkboxLoadedRef.current = true;
    setForm((prev) => ({
      ...prev,
      isFirstAppointment: application.isFirstAppointment ?? false,
      isRepetitiveAppointment: application.isRepetitiveAppointment ?? false,
    }));
  }, [application?.applicationId, application?.isFirstAppointment, application?.isRepetitiveAppointment]);

  /* Re-sync rich-text fields when historyForm data changes — never touches the checkboxes */
  useEffect(() => {
    const saved = application?.historyForm || patient?.historyForm || {};
    setForm((prev) => {
      const next = { ...prev };
      ALL_KEYS.forEach((k) => {
        const f = saved[k];
        next[k] = {
          value: (typeof f === "object" ? f?.value : f) || prev[k]?.value || "",
          isVerified: f?.isVerified ?? prev[k]?.isVerified ?? false,
          verifiedBy: f?.verifiedBy ?? prev[k]?.verifiedBy ?? null,
          verifiedAt: f?.verifiedAt ?? prev[k]?.verifiedAt ?? null,
        };
      });
      return next;
    });
  }, [application?.historyForm]);

  /* Track which individual fields are in edit mode */
  const [editingFields, setEditingFields] = useState({});
  const containerRef = useRef(null);
  const sectionRefs = useRef({});
  const [activeNavItem, setActiveNavItem] = useState(HISTORY_NAV_ITEMS[0].id);
  const [patientAppointments, setPatientAppointments] = useState([]);
  const [isAppointmentsPanelOpen, setIsAppointmentsPanelOpen] = useState(true);
  const [isAppointmentsLoading, setIsAppointmentsLoading] = useState(false);
  const [appointmentsError, setAppointmentsError] = useState(null);
  const [selectedConsultationId, setSelectedConsultationId] = useState(null);
  const [selectedApptData, setSelectedApptData] = useState(null);
  const [selectedApptLoading, setSelectedApptLoading] = useState(false);
  const [isSavingForm, setIsSavingForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(true);
  const editModeInitRef = useRef(false);
  const [consultationView, setConsultationView] = useState("normal");
  const [pastConsultationView, setPastConsultationView] = useState("normal");
  const currentReportRef = useRef(null);
  const pastReportRef = useRef(null);

  // Auto-select the current appointment once the application data arrives
  useEffect(() => {
    if (application?.applicationId) {
      setSelectedConsultationId((prev) => prev ?? application.applicationId);
    }
  }, [application?.applicationId]);

  // One-time: switch to view mode if application already has content
  useEffect(() => {
    if (editModeInitRef.current || !application?.applicationId) return;
    editModeInitRef.current = true;
    const saved = application?.historyForm || {};
    const hasContent = ALL_KEYS.some((k) => {
      const f = saved[k];
      const val = typeof f === "object" ? f?.value : f;
      return val?.replace(/<[^>]*>/g, "").trim();
    });
    if (hasContent) {
      setIsEditMode(false);
    } else {
      setEditingFields(ALL_KEYS.reduce((acc, k) => ({ ...acc, [k]: true }), {}));
    }
  }, [application?.applicationId, application?.historyForm]);

  const hasAnyContent = useCallback((f = form) =>
    ALL_KEYS.some((k) => f[k]?.value?.replace(/<[^>]*>/g, "").trim()), [form]);


  const enterViewMode = useCallback(() => {
    if (!hasAnyContent()) return; // nothing to show in view — stay in edit mode
    setIsEditMode(false);
    setEditingFields({});
  }, [hasAnyContent]);
  const [labTests, setLabTests] = useState([]);
  const [studyTests, setStudyTests] = useState([]);
  const [selectedLabTests, setSelectedLabTests] = useState({});
  const [selectedStudyTests, setSelectedStudyTests] = useState({});
  const [isLabPanelOpen, setIsLabPanelOpen] = useState(false);
  const [isStudyPanelOpen, setIsStudyPanelOpen] = useState(false);
  const [labPopupOpen, setLabPopupOpen] = useState(false);
  const [labPopupMode, setLabPopupMode] = useState(null);
  const [labUploadModalOpen, setLabUploadModalOpen] = useState(false);
  const [labUploadSection, setLabUploadSection] = useState(null);
  const [labUploadTestId, setLabUploadTestId] = useState("");
  const [labUploadFile, setLabUploadFile] = useState(null);
  const [isLabUploading, setIsLabUploading] = useState(false);
  const [newTestNameEN, setNewTestNameEN] = useState("");
  const [newTestNameRU, setNewTestNameRU] = useState("");
  const [editingTestId, setEditingTestId] = useState(null);
  const [deleteConfirmTest, setDeleteConfirmTest] = useState(null);
  const [selectedTest, setSelectedTest] = useState(null);
  const [selectedTestMode, setSelectedTestMode] = useState(null);
  const [showTestNoteEditor, setShowTestNoteEditor] = useState(false);
  const [testNoteDraft, setTestNoteDraft] = useState("");
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [isUploadingTestFile, setIsUploadingTestFile] = useState(false);
  const [testFileUploadError, setTestFileUploadError] = useState(null);
  const fileInputRef = useRef(null);
  const [sectionData, setSectionData] = useState({
    morphologicalResearch: { files: [], comment: {} },
    proceduresManipulations: { files: [], comment: {} },
  });
  const [sectionUploading, setSectionUploading] = useState({});
  const [sectionDirty, setSectionDirty] = useState({});
  const [sectionPdfModal, setSectionPdfModal] = useState(null);
  const morphFileRef = useRef(null);
  const procFileRef = useRef(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addModalMode, setAddModalMode] = useState(null);
  const [addModalTestId, setAddModalTestId] = useState("");
  const [addModalFiles, setAddModalFiles] = useState([]);
  const [addModalText, setAddModalText] = useState("");
  const [addModalSubmitting, setAddModalSubmitting] = useState(false);
  const [addModalSearchQ, setAddModalSearchQ] = useState("");
  const [addModalDropOpen, setAddModalDropOpen] = useState(false);
  const addFileInputRef = useRef(null);
  // Maps fileId/noteId → batchId — persisted to localStorage so grouping survives page refresh
  const lsKey = `ht_batch_map_${application?.applicationId || ""}`;
  const [batchMap, setBatchMap] = useState(() => {
    try { return JSON.parse(localStorage.getItem(lsKey) || "{}"); } catch { return {}; }
  });

  const formatDate = useCallback((dateStr) => {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }, []);

  const formatTime = useCallback((timeStr) => {
    if (!timeStr) return "";
    const parsed = new Date(timeStr);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleTimeString("ru-RU", {
        hour: "numeric",
        minute: "2-digit",
      });
    }
    return timeStr;
  }, []);

  const loadPatientAppointments = useCallback(async () => {
    const patientId = patient?.patientId || patient?._id || application?.patientId;
    if (!patientId) return;

    setIsAppointmentsLoading(true);
    setAppointmentsError(null);

    try {
      const response = await getApplicationsByPatientId(patientId);
      const apps = Array.isArray(response?.data) ? response.data :
                   Array.isArray(response) ? response : [];
      const filtered = apps.filter(
        (appt) => (appt.applicationId || appt._id) !== (application?.applicationId || application?._id),
      );
      setPatientAppointments(filtered);
    } catch (error) {
      const message = error?.response?.data?.message || t("history_tab.failed_loading_other_appointments", { defaultValue: "Failed to load other appointments" });
      setAppointmentsError(message);
    } finally {
      setIsAppointmentsLoading(false);
    }
  }, [application, patient, t]);

  // Auto-load appointments on mount so the panel is populated by default
  useEffect(() => {
    loadPatientAppointments();
  }, [loadPatientAppointments]);

  const handleSelectPastAppointment = useCallback(async (apptId) => {
    setSelectedConsultationId(apptId);
    setActiveNavItem("specialistConsultation");
    if (apptId === application?.applicationId) {
      setSelectedApptData(null);
      return;
    }
    setPastConsultationView("normal");
    setSelectedApptLoading(true);
    try {
      const res = await getApplication(apptId);
      setSelectedApptData(res?.data || res);
    } catch {
      toast.error(t("history_tab.failed_loading_appointment", { defaultValue: "Failed to load appointment" }));
      setSelectedApptData(null);
    } finally {
      setSelectedApptLoading(false);
    }
  }, [application?.applicationId, t]);

  const handleSidebarItemClick = useCallback(
    async (item, _e) => {
      setActiveNavItem(item.id);

      if (item.id === "specialistConsultation") {
        setIsLabPanelOpen(false);
        setIsStudyPanelOpen(false);
        setIsAppointmentsPanelOpen(true);
        setSelectedTest(null);
      } else if (item.id === "laboratoryAnalysis") {
        setIsAppointmentsPanelOpen(false);
        setIsStudyPanelOpen(false);
        setIsLabPanelOpen(true);
        const first = labTests.find((t) => (Array.isArray(t.files) && t.files.length > 0) || t.fileId);
        if (first) {
          setSelectedTest(first);
          setSelectedTestMode("laboratoryAnalysis");
          setShowTestNoteEditor(false);
          setTestNoteDraft(first?.note || "");
          setTestFileUploadError(null);
        } else {
          setSelectedTest(null);
          setSelectedTestMode(null);
        }
      } else if (item.id === "studiesManipulations") {
        setIsAppointmentsPanelOpen(false);
        setIsLabPanelOpen(false);
        setIsStudyPanelOpen(true);
        const first = studyTests.find((t) => (Array.isArray(t.files) && t.files.length > 0) || t.fileId);
        if (first) {
          setSelectedTest(first);
          setSelectedTestMode("studiesManipulations");
          setShowTestNoteEditor(false);
          setTestNoteDraft(first?.note || "");
          setTestFileUploadError(null);
        } else {
          setSelectedTest(null);
          setSelectedTestMode(null);
        }
      } else {
        setIsAppointmentsPanelOpen(false);
        setIsLabPanelOpen(false);
        setIsStudyPanelOpen(false);
        setSelectedTest(null);
      }
    },
    [labTests, studyTests],
  );

  const appId = application?.applicationId;

  useEffect(() => {
    if (!appId || Object.keys(batchMap).length === 0) return;
    try { localStorage.setItem(lsKey, JSON.stringify(batchMap)); } catch {}
  }, [batchMap, appId, lsKey]);

  /* nav item id → PatientManagedSection field name */
  const SECTION_SCHEMA = {
    morphologicalResearch: "morphologicalResearch",
    proceduresManipulations: "proceduresAndManipulations",
  };
  const PANEL_NAV_IDS = Object.keys(SECTION_SCHEMA);
  const pid = patient?.patientId || patient?._id || application?.patientId;

  useEffect(() => {
    if (!PANEL_NAV_IDS.includes(activeNavItem)) return;
    if (!pid) return;
    const schemaKey = SECTION_SCHEMA[activeNavItem];
    getPatientSection(pid, schemaKey)
      .then((data) => {
        setSectionData((prev) => ({ ...prev, [activeNavItem]: data }));
        setSectionDirty((prev) => ({ ...prev, [activeNavItem]: false }));
      })
      .catch(() => {});
  }, [activeNavItem, pid]);

  const handleSectionFileChange = useCallback(async (navId, e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    const schemaKey = SECTION_SCHEMA[navId];
    setSectionUploading((prev) => ({ ...prev, [navId]: true }));
    try {
      for (const file of files) {
        const result = await uploadPatientSectionFile(pid, schemaKey, file);
        setSectionData((prev) => ({ ...prev, [navId]: result.section }));
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || "Upload failed");
    } finally {
      setSectionUploading((prev) => ({ ...prev, [navId]: false }));
    }
  }, [pid]);

  const handleSectionFileRemove = useCallback(async (navId, fileId) => {
    const schemaKey = SECTION_SCHEMA[navId];
    try {
      const result = await removePatientSectionFile(pid, schemaKey, fileId);
      setSectionData((prev) => ({ ...prev, [navId]: result.section }));
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to remove file");
    }
  }, [pid]);

  const handleSectionCommentSave = useCallback(async (navId, value) => {
    const schemaKey = SECTION_SCHEMA[navId];
    try {
      const result = await updatePatientSectionComment(pid, schemaKey, value);
      setSectionData((prev) => ({ ...prev, [navId]: result.section }));
      setSectionDirty((prev) => ({ ...prev, [navId]: false }));
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to save comment");
    }
  }, [pid]);

  const openLabUploadModal = useCallback((section, e, preSelectTestId = "") => {
    if (e?.stopPropagation) e.stopPropagation();
    setLabUploadSection(section);
    setLabUploadTestId(preSelectTestId);
    setLabUploadFile(null);
    setLabUploadModalOpen(true);
  }, []);

  const closeLabUploadModal = useCallback(() => {
    setLabUploadModalOpen(false);
    setLabUploadSection(null);
    setLabUploadTestId("");
    setLabUploadFile(null);
  }, []);

  const openAddModal = useCallback((mode, preSelectedTestId = "") => {
    setAddModalMode(mode);
    setAddModalTestId(preSelectedTestId);
    setAddModalFiles([]);
    setAddModalText("");
    setAddModalSearchQ("");
    setAddModalDropOpen(false);
    setAddModalOpen(true);
  }, []);

  const handleAddModalSubmit = useCallback(async () => {
    if (!addModalTestId) { toast.error(t("history_tab.select_test", { defaultValue: "Select a test" })); return; }
    const addModalTextPlain = addModalText.replace(/<[^>]*>/g, "").trim();
    if (addModalFiles.length === 0 && !addModalTextPlain) {
      toast.error(t("history_tab.add_file_or_text", { defaultValue: "Add at least one file or text" })); return;
    }
    setAddModalSubmitting(true);
    const pid = patient?.patientId || patient?._id || application?.patientId;
    const batchId = `b${Date.now()}`;
    const newBatchEntries = {};
    try {
      let prevFileIds = new Set((selectedTest?.files || []).map((f) => f.fileId));
      let latestFileTest = null;
      let latestNoteTest = null;

      for (const file of addModalFiles) {
        const result = addModalMode === "studiesManipulations"
          ? await uploadApplicationInstrumentalAnalysisFile(addModalTestId, file, pid)
          : await uploadApplicationLaboratoryTestFile(addModalTestId, file, pid);
        latestFileTest = result?.data || result;
        // Find newly added file IDs and tag them with this batch
        (latestFileTest.files || []).forEach((f) => {
          if (!prevFileIds.has(f.fileId)) { newBatchEntries[f.fileId] = batchId; prevFileIds.add(f.fileId); }
        });
        if (addModalMode === "studiesManipulations") {
          setStudyTests((prev) => prev.map((t) => t._id === addModalTestId ? latestFileTest : t));
        } else {
          setLabTests((prev) => prev.map((t) => t._id === addModalTestId ? latestFileTest : t));
        }
      }

      if (addModalTextPlain) {
        const prevNoteIds = new Set((latestFileTest?.notes || selectedTest?.notes || []).map((n) => String(n._id)));
        const noteResult = addModalMode === "studiesManipulations"
          ? await addApplicationInstrumentalAnalysisNote(addModalTestId, { note: addModalText }, pid)
          : await addApplicationLaboratoryTestNote(addModalTestId, { note: addModalText }, pid);
        latestNoteTest = noteResult?.data || noteResult;
        (latestNoteTest.notes || []).forEach((n) => {
          if (!prevNoteIds.has(String(n._id))) newBatchEntries[String(n._id)] = batchId;
        });
        if (addModalMode === "studiesManipulations") {
          setStudyTests((prev) => prev.map((t) => t._id === addModalTestId ? latestNoteTest : t));
        } else {
          setLabTests((prev) => prev.map((t) => t._id === addModalTestId ? latestNoteTest : t));
        }
      }

      if (Object.keys(newBatchEntries).length > 0) {
        setBatchMap((prev) => ({ ...prev, ...newBatchEntries }));
      }
      const finalTest = latestNoteTest || latestFileTest;
      if (finalTest) {
        setSelectedTest(finalTest);
        setSelectedTestMode(addModalMode);
      }
      setAddModalOpen(false);
      toast.success(t("history_tab.file_uploaded", { defaultValue: "Added successfully" }));
    } catch (err) {
      toast.error(err?.response?.data?.error || t("history_tab.failed_upload_file", { defaultValue: "Failed to add" }));
    } finally {
      setAddModalSubmitting(false);
    }
  }, [addModalMode, addModalTestId, addModalFiles, addModalText, selectedTest, t]);

  const groupTestItems = useCallback((files, notes, bm = {}) => {
    const items = [
      ...files.map((f) => ({ ...f, _type: "file", _key: f.fileId, _time: f.uploadedAt ? new Date(f.uploadedAt).getTime() : 0 })),
      ...notes.map((n) => ({ ...n, _type: "note", _key: String(n._id), _time: n.createdAt ? new Date(n.createdAt).getTime() : 0 })),
    ].sort((a, b) => a._time - b._time);

    // Separate items that have a known batch ID from those that don't
    const batchGroups = {}; // batchId → items[]
    const unbatched = [];
    for (const item of items) {
      const bid = bm[item._key];
      if (bid) {
        if (!batchGroups[bid]) batchGroups[bid] = [];
        batchGroups[bid].push(item);
      } else {
        unbatched.push(item);
      }
    }

    // Time-based grouping for server-loaded items (10 s threshold)
    const timeGroups = [];
    let cur = [];
    let lastT = -Infinity;
    for (const item of unbatched) {
      if (item._time - lastT > 10000) {
        if (cur.length) timeGroups.push(cur);
        cur = [item];
      } else {
        cur.push(item);
      }
      lastT = item._time;
    }
    if (cur.length) timeGroups.push(cur);

    // Merge all groups sorted by earliest item time
    return [...Object.values(batchGroups), ...timeGroups].sort((a, b) => {
      const ta = Math.min(...a.map((i) => i._time));
      const tb = Math.min(...b.map((i) => i._time));
      return ta - tb;
    });
  }, []);

  const handleLabUploadSubmit = useCallback(async () => {
    if (!labUploadTestId) { toast.error(t("history_tab.select_test", { defaultValue: "Select a test" })); return; }
    if (!labUploadFile) { toast.error(t("history_tab.select_file", { defaultValue: "Select a file" })); return; }
    setIsLabUploading(true);
    try {
      const result = labUploadSection === "studiesManipulations"
        ? await uploadApplicationInstrumentalAnalysisFile(labUploadTestId, labUploadFile)
        : await uploadApplicationLaboratoryTestFile(labUploadTestId, labUploadFile);
      const updatedTest = result?.test || result;
      if (labUploadSection === "studiesManipulations") {
        setStudyTests((prev) => prev.map((t) => t._id === labUploadTestId ? { ...t, ...updatedTest } : t));
      } else {
        setLabTests((prev) => prev.map((t) => t._id === labUploadTestId ? { ...t, ...updatedTest } : t));
      }
      setSelectedTest((prev) => prev?._id === labUploadTestId ? { ...prev, ...updatedTest } : prev);
      toast.success(t("history_tab.file_uploaded", { defaultValue: "File uploaded" }));
      closeLabUploadModal();
    } catch (err) {
      toast.error(err?.response?.data?.error || t("history_tab.failed_upload_file", { defaultValue: "Upload failed" }));
    } finally {
      setIsLabUploading(false);
    }
  }, [labUploadSection, labUploadTestId, labUploadFile, closeLabUploadModal, t]);

  const openLabAnalysisPopup = useCallback((mode, e) => {
    if (e?.stopPropagation) e.stopPropagation();
    setLabPopupMode(mode);
    setLabPopupOpen(true);
    setEditingTestId(null);
  }, []);

  const closeLabAnalysisPopup = useCallback(() => {
    setLabPopupOpen(false);
    setLabPopupMode(null);
    setNewTestNameEN("");
    setNewTestNameRU("");
    setEditingTestId(null);
    setDeleteConfirmTest(null);
  }, []);

  const openEditTest = useCallback((test) => {
    setEditingTestId(test._id);
    setNewTestNameEN(test.name?.en || "");
    setNewTestNameRU(test.name?.ru || "");
  }, []);

  const cancelEditTest = useCallback(() => {
    setEditingTestId(null);
    setNewTestNameEN("");
    setNewTestNameRU("");
  }, []);

  const handleSaveTest = useCallback(async () => {
    if (!newTestNameEN.trim() || !newTestNameRU.trim()) {
      toast.error(t("history_tab.enter_test_name", { defaultValue: "Please enter both EN and RU names." }));
      return;
    }

    const payload = {
      name: {
        en: newTestNameEN.trim(),
        ru: newTestNameRU.trim(),
      },
    };

    try {
      if (editingTestId) {
        const response = labPopupMode === "studiesManipulations"
          ? await updateApplicationInstrumentalAnalysis(editingTestId, payload)
          : await updateApplicationLaboratoryTest(editingTestId, payload);
        const updated = response?.data || response;

        if (labPopupMode === "studiesManipulations") {
          setStudyTests((prev) => prev.map((item) => (item._id === editingTestId ? updated : item)));
        } else {
          setLabTests((prev) => prev.map((item) => (item._id === editingTestId ? updated : item)));
        }

        toast.success(t("history_tab.test_updated", { defaultValue: "Test updated" }));
      } else {
        const response = labPopupMode === "studiesManipulations"
          ? await createApplicationInstrumentalAnalysis(payload)
          : await createApplicationLaboratoryTest(payload);
        const created = response?.data || response;

        if (created) {
          if (labPopupMode === "studiesManipulations") {
            setStudyTests((prev) => [...prev, created]);
            setSelectedStudyTests((prev) => ({ ...prev, [created._id]: true }));
          } else {
            setLabTests((prev) => [...prev, created]);
            setSelectedLabTests((prev) => ({ ...prev, [created._id]: true }));
          }
          toast.success(t("history_tab.test_added", { defaultValue: "Test added" }));
        }
      }

      setEditingTestId(null);
      setNewTestNameEN("");
      setNewTestNameRU("");
    } catch (err) {
      toast.error(editingTestId ? t("history_tab.failed_update_test", { defaultValue: "Failed to update test" }) : t("history_tab.failed_add_test", { defaultValue: "Failed to add test" }));
    }
  }, [editingTestId, labPopupMode, newTestNameEN, newTestNameRU, t]);

  const openDeleteConfirm = useCallback((test) => {
    setDeleteConfirmTest(test);
  }, []);

  const closeDeleteConfirm = useCallback(() => {
    setDeleteConfirmTest(null);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteConfirmTest) return;
    try {
      await (labPopupMode === "studiesManipulations"
        ? deleteApplicationInstrumentalAnalysis(deleteConfirmTest._id)
        : deleteApplicationLaboratoryTest(deleteConfirmTest._id));

      if (labPopupMode === "studiesManipulations") {
        setStudyTests((prev) => prev.filter((item) => item._id !== deleteConfirmTest._id));
        setSelectedStudyTests((prev) => {
          const next = { ...prev };
          delete next[deleteConfirmTest._id];
          return next;
        });
      } else {
        setLabTests((prev) => prev.filter((item) => item._id !== deleteConfirmTest._id));
        setSelectedLabTests((prev) => {
          const next = { ...prev };
          delete next[deleteConfirmTest._id];
          return next;
        });
      }

      if (editingTestId === deleteConfirmTest._id) {
        cancelEditTest();
      }

      setDeleteConfirmTest(null);
      toast.success(t("history_tab.test_deleted", { defaultValue: "Test deleted" }));
    } catch (err) {
      toast.error(t("history_tab.failed_delete_test", { defaultValue: "Failed to delete test" }));
    }
  }, [cancelEditTest, deleteConfirmTest, editingTestId, labPopupMode, t]);

  const handleToggleLabTest = useCallback((id, useStudyMode = false) => {
    if (useStudyMode || labPopupMode === "studiesManipulations") {
      setSelectedStudyTests((prev) => ({ ...prev, [id]: !prev[id] }));
    } else {
      setSelectedLabTests((prev) => ({ ...prev, [id]: !prev[id] }));
    }
  }, [labPopupMode]);

  const handleSelectTest = useCallback((test, mode) => {
    setSelectedTest(test);
    setSelectedTestMode(mode);
    setShowTestNoteEditor(false);
    setTestNoteDraft(test?.note || "");
    setTestFileUploadError(null);
  }, []);

  const handleCloseSelectedTest = useCallback(() => {
    setSelectedTest(null);
    setSelectedTestMode(null);
    setShowTestNoteEditor(false);
    setTestNoteDraft("");
    setTestFileUploadError(null);
  }, []);

  const selectedTestFiles = React.useMemo(() => {
    if (!selectedTest) return [];
    if (Array.isArray(selectedTest.files) && selectedTest.files.length > 0) {
      return selectedTest.files;
    }
    if (selectedTest.fileId) {
      return [
        {
          fileId: selectedTest.fileId,
          fileName: selectedTest.fileName || selectedTest.originalName || t("history_tab.unknown_file", { defaultValue: "Unknown file" }),
          fileMimeType: selectedTest.fileMimeType || "",
          fileSize: selectedTest.fileSize || 0,
          uploadedAt: selectedTest.uploadedAt || null,
        },
      ];
    }
    return [];
  }, [selectedTest, t]);

  const handleTestFileUpload = useCallback(async (file) => {
    if (!selectedTest || !selectedTestMode || !file) return;
    setIsUploadingTestFile(true);
    setTestFileUploadError(null);

    const pid = patient?.patientId || patient?._id || application?.patientId;
    try {
      const response = selectedTestMode === "studiesManipulations"
        ? await uploadApplicationInstrumentalAnalysisFile(selectedTest._id, file, pid)
        : await uploadApplicationLaboratoryTestFile(selectedTest._id, file, pid);
      const updated = response?.data || response;
      setSelectedTest(updated);
      if (selectedTestMode === "studiesManipulations") {
        setStudyTests((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
      } else {
        setLabTests((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
      }
      toast.success(t("history_tab.file_uploaded", { defaultValue: "File uploaded" }));
    } catch (error) {
      const message = error?.response?.data?.error || error?.message || t("history_tab.failed_upload_file", { defaultValue: "Failed to upload file" });
      setTestFileUploadError(message);
      toast.error(message);
    } finally {
      setIsUploadingTestFile(false);
    }
  }, [selectedTest, selectedTestMode, t]);

  const handleTestFileChange = useCallback(async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    for (const file of files) {
      await handleTestFileUpload(file);
    }
    event.target.value = "";
  }, [handleTestFileUpload]);

  const selectedTestNotes = React.useMemo(() => {
    if (!selectedTest) return [];
    const notes = Array.isArray(selectedTest.notes) ? selectedTest.notes : [];
    if (notes.length > 0) return notes;
    if (selectedTest.note) {
      return [
        {
          _id: "legacy-note",
          content: selectedTest.note,
          createdAt: selectedTest.updatedAt || selectedTest.createdAt || new Date(),
          updatedAt: selectedTest.updatedAt || selectedTest.createdAt || new Date(),
        },
      ];
    }
    return [];
  }, [selectedTest]);

  const handleOpenTestNoteEditor = useCallback(() => {
    setShowTestNoteEditor(true);
    setEditingNoteId(null);
    setTestNoteDraft("");
  }, []);

  const handleEditTestNote = useCallback((note) => {
    setShowTestNoteEditor(true);
    setEditingNoteId(note._id);
    setTestNoteDraft(note.content || "");
  }, []);

  const handleSaveTestNote = useCallback(async () => {
    if (!selectedTest || !selectedTestMode || !testNoteDraft.trim()) return;
    try {
      const response = selectedTestMode === "studiesManipulations"
        ? editingNoteId
          ? await updateApplicationInstrumentalAnalysisNote(selectedTest._id, editingNoteId, { note: testNoteDraft })
          : await addApplicationInstrumentalAnalysisNote(selectedTest._id, { note: testNoteDraft })
        : editingNoteId
          ? await updateApplicationLaboratoryTestNote(selectedTest._id, editingNoteId, { note: testNoteDraft })
          : await addApplicationLaboratoryTestNote(selectedTest._id, { note: testNoteDraft });

      const updated = response?.data || response;
      setSelectedTest(updated);
      if (selectedTestMode === "studiesManipulations") {
        setStudyTests((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
      } else {
        setLabTests((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
      }
      toast.success(t("history_tab.note_saved", { defaultValue: "Note saved" }));
      setShowTestNoteEditor(false);
      setEditingNoteId(null);
      setTestNoteDraft("");
    } catch (error) {
      const message = error?.response?.data?.error || error?.message || t("history_tab.failed_save_note", { defaultValue: "Failed to save note" });
      toast.error(message);
    }
  }, [selectedTest, selectedTestMode, testNoteDraft, editingNoteId, t]);

  const handleRemoveTestFile = useCallback(async (fileId) => {
    if (!selectedTest || !selectedTestMode || !fileId) return;
    const pid = patient?.patientId || patient?._id || application?.patientId;
    try {
      const response = selectedTestMode === "studiesManipulations"
        ? await removeApplicationInstrumentalAnalysisFile(selectedTest._id, fileId, pid)
        : await removeApplicationLaboratoryTestFile(selectedTest._id, fileId, pid);
      const updated = response?.data || response;
      setSelectedTest(updated);
      if (selectedTestMode === "studiesManipulations") {
        setStudyTests((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
      } else {
        setLabTests((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
      }
      toast.success(t("history_tab.file_removed", { defaultValue: "File removed" }));
    } catch (error) {
      const message = error?.response?.data?.error || error?.message || t("history_tab.failed_remove_file", { defaultValue: "Failed to remove file" });
      toast.error(message);
    }
  }, [selectedTest, selectedTestMode, t]);

  const handleViewTestFile = useCallback(async (fileId) => {
    if (!selectedTest || !selectedTestMode || !fileId) return;
    const pid = patient?.patientId || patient?._id || application?.patientId;
    try {
      const blob = selectedTestMode === "studiesManipulations"
        ? await fetchApplicationInstrumentalAnalysisFile(selectedTest._id, fileId, pid)
        : await fetchApplicationLaboratoryTestFile(selectedTest._id, fileId, pid);
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);
    } catch (error) {
      const message = error?.response?.data?.error || error?.message || t("history_tab.failed_view_file", { defaultValue: "Failed to open file" });
      toast.error(message);
    }
  }, [selectedTest, selectedTestMode, t]);

  const handleDeleteTestNote = useCallback(async (noteId) => {
    if (!selectedTest || !selectedTestMode || !noteId) return;
    const pid = patient?.patientId || patient?._id || application?.patientId;
    try {
      const response = selectedTestMode === "studiesManipulations"
        ? await deleteApplicationInstrumentalAnalysisNote(selectedTest._id, noteId, pid)
        : await deleteApplicationLaboratoryTestNote(selectedTest._id, noteId, pid);
      const updated = response?.data || response;
      setSelectedTest(updated);
      if (selectedTestMode === "studiesManipulations") {
        setStudyTests((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
      } else {
        setLabTests((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
      }
      toast.success(t("history_tab.note_deleted", { defaultValue: "Note deleted" }));
      setShowTestNoteEditor(false);
    } catch (error) {
      const message = error?.response?.data?.error || error?.message || t("history_tab.failed_delete_note", { defaultValue: "Failed to delete note" });
      toast.error(message);
    }
  }, [selectedTest, selectedTestMode, t]);

  const handleDeleteGroup = useCallback(async (group) => {
    if (!selectedTest || !selectedTestMode) return;
    const pid = patient?.patientId || patient?._id || application?.patientId;
    const files = group.filter((i) => i._type === "file");
    const notes = group.filter((i) => i._type === "note");
    try {
      let updatedTest = selectedTest;
      for (const item of files) {
        const res = selectedTestMode === "studiesManipulations"
          ? await removeApplicationInstrumentalAnalysisFile(selectedTest._id, item.fileId, pid)
          : await removeApplicationLaboratoryTestFile(selectedTest._id, item.fileId, pid);
        updatedTest = res?.data || res;
      }
      for (const item of notes) {
        const res = selectedTestMode === "studiesManipulations"
          ? await deleteApplicationInstrumentalAnalysisNote(selectedTest._id, item._id, pid)
          : await deleteApplicationLaboratoryTestNote(selectedTest._id, item._id, pid);
        updatedTest = res?.data || res;
      }
      setSelectedTest(updatedTest);
      if (selectedTestMode === "studiesManipulations") {
        setStudyTests((prev) => prev.map((t) => (t._id === updatedTest._id ? updatedTest : t)));
      } else {
        setLabTests((prev) => prev.map((t) => (t._id === updatedTest._id ? updatedTest : t)));
      }
      const keysToRemove = group.map((i) => i._key).filter(Boolean);
      if (keysToRemove.length > 0) {
        setBatchMap((prev) => {
          const next = { ...prev };
          keysToRemove.forEach((k) => delete next[k]);
          return next;
        });
      }
      toast.success(t("history_tab.group_deleted", { defaultValue: "Group deleted" }));
    } catch (error) {
      const message = error?.response?.data?.error || error?.message || "Failed to delete group";
      toast.error(message);
    }
  }, [selectedTest, selectedTestMode, t]);

  /* Close all editing fields when clicking outside any field (skipped in bulk-edit mode) */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isEditMode) return;
      if (
        e.target.closest("[data-ht-field]") ||
        e.target.closest(".ht-section-header--clickable") ||
        e.target.closest(".rte-color-dropdown") ||
        e.target.closest(".rte-select") ||
        e.target.closest(".tp-wrap") ||
        e.target.closest(".tp-dropdown")
      ) return;
      setEditingFields({});
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isEditMode]);

  const setFieldEditing = useCallback((fieldKey, value) => {
    setEditingFields((prev) => ({ ...prev, [fieldKey]: value }));
  }, []);

  /* Editor change handler */
  const handleEditorChange = useCallback((key, html) => {
    setForm((prev) => ({ ...prev, [key]: { ...prev[key], value: html } }));
  }, []);

  /* Verify toggle handler — calls backend directly */
  const handleVerifyToggle = useCallback(async (key) => {
    const newVal = !form[key]?.isVerified;
    setForm((prev) => ({ ...prev, [key]: { ...prev[key], isVerified: newVal } }));
    if (!application?.applicationId) return;
    try {
      await updateHistoryFieldVerify(application.applicationId, key, newVal);
    } catch (err) {
      toast.error("Failed to update verification");
    }
  }, [application, form]);

  /* ── Templates ── */
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const data = await getHistoryTemplates();
        setTemplates(Array.isArray(data) ? data : []);
      } catch (err) {
      }
    };
    fetchTemplates();
  }, []);

  useEffect(() => {
    const pid = patient?.patientId || patient?._id || application?.patientId;

    const fetchLabTests = async () => {
      try {
        const response = await getAllApplicationLaboratoryTests(pid ? { patientId: pid } : {});
        const tests = Array.isArray(response?.data) ? response.data : response || [];
        setLabTests(tests);
        setSelectedLabTests(
          tests.reduce((acc, test) => {
            acc[test._id] = false;
            return acc;
          }, {}),
        );
      } catch (err) {
        console.error("Failed to load laboratory tests", err);
      }
    };

    const fetchStudyTests = async () => {
      try {
        const response = await getAllApplicationInstrumentalAnalysis(pid ? { patientId: pid } : {});
        const tests = Array.isArray(response?.data) ? response.data : response || [];
        setStudyTests(tests);
        setSelectedStudyTests(
          tests.reduce((acc, test) => {
            acc[test._id] = false;
            return acc;
          }, {}),
        );
      } catch (err) {
        console.error("Failed to load study tests", err);
      }
    };

    fetchLabTests();
    fetchStudyTests();
  }, [application, patient]);

  /** Returns templates for a specific field key */
  const getFieldTemplates = useCallback(
    (fieldKey) => templates.filter((t) => t.fieldKey === fieldKey),
    [templates]
  );

  /** Save a new template */
  const handleSaveTemplate = useCallback(async (fieldKey, name, content) => {
    const tpl = await createHistoryTemplate({ fieldKey, name, content });
    setTemplates((prev) => [tpl, ...prev]);
    toast.success(t("toast.template_saved"));
  }, []);

  /** Update a template */
  const handleUpdateTemplate = useCallback(async (id, changes) => {
    try {
      const updated = await updateHistoryTemplate(id, changes);
      setTemplates((prev) => prev.map((t) => (t._id === id ? { ...t, ...updated } : t)));
    } catch (err) {
      toast.error(t("toast.template_update_failed"));
    }
  }, []);

  /** Delete a template */
  const handleDeleteTemplate = useCallback(async (id) => {
    try {
      await deleteHistoryTemplate(id);
      setTemplates((prev) => prev.filter((t) => t._id !== id));
      toast.success(t("toast.template_deleted"));
    } catch (err) {
      toast.error(t("toast.template_delete_failed"));
    }
  }, []);

  /** Duplicate a template */
  const handleDuplicateTemplate = useCallback(async (tpl) => {
    try {
      const newTpl = await createHistoryTemplate({
        fieldKey: tpl.fieldKey,
        name: `${tpl.name} (copy)`,
        content: tpl.content,
        isDefault: false,
      });
      setTemplates((prev) => [newTpl, ...prev]);
      toast.success(t("toast.template_duplicated"));
    } catch (err) {
      toast.error(t("toast.template_duplicate_failed"));
    }
  }, []);

  /** Build a TemplatePicker node for a given field key */
  const makeTemplatePicker = useCallback((fieldKey) => (
    <TemplatePicker
      templates={getFieldTemplates(fieldKey)}
      currentValue={form[fieldKey]?.value || ""}
      isEditing={!!editingFields[fieldKey]}
      onApply={(content) => {
        handleEditorChange(fieldKey, content);
        setFieldEditing(fieldKey, true);
      }}
      onSave={(name, content) => handleSaveTemplate(fieldKey, name, content)}
      onUpdate={(id, changes) => handleUpdateTemplate(id, changes)}
      onDelete={(id) => handleDeleteTemplate(id)}
      onDuplicate={(tpl) => handleDuplicateTemplate(tpl)}
    />
  ), [getFieldTemplates, form, editingFields, handleEditorChange, setFieldEditing, handleSaveTemplate, handleUpdateTemplate, handleDeleteTemplate, handleDuplicateTemplate]);

  /* Expose data for parent save */
  useImperativeHandle(ref, () => ({
    getData: () => ({ historyForm: { ...form } }),
  }));

  const handleSaveForm = useCallback(async () => {
    if (!application?.applicationId) return;
    setIsSavingForm(true);
    try {
      const result = await updateHistoryForm(application.applicationId, { ...form });
      if (result) {
        setForm((prev) => ({
          ...prev,
          isFirstAppointment: typeof result.isFirstAppointment === "boolean" ? result.isFirstAppointment : prev.isFirstAppointment,
          isRepetitiveAppointment: typeof result.isRepetitiveAppointment === "boolean" ? result.isRepetitiveAppointment : prev.isRepetitiveAppointment,
        }));
        onHistoryFormSaved?.(result?.historyForm ?? result);
      }
      toast.success(t("history_tab.saved", { defaultValue: "Saved" }));
      if (hasAnyContent()) {
        setIsEditMode(false);
        setEditingFields({});
      }
    } catch {
      toast.error(t("history_tab.save_error", { defaultValue: "Failed to save" }));
    } finally {
      setIsSavingForm(false);
    }
  }, [application, form, t, onHistoryFormSaved]);

  /* Verify toggle badge */
  const VerifyBadge = ({ fieldKey }) => {
    const verified = !!form[fieldKey]?.isVerified;
    return (
      <button
        type="button"
        className={`ht-verify-btn${verified ? " ht-verify-btn--verified" : " ht-verify-btn--pending"}`}
        onClick={(e) => { e.stopPropagation(); handleVerifyToggle(fieldKey); }}
        title={verified ? t("verify_title_verified") : t("verify_title_pending")}
      >
        {verified ? t("verify_verified") : t("verify_pending")}
      </button>
    );
  };

  /* ── Render helpers ── */
  const renderFields = (fields) => (
    <div className="ht-fields">
      {fields.map((f) => (
        <RichTextField
          key={f.key}
          label={f.labelKey ? t(f.labelKey) : undefined}
          value={form[f.key]?.value || ""}
          editing={!!editingFields[f.key]}
          onToggle={() => setFieldEditing(f.key, !editingFields[f.key])}
          onChange={(html) => handleEditorChange(f.key, html)}
          placeholder={t("enter_text")}
          emptyPlaceholder={t("click_to_edit")}
          templatePicker={makeTemplatePicker(f.key)}
        />
      ))}
    </div>
  );

  const renderSection = (section, level = 0) => {
    const isSingleField = section.fields?.length === 1 && !section.fields[0].labelKey && !section.subsections?.length;
    const singleKey = isSingleField ? section.fields[0].key : null;
    const singleEditing = singleKey ? !!editingFields[singleKey] : false;

    return (
      <div
        key={section.id}
        ref={(node) => {
          if (level === 0) {
            sectionRefs.current[section.id] = node;
          }
        }}
        className={`ht-section${level > 0 ? " ht-subsection" : ""}${singleEditing ? " ht-section--editing" : ""}`}
      >
        {/* ── Header ── */}
        <div
          className={`ht-section-header${level > 0 ? " ht-subsection-header" : ""}${isSingleField ? " ht-section-header--clickable" : ""}`}
          onClick={isSingleField ? () => setFieldEditing(singleKey, !singleEditing) : undefined}
        >
          <span className={level > 0 ? "ht-subsection-title" : "ht-section-title"}>
            {t(section.titleKey)}
          </span>
          {isSingleField && (
            <div className="ht-section-header-actions">
              {form[singleKey]?.value?.replace(/<[^>]*>/g, "").trim() && <VerifyBadge fieldKey={singleKey} />}
              {makeTemplatePicker(singleKey)}
              <span className={`ht-field-toggle ${singleEditing ? "ht-field-toggle--active" : ""}`}>
                {singleEditing ? "\u2715" : "\u270E"}
              </span>
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div className="ht-section-body">
          {isSingleField ? (
            singleEditing ? (
              <div data-ht-field>
                <RichTextEditor
                  value={form[singleKey]?.value || ""}
                  onChange={(html) => handleEditorChange(singleKey, html)}
                  placeholder={t("enter_text")}
                />
              </div>
            ) : (
              <div
                data-ht-field
                className={`ht-preview${!form[singleKey]?.value ? " ht-preview--empty" : ""}`}
                onClick={() => setFieldEditing(singleKey, true)}
                dangerouslySetInnerHTML={{ __html: form[singleKey]?.value || `<span class='ht-preview-placeholder'>${t("click_to_edit")}</span>` }}
              />
            )
          ) : (
            <>
              {section.fields && renderFields(section.fields)}
              {((section.id === "examinationPlan" && activeNavItem === "laboratoryAnalysis") || (section.id === "physicalExam" && activeNavItem === "studiesManipulations")) && (
                <div className="ht-lab-analysis-panel">
                  {(() => {
                    const allTests = activeNavItem === "laboratoryAnalysis" ? labTests : studyTests;
                    const withFiles = allTests.filter((t) => (Array.isArray(t.files) && t.files.length > 0) || t.fileId);
                    if (withFiles.length > 0) {
                      return (
                        <div className="ht-lab-analysis-grid">
                          {allTests.map((test) => {
                            const isChecked = activeNavItem === "laboratoryAnalysis" ? !!selectedLabTests[test._id] : !!selectedStudyTests[test._id];
                            return (
                            <div
                              key={test._id}
                              className={`ht-lab-analysis-item ht-lab-analysis-item--selectable${isChecked ? " ht-lab-analysis-item--selected" : ""}`}
                              onClick={() => {
                                handleToggleLabTest(test._id, activeNavItem === "studiesManipulations");
                                handleSelectTest(test, activeNavItem);
                              }}
                            >
                              <div className="ht-lab-analysis-item-label">
                                <span className="lab-name-en">{test.name?.en || ""}</span>
                                {test.name?.ru && <span className="lab-name-ru">{test.name.ru}</span>}
                              </div>
                            </div>
                          );
                          })}
                        </div>
                      );
                    }
                    return (
                      <div className="ht-lab-no-files">
                        <span className="ht-lab-no-files-text">
                          {t("history_tab.no_files_uploaded", { defaultValue: "No files uploaded" })}
                        </span>
                        <button
                          type="button"
                          className="ht-lab-no-files-btn"
                          onClick={(e) => openLabAnalysisPopup(activeNavItem, e)}
                        >
                          <FiUpload size={14} />
                          {t("history_tab.upload_file", { defaultValue: "Upload file" })}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}
              {section.subsections?.map((sub) => renderSection(sub, level + 1))}
            </>
          )}
        </div>
      </div>
    );
  };

  
  return (
    <>
      <div className={`ht-shell${(isLabPanelOpen || isStudyPanelOpen || isAppointmentsPanelOpen) ? " panel-open" : ""}`}>
        <aside className="ht-sub-sidebar" aria-label={t("sidebar_title")}>
          <div className="ht-sub-sidebar-list">
            {HISTORY_NAV_ITEMS.map((item) => (
              <React.Fragment key={item.id}>
                <div
                  role="button"
                  tabIndex={0}
                  className={`ht-sub-sidebar-item${activeNavItem === item.id ? " ht-sub-sidebar-item--active" : ""}`}
                  onClick={(e) => handleSidebarItemClick(item, e)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") handleSidebarItemClick(item, e);
                  }}
                >
                  <span className="ht-sub-sidebar-label">{t(item.labelKey)}</span>
                  <span className="ht-sub-sidebar-actions">
                    {(item.id === "laboratoryAnalysis" || item.id === "studiesManipulations") && (
                      <button
                        type="button"
                        className="ht-sub-sidebar-setting-btn"
                        onClick={(e) => openLabAnalysisPopup(item.id, e)}
                        aria-label={t("history_tab.manage_lab_tests", { defaultValue: "Manage tests" })}
                      >
                        <FiSettings size={14} />
                      </button>
                    )}
                    {item.icon && (
                      <span className="ht-sub-sidebar-icon" aria-hidden="true">
                        {item.icon}
                      </span>
                    )}
                  </span>
                </div>

              </React.Fragment>
            ))}
          </div>
        </aside>

        {(isLabPanelOpen || isStudyPanelOpen || isAppointmentsPanelOpen) && (
          <aside className="ht-sub-panel">
            {isLabPanelOpen && (() => {
              const withFiles = labTests.filter((t) => (Array.isArray(t.files) && t.files.length > 0) || t.fileId);
              return withFiles.length === 0 ? null : (
                <div className="ht-tests-panel">
                  {withFiles.map((test) => (
                    <button
                      key={test._id}
                      type="button"
                      className={`ht-tests-panel-item${selectedTest?._id === test._id ? " ht-tests-panel-item--active" : ""}`}
                      onClick={() => handleSelectTest(test, "laboratoryAnalysis")}
                    >
                      <span className="ht-tests-panel-name">{test.name?.ru || test.name?.en || ""}</span>
                    </button>
                  ))}
                </div>
              );
            })()}

            {isStudyPanelOpen && (() => {
              const withFiles = studyTests.filter((t) => (Array.isArray(t.files) && t.files.length > 0) || t.fileId);
              return withFiles.length === 0 ? null : (
                <div className="ht-tests-panel">
                  {withFiles.map((test) => (
                    <button
                      key={test._id}
                      type="button"
                      className={`ht-tests-panel-item${selectedTest?._id === test._id ? " ht-tests-panel-item--active" : ""}`}
                      onClick={() => handleSelectTest(test, "studiesManipulations")}
                    >
                      <span className="ht-tests-panel-name">{test.name?.ru || test.name?.en || ""}</span>
                    </button>
                  ))}
                </div>
              );
            })()}

            {isAppointmentsPanelOpen && (
              <div className="ht-appointments-panel">
                {isAppointmentsLoading ? (
                  <div className="ht-appointments-loading">
                    {t("history_tab.loading_appointments", { defaultValue: "Loading appointments..." })}
                  </div>
                ) : appointmentsError ? (
                  <div className="ht-appointments-error">{appointmentsError}</div>
                ) : (
                  <ul className="ht-appointments-list">
                    {application && (() => {
                      const _appSpec = application.doctors?.[0]?.specialization;
                      const name = (_appSpec && typeof _appSpec === "object" ? (_appSpec.name_ru || _appSpec.name_en) : _appSpec) || t("history_tab.current_appointment", { defaultValue: "Consultation" });
                      const date = application.date ? formatDate(application.date) : formatDate(application.createdAt);
                      const time = application.startTime
                        ? `${formatTime(application.startTime)}${application.endTime ? ` - ${formatTime(application.endTime)}` : ""}`
                        : "";
                      const isSelected = selectedConsultationId === application.applicationId;
                      return (
                        <li
                          className={`ht-appointment-item ht-appointment-item--current${isSelected ? " ht-appointment-item--selected" : ""}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleSelectPastAppointment(application.applicationId)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleSelectPastAppointment(application.applicationId); }}
                        >
                          <div className="ht-appointment-current-row">
                            <span className="ht-appointment-name">{name}</span>
                            <span className="ht-appointment-current-badge">
                              {t("history_tab.current_badge", { defaultValue: "Current" })}
                            </span>
                          </div>
                          <span className="ht-appointment-meta">{date}{time ? ` · ${time}` : ""}</span>
                        </li>
                      );
                    })()}
                    {patientAppointments.map((appt) => {
                      const apptId = appt.applicationId || appt._id;
                      const isSelected = selectedConsultationId === apptId;
                      const appointmentDate = appt.date ? formatDate(appt.date) : formatDate(appt.createdAt);
                      const appointmentTime = appt.startTime ? `${formatTime(appt.startTime)}${appt.endTime ? ` - ${formatTime(appt.endTime)}` : ""}` : "";
                      const _apptSpec = appt.doctors?.[0]?.specialization;
                      const label = (_apptSpec && typeof _apptSpec === "object" ? (_apptSpec.name_ru || _apptSpec.name_en) : _apptSpec) || t("history_tab.current_appointment", { defaultValue: "Consultation" });
                      return (
                        <li
                          key={apptId}
                          className={`ht-appointment-item${isSelected ? " ht-appointment-item--selected" : ""}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleSelectPastAppointment(apptId)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleSelectPastAppointment(apptId); }}
                        >
                          <span className="ht-appointment-name">{label}</span>
                          <span className="ht-appointment-meta">
                            {appointmentDate}
                            {appointmentTime ? ` · ${appointmentTime}` : ""}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </aside>
        )}

        <div className="ht-main-column" ref={containerRef}>
          {selectedTest ? (
            <div className="ht-td-page">
              {/* Header */}
              <div className="ht-td-header">
                <div className="ht-td-title-group">
                  <h2 className="ht-td-title">{selectedTest.name?.ru || selectedTest.name?.en || ""}</h2>
                  {selectedTest.name?.en && selectedTest.name?.ru && (
                    <span className="ht-td-subtitle">{selectedTest.name.en}</span>
                  )}
                </div>
                <button type="button" className="ht-td-btn" onClick={() => openAddModal(selectedTestMode, null)}>
                  <FiPlus size={14} />
                  {t("history_tab.add", { defaultValue: "Add" })}
                </button>
              </div>

              {/* Grouped entries */}
              {selectedTestFiles.length === 0 && selectedTestNotes.length === 0 ? null : (
                <div className="ht-td-list">
                  {groupTestItems(selectedTestFiles, selectedTestNotes, batchMap).map((group, gIdx) => {
                    const dt = group[0]?._time ? new Date(group[0]._time) : null;
                    const dateStr = dt ? `${String(dt.getDate()).padStart(2,"0")}-${String(dt.getMonth()+1).padStart(2,"0")}-${dt.getFullYear()}` : "";
                    const timeStr = dt ? `${String(dt.getHours()).padStart(2,"0")}:${String(dt.getMinutes()).padStart(2,"0")}` : "";
                    return (
                      <div key={gIdx} className="ht-td-group">
                        <div className="ht-td-group-items">
                          <div className="ht-td-group-card-header">
                            <div className="ht-td-group-date">
                              <FiClock size={11} />
                              <span>{dateStr} · {timeStr}</span>
                            </div>
                            <button type="button" className="ht-td-group-delete-btn" onClick={() => handleDeleteGroup(group)} aria-label="Delete group">
                              <FiTrash2 size={13} />
                            </button>
                          </div>
                          <div className="ht-td-group-grid">
                            {group.map((item) => item._type === "file" ? (
                              <div key={String(item.fileId)} className="ht-td-item">
                                <span className={`ht-td-badge ht-td-badge--${(item.fileName || "").split(".").pop().toLowerCase().slice(0, 5)}`}>
                                  {(item.fileName || "").split(".").pop().toUpperCase().slice(0, 5)}
                                </span>
                                <div className="ht-td-item-info">
                                  <span className="ht-td-item-name">{item.fileName}</span>
                                </div>
                                <div className="ht-td-item-actions">
                                  <button type="button" className="ht-td-icon-btn" onClick={() => handleViewTestFile(item.fileId)} aria-label="View"><FiEye size={14} /></button>
                                  <button type="button" className="ht-td-icon-btn" onClick={() => handleRemoveTestFile(item.fileId)} aria-label="Delete"><FiTrash2 size={14} /></button>
                                </div>
                              </div>
                            ) : (
                              <div key={String(item._id)} className="ht-td-item">
                                <span className="ht-td-note-icon"><FiFileText size={16} /></span>
                                <div className="ht-td-item-info">
                                  <div className="ht-td-item-name" dangerouslySetInnerHTML={{ __html: item.content }} />
                                </div>
                                <div className="ht-td-item-actions">
                                  <button type="button" className="ht-td-icon-btn" onClick={() => handleEditTestNote(item)} aria-label="Edit"><FiEdit2 size={14} /></button>
                                  <button type="button" className="ht-td-icon-btn" onClick={() => handleDeleteTestNote(item._id)} aria-label="Delete"><FiTrash2 size={14} /></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Note editor popup */}
              {showTestNoteEditor && createPortal(
                <>
                  <div className="ht-add-overlay" onClick={() => setShowTestNoteEditor(false)} />
                  <div className="ht-add-modal ht-add-modal--note">
                    <div className="ht-add-modal-header">
                      <span className="ht-add-modal-title">
                        {editingNoteId
                          ? t("history_tab.edit_note", { defaultValue: "Edit Note" })
                          : t("history_tab.add_note", { defaultValue: "Add Note" })}
                      </span>
                      <button type="button" className="ht-add-modal-close" onClick={() => setShowTestNoteEditor(false)}>
                        <FiX size={16} />
                      </button>
                    </div>
                    <div className="ht-add-step">
                      <div className="ht-add-rte-wrap">
                        <RichTextEditor
                          value={testNoteDraft}
                          onChange={(value) => setTestNoteDraft(value)}
                          placeholder={t("history_tab.enter_text", { defaultValue: "Enter text…" })}
                        />
                      </div>
                      <div className="ht-add-modal-footer">
                        <button type="button" className="ht-add-btn-secondary" onClick={() => setShowTestNoteEditor(false)}>
                          {t("history_tab.cancel", { defaultValue: "Cancel" })}
                        </button>
                        <button type="button" className="ht-add-btn-primary" onClick={handleSaveTestNote}>
                          {t("history_tab.save", { defaultValue: "Save" })}
                        </button>
                      </div>
                    </div>
                  </div>
                </>,
                document.body
              )}
            </div>
          ) : activeNavItem === "conclusion" ? (
            <div className="ht-conclusion-wrap">
              <AppointmentReport booking={application} patient={patient} pastConsultations={patientAppointments} />
            </div>
          ) : (activeNavItem === "laboratoryAnalysis" || activeNavItem === "studiesManipulations") && !selectedTest ? (() => {
            const allTests = activeNavItem === "laboratoryAnalysis" ? labTests : studyTests;
            const withFiles = allTests.filter((t) => (Array.isArray(t.files) && t.files.length > 0) || t.fileId);
            return (
              <div className="ht-lab-analysis-panel">
                {withFiles.length > 0 ? (
                  <div className="ht-lab-analysis-grid">
                    {allTests.map((test) => {
                      const isChecked = activeNavItem === "laboratoryAnalysis" ? !!selectedLabTests[test._id] : !!selectedStudyTests[test._id];
                      return (
                        <div
                          key={test._id}
                          className={`ht-lab-analysis-item ht-lab-analysis-item--selectable${isChecked ? " ht-lab-analysis-item--selected" : ""}`}
                          onClick={() => {
                            handleToggleLabTest(test._id, activeNavItem === "studiesManipulations");
                            handleSelectTest(test, activeNavItem);
                          }}
                        >
                          <div className="ht-lab-analysis-item-label">
                            <span className="lab-name-en">{test.name?.en || ""}</span>
                            {test.name?.ru && <span className="lab-name-ru">{test.name.ru}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="ht-lab-empty-view">
                    <div className="ht-lab-empty-add-row">
                      <button
                        type="button"
                        className="ht-lab-empty-btn"
                        onClick={() => openAddModal(activeNavItem, "")}
                      >
                        <FiPlus size={14} />
                        {t("history_tab.add", { defaultValue: "Add" })}
                      </button>
                    </div>
                    <div className="ht-lab-empty-card">
                      <span className="ht-lab-empty-card-text">
                        {t("history_tab.no_entries", { defaultValue: "No entries yet" })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })() : PANEL_NAV_IDS.includes(activeNavItem) ? (() => {
            const sid = activeNavItem;
            const fileRef = sid === "morphologicalResearch" ? morphFileRef : procFileRef;
            const sec = sectionData[sid] || { files: [], comment: {} };
            const files = sec.files || [];
            const commentValue = sec.comment?.value || "";
            return (
              <div className="ht-sp-page">
                {/* FILES section */}
                <div className="ht-sp-section">
                  <div className="ht-sp-section-header">
                    <span className="ht-sp-section-title">{t("history_tab.files_title", { defaultValue: "FILES" })}</span>
                    <button
                      type="button"
                      className="ht-sp-upload-btn"
                      onClick={() => fileRef.current?.click()}
                    >
                      <FiUpload size={13} />
                      {t("history_tab.upload_file", { defaultValue: "Upload file" })}
                    </button>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    className="ht-hidden-file-input"
                    onChange={(e) => handleSectionFileChange(sid, e)}
                  />
                  {sectionUploading[sid] && (
                    <div className="ht-td-uploading">{t("history_tab.uploading", { defaultValue: "Uploading…" })}</div>
                  )}
                  {files.length === 0 ? (
                    <div className="ht-sp-files-empty">{t("history_tab.no_files_uploaded", { defaultValue: "No files uploaded yet" })}</div>
                  ) : (
                    <div className="ht-sp-files-list">
                      {files.map((file) => {
                        const name = file.filename || file.fileName || "";
                        const ext = name.split(".").pop().toUpperCase().slice(0, 5);
                        const dt = file.uploadedAt ? new Date(file.uploadedAt) : null;
                        const dateStr = dt
                          ? `${String(dt.getDate()).padStart(2,"0")}-${String(dt.getMonth()+1).padStart(2,"0")}-${dt.getFullYear()}`
                          : "";
                        const timeStr = dt
                          ? `${String(dt.getHours()).padStart(2,"0")}:${String(dt.getMinutes()).padStart(2,"0")}`
                          : "";
                        const fid = String(file._id || file.fileId);
                        return (
                          <div key={fid} className="ht-sp-file-row">
                            <span className={`ht-td-badge ht-td-badge--${ext.toLowerCase()}`}>{ext}</span>
                            <div className="ht-sp-file-info">
                              <span className="ht-sp-file-name">{name}</span>
                              {dateStr && (
                                <span className="ht-sp-file-meta">
                                  <FiClock size={11} />{dateStr} · {timeStr}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              className="ht-td-icon-btn"
                              onClick={() => handleSectionFileRemove(sid, fid)}
                              aria-label="Remove"
                            >
                              <FiTrash2 size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* COMMENT section */}
                <div className="ht-sp-section">
                  <div className="ht-sp-section-header">
                    <span className="ht-sp-section-title">{t("history_tab.comment_title", { defaultValue: "COMMENT" })}</span>
                    <div className="ht-sp-header-actions">
                      {sectionDirty[sid] && (
                        <button
                          type="button"
                          className="ht-sp-save-btn"
                          onClick={() => handleSectionCommentSave(sid, sectionData[sid]?.comment?.value || "")}
                        >
                          <FiFileText size={13} />
                          {t("history_tab.save", { defaultValue: "Save" })}
                        </button>
                      )}
                      <button
                        type="button"
                        className="ht-sp-pdf-btn"
                        title={t("history_tab.export_pdf", { defaultValue: "Export PDF" })}
                        onClick={() => setSectionPdfModal({
                          title: SECTION_RU_LABELS[sid] || "",
                          commentHtml: commentValue,
                        })}
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="ht-sp-comment-editor">
                    <RichTextEditor
                      value={commentValue}
                      onChange={(val) => {
                        setSectionData((prev) => ({
                          ...prev,
                          [sid]: { ...prev[sid], comment: { ...prev[sid]?.comment, value: val } },
                        }));
                        setSectionDirty((prev) => ({ ...prev, [sid]: true }));
                      }}
                      placeholder={t("history_tab.enter_comment", { defaultValue: "Enter comment..." })}
                    />
                  </div>
                </div>
              </div>
            );
          })() : selectedConsultationId && selectedConsultationId !== application?.applicationId ? (
            selectedApptLoading ? (
              <div className="ht-past-appt-loading">{t("history_tab.loading_appointments", { defaultValue: "Loading..." })}</div>
            ) : selectedApptData ? (() => {
              const pastDocEmail = selectedApptData.doctorEmail || selectedApptData.doctor?.email;
              const currDocEmail = application?.doctorEmail;
              const isDifferentDoctor = pastDocEmail && currDocEmail && pastDocEmail !== currDocEmail;
              const pastDoc = selectedApptData.doctor;
              const pastDocName = pastDoc
                ? [pastDoc.lastName, pastDoc.firstName, pastDoc.middleName].filter(Boolean).join(" ")
                : selectedApptData.doctors?.[0]?.doctorName || null;
              const _pastSpec = selectedApptData.doctors?.[0]?.specialization;
              const pastDocSpec = _pastSpec && typeof _pastSpec === "object"
                ? (_pastSpec.name_ru || _pastSpec.name_en)
                : _pastSpec || null;
              return (
              <div className="ht-past-appt-view">
                <div className="ht-past-appt-header">
                  <div className="ht-past-appt-meta">
                    <span className="ht-past-appt-label">{t("history_tab.current_appointment", { defaultValue: "Consultation" })}</span>
                    <span className="ht-past-appt-date">
                      {selectedApptData.date ? formatDate(selectedApptData.date) : ""}
                      {selectedApptData.startTime ? ` · ${formatTime(selectedApptData.startTime)}${selectedApptData.endTime ? ` - ${formatTime(selectedApptData.endTime)}` : ""}` : ""}
                    </span>
                    {isDifferentDoctor && (pastDocName || pastDocSpec) && (
                      <span className="ht-past-appt-doctor">
                        {pastDocName && <span className="ht-past-appt-doctor-name">{pastDocName}</span>}
                        {pastDocSpec && <span className="ht-past-appt-doctor-spec">{pastDocSpec}</span>}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="ht-past-appt-back"
                    onClick={() => handleSelectPastAppointment(application?.applicationId)}
                  >
                    <FiX size={14} />
                    {t("history_tab.back_to_current", { defaultValue: "Back to current" })}
                  </button>
                </div>
                <div className="ht-view-toggle-bar">
                  <div className="ht-toggle-group">
                    <button
                      type="button"
                      className={`ht-view-toggle-btn${pastConsultationView === "normal" ? " ht-view-toggle-btn--active" : ""}`}
                      onClick={() => setPastConsultationView("normal")}
                    >
                      {t("history_tab.toggle_normal", { defaultValue: "Normal" })}
                    </button>
                    <button
                      type="button"
                      className={`ht-view-toggle-btn${pastConsultationView === "report" ? " ht-view-toggle-btn--active" : ""}`}
                      onClick={() => setPastConsultationView("report")}
                    >
                      {t("history_tab.toggle_report", { defaultValue: "Report" })}
                    </button>
                  </div>
                  {pastConsultationView === "report" && (
                    <button type="button" className="ht-dl-pdf-btn" onClick={() => pastReportRef.current?.download()}>
                      <Download size={14} />
                      {t("history_tab.download_pdf", { defaultValue: "Download PDF" })}
                    </button>
                  )}
                </div>
                {pastConsultationView === "report" ? (
                  <div className="ht-conclusion-wrap ht-conclusion-wrap--inline">
                    <AppointmentReport ref={pastReportRef} booking={selectedApptData} patient={patient} pastConsultations={patientAppointments} hideToolbar />
                  </div>
                ) : (() => {
                  const hf = selectedApptData.historyForm || {};
                  const filledPastFields = ALL_KEYS.filter((key) => {
                    const f = hf[key];
                    const v = typeof f === "object" ? f?.value : f;
                    return v?.replace(/<[^>]*>/g, "").trim();
                  });
                  return filledPastFields.length === 0 ? (
                    <div className="ht-empty-fields-msg">
                      {t("history_tab.no_fields_filled", { defaultValue: "The doctor has not filled in any fields yet." })}
                    </div>
                  ) : (
                    <div className="ht-view-fields">
                      {filledPastFields.map((key) => {
                        const f = hf[key];
                        const val = typeof f === "object" ? f?.value : f;
                        return (
                          <div key={key} className="ht-view-field">
                            <div className="ht-view-field-label">{t(KEY_TITLE_MAP[key])}</div>
                            <div className="ht-view-field-content" dangerouslySetInnerHTML={{ __html: val }} />
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
              );
            })() : (
              <div className="ht-past-appt-empty">{t("history_tab.no_history", { defaultValue: "No history form data for this appointment." })}</div>
            )
          ) : (
            <div className="ht-past-appt-view">
              <div className="ht-past-appt-header">
                <div className="ht-past-appt-meta">
                  <span className="ht-past-appt-label">{t("history_tab.current_appointment", { defaultValue: "Consultation" })}</span>
                  <span className="ht-past-appt-date">
                    {application?.date ? formatDate(application.date) : ""}
                    {application?.startTime ? ` · ${formatTime(application.startTime)}${application?.endTime ? ` - ${formatTime(application.endTime)}` : ""}` : ""}
                  </span>
                </div>
              </div>
              <div className="ht-view-toggle-bar">
                <div className="ht-toggle-group">
                  <button
                    type="button"
                    className={`ht-view-toggle-btn${consultationView === "normal" ? " ht-view-toggle-btn--active" : ""}`}
                    onClick={() => setConsultationView("normal")}
                  >
                    {t("history_tab.toggle_normal", { defaultValue: "Normal" })}
                  </button>
                  <button
                    type="button"
                    className={`ht-view-toggle-btn${consultationView === "report" ? " ht-view-toggle-btn--active" : ""}`}
                    onClick={() => setConsultationView("report")}
                  >
                    {t("history_tab.toggle_report", { defaultValue: "Report" })}
                  </button>
                </div>
                {consultationView === "report" && (
                  <button type="button" className="ht-dl-pdf-btn" onClick={() => currentReportRef.current?.download()}>
                    <Download size={14} />
                    {t("history_tab.download_pdf", { defaultValue: "Download PDF" })}
                  </button>
                )}
              </div>

              {consultationView === "report" ? (
                <div className="ht-conclusion-wrap ht-conclusion-wrap--inline">
                  <AppointmentReport ref={currentReportRef} booking={application} patient={patient} pastConsultations={patientAppointments} hideToolbar />
                </div>
              ) : (() => {
                const filledFields = ALL_KEYS.filter((key) => form[key]?.value?.replace(/<[^>]*>/g, "").trim());
                return filledFields.length === 0 ? (
                  <div className="ht-empty-fields-msg">
                    {t("history_tab.no_fields_filled", { defaultValue: "The doctor has not filled in any fields yet." })}
                  </div>
                ) : (
                  <div className="ht-view-wrap">
                    <div className="ht-view-fields">
                      {filledFields.map((key) => (
                        <div key={key} className="ht-view-field">
                          <div className="ht-view-field-label">{t(KEY_TITLE_MAP[key])}</div>
                          <div className="ht-view-field-content" dangerouslySetInnerHTML={{ __html: form[key]?.value }} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
      {labPopupOpen && createPortal(
        <div className="ht-portal-overlay" onClick={closeLabAnalysisPopup}>
          <div className="ht-portal-modal" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="ht-portal-header">
              <h2 className="ht-portal-title">
                {labPopupMode === "studiesManipulations"
                  ? t("history_tab.manage_study_tests", { defaultValue: "Studies / Manipulations" })
                  : t("history_tab.manage_tests", { defaultValue: "Laboratory Analysis" })}
              </h2>
              <button className="ht-portal-close" type="button" onClick={closeLabAnalysisPopup} aria-label="Close">
                ×
              </button>
            </div>

            {/* Form row: inputs + Add button */}
            <div className="ht-portal-form">
              <div className="ht-portal-inputs">
                <input
                  className="ht-portal-input"
                  type="text"
                  placeholder={t("history_tab.test_name_ru", { defaultValue: "Name (RU)" })}
                  value={newTestNameRU}
                  onChange={(e) => setNewTestNameRU(e.target.value)}
                />
                <input
                  className="ht-portal-input"
                  type="text"
                  placeholder={t("history_tab.test_name_en", { defaultValue: "Name (EN)" })}
                  value={newTestNameEN}
                  onChange={(e) => setNewTestNameEN(e.target.value)}
                />
              </div>
              <button className="ht-portal-add-btn" type="button" onClick={handleSaveTest}>
                <span className="ht-portal-add-plus">+</span>
                <span>{editingTestId ? t("history_tab.save", { defaultValue: "Save" }) : t("history_tab.add_btn", { defaultValue: "Add" })}</span>
              </button>
            </div>
            {editingTestId && (
              <button className="ht-portal-cancel-btn" type="button" onClick={cancelEditTest}>
                {t("history_tab.cancel", { defaultValue: "Cancel" })}
              </button>
            )}

            {/* Tests list */}
            <div className="ht-portal-list">
              {(labPopupMode === "studiesManipulations" ? studyTests : labTests).length > 0 ? (
                (labPopupMode === "studiesManipulations" ? studyTests : labTests).map((test) => (
                  <div
                    key={test._id}
                    className="ht-portal-item"
                    role="button"
                    onClick={() => { handleSelectTest(test, labPopupMode); closeLabAnalysisPopup(); }}
                  >
                    <div className="ht-portal-item-info">
                      <span className="ht-portal-item-name">{test.name?.ru || test.name?.en || ""}</span>
                      {test.name?.en && test.name?.ru && (
                        <span className="ht-portal-item-sub">{test.name.en}</span>
                      )}
                    </div>
                    <div className="ht-portal-item-actions">
                      <button
                        type="button"
                        className="ht-portal-icon-btn"
                        onClick={(e) => { e.stopPropagation(); openEditTest(test); }}
                        aria-label="Edit"
                      ><FiEdit2 size={14} /></button>
                      <button
                        type="button"
                        className="ht-portal-icon-btn"
                        onClick={(e) => { e.stopPropagation(); openDeleteConfirm(test); }}
                        aria-label="Delete"
                      ><FiTrash2 size={14} /></button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="ht-portal-empty">{t("history_tab.no_tests_yet", { defaultValue: "No items yet" })}</p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
      {labUploadModalOpen && createPortal(
        <div className="ht-portal-overlay" onClick={closeLabUploadModal}>
          <div className="ht-upload-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ht-upload-modal-header">
              <h2 className="ht-upload-modal-title">
                {t("history_tab.upload_file", { defaultValue: "Upload file" })}
              </h2>
              <button type="button" className="ht-portal-close" onClick={closeLabUploadModal} aria-label="Close">×</button>
            </div>
            <div className="ht-upload-modal-body">
              <label className="ht-upload-modal-label">
                {t("history_tab.select_test_label", { defaultValue: "Select test" })}
              </label>
              <select
                className="ht-upload-modal-select"
                value={labUploadTestId}
                onChange={(e) => setLabUploadTestId(e.target.value)}
              >
                <option value="">—</option>
                {(labUploadSection === "studiesManipulations" ? studyTests : labTests).map((test) => (
                  <option key={test._id} value={test._id}>
                    {test.name?.ru || test.name?.en || ""}
                  </option>
                ))}
              </select>
              <label className="ht-upload-modal-label">
                {t("history_tab.file_label", { defaultValue: "File" })}
              </label>
              <input
                type="file"
                className="ht-upload-modal-file"
                onChange={(e) => setLabUploadFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="ht-upload-modal-footer">
              <button type="button" className="ht-upload-modal-cancel" onClick={closeLabUploadModal}>
                {t("history_tab.cancel", { defaultValue: "Cancel" })}
              </button>
              <button
                type="button"
                className="ht-upload-modal-submit"
                onClick={handleLabUploadSubmit}
                disabled={isLabUploading}
              >
                {isLabUploading
                  ? t("history_tab.uploading", { defaultValue: "Uploading…" })
                  : t("history_tab.upload_btn", { defaultValue: "Upload" })}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {sectionPdfModal && (
        <SectionPDFModal
          title={sectionPdfModal.title}
          commentHtml={sectionPdfModal.commentHtml}
          files={sectionPdfModal.files || []}
          application={application}
          patient={patient}
          onClose={() => setSectionPdfModal(null)}
        />
      )}

      {addModalOpen && createPortal(
        <>
          <div className="ht-add-overlay" onClick={() => setAddModalOpen(false)} />
          <div className="ht-add-modal ht-add-modal--wide">
            <div className="ht-add-modal-header">
              <span className="ht-add-modal-title">
                {t("history_tab.add", { defaultValue: "Add" })}
              </span>
              <button type="button" className="ht-add-modal-close" onClick={() => setAddModalOpen(false)}>
                <FiX size={16} />
              </button>
            </div>

            <div className="ht-add-step">
              {/* ── Searchable test dropdown ── */}
              <div className="ht-add-section-label">
                {t("history_tab.select_test_label", { defaultValue: "Select test" })}
              </div>
              {(() => {
                const tests = addModalMode === "studiesManipulations" ? studyTests : labTests;
                const filtered = tests.filter((test) => {
                  const name = (test.name?.ru || test.name?.en || "").toLowerCase();
                  return name.includes(addModalSearchQ.toLowerCase());
                });
                const selected = tests.find((test) => test._id === addModalTestId);
                return (
                  <div className="ht-test-dropdown" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setAddModalDropOpen(false); }} tabIndex={-1}>
                    <div
                      className={`ht-test-dropdown-trigger${addModalDropOpen ? " open" : ""}`}
                      onClick={() => setAddModalDropOpen((p) => !p)}
                    >
                      <span className={selected ? "ht-test-dropdown-value" : "ht-test-dropdown-placeholder"}>
                        {selected ? (selected.name?.ru || selected.name?.en || "") : t("history_tab.select_test_placeholder", { defaultValue: "— select a test —" })}
                      </span>
                      <FiChevronDown size={14} style={{ flexShrink: 0, color: "#64748b", transform: addModalDropOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                    </div>
                    {addModalDropOpen && (
                      <div className="ht-test-dropdown-menu">
                        <div className="ht-test-dropdown-search-wrap">
                          <FiSearch size={13} className="ht-test-dropdown-search-icon" />
                          <input
                            autoFocus
                            className="ht-test-dropdown-search"
                            placeholder={t("history_tab.search_test", { defaultValue: "Search…" })}
                            value={addModalSearchQ}
                            onChange={(e) => setAddModalSearchQ(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        {filtered.length === 0 ? (
                          <div className="ht-test-dropdown-empty">
                            {t("history_tab.no_tests_yet", { defaultValue: "No tests found." })}
                          </div>
                        ) : (
                          filtered.map((test) => (
                            <div
                              key={test._id}
                              className={`ht-test-dropdown-item${addModalTestId === test._id ? " selected" : ""}`}
                              onMouseDown={() => { setAddModalTestId(test._id); setAddModalDropOpen(false); setAddModalSearchQ(""); }}
                            >
                              <span className="ht-test-dropdown-item-name">{test.name?.ru || test.name?.en || ""}</span>
                              {test.name?.en && test.name?.ru && (
                                <span className="ht-test-dropdown-item-sub">{test.name.en}</span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── File picker ── */}
              <div className="ht-add-section-label" style={{ marginTop: 8 }}>
                {t("history_tab.files_title", { defaultValue: "Files" })}
              </div>
              <div className="ht-add-file-zone" onClick={() => addFileInputRef.current?.click()}>
                <FiUpload size={20} style={{ color: "#94a3b8" }} />
                <span>{t("history_tab.click_to_upload", { defaultValue: "Click to choose files" })}</span>
              </div>
              <input
                ref={addFileInputRef}
                type="file"
                multiple
                className="ht-hidden-file-input"
                onChange={(e) => {
                  const picked = Array.from(e.target.files || []);
                  setAddModalFiles((prev) => [...prev, ...picked]);
                  e.target.value = "";
                }}
              />
              {addModalFiles.length > 0 && (
                <div className="ht-add-file-list">
                  {addModalFiles.map((f, i) => (
                    <div key={i} className="ht-add-file-item">
                      <span className="ht-add-file-name">{f.name}</span>
                      <button
                        type="button"
                        className="ht-add-file-remove"
                        onClick={() => setAddModalFiles((prev) => prev.filter((_, j) => j !== i))}
                      >
                        <FiX size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Text ── */}
              <div className="ht-add-section-label" style={{ marginTop: 8 }}>
                {t("history_tab.add_text", { defaultValue: "Text (optional)" })}
              </div>
              <div className="ht-add-rte-wrap">
                <RichTextEditor
                  value={addModalText}
                  onChange={(val) => setAddModalText(val)}
                  placeholder={t("history_tab.enter_text", { defaultValue: "Enter text…" })}
                />
              </div>

              <div className="ht-add-modal-footer">
                <button type="button" className="ht-add-btn-secondary" onClick={() => setAddModalOpen(false)}>
                  {t("history_tab.cancel", { defaultValue: "Cancel" })}
                </button>
                <button
                  type="button"
                  className="ht-add-btn-primary"
                  disabled={addModalSubmitting || !addModalTestId || (addModalFiles.length === 0 && !addModalText.trim())}
                  onClick={handleAddModalSubmit}
                >
                  {addModalSubmitting
                    ? t("history_tab.uploading", { defaultValue: "Uploading…" })
                    : t("history_tab.save", { defaultValue: "Save" })}
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}

      {deleteConfirmTest && createPortal(
        <div className="ht-delete-confirm-overlay">
          <div className="ht-delete-confirm-card">
            <p>
              {t("history_tab.confirm_delete_message", {
                defaultValue: "Are you sure you want to delete this test? This action cannot be undone.",
              })}
            </p>
            <div className="ht-delete-confirm-actions">
              <button type="button" className="ht-cancel-delete-btn" onClick={closeDeleteConfirm}>
                {t("history_tab.cancel", { defaultValue: "Cancel" })}
              </button>
              <button type="button" className="ht-confirm-delete-btn" onClick={handleConfirmDelete}>
                {t("history_tab.delete", { defaultValue: "Delete" })}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
});

export default HistoryTab;
