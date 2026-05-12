import React, { useEffect, useState } from "react";
import {
  getAppointmentById,
  updateAppointment,
  getEmailFromToken,
  updateAppointmentComments,
  addCommentInAppointment,
  deleteAppointmentComment,
  updateAppointmentConclusion,
  updateAppointmentPrescription,
  getDocument,
  updateVerificationStatus,
  getAvailableTests,
  addTestToAppointment,
  updateTestResult,
  addMultipleTestsToAppointment,
  getOrdersByIds,
  saveFollowUp,
  viewDocument,
  downloadDocument,
    viewResultDocument,
  downloadResultDocument,
} from "../../utils/api";
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
  FiXCircle,
  FiSquare,
  FiCheckSquare,
  FiEye,
  FiDownload,
  FiUpload,

} from "react-icons/fi";
import { GrDocumentTest, GrDocumentStore } from "react-icons/gr";
import "../../styles/AppointmentTab.css";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import AppointmentPDFTemplate from "../AppointmentPDFTemplate";
import { useTranslation } from "react-i18next";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer, toast } from "react-toastify";
import Swal from "sweetalert2";
import Modal from "react-modal";
import axios from "axios";
import moment from "moment-timezone";
import { formatDateISO, formatTimeHHMM } from "../../utils/dateFormat";

const AppointmentTab = ({ appointmentId, currentUser, patient }) => {
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState({
    prescription: false,
    conclusion: false,
    comment: false,
  });
  const [editValues, setEditValues] = useState({
    prescription: appointment?.prescription || "",
    conclusion: appointment?.conclusion || "",
  });
  const [newComment, setNewComment] = useState("");
  const doctorEmail = getEmailFromToken();
  const [documentPreviews, setDocumentPreviews] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [availableTests, setAvailableTests] = useState([]);
  const [selectedTests, setSelectedTests] = useState([]);
  const [testResults, setTestResults] = useState({});
  const [orders, setOrders] = useState([]);
  const [followUpNeeded, setFollowUpNeeded] = useState(false);
  const [followUpComment, setFollowUpComment] = useState("");
  const [loadingDocuments, setLoadingDocuments] = useState({});


  const { t } = useTranslation();

  const baseUrl = import.meta.env.VITE_BASE_URL;

  const fetchAppointment = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getAppointmentById(appointmentId);
      // Initialize all state at once for consistency
      setAppointment(data);
      setEditValues({
        prescription: data.prescription?.text || "",
        conclusion: data.conclusion?.text || "",
      });

      // Fetch document previews if they exist
      if (data.documents?.length > 0) {
        await fetchDocumentPreviews(data.documents);
      }

      // Fetch test orders if they exist
      if (data.tests?.length > 0) {
        await fetchTestOrders(data.tests);
      }

    } catch (err) {
      setError(t("appointment.fetchError")); // Use translation
      toast.error(t("appointment.fetchError")); // Show error toast
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointment();
  }, [appointmentId]);

  const fetchTestOrders = async () => {
    try {
      // Fetch all orders for this appointment using appointmentId
      const orders = await axios.get(
        `${baseUrl}/api/specialties/orders/${encodeURIComponent(
          appointment.applicationId
        )}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`
          },
        }
      );


      setOrders(orders.data);
    } catch (err) {
      console.error("Failed to fetch test orders:", err);
      toast.error("Failed to load test information");
    }
  };

  useEffect(() => {
    if (appointment && appointment.applicationId) {
      fetchTestOrders();
    }
  }, [appointment]);

  const fetchAvailableTests = async () => {
    try {
      const tests = await getAvailableTests();
      setAvailableTests(tests);
    } catch (err) {
      console.error("Failed to fetch test options", err);
      toast.error("Failed to load test options");
    }
  };

  useEffect(() => {
    fetchAvailableTests();
  }, []);

  const handleTestSelection = (testId, testName) => {
    setSelectedTests((prev) => {
      const isSelected = prev.some((test) => test.testId === testId);
      if (isSelected) {
        return prev.filter((test) => test.testId !== testId);
      } else {
        return [...prev, { testId, testName, appointmentId: appointment._id }]; // Use appointment._id from state
      }
    });
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

  const handleAddTests = async () => {
    if (selectedTests.length === 0) return;

    try {
      // Use applicationId instead of _id
      await addMultipleTestsToAppointment(
        appointment.applicationId,
        selectedTests
      );
      setSelectedTests([]);
      setShowTestModal(false);
      fetchAppointment(); // Refresh the appointment data
      toast.success(`${selectedTests.length} test(s) added successfully`);
    } catch (err) {
      console.error("Failed to add tests", err);
      toast.error("Failed to add tests");
    }
  };

  const handleResultChange = async (testName, value) => {
    try {
      await updateTestResult(appointment._id, testName, value);
      fetchAppointment();
      toast.success("Test result updated");
    } catch (err) {
      console.error("Failed to update test result", err);
      toast.error("Failed to update test result");
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

        const preview = {
          id: doc.fileId,
          url,
          name,
          type,
          verificationStatus: doc.verificationStatus,
          uploadedAt: doc.uploadedAt
        };

        return preview;
      });

      const filtered = previews.filter(Boolean);

      setDocumentPreviews(filtered);
    } catch (err) {
      console.error("Error fetching document previews:", err);
      setError("Failed to load document previews.");
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

  // Update the handleSave function to handle empty cases
  const handleSave = async (field) => {
    try {
      const updatedValue = editValues[field].trim();
      const updatedAppointment = {
        ...appointment,
        [field]: updatedValue || "No " + field + " added", // Default text if empty
      };

      const data = await updateAppointment(appointmentId, updatedAppointment);
      setAppointment(data);
      setEditing((prev) => ({ ...prev, [field]: false }));
    } catch (err) {
      setError(`Failed to update ${field}. Please try again.`);
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

      const data = await addCommentInAppointment(
        appointmentId,
        updatedComments
      );
      setAppointment(data);
      setNewComment("");
      setEditing((prev) => ({ ...prev, comment: false }));
    } catch (err) {
      setError("Failed to add comment. Please try again.");
    }
  };

  const handleEditComment = async (commentId, newText) => {
    if (!newText.trim()) return;

    try {
      const updatedComment = {
        text: newText,
        edited: true,
        doctorEmail: doctorEmail,
        editTimestamp: new Date().toISOString(),
      };

      // Hit the comment update endpoint
      const updatedData = await updateAppointmentComments(
        appointmentId,
        commentId,
        updatedComment
      );

      // Replace the updated comment in local state
      const updatedComments = appointment.comments.map((comment) =>
        comment._id === commentId
          ? { ...comment, ...updatedComment, isEditing: false }
          : comment
      );

      setAppointment((prev) => ({ ...prev, comments: updatedComments }));
    } catch (err) {
      console.error("Error editing comment:", err);
      setError("Failed to edit comment. Please try again.");
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) {
      return;
    }

    try {
      // Optimistic update: Remove from local state first
      const updatedComments = appointment.comments.filter(
        (comment) => comment._id !== commentId
      );

      setAppointment((prev) => ({
        ...prev,
        comments: updatedComments,
      }));

      // Then make API call
      await deleteAppointmentComment(appointmentId, commentId);
    } catch (err) {
      // Revert if API call fails
      console.error("Error deleting comment:", err);
      setAppointment((prev) => ({
        ...prev,
        comments: appointment.comments, // Restore original comments
      }));
      setError("Failed to delete comment. Please try again.");
    }
  };

  // Utility function to format relative time (e.g., "2 hours ago")
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

  // Example usage in your component
  const handleSavePrescription = async () => {
    try {
      const updatedAppointment = await updateAppointmentPrescription(
        appointmentId,
        editValues.prescription
      );
      setAppointment(updatedAppointment);
      setEditing((prev) => ({ ...prev, prescription: false }));
    } catch (err) {
      setError("Failed to update prescription. Please try again.");
    }
  };

  const handleSaveConclusion = async () => {
    try {
      const updatedAppointment = await updateAppointmentConclusion(
        appointmentId,
        editValues.conclusion
      );
      setAppointment(updatedAppointment);
      setEditing((prev) => ({ ...prev, conclusion: false }));
    } catch (err) {
      setError("Failed to update conclusion. Please try again.");
    }
  };

  const handleVerificationAction = async (type, targetId, fieldKey) => {
    const result = await Swal.fire({
      title: "Verification Action",
      text: "Approve or Deny this item?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Approve",
      cancelButtonText: "Deny",
      reverseButtons: true,
    });

    if (result.dismiss === Swal.DismissReason.cancel) {
      await updateVerificationStatus(type, targetId, fieldKey, "Disapproved");
      toast.info(`${fieldKey} marked as Disapproved`);
    } else if (result.isConfirmed) {
      await updateVerificationStatus(type, targetId, fieldKey, "Verified");
      toast.success(`${fieldKey} marked as Verified`);
    }

    await fetchAppointment();
  };

  const handleTestResultUpload = async (orderId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("appointmentId", appointment.applicationId);
    formData.append("testId", orderId); // Pass the order ID (which contains the testId)

    try {
      const res = await axios.post(
        `${baseUrl}/api/applications/tests/upload-result`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`
        }
      );

      fetchTestOrders(); // Refresh the orders list
      toast.success("Test result uploaded successfully");
    } catch (err) {
      console.error("Failed to upload result file:", err);
      toast.error("Failed to upload result file");
    }
  };

  if (loading)
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading appointment details...</p>
      </div>
    );

  if (error)
    return (
      <div className="error-container">
        <div className="error-icon">⚠️</div>
        <p>{error}</p>
        <button
          className="retry-button"
          onClick={() => window.location.reload()}
        >
          Try Again
        </button>
      </div>
    );

  if (!appointment)
    return (
      <div className="empty-state">
        <h3>No appointment found</h3>
        <p>We couldn't find any appointment with the provided ID.</p>
      </div>
    );

  const {
    date,
    startTime,
    endTime,
    serviceType,
    appointmentMode,
    meetingLink,
    comments = [],
    prescription,
    conclusion,
    appointmentStatus,
    doctor,
    location,
  } = appointment;

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "var(--success)";
      case "cancelled":
        return "var(--error)";
      case "upcoming":
        return "var(--warning)";
      default:
        return "var(--info)";
    }
  };

  const isDoctor = currentUser?.role === "doctor";

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
    pdf.save(`Appointment_${appointmentId}.pdf`);

    element.style.display = "none";
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUploadConfirm = async () => {
    if (!selectedFile) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch(
        `http://localhost:5001/api/applications/appointments/${appointment._id}/upload-document`,
        {
          method: "POST",
          body: formData,
          headers: {
            "x-auth-token": localStorage.getItem("token"),
          },
        }
      );

      if (!response.ok) throw new Error("Upload failed");

      // Refresh the documents list without full page reload
      const updatedAppointment = await getAppointmentById(appointmentId);
      setAppointment(updatedAppointment);
      if (
        updatedAppointment.documents &&
        updatedAppointment.documents.length > 0
      ) {
        await fetchDocumentPreviews(updatedAppointment.documents);
      }
    } catch (err) {
      console.error("Error uploading document:", err);
      setError("Failed to upload document.");
    } finally {
      setSelectedFile(null);
      setUploading(false);
    }
  };

  const handleUploadCancel = () => {
    setSelectedFile(null);
  };


    const handleResultView = async (order, e) => {
    e.stopPropagation();
    setLoadingDocuments((prev) => ({ ...prev, [`view-${order.id}`]: true }));
    try {
      await viewResultDocument(order.resultFileId);
    } catch (error) {
      alert(
        `Failed to view document: ${
          error.response?.data?.message || error.message
        } [${error.response?.data?.code || "UNKNOWN"}]`
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
        order.filename || order.name || "document"
      );
    } catch (error) {
      alert(
        `Failed to download document: ${
          error.response?.data?.message || error.message
        } [${error.response?.data?.code || "UNKNOWN"}]`
      );
    } finally {
      setLoadingDocuments((prev) => ({
        ...prev,
        [`download-${order.id}`]: false,
      }));
    }
  };

  // Render tests from orders
  const renderTests = () => {
    if (!orders || orders.length === 0) {
      return <p className="no-content">{t("patients.noTestOrdersYet")}</p>;
    }

    return orders.map((order, index) => {
      const status = order.status || "Ordered";
      const statusClass = `test-status ${status
        .toLowerCase()
        .replace(/\s+/g, "-")}`;

      return (
        <div key={order._id || index} className="test-row">
          <div className="test-info">
            <span className="test-name">{order.testName}</span>
          </div>
          <span>
            {order.resultFileId && (
              <p>
                Uploaded At: 
                {order.uploadedAt
                  ? `${formatDateISO(order.uploadedAt)} ${formatTimeHHMM(order.uploadedAt)}`
                  : "No upload time"}
              </p>
            )}
          </span>

          <div>
            <span className={statusClass}>{status}</span>
          </div>

          {order.resultFileId &&
          status !== "Reupload Requested" &&
          status !== "Waiting for Approval" ? (
                        <div className="document-actions">
              <button
                onClick={(e) => handleResultView(order, e)}
                disabled={loadingDocuments[`view-${order.resultFileId}`]}
                className="view-button"
              >
                {loadingDocuments[`view-${order.resultFileId}`] ? (
                  <span>Loading...</span>
                ) : (
                  <>
                    <FiEye size={14} /> {t("appointment.view")}
                  </>
                )}
              </button>

              <button
                onClick={(e) => handleResultDownload(order, e)}
                disabled={loadingDocuments[`download-${order.resultFileId}`]}
                className="download-button"
              >
                {loadingDocuments[`download-${order.resultFileId}`] ? (
                  <span>Loading...</span>
                ) : (
                  <>
                    <FiDownload size={14} /> {t("appointment.download")}
                  </>
                )}
              </button>
            </div>
          ) : (
            // Only show upload button if status is NOT "Ordered" AND NOT "Waiting for Assign"
            status !== "Ordered" &&
            status !== "Waiting for Assign" &&
            status !== "Reupload Requested" &&
            status !== "Waiting for Approval" && (
              <div className="upload-controls">
                <label className="test-upload-button">
                  <FiUpload size={14} />
                  <input
                    type="file"
                    className="file-input"
                    onChange={(e) =>
                      handleTestResultUpload(order.testId, e.target.files[0])
                    }
                  />
                  Upload Result
                </label>
              </div>
            )
          )}
        </div>
      );
    });
  };

  const handleSaveFollowUp = async () => {
    if (!followUpNeeded) {
      toast.info("No follow-up required");
      return;
    }

    try {
      await saveFollowUp(appointment.applicationId, {
        needed: true,
        comment: followUpComment,
        booked: false, // default false until booked
      });

      toast.success("Follow-up appointment noted!");
      setFollowUpComment("");
      setFollowUpNeeded(false);
      fetchAppointment();
    } catch (err) {
      console.error("Error saving follow-up:", err);
      toast.error("Failed to save follow-up");
    }
  };

  const handleView = async (doc, e) => {
  e.stopPropagation();
  setLoadingDocuments(prev => ({ ...prev, [`view-${doc.id}`]: true }));
  try {
    await viewDocument(doc.id);
  } catch (error) {
    alert(`Failed to view document: ${error.response?.data?.message || error.message} [${error.response?.data?.code || 'UNKNOWN'}]`);
  } finally {
    setLoadingDocuments(prev => ({ ...prev, [`view-${doc.id}`]: false }));
  }
};

const handleDownload = async (doc, e) => {
  e.stopPropagation();
  setLoadingDocuments(prev => ({ ...prev, [`download-${doc.id}`]: true }));
  try {
    await downloadDocument(doc.id, doc.filename || doc.name || 'document');
  } catch (error) {
    alert(`Failed to download document: ${error.response?.data?.message || error.message} [${error.response?.data?.code || 'UNKNOWN'}]`);
  } finally {
    setLoadingDocuments(prev => ({ ...prev, [`download-${doc.id}`]: false }));
  }
};

  return (
    <div className="appointment-page">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Main Appointment Card */}
      <div className="appointment-card">
        <div className="appointment-card-header">
          <h2>{t("appointment.title")}</h2>
          {appointmentStatus && (
            <span
              className="status-badge"
              style={{ backgroundColor: getStatusColor(appointmentStatus) }}
            >
              <FiCheckCircle /> {appointmentStatus}
            </span>
          )}
        </div>

        <div className="details-grid">
          <div className="detail-item">
            <div className="detail-icon">
              <FiCalendar />
            </div>
            <div>
              <p className="detail-label">{t("appointment.date")}</p>
              <p className="detail-value">{formatDateISO(date) || "Not specified"}</p>
            </div>
          </div>

          <div className="detail-item">
            <div className="detail-icon">
              <FiClock />
            </div>
            <div>
              <p className="detail-label">{t("appointment.time")}</p>
              <p className="detail-value">
                {formatTimeHHMM(startTime)} – {formatTimeHHMM(endTime)}
              </p>
            </div>
          </div>

          <div className="detail-item">
            <div className="detail-icon">
              <FiActivity />
            </div>
            <div>
              <p className="detail-label">{t("appointment.service")}</p>
              <p className="detail-value">{serviceType || "Not specified"}</p>
            </div>
          </div>

          <div className="detail-item">
            <div className="detail-icon">
              {appointmentMode?.toLowerCase() === "online" ? (
                <FiVideo />
              ) : (
                <FiActivity />
              )}
            </div>
            <div>
              <p className="detail-label">{t("appointment.mode")}</p>
              <p className="detail-value">
                {appointmentMode || "Not specified"}
                {meetingLink && appointmentMode?.toLowerCase() === "online" && (
                  <a
                    href={meetingLink}
                    target="_blank"
                    rel="noreferrer"
                    className="meeting-link"
                  >
                    {t("appointment.joinMeeting")}
                  </a>
                )}
              </p>
            </div>
          </div>

          {doctor && (
            <div className="detail-item">
              <div className="detail-icon">
                <FiUser />
              </div>
              <div>
                <p className="detail-label">{t("appointment.doctor")}</p>
                <p className="detail-value">{doctor.name || "Not specified"}</p>
              </div>
            </div>
          )}

          {location && (
            <div className="detail-item">
              <div className="detail-icon">
                <FiMapPin />
              </div>
              <div>
                <p className="detail-label">{t("appointment.location")}</p>
                <p className="detail-value">{location || "Not specified"}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Documents Section */}
      <div className="info-card documents-section">
        <div className="card-header">
          <h3>{t("appointment.documents")}</h3>
          <div className="upload-controls">
            <label className="upload-button">
              <input
                type="file"
                onChange={handleFileSelect}
                className="file-input"
                disabled={uploading}
              />
              {uploading
                ? t("appointment.uploading")
                : t("appointment.uploadDocument")}
            </label>
          </div>
        </div>

        {selectedFile && (
          <div className="upload-preview">
            <div className="file-info">
              <span className="file-name">{selectedFile.name}</span>
              <span className="file-size">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </span>
            </div>
            <div className="upload-actions">
              <button
                onClick={handleUploadCancel}
                className="cancel-button"
                disabled={uploading}
              >
                {t("appointment.cancel")}
              </button>
              <button
                onClick={handleUploadConfirm}
                className="confirm-button"
                disabled={uploading}
              >
                {uploading
                  ? t("appointment.uploading")
                  : t("appointment.uploadDocument")}
              </button>
            </div>
          </div>
        )}

        <div className="documents-list">
          {documentPreviews.length > 0 ? (
            documentPreviews.map((doc) => (
              <div key={doc.id} className="document-item">
                <div className="document-icon">
                  {doc.type === "pdf" ? (
                    <span className="pdf-icon">PDF</span>
                  ) : ["jpg", "jpeg", "png", "gif", "webp"].includes(
                      doc.type
                    ) ? (
                    <span className="image-icon">IMG</span>
                  ) : (
                    <span className="file-icon">FILE</span>
                  )}
                </div>

                <div className="document-details">
                  <div className="document-name-row">
                    <span className="document-name">{doc.name}</span>
                     <span>{t("appointment.uploadedAt")}
                      {doc.uploadedAt
                        ? `${formatDateISO(doc.uploadedAt)} ${formatTimeHHMM(doc.uploadedAt)}`
                        : "No upload time"}
                    </span>

                    {doc.verificationStatus === "Under Review" ? (
                      <button
                        className="document-status under-review interactive"
                        onClick={() =>
                          handleVerificationAction(
                            "document",
                            appointment._id,
                            doc.id
                          )
                        }
                      >
                        <FiClock className="status-icon" />
                        Under Review
                      </button>
                    ) : (
                      <span
                        className={`document-status ${doc.verificationStatus
                          .toLowerCase()
                          .replace(" ", "-")}`}
                      >
                        {doc.verificationStatus === "Verified" && (
                          <>
                            <FiCheckCircle className="status-icon" /> Verified
                          </>
                        )}
                        {doc.verificationStatus === "Disapproved" && (
                          <>
                            <FiXCircle className="status-icon" /> Disapproved
                          </>
                        )}
                      </span>
                    )}
                  </div>

                 <div className="document-actions">
      <button
        className="view-button"
        onClick={(e) => handleView(doc, e)}
        disabled={loadingDocuments[`view-${doc.id}`]}
      >
        {loadingDocuments[`view-${doc.id}`] 
          ? t('appointment.loading') 
          : t('appointment.view')
        }
      </button>
      <button
        className="download-button"
        onClick={(e) => handleDownload(doc, e)}
        disabled={loadingDocuments[`download-${doc.id}`]}
      >
        {loadingDocuments[`download-${doc.id}`] 
          ? t('appointment.loading') 
          : t('appointment.download')
        }
      </button>
    </div>
                </div>
              </div>
            ))
          ) : (
            <div className="no-documents">
              <p>{t("appointment.noDocuments")}</p>
            </div>
          )}
        </div>
      </div>

      {/* Tests Section */}
      <div className="info-card">
        <div className="card-header">
          <div className="header-content">
            <GrDocumentTest className="header-icon" />
            <h3>Tests & Results</h3>
          </div>
          <button
            className="icon-button primary"
            onClick={() => setShowTestModal(true)}
          >
            <FiPlus size={18} /> Add Test
          </button>
        </div>
        <div className="card-content">{renderTests()}</div>
      </div>

      {/* Modal */}
      <Modal
        isOpen={showTestModal}
        onRequestClose={() => {
          setShowTestModal(false);
          setSelectedTests([]);
        }}
        contentLabel="Add Tests Modal"
        className="modal"
        overlayClassName="modal-overlay"
      >
        <div className="modal-header">
          <h3>Select Tests to Add</h3>
          <button className="select-all-button" onClick={handleSelectAllTests}>
            {selectedTests.length === availableTests.length ? (
              <>
                <FiCheckSquare /> Deselect All
              </>
            ) : (
              <>
                <FiSquare /> Select All
              </>
            )}
          </button>
        </div>

         <div className="tests-list">
          {availableTests.map((test) => {
            const isSelected = selectedTests.some((t) => t.testId === test._id);
        
            
        
            const isAlreadyAdded = orders.some((t) => {
             
              return (
                String(t.testId) === String(test._id) ||
                String(t.testName).toLowerCase() === String(test.name).toLowerCase()
              );
            });
        
        
            return (
              <div
                key={test._id}
                className={`test-item ${isSelected ? "selected" : ""} ${
                  isAlreadyAdded ? "disabled" : ""
                }`}
                onClick={() => {
                  if (!isAlreadyAdded) {
                    handleTestSelection(test._id, test.name);
                  }
                }}
                style={{
                  cursor: isAlreadyAdded ? "not-allowed" : "pointer",
                  opacity: isAlreadyAdded ? 0.6 : 1,
                  backgroundColor: isAlreadyAdded ? "#f8d7da" : "transparent",
                }}
              >
                <div className="test-checkbox">
                  {isAlreadyAdded ? (
                    <FiCheckSquare className="already-added-icon" />
                  ) : isSelected ? (
                    <FiCheckSquare />
                  ) : (
                    <FiSquare />
                  )}
                </div>
                <div className="test-info">
                  <span className="test-name">{test.name}</span>
                  {test.specialtyName && (
                    <span className="test-specialty">{test.specialtyName}</span>
                  )}
        
                  {isAlreadyAdded && (
                    <span
                      className="test-note"
                      style={{ fontStyle: "italic", fontSize: "0.85em", color: "red" }}
                    >
                      Already Assigned
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="selected-count">
          {selectedTests.length} test(s) selected
        </div>

        <div className="modal-actions">
          <button
            onClick={handleAddTests}
            className="text-button primary"
            disabled={selectedTests.length === 0}
          >
            <FiSave /> Add Selected Tests
          </button>
          <button
            onClick={() => {
              setShowTestModal(false);
              setSelectedTests([]);
            }}
            className="text-button secondary"
          >
            <FiX /> Cancel
          </button>
        </div>
      </Modal>

      {/* Prescription Section */}
      <div className="info-card">
        <div className="card-header">
          <div className="header-content">
            <FiFileText className="header-icon" />
            <h3>{t("appointment.prescription")}</h3>
          </div>
          <button
            className="icon-button primary"
            onClick={() => {
              handleEditToggle("prescription");
              setEditValues((prev) => ({
                ...prev,
                prescription: appointment.prescription?.text || "",
              }));
            }}
          >
            {editing.prescription ? <FiX size={18} /> : <FiEdit2 size={18} />}
          </button>
        </div>

        <div className="card-content">
          {editing.prescription ? (
            <div className="edit-container">
              <textarea
                value={editValues.prescription}
                onChange={(e) =>
                  handleEditChange("prescription", e.target.value)
                }
                placeholder={t("appointment.prescriptionDetails")}
                rows={5}
                className="edit-textarea"
                autoFocus
              />
              <div className="edit-actions">
                <button
                  className="text-button primary"
                  onClick={handleSavePrescription}
                  disabled={!editValues.prescription.trim()}
                >
                  <FiSave className="button-icon" /> {t("appointment.save")}
                </button>
                <button
                  className="text-button secondary"
                  onClick={() => handleEditToggle("prescription")}
                >
                  <FiX className="button-icon" /> {t("appointment.cancel")}
                </button>
              </div>
            </div>
          ) : prescription?.text ? (
            <div className="prescription-content">
              {prescription.verificationStatus && (
                <div className="badge-container">
                  <span
                    className={`verification-badge ${prescription.verificationStatus
                      .toLowerCase()
                      .replace(" ", "-")}`}
                    onClick={() =>
                      handleVerificationAction(
                        "prescription",
                        appointment._id,
                        "prescription"
                      )
                    }
                    style={{ cursor: "pointer" }}
                    title="Click to verify"
                  >
                    {prescription.verificationStatus === "Verified" && (
                      <>
                        <FiCheckCircle className="status-icon verified" />{" "}
                        Verified
                      </>
                    )}
                    {prescription.verificationStatus === "Under Review" && (
                      <>
                        <FiClock className="status-icon review" /> Under Review
                      </>
                    )}
                    {prescription.verificationStatus === "Disapproved" && (
                      <>
                        <FiXCircle className="status-icon disapproved" />{" "}
                        Disapproved
                      </>
                    )}
                  </span>
                </div>
              )}
              {prescription.text.split("\n").map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          ) : (
            <p className="no-content">{t("appointment.noPrescription")}</p>
          )}
        </div>
      </div>

      {/* Conclusion Section */}
      <div className="info-card">
        <div className="card-header">
          <div className="header-content">
            <FiCheckCircle className="header-icon" />
            <h3>{t("appointment.conclusion")}</h3>
          </div>
          <button
            className="icon-button primary"
            onClick={() => {
              handleEditToggle("conclusion");
              setEditValues((prev) => ({
                ...prev,
                conclusion: appointment.conclusion?.text || "",
              }));
            }}
          >
            {editing.conclusion ? <FiX size={18} /> : <FiEdit2 size={18} />}
          </button>
        </div>

        <div className="card-content">
          {editing.conclusion ? (
            <div className="edit-container">
              <textarea
                value={editValues.conclusion}
                onChange={(e) => handleEditChange("conclusion", e.target.value)}
                placeholder={t("appointment.doctorConclusion")}
                rows={5}
                className="edit-textarea"
                autoFocus
              />
              <div className="edit-actions">
                <button
                  className="text-button primary"
                  onClick={handleSaveConclusion}
                  disabled={!editValues.conclusion.trim()}
                >
                  <FiSave className="button-icon" /> {t("appointment.save")}
                </button>
                <button
                  className="text-button secondary"
                  onClick={() => handleEditToggle("conclusion")}
                >
                  <FiX className="button-icon" /> {t("appointment.cancel")}
                </button>
              </div>
            </div>
          ) : conclusion?.text ? (
            <div className="conclusion-content">
              {conclusion.verificationStatus && (
                <div className="badge-container">
                  <span
                    className={`verification-badge ${conclusion.verificationStatus
                      .toLowerCase()
                      .replace(" ", "-")}`}
                    onClick={() =>
                      handleVerificationAction(
                        "conclusion",
                        appointment._id,
                        "conclusion"
                      )
                    }
                    style={{ cursor: "pointer" }}
                    title="Click to verify"
                  >
                    {conclusion.verificationStatus === "Verified" && (
                      <>
                        <FiCheckCircle className="status-icon verified" />{" "}
                        Verified
                      </>
                    )}
                    {conclusion.verificationStatus === "Under Review" && (
                      <>
                        <FiClock className="status-icon review" /> Under Review
                      </>
                    )}
                    {conclusion.verificationStatus === "Disapproved" && (
                      <>
                        <FiXCircle className="status-icon disapproved" />{" "}
                        Disapproved
                      </>
                    )}
                  </span>
                </div>
              )}
              {conclusion.text.split("\n").map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          ) : (
            <p className="no-content">{t("appointment.noConclusion")}</p>
          )}
        </div>
      </div>

      {!editing.conclusion && (
        <div className="download-button-container">
          <button
            className="text-button primary"
            onClick={generateAndDownloadPDF}
          >
            {t("appointment.downloadPDF")}
          </button>
        </div>
      )}

      <AppointmentPDFTemplate appointment={appointment} patient={patient} />

      {/* Comments Card */}
      <div className="info-card">
        <div className="comments-panel">
          <div className="panel-header">
            <div className="header-content">
              <FiMessageSquare className="header-icon" />
              <h3>
                {t("appointment.comments")} ({comments.length})
              </h3>
            </div>

            <button
              className="icon-button"
              onClick={() =>
                setEditing((prev) => ({ ...prev, comment: !prev.comment }))
              }
              aria-label={
                editing.comment ? "Close comment editor" : "Add new comment"
              }
            >
              {editing.comment ? <FiX size={18} /> : <FiPlus size={18} />}
            </button>
          </div>

          {/* New Comment Editor */}
          {editing.comment && (
            <div className="comment-composer">
              <div className="composer-header">
                <span className="user-badge">
                  <FiUser size={14} /> {doctorEmail.split("@")[0]}
                </span>
              </div>
              <div className="composer-content">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={t("appointment.shareThoughts")}
                  rows={3}
                  className="composer-textarea"
                  autoFocus
                />
                <div className="composer-actions">
                  <button
                    className="text-button secondary"
                    onClick={() => {
                      setEditing((prev) => ({ ...prev, comment: false }));
                      setNewComment("");
                    }}
                  >
                    {t("appointment.cancel")}
                  </button>
                  <button
                    className="text-button primary"
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                  >
                    {t("appointment.postComment")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Comments List */}
          <div className="comments-feed">
            {comments.length > 0 ? (
              comments.map((comment, index) => (
                <div
                  key={comment._id || index}
                  className={`comment ${
                    comment.role === "doctor" ? "doctor-comment" : ""
                  }`}
                >
                  <div className="comment-body">
                    <div className="comment-header">
                      <div className="comment-meta">
                        <span className="comment-author">
                          {comment.doctorEmail}
                          {comment.role === "doctor" && (
                            <span className="role-badge">
                              {t("appointment.doctor")}
                            </span>
                          )}
                        </span>
                        <span className="comment-time">
                          {formatRelativeTime(comment.timestamp)}
                          {comment.edited && (
                            <span className="edited-indicator"> · edited</span>
                          )}
                        </span>
                      </div>

                      {comment.doctorEmail === doctorEmail &&
                        !comment.isEditing && (
                          <div className="comment-actions always-visible">
                            <button
                              className="icon-button subtle"
                              onClick={() => {
                                const updatedComments = [...comments];
                                updatedComments[index] = {
                                  ...updatedComments[index],
                                  isEditing: true,
                                  editText: updatedComments[index].text,
                                };
                                setAppointment({
                                  ...appointment,
                                  comments: updatedComments,
                                });
                              }}
                              aria-label="Edit comment"
                              title="Edit comment"
                            >
                              <FiEdit2 size={20} />
                            </button>
                            <button
                              className="icon-button subtle danger"
                              onClick={() => handleDeleteComment(comment._id)}
                              aria-label="Delete comment"
                              title="Delete comment"
                            >
                              <FiTrash2 size={20} />
                            </button>
                          </div>
                        )}
                    </div>

                    {comment.isEditing ? (
                      <div className="comment-editor">
                        <textarea
                          value={comment.editText}
                          onChange={(e) => {
                            const updatedComments = [...comments];
                            updatedComments[index].editText = e.target.value;
                            setAppointment({
                              ...appointment,
                              comments: updatedComments,
                            });
                          }}
                          className="editor-textarea"
                          autoFocus
                        />
                        <div className="editor-actions">
                          <button
                            className="text-button secondary"
                            onClick={() => {
                              const updatedComments = [...comments];
                              updatedComments[index].isEditing = false;
                              setAppointment({
                                ...appointment,
                                comments: updatedComments,
                              });
                            }}
                          >
                            {t("appointment.cancel")}
                          </button>
                          <button
                            className="text-button primary"
                            onClick={() =>
                              handleEditComment(comment._id, comment.editText)
                            }
                          >
                            {t("appointment.save")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="comment-text">{comment.text}</div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <FiMessageSquare size={24} />
                <p>{t("appointment.noComments")}</p>
                {isDoctor && (
                  <button
                    className="text-button primary"
                    onClick={() =>
                      setEditing((prev) => ({ ...prev, comment: true }))
                    }
                  >
                    Start the conversation
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Follow-up Section */}
      <div className="info-card">
        <div className="card-header">
          <div className="header-content">
            <FiCalendar className="header-icon" />
            <h3>{t("appointment.followUp", "Follow-up Appointment")}</h3>
          </div>
        </div>

        <div className="card-content">
          {/* Only show add option if no follow-up exists */}
          {!appointment?.followUp?.needed && (
            <>
              <label className="followup-checkbox">
                <input
                  type="checkbox"
                  checked={followUpNeeded}
                  onChange={(e) => setFollowUpNeeded(e.target.checked)}
                />
                {t(
                  "appointment.requiresFollowUp",
                  "Requires Follow-up Appointment"
                )}
              </label>

              {followUpNeeded && (
                <div className="followup-comment-box">
                  <textarea
                    value={followUpComment}
                    onChange={(e) => setFollowUpComment(e.target.value)}
                    placeholder={t(
                      "appointment.enterFollowUpComment",
                      "Add comment for follow-up..."
                    )}
                    rows={3}
                    className="followup-textarea"
                  />
                  <div className="followup-actions">
                    <button
                      className="followup-btn primary"
                      onClick={handleSaveFollowUp}
                      disabled={!followUpComment.trim()}
                    >
                      <FiSave />{" "}
                      {t("appointment.saveFollowUp", "Save Follow-up")}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Show summary if already assigned */}
          {appointment?.followUp?.needed && (
            <div className="followup-summary">
              <p>
                <strong>{t("appointment.comment", "Comment:")}</strong>{" "}
                {appointment.followUp.comment}
              </p>
              <p>
                <strong>{t("appointment.booked", "Booked:")}</strong>{" "}
                {appointment.followUp.booked ? "Yes" : "No"}
              </p>

              {appointment.followUp.booked &&
                appointment.followUp.applicationId && (
                  <p>
                    <strong>
                      {t("appointment.followUpId", "Follow-up Appointment ID:")}{" "}
                    </strong>
                    <a
                      href={`/appointments/${encodeURIComponent(
                        appointment.followUp.applicationId
                      )}`}
                      className="followup-link"
                      style={{
                        color: "#0A2E5D",
                        textDecoration: "underline",
                        cursor: "pointer",
                      }}
                    >
                      {appointment.followUp.applicationId}
                    </a>
                  </p>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppointmentTab;
