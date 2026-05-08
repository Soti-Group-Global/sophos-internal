import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "../styles/ScheduleManagement.css";
import {
  getAllAssistants,
  getEmailFromToken,
  getImage,
  grantAccess,
  revokeAccess,
  updateAccessTime,
} from "../utils/api";
import moment from "moment-timezone";
import GrantAccess from "../components/GrantAccess/GrantAccess";

import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";

// Show in Moscow time
const formatDateTime = (v, locale) => {
  if (!v) return "Not specified";
  return moment.utc(v).tz("Europe/Moscow").format("DD.MM.YYYY HH:mm");
};

// Convert Moscow datetime-local input → UTC ISO for backend
const convertMoscowToUTC = (moscowDateTime) => {
  if (!moscowDateTime) return null;
  return moment.tz(moscowDateTime, "Europe/Moscow").utc().toISOString();
};

// Convert backend UTC → Moscow time for <input type="datetime-local">
const convertUTCToMoscowForInput = (utcDateTime) => {
  if (!utcDateTime) return "";
  return moment.utc(utcDateTime).tz("Europe/Moscow").format("YYYY-MM-DDTHH:mm");
};

const ScheduleManagement = () => {
  const { t, i18n } = useTranslation();
  const [assistants, setAssistants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [imageUrls, setImageUrls] = useState({});
  const [isGrantAccessModalOpen, setIsGrantAccessModalOpen] = useState(false);
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [selectedAssistant, setSelectedAssistant] = useState(null);
  const [editedAccessTimes, setEditedAccessTimes] = useState({});
  const [editingEntry, setEditingEntry] = useState(null);
  const doctorEmail = getEmailFromToken();
  const [timeEdits, setTimeEdits] = useState({});

  const fetchAssistants = async () => {
    try {
      const assistantsData = await getAllAssistants();
      setAssistants(assistantsData);
      fetchAssistantImages(assistantsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssistantImages = async (assistantsArray) => {
    const imageUrlMap = {};
    for (const assistant of assistantsArray) {
      if (assistant.profileFileId) {
        try {
          const blob = await getImage(assistant.profileFileId);
          imageUrlMap[assistant.profileFileId] = URL.createObjectURL(blob);
        } catch {
          imageUrlMap[assistant.profileFileId] = "/default-user.png";
        }
      }
    }
    setImageUrls(imageUrlMap);
  };

  const refreshAssistantData = async () => {
    try {
      const assistantsData = await getAllAssistants();
      setAssistants(assistantsData);

      // Update the selected assistant with fresh data
      if (selectedAssistant) {
        const updatedAssistant = assistantsData.find(
          (assistant) => assistant.email === selectedAssistant.email
        );
        if (updatedAssistant) {
          setSelectedAssistant(updatedAssistant);
        }
      }
    } catch (err) {
      console.error("Failed to refresh data:", err);
    }
  };

  // Function to export assistants data as CSV
  const exportToCSV = () => {
    if (assistants.length === 0) return;
    
    // Prepare CSV content
    const headers = [
      t("scheduleManagement.csv.name"),
      t("scheduleManagement.csv.email"),
      t("scheduleManagement.csv.role"),
      t("scheduleManagement.csv.recent_access_start"),
      t("scheduleManagement.csv.recent_access_end"),
      t("scheduleManagement.csv.status")
    ];
    
    const rows = assistants.map(assistant => [
      `${assistant.firstName} ${assistant.middleName || ''} ${assistant.lastName}`,
      assistant.email,
      t("scheduleManagement.assistant_role"),
      assistant.recentAccess?.startDateTime 
        ? formatDateTime(assistant.recentAccess.startDateTime, i18n.language)
        : t("common.not_set"),
      assistant.recentAccess?.endDateTime 
        ? formatDateTime(assistant.recentAccess.endDateTime, i18n.language)
        : t("common.not_set"),
      assistant.recentAccess?.status 
        ? getTranslatedStatus(assistant.recentAccess.status)
        : t("status.unknown")
    ]);
    
    // Create CSV content
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(field => `"${field.replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    
    // Create download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "assistants_export.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    fetchAssistants();
  }, []);

  useEffect(() => {
    return () => {
      Object.values(imageUrls).forEach((url) => {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      });
    };
  }, [imageUrls]);

  const handleCardClick = (assistant) => {
    setIsAccessModalOpen(true);
    setSelectedAssistant(assistant)
  };

  const handleGrantAccessClick = (assistant) => {
    setIsGrantAccessModalOpen(true);
    setSelectedAssistant(assistant);
  };

  const handleCloseModal = () => {
    setSelectedAssistant(null);
    setIsAccessModalOpen(false);
    setEditingEntry(null);
    setTimeEdits({});
  };

  const handleGrantAccess = async (
    assistantEmail,
    accessId,
    startDateTime,
    endDateTime
  ) => {
    try {
      // Convert Moscow time to UTC before sending to server
      const utcStartDateTime = convertMoscowToUTC(startDateTime);
      const utcEndDateTime = convertMoscowToUTC(endDateTime);
      
      await grantAccess({
        assistantEmail,
        accessId,
        startDateTime: utcStartDateTime,
        endDateTime: utcEndDateTime,
      });
      await refreshAssistantData();
    } catch (err) {
      console.error("Grant access failed:", err);
    }
  };

  const handleRevokeAccess = async (
    assistantEmail,
    accessId,
    startDateTime,
    endDateTime
  ) => {
    try {
      // Convert Moscow time to UTC before sending to server
      const utcStartDateTime = convertMoscowToUTC(startDateTime);
      const utcEndDateTime = convertMoscowToUTC(endDateTime);
      
      await revokeAccess({
        assistantEmail,
        accessId,
        startDateTime: utcStartDateTime,
        endDateTime: utcEndDateTime,
      });
      await refreshAssistantData();
    } catch (err) {
      console.error("Revoke access failed:", err);
    }
  };

  const handleEditClick = (entry) => {
    setEditingEntry(entry._id);
    setTimeEdits({
      ...timeEdits,
      [entry._id]: {
        startDateTime: entry.startDateTime
          ? convertUTCToMoscowForInput(entry.startDateTime)
          : "",
        endDateTime: entry.endDateTime
          ? convertUTCToMoscowForInput(entry.endDateTime)
          : "",
      },
    });
  };

  const handleCancelEdit = () => {
    setEditingEntry(null);
    setTimeEdits({});
  };

  const handleSaveEdit = async (assistantEmail, entryId) => {
    const update = timeEdits[entryId];
    if (!update?.startDateTime || !update?.endDateTime) return;

    try {
      // Convert Moscow time to UTC before sending to server
      const utcStartDateTime = convertMoscowToUTC(update.startDateTime);
      const utcEndDateTime = convertMoscowToUTC(update.endDateTime);
      
      await updateAccessTime({
        assistantEmail,
        accessId: entryId,
        startDateTime: utcStartDateTime,
        endDateTime: utcEndDateTime,
      });
      setEditingEntry(null);
      setTimeEdits({});
      await refreshAssistantData();
    } catch (err) {
      console.error("Failed to update time:", err);
    }
  };

  const updateTime = (entryId, field, value) => {
    setTimeEdits((prev) => ({
      ...prev,
      [entryId]: {
        ...(prev[entryId] || {}),
        [field]: value,
      },
    }));
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "Access Granted":
        return "status-badge status-granted";
      case "Request Sent":
        return "status-badge status-pending";
      case "Access Revoked":
        return "status-badge status-revoked";
      default:
        return "status-badge status-unknown";
    }
  };

  const getTranslatedStatus = (status) => {
    const statusMap = {
      "Access Granted": t("status.access_granted"),
      "Request Sent": t("status.request_sent"),
      "Access Revoked": t("status.access_revoked"),
      Unknown: t("status.unknown"),
    };
    return statusMap[status] || status;
  };

  if (loading) {
    return (
      <div className="assistants-container">
        <div className="loading-wrapper">
          <div className="loading-spinner"></div>
          <p className="loading-text">{t("common.loading_assistants")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="assistants-container">
      <ToastContainer position="top-right" autoClose={2000} />

      <div className="assistants-page-header">
        <div className="assistant-header-content">
          <h1 className="assistant-page-title">{t("scheduleManagement.title")}</h1>
        </div>
        <div className="assistants-stats">
          {assistants.length > 0 && (
            <button className="export-csv-button" onClick={exportToCSV}>
              <svg
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              {t("scheduleManagement.export_csv")}
            </button>
          )}
        </div>
      </div>

      {assistants.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <svg
              width="64"
              height="64"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <h3 className="empty-title">{t("scheduleManagement.no_assistants")}</h3>
          <p className="empty-description">
            {t("scheduleManagement.no_assistants_description")}
          </p>
        </div>
      ) : (
        <div className="assistants-grid">
          {assistants.map((assistant, index) => {
            const imageUrl = assistant.profileFileId
              ? imageUrls[assistant.profileFileId] || "/default-user.png"
              : "/default-user.png";

            return (
              <div
                key={index}
                className="assistant-card"
              >
                <div className="assistant-card-header" onClick={() => handleCardClick(assistant)}>
                  <div className="assistant-avatar">
                    <img
                      src={imageUrl}
                      alt={`${assistant.firstName} ${assistant.lastName}`}
                      // onError={(e) => {
                      //   e.target.src = "/default-user.png";
                      // }}
                    />
                    <div className="online-indicator"></div>
                  </div>

                  <div className="assistant-details">
                    <h3 className="assistant-name">
                      {assistant.firstName} {assistant.middleName}{" "}
                      {assistant.lastName}
                    </h3>
                    <p className="assistant-email">{assistant.email}</p>
                    <div className="assistant-meta">
                      <span className="role-badge">
                        {t("scheduleManagement.assistant_role")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="card-content" onClick={() => handleCardClick(assistant)}>
                  <div className="access-section">
                    <h4 className="section-title">
                      {t("scheduleManagement.recent_access")}
                    </h4>
                    <div className="access-details">
                      <div className="access-row">
                        <span className="access-label">
                          {t("scheduleManagement.start_time")}
                        </span>
                        <span className="access-value">
                          {assistant.recentAccess?.startDateTime
                            ? formatDateTime(
                                assistant.recentAccess.startDateTime,
                                i18n.language
                              )
                            : t("common.not_set")}
                        </span>
                      </div>
                      <div className="access-row">
                        <span className="access-label">
                          {t("scheduleManagement.end_time")}
                        </span>
                        <span className="access-value">
                          {assistant.recentAccess?.endDateTime
                            ? formatDateTime(
                                assistant.recentAccess.endDateTime,
                                i18n.language
                              )
                            : t("common.not_set")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card-footer">
                  <button className="grant-access" onClick={() => handleGrantAccessClick(assistant)}>
                    {t("actions.grant_access")} →
                  </button>
                  <button className="view-details" onClick={() => handleCardClick(assistant)}>
                    {t("common.view_details")} →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(selectedAssistant && isAccessModalOpen) && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-section">
                <h2 className="modal-title">{t("modal.access_history")}</h2>
                <p className="modal-subtitle">
                  {selectedAssistant.firstName} {selectedAssistant.lastName}
                </p>
              </div>
              <button
                className="assistant-close-button"
                onClick={handleCloseModal}
              >
                <svg
                  width="24"
                  height="24"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="modal-body">
              {selectedAssistant.accessHistory?.length ? (
                <div className="history-list">
                  {selectedAssistant.accessHistory.map((entry, idx) => {
                    const isEditing = editingEntry === entry._id;
                    const timeEntry = timeEdits[entry._id] || {
                      startDateTime: entry.startDateTime
                        ? convertUTCToMoscowForInput(entry.startDateTime)
                        : "",
                      endDateTime: entry.endDateTime
                        ? convertUTCToMoscowForInput(entry.endDateTime)
                        : "",
                    };

                    return (
                      <div key={idx} className="history-entry">
                        <div className="entry-header">
                          <div className="doctor-name">
                            <p className="doctor-name-text">Dr. {entry.doctorName}</p>
                          </div>
                          <div className={getStatusBadgeClass(entry.status)}>
                            {getTranslatedStatus(entry.status) ||
                              t("status.unknown")}
                          </div>
                          {!isEditing && (
                            <button
                              className="edit-button"
                              onClick={() => handleEditClick(entry)}
                            >
                              <svg
                                width="16"
                                height="16"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                              {t("common.edit")}
                            </button>
                          )}
                        </div>

                        <div className="entry-content">
                          <div className="time-fields">
                            <div className="time-field">
                              <label className="field-label">
                                {t("scheduleManagement.start_time")}
                              </label>
                              {isEditing ? (
                                <input
                                  type="datetime-local"
                                  value={timeEntry.startDateTime}
                                  onChange={(e) =>
                                    updateTime(
                                      entry._id,
                                      "startDateTime",
                                      e.target.value
                                    )
                                  }
                                  className="time-input"
                                />
                              ) : (
                                <span className="time-display">
                                  {formatDateTime(
                                    entry.startDateTime,
                                    i18n.language
                                  )}
                                </span>
                              )}
                            </div>

                            <div className="time-field">
                              <label className="field-label">
                                {t("scheduleManagement.end_time")}
                              </label>
                              {isEditing ? (
                                <input
                                  type="datetime-local"
                                  value={timeEntry.endDateTime}
                                  onChange={(e) =>
                                    updateTime(
                                      entry._id,
                                      "endDateTime",
                                      e.target.value
                                    )
                                  }
                                  className="time-input"
                                />
                              ) : (
                                <span className="time-display">
                                  {formatDateTime(
                                    entry.endDateTime,
                                    i18n.language
                                  )}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="entry-actions">
                            {isEditing ? (
                              <div className="edit-actions">
                                <button
                                  className="save-button"
                                  onClick={() =>
                                    handleSaveEdit(
                                      selectedAssistant.email,
                                      entry._id
                                    )
                                  }
                                >
                                  {t("common.save_changes")}
                                </button>
                                <button
                                  className="cancel-button"
                                  onClick={handleCancelEdit}
                                >
                                  {t("common.cancel")}
                                </button>
                              </div>
                            ) : (
                              <>
                                {entry.status === "Request Sent" && (
                                  <div className="status-actions">
                                    <button
                                      className="grant-button"
                                      onClick={() =>
                                        handleGrantAccess(
                                          selectedAssistant.email,
                                          entry._id,
                                          timeEntry.startDateTime,
                                          timeEntry.endDateTime
                                        )
                                      }
                                    >
                                      {t("actions.grant_access")}
                                    </button>
                                    <button
                                      className="deny-button"
                                      onClick={() =>
                                        handleRevokeAccess(
                                          selectedAssistant.email,
                                          entry._id,
                                          timeEntry.startDateTime,
                                          timeEntry.endDateTime
                                        )
                                      }
                                    >
                                      {t("actions.deny_request")}
                                    </button>
                                  </div>
                                )}

                                {entry.status === "Access Granted" && (
                                  <button
                                    className="revoke-button"
                                    onClick={() =>
                                      handleRevokeAccess(
                                        selectedAssistant.email,
                                        entry._id,
                                        timeEntry.startDateTime,
                                        timeEntry.endDateTime
                                      )
                                    }
                                  >
                                    {t("actions.revoke_access")}
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="no-history">
                  <div className="no-history-icon">
                    <svg
                      width="48"
                      height="48"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <h3>{t("scheduleManagement.no_access_history")}</h3>
                  <p>{t("scheduleManagement.no_access_history_description")}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {(selectedAssistant && isGrantAccessModalOpen) && (
        <GrantAccess 
          assistantEmail={selectedAssistant.email}
          
          onClose={() => {
            setIsGrantAccessModalOpen(false);
            setSelectedAssistant(null)
          }}

          onSuccess={() => {
            fetchAssistants();
            setIsGrantAccessModalOpen(false);
            setSelectedAssistant(null);
          }}
        />
      )}
    </div>
  );
};

export default ScheduleManagement;