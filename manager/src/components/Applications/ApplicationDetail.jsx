import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  getApplication as getApplicationById,
  updateApplicationPrescription,
  updateApplicationConclusion,
  getAvailableTests,
  getVendors,
  uploadDocumentFile,
  uploadDocumentUrl,
  getMedicalHistoryByEmail,
  getPatientByEmail,
  meetingCreateOrJoin,
  meetingJoinByUser,
  fetchRecordings,
  updateApplication,
} from "../../utils/api";
import "./ApplicationDetail.css";
import LoadingComponent from "../Loading/LoadingComponent";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  FiCalendar,
  FiClock,
  FiActivity,
  FiVideo,
  FiFileText,
  FiUser,
  FiMapPin,
  FiArrowLeft,
  FiEye,
  FiDownload,
  FiEdit,
  FiSave,
  FiX,
  FiPlus,
  FiCheckSquare,
  FiSquare,
  FiPhone,
  FiMail,
  FiExternalLink,
  FiUpload,
  FiLink,
  FiUserCheck,
  FiHeart,
  FiClipboard,
  FiChevronDown,
  FiChevronUp,
  FiRefreshCw,
  FiFilm,
} from "react-icons/fi";
import { FaMale, FaFemale, FaTransgender } from "react-icons/fa";
import { MdOutlineVideoLibrary } from "react-icons/md";
import autoTable from "jspdf-autotable";
import Papa from "papaparse";

import { Clock, CheckCircle, AlertCircle, X } from "lucide-react";
import { getApptStatusClass, getApptStatusColor } from "../../utils/appointmentStatus";
import { FaStethoscope } from "react-icons/fa6";
import { GrDocumentTest } from "react-icons/gr";
import { useTranslation } from "react-i18next";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Modal from "react-modal";

const ApplicationDetail = ({ id: propId, onClose, onUpdate }) => {
  const { id: routeId } = useParams();
  const id = propId || routeId;
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [application, setApplication] = useState(null);
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [documentPreviews, setDocumentPreviews] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [specialtyName, setSpecialtyName] = useState("");
  const [editPrescription, setEditPrescription] = useState(false);
  const [editConclusion, setEditConclusion] = useState(false);
  const [prescriptionText, setPrescriptionText] = useState("");
  const [conclusionText, setConclusionText] = useState("");
  const [showTestModal, setShowTestModal] = useState(false);
  const [availableTests, setAvailableTests] = useState([]);
  const [selectedTests, setSelectedTests] = useState([]);
  const [orders, setOrders] = useState([]);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [vendorAssignments, setVendorAssignments] = useState({});
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [documentUrl, setDocumentUrl] = useState("");
  const [uploadMode, setUploadMode] = useState("file");
  const [activeTab, setActiveTab] = useState("details");
  const [medicalHistory, setMedicalHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [activeSection, setActiveSection] = useState("appointment");
  const [meetingLoading, setMeetingLoading] = useState(false);
  const [doctorToken, setDoctorToken] = useState("");
  const [doctorLink, setDoctorLink] = useState("");
  const [patientToken, setPatientToken] = useState("");
  const [patientLink, setPatientLink] = useState("");
  const [meetingError, setMeetingError] = useState("");
  const [managerLink, setManagerLink] = useState("");
  const [recordings, setRecordings] = useState([]);
  const [recordingsLoading, setRecordingsLoading] = useState(false);
  const [isEditingManualLink, setIsEditingManualLink] = useState(false);
  const [manualMeetingLink, setManualMeetingLink] = useState("");
  const [savingManualLink, setSavingManualLink] = useState(false);
  const [useManualMeeting, setUseManualMeeting] = useState(false);

  const baseUrl = import.meta.env.VITE_BASE_URL;
  const plugBaseUrl =
    import.meta.env.VITE_MEET_BASE_URL || "https://meet.sotiglobal.com";

  useEffect(() => {
    if (!id) {
      setError(t("application.noAppointmentId"));
      toast.error(t("application.noAppointmentId"));
      setLoading(false);
      return;
    }
    fetchApplication();
    fetchAvailableTests();
    fetchVendors();
  }, [id]);

  // Sync meeting state from application when available
  useEffect(() => {
    if (application?.meeting) {
      const m = application.meeting;
      if (m.doctorLink) setDoctorLink(m.doctorLink);
      if (m.patientLink) setPatientLink(m.patientLink);
      if (m.doctorToken) setDoctorToken(m.doctorToken);
      if (m.patientToken) setPatientToken(m.patientToken);
    }
  }, [application?.meeting]);

  // Fetch recordings when meetings tab is active and room exists
  useEffect(() => {
    if (activeSection === "meetings" && application?.meeting?.roomId) {
      fetchMeetingRecordings();
    }
  }, [activeSection, application?.meeting?.roomId]);

  const fetchApplication = async () => {
    try {
      setLoading(true);
      setError(null);
      // Reset meeting state before loading a new application
      setDoctorToken("");
      setPatientToken("");
      setDoctorLink("");
      setPatientLink("");

      const response = await getApplicationById(id);
      const data = response.data;

      if (!data) {
        throw new Error(t("application.applicationNotFound"));
      }
      setApplication(data);
      setPrescriptionText(data.prescription?.text || "");
      setConclusionText(data.conclusion?.text || "");
      // Populate meeting info from backend for this application only
      if (data.meeting) {
        setDoctorLink(data.meeting.doctorLink || "");
        setPatientLink(data.meeting.patientLink || "");
        setDoctorToken(data.meeting.doctorToken || "");
        setPatientToken(data.meeting.patientToken || "");
      }

      // Populate manual meeting link if exists
      setManualMeetingLink(data.meetingLink || "");
      setUseManualMeeting(!!data.meetingLink);

      if (data.documents?.length > 0) {
        await fetchDocumentPreviews(data.documents);
      }

      if (data.specialty) {
        setSpecialtyName(data.specialty);
      }

      await fetchTestOrders(data.applicationId);

      if (data.patientEmail) {
        await fetchPatientDetails(data.patientEmail);
        fetchMedicalHistory(data.patientEmail);
      } else {
      }
    } catch (err) {
      setError(err.message || t("application.fetchError"));
      toast.error(err.message || t("application.fetchError"));
    } finally {
      setLoading(false);
    }
  };

  const fetchPatientDetails = async (email) => {
    try {
      const patientData = await getPatientByEmail(email);
      setPatient(patientData.patient);
    } catch (err) {
    }
  };

  const fetchMedicalHistory = async (email) => {
    try {
      setHistoryLoading(true);
      const data = await getMedicalHistoryByEmail(email);
      setMedicalHistory(data || []);
    } catch (err) {
      toast.error("Failed to fetch medical history");
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchDocumentPreviews = async (documents) => {
    try {
      const previews = documents.map((doc) => {
        let url;

        if (doc.fileId) {
          url = `${baseUrl}/api/applications/media/${doc.fileId}/media`;
        } else if (doc.url) {
          url = doc.url;
        } else {
          url = `${baseUrl}/api/applications/media/fallback/media`;
        }

        return {
          id: doc.fileId || doc.url || Math.random().toString(36).slice(2),
          url,
          name: doc.filename || "Document",
          type: (
            doc.filename?.split(".").pop() ||
            doc.url?.split(".").pop()?.split("?")[0] ||
            "file"
          ).toLowerCase(),
        };
      });

      setDocumentPreviews(previews.filter(Boolean));
    } catch (err) {
      setError(t("application.documentFetchError"));
      toast.error(t("application.documentFetchError"));
    }
  };

  const fetchAvailableTests = async () => {
    setAvailableTests([]);
  };

  const fetchVendors = async () => {
    try {
      const response = await getVendors();
      setVendors(response.vendors || []);
    } catch (err) {
      toast.error(t("application.vendorFetchError"));
    }
  };

  const fetchTestOrders = async (applicationId) => {
    setOrders([]);
  };

  const getCompatibleVendors = (testId) => {
    if (!testId) {
      toast.error(t("application.invalidTestId"));
      return [];
    }
    const compatible = vendors.filter((vendor) => {
      if (!vendor.services || !Array.isArray(vendor.services)) {
        return false;
      }
      const canHandleTest = vendor.services.some((service) => {
        if (!service.selectedTests || !Array.isArray(service.selectedTests)) {
          return false;
        }
        return service.selectedTests.some((test) => {
          const match = test.testId.toString() === testId.toString();
          return match;
        });
      });

      return canHandleTest;
    });

    return compatible;
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setUploadMode("file");
    }
  };

  const handleUploadConfirm = async () => {
    if (uploadMode === "file" && !selectedFile) {
      toast.error(t("application.noFileSelected"));
      return;
    }

    if (uploadMode === "url" && !documentUrl.trim()) {
      toast.error(t("application.noUrlProvided"));
      return;
    }

    setUploading(true);
    try {
      if (uploadMode === "file") {
        await uploadDocumentFile(id, selectedFile);
      } else {
        await uploadDocumentUrl(
          id,
          documentUrl.trim(),
          documentUrl.trim().split("/").pop() || "Cloud Document"
        );
      }

      const response = await getApplicationById(id);
      const data = response.data;
      if (data && data.documents?.length > 0) {
        await fetchDocumentPreviews(data.documents);
      }

      setSelectedFile(null);
      setDocumentUrl("");
      toast.success(t("application.documentUploaded"));
    } catch (err) {
      setError(t("application.documentUploadError"));
      toast.error(t("application.documentUploadError"));
    } finally {
      setUploading(false);
    }
  };

  const handleTestSelection = (testId, testName) => {
    setSelectedTests((prev) => {
      const isSelected = prev.some((test) => test.testId === testId);
      if (isSelected) {
        return prev.filter((test) => test.testId !== testId);
      } else {
        return [
          ...prev,
          { testId, testName, appointmentId: application.applicationId },
        ];
      }
    });
  };

  const handleSelectAllTests = () => {
    if (selectedTests.length === availableTests.length) {
      setSelectedTests([]);
    } else {
      setSelectedTests(
        availableTests
          .filter(
            (test) =>
              !orders.some((o) => o.testId.toString() === test._id.toString())
          )
          .map((test) => ({
            testId: test._id,
            testName: test.name,
            appointmentId: application.applicationId,
          }))
      );
    }
  };

  const handleAddTests = async () => {
    if (selectedTests.length === 0) {
      toast.error(t("application.noTestsSelected"));
      return;
    }
    try {
      const response = await fetch(`${baseUrl}/api/orders/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": localStorage.getItem("token"),
        },
        body: JSON.stringify({
          applicationId: application.applicationId,
          tests: selectedTests,
        }),
      });
      if (!response.ok) throw new Error("Failed to add tests");
      await fetchTestOrders(application.applicationId);
      setSelectedTests([]);
      setShowTestModal(false);
      toast.success(
        t("application.testsAdded", { count: selectedTests.length })
      );
    } catch (err) {
      toast.error(t("application.testAddError"));
    }
  };

  const handleOrderSelection = (orderId) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
  };

  const handleVendorAssignmentChange = (orderId, vendorId) => {
    setVendorAssignments((prev) => ({
      ...prev,
      [orderId]: vendorId,
    }));
  };

  const handleAssignVendors = async () => {
    if (selectedOrders.length === 0) {
      toast.error(t("application.selectVendorAndOrders"));
      return;
    }

    const assignmentsByVendor = selectedOrders.reduce((acc, orderId) => {
      const vendorId = vendorAssignments[orderId];
      if (!vendorId) return acc;
      const vendor = vendors.find((v) => v._id === vendorId);
      if (!vendor) return acc;
      if (!acc[vendorId]) {
        acc[vendorId] = {
          vendorId,
          vendorName: vendor.vendorName,
          orderIds: [],
        };
      }
      acc[vendorId].orderIds.push(orderId);
      return acc;
    }, {});

    const payloads = Object.values(assignmentsByVendor);
    if (payloads.length === 0) {
      toast.error(t("application.noVendorSelectedForTests"));
      return;
    }

    try {
      for (const payload of payloads) {
        const response = await fetch(`${baseUrl}/api/orders/assign-vendor`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-auth-token": localStorage.getItem("token"),
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to assign vendors");
        }
      }
      await fetchTestOrders(application.applicationId);
      setSelectedOrders([]);
      setVendorAssignments({});
      setShowVendorModal(false);
      toast.success(
        t("application.vendorsAssigned", { count: selectedOrders.length })
      );
    } catch (err) {
      toast.error(t("application.vendorAssignError"));
    }
  };

  const handleEditPrescription = () => {
    setEditPrescription(true);
    setPrescriptionText(application.prescription?.text || "");
  };

  const handleSavePrescription = async () => {
    try {
      const updatedApplication = await updateApplicationPrescription(
        id,
        prescriptionText
      );
      setApplication(updatedApplication);
      setEditPrescription(false);
      toast.success(t("application.prescriptionUpdated"));
    } catch (err) {
      toast.error(t("application.prescriptionUpdateError"));
    }
  };

  const handleCancelPrescription = () => {
    setEditPrescription(false);
    setPrescriptionText(application.prescription?.text || "");
  };

  const handleEditConclusion = () => {
    setEditConclusion(true);
    setConclusionText(application.conclusion?.text || "");
  };

  const handleSaveConclusion = async () => {
    try {
      const updatedApplication = await updateApplicationConclusion(
        id,
        conclusionText
      );
      setApplication(updatedApplication);
      setEditConclusion(false);
      toast.success(t("application.conclusionUpdated"));
    } catch (err) {
      toast.error(t("application.conclusionUpdateError"));
    }
  };

  const handleCancelConclusion = () => {
    setEditConclusion(false);
    setConclusionText(application.conclusion?.text || "");
  };

  const generateAndDownloadPDF = async () => {
    const element = document.getElementById("app-detail-pdf-content");
    element.style.display = "block";
    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Application_${id}.pdf`);
    element.style.display = "none";
  };

  const getStatusColor = (status) => getApptStatusColor(status);

  const formatDate = (dateString) => {
    const options = { year: "numeric", month: "short", day: "numeric" };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const formatTime = (timeStr, dateStr) => {
    if (!timeStr || !dateStr) return t("application.messages.notSpecified");
    let date;
    if (timeStr.includes("T")) {
      // ISO datetime string
      date = new Date(timeStr);
    } else {
      const [hours, minutes] = timeStr.split(":");
      date = new Date(dateStr);
      date.setHours(parseInt(hours, 10), parseInt(minutes, 10));
    }
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    }).format(date);
  };

  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return "N/A";
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  };

  const formatDateOfBirth = (dateOfBirth) => {
    if (!dateOfBirth) return "N/A";
    try {
      const date = new Date(dateOfBirth);
      return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(date);
    } catch (error) {
      return "N/A";
    }
  };

  const getGenderIcon = (gender) => {
    const genderLower = gender?.toLowerCase();
    if (genderLower === "male") {
      return <FaMale size={20} className="gender-icon male" />;
    } else if (genderLower === "female") {
      return <FaFemale size={20} className="gender-icon female" />;
    } else {
      return null;
    }
  };

  const handleHistoryItemClick = async (historyItem) => {
    try {
      setActiveTab("details");
      setActiveSection("appointment");

      const response = await getApplicationById(historyItem.applicationId);
      const data = response.data;

      if (!data) {
        toast.error("Application not found");
        return;
      }

      setApplication(data);
      setPrescriptionText(data.prescription?.text || "");
      setConclusionText(data.conclusion?.text || "");

      if (data.documents?.length > 0) {
        await fetchDocumentPreviews(data.documents);
      }

      if (data.specialty) {
        setSpecialtyName(data.specialty);
      }

      await fetchTestOrders(data.applicationId);

      if (data.patientEmail) {
        await fetchPatientDetails(data.patientEmail);
        fetchMedicalHistory(data.patientEmail);
      }

      toast.success(`Loaded appointment ${historyItem.applicationId}`);
    } catch (err) {
      toast.error("Failed to load selected application");
    }
  };

  const openMeetingInFrame = (link, role) => {
    if (!link) return;
    const url = `/meeting-room?link=${encodeURIComponent(
      link
    )}&role=${encodeURIComponent(role || "")}`;
    window.location.assign(url);
  };

  const extractTokenFromResponse = async (response) => {
    const data = await response.json();
    return (
      data.token ||
      data.data?.token ||
      data?.result?.token ||
      data?.data?.data?.token ||
      ""
    );
  };

  const copyToClipboard = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(
        t("application.messages.copiedToClipboard") || "Copied to clipboard"
      );
    } catch (err) {
      toast.error(t("application.messages.copyFailed") || "Failed to copy");
    }
  };

  const ensureMeetingRoom = async () => {
    const applicationNumber = application.applicationId;
    // Sanitize applicationNumber to remove special characters for roomId
    const sanitizedAppNumber = String(applicationNumber)
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .toUpperCase();
    const roomId =
      application.meeting?.roomId ||
      `app-${sanitizedAppNumber}` ||
      application._id;
    const title = `Appointment ${applicationNumber}`;
    const metadata = {
      appointment_id: applicationNumber,
      doctor_name: application.doctorName || `${getFieldValue(application.doctor?.firstName)} ${getFieldValue(application.doctor?.lastName)}`.trim() || "Doctor",
      patient_name: application.patientName || `${application.patient?.firstName || ""} ${application.patient?.lastName || ""}`.trim() || "Patient",
      appointment_date: application.date || "",
      specialty: application.specialty || "",
    };

    const createData = await meetingCreateOrJoin({
      applicationId: applicationNumber || application._id,
      roomId,
      token: localStorage.getItem("token"),
      title,
      options: { metadata },
    });
    if (!createData?.status) {
      throw new Error(createData?.message || "Failed to create meeting");
    }
    const resolvedRoomId = createData.roomId || roomId;
    if (resolvedRoomId && resolvedRoomId !== application.meeting?.roomId) {
      setApplication((prev) => ({
        ...prev,
        meeting: { ...(prev.meeting || {}), roomId: resolvedRoomId },
      }));
    }
    return resolvedRoomId;
  };

  const handleJoinMeeting = async () => {
    try {
      setMeetingLoading(true);
      setMeetingError("");

      let roomId = await ensureMeetingRoom();
      let data = await meetingJoinByUser({
        applicationId: application.applicationId || application._id,
        roomId,
        token: localStorage.getItem("token"),
        profilePic: application.doctorProfilePic || null,
      });

      // If room is inactive, create a new room and try again
      if (!data?.status && (data?.message?.includes("inactive") || data?.message?.includes("not found"))) {
        // Clear the stored roomId to create a fresh room
        setApplication((prev) => ({
          ...prev,
          meeting: { ...{} },
        }));

        // Create new room with fresh roomId
        const applicationNumber = application.applicationId;
        const sanitizedAppNumber = String(applicationNumber)
          .replace(/[^a-zA-Z0-9-_]/g, "-")
          .toUpperCase();
        roomId = `app-${sanitizedAppNumber}-${Date.now()}`;

        data = await meetingCreateOrJoin({
          applicationId: applicationNumber || application._id,
          roomId,
          token: localStorage.getItem("token"),
          title: `Appointment ${applicationNumber}`,
          options: {
            metadata: {
              appointment_id: applicationNumber,
              appointment_number: applicationNumber,
              appointment_date: application.date,
              start_time: application.startTime,
              end_time: application.endTime,
              doctor_name: application.doctorName || `${getFieldValue(application.doctor?.firstName)} ${getFieldValue(application.doctor?.lastName)}`.trim(),
              doctor_email: application.doctorEmail,
              patient_name: application.patientName || `${application.patient?.firstName || ""} ${application.patient?.lastName || ""}`.trim(),
              patient_email: application.patientEmail,
              service_type: application.serviceType,
              specialty: application.specialty,
              appointment_mode: application.appointmentMode,
              appointment_status: application.appointmentStatus,
              branch: application.branch || "",
              location: application.location || "",
            }
          },
        });

        if (!data?.status) {
          throw new Error("Failed to create new meeting room");
        }

        // Join the newly created room
        data = await meetingJoinByUser({
          applicationId: application.applicationId || application._id,
          roomId: data.roomId || roomId,
          token: localStorage.getItem("token"),
          profilePic: application.doctorProfilePic || null,
        });
      }

      if (!data?.status) {
        throw new Error(
          data?.message || data?.error || "Failed to join meeting"
        );
      }

      const joinUrl = data.joinUrl;
      if (!joinUrl) {
        throw new Error("Join URL not available");
      }

      // Store last link for convenience
      setDoctorLink(joinUrl);
      setPatientLink(joinUrl);
      setManagerLink(joinUrl);

      window.location.assign(
        `/meeting-room?link=${encodeURIComponent(
          joinUrl
        )}&role=${encodeURIComponent(data.role || "")}`
      );
    } catch (err) {
      setMeetingError(err.message || "Failed to start meeting");
      toast.error(err.message || "Failed to start meeting");
    } finally {
      setMeetingLoading(false);
    }
  };

  const fetchMeetingRecordings = async () => {
    try {
      setRecordingsLoading(true);
      const roomId = application?.meeting?.roomId;

      if (!roomId) {
        setRecordings([]);
        return;
      }

      const response = await fetchRecordings([roomId], 0, 20, "DESC");
      if (response?.status && response?.result?.recordings_list) {
        setRecordings(response.result.recordings_list);
      } else {
        setRecordings([]);
      }
    } catch (error) {
      setRecordings([]);
    } finally {
      setRecordingsLoading(false);
    }
  };

  const handleSaveManualLink = async () => {
    try {
      setSavingManualLink(true);
      const updatedApplication = await updateApplication(id, { meetingLink: manualMeetingLink });
      if (updatedApplication) {
        setApplication(updatedApplication);
        setManualMeetingLink(updatedApplication.meetingLink || "");
      } else {
        setApplication((prev) => ({ ...prev, meetingLink: manualMeetingLink }));
      }
      setIsEditingManualLink(false);
      toast.success(
        t("application.meeting.manualLinkSaved") ||
        "Manual meeting link saved successfully"
      );
    } catch (error) {
      toast.error(
        t("application.meeting.manualLinkSaveError") ||
        "Failed to save manual meeting link"
      );
    } finally {
      setSavingManualLink(false);
    }
  };

  const handleRemoveManualLink = async () => {
    try {
      setSavingManualLink(true);
      const updatedApplication = await updateApplication(id, { meetingLink: "" });
      if (updatedApplication) {
        setApplication(updatedApplication);
        setManualMeetingLink("");
        setUseManualMeeting(false);
      }
      toast.success(
        t("application.meeting.manualLinkRemoved") ||
        "Manual meeting link removed successfully"
      );
    } catch (error) {
      toast.error(
        t("application.meeting.manualLinkRemoveError") ||
        "Failed to remove manual meeting link"
      );
    } finally {
      setSavingManualLink(false);
    }
  };

  const renderSectionContent = () => {
    if (activeSection === "meetings") {
      const meetingInfo = application?.meeting || {};
      const hasRoom = !!meetingInfo.roomId;
      const lastGenerated =
        meetingInfo.lastGeneratedAt || meetingInfo.lastGeneratedAt === 0
          ? new Date(meetingInfo.lastGeneratedAt).toLocaleString()
          : t("application.messages.notAvailable");
      const scheduledText =
        application?.date && application?.startTime && application?.endTime
          ? `${formatDate(application.date)} · ${formatTime(
            application.startTime,
            application.date
          )} - ${formatTime(application.endTime, application.date)}`
          : t("application.messages.notAvailable");
      const lastJoinLink =
        doctorLink || managerLink || patientLink || meetingInfo.joinUrl || "";

      let durationMinutes = null;
      if (application.startTime && application.endTime) {
        const startDate = new Date(application.startTime);
        const endDate = new Date(application.endTime);
        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
          durationMinutes = Math.max(
            0,
            Math.round((endDate - startDate) / 60000)
          );
        } else if (
          application.date &&
          application.startTime.includes(":") &&
          application.endTime.includes(":")
        ) {
          const dStart = new Date(application.date);
          const dEnd = new Date(application.date);
          const [sh, sm] = application.startTime.split(":");
          const [eh, em] = application.endTime.split(":");
          dStart.setHours(parseInt(sh, 10), parseInt(sm, 10), 0, 0);
          dEnd.setHours(parseInt(eh, 10), parseInt(em, 10), 0, 0);
          durationMinutes = Math.max(0, Math.round((dEnd - dStart) / 60000));
        }
      }

      return (
        <div className="app-detail-section-content">
          <div className="app-detail-meeting-card modern">
            <div className="app-detail-meeting-header">
              <div className="app-detail-meeting-title-row">
                <div>
                  <h3>{t("application.meeting.title") || "Meeting"}</h3>
                  <p className="app-detail-meeting-subtext">
                    {t("application.meeting.subtitle") ||
                      "Join the consultation with the latest room details."}
                  </p>
                </div>

              </div>
              <button
                className="app-detail-primary-btn large"
                onClick={handleJoinMeeting}
                disabled={meetingLoading}
              >
                <FiVideo size={16} />
                {meetingLoading
                  ? t("application.labels.startingMeeting") || "Starting..."
                  : t("application.meeting.joinCta") || "Join meeting"}
              </button>
            </div>
            {meetingError && (
              <div className="app-detail-error-text">{meetingError}</div>
            )}

            <div className="app-detail-meeting-grid modern">
              <div className="app-detail-meeting-panel">
                <div className="app-detail-panel-head">
                  {t("application.meeting.scheduled") || "Scheduled"}
                </div>
                <div className="app-detail-panel-body">
                  <div className="app-detail-meeting-chip">{scheduledText}</div>
                  {durationMinutes !== null && (
                    <div className="app-detail-meeting-chip">
                      {t("application.meeting.duration") || "Duration"}:{" "}
                      {durationMinutes}m
                    </div>
                  )}
                  <div className="app-detail-meeting-muted">
                    {t("application.meeting.timezoneNote") ||
                      "Times shown in your local timezone"}
                  </div>
                </div>
              </div>
            </div>

            {/* Recordings Section */}
            <div className="app-detail-recordings-section">
              <div className="app-detail-recordings-header">
                <h4>
                  <MdOutlineVideoLibrary size={20} />
                  {t("application.meeting.recordings") || "Recordings"}
                </h4>
                <button
                  className="app-detail-secondary-btn"
                  onClick={fetchMeetingRecordings}
                  disabled={recordingsLoading || !meetingInfo.roomId}
                >
                  <FiRefreshCw size={14} />
                  {recordingsLoading
                    ? (t("application.meeting.loading") || "Loading...")
                    : (t("application.meeting.refresh") || "Refresh")}
                </button>
              </div>

              {recordingsLoading ? (
                <div className="app-detail-recordings-loading">
                  {t("application.meeting.loadingRecordings") || "Loading recordings..."}
                </div>
              ) : recordings.length > 0 ? (
                <div className="app-detail-recordings-list">
                  {recordings.map((recording) => {
                    const token = localStorage.getItem("token");
                    const videoUrl = recording.record_id
                      ? `${import.meta.env.VITE_BASE_URL || 'http://localhost:3003'}/api/meetings/recordings/${recording.record_id}/stream?token=${token}`
                      : null;

                    return (
                      <div key={recording.record_id} className="app-detail-recording-item">
                        <div className="app-detail-recording-info">
                          <div className="app-detail-recording-title">
                            <FiFilm size={16} />
                            {t("application.meeting.recording") || "Recording"}
                          </div>
                          <div className="app-detail-recording-meta">
                            <span>
                              {new Date(recording.creation_time * 1000).toLocaleString()}
                            </span>
                            <span>•</span>
                            <span>
                              {recording.file_size ? recording.file_size.toFixed(2) : '0.00'} MB
                            </span>
                          </div>

                          {/* Video Player */}
                          {videoUrl && (
                            <div className="app-detail-recording-video">
                              <video
                                controls
                                preload="metadata"
                                className="app-detail-video-player"
                              >
                                <source src={videoUrl} type="video/mp4" />
                                Your browser does not support the video tag.
                              </video>
                            </div>
                          )}
                        </div>
                        <div className="app-detail-recording-actions">
                          {videoUrl && (
                            <a
                              href={videoUrl}
                              download={`recording.mp4`}
                              className="app-detail-secondary-btn small"
                            >
                              <FiDownload size={14} />
                              {t("application.meeting.download") || "Download"}
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="app-detail-recordings-empty">
                  {meetingInfo.roomId
                    ? t("application.meeting.noRecordings") || "No recordings available"
                    : t("application.meeting.noRoomForRecordings") || "Create a meeting room to view recordings"}
                </div>
              )}
            </div>

            {/* Manual Meeting Link Section */}
            <div className="app-detail-manual-link-section">
              <div className="app-detail-manual-link-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FiLink size={20} />
                    {t("application.meeting.manualLink") || "Manual Meeting Link"}
                  </h4>
                  <div className="app-detail-toggle-switch">
                    <input
                      type="checkbox"
                      id="manual-meeting-toggle"
                      checked={useManualMeeting}
                      onChange={(e) => setUseManualMeeting(e.target.checked)}
                      className="toggle-checkbox"
                    />
                    <label htmlFor="manual-meeting-toggle" className="toggle-label">
                      <span className="toggle-inner"></span>
                      <span className="toggle-switch"></span>
                    </label>
                  </div>
                </div>
                <p className="app-detail-manual-link-description">
                  {t("application.meeting.manualLinkDescription") || "Use this as a backup if the meeting platform doesn't work"}
                </p>
              </div>

              {useManualMeeting ? (
                <>
                  {isEditingManualLink ? (
                    <div className="app-detail-manual-link-edit">
                      <input
                        type="text"
                        value={manualMeetingLink}
                        onChange={(e) => setManualMeetingLink(e.target.value)}
                        placeholder={t("application.meeting.manualLinkPlaceholder") || "Enter meeting link (e.g., Zoom, Google Meet, etc.)"}
                        className="app-detail-url-input"
                      />
                      <div className="app-detail-manual-link-actions">
                        <button
                          onClick={handleSaveManualLink}
                          className="app-detail-primary-btn"
                          disabled={savingManualLink}
                        >
                          {savingManualLink
                            ? t("application.labels.saving") || "Saving..."
                            : t("application.labels.save") || "Save"}
                        </button>
                        <button
                          onClick={() => {
                            setIsEditingManualLink(false);
                            setManualMeetingLink(application?.meetingLink || "");
                          }}
                          className="app-detail-secondary-btn"
                          disabled={savingManualLink}
                        >
                          {t("application.labels.cancel") || "Cancel"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="app-detail-manual-link-display">
                      {manualMeetingLink ? (
                        <>
                          <div className="app-detail-manual-link-value">
                            <a
                              href={manualMeetingLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="app-detail-manual-link-url"
                            >
                              <FiExternalLink size={16} />
                              {manualMeetingLink}
                            </a>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => setIsEditingManualLink(true)}
                              className="app-detail-secondary-btn small"
                            >
                              <FiEdit size={14} />
                              {t("application.labels.edit") || "Edit"}
                            </button>
                            <button
                              onClick={handleRemoveManualLink}
                              className="app-detail-secondary-btn small"
                              disabled={savingManualLink}
                              style={{ color: '#ef4444' }}
                            >
                              <FiX size={14} />
                              {t("application.meeting.removeLink") || "Remove"}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="app-detail-manual-link-empty">
                          <p>{t("application.meeting.noManualLink") || "No manual link set"}</p>
                          <button
                            onClick={() => setIsEditingManualLink(true)}
                            className="app-detail-secondary-btn"
                          >
                            <FiPlus size={14} />
                            {t("application.meeting.addManualLink") || "Add Manual Link"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="app-detail-manual-link-disabled">
                  <p>{t("application.meeting.manualMeetingDisabled") || "Manual meeting link is disabled. Enable the toggle to use it."}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    switch (activeSection) {
      case "appointment":
        return (
          <div className="app-detail-section-content">
            <div className="app-detail-overview-grid">
              <div className="app-detail-overview-item">
                <FiCalendar className="app-detail-item-icon" />
                <div className="app-detail-item-content">
                  <span className="app-detail-item-label">
                    {t("application.labels.date")}
                  </span>
                  <span className="app-detail-item-value">
                    {formatDate(application.date)}
                  </span>
                </div>
              </div>
              <div className="app-detail-overview-item">
                <FiClock className="app-detail-item-icon" />
                <div className="app-detail-item-content">
                  <span className="app-detail-item-label">
                    {t("application.labels.time")}
                  </span>
                  <span className="app-detail-item-value">
                    {formatTime(application.startTime, application.date)} -{" "}
                    {formatTime(application.endTime, application.date)}
                  </span>
                </div>
              </div>
              <div className="app-detail-overview-item">
                <FaStethoscope className="app-detail-item-icon" />
                <div className="app-detail-item-content">
                  <span className="app-detail-item-label">
                    {t("application.labels.service")}
                  </span>
                  <span className="app-detail-item-value">
                    {application.serviceType ||
                      t("application.messages.notSpecified")}
                  </span>
                </div>
              </div>
              <div className="app-detail-overview-item">
                {application.appointmentMode?.toLowerCase() === "online" ? (
                  <FiVideo className="app-detail-item-icon" />
                ) : (
                  <FiMapPin className="app-detail-item-icon" />
                )}
                <div className="app-detail-item-content">
                  <span className="app-detail-item-label">
                    {t("application.labels.mode")}
                  </span>
                  <span className="app-detail-item-value">
                    {application.appointmentMode ||
                      t("application.messages.notSpecified")}
                    {application.meetingLink && (
                      <a
                        href={application.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="app-detail-meeting-link"
                      >
                        <FiExternalLink size={12} />
                        {t("application.labels.joinMeeting")}
                      </a>
                    )}
                  </span>
                  <button
                    onClick={() => handleJoinMeeting()}
                    className="app-detail-join-btn"
                    style={{
                      marginTop: "8px",
                      backgroundColor: "#2563eb",
                      color: "#fff",
                      border: "none",
                      borderRadius: "8px",
                      padding: "6px 14px",
                      fontSize: "14px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <FiVideo size={14} />
                    {t("application.labels.joinNow")}
                  </button>
                </div>
              </div>
              <div className="app-detail-overview-item">
                <FiUser className="app-detail-item-icon" />
                <div className="app-detail-item-content">
                  <span className="app-detail-item-label">
                    {t("application.labels.doctor")}
                  </span>
                  <span className="app-detail-item-value">
                    {application.doctor
                      ? `Dr. ${getFieldValue(application.doctor.firstName)} ${getFieldValue(application.doctor.middleName)} ${getFieldValue(application.doctor.lastName)}`.trim()
                      : t("application.messages.unknownDoctor")}
                  </span>
                </div>
              </div>
              <div className="app-detail-overview-item">
                <FaStethoscope className="app-detail-item-icon" />
                <div className="app-detail-item-content">
                  <span className="app-detail-item-label">
                    {t("application.labels.specialty")}
                  </span>
                  <span className="app-detail-item-value">
                    {specialtyName || t("application.messages.notSpecified")}
                  </span>
                </div>
              </div>
              <div className="app-detail-overview-item">
                <div className="export-buttons">
                  <button className="export-button" onClick={handleExportPDF}>
                    <FiDownload size={14} />
                    Export PDF
                  </button>

                  <button className="export-button" onClick={handleExportCSV}>
                    <FiFileText size={14} />
                    Export CSV
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case "documents":
        return (
          <div className="app-detail-section-content">
            <div className="app-detail-upload-controls">
              <div className="app-detail-upload-toggle">
                <button
                  className={`app-detail-toggle-btn ${uploadMode === "file" ? "active" : ""
                    }`}
                  onClick={() => setUploadMode("file")}
                >
                  <FiUpload size={14} />
                  {t("application.labels.uploadFile")}
                </button>
                <button
                  className={`app-detail-toggle-btn ${uploadMode === "url" ? "active" : ""
                    }`}
                  onClick={() => setUploadMode("url")}
                >
                  <FiLink size={14} />
                  URL
                </button>
              </div>

              {uploadMode === "file" ? (
                <label className="app-detail-upload-btn">
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    className="app-detail-file-input"
                    disabled={uploading}
                  />
                  <FiUpload size={14} />
                  {selectedFile
                    ? selectedFile.name
                    : t("application.labels.uploadFile")}
                </label>
              ) : (
                <input
                  type="text"
                  placeholder={t("application.labels.pasteUrl")}
                  value={documentUrl}
                  onChange={(e) => setDocumentUrl(e.target.value)}
                  className="app-detail-url-input"
                  disabled={uploading}
                />
              )}

              <button
                onClick={handleUploadConfirm}
                className="app-detail-confirm-btn"
                disabled={
                  uploading ||
                  (uploadMode === "file" && !selectedFile) ||
                  (uploadMode === "url" && !documentUrl.trim())
                }
              >
                {uploading
                  ? t("application.labels.uploading")
                  : t("application.labels.add")}
              </button>
            </div>

            {documentPreviews.length > 0 ? (
              <div className="app-detail-documents-grid">
                {documentPreviews.map((doc) => (
                  <div key={doc.id} className="app-detail-document-card">
                    <div className="app-detail-document-icon">
                      <FiFileText size={24} />
                    </div>
                    <div className="app-detail-document-info">
                      <span className="app-detail-document-name">
                        {doc.name}
                      </span>
                      <div className="app-detail-document-actions">
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="app-detail-doc-action-btn app-detail-view"
                        >
                          <FiEye size={14} />
                          {t("application.labels.view")}
                        </a>
                        <a
                          href={`${doc.url}?download=true`}
                          download
                          className="app-detail-doc-action-btn app-detail-download"
                        >
                          <FiDownload size={14} />
                          {t("application.labels.download")}
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="app-detail-empty-state">
                <FiFileText size={48} />
                <h4>{t("application.emptyStates.noDocuments.title")}</h4>
                <p>{t("application.emptyStates.noDocuments.description")}</p>
              </div>
            )}
          </div>
        );

      case "tests":
        return (
          <div className="app-detail-section-content">
            <div className="app-detail-tests-header">
              <button
                className="app-detail-primary-btn"
                onClick={() => setShowTestModal(true)}
              >
                <FiPlus size={16} />
                {t("application.labels.addTest")}
              </button>
              {orders.some(
                (order) => order.status === "Waiting for Assign"
              ) && (
                  <button
                    className="app-detail-secondary-btn"
                    onClick={() => setShowVendorModal(true)}
                    disabled={selectedOrders.length === 0}
                  >
                    <FiUserCheck size={16} />
                    {t("application.labels.assignVendor")}
                  </button>
                )}
            </div>

            {orders.length > 0 ? (
              <div className="app-detail-tests-grid">
                {orders.map((order, index) => (
                  <div key={order._id || index} className="appdetail-test-card">
                    <div className="app-detail-test-header">
                      <div className="app-detail-test-info">
                        <h4 className="app-detail-test-name">
                          {order.testName}
                        </h4>
                      </div>
                      {order.status === "Waiting for Assign" && (
                        <input
                          type="checkbox"
                          checked={selectedOrders.includes(order._id)}
                          onChange={() => handleOrderSelection(order._id)}
                          className="app-detail-test-checkbox"
                        />
                      )}
                    </div>
                    <div className="appdetail-test-body">
                      <span
                        className="app-detail-test-status"
                        style={{
                          backgroundColor: getStatusColor(order.status),
                        }}
                      >
                        {order.status || "Waiting for Assign"}
                      </span>
                      <div className="app-detail-test-actions">
                        {order.resultFileId ? (
                          <>
                            <a
                              href={`${baseUrl}/api/orders/results/${order.resultFileId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="app-detail-test-action-btn app-detail-view"
                            >
                              <FiEye size={14} />
                              {t("application.labels.view")}
                            </a>
                            <a
                              href={`${baseUrl}/api/orders/results/${order.resultFileId}?download=true`}
                              download
                              className="app-detail-test-action-btn app-detail-download"
                            >
                              <FiDownload size={14} />
                              {t("application.labels.download")}
                            </a>
                          </>
                        ) : (
                          <span className="app-detail-no-results">
                            {t("application.labels.noResults")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="app-detail-empty-state">
                <GrDocumentTest size={48} />
                <h4>{t("application.emptyStates.noTests.title")}</h4>
                <p>{t("application.emptyStates.noTests.description")}</p>
              </div>
            )}
          </div>
        );

      case "prescription":
        return (
          <div className="app-detail-section-content">
            <div className="app-detail-prescription-header">
              {!editPrescription && (
                <button
                  onClick={handleEditPrescription}
                  className="app-detail-secondary-btn"
                >
                  <FiEdit size={16} />
                  {t("application.labels.editPrescription")}
                </button>
              )}
            </div>

            {editPrescription ? (
              <div className="app-detail-edit-section">
                <textarea
                  value={prescriptionText}
                  onChange={(e) => setPrescriptionText(e.target.value)}
                  className="app-detail-textarea"
                  rows="8"
                  placeholder="Enter prescription details..."
                />
                <div className="app-detail-edit-actions">
                  <button
                    onClick={handleSavePrescription}
                    className="app-detail-primary-btn"
                  >
                    <FiSave size={16} />
                    {t("application.labels.save")}
                  </button>
                  <button
                    onClick={handleCancelPrescription}
                    className="app-detail-secondary-btn"
                  >
                    <FiX size={16} />
                    {t("application.labels.cancel")}
                  </button>
                </div>
              </div>
            ) : application.prescription?.text ? (
              <div className="app-detail-content-display">
                {application.prescription.text
                  .split("\n")
                  .map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
              </div>
            ) : (
              <div className="app-detail-empty-state">
                <FiHeart size={48} />
                <h4>{t("application.emptyStates.noPrescription.title")}</h4>
                <p>{t("application.emptyStates.noPrescription.description")}</p>
              </div>
            )}
          </div>
        );

      case "conclusion":
        return (
          <div className="app-detail-section-content">
            <div className="app-detail-conclusion-header">
              {!editConclusion && (
                <button
                  onClick={handleEditConclusion}
                  className="app-detail-secondary-btn"
                >
                  <FiEdit size={16} />
                  {t("application.labels.editConclusion")}
                </button>
              )}
            </div>

            {editConclusion ? (
              <div className="app-detail-edit-section">
                <textarea
                  value={conclusionText}
                  onChange={(e) => setConclusionText(e.target.value)}
                  className="app-detail-textarea"
                  rows="8"
                  placeholder="Enter conclusion details..."
                />
                <div className="app-detail-edit-actions">
                  <button
                    onClick={handleSaveConclusion}
                    className="app-detail-primary-btn"
                  >
                    <FiSave size={16} />
                    {t("application.labels.save")}
                  </button>
                  <button
                    onClick={handleCancelConclusion}
                    className="app-detail-secondary-btn"
                  >
                    <FiX size={16} />
                    {t("application.labels.cancel")}
                  </button>
                </div>
              </div>
            ) : application.conclusion?.text ? (
              <div className="app-detail-content-display">
                {application.conclusion.text.split("\n").map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            ) : (
              <div className="app-detail-empty-state">
                <FiClipboard size={48} />
                <h4>{t("application.emptyStates.noConclusion.title")}</h4>
                <p>{t("application.emptyStates.noConclusion.description")}</p>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) return <LoadingComponent message={t("application.messages.loading")} />;

  if (error)
    return (
      <div className="app-detail-error-container">
        <div className="app-detail-error-icon">⚠️</div>
        <p>{error}</p>
        <button
          className="app-detail-retry-btn"
          onClick={() => window.location.reload()}
        >
          {t("application.labels.tryAgain")}
        </button>
      </div>
    );

  if (!application)
    return (
      <div className="app-detail-empty-container">
        <h3>{t("application.applicationNotFound")}</h3>
        <p>{t("application.applicationNotFound")}</p>
      </div>
    );

  const getStatusBadge = (status) => {
    return (
      <span className={`appt-status-badge ${getApptStatusClass(status)}`}>
        {t(`application.status.${status?.toLowerCase().replace(" ", "_")}`)}
      </span>
    );
  };

  const handleExportCSV = () => {
    if (!application) {
      toast.error("No application data to export");
      return;
    }

    const patientData = patient || application.patient || {};
    const payments = application.payments || [];

    // Base appointment row
    const baseRow = {
      Application_ID: application.applicationId || id,
      Date: application.date,
      Time: `${formatTime(application.startTime, application.date)} - ${formatTime(application.endTime, application.date)}`,
      Doctor: application.doctorEmail || "N/A",
      Patient_Name: `${patientData.firstName || ""} ${patientData.middleName || ""} ${patientData.lastName || ""}`.trim(),
      Patient_Email: patientData.email || application.patientEmail || "N/A",
      Patient_Phone: patientData.phoneNumber || application.patient?.phoneNumber || "N/A",
      Date_of_Birth: patientData.dateOfBirth || "N/A",
      Age: calculateAge(patientData.dateOfBirth) || "N/A",
      Gender: patientData.gender || "N/A",
      Address: patientData.address || "N/A",
      Service: application.serviceType || "N/A",
      Mode: application.appointmentMode || "N/A",
      Specialty: specialtyName || "N/A",
      Appointment_Status: application.appointmentStatus || "N/A",
      Prescription: application.prescription?.text || "N/A",
      Conclusion: application.conclusion?.text || "N/A",
      Tests: orders.length > 0
        ? orders.map((o) => `${o.testName} (${o.status || "Waiting for Assign"})`).join("; ")
        : "None",
      // Payment summary
      Total_Payments: payments.length,
      Payment_Statuses: payments.map((p) => p.status).join("; ") || "N/A",
    };

    // Expand each payment as its own row (with appointment info repeated for context)
    const csvData = payments.length > 0
      ? payments.map((p, idx) => ({
          ...baseRow,
          Payment_Number: idx + 1,
          Invoice_Number: p.invoiceNumber || "N/A",
          Payment_Type: p.type || "N/A",
          Payment_Status: p.status || "N/A",
          Currency: p.currency || "RUB",
          Amount_Before_Discount: p.amount ?? "N/A",
          Discount: p.discount ?? 0,
          Final_Amount: p.finalAmount ?? "N/A",
          Items: p.items?.map((i) => `${i.name} (${i.amount})`).join("; ") || "N/A",
          Payment_Link: p.paymentLink || "N/A",
          Paid_At: p.paidAt ? new Date(p.paidAt).toLocaleString() : "N/A",
          Created_At: p.createdAt ? new Date(p.createdAt).toLocaleString() : "N/A",
        }))
      : [{ ...baseRow, Payment_Number: "N/A", Invoice_Number: "N/A", Payment_Type: "N/A", Payment_Status: "N/A", Currency: "N/A", Amount_Before_Discount: "N/A", Discount: "N/A", Final_Amount: "N/A", Items: "N/A", Payment_Link: "N/A", Paid_At: "N/A", Created_At: "N/A" }];

    const csv = Papa.unparse(csvData);
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Application_${id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    if (!application) {
      toast.error("No application data to export");
      return;
    }

    const patientData = patient || application.patient || {};
    const doc = new jsPDF("p", "mm", "a4");

    // Header
    doc.setFontSize(16);
    doc.text(
      `Application Report - #${application.applicationId || id}`,
      14,
      16
    );
    doc.setFontSize(12);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 23);

    // PATIENT DETAILS
    const patientTable = [
      ["#", "Field", "Value"],
      [
        "1",
        "Full Name",
        `${patientData.firstName || ""} ${patientData.middleName || ""} ${patientData.lastName || ""
          }`.trim(),
      ],
      ["2", "Email", patientData.email || application.patientEmail || "N/A"],
      [
        "3",
        "Phone",
        patientData.phoneNumber || application.patient?.phoneNumber || "N/A",
      ],
      ["4", "Date of Birth", patientData.dateOfBirth || "N/A"],
      ["5", "Age", calculateAge(patientData.dateOfBirth) || "N/A"],
      ["6", "Gender", patientData.gender || "N/A"],
      ["7", "Address", patientData.address || "N/A"],
    ];

    autoTable(doc, {
      startY: 30,
      head: [["#", "Patient Details", ""]],
      body: patientTable.slice(1),
      theme: "grid",
      styles: { fontSize: 10, cellPadding: 2 },
      headStyles: { fillColor: [22, 160, 133] },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },
        1: { cellWidth: 45 },
        2: { cellWidth: "auto" },
      },
    });

    // APPLICATION DETAILS
    const appTable = [
      ["#", "Field", "Value"],
      ["1", "Application ID", application.applicationId || id],
      ["2", "Date", application.date || "N/A"],
      [
        "3",
        "Time",
        `${formatTime(application.startTime, application.date)} - ${formatTime(
          application.endTime,
          application.date
        )}`,
      ],
      ["4", "Doctor", application.doctorEmail || "N/A"],
      ["5", "Service", application.serviceType || "N/A"],
      ["6", "Mode", application.appointmentMode || "N/A"],
      ["7", "Specialty", specialtyName || "N/A"],
      ["8", "Prescription", application.prescription?.text || "N/A"],
      ["9", "Conclusion", application.conclusion?.text || "N/A"],
    ];

    const nextY = doc.lastAutoTable.finalY + 10;

    autoTable(doc, {
      startY: nextY,
      head: [["#", "Application Details", ""]],
      body: appTable.slice(1),
      theme: "grid",
      styles: { fontSize: 10, cellPadding: 2 },
      headStyles: { fillColor: [52, 152, 219] },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },
        1: { cellWidth: 45 },
        2: { cellWidth: "auto" },
      },
    });

    // TESTS TABLE (Name + Status)
    if (orders && orders.length > 0) {
      const testRows = orders.map((order, index) => [
        index + 1,
        order.testName || "Unnamed Test",
        order.status || "Unknown",
      ]);

      const testY = doc.lastAutoTable.finalY + 10;

      autoTable(doc, {
        startY: testY,
        head: [["#", "Test Name", "Status"]],
        body: testRows,
        theme: "grid",
        styles: { fontSize: 10, cellPadding: 2 },
        headStyles: { fillColor: [231, 76, 60] },
        columnStyles: {
          0: { halign: "center", cellWidth: 10 },
          1: { cellWidth: 80 },
          2: { cellWidth: 40 },
        },
      });
    } else {
      const y = doc.lastAutoTable.finalY + 10;
      doc.text("No Tests Found", 14, y);
    }

    // Save PDF
    doc.save(`Application_${id}.pdf`);
  };

  return (
    <div className="app-detail-modern-container">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Modern Header with Patient Info */}
      <div
        className={`app-detail-modern-header ${showPatientDropdown ? "expanded" : ""
          }`}
      >
        <div
          className={`app-detail-header ${showPatientDropdown ? "expanded" : ""
            }`}
        >
          <div className="app-detail-heading">
            <div className="application-detail-header-left">
              <div className="app-detail-header-top">
                {onClose ? (
                  <button className="app-detail-back-btn" onClick={onClose}>
                    <FiArrowLeft size={18} />
                  </button>
                ) : (
                  <button
                    className="app-detail-back-btn"
                    onClick={() => navigate(-1)}
                  >
                    <FiArrowLeft size={18} />
                  </button>
                )}
              </div>

              <div className="app-detail-patient-header">
                <div className="app-detail-patient-info">
                  <div className="app-detail-patient-main">
                    <h1 className="app-detail-patient-name">
                      {patient
                        ? `${patient.firstName || ""} ${patient.middleName || ""
                          } ${patient.lastName || ""}`.trim()
                        : application.patient
                          ? `${application.patient.firstName || ""} ${application.patient.middleName || ""
                            } ${application.patient.lastName || ""}`.trim()
                          : t("application.messages.unknownPatient")}
                      {getGenderIcon(
                        patient?.gender || application.patient?.gender
                      )}
                    </h1>
                    <div className="app-detail-patient-details">
                      <span className="app-detail-detail-item-compact">
                        #{application?.applicationId || id}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="application-detail-app-status">
              <button
                className="app-detail-dropdown-btn"
                onClick={() => setShowPatientDropdown(!showPatientDropdown)}
              >
                {showPatientDropdown ? (
                  <FiChevronUp size={20} />
                ) : (
                  <FiChevronDown size={20} />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Personal Information Section - Below Header */}
        {showPatientDropdown && (
          <div className="app-detail-expanded-details">
            <div className="app-detail-expanded-grid">
              {/* Personal Information Section */}
              <div className="app-detail-detail-section">
                <h4>
                  <FiUser size={16} />
                  {t("application.personalInfo.title")}
                </h4>
                <div className="app-detail-detail-grid">
                  <div className="app-detail-detail-item">
                    <span className="app-detail-detail-label">
                      {t("application.personalInfo.email")}
                    </span>
                    <span className="app-detail-detail-value">
                      {patient?.email ||
                        application.patientEmail ||
                        t("application.messages.notAvailable")}
                    </span>
                  </div>
                  <div className="app-detail-detail-item">
                    <span className="app-detail-detail-label">
                      {t("application.personalInfo.phone")}
                    </span>
                    <span className="app-detail-detail-value">
                      {patient?.phoneNumber ||
                        application.patient?.phoneNumber ||
                        t("application.messages.notAvailable")}
                    </span>
                  </div>
                  <div className="app-detail-detail-item">
                    <span className="app-detail-detail-label">
                      {t("application.personalInfo.dateOfBirth")}
                    </span>
                    <span className="app-detail-detail-value">
                      {formatDateOfBirth(
                        patient?.dateOfBirth ||
                        application.patient?.dateOfBirth
                      )}
                    </span>
                  </div>
                  <div className="app-detail-detail-item">
                    <span className="app-detail-detail-label">
                      {t("application.personalInfo.age")}
                    </span>
                    <span className="app-detail-detail-value">
                      {calculateAge(
                        patient?.dateOfBirth ||
                        application.patient?.dateOfBirth
                      )}{" "}
                      {t("application.messages.years")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Address Information */}
              {patient?.address && (
                <div className="app-detail-detail-section">
                  <h4>
                    <FiMapPin size={16} />
                    {t("application.personalInfo.address")}
                  </h4>
                  <div className="app-detail-detail-item">
                    <span className="app-detail-detail-label">
                      {t("application.personalInfo.address")}
                    </span>
                    <span className="app-detail-detail-value">
                      {patient.address}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="app-detail-tab-nav">
        <button
          className={`app-detail-tab ${activeTab === "details" ? "active" : ""
            }`}
          onClick={() => setActiveTab("details")}
        >
          <FiClipboard size={18} />
          <span>{t("application.tabs.details")}</span>
        </button>
        <button
          className={`app-detail-tab ${activeTab === "history" ? "active" : ""
            }`}
          onClick={() => setActiveTab("history")}
        >
          <FiClock size={18} />
          <span>{t("application.tabs.history")}</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="app-detail-content-area">
        {activeTab === "details" ? (
          <div className="app-detail-details-content">
            {/* Icon Navigation */}
            <div className="app-detail-icon-navigation">
              <button
                className={`app-detail-nav-icon ${activeSection === "appointment" ? "active" : ""
                  }`}
                onClick={() => setActiveSection("appointment")}
                title={t("application.sections.appointment")}
              >
                <FiCalendar size={24} />
                <span>{t("application.sections.appointment")}</span>
              </button>
              <button
                className={`app-detail-nav-icon ${activeSection === "documents" ? "active" : ""
                  }`}
                onClick={() => setActiveSection("documents")}
                title={t("application.sections.documents")}
              >
                <FiFileText size={24} />
                <span>{t("application.sections.documents")}</span>
              </button>
              <button
                className={`app-detail-nav-icon ${activeSection === "tests" ? "active" : ""
                  }`}
                onClick={() => setActiveSection("tests")}
                title={t("application.sections.tests")}
              >
                <GrDocumentTest size={24} />
                <span>{t("application.sections.tests")}</span>
              </button>
              <button
                className={`app-detail-nav-icon ${activeSection === "prescription" ? "active" : ""
                  }`}
                onClick={() => setActiveSection("prescription")}
                title={t("application.sections.prescription")}
              >
                <FiHeart size={24} />
                <span>{t("application.sections.prescription")}</span>
              </button>
              <button
                className={`app-detail-nav-icon ${activeSection === "conclusion" ? "active" : ""
                  }`}
                onClick={() => setActiveSection("conclusion")}
                title={t("application.sections.conclusion")}
              >
                <FiClipboard size={24} />
                <span>{t("application.sections.conclusion")}</span>
              </button>
              <button
                className={`app-detail-nav-icon ${activeSection === "meetings" ? "active" : ""
                  }`}
                onClick={() => setActiveSection("meetings")}
                title={t("application.sections.meetings") || "Meetings"}
              >
                <FiVideo size={24} />
                <span>{t("application.sections.meetings") || "Meetings"}</span>
              </button>
            </div>

            {/* Section Content */}
            <div className="app-detail-section-container">
              {renderSectionContent()}
            </div>
          </div>
        ) : (
          <div className="app-detail-history-content">
            {historyLoading ? (
              <div className="app-detail-loading-state">
                <div className="app-detail-loading-spinner"></div>
                <p>{t("application.messages.loadingHistory")}</p>
              </div>
            ) : medicalHistory.length > 0 ? (
              <div className="app-detail-history-grid">
                {medicalHistory.map((historyItem) => (
                  <div
                    key={historyItem._id || historyItem.applicationId}
                    className="app-detail-history-card"
                    onClick={() => handleHistoryItemClick(historyItem)}
                  >
                    <div className="app-detail-history-header">
                      <div className="app-detail-history-id">
                        #{historyItem.applicationId}
                      </div>
                      <span
                        className="app-detail-history-status"
                        style={{
                          backgroundColor: getStatusColor(
                            historyItem.appointmentStatus
                          ),
                        }}
                      >
                        {t(`applications.status_${historyItem.appointmentStatus?.toLowerCase().replace(/\s+/g, "_")}`, historyItem.appointmentStatus)}
                      </span>
                    </div>
                    <div className="app-detail-history-body">
                      <div className="app-detail-history-date">
                        <FiCalendar size={16} />
                        <span>
                          {formatDate(historyItem.date)} •{" "}
                          {formatTime(historyItem.startTime, historyItem.date)}{" "}
                          - {formatTime(historyItem.endTime, historyItem.date)}
                        </span>
                      </div>
                      <div className="app-detail-history-doctor">
                        <FiUser size={16} />
                        <span>
                          Dr.{" "}
                          {historyItem.doctor
                            ? `${getFieldValue(historyItem.doctor.firstName)} ${getFieldValue(historyItem.doctor.lastName)}`.trim()
                            : t("application.messages.unknownDoctor")}
                        </span>
                      </div>
                      <div className="app-detail-history-service">
                        <FaStethoscope size={16} />
                        <span>{historyItem.serviceType}</span>
                      </div>
                    </div>
                    {/*
                    <div className="app-detail-history-footer">
                      <span className="app-detail-view-details">
                        {t("application.labels.viewDetails")}{" "}
                        <FiExternalLink size={14} />
                      </span>
                    </div>
                    */}
                  </div>
                ))}
              </div>
            ) : (
              <div className="app-detail-empty-state">
                <FiClock size={64} />
                <h3>{t("application.emptyStates.noMedicalHistory.title")}</h3>
                <p>
                  {t("application.emptyStates.noMedicalHistory.description")}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hidden PDF Content */}
      <div id="app-detail-pdf-content" style={{ display: "none" }}>
        <h2>Application {id}</h2>
        <p>Date: {application.date}</p>
        <p>
          Time: {formatTime(application.startTime, application.date)} -{" "}
          {formatTime(application.endTime, application.date)}
        </p>
        <p>Service: {application.serviceType}</p>
        <p>Mode: {application.appointmentMode}</p>
        <p>Doctor: {application.doctorEmail}</p>
        <p>Patient: {application.patientEmail}</p>
        <p>Specialty: {specialtyName}</p>
        <p>Prescription: {application.prescription?.text || "Not specified"}</p>
        <p>Conclusion: {application.conclusion?.text || "Not specified"}</p>
        <p>
          Tests:{" "}
          {orders.length > 0
            ? orders
              .map(
                (order) =>
                  `${order.testName} (${order.status || "Waiting for Assign"
                  })`
              )
              .join(", ")
            : "None"}
        </p>
      </div>

      {/* Modals */}
      <Modal
        isOpen={showTestModal}
        onRequestClose={() => {
          setShowTestModal(false);
          setSelectedTests([]);
        }}
        contentLabel="Add Tests Modal"
        className="app-detail-modal"
        overlayClassName="app-detail-modal-overlay"
      >
        <div className="app-detail-modal-header">
          <h3>{t("application.labels.selectTests")}</h3>
          <button
            className="app-detail-select-all-btn"
            onClick={handleSelectAllTests}
          >
            {selectedTests.length ===
              availableTests.filter(
                (test) =>
                  !orders.some((o) => o.testId.toString() === test._id.toString())
              ).length ? (
              <>
                <FiCheckSquare size={16} />
                {t("application.labels.deselectAll")}
              </>
            ) : (
              <>
                <FiSquare size={16} />
                {t("application.labels.selectAll")}
              </>
            )}
          </button>
        </div>
        <div className="app-detail-tests-list">
          {availableTests.map((test) => {
            const isSelected = selectedTests.some((t) => t.testId === test._id);
            const isAlreadyAdded = orders.some(
              (o) => o.testId.toString() === test._id.toString()
            );
            return (
              <div
                key={test._id}
                className={`app-detail-test-item ${isSelected ? "selected" : ""
                  } ${isAlreadyAdded ? "disabled" : ""}`}
                onClick={() =>
                  !isAlreadyAdded && handleTestSelection(test._id, test.name)
                }
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
                  <span className="app-detail-test-name">{test.name}</span>
                  {test.specialtyName && (
                    <span className="app-detail-test-specialty">
                      {test.specialtyName}
                    </span>
                  )}
                  {isAlreadyAdded && (
                    <span className="app-detail-test-note">
                      {t("application.labels.alreadyAdded")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="app-detail-selected-count">
          {t("application.labels.selected")}: {selectedTests.length}{" "}
          {t("application.labels.selected").toLowerCase()}
        </div>
        <div className="app-detail-modal-actions">
          <button
            onClick={handleAddTests}
            className="app-detail-primary-btn primary-button"
            disabled={selectedTests.length === 0}
          >
            <FiSave size={16} />
            {t("application.labels.addTest")}
          </button>
          <button
            onClick={() => {
              setShowTestModal(false);
              setSelectedTests([]);
            }}
            className="app-detail-secondary-btn"
          >
            <FiX size={16} />
            {t("application.labels.cancel")}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={showVendorModal}
        onRequestClose={() => {
          setShowVendorModal(false);
          setSelectedOrders([]);
          setVendorAssignments({});
        }}
        contentLabel="Assign Vendor Modal"
        className="app-detail-modal"
        overlayClassName="app-detail-modal-overlay"
      >
        <div className="app-detail-modal-header">
          <h3>{t("application.labels.assignVendor")}</h3>
        </div>
        <div className="app-detail-vendor-assignments">
          {selectedOrders.length === 0 ? (
            <div className="app-detail-empty-state">
              <p>{t("application.emptyStates.noOrdersSelected")}</p>
            </div>
          ) : (
            selectedOrders.map((orderId) => {
              const order = orders.find((o) => o._id === orderId);
              if (!order) {
                return (
                  <div
                    key={orderId}
                    className="app-detail-vendor-assignment-item"
                  >
                    <span className="app-detail-vendor-assignment-test">
                      Order ID: {orderId}
                    </span>
                    <span className="app-detail-no-vendors">
                      {t("application.emptyStates.noOrdersSelected")}
                    </span>
                  </div>
                );
              }
              const compatibleVendors = getCompatibleVendors(order.testId);
              if (compatibleVendors.length === 0) {
                return (
                  <div
                    key={orderId}
                    className="app-detail-vendor-assignment-item"
                  >
                    <span className="app-detail-vendor-assignment-test">
                      {order.testName} (ID: {order.testId})
                    </span>
                    <span className="app-detail-no-vendors">
                      {t("application.emptyStates.noCompatibleVendors")}
                    </span>
                  </div>
                );
              }
              return (
                <div
                  key={orderId}
                  className="app-detail-vendor-assignment-item"
                >
                  <span className="app-detail-vendor-assignment-test">
                    {order.testName} (ID: {order.testId})
                  </span>
                  <select
                    value={vendorAssignments[orderId] || ""}
                    onChange={(e) =>
                      handleVendorAssignmentChange(orderId, e.target.value)
                    }
                    className="app-detail-vendor-select"
                  >
                    <option value="" disabled>
                      {t("application.labels.selectVendor")}
                    </option>
                    {compatibleVendors.map((vendor) => (
                      <option key={vendor._id} value={vendor._id}>
                        {vendor.vendorName}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })
          )}
        </div>
        <div className="app-detail-selected-count">
          {t("application.labels.selected")}: {selectedOrders.length}{" "}
          {t("application.labels.selected").toLowerCase()}
        </div>
        <div className="app-detail-modal-actions">
          <button
            onClick={handleAssignVendors}
            className="app-detail-primary-btn primary-button"
            disabled={selectedOrders.length === 0}
          >
            <FiSave size={16} />
            {t("application.labels.assignVendor")}
          </button>
          <button
            onClick={() => {
              setShowVendorModal(false);
              setSelectedOrders([]);
              setVendorAssignments({});
            }}
            className="app-detail-secondary-btn"
          >
            <FiX size={16} />
            {t("application.labels.cancel")}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default ApplicationDetail;
