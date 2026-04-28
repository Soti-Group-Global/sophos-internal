import React, { useEffect, useState, useContext } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import {
  getEarlyDetectionApplication,
  updateEarlyDetectionAppointmentPrescription,
  updateEarlyDetectionAppointmentConclusion,
  addEarlyDetectionAppointmentComment,
  deleteEarlyDetectionAppointmentComment,
  updateEarlyDetectionVerificationStatus,
  getDoctorByEmail,
  getAvailableTests,
  addMultipleTestsToEarlyDetectionAppointment,
} from "../../utils/api";
import "./EarlyDetectionApplicationDetail.css";
import { getApptStatusClass, getApptStatusColor } from "../../utils/appointmentStatus";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  FiCalendar,
  FiClock,
  FiActivity,
  FiVideo,
  FiMessageSquare,
  FiFileText,
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
  FiCheckSquare,
  FiSquare,
  FiEdit,
  FiHeart,
  FiClipboard,
  FiChevronDown,
  FiChevronUp,
  FiExternalLink,
  FiUpload,
  FiLink,
  FiLayers,
  FiFilePlus,
  FiBell
} from "react-icons/fi";
import { GrDocumentTest, GrDocumentStore } from "react-icons/gr";
import { FaStethoscope } from "react-icons/fa6";
import Modal from "react-modal";
import { useTranslation } from "react-i18next";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer, toast } from "react-toastify";
import Swal from "sweetalert2";
import axios from "axios";

// Add this utility function right after imports
const getEmailFromToken = () => {
  try {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.email || null;
  } catch (error) {
    return null;
  }
};

const EarlyDetectionApplicationDetail = () => {
  const { applicationId } = useParams();
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
  const [documentPreviews, setDocumentPreviews] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [doctorNames, setDoctorNames] = useState({});
  const [showTestModal, setShowTestModal] = useState(false);
  const [availableTests, setAvailableTests] = useState([]);
  const [selectedTests, setSelectedTests] = useState([]);
  const [otherAppointments, setOtherAppointments] = useState([]);
  const [activeTab, setActiveTab] = useState("details");
  const [activeSection, setActiveSection] = useState("appointment");
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [uploadMode, setUploadMode] = useState("file");
  const [documentUrl, setDocumentUrl] = useState("");

  const { t, i18n } = useTranslation();
  const baseUrl = import.meta.env.VITE_BASE_URL;
  const { doctorEmail: doctorEmailFromState } = location.state || {};
  const doctorEmail = doctorEmailFromState || getEmailFromToken();

  const fetchApplication = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getEarlyDetectionApplication(
        applicationId,
        doctorEmail
      );

      setApplication(data.data);
      setOtherAppointments(data.data.otherAppointments || []);

      const firstAppt = data.data.appointments?.[0];
      setEditValues({
        prescription: firstAppt?.prescription?.text || "",
        conclusion: firstAppt?.conclusion?.text || "",
      });

      if (data.data.documents?.length > 0) {
        await fetchDocumentPreviews(data.data.documents);
      }
    } catch (err) {
      setError(t("early_detection.fetchError"));
      toast.error(t("early_detection.fetchError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplication();
  }, [applicationId, doctorEmail]);

  const fetchTestOrders = async () => {
    try {
      const orders = await axios.get(
        `${baseUrl}/api/orders/${encodeURIComponent(applicationId)}`
      );
      setOrders(orders.data);
    } catch (err) {
      toast.error(t("early_detection.messages.loadTestsError"));
    }
  };

  const handleSelectAllTests = () => {
    if (selectedTests.length === availableTests.length) {
      setSelectedTests([]);
    } else {
      setSelectedTests(
        availableTests.map((test) => ({ id: test._id, name: test.name }))
      );
    }
  };

  const fetchAvailableTests = async () => {
    try {
      const tests = await getAvailableTests();
      setAvailableTests(tests);
    } catch (err) {
      toast.error(t("early_detection.messages.loadTestOptionsError"));
    }
  };

  const handleAddTests = async () => {
    if (selectedTests.length === 0) return;

    try {
      await addMultipleTestsToEarlyDetectionAppointment(
        application.applicationId,
        selectedTests
      );

      setSelectedTests([]);
      setShowTestModal(false);
      fetchApplication();
      toast.success(
        `${selectedTests.length} ${t("early_detection.messages.testsAdded")}`
      );
    } catch (err) {
      toast.error(t("early_detection.messages.addTestsError"));
    }
  };

  useEffect(() => {
    fetchAvailableTests();
  }, []);

  useEffect(() => {
    if (application && application.applicationId) {
      fetchTestOrders();
    }
  }, [application]);

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

        const preview = {
          id: doc.fileId,
          url,
          name,
          type,
          verificationStatus: doc.verificationStatus,
        };

        return preview;
      });

      const filtered = previews.filter(Boolean);
      setDocumentPreviews(filtered);
    } catch (err) {
      setError("Failed to load document previews.");
    }
  };

  const handleVerificationAction = async (type, targetId, fieldKey) => {
    const result = await Swal.fire({
      title: t("early_detection.messages.verificationTitle"),
      text: t("early_detection.messages.verificationText"),
      icon: "question",
      showCancelButton: true,
      confirmButtonText: t("early_detection.messages.verificationApprove"),
      cancelButtonText: t("early_detection.messages.verificationDeny"),
      reverseButtons: true,
    });

    if (result.dismiss === Swal.DismissReason.cancel) {
      await updateEarlyDetectionVerificationStatus(
        type,
        targetId,
        fieldKey,
        "Disapproved",
        doctorEmail
      );
      toast.info(`${fieldKey} ${t("early_detection.messages.fieldDisapproved")}`);
    } else if (result.isConfirmed) {
      await updateEarlyDetectionVerificationStatus(
        type,
        targetId,
        fieldKey,
        "Verified",
        doctorEmail
      );
      toast.success(`${fieldKey} ${t("early_detection.messages.fieldVerified")}`);
    }

    await fetchApplication();
  };

  useEffect(() => {
    const fetchDoctorNames = async () => {
      const names = {};
      if (application?.comments) {
        for (const comment of application.comments) {
          if (comment.role === "doctor" && !doctorNames[comment.email]) {
            try {
              const response = await getDoctorByEmail(comment.email);
              const doctor = response.data.doctor;
              names[comment.email] = {
                fullName:
                  `${getFieldValue(doctor.firstName, i18n.language) || ""} ${getFieldValue(doctor.lastName, i18n.language) || ""}`.trim() ||
                  getFieldValue(doctor.fullName, i18n.language) ||
                  comment.email.split("@")[0],
                firstName: getFieldValue(doctor.firstName, i18n.language),
                lastName: getFieldValue(doctor.lastName, i18n.language),
              };
            } catch (err) {
              names[comment.email] = {
                fullName: comment.email.split("@")[0],
              };
            }
          }
        }
        setDoctorNames((prev) => ({ ...prev, ...names }));
      }
    };

    if (application?.comments) fetchDoctorNames();
  }, [application?.comments]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUploadConfirm = async () => {
    if (uploadMode === "file" && !selectedFile) {
      toast.error(t("early_detection.errors.fileRequired"));
      return;
    }

    if (uploadMode === "url" && !documentUrl.trim()) {
      toast.error(t("early_detection.errors.urlRequired"));
      return;
    }

    setUploading(true);

    try {
      if (uploadMode === "file") {
        const formData = new FormData();
        formData.append("file", selectedFile);

        const response = await fetch(
          `${baseUrl}/api/early-detection/${encodeURIComponent(
            applicationId
          )}/upload-document`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!response.ok) throw new Error("Upload failed");
      } else {
        await fetch(
          `${baseUrl}/api/early-detection/${encodeURIComponent(
            applicationId
          )}/documents/url`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url: documentUrl,
              filename: documentUrl.split("/").pop() || "Cloud Document",
            }),
          }
        );
      }

      const updatedApplication = await getEarlyDetectionApplication(
        applicationId,
        doctorEmail
      );
      setApplication(updatedApplication.data);

      if (updatedApplication.data.documents?.length > 0) {
        await fetchDocumentPreviews(updatedApplication.data.documents);
      }

      toast.success(t("early_detection.messages.documentUploaded"));
      setSelectedFile(null);
      setDocumentUrl("");
    } catch (err) {
      setError(t("early_detection.errors.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const handleEditToggle = (field) => {
    setEditing((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleEditChange = (field, value) => {
    setEditValues((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSavePrescription = async () => {
    try {
      const payload = {
        text: editValues.prescription,
        doctorEmail: doctorEmail,
      };
      const updatedApplication =
        await updateEarlyDetectionAppointmentPrescription(applicationId, editValues.prescription, doctorEmail);
      toast.success(t("early_detection.messages.prescriptionSaved"));
      setApplication(updatedApplication);
      setEditing((prev) => ({ ...prev, prescription: false }));
    } catch (err) {
      setError(t("early_detection.errors.updatePrescription"));
    }
  };

  const handleSaveConclusion = async () => {
    try {
      
      const updatedApplication =
      await updateEarlyDetectionAppointmentConclusion(applicationId, editValues.conclusion, doctorEmail);
      setApplication(updatedApplication);
      toast.success(t("early_detection.messages.conclusionSaved"));
      setEditing((prev) => ({ ...prev, conclusion: false }));
    } catch (err) {
      setError(t("early_detection.errors.updateConclusion"));
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

      const updatedComments = [...(application.comments || []), comment];
      const data = await addEarlyDetectionAppointmentComment(
        applicationId,
        updatedComments
      );
      setApplication(data);
      setNewComment("");
      setEditing((prev) => ({ ...prev, comment: false }));
    } catch (err) {
      setError(t("early_detection.errors.addComment"));
    }
  };

  const handleDeleteComment = async (commentId) => {
    const result = await Swal.fire({
      title: t("early_detection.messages.deleteConfirmTitle"),
      text: t("early_detection.messages.deleteConfirmText"),
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: t("early_detection.messages.deleteConfirmButton"),
    });

    if (!result.isConfirmed) return;

    try {
      const updatedComments = application.comments.filter(
        (comment) => comment._id !== commentId
      );
      setApplication((prev) => ({
        ...prev,
        comments: updatedComments,
      }));
      await deleteEarlyDetectionAppointmentComment(applicationId, commentId);

      Swal.fire({
        title: "Deleted!",
        text: t("early_detection.messages.commentDeleted"),
        icon: "success",
      });
    } catch (err) {
      setError(t("early_detection.errors.deleteComment"));

      Swal.fire({
        title: "Error!",
        text: t("early_detection.errors.deleteComment"),
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
    const element = document.getElementById("early-detection-pdf-content");
    element.style.display = "block";

    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Early_Detection_Application_${applicationId}.pdf`);

    element.style.display = "none";
  };

  const formatDate = (dateString) => {
    const options = { year: "numeric", month: "short", day: "numeric" };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const formatTime = (timeStr, dateStr) => {
    if (!timeStr || !dateStr) return "Not specified";
    const [hours, minutes] = timeStr.split(":");
    const date = new Date(dateStr);
    date.setHours(parseInt(hours, 10), parseInt(minutes, 10));
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "numeric",
      hour12: true,
      timeZone: "Asia/Kolkata",
    }).format(date);
  };

  const getStatusColor = (status) => getApptStatusColor(status);

  const getStatusBadge = (status) => {
    const statusKey = status?.toLowerCase().replace(/\s+/g, "_") || "";
    return <span className={`appt-status-badge ${getApptStatusClass(status)}`}>{t(`applications.status_${statusKey}`, status)}</span>;
  };

  const renderTests = () => {
    if (!orders || orders.length === 0) {
      return (
        <div className="early-detection-empty-state">
          <GrDocumentTest size={48} />
          <h4>{t("early_detection.emptyStates.noTests.title")}</h4>
          <p>{t("early_detection.emptyStates.noTests.description")}</p>
        </div>
      );
    }

    return (
      <div className="early-detection-tests-grid">
        {orders.map((order, index) => {
          const status = order.status || "Ordered";
          return (
            <div key={order._id || index} className="early-detection-test-card">
              <div className="early-detection-test-header">
                <div className="early-detection-test-info">
                  <h4 className="early-detection-test-name">
                    {order.testName}
                  </h4>
                </div>
              </div>
              <div className="early-detection-test-body">
                <span
                  className="early-detection-test-status"
                  style={{ backgroundColor: getStatusColor(status) }}
                >
                  {status}
                </span>
                <div className="early-detection-test-actions">
                  {order.resultFileId ? (
                    <>
                      <a
                        href={`${baseUrl}/api/applications/results/${order.resultFileId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="early-detection-test-action-btn early-detection-view"
                      >
                        <FiEye size={14} />
                        {t("early_detection.labels.view")}
                      </a>
                      <a
                        href={`${baseUrl}/api/applications/results/${order.resultFileId}?download=true`}
                        download
                        className="early-detection-test-action-btn early-detection-download"
                      >
                        <FiDownload size={14} />
                        {t("early_detection.labels.download")}
                      </a>
                    </>
                  ) : (
                    <span className="early-detection-no-results">
                      {t("early_detection.labels.noResults")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderRelatedApplications = () => {
    if (!otherAppointments || otherAppointments.length === 0) {
      return (
        <div className="early-detection-empty-state">
          <FiLayers size={48} />
          <h4>{t("early_detection.emptyStates.noRelatedApps.title")}</h4>
          <p>{t("early_detection.emptyStates.noRelatedApps.description")}</p>
        </div>
      );
    }

    return (
      <div className="early-detection-related-applications">
        <div className="early-detection-appointments-grid">
          {otherAppointments.map((appt, index) => (
            <div
              key={index}
              className="early-detection-appointment-card"
              onClick={() => handleRelatedAppointmentClick(appt)}
            >
              <div className="early-detection-appointment-header">
                <span className="early-detection-appointment-doctor">
                  {appt.doctorEmail}
                </span>
                {getStatusBadge(appt.appointmentStatus)}
              </div>
              <div className="early-detection-appointment-body">
                <div className="early-detection-appointment-date">
                  <FiCalendar size={14} />
                  <span>{formatDate(appt.date)}</span>
                </div>
                <div className="early-detection-appointment-time">
                  <FiClock size={14} />
                  <span>
                    {formatTime(appt.startTime, appt.date)} -{" "}
                    {formatTime(appt.endTime, appt.date)}
                  </span>
                </div>
                {appt.location && (
                  <div className="early-detection-appointment-location">
                    <FiMapPin size={14} />
                    <span>{appt.location}</span>
                  </div>
                )}
              </div>
              <div className="early-detection-appointment-footer">
                <span className="early-detection-view-details">
                  View Details <FiExternalLink size={12} />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderEarlyDetectionForm = () => {
  return (
    <div className="detection-preview-card">
      <div className="detection-preview-container">
        <div className="detection-preview-icon">
          <div className="detection-icon-wrapper">
            <FiFilePlus className="detection-main-icon" />
            <div className="detection-icon-glow"></div>
          </div>
        </div>
        
        <div className="detection-preview-content">
          <h3 className="detection-preview-title">
            {t("early_detection.form.comingSoon")}
          </h3>
          <p className="detection-preview-description">
            {t("early_detection.form.comingSoonDesc")}
          </p>
          
          <div className="detection-progress-indicator">
            <div className="detection-progress-bar">
              <div className="detection-progress-fill"></div>
            </div>
            <span className="detection-progress-text">
              {t("early_detection.form.inDevelopment")}
            </span>
          </div>
        </div>
        
        <div className="detection-features-preview">
          <div className="detection-features-header">
            <h4 className="detection-features-title">
              {t("early_detection.form.plannedFeatures")}
            </h4>
            <div className="detection-features-badge">
              {t("early_detection.form.features", { returnObjects: true }).length}
            </div>
          </div>
          
          <div className="detection-features-grid">
            {t("early_detection.form.features", { returnObjects: true }).map((feature, index) => (
              <div key={index} className="detection-feature-item">
                <div className="detection-feature-icon">
                  <div className="detection-feature-dot"></div>
                </div>
                <span className="detection-feature-text">{feature}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="detection-cta-section">
          <button className="detection-notify-btn">
            <FiBell className="detection-notify-icon" />
            {t("early_detection.form.notifyMe")}
          </button>
          <div className="detection-availability">
            <FiClock className="detection-clock-icon" />
            {t("early_detection.form.estimatedLaunch")}
          </div>
        </div>
      </div>
    </div>
  );
};

  const renderSectionContent = () => {
    const firstAppointment = application?.appointments?.[0];

    switch (activeSection) {
      case "appointment":
        return (
          <div className="early-detection-section-content">
            <div className="early-detection-overview-grid">
              <div className="early-detection-overview-item">
                <FiCalendar className="early-detection-item-icon" />
                <div className="early-detection-item-content">
                  <span className="early-detection-item-label">
                    {t("early_detection.labels.date")}
                  </span>
                  <span className="early-detection-item-value">
                    {firstAppointment
                      ? formatDate(firstAppointment.date)
                      : "Not specified"}
                  </span>
                </div>
              </div>
              <div className="early-detection-overview-item">
                <FiClock className="early-detection-item-icon" />
                <div className="early-detection-item-content">
                  <span className="early-detection-item-label">
                    {t("early_detection.labels.time")}
                  </span>
                  <span className="early-detection-item-value">
                    {firstAppointment
                      ? `${formatTime(
                          firstAppointment.startTime,
                          firstAppointment.date
                        )} - ${formatTime(
                          firstAppointment.endTime,
                          firstAppointment.date
                        )}`
                      : "Not specified"}
                  </span>
                </div>
              </div>
              <div className="early-detection-overview-item">
                <FaStethoscope className="early-detection-item-icon" />
                <div className="early-detection-item-content">
                  <span className="early-detection-item-label">
                    {t("early_detection.labels.service")}
                  </span>
                  <span className="early-detection-item-value">
                    {application?.serviceType || "Not specified"}
                  </span>
                </div>
              </div>
              <div className="early-detection-overview-item">
                {firstAppointment?.appointmentMode?.toLowerCase() ===
                "online" ? (
                  <FiVideo className="early-detection-item-icon" />
                ) : (
                  <FiMapPin className="early-detection-item-icon" />
                )}
                <div className="early-detection-item-content">
                  <span className="early-detection-item-label">
                    {t("early_detection.labels.mode")}
                  </span>
                  <span className="early-detection-item-value">
                    {firstAppointment?.appointmentMode || "Not specified"}
                    {firstAppointment?.meetingLink && (
                      <a
                        href={firstAppointment.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="early-detection-meeting-link"
                      >
                        <FiExternalLink size={12} />
                        {t("early_detection.labels.joinMeeting")}
                      </a>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );

      case "documents":
        return (
          <div className="early-detection-section-content">
            <div className="early-detection-upload-controls">
              <div className="early-detection-upload-toggle">
                <button
                  className={`early-detection-toggle-btn ${
                    uploadMode === "file" ? "active" : ""
                  }`}
                  onClick={() => setUploadMode("file")}
                >
                  <FiUpload size={14} />
                  {t("early_detection.upload.file")}
                </button>
                <button
                  className={`early-detection-toggle-btn ${
                    uploadMode === "url" ? "active" : ""
                  }`}
                  onClick={() => setUploadMode("url")}
                >
                  <FiLink size={14} />
                  {t("early_detection.upload.url")}
                </button>
              </div>

              {uploadMode === "file" ? (
                <label className="early-detection-upload-btn">
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    className="early-detection-file-input"
                    disabled={uploading}
                  />
                  <FiUpload size={14} />
                  {selectedFile ? selectedFile.name : t("early_detection.labels.uploadFile")}
                </label>
              ) : (
                <input
                  type="text"
                  placeholder={t("early_detection.labels.pasteUrl")}
                  value={documentUrl}
                  onChange={(e) => setDocumentUrl(e.target.value)}
                  className="early-detection-url-input"
                  disabled={uploading}
                />
              )}

              <button
                onClick={handleUploadConfirm}
                className="early-detection-confirm-btn"
                disabled={
                  uploading ||
                  (uploadMode === "file" && !selectedFile) ||
                  (uploadMode === "url" && !documentUrl.trim())
                }
              >
                {uploading ? t("early_detection.upload.uploading") : t("early_detection.labels.add")}
              </button>
            </div>

            {documentPreviews.length > 0 ? (
              <div className="early-detection-documents-grid">
                {documentPreviews.map((doc) => (
                  <div key={doc.id} className="early-detection-document-card">
                    <div className="early-detection-document-icon">
                      <FiFileText size={24} />
                    </div>
                    <div className="early-detection-document-info">
                      <div className="early-detection-document-name-row">
                        <span className="early-detection-document-name">
                          {doc.name}
                        </span>
                        {doc.verificationStatus === "Under Review" ? (
                          <button
                            className="early-detection-document-status under-review interactive"
                            onClick={() =>
                              handleVerificationAction(
                                "document",
                                application.applicationId,
                                doc.id
                              )
                            }
                          >
                            <FiClock className="early-detection-status-icon" />
                            {t("early_detection.labels.underReview")}
                          </button>
                        ) : (
                          <span
                            className={`early-detection-document-status ${doc.verificationStatus
                              .toLowerCase()
                              .replace(" ", "-")}`}
                          >
                            {doc.verificationStatus === "Verified" && (
                              <>
                                <FiCheckCircle className="early-detection-status-icon" />{" "}
                                {t("early_detection.labels.verified")}
                              </>
                            )}
                            {doc.verificationStatus === "Disapproved" && (
                              <>
                                <FiXCircle className="early-detection-status-icon" />{" "}
                                {t("early_detection.labels.disapproved")}
                              </>
                            )}
                          </span>
                        )}
                      </div>
                      <div className="early-detection-document-actions">
                        <a
                          href={`${baseUrl}/api/applications/appointments/document-by-id/${doc.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="early-detection-doc-action-btn early-detection-view"
                        >
                          <FiEye size={14} />
                          {t("early_detection.labels.view")}
                        </a>
                        <a
                          href={`${baseUrl}/api/applications/appointments/document-by-id/${doc.id}?download=true`}
                          download
                          className="early-detection-doc-action-btn early-detection-download"
                        >
                          <FiDownload size={14} />
                          {t("early_detection.labels.download")}
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="early-detection-empty-state">
                <FiFileText size={48} />
                <h4>{t("early_detection.emptyStates.noDocuments.title")}</h4>
                <p>{t("early_detection.emptyStates.noDocuments.description")}</p>
              </div>
            )}
          </div>
        );

      case "tests":
        return (
          <div className="early-detection-section-content">
            <div className="early-detection-tests-header">
              <button
                className="early-detection-primary-btn"
                onClick={() => setShowTestModal(true)}
              >
                <FiPlus size={16} />
                {t("early_detection.headers.addTest")}
              </button>
            </div>
            {renderTests()}
          </div>
        );

      case "prescription":
        return (
          <div className="early-detection-section-content">
            <div className="early-detection-prescription-header">
              {!editing.prescription && (
                <button
                  onClick={() => handleEditToggle("prescription")}
                  className="early-detection-secondary-btn"
                >
                  <FiEdit size={16} />
                  {t("early_detection.headers.editPrescription")}
                </button>
              )}
            </div>

            {editing.prescription ? (
              <div className="early-detection-edit-section">
                <textarea
                  value={editValues.prescription}
                  onChange={(e) =>
                    handleEditChange("prescription", e.target.value)
                  }
                  className="early-detection-textarea"
                  rows="8"
                  placeholder="Enter prescription details..."
                />
                <div className="early-detection-edit-actions">
                  <button
                    onClick={handleSavePrescription}
                    className="early-detection-primary-btn"
                  >
                    <FiSave size={16} />
                    {t("early_detection.labels.save")}
                  </button>
                  <button
                    onClick={() => handleEditToggle("prescription")}
                    className="early-detection-secondary-btn"
                  >
                    <FiX size={16} />
                    {t("early_detection.labels.cancel")}
                  </button>
                </div>
              </div>
            ) : application?.appointments?.[0]?.prescription?.text ? (
              <div className="early-detection-content-display">
                <div className="early-detection-badge-container">
                  <span
                    className={`early-detection-verification-badge ${application.appointments[0].prescription.verificationStatus
                      .toLowerCase()
                      .replace(" ", "-")}`}
                    onClick={() =>
                      application.appointments[0].prescription
                        .verificationStatus === "Under Review" &&
                      handleVerificationAction(
                        "prescription",
                        application.applicationId,
                        "prescription"
                      )
                    }
                    style={{
                      cursor:
                        application.appointments[0].prescription
                          .verificationStatus === "Under Review"
                          ? "pointer"
                          : "default",
                    }}
                  >
                    {application.appointments[0].prescription
                      .verificationStatus === "Verified" && (
                      <>
                        <FiCheckCircle className="early-detection-status-icon" />{" "}
                        {t("early_detection.labels.verified")}
                      </>
                    )}
                    {application.appointments[0].prescription
                      .verificationStatus === "Under Review" && (
                      <>
                        <FiClock className="early-detection-status-icon" />{" "}
                        {t("early_detection.labels.underReview")}
                      </>
                    )}
                    {application.appointments[0].prescription
                      .verificationStatus === "Disapproved" && (
                      <>
                        <FiXCircle className="early-detection-status-icon" />{" "}
                        {t("early_detection.labels.disapproved")}
                      </>
                    )}
                  </span>
                </div>
                {application.appointments[0].prescription.text
                  .split("\n")
                  .map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
              </div>
            ) : (
              <div className="early-detection-empty-state">
                <FiHeart size={48} />
                <h4>{t("early_detection.emptyStates.noPrescription.title")}</h4>
                <p>{t("early_detection.emptyStates.noPrescription.description")}</p>
              </div>
            )}
          </div>
        );

      case "conclusion":
        return (
          <div className="early-detection-section-content">
            <div className="early-detection-conclusion-header">
              {!editing.conclusion && (
                <button
                  onClick={() => handleEditToggle("conclusion")}
                  className="early-detection-secondary-btn"
                >
                  <FiEdit size={16} />
                  {t("early_detection.headers.editConclusion")}
                </button>
              )}
            </div>

            {editing.conclusion ? (
              <div className="early-detection-edit-section">
                <textarea
                  value={editValues.conclusion}
                  onChange={(e) =>
                    handleEditChange("conclusion", e.target.value)
                  }
                  className="early-detection-textarea"
                  rows="8"
                  placeholder="Enter conclusion details..."
                />
                <div className="early-detection-edit-actions">
                  <button
                    onClick={handleSaveConclusion}
                    className="early-detection-primary-btn"
                  >
                    <FiSave size={16} />
                    {t("early_detection.labels.save")}
                  </button>
                  <button
                    onClick={() => handleEditToggle("conclusion")}
                    className="early-detection-secondary-btn"
                  >
                    <FiX size={16} />
                    {t("early_detection.labels.cancel")}
                  </button>
                </div>
              </div>
            ) : application?.appointments?.[0]?.conclusion?.text ? (
              <div className="early-detection-content-display">
                <div className="early-detection-badge-container">
                  <span
                    className={`early-detection-verification-badge ${application.appointments[0].conclusion.verificationStatus
                      .toLowerCase()
                      .replace(" ", "-")}`}
                    onClick={() =>
                      application.appointments[0].conclusion
                        .verificationStatus === "Under Review" &&
                      handleVerificationAction(
                        "conclusion",
                        application.applicationId,
                        "conclusion"
                      )
                    }
                    style={{
                      cursor:
                        application.appointments[0].conclusion
                          .verificationStatus === "Under Review"
                          ? "pointer"
                          : "default",
                    }}
                  >
                    {application.appointments[0].conclusion
                      .verificationStatus === "Verified" && (
                      <>
                        <FiCheckCircle className="early-detection-status-icon" />{" "}
                        {t("early_detection.labels.verified")}
                      </>
                    )}
                    {application.appointments[0].conclusion
                      .verificationStatus === "Under Review" && (
                      <>
                        <FiClock className="early-detection-status-icon" />{" "}
                        {t("early_detection.labels.underReview")}
                      </>
                    )}
                    {application.appointments[0].conclusion
                      .verificationStatus === "Disapproved" && (
                      <>
                        <FiXCircle className="early-detection-status-icon" />{" "}
                        {t("early_detection.labels.disapproved")}
                      </>
                    )}
                  </span>
                </div>
                {application.appointments[0].conclusion.text
                  .split("\n")
                  .map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
              </div>
            ) : (
              <div className="early-detection-empty-state">
                <FiClipboard size={48} />
                <h4>{t("early_detection.emptyStates.noConclusion.title")}</h4>
                <p>{t("early_detection.emptyStates.noConclusion.description")}</p>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "details":
        return (
          <div className="early-detection-details-content">
            <div className="early-detection-icon-navigation">
              <button
                className={`early-detection-nav-icon ${
                  activeSection === "appointment" ? "active" : ""
                }`}
                onClick={() => setActiveSection("appointment")}
                title={t("early_detection.sections.appointment")}
              >
                <FiCalendar size={20} />
                <span>{t("early_detection.sections.appointment")}</span>
              </button>
              <button
                className={`early-detection-nav-icon ${
                  activeSection === "documents" ? "active" : ""
                }`}
                onClick={() => setActiveSection("documents")}
                title={t("early_detection.sections.documents")}
              >
                <FiFileText size={20} />
                <span>{t("early_detection.sections.documents")}</span>
              </button>
              <button
                className={`early-detection-nav-icon ${
                  activeSection === "tests" ? "active" : ""
                }`}
                onClick={() => setActiveSection("tests")}
                title={t("early_detection.sections.tests")}
              >
                <GrDocumentTest size={20} />
                <span>{t("early_detection.sections.tests")}</span>
              </button>
              <button
                className={`early-detection-nav-icon ${
                  activeSection === "prescription" ? "active" : ""
                }`}
                onClick={() => setActiveSection("prescription")}
                title={t("early_detection.sections.prescription")}
              >
                <FiHeart size={20} />
                <span>{t("early_detection.sections.prescription")}</span>
              </button>
              <button
                className={`early-detection-nav-icon ${
                  activeSection === "conclusion" ? "active" : ""
                }`}
                onClick={() => setActiveSection("conclusion")}
                title={t("early_detection.sections.conclusion")}
              >
                <FiClipboard size={20} />
                <span>{t("early_detection.sections.conclusion")}</span>
              </button>
            </div>

            <div className="early-detection-section-container">
              {renderSectionContent()}
            </div>
          </div>
        );

      case "related":
        return (
          <div className="early-detection-tab-content">
            {renderRelatedApplications()}
          </div>
        );

      case "form":
        return (
          <div className="early-detection-tab-content">
            {renderEarlyDetectionForm()}
          </div>
        );

      case "comments":
        return (
          <div className="early-detection-tab-content">
            <div className="early-detection-comments-section">
              <div className="early-detection-comments-header">
                <button
                  className="early-detection-primary-btn"
                  onClick={() =>
                    setEditing((prev) => ({ ...prev, comment: !prev.comment }))
                  }
                >
                  <FiPlus size={16} />
                  {t("early_detection.headers.addComment")}
                </button>
              </div>

              {editing.comment && (
                <div className="early-detection-comment-composer">
                  <div className="early-detection-composer-header">
                    <span className="early-detection-user-badge">
                      <FiUser size={14} /> {doctorEmail?.split("@")[0]}
                    </span>
                  </div>
                  <div className="early-detection-composer-content">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Share your thoughts..."
                      rows={3}
                      className="early-detection-composer-textarea"
                      autoFocus
                    />
                    <div className="early-detection-composer-actions">
                      <button
                        className="early-detection-secondary-btn"
                        onClick={() => {
                          setEditing((prev) => ({ ...prev, comment: false }));
                          setNewComment("");
                        }}
                      >
                        <FiX size={16} />
                        {t("early_detection.labels.cancel")}
                      </button>
                      <button
                        className="early-detection-primary-btn"
                        onClick={handleAddComment}
                        disabled={!newComment.trim()}
                      >
                        <FiSave size={16} />
                        {t("early_detection.labels.postComment")}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="early-detection-comments-feed">
                {application?.comments && application.comments.length > 0 ? (
                  application.comments.map((comment, index) => (
                    <div
                      key={comment._id || index}
                      className="early-detection-comment"
                    >
                      <div className="early-detection-comment-body">
                        <div className="early-detection-comment-header">
                          <div className="early-detection-comment-meta">
                            <span className="early-detection-comment-author">
                              {comment.role === "doctor"
                                ? doctorNames[comment.email]?.fullName ||
                                  `${
                                    doctorNames[comment.email]?.firstName || ""
                                  } ${
                                    doctorNames[comment.email]?.lastName || ""
                                  }`.trim() ||
                                  comment.email.split("@")[0]
                                : comment.role}
                            </span>
                            <span className="early-detection-comment-role">
                              ({comment.role})
                            </span>
                            <span className="early-detection-comment-time">
                              {formatRelativeTime(comment.createdAt)}
                              {comment.edited && " · edited"}
                            </span>
                          </div>
                          {comment.email === doctorEmail &&
                            comment.role === "doctor" && (
                              <button
                                className="early-detection-delete-btn"
                                onClick={() => handleDeleteComment(comment._id)}
                              >
                                <FiTrash2 size={16} />
                              </button>
                            )}
                        </div>
                        <div className="early-detection-comment-text">
                          {comment.text}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="early-detection-empty-state">
                    <FiMessageSquare size={48} />
                    <h4>{t("early_detection.emptyStates.noComments.title")}</h4>
                    <p>{t("early_detection.emptyStates.noComments.description")}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading)
    return (
      <div className="early-detection-loading-container">
        <div className="early-detection-loading-spinner"></div>
        <p>{t("early_detection.loading")}</p>
      </div>
    );

  if (error)
    return (
      <div className="early-detection-error-container">
        <div className="early-detection-error-icon">⚠️</div>
        <p>{error}</p>
        <button
          className="early-detection-retry-btn"
          onClick={() => window.location.reload()}
        >
          {t("early_detection.labels.tryAgain")}
        </button>
      </div>
    );

  if (!application)
    return (
      <div className="early-detection-empty-container">
        <h3>{t("early_detection.noApplication")}</h3>
        <p>{t("early_detection.noApplicationDesc")}</p>
      </div>
    );

  const firstAppointment = application.appointments?.[0];

  const handleRelatedAppointmentClick = async (appointment) => {
    try {
      setLoading(true);
      
      const data = await getEarlyDetectionApplication(
        appointment.applicationId || applicationId,
        appointment.doctorEmail || doctorEmail
      );

      setApplication(data.data);
      setOtherAppointments(data.data.otherAppointments || []);

      const firstAppt = data.data.appointments?.[0];
      setEditValues({
        prescription: firstAppt?.prescription?.text || "",
        conclusion: firstAppt?.conclusion?.text || "",
      });

      if (data.data.documents?.length > 0) {
        await fetchDocumentPreviews(data.data.documents);
      }

      if (data.data.applicationId) {
        await fetchTestOrders();
      }

      setActiveTab("details");
      setActiveSection("appointment");

      toast.success(t("early_detection.messages.loadAppointmentSuccess"));
    } catch (err) {
      toast.error(t("early_detection.messages.loadAppointmentError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="early-detection-modern-container">
      <ToastContainer position="top-right" autoClose={3000} />

      <div
        className={`early-detection-modern-header ${
          showPatientDropdown ? "expanded" : ""
        }`}
      >
        <div className="early-detection-header">
          <div className="early-detection-heading">
            <div className="early-detection-header-left">
              <div className="early-detection-header-top">
                <button
                  className="early-detection-back-btn"
                  onClick={() => navigate(-1)}
                >
                  <FiArrowLeft size={18} />
                </button>
              </div>

              <div className="early-detection-patient-header">
                <div className="early-detection-patient-avatar">
                  <div className="early-detection-avatar-circle">
                    <FiUser size={24} />
                  </div>
                </div>

                <div className="early-detection-patient-info">
                  <div className="early-detection-patient-main">
                    <h1 className="early-detection-patient-name">
                      {application?.patientName || "Unknown Patient"}
                    </h1>
                    <div className="early-detection-patient-details">
                      <span className="early-detection-detail-item-compact">
                        {t("early_detection.labels.applicationId")}: #{applicationId}
                      </span>
                      <span className="early-detection-detail-item-compact">
                        {t("early_detection.labels.serviceType")}: {application?.serviceType || "Not specified"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="early-detection-app-status">
              {firstAppointment &&
                getStatusBadge(firstAppointment.appointmentStatus)}
              <button
                className="early-detection-dropdown-btn"
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
            <div className="early-detection-expanded-details">
              <div className="early-detection-expanded-grid">
                <div className="early-detection-detail-section">
                  <h4>
                    <FiUser size={16} />
                    {t("early_detection.headers.applicationInfo")}
                  </h4>
                  <div className="early-detection-detail-grid">
                    <div className="early-detection-detail-item">
                      <span className="early-detection-detail-label">
                        {t("early_detection.labels.patientName")}
                      </span>
                      <span className="early-detection-detail-value">
                        {application?.patientName || "Not available"}
                      </span>
                    </div>
                    <div className="early-detection-detail-item">
                      <span className="early-detection-detail-label">
                        {t("early_detection.labels.patientEmail")}
                      </span>
                      <span className="early-detection-detail-value">
                        {application?.patientEmail || "Not available"}
                      </span>
                    </div>
                    <div className="early-detection-detail-item">
                      <span className="early-detection-detail-label">
                        {t("early_detection.labels.serviceType")}
                      </span>
                      <span className="early-detection-detail-value">
                        {application?.serviceType || "Not specified"}
                      </span>
                    </div>
                    <div className="early-detection-detail-item">
                      <span className="early-detection-detail-label">
                        {t("early_detection.labels.applicationId")}
                      </span>
                      <span className="early-detection-detail-value">
                        {applicationId}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="early-detection-tab-nav">
        <button
          className={`early-detection-tab ${
            activeTab === "details" ? "active" : ""
          }`}
          onClick={() => setActiveTab("details")}
        >
          <FiClipboard size={18} />
          <span>{t("early_detection.tabs.details")}</span>
        </button>
        <button
          className={`early-detection-tab ${
            activeTab === "related" ? "active" : ""
          }`}
          onClick={() => setActiveTab("related")}
        >
          <FiLayers size={18} />
          <span>{t("early_detection.tabs.related")}</span>
        </button>
        <button
          className={`early-detection-tab ${
            activeTab === "form" ? "active" : ""
          }`}
          onClick={() => setActiveTab("form")}
        >
          <FiFilePlus size={18} />
          <span>{t("early_detection.tabs.form")}</span>
        </button>
        <button
          className={`early-detection-tab ${
            activeTab === "comments" ? "active" : ""
          }`}
          onClick={() => setActiveTab("comments")}
        >
          <FiMessageSquare size={18} />
          <span>{t("early_detection.tabs.comments")} ({application.comments?.length || 0})</span>
        </button>
      </div>

      <div className="early-detection-content-area">
        {renderTabContent()}
      </div>

      <div className="early-detection-download-container">
        <button
          className="early-detection-primary-btn"
          onClick={generateAndDownloadPDF}
        >
          <FiDownload size={16} />
          {t("early_detection.labels.download")} PDF
        </button>
      </div>

      <div id="early-detection-pdf-content" style={{ display: "none" }}>
        <h2>Early Detection Application {applicationId}</h2>
        <p>Patient: {application?.patientName}</p>
        <p>Email: {application?.patientEmail}</p>
        <p>Service: {application?.serviceType}</p>
        {firstAppointment && (
          <>
            <p>Date: {formatDate(firstAppointment.date)}</p>
            <p>
              Time:{" "}
              {formatTime(firstAppointment.startTime, firstAppointment.date)} -{" "}
              {formatTime(firstAppointment.endTime, firstAppointment.date)}
            </p>
            <p>Mode: {firstAppointment.appointmentMode}</p>
            <p>Status: {firstAppointment.appointmentStatus}</p>
          </>
        )}
        <p>
          Prescription:{" "}
          {firstAppointment?.prescription?.text || "Not specified"}
        </p>
        <p>
          Conclusion: {firstAppointment?.conclusion?.text || "Not specified"}
        </p>
        <p>
          Tests:{" "}
          {orders.length > 0
            ? orders
                .map(
                  (order) => `${order.testName} (${order.status || "Ordered"})`
                )
                .join(", ")
            : "None"}
        </p>
        <p>Comments: {application.comments?.length || 0}</p>
      </div>

      <Modal
        isOpen={showTestModal}
        onRequestClose={() => {
          setShowTestModal(false);
          setSelectedTests([]);
        }}
        contentLabel="Add Tests Modal"
        className="early-detection-modal"
        overlayClassName="early-detection-modal-overlay"
      >
        <div className="early-detection-modal-header">
          <h3>{t("early_detection.headers.selectTests")}</h3>
          <button
            className="early-detection-select-all-btn"
            onClick={handleSelectAllTests}
          >
            {selectedTests.length === availableTests.length ? (
              <>
                <FiCheckSquare size={16} />
                {t("early_detection.labels.deselectAll")}
              </>
            ) : (
              <>
                <FiSquare size={16} />
                {t("early_detection.labels.selectAll")}
              </>
            )}
          </button>
        </div>
        <div className="early-detection-tests-list">
          {availableTests.map((test) => {
            const isSelected = selectedTests.some((t) => t.testId === test._id);
            const isAlreadyAdded = orders?.some(
              (t) => String(t.testId) === String(test._id)
            );

            return (
              <div
                key={test._id}
                className={`early-detection-test-item ${
                  isSelected ? "selected" : ""
                } ${isAlreadyAdded ? "disabled" : ""}`}
                onClick={() => {
                  if (!isAlreadyAdded) {
                    handleTestSelection(test._id, test.name);
                  }
                }}
              >
                <div className="early-detection-test-checkbox">
                  {isAlreadyAdded ? (
                    <FiCheckSquare className="early-detection-already-added-icon" />
                  ) : isSelected ? (
                    <FiCheckSquare />
                  ) : (
                    <FiSquare />
                  )}
                </div>
                <div className="early-detection-test-info">
                  <span className="early-detection-test-name">{test.name}</span>
                  {test.specialtyName && (
                    <span className="early-detection-test-specialty">
                      {test.specialtyName}
                    </span>
                  )}
                  {isAlreadyAdded && (
                    <span className="early-detection-test-note">
                      {t("early_detection.test.alreadyAdded")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="early-detection-selected-count">
          {t("early_detection.labels.selectedTests")}: {selectedTests.length} {t("early_detection.labels.selectedTests").toLowerCase()}
        </div>
        <div className="early-detection-modal-actions">
          <button
            onClick={handleAddTests}
            className="early-detection-primary-btn"
            disabled={selectedTests.length === 0}
          >
            <FiSave size={16} />
            {t("early_detection.headers.addTest")}
          </button>
          <button
            onClick={() => {
              setShowTestModal(false);
              setSelectedTests([]);
            }}
            className="early-detection-secondary-btn"
          >
            <FiX size={16} />
            {t("early_detection.labels.cancel")}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default EarlyDetectionApplicationDetail;