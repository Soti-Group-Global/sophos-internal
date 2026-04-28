import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
  getApplication,
  addComment,
  updateComment,
  deleteDocument,
  getMedia,
  updateApplication,
  addDocument,
} from "../../utils/api";
import { getApptStatusColor } from "../../utils/appointmentStatus";
import {
  FiCalendar,
  FiClock,
  FiActivity,
  FiVideo,
  FiMessageSquare,
  FiFileText,
  FiCheckCircle,
  FiUser,
  FiEdit2,
  FiPlus,
  FiX,
  FiSave,
  FiTrash2,
} from "react-icons/fi";
import "./ApplicationDetails.css";

const ApplicationDetails = () => {
  const { t, i18n } = useTranslation("application_details");
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
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
  const doctorEmail = localStorage.getItem("email");

  useEffect(() => {
    const fetchApplication = async () => {
      if (!appointmentId) {
        setError(t("no_id"));
        setLoading(false);
        return;
      }

      try {
        const response = await getApplication(appointmentId);
        const data = response.data;
        setApplication(data);
        setEditValues({
          prescription: data.prescription?.text || "",
          conclusion: data.conclusion?.text || "",
        });

        if (data.documents && data.documents.length > 0) {
          await fetchDocumentPreviews(data.documents);
        }
      } catch (err) {
        toast.error(
          err.response?.data?.message || t("error_fetch")
        );
        setError(t("error_fetch"));
        if (err.response?.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("email");
          navigate("/");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchApplication();
  }, [appointmentId, navigate, t]);

  const fetchDocumentPreviews = async (documents) => {
    try {
      const previews = await Promise.all(
        documents.map(async (doc) => {
          const fileId = doc.fileId?._id || doc.fileId;
          if (fileId) {
            const response = await getMedia(fileId);
            const url = URL.createObjectURL(response.data);
            return {
              id: fileId,
              url,
              name: doc.filename || t("unnamed_document"),
              type:
                doc.fileId?.contentType?.split("/").pop().toLowerCase() ||
                doc.filename?.split(".").pop().toLowerCase() ||
                "file",
            };
          }
          return {
            id: doc._id || doc.filename,
            url: doc.url || "",
            name: doc.filename || t("unnamed_document"),
            type: doc.filename?.split(".").pop().toLowerCase() || "file",
          };
        })
      );
      setDocumentPreviews(previews);
    } catch (err) {
      toast.error(
        err.response?.data?.message || t("document_preview_failed")
      );
      setError(t("document_preview_failed"));
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
      const response = await updateApplication(appointmentId, {
        prescription: editValues.prescription || "",
      });
      setApplication(response.data);
      setEditing((prev) => ({ ...prev, prescription: false }));
      toast.success(t("prescription_updated"));
    } catch (err) {
      toast.error(
        err.response?.data?.message || t("prescription_update_failed")
      );
      setError(t("prescription_update_failed"));
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("email");
        navigate("/");
      }
    }
  };

  const handleSaveConclusion = async () => {
    try {
      const response = await updateApplication(appointmentId, {
        conclusion: editValues.conclusion || "",
      });
      setApplication(response.data);
      setEditing((prev) => ({ ...prev, conclusion: false }));
      toast.success(t("conclusion_updated"));
    } catch (err) {
      toast.error(
        err.response?.data?.message || t("conclusion_update_failed")
      );
      setError(t("conclusion_update_failed"));
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("email");
        navigate("/");
      }
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      toast.error(t("comment_required"));
      return;
    }

    try {
      const comment = {
        text: newComment,
        email: doctorEmail,
        role: "doctor",
      };
      const response = await addComment(appointmentId, comment);
      setApplication(response.data);
      setNewComment("");
      setEditing((prev) => ({ ...prev, comment: false }));
      toast.success(t("comment_added"));
    } catch (err) {
      toast.error(
        err.response?.data?.message || t("comment_add_failed")
      );
      setError(t("comment_add_failed"));
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("email");
        navigate("/");
      }
    }
  };

  const handleEditComment = async (commentId, newText) => {
    if (!newText.trim()) {
      toast.error(t("comment_required"));
      return;
    }

    try {
      const updatedComment = {
        text: newText,
        email: doctorEmail,
        role: "doctor",
        edited: true,
      };
      const response = await updateComment(commentId, updatedComment);
      setApplication(response.data);
      toast.success(t("comment_updated"));
    } catch (err) {
      toast.error(
        err.response?.data?.message || t("comment_update_failed")
      );
      setError(t("comment_update_failed"));
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("email");
        navigate("/");
      }
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm(t("confirm_delete_comment")))
      return;

    try {
      const updatedComments = application.comments.filter(
        (comment) => comment._id !== commentId
      );
      const response = await updateApplication(appointmentId, {
        comments: updatedComments,
      });
      setApplication(response.data);
      toast.success(t("comment_deleted"));
    } catch (err) {
      toast.error(
        err.response?.data?.message || t("comment_delete_failed")
      );
      setError(t("comment_delete_failed"));
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("email");
        navigate("/");
      }
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUploadConfirm = async () => {
    if (!selectedFile) {
      toast.error(t("document_file_required"));
      return;
    }

    setUploading(true);
    try {
      const response = await addDocument(appointmentId, { file: selectedFile });
      setApplication(response.data);
      if (response.data.documents && response.data.documents.length > 0) {
        await fetchDocumentPreviews(response.data.documents);
      }
      toast.success(t("document_added"));
    } catch (err) {
      toast.error(
        err.response?.data?.message || t("document_add_failed")
      );
      setError(t("document_add_failed"));
    } finally {
      setSelectedFile(null);
      setUploading(false);
    }
  };

  const handleUploadCancel = () => {
    setSelectedFile(null);
  };

  const handleDeleteDocument = async (docId) => {
    if (!window.confirm(t("confirm_delete_document")))
      return;

    try {
      const response = await deleteDocument(appointmentId, docId);
      setApplication(response.data);
      if (response.data.documents && response.data.documents.length > 0) {
        await fetchDocumentPreviews(response.data.documents);
      } else {
        setDocumentPreviews([]);
      }
      toast.success(t("document_deleted"));
    } catch (err) {
      toast.error(
        err.response?.data?.message || t("document_delete_failed")
      );
      setError(t("document_delete_failed"));
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("email");
        navigate("/");
      }
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
        return t(`time_${unit}`, { count: interval });
      }
    }
    return t("time_just_now");
  };

  const formatTimeIST = (timeStr, dateStr) => {
    if (!timeStr || !dateStr) return t("not_specified");
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

  if (loading)
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>{t("loading")}</p>
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
          {t("retry")}
        </button>
      </div>
    );

  if (!application)
    return (
      <div className="empty-state">
        <h3>{t("no_appointment")}</h3>
        <p>{t("no_appointment_details")}</p>
        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M15 18L9 12L15 6"
              stroke="#3B82F6"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {t("back")}
        </button>
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
    patient,
    serviceOrders,
  } = application;

  const getStatusColor = (status) => getApptStatusColor(status);

  const isDoctor = doctorEmail === doctor?.email;

  const doctorName = doctor
    ? `${getFieldValue(doctor.firstName, i18n.language) || ""} ${getFieldValue(doctor.middleName, i18n.language) || ""} ${getFieldValue(doctor.lastName, i18n.language) || ""
      }`.trim() || t("not_specified")
    : t("not_specified");

  const serviceOrderDetails = serviceOrders?.[0] || {};

  return (
    <div className="app-appointment-page">
      <div className="app-appointment-card">
        <div className="app-appointment-card-header">
          <h2>{serviceType || t("service_default")}</h2>
          {appointmentStatus && (
            <span
              className="app-status-badge"
              style={{ backgroundColor: getStatusColor(appointmentStatus) }}
            >
              <FiCheckCircle />{" "}
              {t(
                `status_${appointmentStatus
                  .toLowerCase()
                  .replace(" ", "_")}`
              )}
            </span>
          )}
        </div>

        <div className="app-details-grid">
          <div className="app-detail-item">
            <div className="app-detail-icon">
              <FiCalendar />
            </div>
            <div>
              <p className="app-detail-label">
                {t("date")}
              </p>
              <p className="app-detail-value">
                {date
                  ? new Date(date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                  : t("not_specified")}
              </p>
            </div>
          </div>

          <div className="app-detail-item">
            <div className="app-detail-icon">
              <FiClock />
            </div>
            <div>
              <p className="app-detail-label">
                {t("time")}
              </p>
              <p className="app-detail-value">
                {startTime && date
                  ? `${formatTimeIST(startTime, date)} - ${endTime ? formatTimeIST(endTime, date) : "--"
                  } IST`
                  : t("not_specified")}
              </p>
            </div>
          </div>

          <div className="app-detail-item">
            <div className="app-detail-icon">
              <FiActivity />
            </div>
            <div>
              <p className="app-detail-label">
                {t("service")}
              </p>
              <p className="app-detail-value">
                {serviceType || t("not_specified")}
              </p>
            </div>
          </div>

          <div className="app-detail-item">
            <div className="app-detail-icon">
              {appointmentMode?.toLowerCase() === "online" ? (
                <FiVideo />
              ) : (
                <FiActivity />
              )}
            </div>
            <div>
              <p className="app-detail-label">
                {t("mode")}
              </p>
              <p className="app-detail-value">
                {appointmentMode
                  ? t(`mode_${appointmentMode.toLowerCase()}`)
                  : t("not_specified")}
                {meetingLink && appointmentMode?.toLowerCase() === "online" && (
                  <a
                    href={meetingLink}
                    target="_blank"
                    rel="noreferrer"
                    className="app-meeting-link"
                  >
                    {t("join_meeting")}
                  </a>
                )}
              </p>
            </div>
          </div>

          <div className="app-detail-item">
            <div className="app-detail-icon">
              <FiUser />
            </div>
            <div>
              <p className="app-detail-label">
                {t("doctor")}
              </p>
              <p className="app-detail-value">{doctorName}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="app-tabbed-sections">
        <div
          className="app-info-card"
          style={{ marginBottom: "var(--app-tab-spacing)" }}
        >
          <div className="app-card-header app-tab-header">
            <div className="app-header-content">
              <FiFileText className="app-header-icon" />
              <h3>{t("documents")}</h3>
            </div>
            {isDoctor && (
              <div className="app-upload-controls">
                <label className="app-upload-button">
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    className="file-input"
                    disabled={uploading}
                  />
                  {uploading
                    ? t("uploading")
                    : t("upload_document")}
                </label>
              </div>
            )}
          </div>
          {selectedFile && (
            <div className="app-upload-preview">
              <div className="app-file-info">
                <span className="app-file-name">{selectedFile.name}</span>
                <span className="app-file-size">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </span>
              </div>
              <div className="app-upload-actions">
                <button
                  onClick={handleUploadCancel}
                  className="app-cancel-button"
                  disabled={uploading}
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={handleUploadConfirm}
                  className="app-confirm-button primary-button"
                  disabled={uploading}
                >
                  {uploading
                    ? t("uploading")
                    : t("upload_document")}
                </button>
              </div>
            </div>
          )}
          <div className="app-documents-list">
            {documentPreviews.length > 0 ? (
              documentPreviews.map((doc) => (
                <div key={doc.id} className="app-document-item">
                  <div className="app-document-icon">
                    {doc.type === "pdf" ? (
                      <span className="pdf-icon">PDF</span>
                    ) : ["jpg", "jpeg", "png", "gif"].includes(doc.type) ? (
                      <span className="image-icon">IMG</span>
                    ) : (
                      <span className="file-icon">FILE</span>
                    )}
                  </div>
                  <div className="app-document-details">
                    <span className="app-document-name">{doc.name}</span>
                    <div className="app-document-actions">
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="app-view-button"
                      >
                        {t("view")}
                      </a>
                      <a
                        href={doc.url}
                        download
                        className="app-download-button"
                      >
                        {t("download")}
                      </a>
                      {isDoctor && (
                        <button
                          className="app-icon-button danger"
                          onClick={() => handleDeleteDocument(doc.id)}
                          aria-label={t("delete_document")}
                        >
                          <FiTrash2 size={20} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="app-no-documents">
                <p>{t("no_documents")}</p>
              </div>
            )}
          </div>
        </div>

        <div
          className="app-info-card"
          style={{ marginBottom: "var(--app-tab-spacing)" }}
        >
          <div className="app-card-header app-tab-header">
            <div className="app-header-content">
              <FiFileText className="app-header-icon" />
              <h3>{t("prescription")}</h3>
            </div>
            {isDoctor && (
              <button
                className="app-icon-button"
                onClick={() => {
                  handleEditToggle("prescription");
                  setEditValues((prev) => ({
                    ...prev,
                    prescription: application.prescription?.text || "",
                  }));
                }}
                aria-label={
                  editing.prescription
                    ? t("cancel_editing")
                    : t("edit_prescription")
                }
              >
                {editing.prescription ? (
                  <FiX size={18} />
                ) : (
                  <FiEdit2 size={18} />
                )}
              </button>
            )}
          </div>
          <div className="app-card-content">
            {editing.prescription ? (
              <div className="app-edit-container">
                <textarea
                  value={editValues.prescription}
                  onChange={(e) =>
                    handleEditChange("prescription", e.target.value)
                  }
                  placeholder={t("prescription_placeholder")}
                  rows={5}
                  className="edit-textarea"
                  autoFocus
                />
                <div className="app-edit-actions">
                  <button
                    className="app-text-button app-primary primary-button"
                    onClick={handleSavePrescription}
                  >
                    <FiSave className="button-icon" />
                    {t("save")}
                  </button>
                  <button
                    className="app-text-button app-secondary"
                    onClick={() => {
                      handleEditToggle("prescription");
                      setEditValues((prev) => ({
                        ...prev,
                        prescription: application.prescription?.text || "",
                      }));
                    }}
                  >
                    <FiX className="button-icon" />{" "}
                    {t("cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="prescription-content">
                {prescription?.text ? (
                  prescription.text
                    .split("\n")
                    .map((paragraph, i) => (
                      <p key={i}>
                        {paragraph || t("no_prescription")}
                      </p>
                    ))
                ) : (
                  <p className="no-content">
                    {t("no_prescription")}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div
          className="app-info-card"
          style={{ marginBottom: "var(--app-tab-spacing)" }}
        >
          <div className="app-card-header app-tab-header">
            <div className="app-header-content">
              <FiCheckCircle className="app-header-icon" />
              <h3>{t("conclusion")}</h3>
            </div>
            {isDoctor && (
              <button
                className="app-icon-button"
                onClick={() => {
                  handleEditToggle("conclusion");
                  setEditValues((prev) => ({
                    ...prev,
                    conclusion: application.conclusion?.text || "",
                  }));
                }}
                aria-label={
                  editing.conclusion
                    ? t("cancel_editing")
                    : t("edit_conclusion")
                }
              >
                {editing.conclusion ? <FiX size={18} /> : <FiEdit2 size={18} />}
              </button>
            )}
          </div>
          <div className="app-card-content">
            {editing.conclusion ? (
              <div className="app-edit-container">
                <textarea
                  value={editValues.conclusion}
                  onChange={(e) =>
                    handleEditChange("conclusion", e.target.value)
                  }
                  placeholder={t("conclusion_placeholder")}
                  rows={5}
                  className="edit-textarea"
                  autoFocus
                />
                <div className="app-edit-actions">
                  <button
                    className="app-text-button app-primary primary-button"
                    onClick={handleSaveConclusion}
                  >
                    <FiSave className="button-icon" />{" "}
                    {t("save")}
                  </button>
                  <button
                    className="app-text-button app-secondary"
                    onClick={() => {
                      handleEditToggle("conclusion");
                      setEditValues((prev) => ({
                        ...prev,
                        conclusion: application.conclusion?.text || "",
                      }));
                    }}
                  >
                    <FiX className="button-icon" />{" "}
                    {t("cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="conclusion-content">
                {conclusion?.text ? (
                  conclusion.text
                    .split("\n")
                    .map((paragraph, i) => (
                      <p key={i}>
                        {paragraph || t("no_conclusion")}
                      </p>
                    ))
                ) : (
                  <p className="no-content">
                    {t("no_conclusion")}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div
          className="app-info-card"
          style={{ marginBottom: "var(--app-tab-spacing)" }}
        >
          <div className="app-card-header app-tab-header">
            <div className="app-header-content">
              <FiFileText className="app-header-icon" />
              <h3>{t("diagnosis")}</h3>
            </div>
          </div>
          <div className="app-card-content">
            <div className="app-diagnosis-content">
              {serviceOrderDetails.briefHistory && (
                <div className="app-diagnosis-item">
                  <p className="app-detail-label">
                    {t("brief_history")}
                  </p>
                  <p className="app-detail-value">
                    {serviceOrderDetails.briefHistory ||
                      t("not_specified")}
                  </p>
                </div>
              )}
              {serviceOrderDetails.entranceDiagnosis && (
                <div className="app-diagnosis-item">
                  <p className="app-detail-label">
                    {t("entrance_diagnosis")}
                  </p>
                  <p className="app-detail-value">
                    {serviceOrderDetails.entranceDiagnosis ||
                      t("not_specified")}
                  </p>
                </div>
              )}
              {!serviceOrderDetails.briefHistory &&
                !serviceOrderDetails.entranceDiagnosis && (
                  <p className="no-content">
                    {t("no_diagnosis")}
                  </p>
                )}
            </div>
          </div>
        </div>

        <div className="app-info-card">
          <div className="app-comments-panel">
            <div className="app-panel-header app-tab-header">
              <div className="app-header-content">
                <FiMessageSquare className="app-header-icon" />
                <h3>
                  {t("comments", {
                    count: comments.length,
                  })}
                </h3>
              </div>
              {isDoctor && (
                <button
                  className="app-icon-button"
                  onClick={() =>
                    setEditing((prev) => ({ ...prev, comment: !prev.comment }))
                  }
                  aria-label={
                    editing.comment
                      ? t("close_comment_editor")
                      : t("add_comment")
                  }
                >
                  {editing.comment ? <FiX size={18} /> : <FiPlus size={18} />}
                </button>
              )}
            </div>

            {editing.comment && (
              <div className="app-comment-composer">
                <div className="app-composer-header">
                  <span className="app-user-badge">
                    <FiUser size={14} />{" "}
                    {doctorEmail?.split("@")[0] || t("doctor")}
                  </span>
                </div>
                <div className="app-composer-content">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder={t("comment_placeholder")}
                    rows={3}
                    className="app-composer-textarea"
                    autoFocus
                  />
                  <div className="app-composer-actions">
                    <button
                      className="app-text-button app-secondary"
                      onClick={() => {
                        setEditing((prev) => ({ ...prev, comment: false }));
                        setNewComment("");
                      }}
                    >
                      {t("cancel")}
                    </button>
                    <button
                      className="app-text-button app-primary primary-button"
                      onClick={handleAddComment}
                      disabled={!newComment.trim()}
                    >
                      {t("post_comment")}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="app-comments-feed">
              {comments.length > 0 ? (
                comments.map((comment, index) => (
                  <div
                    key={comment._id || index}
                    className={`app-comment ${comment.role === "doctor" ? "app-doctor-comment" : ""
                      }`}
                  >
                    <div className="app-comment-body">
                      <div className="app-comment-header">
                        <div className="app-comment-meta">
                          <span className="app-comment-author">
                            {comment.email}
                            {comment.role === "doctor" && (
                              <span className="app-role-badge">
                                {t("doctor_role")}
                              </span>
                            )}
                          </span>
                          <span className="app-comment-time">
                            {formatRelativeTime(comment.createdAt)}
                            {comment.edited && (
                              <span className="app-edited-indicator">
                                {" "}
                                · {t("edited")}
                              </span>
                            )}
                          </span>
                        </div>

                        {comment.email === doctorEmail &&
                          !comment.isEditing && (
                            <div className="app-comment-actions always-visible">
                              <button
                                className="app-icon-button app-subtle"
                                onClick={() => {
                                  const updatedComments = [...comments];
                                  updatedComments[index] = {
                                    ...updatedComments[index],
                                    isEditing: true,
                                    editText: updatedComments[index].text,
                                  };
                                  setApplication({
                                    ...application,
                                    comments: updatedComments,
                                  });
                                }}
                                aria-label={t("edit_comment")}
                                title={t("edit_comment")}
                              >
                                <FiEdit2 size={20} />
                              </button>
                              <button
                                className="app-icon-button app-subtle danger"
                                onClick={() => handleDeleteComment(comment._id)}
                                aria-label={t("delete_comment")}
                                title={t("delete_comment")}
                              >
                                <FiTrash2 size={20} />
                              </button>
                            </div>
                          )}
                      </div>

                      {comment.isEditing ? (
                        <div className="app-comment-editor">
                          <textarea
                            value={comment.editText}
                            onChange={(e) => {
                              const updatedComments = [...comments];
                              updatedComments[index].editText = e.target.value;
                              setApplication({
                                ...application,
                                comments: updatedComments,
                              });
                            }}
                            className="app-editor-textarea"
                            autoFocus
                          />
                          <div className="app-editor-actions">
                            <button
                              className="app-text-button app-secondary"
                              onClick={() => {
                                const updatedComments = [...comments];
                                updatedComments[index].isEditing = false;
                                setApplication({
                                  ...application,
                                  comments: updatedComments,
                                });
                              }}
                            >
                              {t("cancel")}
                            </button>
                            <button
                              className="app-text-button app-primary primary-button"
                              onClick={() =>
                                handleEditComment(comment._id, comment.editText)
                              }
                              disabled={!comment.editText?.trim()}
                            >
                              {t("save")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="app-comment-text">{comment.text}</div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="app-empty-state">
                  <FiMessageSquare size={24} />
                  <p>{t("no_comments")}</p>
                  {isDoctor && (
                    <button
                      className="app-text-button app-primary primary-button"
                      onClick={() =>
                        setEditing((prev) => ({ ...prev, comment: true }))
                      }
                    >
                      {t("start_conversation")}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApplicationDetails;