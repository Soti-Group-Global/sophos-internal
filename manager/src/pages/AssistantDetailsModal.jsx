import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import Select from "react-select";
import { grantAccess, revokeAccess, updateAccessTime, getDoctorsProfileData, assignDoctorToAssistant } from "../utils/api";
import api from "../utils/api";
import "../styles/AssistantDetailsModal.css";

const AssistantDetailsModal = ({ assistant, isOpen, onClose }) => {
  const [assignments, setAssignments] = useState([]);
  const [editingEntry, setEditingEntry] = useState(null);
  const [timeEdits, setTimeEdits] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("active");
  const [doctorOptions, setDoctorOptions] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [submittingAssign, setSubmittingAssign] = useState(false);
  const [assignForm, setAssignForm] = useState({ doctorEmail: "", startDateTime: "", endDateTime: "" });
  const [assignErrors, setAssignErrors] = useState({});
  const [assignSuccess, setAssignSuccess] = useState("");

  // Fetch assignments when modal opens
  useEffect(() => {
    if (isOpen && assistant?.email) {
      fetchAssignments();
    }
  }, [isOpen, assistant]);

  // Fetch doctor options when assign tab opens
  useEffect(() => {
    if (activeTab === "assign" && doctorOptions.length === 0) {
      const fetchDoctors = async () => {
        setLoadingDoctors(true);
        try {
          const response = await getDoctorsProfileData({ status: "active" });
          const doctors = response.data || [];
          setDoctorOptions(
            doctors.map((d) => {
              const firstName = d.firstName?.en || d.firstName?.ru || d.firstName || "";
              const lastName  = d.lastName?.en  || d.lastName?.ru  || d.lastName  || "";
              return {
                value: d.email,
                label: `${firstName} ${lastName} (${d.email})`,
              };
            })
          );
        } catch (err) {
        } finally {
          setLoadingDoctors(false);
        }
      };
      fetchDoctors();
    }
  }, [activeTab]);

  // Validate assign form
  const validateAssign = () => {
    const errors = {};
    if (!assignForm.doctorEmail) errors.doctorEmail = "Doctor is required";
    if (!assignForm.startDateTime) errors.startDateTime = "Start date is required";
    if (!assignForm.endDateTime) errors.endDateTime = "End date is required";
    else if (assignForm.startDateTime && new Date(assignForm.endDateTime) <= new Date(assignForm.startDateTime))
      errors.endDateTime = "End must be after start";
    setAssignErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit assign form
  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!validateAssign()) return;
    setSubmittingAssign(true);
    setAssignSuccess("");
    try {
      await assignDoctorToAssistant(assistant.email, {
        doctorEmail: assignForm.doctorEmail,
        startDateTime: fromMoscowInputToISO(assignForm.startDateTime),
        endDateTime: fromMoscowInputToISO(assignForm.endDateTime),
      });
      setAssignSuccess("Doctor assigned successfully!");
      setAssignForm({ doctorEmail: "", startDateTime: "", endDateTime: "" });
      setAssignErrors({});
      await fetchAssignments();
      setTimeout(() => setActiveTab("active"), 1000);
    } catch (err) {
      setAssignErrors({ submit: err.response?.data?.message || "Failed to assign doctor" });
    } finally {
      setSubmittingAssign(false);
    }
  };

  // Load all doctor assignments
  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const response = await api.get(
        `/assistants/by-email/${encodeURIComponent(assistant.email)}`
      );
      const assistantData = response.data.assistant;
      setAssignments(assistantData.doctors || []);
    } catch (err) {
      setError("Failed to load assignments");
    } finally {
      setLoading(false);
    }
  };

  // Filter assignments based on active tab
  const filteredAssignments = assignments.filter((assignment) => {
    const status =
      assignment.status ||
      (new Date(assignment.endDateTime) > new Date()
        ? "Access Granted"
        : "Access Revoked");

    if (activeTab === "active") {
      return status === "Access Granted" || status === "Pending";
    } else {
      return status === "Access Revoked";
    }
  });

  // Grant access
  const handleGrantAccess = async (
    accessId,
    doctorEmail,
    startDateTime,
    endDateTime
  ) => {
    try {
      await grantAccess({
        assistantEmail: assistant.email,
        accessId,
        doctorEmail,
        startDateTime,
        endDateTime,
      });

      setAssignments((prev) =>
        prev.map((a) =>
          a._id === accessId
            ? { ...a, status: "Access Granted", startDateTime, endDateTime }
            : a
        )
      );
    } catch (err) {
      setError("Failed to grant access");
    }
  };

  // Revoke access
  const handleRevokeAccess = async (
    accessId,
    doctorEmail,
    startDateTime,
    endDateTime
  ) => {
    try {
      await revokeAccess({
        assistantEmail: assistant.email,
        accessId,
        doctorEmail,
        startDateTime,
        endDateTime,
      });

      setAssignments((prev) =>
        prev.map((a) =>
          a._id === accessId
            ? { ...a, status: "Access Revoked", startDateTime, endDateTime }
            : a
        )
      );
    } catch (err) {
      setError("Failed to revoke access");
    }
  };

  // Update access times
  const handleUpdateAccess = async (accessId) => {
    const editData = timeEdits[accessId] || {};
    const doctorEmail = assignments.find(
      (a) => a._id === accessId
    )?.doctorEmail;

    try {
      await updateAccessTime({
        assistantEmail: assistant.email,
        accessId,
        doctorEmail,
        startDateTime: fromMoscowInputToISO(editData.startDateTime),
        endDateTime: fromMoscowInputToISO(editData.endDateTime),
      });

      setAssignments((prevAssignments) =>
        prevAssignments.map((assignment) =>
          assignment._id === accessId
            ? {
                ...assignment,
                startDateTime: fromMoscowInputToISO(editData.startDateTime),
                endDateTime: fromMoscowInputToISO(editData.endDateTime),
              }
            : assignment
        )
      );

      setEditingEntry(null);
    } catch (err) {
      setError("Failed to update access time");
    }
  };

  // Convert a datetime-local input string (Moscow UTC+3) back to UTC ISO string for the backend
  const fromMoscowInputToISO = (val) => {
    if (!val) return null;
    // val = "YYYY-MM-DDTHH:MM" treated as Moscow time (UTC+3)
    // Parse components manually so browser timezone is irrelevant
    const [datePart, timePart] = val.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, min] = timePart.split(":").map(Number);
    // Moscow = UTC+3 → subtract 3h to get UTC
    return new Date(Date.UTC(year, month - 1, day, hour - 3, min)).toISOString();
  };

  // Convert a date to Moscow time (UTC+3) for datetime-local inputs
  // Uses getUTC* so result is identical regardless of browser timezone
  const toMoscowDatetimeInput = (date) => {
    const d = new Date(date);
    const moscow = new Date(d.getTime() + 3 * 60 * 60 * 1000); // UTC + 3h
    const pad = (n) => String(n).padStart(2, "0");
    return `${moscow.getUTCFullYear()}-${pad(moscow.getUTCMonth() + 1)}-${pad(moscow.getUTCDate())}T${pad(moscow.getUTCHours())}:${pad(moscow.getUTCMinutes())}`;
  };

  // Format a date as DD-MM-YYYY HH:MM in Moscow time (UTC+3)
  // Uses getUTC* so result is identical regardless of browser timezone
  const toMoscowDisplay = (date) => {
    if (!date) return "—";
    const d = new Date(date);
    const moscow = new Date(d.getTime() + 3 * 60 * 60 * 1000); // UTC + 3h
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(moscow.getUTCDate())}-${pad(moscow.getUTCMonth() + 1)}-${moscow.getUTCFullYear()} ${pad(moscow.getUTCHours())}:${pad(moscow.getUTCMinutes())}`;
  };

  // Handle edit button click
  const handleEditClick = (entry) => {
    setEditingEntry(entry._id);
    setTimeEdits((prev) => ({
      ...prev,
      [entry._id]: {
        startDateTime: entry.startDateTime ? toMoscowDatetimeInput(entry.startDateTime) : "",
        endDateTime:   entry.endDateTime   ? toMoscowDatetimeInput(entry.endDateTime)   : "",
      },
    }));
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingEntry(null);
  };

  // Update local time fields
  const updateTime = (entryId, field, value) => {
    setTimeEdits((prev) => ({
      ...prev,
      [entryId]: {
        ...prev[entryId],
        [field]: value,
      },
    }));
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="modern-modal-overlay" onClick={onClose}>
      <div
        className="modern-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modern-modal-header">
          <div className="modern-modal-user">
            <div className="modern-user-avatar">
              {assistant.firstName?.[0]}
              {assistant.lastName?.[0]}
            </div>
            <div className="modern-user-info">
              <h2 className="modern-user-name">
                {assistant.firstName} {assistant.lastName}
              </h2>
              <p className="modern-user-email">{assistant.email}</p>
            </div>
          </div>
          <button className="modern-close-button" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="modern-modal-tabs">
          <button
            className={`modern-tab ${activeTab === "active" ? "active" : ""}`}
            onClick={() => setActiveTab("active")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Active Access
          </button>
          <button
            className={`modern-tab ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Access History
          </button>
          <button
            className={`modern-tab ${activeTab === "assign" ? "active" : ""}`}
            onClick={() => setActiveTab("assign")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Assign New Doctor
          </button>
        </div>

        {/* Body */}
        <div className="modern-modal-body">
          {activeTab !== "assign" && (
            loading ? (
              <div className="modern-loading">
                <div className="modern-spinner"></div>
                <p>Loading access records...</p>
              </div>
            ) : filteredAssignments.length > 0 ? (
            <div className="modern-access-list">
              {filteredAssignments.map((assignment) => {
                const isEditing = editingEntry === assignment._id;
                const timeEntry = timeEdits[assignment._id] || {
                  startDateTime: assignment.startDateTime ? toMoscowDatetimeInput(assignment.startDateTime) : "",
                  endDateTime:   assignment.endDateTime   ? toMoscowDatetimeInput(assignment.endDateTime)   : "",
                };
                const status =
                  assignment.status ||
                  (new Date(assignment.endDateTime) > new Date()
                    ? "Access Granted"
                    : "Access Revoked");

                return (
                  <div key={assignment._id} className="modern-access-card">
                    <div className="modern-card-header">
                      <div className="modern-doctor-info">
                        <div className="modern-doctor-avatar">
                          {assignment.doctorEmail?.[0]?.toUpperCase()}
                        </div>
                        <div className="modern-doctor-details">
                          <span className="modern-doctor-email">
                            {assignment.doctorEmail}
                          </span>
                          <span className="modern-access-type">
                            Full Access
                          </span>
                        </div>
                      </div>
                      <div className="modern-card-actions">
                        <div
                          className={`modern-status-badge modern-status-${status
                            .toLowerCase()
                            .replace(" ", "-")}`}
                        >
                          {status}
                        </div>
                        {!isEditing && status !== "Access Revoked" && (
                          <button
                            className="modern-edit-button"
                            onClick={() => handleEditClick(assignment)}
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                            >
                              <path
                                d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="modern-time-fields">
                      <div className="modern-time-group">
                        <label className="modern-time-label">Start Time</label>
                        {isEditing ? (
                          <input
                            type="datetime-local"
                            value={timeEntry.startDateTime}
                            onChange={(e) =>
                              updateTime(
                                assignment._id,
                                "startDateTime",
                                e.target.value
                              )
                            }
                            className="modern-time-input"
                          />
                        ) : (
                          <span className="modern-time-display">
                            {toMoscowDisplay(assignment.startDateTime)}
                          </span>
                        )}
                      </div>

                      <div className="modern-time-group">
                        <label className="modern-time-label">End Time</label>
                        {isEditing ? (
                          <input
                            type="datetime-local"
                            value={timeEntry.endDateTime}
                            onChange={(e) =>
                              updateTime(
                                assignment._id,
                                "endDateTime",
                                e.target.value
                              )
                            }
                            className="modern-time-input"
                          />
                        ) : (
                          <span className="modern-time-display">
                            {toMoscowDisplay(assignment.endDateTime)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="modern-action-buttons">
                      {isEditing ? (
                        <div className="modern-edit-actions">
                          <button
                            className="modern-button modern-save-button"
                            onClick={() => handleUpdateAccess(assignment._id)}
                          >
                            Save Changes
                          </button>
                          <button
                            className="modern-button modern-cancel-button"
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          {status === "Pending" && (
                            <div className="modern-pending-actions">
                              <button
                                className="modern-button modern-grant-button"
                                onClick={() =>
                                  handleGrantAccess(
                                    assignment._id,
                                    assignment.doctorEmail,
                                    timeEntry.startDateTime,
                                    timeEntry.endDateTime
                                  )
                                }
                              >
                                Grant Access
                              </button>
                              <button
                                className="modern-button modern-deny-button"
                                onClick={() =>
                                  handleRevokeAccess(
                                    assignment._id,
                                    assignment.doctorEmail,
                                    timeEntry.startDateTime,
                                    timeEntry.endDateTime
                                  )
                                }
                              >
                                Deny
                              </button>
                            </div>
                          )}

                          {status === "Access Granted" && (
                            <button
                              className="modern-button modern-revoke-button"
                              onClick={() =>
                                handleRevokeAccess(
                                  assignment._id,
                                  assignment.doctorEmail,
                                  timeEntry.startDateTime,
                                  timeEntry.endDateTime
                                )
                              }
                            >
                              Revoke Access
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="modern-empty-state">
              <div className="modern-empty-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h3>No Access Records</h3>
              <p>
                {activeTab === "active"
                  ? "No active access records found for this assistant."
                  : "No access history records found."}
              </p>
            </div>
          ))}

          {activeTab === "assign" && (
            <form onSubmit={handleAssignSubmit} className="modern-assign-form">
              <div className="modern-assign-field">
                <label className="modern-time-label">Doctor <span className="modern-required">*</span></label>
                <Select
                  options={doctorOptions}
                  value={doctorOptions.find((o) => o.value === assignForm.doctorEmail) || null}
                  onChange={(sel) => setAssignForm((p) => ({ ...p, doctorEmail: sel?.value || "" }))}
                  placeholder={loadingDoctors ? "Loading doctors..." : "Select a doctor"}
                  isDisabled={loadingDoctors}
                  classNamePrefix="adm-select"
                  styles={{
                    control: (base) => ({
                      ...base,
                      minHeight: "44px",
                      borderColor: assignErrors.doctorEmail ? "#ef4444" : "#e2e8f0",
                      "&:hover": { borderColor: assignErrors.doctorEmail ? "#ef4444" : "#0c3870" },
                    }),
                  }}
                />
                {assignErrors.doctorEmail && <span className="modern-field-error">{assignErrors.doctorEmail}</span>}
              </div>

              <div className="modern-time-fields" style={{ marginTop: "16px" }}>
                <div className="modern-time-group">
                  <label className="modern-time-label">Start Date & Time <span className="modern-required">*</span></label>
                  <input
                    type="datetime-local"
                    value={assignForm.startDateTime}
                    onChange={(e) => setAssignForm((p) => ({ ...p, startDateTime: e.target.value }))}
                    className={`modern-time-input${assignErrors.startDateTime ? " modern-input-error" : ""}`}
                  />
                  {assignErrors.startDateTime && <span className="modern-field-error">{assignErrors.startDateTime}</span>}
                </div>
                <div className="modern-time-group">
                  <label className="modern-time-label">End Date & Time <span className="modern-required">*</span></label>
                  <input
                    type="datetime-local"
                    value={assignForm.endDateTime}
                    onChange={(e) => setAssignForm((p) => ({ ...p, endDateTime: e.target.value }))}
                    className={`modern-time-input${assignErrors.endDateTime ? " modern-input-error" : ""}`}
                  />
                  {assignErrors.endDateTime && <span className="modern-field-error">{assignErrors.endDateTime}</span>}
                </div>
              </div>

              {assignErrors.submit && (
                <div className="modern-error-message" style={{ marginTop: "12px" }}>
                  {assignErrors.submit}
                </div>
              )}
              {assignSuccess && (
                <div className="modern-success-message" style={{ marginTop: "12px" }}>
                  {assignSuccess}
                </div>
              )}

              <button
                type="submit"
                className="modern-button modern-save-button modern-assign-submit"
                disabled={submittingAssign || loadingDoctors}
              >
                {submittingAssign ? "Assigning..." : "Assign Doctor"}
              </button>
            </form>
          )}

          {error && (
            <div className="modern-error-message">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AssistantDetailsModal;
