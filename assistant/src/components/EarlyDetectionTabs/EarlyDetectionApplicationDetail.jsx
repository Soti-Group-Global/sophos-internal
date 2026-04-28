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
  getEmailFromToken,
  getDoctorNameByEmail,
  getDocument,
  getAvailableTests,
  updateTestResult,
  addMultipleTestsToEarlyDetectionAppointment,
  addMultipleTestsToAppointment,
  viewDocument,
  downloadDocument,
    viewResultDocument,
  downloadResultDocument
} from "../../utils/api";
import "../../styles/AppointmentDetails.css";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import AppointmentPDFTemplate from "../../components/AppointmentPDFTemplate";
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
} from "react-icons/fi";
import { GrDocumentTest, GrDocumentStore } from "react-icons/gr";
import Modal from "react-modal";
import { useTranslation } from "react-i18next";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer, toast } from "react-toastify";
import Swal from "sweetalert2";
import axios from "axios";
import moment from "moment-timezone";

const EarlyDetectionApplicationDetail = () => {
  const { id } = useParams();
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const locationState = useLocation();
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
  const [loadingDocuments, setLoadingDocuments] = useState({});


  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'ru' ? 'ru' : 'en';
  const baseUrl = import.meta.env.VITE_BASE_URL;
  const { doctorEmail: doctorEmailFromState } = location.state || {};

  // prefer the passed doctorEmail; fall back to token if missing
  const doctorEmail = doctorEmailFromState || getEmailFromToken();

  const fetchApplication = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getEarlyDetectionApplication(id, doctorEmail);

      setApplication(data.data);
      setOtherAppointments(data.data.otherAppointments);

      // Safely get prescription and conclusion from the first appointment (if any)
      const firstAppt = data.data.appointments?.[0];

      setEditValues({
        prescription: firstAppt?.prescription?.text || "",
        conclusion: firstAppt?.conclusion?.text || "",
      });

      if (data.data.documents?.length > 0) {
        await fetchDocumentPreviews(data.data.documents);
      }
    } catch (err) {
      setError(t("appointment.fetchError"));
      toast.error(t("appointment.fetchError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplication();
  }, [id, doctorEmail]);


  const fetchTestOrders = async () => {
    try {
      // Fetch all orders for this appointment using appointmentId
      const orders = await axios.get(
        `${baseUrl}/api/specialties/orders/${encodeURIComponent(id)}`,{
            headers: {
         Authorization: `Bearer ${localStorage.getItem("accessToken")}`
      }
        }
      );
      setOrders(orders.data);
    } catch (err) {
      console.error("Failed to fetch test orders:", err);
      toast.error("Failed to load test information");
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
      const tests = await getAvailableTests(); // Use the function from api.js
      setAvailableTests(tests);
    } catch (err) {
      console.error("Failed to fetch test options", err);
      toast.error("Failed to load test options");
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
      fetchApplication(); // Refresh the appointment data
      toast.success(`${selectedTests.length} test(s) added successfully`);
    } catch (err) {
      console.error("Failed to add tests", err);
      toast.error("Failed to add tests");
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
        ]; // Use appointment._id from state
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
      await updateEarlyDetectionVerificationStatus(
        type,
        targetId,
        fieldKey,
        "Disapproved",
        doctorEmail
      );
      toast.info(`${fieldKey} marked as Disapproved`);
    } else if (result.isConfirmed) {
      await updateEarlyDetectionVerificationStatus(
        type,
        targetId,
        fieldKey,
        "Verified",
        doctorEmail
      );
      toast.success(`${fieldKey} marked as Verified`);
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
              const nameData = await getDoctorNameByEmail(comment.email);
              names[comment.email] = nameData;
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
  }, [application]);

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
        `${baseUrl}/api/early-detection/${encodeURIComponent(
          id
        )}/upload-document`,
        {
          method: "POST",
          body: formData,
          headers: {
         Authorization: `Bearer ${localStorage.getItem("accessToken")}`
      }
        }
      );

      if (!response.ok) throw new Error("Upload failed");

      const updatedApplication = await getEarlyDetectionApplication(
        id,
        doctorEmail
      ); // pass doctorEmail

      setApplication(updatedApplication.data);

      if (
        updatedApplication.data.documents &&
        updatedApplication.data.documents.length > 0
      ) {
        await fetchDocumentPreviews(updatedApplication.data.documents);
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
        await updateEarlyDetectionAppointmentPrescription(id, payload);
      toast.success(t("Prescription Saved"));
      setApplication(updatedApplication);
      setEditing((prev) => ({ ...prev, prescription: false }));
    } catch (err) {
      console.error("Error updating prescription:", err);
      setError("Failed to update prescription.");
    }
  };

  const handleSaveConclusion = async () => {
    try {
      const payload = {
        text: editValues.conclusion,
        doctorEmail: doctorEmail,
      };

      const updatedApplication =
        await updateEarlyDetectionAppointmentConclusion(id, payload);
      setApplication(updatedApplication);
      toast.success(t("Conclusion Saved"));
      setEditing((prev) => ({ ...prev, conclusion: false }));
    } catch (err) {
      console.error("Error updating conclusion:", err);
      setError("Failed to update conclusion.");
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
        id,
        updatedComments
      );
      setApplication(data);
      setNewComment("");
      setEditing((prev) => ({ ...prev, comment: false }));
    } catch (err) {
      console.error("Error adding comment:", err);
      setError("Failed to add comment.");
    }
  };

  const handleDeleteComment = async (commentId) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
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
      await deleteEarlyDetectionAppointmentComment(id, commentId);

      Swal.fire({
        title: "Deleted!",
        text: "Your comment has been deleted.",
        icon: "success",
      });
    } catch (err) {
      console.error("Error deleting comment:", err);
      setError("Failed to delete comment.");

      Swal.fire({
        title: "Error!",
        text: "Failed to delete comment.",
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
    pdf.save(`Early_Diagnosis_Application_${id}.pdf`);

    element.style.display = "none";
  };

  if (loading)
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>{t("appointment.loading")}</p>
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
          {t("appointment.tryAgain")}
        </button>
      </div>
    );

  if (!application)
    return (
      <div className="empty-state">
        <h3>{t("appointment.noAppointments")}</h3>
        <p>{t("appointment.noAppointment")}</p>
      </div>
    );

  const {
    patientEmail,
    serviceType,
    appointments,
    prescription,
    conclusion,
    comments,
  } = application;

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "#28a745";
      case "cancelled":
        return "#dc3545";
      case "upcoming":
        return "#ffc107";
      case "unconfirmed":
        return "#ffc107";
      case "Unconfirmed":
        return "#ffc107";
      default:
        return "#17a2b8";
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


const handleResultView = async (order, e) => {
  e.stopPropagation();
  setLoadingDocuments(prev => ({ ...prev, [`view-${order.id}`]: true }));
  try {
    await viewResultDocument(order.resultFileId);
  } catch (error) {
    alert(`Failed to view document: ${error.response?.data?.message || error.message} [${error.response?.data?.code || 'UNKNOWN'}]`);
  } finally {
    setLoadingDocuments(prev => ({ ...prev, [`view-${order.id}`]: false }));
  }
};

const handleResultDownload = async (order, e) => {
  e.stopPropagation();
  setLoadingDocuments(prev => ({ ...prev, [`download-${order.id}`]: true }));
  try {
    await downloadResultDocument(order.resultFileId, order.filename || order.name || 'document');
  } catch (error) {
    alert(`Failed to download document: ${error.response?.data?.message || error.message} [${error.response?.data?.code || 'UNKNOWN'}]`);
  } finally {
    setLoadingDocuments(prev => ({ ...prev, [`download-${order.id}`]: false }));
  }
};


  // Render tests from orders
  const renderTests = () => {
    if (!orders || orders.length === 0) {
      return <p className="no-content">{t("appointment.noTests")}</p>;
    }

    return orders.map((order, index) => {
      const status = order.status || "Ordered";
      const statusClass = `test-status ${status
        .toLowerCase()
        .replace(/&/g, "")
        .replace(/\s+/g, "-")}`;

      return (
        <div key={order._id || index} className="test-row">
          <div className="test-info">
            <span className="test-name">{order.testName}</span>
          </div>

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
                  {t("appointment.uploadResult")}
                </label>
              </div>
            )
          )}
        </div>
      );
    });
  };

  return (
    <div className="appointment-details-container">
      <ToastContainer position="top-right" autoClose={3000} />

      {/*
      <button className="back-button" onClick={() => navigate(-1)}>
        <FiArrowLeft /> {t("appointment.backToAppointments")}
      </button>

      <div className="appointment-header">
        <h2>#{id}</h2>
        {application?.appointments?.length > 0 && (
          <span
            className="status-badge"
            style={{
              backgroundColor: getStatusColor(
                application.appointments[0].appointmentStatus
              ),
            }}
          >
            <FiCheckCircle /> {application.appointments[0].appointmentStatus}
          </span>
        )}
      </div>
      */}

      {/* Main Application Info */}
      <div className="details-grid">
        <div className="detail-item">
          <FiUser className="appointment-detail-icon" />
          <div>
            <p className="detail-label">{t("appointment.patient")}</p>
            <p className="detail-value">
              {application?.patientName || "Not specified"}
            </p>
          </div>
        </div>

        <div className="detail-item">
          <FiCalendar className="appointment-detail-icon" />
          <div>
            <p className="detail-label">{t("appointment.date")}</p>
            <p className="detail-value">
              {new Date(
                application.appointments[0].date
              ).toLocaleDateString() || "Not specified"}
            </p>
          </div>
        </div>

        <div className="detail-item">
          <FiClock className="appointment-detail-icon" />
          <div>
            <p className="detail-label">{t("appointment.time")}</p>
            <p className="detail-value">
              {new Date(
                application.appointments[0].startTime
              ).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              -{" "}
              {new Date(application.appointments[0].endTime).toLocaleTimeString(
                [],
                {
                  hour: "2-digit",
                  minute: "2-digit",
                }
              )}
            </p>
          </div>
        </div>

        <div className="detail-item">
          <FiActivity className="appointment-detail-icon" />
          <div>
            <p className="detail-label">{t("appointment.service")}</p>
            <p className="detail-value">{serviceType || "Not specified"}</p>
          </div>
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
                        ? moment(doc.uploadedAt)
                            .tz("Europe/Moscow")
                            .format("DD.MM.YYYY HH:mm")
                        : "No upload time"}
                    </span>

                    {doc.verificationStatus === "Under Review" ? (
                      <button
                        className="document-status under-review interactive"
                        onClick={() =>
                          handleVerificationAction(
                            "document",
                            application.applicationId,
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
            <h3>{t("appointment.testResults")}</h3>
          </div>
          <button
            className="icon-button primary"
            onClick={() => setShowTestModal(true)}
          >
            <FiPlus size={18} /> {t("appointment.addTest")}
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
          <h3>{t("appointment.selectTests")}</h3>
          <button className="select-all-button" onClick={handleSelectAllTests}>
            {selectedTests.length === availableTests.length ? (
              <>
                <FiCheckSquare /> {t("appointment.deSelectAll")}
              </>
            ) : (
              <>
                <FiSquare /> {t("appointment.selectAll")}
              </>
            )}
          </button>
        </div>

        <div className="tests-list">
          {availableTests.map((test) => {
            const isSelected = selectedTests.some((t) => t.testId === test._id);
            const isAlreadyAdded = application.orders?.some(
              (t) => String(t.testId) === String(test._id)
            ); // Match existing tests

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
                    <span className="test-note">({t("appointment.alreadySelected")})</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="selected-count">
          {selectedTests.length} {t("appointment.testSelected")}
        </div>

        <div className="modal-actions">
          <button
            onClick={handleAddTests}
            className="text-button primary"
            disabled={selectedTests.length === 0}
          >
            <FiSave /> {t("appointment.addSelectedTests")}
          </button>
          <button
            onClick={() => {
              setShowTestModal(false);
              setSelectedTests([]);
            }}
            className="text-button secondary"
          >
            <FiX /> {t("appointment.cancel")}
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
                prescription:
                  application.appointments?.[0]?.prescription?.text || "",
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
          ) : application.appointments?.[0]?.prescription?.text ? (
            <div className="prescription-content">
              {application.appointments?.[0]?.prescription
                ?.verificationStatus && (
                <div className="badge-container">
                  <span
                    className={`verification-badge ${application.appointments[0].prescription.verificationStatus
                      .toLowerCase()
                      .replace(" ", "-")}`}
                    onClick={() =>
                      handleVerificationAction(
                        "prescription",
                        application.applicationId,
                        "prescription"
                      )
                    }
                    style={{ cursor: "pointer" }}
                    title="Click to verify"
                  >
                    {application.appointments[0].prescription
                      .verificationStatus === "Verified" && (
                      <>
                        <FiCheckCircle className="status-icon verified" />{" "}
                        Verified
                      </>
                    )}
                    {application.appointments[0].prescription
                      .verificationStatus === "Under Review" && (
                      <>
                        <FiClock className="status-icon review" /> Under Review
                      </>
                    )}
                    {application.appointments[0].prescription
                      .verificationStatus === "Disapproved" && (
                      <>
                        <FiXCircle className="status-icon disapproved" />{" "}
                        Disapproved
                      </>
                    )}
                  </span>
                </div>
              )}
              {application.appointments[0].prescription.text
                .split("\n")
                .map((paragraph, i) => (
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
                conclusion:
                  application.appointments?.[0]?.conclusion?.text || "",
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
          ) : (
            (() => {
              const conclusion = application.appointments?.[0]?.conclusion;
              if (conclusion?.text) {
                return (
                  <div className="conclusion-content">
                    {conclusion.verificationStatus && (
                      <div className="badge-container">
                        <span
                          className={`verification-badge ${conclusion.verificationStatus
                            .toLowerCase()
                            .replace(" ", "-")}`}
                          onClick={() => {
                            if (
                              conclusion.verificationStatus === "Under Review"
                            ) {
                              handleVerificationAction(
                                "conclusion",
                                application.applicationId,
                                "conclusion"
                              );
                            }
                          }}
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
                              <FiClock className="status-icon review" /> Under
                              Review
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
                );
              } else {
                return (
                  <p className="no-content">{t("appointment.noConclusion")}</p>
                );
              }
            })()
          )}
        </div>
      </div>

      {/* PDF Download Button */}
      <div className="download-button-container">
        <button
          className="text-button primary"
          onClick={generateAndDownloadPDF}
        >
          {t("appointment.downloadPDF")}
        </button>
      </div>

      {/* Hidden PDF Template 
      <AppointmentPDFTemplate
        appointment={application}
        patient={{ email: patientEmail }}
      />
      */}

      {/* Comments Section */}
      <div className="info-card">
        <div className="comments-panel">
          <div className="panel-header">
            <div className="header-content">
              <FiMessageSquare className="header-icon" />
              <h3>
                {" "}
                {t("appointment.comments")} ({comments?.length || 0})
              </h3>
            </div>
            <button
              className="icon-button primary"
              onClick={() =>
                setEditing((prev) => ({ ...prev, comment: !prev.comment }))
              }
            >
              {editing.comment ? <FiX size={18} /> : <FiPlus size={18} />}
            </button>
          </div>

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
                  placeholder={t("appointment.yourThoughts")}
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

          <div className="comments-feed">
            {comments && comments.length > 0 ? (
              comments.map((comment, index) => (
                <div key={comment._id || index} className="comment">
                  <div className="comment-body">
                    <div className="comment-header">
                      <div className="comment-meta">
                        <span className="comment-author">
                          {comment.role === "doctor"
                            ? (doctorNames[comment.email]?.fullName?.[lang] ||
                              doctorNames[comment.email]?.fullName?.en ||
                              `${doctorNames[comment.email]?.firstName?.[lang] || doctorNames[comment.email]?.firstName?.en || ''} ${
                                doctorNames[comment.email]?.lastName?.[lang] || doctorNames[comment.email]?.lastName?.en || ''
                              }`.trim() ||
                              comment.email.split('@')[0])
                            : t(`role.${comment.role}`)}
                        </span>
                        <span className="comment-role">({comment.role})</span>
                        <span className="comment-time">
                          {formatRelativeTime(comment.createdAt)}
                          {comment.edited && " · edited"}
                        </span>
                      </div>
                      {comment.email === doctorEmail &&
                        comment.role === "doctor" && (
                          <div className="">
                            <button
                              className="dlt-btn"
                              onClick={() => handleDeleteComment(comment._id)}
                            >
                              <FiTrash2 size={20} />
                            </button>
                          </div>
                        )}
                    </div>
                    <div className="comment-text">{comment.text}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <FiMessageSquare size={24} />
                <p>{t("appointment.noComments")}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Other Appointments Section */}

      {otherAppointments && otherAppointments.length > 0 && (
        <div className="info-card">
          <div className="card-header">
            <h3>{t("appointment.otherAppointments")}</h3>
          </div>
          <div className="card-content">
            {otherAppointments.map((appt, index) => (
              <div
                key={index}
                className="appointment-entry"
                style={{
                  display: "flex",
                  flexDirection: "row",
                  justifyContent: "center",
                  alignItems: "flex-start",
                  cursor: "pointer",
                }}
                onClick={() =>
                  navigate(`/early-detection/${encodeURIComponent(id)}`, {
                    state: {
                      doctorEmail: appt.doctorEmail,
                    },
                  })
                }
              >
                <div
                  className="appointment-details"
                  style={{ display: "flex", flexDirection: "column" }}
                >
                  <p>
                    <strong>Email:</strong> {appt.doctorEmail}
                  </p>
                  <p>
                    <strong>{t("appointment.date")}:</strong>{" "}
                    {new Date(appt.date).toLocaleDateString()}
                  </p>
                  <p>
                    <strong>{t("appointment.time")}:</strong>{" "}
                    {new Date(appt.startTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    -{" "}
                    {new Date(appt.endTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {appt.location && (
                    <p>
                      <strong>{t("appointment.location")}:</strong> {appt.location}
                    </p>
                  )}
                </div>
                {appt.appointmentStatus && (
                  <span
                    className="status-badge"
                    style={{
                      backgroundColor: getStatusColor(appt.appointmentStatus),
                    }}
                  >
                    <FiCheckCircle /> {appt.appointmentStatus}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EarlyDetectionApplicationDetail;
