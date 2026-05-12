import React, { useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { FiChevronDown, FiSettings, FiEdit2, FiTrash2, FiEye, FiUpload, FiFileText, FiClock, FiX } from "react-icons/fi";
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
  getApplicationSection,
  uploadApplicationSectionFile,
  removeApplicationSectionFile,
  updateApplicationSectionComment,
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

function SectionPDFModal({ title, commentHtml, application, patient, onClose }) {
  const reportRef = useRef(null);
  const [generating, setGenerating] = useState(false);

  const fullName = [patient?.firstName, patient?.middleName, patient?.lastName]
    .filter(Boolean).join(" ").trim() || "—";
  const patientId = patient?.patientId || patient?._id || "—";
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
                <div className="ed-field-title" style={{ marginBottom: 12 }}>{title}</div>
                <div className="ed-section-content-text" dangerouslySetInnerHTML={{ __html: commentHtml || "<p>—</p>" }} />
              </div>
              <div className="ed-page-footer-patient">
                <span>ID: {patientId}</span>
                <span>{fullName}</span>
                <span>Страница 1</span>
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
  { id: "specialistConsultation", labelKey: "sidebar.specialistConsultation", icon: <FiChevronDown size={14} />, sectionId: "complaints" },
  { id: "laboratoryAnalysis", labelKey: "sidebar.laboratoryAnalysis", sectionId: "examinationPlan" },
  { id: "studiesManipulations", labelKey: "sidebar.studiesManipulations", sectionId: "physicalExam" },
  { id: "morphologicalResearch", labelKey: "sidebar.morphologicalResearch", sectionId: "examinationResults" },
  { id: "proceduresManipulations", labelKey: "sidebar.proceduresManipulations", sectionId: "treatmentPlan" },
  { id: "conclusion", labelKey: "sidebar.conclusion", sectionId: "clinicalDiagnosis" },
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
   
const HistoryTab = forwardRef(({ application, patient }, ref) => {
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
        setSelectedTest(null);
        setIsAppointmentsPanelOpen((prev) => !prev);
      } else if (item.id === "laboratoryAnalysis") {
        setIsLabPanelOpen((prev) => !prev);
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
        setIsStudyPanelOpen((prev) => !prev);
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
        setSelectedTest(null);
      }
    },
    [labTests, studyTests],
  );

  const appId = application?.applicationId;

  /* nav item id → Application schema field name */
  const SECTION_SCHEMA = {
    morphologicalResearch: "morphologicalResearch",
    proceduresManipulations: "proceduresAndManipulations",
  };
  const PANEL_NAV_IDS = Object.keys(SECTION_SCHEMA);

  useEffect(() => {
    if (!PANEL_NAV_IDS.includes(activeNavItem)) return;
    const schemaKey = SECTION_SCHEMA[activeNavItem];
    getApplicationSection(appId, schemaKey)
      .then((data) => {
        setSectionData((prev) => ({ ...prev, [activeNavItem]: data }));
        setSectionDirty((prev) => ({ ...prev, [activeNavItem]: false }));
      })
      .catch(() => {});
  }, [activeNavItem, appId]);

  const handleSectionFileChange = useCallback(async (navId, e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    const schemaKey = SECTION_SCHEMA[navId];
    setSectionUploading((prev) => ({ ...prev, [navId]: true }));
    try {
      for (const file of files) {
        const result = await uploadApplicationSectionFile(appId, schemaKey, file);
        setSectionData((prev) => ({ ...prev, [navId]: result.section }));
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || "Upload failed");
    } finally {
      setSectionUploading((prev) => ({ ...prev, [navId]: false }));
    }
  }, [appId]);

  const handleSectionFileRemove = useCallback(async (navId, fileId) => {
    const schemaKey = SECTION_SCHEMA[navId];
    try {
      const result = await removeApplicationSectionFile(appId, schemaKey, fileId);
      setSectionData((prev) => ({ ...prev, [navId]: result.section }));
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to remove file");
    }
  }, [appId]);

  const handleSectionCommentSave = useCallback(async (navId, value) => {
    const schemaKey = SECTION_SCHEMA[navId];
    try {
      const result = await updateApplicationSectionComment(appId, schemaKey, value);
      setSectionData((prev) => ({ ...prev, [navId]: result.section }));
      setSectionDirty((prev) => ({ ...prev, [navId]: false }));
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to save comment");
    }
  }, [appId]);

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

    try {
      const response = selectedTestMode === "studiesManipulations"
        ? await uploadApplicationInstrumentalAnalysisFile(selectedTest._id, file)
        : await uploadApplicationLaboratoryTestFile(selectedTest._id, file);
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
    try {
      const response = selectedTestMode === "studiesManipulations"
        ? await removeApplicationInstrumentalAnalysisFile(selectedTest._id, fileId)
        : await removeApplicationLaboratoryTestFile(selectedTest._id, fileId);
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
    try {
      const blob = selectedTestMode === "studiesManipulations"
        ? await fetchApplicationInstrumentalAnalysisFile(selectedTest._id, fileId)
        : await fetchApplicationLaboratoryTestFile(selectedTest._id, fileId);
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
    try {
      const response = selectedTestMode === "studiesManipulations"
        ? await deleteApplicationInstrumentalAnalysisNote(selectedTest._id, noteId)
        : await deleteApplicationLaboratoryTestNote(selectedTest._id, noteId);
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
    const fetchLabTests = async () => {
      try {
        const response = await getAllApplicationLaboratoryTests();
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
        const response = await getAllApplicationInstrumentalAnalysis();
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
  }, []);

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
  }, [application, form, t]);

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
                  <div className="ht-lab-analysis-header">
                    <span>
                      {activeNavItem === "laboratoryAnalysis"
                        ? t("history_tab.available_lab_analysis", { defaultValue: "Available Laboratory Analysis" })
                        : t("history_tab.available_studies", { defaultValue: "Available Studies & Manipulations" })}
                    </span>
                    <button
                      type="button"
                      className="ht-lab-analysis-manage-btn"
                      onClick={(e) => openLabAnalysisPopup(activeNavItem, e)}
                    >
                      {t("history_tab.manage_tests", { defaultValue: "Manage tests" })}
                    </button>
                  </div>
                  {(() => {
                    const allTests = activeNavItem === "laboratoryAnalysis" ? labTests : studyTests;
                    const withFiles = allTests.filter((t) => (Array.isArray(t.files) && t.files.length > 0) || t.fileId);
                    if (withFiles.length > 0) {
                      return (
                        <div className="ht-lab-analysis-grid">
                          {allTests.map((test) => (
                            <div
                              key={test._id}
                              className={`ht-lab-analysis-item ht-lab-analysis-item--selectable${selectedTest?._id === test._id ? " ht-lab-analysis-item--selected" : ""}`}
                            >
                              <label>
                                <input
                                  type="checkbox"
                                  checked={activeNavItem === "laboratoryAnalysis" ? !!selectedLabTests[test._id] : !!selectedStudyTests[test._id]}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleToggleLabTest(test._id, activeNavItem === "studiesManipulations");
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </label>
                              <div
                                className="ht-lab-analysis-item-label"
                                onClick={() => handleSelectTest(test, activeNavItem)}
                              >
                                <span>{test.name?.en || ""}</span>
                                <span>{test.name?.ru || ""}</span>
                              </div>
                            </div>
                          ))}
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
      <div className="ht-shell">
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

                {item.id === "laboratoryAnalysis" && isLabPanelOpen && (() => {
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

                {item.id === "studiesManipulations" && isStudyPanelOpen && (() => {
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

                {item.id === "specialistConsultation" && isAppointmentsPanelOpen && (
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
                          const name =
                            application.service?.name?.ru ||
                            application.service?.name?.en ||
                            (Array.isArray(application.services) && application.services[0]?.name?.ru) ||
                            (Array.isArray(application.services) && application.services[0]?.name?.en) ||
                            t("history_tab.current_appointment", { defaultValue: "Consultation" });
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
                          const label = t("history_tab.current_appointment", { defaultValue: "Consultation" });
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
              </React.Fragment>
            ))}
          </div>
        </aside>

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
                <button type="button" className="ht-td-close" onClick={handleCloseSelectedTest} aria-label="Close">
                  <FiX size={18} />
                </button>
              </div>

              {/* Actions */}
              <div className="ht-td-actions">
                <button type="button" className="ht-td-btn" onClick={(e) => openLabUploadModal(selectedTestMode, e, selectedTest?._id)}>
                  <FiUpload size={14} />
                  {t("history_tab.upload_file", { defaultValue: "Upload file" })}
                </button>
                <button type="button" className="ht-td-btn" onClick={handleOpenTestNoteEditor}>
                  <FiFileText size={14} />
                  {t("history_tab.add_text", { defaultValue: "Add text" })}
                </button>
              </div>

              <input ref={fileInputRef} type="file" multiple className="ht-hidden-file-input" onChange={handleTestFileChange} />
              {testFileUploadError && <div className="ht-error-message">{testFileUploadError}</div>}
              {isUploadingTestFile && <div className="ht-td-uploading">{t("history_tab.uploading", { defaultValue: "Uploading…" })}</div>}

              {/* Items list — files + notes interleaved */}
              <div className="ht-td-list">
                {selectedTestFiles.map((file) => {
                  const ext = (file.fileName || "").split(".").pop().toUpperCase().slice(0, 5);
                  const dt = file.uploadedAt ? new Date(file.uploadedAt) : null;
                  const dateStr = dt ? `${String(dt.getDate()).padStart(2,"0")}-${String(dt.getMonth()+1).padStart(2,"0")}-${dt.getFullYear()}` : "";
                  const timeStr = dt ? `${String(dt.getHours()).padStart(2,"0")}:${String(dt.getMinutes()).padStart(2,"0")}` : "";
                  return (
                    <div key={String(file.fileId)} className="ht-td-item">
                      <span className={`ht-td-badge ht-td-badge--${ext.toLowerCase()}`}>{ext}</span>
                      <div className="ht-td-item-info">
                        <span className="ht-td-item-name">{file.fileName}</span>
                        {dateStr && (
                          <span className="ht-td-item-meta"><FiClock size={11} />{dateStr} · {timeStr}</span>
                        )}
                      </div>
                      <div className="ht-td-item-actions">
                        <button type="button" className="ht-td-icon-btn" onClick={() => handleViewTestFile(file.fileId)} aria-label="View"><FiEye size={14} /></button>
                        <button type="button" className="ht-td-icon-btn" onClick={() => handleRemoveTestFile(file.fileId)} aria-label="Delete"><FiTrash2 size={14} /></button>
                      </div>
                    </div>
                  );
                })}

                {selectedTestNotes.map((note) => {
                  const dt = note.createdAt ? new Date(note.createdAt) : null;
                  const dateStr = dt ? `${String(dt.getDate()).padStart(2,"0")}-${String(dt.getMonth()+1).padStart(2,"0")}-${dt.getFullYear()}` : "";
                  const timeStr = dt ? `${String(dt.getHours()).padStart(2,"0")}:${String(dt.getMinutes()).padStart(2,"0")}` : "";
                  return (
                    <div key={String(note._id)} className="ht-td-item">
                      <span className="ht-td-note-icon"><FiFileText size={16} /></span>
                      <div className="ht-td-item-info">
                        <div className="ht-td-item-name" dangerouslySetInnerHTML={{ __html: note.content }} />
                        {dateStr && (
                          <span className="ht-td-item-meta"><FiClock size={11} />{dateStr} · {timeStr}</span>
                        )}
                      </div>
                      <div className="ht-td-item-actions">
                        <button type="button" className="ht-td-icon-btn" onClick={() => handleEditTestNote(note)} aria-label="Edit"><FiEdit2 size={14} /></button>
                        <button type="button" className="ht-td-icon-btn" onClick={() => handleDeleteTestNote(note._id)} aria-label="Delete"><FiTrash2 size={14} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Note editor */}
              {showTestNoteEditor && (
                <div className="ht-td-note-editor">
                  <RichTextEditor
                    value={testNoteDraft}
                    onChange={(value) => setTestNoteDraft(value)}
                    placeholder={t("history_tab.enter_text", { defaultValue: "Enter text…" })}
                  />
                  <div className="ht-td-note-editor-actions">
                    <button type="button" className="ht-td-save-btn" onClick={handleSaveTestNote}>
                      {t("history_tab.save", { defaultValue: "Save" })}
                    </button>
                    <button type="button" className="ht-td-cancel-btn" onClick={() => setShowTestNoteEditor(false)}>
                      {t("history_tab.cancel", { defaultValue: "Cancel" })}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : activeNavItem === "conclusion" ? (
            <div className="ht-conclusion-wrap">
              <AppointmentReport booking={application} pastConsultations={patientAppointments} />
            </div>
          ) : (activeNavItem === "laboratoryAnalysis" || activeNavItem === "studiesManipulations") && !selectedTest ? (() => {
            const allTests = activeNavItem === "laboratoryAnalysis" ? labTests : studyTests;
            const withFiles = allTests.filter((t) => (Array.isArray(t.files) && t.files.length > 0) || t.fileId);
            return (
              <div className="ht-lab-analysis-panel">
                <div className="ht-lab-analysis-header">
                  <span>
                    {activeNavItem === "laboratoryAnalysis"
                      ? t("history_tab.available_lab_analysis", { defaultValue: "Available Laboratory Analysis" })
                      : t("history_tab.available_studies", { defaultValue: "Available Studies & Manipulations" })}
                  </span>
                  <button
                    type="button"
                    className="ht-lab-analysis-manage-btn"
                    onClick={(e) => openLabAnalysisPopup(activeNavItem, e)}
                  >
                    {t("history_tab.manage_tests", { defaultValue: "Manage tests" })}
                  </button>
                </div>
                {withFiles.length > 0 ? (
                  <div className="ht-lab-analysis-grid">
                    {allTests.map((test) => (
                      <div
                        key={test._id}
                        className={`ht-lab-analysis-item ht-lab-analysis-item--selectable${selectedTest?._id === test._id ? " ht-lab-analysis-item--selected" : ""}`}
                      >
                        <label>
                          <input
                            type="checkbox"
                            checked={activeNavItem === "laboratoryAnalysis" ? !!selectedLabTests[test._id] : !!selectedStudyTests[test._id]}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleToggleLabTest(test._id, activeNavItem === "studiesManipulations");
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </label>
                        <div
                          className="ht-lab-analysis-item-label"
                          onClick={() => handleSelectTest(test, activeNavItem)}
                        >
                          <span>{test.name?.en || ""}</span>
                          <span>{test.name?.ru || ""}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="ht-lab-empty-view">
                    <div className="ht-lab-empty-actions">
                      <button
                        type="button"
                        className="ht-lab-empty-btn"
                        onClick={(e) => openLabUploadModal(activeNavItem, e)}
                      >
                        <FiUpload size={14} />
                        {t("history_tab.upload_file", { defaultValue: "Upload file" })}
                      </button>
                      <button
                        type="button"
                        className="ht-lab-empty-btn"
                        onClick={(e) => openLabAnalysisPopup(activeNavItem, e)}
                      >
                        <FiFileText size={14} />
                        {t("history_tab.add_text", { defaultValue: "Add text" })}
                      </button>
                    </div>
                    <div className="ht-lab-empty-card">
                      <span className="ht-lab-empty-card-text">
                        {t("history_tab.no_files", { defaultValue: "Нет файлов" })}
                      </span>
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
            ) : selectedApptData ? (
              <div className="ht-past-appt-view">
                <div className="ht-past-appt-header">
                  <div className="ht-past-appt-meta">
                    <span className="ht-past-appt-label">{t("history_tab.current_appointment", { defaultValue: "Consultation" })}</span>
                    <span className="ht-past-appt-date">
                      {selectedApptData.date ? formatDate(selectedApptData.date) : ""}
                      {selectedApptData.startTime ? ` · ${formatTime(selectedApptData.startTime)}${selectedApptData.endTime ? ` - ${formatTime(selectedApptData.endTime)}` : ""}` : ""}
                    </span>
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
                <div className="ht-view-fields">
                  {ALL_KEYS.map((key) => {
                    const hf = selectedApptData.historyForm || {};
                    const f = hf[key];
                    const val = typeof f === "object" ? f?.value : f;
                    if (!val?.replace(/<[^>]*>/g, "").trim()) return null;
                    return (
                      <div key={key} className="ht-view-field">
                        <div className="ht-view-field-label">{t(KEY_TITLE_MAP[key])}</div>
                        <div className="ht-view-field-content" dangerouslySetInnerHTML={{ __html: val }} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="ht-past-appt-empty">{t("history_tab.no_history", { defaultValue: "No history form data for this appointment." })}</div>
            )
          ) : isEditMode ? (
            <>
              <div className="ht-edit-toolbar">
                <button type="button" className="ht-view-mode-btn" onClick={enterViewMode}>
                  <FiEye size={14} />
                  {t("history_tab.view", { defaultValue: "View" })}
                </button>
              </div>
              <div className="ht-container">
                <div className="ht-first-appt-bar">
                  <label className="ht-first-appt-label">
                    <input
                      type="checkbox"
                      className="ht-first-appt-checkbox"
                      checked={!!form.isFirstAppointment}
                      onChange={(e) => setForm((prev) => ({ ...prev, isFirstAppointment: e.target.checked, isRepetitiveAppointment: e.target.checked ? false : prev.isRepetitiveAppointment }))}
                    />
                    <span>{t("first_appointment")}</span>
                  </label>
                  <label className="ht-first-appt-label">
                    <input
                      type="checkbox"
                      className="ht-first-appt-checkbox"
                      checked={!!form.isRepetitiveAppointment}
                      onChange={(e) => setForm((prev) => ({ ...prev, isRepetitiveAppointment: e.target.checked, isFirstAppointment: e.target.checked ? false : prev.isFirstAppointment }))}
                    />
                    <span>{t("repetitive_appointment")}</span>
                  </label>
                </div>
                {HISTORY_SECTIONS.map((s) => renderSection(s))}
              </div>
              <div className="ht-form-save-bar">
                <button
                  type="button"
                  className="ht-form-save-btn"
                  onClick={handleSaveForm}
                  disabled={isSavingForm}
                >
                  {isSavingForm
                    ? t("history_tab.saving", { defaultValue: "Saving..." })
                    : t("history_tab.save", { defaultValue: "Save" })}
                </button>
              </div>
            </>
          ) : (
            <div className="ht-view-wrap">
              <div className="ht-view-header" style={{ display: "none" }}>
              </div>
              <div className="ht-view-fields">
                {ALL_KEYS.map((key) => {
                  const val = form[key]?.value;
                  if (!val?.replace(/<[^>]*>/g, "").trim()) return null;
                  return (
                    <div key={key} className="ht-view-field">
                      <div className="ht-view-field-label">{t(KEY_TITLE_MAP[key])}</div>
                      <div className="ht-view-field-content" dangerouslySetInnerHTML={{ __html: val }} />
                    </div>
                  );
                })}
              </div>
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
          application={application}
          patient={patient}
          onClose={() => setSectionPdfModal(null)}
        />
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
