import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  getAppointmentById,
  // getSpecialtyByName,
  updateAppointmentPrescription,
  updateAppointmentConclusion,
  getAvailableTests,
  // getVendors,
  uploadDocumentFile,
  uploadDocumentUrl,
  getMedicalHistoryByEmail,
  getPatientByEmail,
  addMultipleTestsToAppointment,
  viewDocument,
  downloadDocument,
} from "../utils/api";
import "../styles/ApplicationDetail.css";
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
} from "react-icons/fi";

import { Clock, CheckCircle, AlertCircle, X } from "lucide-react";
import { FaStethoscope } from "react-icons/fa6";
import { GrDocumentTest } from "react-icons/gr";
import { useTranslation } from "react-i18next";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Modal from "react-modal";
import axios from "axios";

const ApplicationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'ru' ? 'ru' : 'en';
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
  const [loadingDocuments, setLoadingDocuments] = useState({});

  const baseUrl = import.meta.env.VITE_BASE_URL;

  useEffect(() => {
    if (!id) {
      console.error("No ID provided in useParams. Route:", location.pathname);
      setError(t("application.noAppointmentId"));
      toast.error(t("application.noAppointmentId"));
      setLoading(false);
      return;
    }
    fetchApplication();
    fetchAvailableTests();
    // fetchVendors();
  }, [id]);

  const fetchApplication = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getAppointmentById(id);

      if (!data) {
        throw new Error(t("application.applicationNotFound"));
      }
      setApplication(data);
      setPrescriptionText(data.prescription?.text || "");
      setConclusionText(data.conclusion?.text || "");

      if (data.documents?.length > 0) {
        await fetchDocumentPreviews(data.documents);
      }

      if (data.specialty) {
        // const specialty = await getSpecialtyByName(data.specialty);
        // setSpecialtyName(specialty.specialty.name);
        setSpecialtyName(data.specialty);
      }

      await fetchTestOrders(data.applicationId);

      if (data.patientEmail) {
        await fetchPatientDetails(data.patientEmail);
        fetchMedicalHistory(data.patientEmail);
      } else {
        console.warn("No patientEmail found in application data:", data);
      }
    } catch (err) {
      console.error("Fetch error:", err.message);
      setError(err.message || t("application.fetchError"));
      toast.error(err.message || t("application.fetchError"));
    } finally {
      setLoading(false);
    }
  };

  const fetchPatientDetails = async (email) => {
    try {
      const patientData = await getPatientByEmail(email);
      setPatient(patientData);
    } catch (err) {
      console.error("Failed to fetch patient details:", err);
    }
  };

  const fetchMedicalHistory = async (email) => {
    try {
      setHistoryLoading(true);
      const medicalHistoryData = await getMedicalHistoryByEmail(email);
      setMedicalHistory(medicalHistoryData.data || []);
    } catch (err) {
      console.error("Failed to fetch medical history:", err);
      toast.error("Failed to fetch medical history");
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchDocumentPreviews = async (documents) => {
    try {
      const previews = documents.map((doc) => {
        const url =
          doc.url ||
          `${baseUrl}/api/applications/appointments/media/${doc.fileId}`;
        const name = doc.filename || "Document";

        const extFromName = name.split(".").pop()?.toLowerCase();
        const extFromUrl = url.split(".").pop()?.split("?")[0]?.toLowerCase();
        const type = extFromName || extFromUrl || "file";

        return {
          id: doc._id || doc.fileId || `${name}-${url}`,
          url,
          name,
          type,
          verificationStatus: doc.verificationStatus, // make sure it's passed
          uploadedAt: doc.uploadedAt,
        };
      });

      setDocumentPreviews(previews.filter(Boolean));
    } catch (err) {
      console.error("Error fetching document previews:", err);
      setError(t("application.documentFetchError"));
      toast.error(t("application.documentFetchError"));
    }
  };

  const handleView = async (doc, e) => {
    e.stopPropagation();
    setLoadingDocuments((prev) => ({ ...prev, [`view-${doc.id}`]: true }));
    try {
      await viewDocument(doc.id);
    } catch (error) {
      toast.error(
        `Failed to view document: ${
          error.response?.data?.message || error.message
        } [${error.response?.data?.code || "UNKNOWN"}]`
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
        `Failed to download document: ${
          error.response?.data?.message || error.message
        } [${error.response?.data?.code || "UNKNOWN"}]`
      );
    } finally {
      setLoadingDocuments((prev) => ({
        ...prev,
        [`download-${doc.id}`]: false,
      }));
    }
  };

  const fetchAvailableTests = async () => {
    try {
      const tests = await getAvailableTests();
      setAvailableTests(tests);
    } catch (err) {
      console.error("Failed to fetch test options", err);
      toast.error(t("application.testFetchError"));
    }
  };

  // const fetchVendors = async () => {
  //   try {
  //     const response = await getVendors();
  //     setVendors(response.vendors || []);
  //   } catch (err) {
  //     console.error("Failed to fetch vendors", err);
  //     toast.error(t("application.vendorFetchError"));
  //   }
  // };

  const fetchTestOrders = async (applicationId) => {
    try {
      const orders = await axios.get(
        `${baseUrl}/api/specialties/orders/${encodeURIComponent(
          applicationId
        )}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        }
      );
      setOrders(orders.data);
    } catch (err) {
      console.error("Failed to fetch test orders:", err);
      toast.error(t("application.testOrderFetchError"));
    }
  };

  // const getCompatibleVendors = (testId) => {
  //   if (!testId) {
  //     toast.error(t("application.invalidTestId"));
  //     return [];
  //   }
  //   const compatible = vendors.filter((vendor) => {
  //     if (!vendor.services || !Array.isArray(vendor.services)) {
  //       return false;
  //     }
  //     const canHandleTest = vendor.services.some((service) => {
  //       if (!service.selectedTests || !Array.isArray(service.selectedTests)) {
  //         return false;
  //       }
  //       return service.selectedTests.some((test) => {
  //         const match = test.testId.toString() === testId.toString();
  //         return match;
  //       });
  //     });

  //     return canHandleTest;
  //   });

  //   return compatible;
  // };

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

    // setUploading(true);
    //     const formData = new FormData();
    //     formData.append("file", selectedFile);
    
    //     try {
    //       const response = await fetch(
    //         `${baseUrl}/api/applications/appointments/${appointment._id}/upload-document`,
    //         {
    //           method: "POST",
    //           body: formData,
    //           headers: {
    //             Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
    //           },
    //         }
    //       );
    
    //       if (!response.ok) throw new Error("Upload failed");
    
    //       // Refresh the documents list without full page reload
    //       const updatedAppointment = await getAppointmentById(id);
    //       setAppointment(updatedAppointment);
    //       if (
    //         updatedAppointment.documents &&
    //         updatedAppointment.documents.length > 0
    //       ) {
    //         await fetchDocumentPreviews(updatedAppointment.documents);
    //       }
    //     } catch (err) {
    //       console.error("Error uploading document:", err);
    //       setError("Failed to upload document.");
    //     } finally {
    //       setSelectedFile(null);
    //       setUploading(false);
    //     }

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

      const data = await getAppointmentById(id);
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
      await addMultipleTestsToAppointment(
              application.applicationId,
              selectedTests
            );
      await fetchTestOrders(application.applicationId);
      setSelectedTests([]);
      setShowTestModal(false);
      toast.success(
        t("application.testsAdded", { count: selectedTests.length })
      );
    } catch (err) {
      console.error("Failed to add tests", err);
      toast.error(t("application.testAddError"));
    }
  };

  const handleEditPrescription = () => {
    setEditPrescription(true);
    setPrescriptionText(application.prescription?.text || "");
  };

  const handleSavePrescription = async () => {
    try {
      const updatedApplication = await updateAppointmentPrescription(
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
      const updatedApplication = await updateAppointmentConclusion(
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

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "var(--app-detail-success)";
      case "confirmed":
        return "var(--app-detail-success)";
      case "cancelled":
        return "var(--app-detail-error)";
      case "ordered":
        return "var(--app-detail-info)";
      case "pending":
        return "var(--app-detail-warning)";
      case "waiting for assign":
        return "var(--app-detail-warning)";
      default:
        return "var(--app-detail-neutral)";
    }
  };

  const formatDate = (dateString) => {
    const options = { year: "numeric", month: "short", day: "numeric" };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return t("application.messages.notSpecified");
    const date = new Date(timeStr);

    const formattedTime = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });

    return formattedTime;
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

  const handleHistoryItemClick = async (historyItem) => {
    try {
      if(application.applicationId === historyItem.applicationId) {
        return;
      }

      // setActiveTab("details");
      setActiveSection("appointment");

      const data = await getAppointmentById(historyItem.applicationId);

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
        // fetchMedicalHistory(data.patientEmail);
      }

      toast.success(`Loaded appointment ${historyItem.applicationId}`);
    } catch (err) {
      console.error("Error loading history application:", err);
      toast.error("Failed to load selected application");
    }
  };

  const handleJoinMeeting = async () => {
    try {
      const applicationId = application?.applicationId || application?._id;
      if (!applicationId) return;

      const doctorName = (typeof application?.doctorName === 'object'
        ? application.doctorName?.[lang] || application.doctorName?.en
        : application?.doctorName) || "Doctor";
      const meetingTitle = `${doctorName} - Consultation`;

      navigate(
        `/meeting-room?applicationId=${encodeURIComponent(
          applicationId
        )}&role=${encodeURIComponent("assistant")}&title=${encodeURIComponent(
          meetingTitle
        )}`
      );
    } catch (err) {
      console.error("Failed to join meeting:", err);
      toast.error("Failed to start meeting");
    }
  };

  const renderSectionContent = () => {
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
                    {formatTime(application.startTime)} -{" "}
                    {formatTime(application.endTime)}
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
                    {application?.doctorName
                      ? (typeof application.doctorName === 'object' ? application.doctorName?.[lang] || application.doctorName?.en : application.doctorName)
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
            </div>
          </div>
        );

      case "documents":
        return (
          <div className="app-detail-section-content">
            <div className="app-detail-upload-controls">
              <div className="app-detail-upload-toggle">
                <button
                  className={`app-detail-toggle-btn ${
                    uploadMode === "file" ? "active" : ""
                  }`}
                  onClick={() => setUploadMode("file")}
                >
                  <FiUpload size={14} />
                  {t("application.labels.uploadFile")}
                </button>
                <button
                  className={`app-detail-toggle-btn ${
                    uploadMode === "url" ? "active" : ""
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
                        <button
                          onClick={(e) => handleView(doc, e)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="app-detail-doc-action-btn app-detail-view"
                          disabled={loadingDocuments[`view-${doc.id}`]}
                        >
                          <FiEye size={14} />
                          {loadingDocuments[`view-${doc.id}`]
                          ? t("appointment.loading")
                          : t("appointment.view")}
                          {/* {t("application.labels.view")} */}
                        </button>
                        <button
                          onClick={(e) => handleDownload(doc, e)}
                          disabled={loadingDocuments[`download-${doc.id}`]}
                          className="app-detail-doc-action-btn app-detail-download"
                        >
                          <FiDownload size={14} />
                          {loadingDocuments[`download-${doc.id}`]
                          ? t("appointment.loading")
                          : t("appointment.download")}
                          {/* {t("application.labels.download")} */}
                        </button>
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
                    </div>
                    <div className="app-detail-test-body">
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

      case "meeting":
        return (
          <div className="app-detail-section-content">
            <div className="app-detail-prescription-header">
              <button
                onClick={handleJoinMeeting}
                className="app-detail-primary-btn"
              >
                <FiVideo size={16} />
                {t("application.labels.joinNow")}
              </button>

              {application.meetingLink && (
                <a
                  href={application.meetingLink}
                  target="_blank"
                  rel="noreferrer"
                  className="app-detail-meeting-link"
                  style={{ marginLeft: "12px" }}
                >
                  <FiExternalLink size={14} />
                  {t("application.labels.joinMeeting")}
                </a>
              )}
            </div>

            <div className="app-detail-content-display">
              <p>
                <strong>{t("application.labels.mode")}:</strong>{" "}
                {application.appointmentMode ||
                  t("application.messages.notSpecified")}
              </p>
              <p>
                <strong>{t("application.labels.doctor")}:</strong>{" "}
                {application?.doctorName
                  ? (typeof application.doctorName === 'object' ? application.doctorName?.[lang] || application.doctorName?.en : application.doctorName)
                  : t("application.messages.unknownDoctor")}
              </p>
              <p>
                <strong>{t("patient") || "Patient"}:</strong>{" "}
                {application?.patientEmail ||
                  t("application.messages.notSpecified")}
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading)
    return (
      <div className="app-detail-loading-container">
        <div className="app-detail-loading-spinner"></div>
        <p>{t("application.messages.loading")}</p>
      </div>
    );

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
    const statusConfig = {
      paid: { color: "success-status", icon: CheckCircle },
      confirmed: { color: "confirmed-status", icon: CheckCircle },
      pending: { color: "warning-status", icon: Clock },
      cancelled: { color: "cancelled-status", icon: X },
      upcoming: { color: "upcoming-status", icon: Clock },
      unconfirmed: { color: "unconfirmed-status", icon: AlertCircle },
    };

    const config =
      statusConfig[status?.toLowerCase()] || statusConfig.unconfirmed;
    const Icon = config.icon;

    return (
      <span className={`status-badge-app status-${config.color}`}>
        <Icon size={12} />
        {t(`application.status.${status?.toLowerCase().replace(" ", "_")}`)}
      </span>
    );
  };

  return (
    <div className="app-detail-modern-container">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Modern Header with Patient Info */}
      <div
        className={`app-detail-modern-header ${
          showPatientDropdown ? "expanded" : ""
        }`}
      >
        <div
          className={`app-detail-header ${
            showPatientDropdown ? "expanded" : ""
          }`}
        >
          <div className="app-detail-heading">
            <div className="application-detail-header-left">
              <div className="app-detail-header-top">
                <button
                  className="app-detail-back-btn"
                  onClick={() => navigate(-1)}
                >
                  <FiArrowLeft size={18} />
                </button>
              </div>

              <div className="app-detail-patient-header">
                <div className="app-detail-patient-avatar">
                  <div className="app-detail-avatar-circle">
                    <FiUser size={24} />
                  </div>
                </div>

                <div className="app-detail-patient-info">
                  <div className="app-detail-patient-main">
                    <h1 className="app-detail-patient-name">
                      {patient
                        ? `${patient.firstName || ""} ${
                            patient.middleName || ""
                          } ${patient.lastName || ""}`.trim()
                        : application.patient
                        ? `${application.patient.firstName || ""} ${
                            application.patient.middleName || ""
                          } ${application.patient.lastName || ""}`.trim()
                        : t("application.messages.unknownPatient")}
                    </h1>
                    <div className="app-detail-patient-details">
                      <span className="app-detail-detail-item-compact">
                        {t("application.messages.applicationId")}: #{id}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="application-detail-app-status">
              {getStatusBadge(application.appointmentStatus)}
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
                        {t("application.personalInfo.fullName")}
                      </span>
                      <span className="app-detail-detail-value">
                        {patient
                          ? `${patient.firstName || ""} ${
                              patient.middleName || ""
                            } ${patient.lastName || ""}`.trim()
                          : t("application.messages.notAvailable")}
                      </span>
                    </div>
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
                        {patient?.dateOfBirth ||
                          application.patient?.dateOfBirth ||
                          t("application.messages.notAvailable")}
                      </span>
                    </div>
                    <div className="app-detail-detail-item">
                      <span className="app-detail-detail-label">
                        {t("application.personalInfo.gender")}
                      </span>
                      <span className="app-detail-detail-value">
                        {patient?.gender ||
                          application.patient?.gender ||
                          t("application.messages.notSpecified")}
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
      </div>

      {/* Tab Navigation */}
      <div className="app-detail-tab-nav">
        <button
          className={`app-detail-tab ${
            activeTab === "details" ? "active" : ""
          }`}
          onClick={() => setActiveTab("details")}
        >
          <FiClipboard size={18} />
          <span>{t("application.tabs.details")}</span>
        </button>
        <button
          className={`app-detail-tab ${
            activeTab === "history" ? "active" : ""
          }`}
          onClick={() => setActiveTab("history")}
        >
          <FiClock size={18} />
          <span>{t("application.tabs.history")}</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="app-detail-content-area">

        <div className="app-detail-content-card">
          {activeTab === "details" && (
            <div className="app-detail-history-card">
              <div className="app-detail-history-header">
                <div className="app-detail-history-id">
                  #{application.applicationId}
                </div>
                <span
                  className="app-detail-history-status"
                  style={{
                    backgroundColor: getStatusColor(
                      application.appointmentStatus
                    ),
                  }}
                >
                  {application.appointmentStatus}
                </span>
              </div>
              <div className="app-detail-history-body">
                <div className="app-detail-history-date">
                  <FiCalendar size={16} />
                  <span>
                    {formatDate(application.date)} •{" "}
                    {formatTime(application.startTime, application.date)}{" "}
                    - {formatTime(application.endTime, application.date)}
                  </span>
                </div>
                <div className="app-detail-history-doctor">
                  <FiUser size={16} />
                  <span>
                    Dr.{" "}
                    {application.doctorName
                      ? (typeof application.doctorName === 'object' ? application.doctorName?.[lang] || application.doctorName?.en : application.doctorName)
                      : t("application.messages.unknownDoctor")}
                  </span>
                </div>
                <div className="app-detail-history-service">
                  <FaStethoscope size={16} />
                  <span>{application.serviceType}</span>
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
          )}

          {(activeTab !== 'details' && historyLoading) && (
            <div className="app-detail-loading-state">
              <div className="app-detail-loading-spinner"></div>
              <p>{t("application.messages.loadingHistory")}</p>
            </div>
          )}

          {(activeTab !== 'details' && !historyLoading && medicalHistory.length > 0) && (
            <>
              {medicalHistory.map((historyItem) => (
                <div
                  key={historyItem._id || historyItem.applicationId}
                  className={`app-detail-history-card ${historyItem.applicationId === application.applicationId ? "selected" : ""}`}
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
                      {historyItem.appointmentStatus}
                    </span>
                  </div>
                  <div className="app-detail-history-body">
                    <div className="app-detail-history-date">
                      <FiCalendar size={16} />
                      <span>
                        {formatDate(historyItem.date)} •{" "}
                        {formatTime(historyItem.startTime)}{" "}
                        - {formatTime(historyItem.endTime)}
                      </span>
                    </div>
                    <div className="app-detail-history-doctor">
                      <FiUser size={16} />
                      <span>
                        Dr.{" "}
                        {historyItem.doctor
                          ? `${historyItem.doctor.firstName?.[lang] || historyItem.doctor.firstName?.en || ''} ${
                              historyItem.doctor.lastName?.[lang] || historyItem.doctor.lastName?.en || ''
                            }`.trim()
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
            </>
          )}
          
          {(activeTab !== 'details' && !historyLoading && medicalHistory.length === 0) && (
            <div className="app-detail-empty-state">
              <FiClock size={64} />
              <h3>{t("application.emptyStates.noMedicalHistory.title")}</h3>
              <p>
                {t("application.emptyStates.noMedicalHistory.description")}
              </p>
            </div>
          )}
        </div>

        <div className="app-detail-details-content">
          {/* Icon Navigation */}
          <div className="app-detail-icon-navigation">
            <button
              className={`app-detail-nav-icon ${
                activeSection === "appointment" ? "active" : ""
              }`}
              onClick={() => setActiveSection("appointment")}
              title={t("application.sections.appointment")}
            >
              <FiCalendar size={24} />
              <span>{t("application.sections.appointment")}</span>
            </button>
            <button
              className={`app-detail-nav-icon ${
                activeSection === "documents" ? "active" : ""
              }`}
              onClick={() => setActiveSection("documents")}
              title={t("application.sections.documents")}
            >
              <FiFileText size={24} />
              <span>{t("application.sections.documents")}</span>
            </button>
            <button
              className={`app-detail-nav-icon ${
                activeSection === "tests" ? "active" : ""
              }`}
              onClick={() => setActiveSection("tests")}
              title={t("application.sections.tests")}
            >
              <GrDocumentTest size={24} />
              <span>{t("application.sections.tests")}</span>
            </button>
            <button
              className={`app-detail-nav-icon ${
                activeSection === "prescription" ? "active" : ""
              }`}
              onClick={() => setActiveSection("prescription")}
              title={t("application.sections.prescription")}
            >
              <FiHeart size={24} />
              <span>{t("application.sections.prescription")}</span>
            </button>
            <button
              className={`app-detail-nav-icon ${
                activeSection === "conclusion" ? "active" : ""
              }`}
              onClick={() => setActiveSection("conclusion")}
              title={t("application.sections.conclusion")}
            >
              <FiClipboard size={24} />
              <span>{t("application.sections.conclusion")}</span>
            </button>
            <button
              className={`app-detail-nav-icon ${
                activeSection === "meeting" ? "active" : ""
              }`}
              onClick={() => setActiveSection("meeting")}
              title={t("application.sections.meeting")}
            >
              <FiVideo size={24} />
              <span>{t("application.sections.meeting")}</span>
            </button>
          </div>

          {/* Section Content */}
          <div className="app-detail-section-container">
            {renderSectionContent()}
          </div>
        </div>
        
      </div>

      {/* Hidden PDF Content */}
      <div id="app-detail-pdf-content" style={{ display: "none" }}>
        <h2>Application {id}</h2>
        <p>Date: {application.date}</p>
        <p>
          Time: {formatTime(application.startTime)} -{" "}
          {formatTime(application.endTime)}
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
                    `${order.testName} (${
                      order.status || "Waiting for Assign"
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
                className={`app-detail-test-item ${
                  isSelected ? "selected" : ""
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
            className="app-detail-primary-btn"
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

    </div>
  );
};

export default ApplicationDetail;
