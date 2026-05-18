import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  getAppointmentById,
  updateAppointment,
  getEmailFromToken,
  updateAppointmentComments,
  addCommentInAppointment,
  deleteAppointmentComment,
  updateAppointmentPrescription,
  updateAppointmentConclusion,
  getDocument,
  getDoctorNameByEmail,
  updateVerificationStatus,
  getAvailableTests,
  addTestToAppointment,
  updateTestResult,
  addMultipleTestsToAppointment,
  getOrdersByIds,
  viewDocument,
  downloadDocument,
  viewResultDocument,
  downloadResultDocument,
  getPatientByPatientId,
  getPatientByEmail,
  getMedicalHistoryByEmail,
  getDoctorEarlyDetectionApplications,
  createTelemedicineRoom,
  joinTelemedicineRoom,
  endTelemedicineRoom,
  getTelemedicineRoomStatus,
  uploadDocumentFile,
  uploadDocumentUrl,
} from "../utils/api";
import api from "../utils/api";
import "../styles/AppointmentDetails.css";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import AppointmentPDFTemplate from "../components/AppointmentPDFTemplate";
import PatientDetailsTab from "../components/PatientDetailsTab";
import HistoryTab from "../components/HistoryTab";
import FollowUpsTab from "../components/FollowUpsTab";
import DocumentsTab from "../components/DocumentsTab";
import AppointmentReport from "./AppointmentReport";
import Service from "./Service";
import {
  FiCalendar,
  FiPhone,
  FiMail,
  FiClock,
  FiActivity,
  FiVideo,
  FiMessageSquare,
  FiCheckCircle,
  FiUser,
  FiMapPin,
  FiEdit2,
  FiPlus,
  FiX,
  FiSave,
  FiTrash2,
  FiArrowLeft,
  FiEye,
  FiDownload,
  FiXCircle,
  FiSquare,
  FiCheckSquare,
  FiUpload,
  FiClipboard,
  FiArrowDown,
  FiArrowUp,
  FiExternalLink,
  FiLink,
  FiSettings,
  FiFolder,
  FiRepeat,
} from "react-icons/fi";
import { GrDocumentTest } from "react-icons/gr";
import Modal from "react-modal";
import { useTranslation } from "react-i18next";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer, toast } from "react-toastify";
import Swal from "sweetalert2";
import axios from "axios";
import moment from "moment-timezone";
import { formatDateISO, formatTimeHHMM } from "../utils/dateFormat";
import CustomCalendar from "../components/CustomeCalendar";

const AppointmentDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const locationState = useLocation();
  const [appointment, setAppointment] = useState(null);
  const [patientDetails, setPatientDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [patientLoading, setPatientLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("appointment");
  const [activeSubTab, setActiveSubTab] = useState("patient");
  const [navOpen, setNavOpen] = useState(false);
  const [editing, setEditing] = useState({
    prescription: false,
    conclusion: false,
    comment: false,
  });
  const [editValues, setEditValues] = useState({
    prescription: "",
    conclusion: "",
  });
  const [newComment, setNewComment] = useState("");
  const doctorEmail = getEmailFromToken();
  const [documentPreviews, setDocumentPreviews] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [earlyDetectionAppointments, setEarlyDetectionAppointments] = useState([]);
  const [loadingEarlyDetection, setLoadingEarlyDetection] = useState(false);
  const [earlyDetectionError, setEarlyDetectionError] = useState(null);
  const [earlyDetectionFetched, setEarlyDetectionFetched] = useState(false);
  const [doctorNames, setDoctorNames] = useState({});
  const [comments, setComments] = useState([]);
  const { t, i18n } = useTranslation();

  // ensure moment uses current language for month names
  useEffect(() => {
    moment.locale(i18n.language);
  }, [i18n.language]);

  const formatLocalDate = (dateStr) => {
    if (!dateStr) return "";
    try {
      const iso = String(dateStr).split("T")[0];
      const [y, m, d] = iso.split("-").map(Number);
      if (!y || !m || !d) return dateStr;
      return `${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}-${y}`;
    } catch {
      return dateStr;
    }
  };

  const calculateAge = (dateStr) => {
    if (!dateStr) return null;
    const birth = new Date(dateStr);
    if (isNaN(birth)) return null;
    const now = new Date();
    let years = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) years--;
    if (years < 1) {
      const months =
        (now.getFullYear() - birth.getFullYear()) * 12 +
        now.getMonth() -
        birth.getMonth() -
        (now.getDate() < birth.getDate() ? 1 : 0);
      return months < 1 ? `${Math.max(0, now.getDate() - birth.getDate())}d` : `${months}mo`;
    }
    return years;
  };

  const translateStatus = (s) =>
    t(`appointmentStatus.${(s || "").toLowerCase()}`, s || "");
  const [showTestModal, setShowTestModal] = useState(false);
  const [availableTests, setAvailableTests] = useState([]);
  const [selectedTests, setSelectedTests] = useState([]);
  const [testResults, setTestResults] = useState({});
  const [loadingDocuments, setLoadingDocuments] = useState({});
  const [orders, setOrders] = useState([]);
  const [isMedicalHistoryOpen, setIsMedicalHistoryOpen] = useState(false);
  const [isPatientExpanded, setIsPatientExpanded] = useState(false);

  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [pastAppointments, setPastAppointments] = useState([]);
  const [joinLink, setJoinLink] = useState("");
  const [joiningMeeting, setJoiningMeeting] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [teleRoomStatus, setTeleRoomStatus] = useState(null); // { isActive, roomId, participantCount, meetingStatus }
  const [endingMeeting, setEndingMeeting] = useState(false);
  const [uploadMode, setUploadMode] = useState("file"); // "file" | "url"
  const [urlInput, setUrlInput] = useState("");
  const [urlFileName, setUrlFileName] = useState("");
  const baseUrl = import.meta.env.VITE_BASE_URL;

  // Hide global app sidebar while on appointment details page
  useEffect(() => {
    document.body.classList.add("hide-global-sidebar");
    return () => {
      document.body.classList.remove("hide-global-sidebar");
    };
  }, []);

  useEffect(() => {
    fetchAppointment();
    fetchAvailableTests();
  }, []); // runs only once

  const fetchTeleRoomStatus = async () => {
    if (!appointment?.applicationId) return;
    try {
      const data = await getTelemedicineRoomStatus(appointment.applicationId);
      setTeleRoomStatus(data);
    } catch {
      setTeleRoomStatus(null);
    }
  };

  // Fetch telemedicine room status when appointment is loaded
  useEffect(() => {
    if (appointment?.applicationId) {
      fetchTeleRoomStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointment?.applicationId]);

  useEffect(() => {
    const handleBodyClass = () => {
      if (isMedicalHistoryOpen) {
        document.body.classList.add("medical-history-open");
      } else {
        document.body.classList.remove("medical-history-open");
      }
    };
    handleBodyClass();
    return () => document.body.classList.remove("medical-history-open");
  }, [isMedicalHistoryOpen]);

  const fetchAppointment = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAppointmentById(id);
      setAppointment(data);
      setJoinLink(
        data?.meeting?.joinUrl ||
          data?.meeting?.doctorLink ||
          data?.meetingLink ||
          "",
      );
      setComments(data.comments || []);
      setEditValues({
        prescription: data.prescription?.text || "",
        conclusion: data.conclusion?.text || "",
      });
      if (data.documents?.length > 0) {
        await fetchDocumentPreviews(data.documents);
      }
      if (data.tests?.length > 0) {
        await fetchTestOrders(data.tests);
      }
      const pid = data.patientId || data.patient?.patientId;
      if (pid) {
        setPatientLoading(true);
        try {
          const patientData = await getPatientByPatientId(pid);
          setPatientDetails(patientData);
        } catch {
          try {
            if (data.patientEmail) {
              const patientData = await getPatientByEmail(data.patientEmail);
              setPatientDetails(patientData);
            }
          } catch (err) {
            toast.error(
              t("appointment.patientDetailsError") ||
                "Failed to load patient details",
            );
          }
        } finally {
          setPatientLoading(false);
        }
      } else if (data.patientEmail) {
        setPatientLoading(true);
        try {
          const patientData = await getPatientByEmail(data.patientEmail);
          setPatientDetails(patientData);
        } catch (err) {
          toast.error(
            t("appointment.patientDetailsError") ||
              "Failed to load patient details",
          );
        } finally {
          setPatientLoading(false);
        }
      }
    } catch (err) {
      // Fall back to router state data (e.g. dummy/local appointments)
      const stateData = locationState?.state?.appointmentData;
      if (stateData) {
        const normalized = {
          ...stateData,
          applicationId: stateData.applicationId || stateData.id || id,
          appointmentStatus:
            stateData.appointmentStatus || stateData.status || "unconfirmed",
          date: stateData.date || stateData.start,
          startTime: stateData.startTime || stateData.start,
          endTime: stateData.endTime || stateData.end,
          patientName:
            stateData.patientName ||
            stateData.title ||
            t("appointment.unknownPatient"),
          patientEmail: stateData.patientEmail || "",
          comments: stateData.comments || [],
          prescription: stateData.prescription || { text: "" },
          conclusion: stateData.conclusion || { text: "" },
          documents: stateData.documents || [],
          tests: stateData.tests || [],
        };
        setAppointment(normalized);
        setComments(normalized.comments);
        setEditValues({
          prescription: normalized.prescription?.text || "",
          conclusion: normalized.conclusion?.text || "",
        });
        setLoading(false);
        return;
      }
      setError(t("appointment.fetchError"));
      toast.error(t("appointment.fetchError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchMedicalHistory = async () => {
      if (appointment && appointment.patientEmail) {
        try {
          const response = await getMedicalHistoryByEmail(
            appointment.patientEmail,
          );
              const historyArray = Array.isArray(response?.data)
                ? response.data
                : [];
              const filteredAppointments = historyArray.filter(
                (record) => record.applicationId !== appointment.applicationId,
              );
              setPastAppointments(filteredAppointments);
        } catch (err) {
          console.error("Failed to fetch medical history:", err);
          toast.error(
            t("medicalHistory.fetchError") || "Failed to load medical history",
          );
        }
      }
    };
    fetchMedicalHistory();
  }, [appointment]);

  useEffect(() => {
    if (activeSubTab !== "overview") return;
    if (!doctorEmail) return;
    if (earlyDetectionFetched || loadingEarlyDetection) return;

    const fetchEarlyDetection = async () => {
      setLoadingEarlyDetection(true);
      setEarlyDetectionError(null);
      try {
        const response = await getDoctorEarlyDetectionApplications(doctorEmail);
        const data = Array.isArray(response?.data) ? response.data : [];
        setEarlyDetectionAppointments(data);
      } catch (err) {
        console.error("Failed to fetch early diagnosis appointments:", err);
        setEarlyDetectionError(
          t("appointment.earlyDiagnosisFetchError") ||
            "Failed to load early diagnosis appointments",
        );
      } finally {
        setLoadingEarlyDetection(false);
        setEarlyDetectionFetched(true);
      }
    };

    fetchEarlyDetection();
  }, [activeSubTab, doctorEmail, earlyDetectionFetched, loadingEarlyDetection]);

  const fetchTestOrders = async () => {
    try {
      const orders = await axios.get(
        `${baseUrl}/api/specialties/orders/${encodeURIComponent(
          appointment.applicationId,
        )}`,
        {
          headers: {
            Authorization: `Bearer ${api.defaults.headers.common["Authorization"]?.replace("Bearer ", "")}`,
          },
        },
      );
      setOrders(orders.data);
    } catch (err) {
      console.error("Failed to fetch test orders:", err);
      toast.error(t("appointment.toast.failedLoadTestInfo"));
    }
  };

  const fetchAvailableTests = async () => {
    try {
      const tests = await getAvailableTests();
      setAvailableTests(tests);
    } catch (err) {
      console.error("Failed to fetch test options", err);
      toast.error(t("appointment.toast.failedLoadTestOptions"));
    }
  };

  useEffect(() => {
    if (appointment && appointment.applicationId) {
      fetchTestOrders();
    }
  }, [appointment]);

  const handleTestSelection = (testId, testName) => {
    setSelectedTests((prev) => {
      const isSelected = prev.some((test) => test.testId === testId);
      if (isSelected) {
        return prev.filter((test) => test.testId !== testId);
      } else {
        return [...prev, { testId, testName, appointmentId: appointment._id }];
      }
    });
  };

  const handleSelectAllTests = () => {
    if (selectedTests.length === availableTests.length) {
      setSelectedTests([]);
    } else {
      setSelectedTests(
        availableTests.map((test) => ({
          testId: test._id,
          testName: test.name,
        })),
      );
    }
  };

  const handleAddTests = async () => {
    if (selectedTests.length === 0) return;
    try {
      await addMultipleTestsToAppointment(
        appointment.applicationId,
        selectedTests,
      );
      setSelectedTests([]);
      setShowTestModal(false);
      fetchAppointment();
      toast.success(`${selectedTests.length} test(s) added successfully`);
    } catch (err) {
      console.error("Failed to add tests", err);
      toast.error(t("appointment.toast.failedAddTests"));
    }
  };

  const handleResultChange = async (testName, value) => {
    try {
      await updateTestResult(appointment._id, testName, value);
      fetchAppointment();
      toast.success(t("appointment.toast.testResultUpdated"));
    } catch (err) {
      console.error("Failed to update test result:", err);
      toast.error(t("appointment.toast.failedUpdateTestResult"));
    }
  };

  const fetchDocumentPreviews = async (documents) => {
    try {
      const previews = documents
        .map((doc) => {
          const url =
            doc.url ||
            `${baseUrl}/api/applications/appointments/media/${doc.fileId}`;
          const name = doc.filename || t("appointment.documentFallback");
          const extFromName = name.split(".").pop()?.toLowerCase();
          const extFromUrl = url.split(".").pop()?.split("?")[0]?.toLowerCase();
          const type = extFromName || extFromUrl || "file";
          return {
            id: doc.fileId,
            name,
            type,
            verificationStatus: doc.verificationStatus,
            uploadedAt: doc.uploadedAt,
          };
        })
        .filter(Boolean);
      setDocumentPreviews(previews);
    } catch (err) {
      console.error("Error fetching document previews:", err);
      setError("Failed to load document previews.");
    }
  };

  const handleVerificationAction = async (type, targetId, fieldKey) => {
    const result = await Swal.fire({
      title: t("appointment.swal.verificationAction"),
      text: t("appointment.swal.approveOrDeny"),
      icon: "question",
      showCancelButton: true,
      confirmButtonText: t("appointment.swal.approve"),
      cancelButtonText: t("appointment.swal.deny"),
      reverseButtons: true,
    });
    if (result.dismiss === Swal.DismissReason.cancel) {
      await updateVerificationStatus(type, targetId, fieldKey, "Disapproved");
      toast.info(
        t("appointment.toast.markedAsDisapproved", { field: fieldKey }),
      );
    } else if (result.isConfirmed) {
      await updateVerificationStatus(type, targetId, fieldKey, "Verified");
      toast.success(
        t("appointment.toast.markedAsVerified", { field: fieldKey }),
      );
    }
    await fetchAppointment();
  };

  useEffect(() => {
    const fetchDoctorNames = async () => {
      const names = {};
      for (const comment of comments) {
        if (comment.role === "doctor" && !doctorNames[comment.email]) {
          try {
            const nameData = await getDoctorNameByEmail(comment.email);
            names[comment.email] = nameData;
          } catch (err) {
            names[comment.email] = { fullName: comment.email.split("@")[0] };
          }
        }
      }
      setDoctorNames((prev) => ({ ...prev, ...names }));
    };
    if (comments?.length) fetchDoctorNames();
  }, [comments]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) setSelectedFile(file);
  };

  const handleUploadConfirm = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      await uploadDocumentFile(appointment.applicationId, selectedFile);
      const updatedAppointment = await getAppointmentById(id);
      setAppointment(updatedAppointment);
      if (updatedAppointment.documents?.length > 0) {
        await fetchDocumentPreviews(updatedAppointment.documents);
      }
      toast.success(t("appointment.toast.documentUploaded"));
    } catch (err) {
      console.error("Error uploading document:", err);
      toast.error(t("appointment.toast.failedUploadDocument"));
    } finally {
      setSelectedFile(null);
      setUploading(false);
    }
  };

  const handleUploadCancel = () => {
    setSelectedFile(null);
  };

  const handleAddUrl = async () => {
    if (!urlInput.trim()) return;
    setUploading(true);
    try {
      await uploadDocumentUrl(appointment.applicationId, urlInput.trim(), urlFileName.trim() || urlInput.trim());
      const updatedAppointment = await getAppointmentById(id);
      setAppointment(updatedAppointment);
      if (updatedAppointment.documents?.length > 0) {
        await fetchDocumentPreviews(updatedAppointment.documents);
      }
      setUrlInput("");
      setUrlFileName("");
      toast.success(t("appointment.toast.documentUploaded"));
    } catch (err) {
      console.error("Error adding URL document:", err);
      toast.error(t("appointment.toast.failedUploadDocument"));
    } finally {
      setUploading(false);
    }
  };

  const handleEditToggle = (field) => {
    setEditing((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleEditChange = (field, value) => {
    setEditValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSavePrescription = async () => {
    try {
      const updatedAppointment = await updateAppointmentPrescription(
        id,
        editValues.prescription,
      );
      setAppointment(updatedAppointment);
      setEditing((prev) => ({ ...prev, prescription: false }));
      toast.success(t("appointment.prescriptionSaved"));
    } catch (err) {
      console.error("Error updating prescription:", err);
      setError(t("appointment.toast.failedUpdatePrescription"));
      toast.error(t("appointment.toast.failedUpdatePrescription"));
    }
  };

  const handleSaveConclusion = async () => {
    try {
      const updatedAppointment = await updateAppointmentConclusion(
        id,
        editValues.conclusion,
      );
      setAppointment(updatedAppointment);
      setEditing((prev) => ({ ...prev, conclusion: false }));
      toast.success(t("appointment.conclusionSaved"));
    } catch (err) {
      console.error("Error updating conclusion:", err);
      setError(t("appointment.toast.failedUpdateConclusion"));
      toast.error(t("appointment.toast.failedUpdateConclusion"));
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      const comment = {
        text: newComment,
        role: "doctor",
        email: doctorEmail,
        timestamp: new Date().toISOString(),
      };
      const updatedComments = [...(appointment.comments || []), comment];
      const data = await addCommentInAppointment(id, updatedComments);
      setAppointment(data);
      setNewComment("");
      setEditing((prev) => ({ ...prev, comment: false }));
      toast.success(t("appointment.toast.commentAdded"));
    } catch (err) {
      console.error("Error adding comment:", err);
      setError(t("appointment.toast.failedAddComment"));
      toast.error(t("appointment.toast.failedAddComment"));
    }
  };

  const handleDeleteComment = async (commentId) => {
    const result = await Swal.fire({
      title: t("appointment.swal.areYouSure"),
      text: t("appointment.swal.cantRevert"),
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: t("appointment.swal.yesDeleteIt"),
    });
    if (!result.isConfirmed) return;
    try {
      const updatedComments = appointment.comments.filter(
        (comment) => comment._id !== commentId,
      );
      setAppointment((prev) => ({ ...prev, comments: updatedComments }));
      await deleteAppointmentComment(id, commentId);
      Swal.fire({
        title: t("appointment.swal.deleted"),
        text: t("appointment.swal.commentDeleted"),
        icon: "success",
      });
    } catch (err) {
      console.error("Error deleting comment:", err);
      setError(t("appointment.swal.failedDeleteComment"));
      Swal.fire({
        title: t("appointment.swal.error"),
        text: t("appointment.swal.failedDeleteComment"),
        icon: "error",
      });
    }
  };

  const formatRelativeTime = (timestamp) => {
    const now = new Date();
    const date = new Date(timestamp);
    const seconds = Math.floor((now - date) / 1000);
    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60,
    };
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInUnit);
      if (interval >= 1) {
        return interval === 1
          ? `${interval} ${unit} ago`
          : `${interval} ${unit}s ago`;
      }
    }
    return "Just now";
  };

  const generateAndDownloadPDF = async () => {
    const element = document.getElementById("appointment-pdf-content");
    element.style.display = "block";
    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Appointment_${id}.pdf`);
    element.style.display = "none";
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "var(--app-detail-success)";
      case "cancelled":
        return "var(--app-detail-error)";
      case "upcoming":
      case "unconfirmed":
        return "var(--app-detail-warning)";
      default:
        return "var(--app-detail-info)";
    }
  };

  const handleTestResultUpload = async (orderId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("appointmentId", appointment.applicationId);
    formData.append("testId", orderId);
    try {
      await axios.post(
        `${baseUrl}/api/applications/tests/upload-result`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            "x-auth-token": api.defaults.headers.common["Authorization"]?.replace("Bearer ", ""),
          },
        },
      );
      fetchTestOrders();
      toast.success(t("appointment.toast.testResultUploaded"));
    } catch (err) {
      console.error("Failed to upload result file:", err);
      toast.error(t("appointment.toast.failedUploadResultFile"));
    }
  };

  const handleResultView = async (order, e) => {
    e.stopPropagation();
    setLoadingDocuments((prev) => ({ ...prev, [`view-${order.id}`]: true }));
    try {
      await viewResultDocument(order.resultFileId);
    } catch (error) {
      toast.error(
        `Failed to view document: ${error.response?.data?.message || error.message}`,
      );
    } finally {
      setLoadingDocuments((prev) => ({ ...prev, [`view-${order.id}`]: false }));
    }
  };

  const handleResultDownload = async (order, e) => {
    e.stopPropagation();
    setLoadingDocuments((prev) => ({
      ...prev,
      [`download-${order.id}`]: true,
    }));
    try {
      await downloadResultDocument(
        order.resultFileId,
        order.filename || order.name || "document",
      );
    } catch (error) {
      toast.error(
        `Failed to download document: ${error.response?.data?.message || error.message}`,
      );
    } finally {
      setLoadingDocuments((prev) => ({
        ...prev,
        [`download-${order.id}`]: false,
      }));
    }
  };

  const handleView = async (doc, e) => {
    e.stopPropagation();
    setLoadingDocuments((prev) => ({ ...prev, [`view-${doc.id}`]: true }));
    try {
      await viewDocument(doc.id);
    } catch (error) {
      toast.error(
        `Failed to view document: ${error.response?.data?.message || error.message}`,
      );
    } finally {
      setLoadingDocuments((prev) => ({ ...prev, [`view-${doc.id}`]: false }));
    }
  };

  const handleDownload = async (doc, e) => {
    e.stopPropagation();
    setLoadingDocuments((prev) => ({ ...prev, [`download-${doc.id}`]: true }));
    try {
      await downloadDocument(doc.id, doc.filename || doc.name || "document");
    } catch (error) {
      toast.error(
        `Failed to download document: ${error.response?.data?.message || error.message}`,
      );
    } finally {
      setLoadingDocuments((prev) => ({
        ...prev,
        [`download-${doc.id}`]: false,
      }));
    }
  };

  const handleJoinMeeting = async () => {
    if (!appointment?.applicationId) return;

    // open blank window immediately to preserve user gesture
    let popup = window.open("", "_blank");
    if (!popup) {
      setJoinError("Popup blocked. Please allow popups for this site.");
      return;
    }

    try {
      setJoinError("");
      setJoiningMeeting(true);

      // create room
      await createTelemedicineRoom(appointment.applicationId);

      const doctorName =
        appointment?.doctor?.name ||
        `${appointment?.doctor?.firstName || ""} ${appointment?.doctor?.lastName || ""}`.trim() ||
        appointment?.doctorEmail ||
        t("appointment.doctor");

      const joinData = await joinTelemedicineRoom(appointment.applicationId, {
        role: "doctor",
        name: doctorName,
      });

      const url = joinData?.joinUrl || "";
      setJoinLink(url);

      if (url) {
        const meetingTitle = `${doctorName} - ${t("appointment.consultation")}`;
        const targetUrl = `/meeting-room?link=${encodeURIComponent(url)}&role=${encodeURIComponent(
          "doctor",
        )}&title=${encodeURIComponent(meetingTitle)}`;
        popup.location.href = targetUrl;
      } else {
        popup.close();
        setJoinError("No join URL returned from server");
      }
    } catch (err) {
      popup.close();
      setJoinError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to start telemedicine session",
      );
    } finally {
      setJoiningMeeting(false);
      fetchTeleRoomStatus();
    }
  };

  const handleEndMeeting = async () => {
    if (!appointment?.applicationId) return;
    try {
      setEndingMeeting(true);
      await endTelemedicineRoom(appointment.applicationId);
      toast.success(t("appointment.meetingEnded") || "Meeting ended");
      fetchTeleRoomStatus();
      fetchAppointment();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to end meeting");
    } finally {
      setEndingMeeting(false);
    }
  };

  const renderTests = () => {
    if (!orders || orders.length === 0) {
      return (
        <div className="app-detail-empty-state">{t("appointment.noTests")}</div>
      );
    }
    return orders.map((order, index) => {
      const status = order.status || "Ordered";
      const statusClass = `app-detail-test-status ${status.toLowerCase().replace(/&/g, "").replace(/\s+/g, "-")}`;
      const statusMap = {
        Ordered: t("appointment.statusOrdered"),
        "Under Review": t("appointment.statusUnderReview"),
        Verified: t("appointment.statusVerified"),
        Disapproved: t("appointment.statusDisapproved"),
      };
      return (
        <div key={order._id || index} className="app-detail-test-card">
          <div className="app-detail-test-info">
            <span className="app-detail-test-name">{order.testName}</span>
            {order.uploadedAt && (
              <span className="app-detail-test-date">
                {t("appointment.uploadedAt")}:{" "}
                {`${formatDateISO(order.uploadedAt)} ${formatTimeHHMM(order.uploadedAt)}` }
              </span>
            )}
            <span className={statusClass}>{statusMap[status] || status}</span>
          </div>
          {order.resultFileId &&
          status !== "Reupload Requested" &&
          status !== "Waiting for Approval" ? (
            <div className="app-detail-document-actions">
              <button
                onClick={(e) => handleResultView(order, e)}
                disabled={loadingDocuments[`view-${order.resultFileId}`]}
                className="app-detail-primary-btn"
              >
                <FiEye size={14} /> {t("appointment.view")}
              </button>
              <button
                onClick={(e) => handleResultDownload(order, e)}
                disabled={loadingDocuments[`download-${order.resultFileId}`]}
                className="app-detail-secondary-btn"
              >
                <FiDownload size={14} /> {t("appointment.download")}
              </button>
            </div>
          ) : (
            status !== "Ordered" &&
            status !== "Waiting for Assign" &&
            status !== "Reupload Requested" &&
            status !== "Waiting for Approval" && (
              <div className="app-detail-upload-controls">
                <label className="app-detail-test-upload-btn">
                  <FiUpload size={14} />
                  <input
                    type="file"
                    className="app-detail-file-input"
                    onChange={(e) =>
                      handleTestResultUpload(order.testId, e.target.files[0])
                    }
                  />
                  {t("appointment.uploadResult")}
                </label>
              </div>
            )
          )}
        </div>
      );
    });
  };

  if (loading) {
    return (
      <div className="app-detail-loading-container">
        <div className="app-detail-loading-spinner"></div>
        <p>{t("appointment.loading")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-detail-error-container">
        <div className="app-detail-error-icon">⚠️</div>
        <p>{error}</p>
        <button
          className="app-detail-retry-btn"
          onClick={() => window.location.reload()}
        >
          {t("appointment.tryAgain")}
        </button>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="app-detail-empty-state">
        <h3>{t("appointment.noAppointments")}</h3>
        <p>{t("appointment.noAppointment")}</p>
      </div>
    );
  }

  const {
    date,
    startTime,
    endTime,
    serviceType,
    appointmentMode,
    meetingLink,
    prescription,
    conclusion,
    appointmentStatus,
    doctor,
    location,
  } = appointment;
  const meetingUrl = joinLink || appointment?.meeting?.joinUrl || meetingLink;
  const meetingRoomId = appointment?.meeting?.roomId;

  const patientFullName = patientDetails
    ? [
        patientDetails.firstName,
        patientDetails.middleName,
        patientDetails.lastName,
      ]
        .filter(Boolean)
        .join(" ")
        .trim() || "—"
    : appointment?.patientEmail?.split("@")[0] || "—";
  const formattedDob = patientDetails?.dateOfBirth
    ? formatLocalDate(patientDetails.dateOfBirth)
    : null;
  const age = calculateAge(patientDetails?.dateOfBirth);

  return (
    <div className={`app-detail-modern-container${navOpen ? " nav-open" : ""}`}>
      <ToastContainer position="top-right" autoClose={3000} />

      {/* === Full-width patient header bar === */}
      <div className="apd-top-bar">
        <div className="apd-top-bar-left">
          <button
            className="apd-back-btn"
            onClick={() => navigate("/appointments")}
          >
            <FiArrowLeft className="icon" size={16} />
            <span>{t("appointment.backToSchedule")}</span>
          </button>
          <div className="apd-top-divider" />
          <div className="apd-patient-info">
            <div className="apd-patient-name-row">
              {patientDetails?.gender?.toLowerCase() === "male" && (
                <span className="apd-header-gender-icon apd-header-gender-icon--male">♂</span>
              )}
              {patientDetails?.gender?.toLowerCase() === "female" && (
                <span className="apd-header-gender-icon apd-header-gender-icon--female">♀</span>
              )}
              <span className="apd-patient-label">
                {t("appointment.patient")}:
              </span>
              <strong className="apd-patient-name">{patientFullName}</strong>
              {patientDetails?.status && (
                <span
                  className={`apd-status-badge apd-status-${patientDetails.status.toLowerCase()}`}
                >
                  {patientDetails.status}
                </span>
              )}
            </div>
            <div className="apd-patient-meta">
              No.{appointment.applicationId}
              {appointment?.createdAt && (
                <>
                  {" "}
                  &middot; {t("addedToSystemOn")}{" "}
                  {formatDateISO(appointment.createdAt)}
                </>
              )}
            </div>
          </div>
        </div>
        {formattedDob && (
          <div className="apd-top-bar-right">
            <div className="apd-dob-row">
              <span className="apd-dob-date">{formattedDob}</span>
              {age !== null && age !== undefined && (
                <span className="apd-age-badge">{age} y.o.</span>
              )}
            </div>
            <span className="apd-dob-label">
              {t("pdtab.basic.dateOfBirth")}
            </span>
          </div>
        )}
      </div>

      {/* === Page Layout: Left vertical tabs + Right Column === */}
      <div className="app-detail-page-layout">
        <nav className={`sub-sidebar${navOpen ? " sub-sidebar--open" : ""}`} aria-label="Appointment sections">
          <button
            className="sub-sidebar-toggle"
            onClick={() => setNavOpen((o) => !o)}
            title={navOpen ? "Collapse" : "Expand"}
          >
            <span className="sub-sidebar-toggle-icon">{navOpen ? "‹" : "›"}</span>
          </button>
          <button
            title={t("appointment.patient")}
            className={`sidebar-tab${activeSubTab === "patient" ? " active" : ""}`}
            onClick={() => setActiveSubTab("patient")}
          >
            <FiUser size={18} />
            {navOpen && <span className="sidebar-tab-label">{t("appointment.patient")}</span>}
          </button>
          <button
            title={t("appointment.medicalHistory")}
            className={`sidebar-tab${activeSubTab === "history" ? " active" : ""}`}
            onClick={() => setActiveSubTab("history")}
          >
            <FiClock size={18} />
            {navOpen && <span className="sidebar-tab-label">{t("appointment.medicalHistory")}</span>}
          </button>
          <button
            title={t("appointment.service")}
            className={`sidebar-tab${activeSubTab === "service" ? " active" : ""}`}
            onClick={() => setActiveSubTab("service")}
          >
            <FiSettings size={18} />
            {navOpen && <span className="sidebar-tab-label">{t("appointment.service")}</span>}
          </button>
          <button
            title={t("appointment.documents")}
            className={`sidebar-tab${activeSubTab === "documents" ? " active" : ""}`}
            onClick={() => setActiveSubTab("documents")}
          >
            <FiFolder size={18} />
            {navOpen && <span className="sidebar-tab-label">{t("appointment.documents")}</span>}
          </button>
          <button
            title={t("appointment.followUp")}
            className={`sidebar-tab${activeSubTab === "followup" ? " active" : ""}`}
            onClick={() => setActiveSubTab("followup")}
          >
            <FiRepeat size={18} />
            {navOpen && <span className="sidebar-tab-label">{t("appointment.followUp")}</span>}
          </button>
        </nav>
        <div className="app-detail-right-column">
          {/* Main body */}
          <div className="app-detail-main-body flex-layout">
            {/* Right content */}
            <div className="app-detail-main-container with-history">
              {/* Dynamic content area (no vertical icon nav) */}
              <div className="app-detail-content-area">
                {/* Patient sub-tab */}
                {activeSubTab === "patient" && (
                  <PatientDetailsTab
                    application={appointment}
                    patient={patientDetails}
                    onRefresh={async () => {
                      const pid = appointment?.patientId || appointment?.patient?.patientId;
                      try {
                        const pd = pid
                          ? await getPatientByPatientId(pid)
                          : await getPatientByEmail(appointment.patientEmail);
                        setPatientDetails(pd);
                      } catch (e) {
                        /* silent */
                      }
                    }}
                  />
                )}
                {activeSubTab === "history" && (
                  <HistoryTab
                    application={appointment}
                    patient={patientDetails}
                    onSaved={(saved) => setAppointment((prev) => ({ ...prev, historyForm: saved }))}
                  />
                )}


                {activeSubTab === "documents" && (
                  <div className="app-detail-docs-container">
                    <DocumentsTab application={appointment} />
                  </div>
                )}

                {false && (
                  <div className="app-detail-docs-container">
                    {/* Upload bar */}
                    <div className="app-detail-docs-upload-bar">
                      <label className="app-detail-docs-choose-btn primary">
                        <input
                          type="file"
                          onChange={(e) => {
                            handleFileSelect(e);
                            setUploadMode("file");
                          }}
                          className="app-detail-file-input"
                          disabled={uploading}
                        />
                        <FiUpload size={14} />
                        {t("appointment.chooseFile") || "Choose file"}
                      </label>

                      <button
                        className={`app-detail-docs-url-toggle${uploadMode === "url" ? " active" : ""}`}
                        onClick={() => {
                          setUploadMode((m) => (m === "url" ? "file" : "url"));
                          setSelectedFile(null);
                        }}
                      >
                        <FiLink size={14} />
                        URL
                      </button>

                      {uploadMode === "url" && (
                        <input
                          type="text"
                          className="app-detail-docs-url-input"
                          placeholder="https://..."
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                        />
                      )}

                      {uploadMode === "file" && !selectedFile && (
                        <label className="app-detail-docs-choose-btn secondary">
                          <input
                            type="file"
                            onChange={handleFileSelect}
                            className="app-detail-file-input"
                            disabled={uploading}
                          />
                          <FiUpload size={14} />
                          {t("appointment.chooseFile") || "Choose file"}
                        </label>
                      )}

                      {uploadMode === "file" && selectedFile && (
                        <span className="app-detail-docs-selected-name">
                          {selectedFile.name}{" "}
                          <span className="app-detail-docs-selected-size">
                            ({(selectedFile.size / 1024).toFixed(1)} KB)
                          </span>
                        </span>
                      )}

                      <button
                        className="app-detail-docs-add-btn"
                        onClick={
                          uploadMode === "url"
                            ? handleAddUrl
                            : handleUploadConfirm
                        }
                        disabled={
                          uploading ||
                          (uploadMode === "file"
                            ? !selectedFile
                            : !urlInput.trim())
                        }
                      >
                        {uploading
                          ? t("appointment.uploading")
                          : t("appointment.add") || "Add"}
                      </button>

                      {(selectedFile || (uploadMode === "url" && urlInput)) && (
                        <button
                          className="app-detail-docs-cancel-btn"
                          onClick={() => {
                            setSelectedFile(null);
                            setUrlInput("");
                          }}
                          disabled={uploading}
                        >
                          <FiX size={14} />
                        </button>
                      )}
                    </div>

                    {/* Documents list */}
                    <div className="app-detail-docs-list">
                      {documentPreviews.length > 0 ? (
                        documentPreviews.map((doc) => {
                          const isImg = [
                            "jpg",
                            "jpeg",
                            "png",
                            "gif",
                            "webp",
                          ].includes(doc.type);
                          const typeBadge =
                            doc.type === "pdf" ? "PDF" : isImg ? "IMG" : "FILE";
                          const typeCls =
                            doc.type === "pdf" ? "pdf" : isImg ? "img" : "file";
                          return (
                            <div key={doc.id} className="app-detail-doc-row">
                              <div
                                className={`app-detail-doc-type-badge ${typeCls}`}
                              >
                                {typeBadge}
                              </div>
                              <div className="app-detail-doc-info">
                                <span className="app-detail-doc-name">
                                  {doc.name}
                                </span>
                                <span className="app-detail-doc-date">
                                  {doc.uploadedAt
                                    ? `${formatDateISO(doc.uploadedAt)} ${formatTimeHHMM(doc.uploadedAt)}`
                                    : t("appointment.noUploadTime")}
                                </span>
                              </div>
                              <div className="app-detail-doc-status-col">
                                {doc.verificationStatus === "Under Review" ? (
                                  <button
                                    className="app-detail-doc-status-badge under-review"
                                    onClick={() =>
                                      handleVerificationAction(
                                        "document",
                                        appointment._id,
                                        doc.id,
                                      )
                                    }
                                  >
                                    <FiClock size={13} />
                                    {t("appointment.statusUnderReview")}
                                  </button>
                                ) : (
                                  <span
                                    className={`app-detail-doc-status-badge ${doc.verificationStatus?.toLowerCase().replace(" ", "-")}`}
                                  >
                                    {doc.verificationStatus === "Verified" && (
                                      <>
                                        <FiCheckCircle size={13} />{" "}
                                        {t("appointment.statusVerified")}
                                      </>
                                    )}
                                    {doc.verificationStatus ===
                                      "Disapproved" && (
                                      <>
                                        <FiXCircle size={13} />{" "}
                                        {t("appointment.statusDisapproved")}
                                      </>
                                    )}
                                  </span>
                                )}
                              </div>
                              <div className="app-detail-doc-actions-col">
                                <button
                                  className="app-detail-doc-view-btn"
                                  onClick={(e) => handleView(doc, e)}
                                  disabled={loadingDocuments[`view-${doc.id}`]}
                                >
                                  <FiEye size={14} /> {t("appointment.view")}
                                </button>
                                {!doc.isUrl && (
                                  <button
                                    className="app-detail-doc-download-btn"
                                    onClick={(e) => handleDownload(doc, e)}
                                    disabled={
                                      loadingDocuments[`download-${doc.id}`]
                                    }
                                  >
                                    <FiDownload size={14} />{" "}
                                    {t("appointment.download")}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="app-detail-empty-state">
                          <p>{t("appointment.noDocuments")}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeSubTab === "tests" && (
                  <div className="app-detail-section-container">
                    <div className="app-detail-section-header">
                      <h3>{t("appointment.testResults")}</h3>
                      <button
                        className="app-detail-primary-btn"
                        onClick={() => setShowTestModal(true)}
                      >
                        <FiPlus size={16} /> {t("appointment.addTest")}
                      </button>
                    </div>
                    <div className="app-detail-tests-grid">{renderTests()}</div>
                  </div>
                )}


                {activeSubTab === "comments" && (
                  <div className="app-detail-section-container">
                    <div className="app-detail-section-header">
                      <h3>
                        {t("appointment.comments")} ({comments.length})
                      </h3>
                      <button
                        className="app-detail-primary-btn"
                        onClick={() =>
                          setEditing((prev) => ({
                            ...prev,
                            comment: !prev.comment,
                          }))
                        }
                      >
                        {editing.comment ? (
                          <FiX size={16} />
                        ) : (
                          <FiPlus size={16} />
                        )}
                      </button>
                    </div>
                    <div className="app-detail-section-content">
                      {editing.comment && (
                        <div className="app-detail-comment-composer">
                          <div className="app-detail-composer-header">
                            <span className="app-detail-user-badge">
                              <FiUser size={14} /> {doctorEmail.split("@")[0]}
                            </span>
                          </div>
                          <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder={t("appointment.yourThoughts")}
                            rows={3}
                            className="app-detail-textarea"
                            autoFocus
                          />
                          <div className="app-detail-composer-actions">
                            <button
                              className="app-detail-secondary-btn"
                              onClick={() => {
                                setEditing((prev) => ({
                                  ...prev,
                                  comment: false,
                                }));
                                setNewComment("");
                              }}
                            >
                              {t("appointment.cancel")}
                            </button>
                            <button
                              className="app-detail-primary-btn"
                              onClick={handleAddComment}
                              disabled={!newComment.trim()}
                            >
                              {t("appointment.postComment")}
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="app-detail-comments-feed">
                        {comments.length > 0 ? (
                          comments.map((comment, index) => (
                            <div
                              key={comment._id || index}
                              className="app-detail-comment"
                            >
                              <div className="app-detail-comment-body">
                                <div className="app-detail-comment-header">
                                  <div className="app-detail-comment-meta">
                                    <span className="app-detail-comment-author">
                                      {comment.role === "doctor"
                                        ? doctorNames[comment.email]
                                            ?.fullName ||
                                          `${doctorNames[comment.email]?.firstName || ""} ${
                                            doctorNames[comment.email]
                                              ?.lastName || ""
                                          }`.trim() ||
                                          comment.email.split("@")[0]
                                        : t(`role.${comment.role}`)}
                                    </span>
                                    <span className="app-detail-comment-role">
                                      ({comment.role})
                                    </span>
                                    <span className="app-detail-comment-time">
                                      {formatRelativeTime(comment.createdAt)}
                                      {comment.edited &&
                                        t("appointment.edited")}
                                    </span>
                                  </div>
                                  {comment.email === doctorEmail &&
                                    comment.role === "doctor" && (
                                      <button
                                        className="app-detail-icon-btn danger"
                                        onClick={() =>
                                          handleDeleteComment(comment._id)
                                        }
                                      >
                                        <FiTrash2 size={16} />
                                      </button>
                                    )}
                                </div>
                                <div className="app-detail-comment-text">
                                  {comment.text}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="app-detail-empty-state">
                            <FiMessageSquare size={24} />
                            <p>{t("appointment.noComments")}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeSubTab === "telemedicine" && (
                  <div className="tele-card">
                    {/* Header */}
                    <div className="tele-card-header">
                      <div className="tele-card-title">
                        <FiVideo size={20} className="tele-title-icon" />
                        <span>{t("appointments.telemedicineSession") || "Telemedicine Session"}</span>
                      </div>
                      <button
                        className="tele-refresh-btn"
                        onClick={fetchTeleRoomStatus}
                        title="Refresh"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="23 4 23 10 17 10" />
                          <polyline points="1 20 1 14 7 14" />
                          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                        </svg>
                      </button>
                    </div>

                    {/* Status badge */}
                    <div className="tele-status-row">
                      <span className={`tele-status-badge ${teleRoomStatus?.isActive ? "active" : teleRoomStatus?.meetingStatus === "ended" ? "ended" : "scheduled"}`}>
                        <span className="tele-status-dot" />
                        {teleRoomStatus?.isActive
                          ? (t("appointments.active") || "Active")
                          : teleRoomStatus?.meetingStatus === "ended"
                            ? (t("appointments.ended") || "Ended")
                            : (t("appointments.scheduled") || "Scheduled")}
                      </span>
                      {teleRoomStatus?.isActive && teleRoomStatus?.participantCount > 0 && (
                        <span className="tele-participant-count">
                          <FiUser size={14} /> {teleRoomStatus.participantCount} {t("appointments.participants") || "participants"}
                        </span>
                      )}
                    </div>

                    {/* Info grid card */}
                    <div className="tele-info-card">
                      <div className="tele-info-grid">
                        {/* Appointment ID */}
                        <div className="tele-info-cell">
                          <span className="tele-info-label">{(t("appointments.appointment") || "APPOINTMENT").toUpperCase()} ID</span>
                          <span className="tele-info-value tele-id">#{appointment.applicationId}</span>
                        </div>
                        {/* Patient */}
                        <div className="tele-info-cell">
                          <span className="tele-info-label">{(t("appointments.patient") || "PATIENT").toUpperCase()}</span>
                          <span className="tele-info-value">{patientFullName || appointment.patientEmail}</span>
                        </div>
                        {/* Doctor */}
                        <div className="tele-info-cell">
                          <span className="tele-info-label">{(t("appointment.doctor") || "DOCTOR").toUpperCase()}</span>
                          <span className="tele-info-value">{appointment.doctorName || "—"}</span>
                        </div>
                        {/* Date & Time */}
                        <div className="tele-info-cell">
                          <span className="tele-info-label">{(t("appointments.dateTime") || "DATE & TIME").toUpperCase()}</span>
                          <span className="tele-info-value">
                            {appointment.date ? formatDateISO(appointment.date) : "—"}
                            {appointment.startTime || appointment.endTime ? (
                              <> &middot; {appointment.startTime ? formatTimeHHMM(appointment.startTime) : ""}{appointment.endTime ? " – " + formatTimeHHMM(appointment.endTime) : ""}</>
                            ) : null}
                          </span>
                        </div>
                        {/* Room ID (if exists) */}
                        {teleRoomStatus?.roomId && (
                          <div className="tele-info-cell">
                            <span className="tele-info-label">{(t("appointments.roomId") || "ROOM ID").toUpperCase()}</span>
                            <span className="tele-info-value">{teleRoomStatus.roomId}</span>
                          </div>
                        )}
                        {/* Started at */}
                        {teleRoomStatus?.startedAt && (
                          <div className="tele-info-cell">
                            <span className="tele-info-label">{(t("appointments.startedAt") || "STARTED AT").toUpperCase()}</span>
                            <span className="tele-info-value">
                              {`${formatDateISO(teleRoomStatus.startedAt)} ${formatTimeHHMM(teleRoomStatus.startedAt)}`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Error message */}
                    {joinError && (
                      <div className="tele-error-row">
                        <p className="app-detail-error-text">{joinError}</p>
                      </div>
                    )}

                    {/* Footer with actions */}
                    <div className="tele-footer">
                      <button
                        className="tele-restart-btn"
                        onClick={handleJoinMeeting}
                        disabled={joiningMeeting}
                      >
                        <FiVideo size={16} />
                        {joiningMeeting
                          ? (t("appointments.starting") || "Starting...")
                          : teleRoomStatus?.isActive
                            ? (t("appointments.joinSession") || "Join Session")
                            : (t("appointments.startSession") || "Start Session")}
                      </button>
                      {teleRoomStatus?.isActive && (
                        <button
                          className="tele-end-btn"
                          onClick={handleEndMeeting}
                          disabled={endingMeeting}
                        >
                          <FiX size={16} />
                          {endingMeeting
                            ? (t("appointments.ending") || "Ending...")
                            : (t("appointments.endSession") || "End Session")}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* {activeSubTab === "meetings" && (
                  <div className="app-detail-section-container">
                    <div className="app-detail-section-header">
                      <h3>{t("appointment.meetings")}</h3>
                      <button
                        className="app-detail-primary-btn"
                        onClick={handleJoinMeeting}
                        disabled={joiningMeeting}
                      >
                        <FiVideo size={16} />{" "}
                        {joiningMeeting
                          ? t("appointment.joining")
                          : t("appointment.joinNow")}
                      </button>
                    </div>
                    <div className="app-detail-section-content">
                      {meetingUrl || meetingRoomId ? (
                        <div className="app-detail-meeting-card">
                          <div className="app-detail-meeting-info">
                            <p className="app-detail-label">
                              {meetingUrl
                                ? t("appointment.meetingLinkLabel")
                                : t("appointment.meetingRoomIdLabel")}
                            </p>
                            <p className="app-detail-meeting-url">
                              {meetingUrl || meetingRoomId}
                            </p>
                          </div>
                          <div className="app-detail-meeting-actions">
                            <button
                              className="app-detail-primary-btn"
                              onClick={handleJoinMeeting}
                              disabled={joiningMeeting}
                            >
                              <FiVideo size={16} />{" "}
                              {joiningMeeting
                                ? t("appointment.joining")
                                : t("appointment.joinNow")}
                            </button>
                            {meetingUrl ? (
                              <a
                                className="app-detail-secondary-btn"
                                href={meetingUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <FiExternalLink size={16} />{" "}
                                {t("meeting_room.open_new_tab") ||
                                  "Open in new tab"}
                              </a>
                            ) : (
                              <button
                                className="app-detail-secondary-btn"
                                disabled
                              >
                                <FiExternalLink size={16} />{" "}
                                {t("meeting_room.open_new_tab") ||
                                  "Open in new tab"}
                              </button>
                            )}
                          </div>
                          {joinError && (
                            <p className="app-detail-error-text">{joinError}</p>
                          )}
                        </div>
                      ) : (
                        <div className="app-detail-empty-state">
                          <p>{t("appointment.noMeetingLinkAvailable")}</p>
                          {joinError && (
                            <p className="app-detail-error-text">{joinError}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )} */}

                {activeSubTab === "followup" && (
                  <FollowUpsTab
                    application={appointment}
                    onApplicationUpdate={(updated) => updated && setAppointment(updated)}
                  />
                )}

                {
                  activeSubTab === "report" && (
                    <div className="doctor-report-wrap">
                      <AppointmentReport booking={appointment} patient={patientDetails} />
                    </div>
                  )
                }
                {activeSubTab === "service" && (
                  <Service applicationId={appointment.applicationId} />
                )}
              </div>
            </div>

            {showTestModal && (
              <div
                className="app-detail-custom-modal-overlay"
                onClick={() => {
                  setShowTestModal(false);
                  setSelectedTests([]);
                }}
              >
                <div
                  className="app-detail-custom-modal"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="app-detail-modal-header">
                    <h3>{t("appointment.selectTests")}</h3>
                    <button
                      className="app-detail-select-all-btn"
                      onClick={handleSelectAllTests}
                    >
                      {selectedTests.length === availableTests.length ? (
                        <>
                          <FiCheckSquare size={16} />{" "}
                          {t("appointment.deSelectAll")}
                        </>
                      ) : (
                        <>
                          <FiSquare size={16} /> {t("appointment.selectAll")}
                        </>
                      )}
                    </button>
                  </div>
                  <div className="app-detail-tests-list">
                    {availableTests.map((test) => {
                      const isSelected = selectedTests.some(
                        (t) => t.testId === test._id,
                      );
                      const isAlreadyAdded = orders.some(
                        (t) =>
                          String(t.testId) === String(test._id) ||
                          String(t.testName).toLowerCase() ===
                            String(test.name).toLowerCase(),
                      );
                      return (
                        <div
                          key={test._id}
                          className={`app-detail-test-item ${isSelected ? "selected" : ""} ${isAlreadyAdded ? "disabled" : ""}`}
                          onClick={() =>
                            !isAlreadyAdded &&
                            handleTestSelection(test._id, test.name)
                          }
                          style={{
                            cursor: isAlreadyAdded ? "not-allowed" : "pointer",
                            opacity: isAlreadyAdded ? 0.6 : 1,
                          }}
                        >
                          <div className="app-detail-test-checkbox">
                            {isAlreadyAdded ? (
                              <FiCheckSquare className="app-detail-already-added-icon" />
                            ) : isSelected ? (
                              <FiCheckSquare />
                            ) : (
                              <FiSquare />
                            )}
                          </div>
                          <div className="app-detail-test-info">
                            <span className="app-detail-test-name">
                              {test.name}
                            </span>
                            {test.specialtyName && (
                              <span className="app-detail-test-specialty">
                                {test.specialtyName}
                              </span>
                            )}
                            {isAlreadyAdded && (
                              <span className="app-detail-test-note">
                                Already Assigned
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="app-detail-selected-count">
                    {selectedTests.length} {t("appointment.testSelected")}
                  </div>
                  <div className="app-detail-modal-actions">
                    <button
                      onClick={handleAddTests}
                      className="app-detail-primary-btn"
                      disabled={selectedTests.length === 0}
                    >
                      <FiSave size={16} /> {t("appointment.addSelectedTests")}
                    </button>
                    <button
                      onClick={() => {
                        setShowTestModal(false);
                        setSelectedTests([]);
                      }}
                      className="app-detail-secondary-btn"
                    >
                      <FiX size={16} /> {t("appointment.cancel")}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* PDF Template (Hidden for Export) */}
            <AppointmentPDFTemplate
              appointment={appointment}
              patient={patientDetails}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentDetails;
