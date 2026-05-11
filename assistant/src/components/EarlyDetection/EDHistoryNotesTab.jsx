import React from "react";
import {
  CheckCircle,
  Calendar,
  FileText,
  Clock,
  User,
  Plus,
  Edit2,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Right-column content for "history" and "notes" tabs (assistant interface).
 *
 * Props:
 *   activeTab            – "history" | "notes"
 *   booking              – full booking object
 *   formatDate           – (dateStr) => string
 *   formatDateTime       – (dateStr) => string
 *   groupedSchedule      – { 1: item[], 2: item[] }
 *   getDoctorDisplayName – (doctor) => string
 *   normalizeSpecialistTitle – title normalizer
 *   i18nLanguage         – current i18n.language string
 *   // Notes state/handlers
 *   isAddingNote         – boolean
 *   setIsAddingNote      – setter
 *   newNote              – string
 *   setNewNote           – setter
 *   handleAddNote        – () => Promise<void>
 *   isSaving             – boolean
 *   editingNoteId        – string | null
 *   editingNoteText      – string
 *   setEditingNoteText   – setter
 *   setEditingNoteId     – setter
 *   handleEditNote       – (note) => void
 *   handleDeleteNote     – (noteId) => void
 *   handleUpdateNote     – (noteId) => Promise<void>
 */
const EDHistoryNotesTab = ({
  activeTab,
  booking,
  formatDate,
  formatDateTime,
  groupedSchedule,
  getDoctorDisplayName,
  normalizeSpecialistTitle,
  i18nLanguage,
  isAddingNote,
  setIsAddingNote,
  newNote,
  setNewNote,
  handleAddNote,
  isSaving,
  editingNoteId,
  editingNoteText,
  setEditingNoteText,
  setEditingNoteId,
  handleEditNote,
  handleDeleteNote,
  handleUpdateNote,
}) => {
  const { t } = useTranslation();

  /* ── History & Logs ── */
  if (activeTab === "history") {
    return (
      <div className="sidebar-section edb-history-section">
        <h3 className="sidebar-title">
          {t("earlyDiagnosis.historyLogs").toUpperCase()}
        </h3>
        <div className="history-timeline">
          {booking.payment?.status === "paid" && (
            <div className="timeline-item timeline-item--completed">
              <div className="timeline-dot green">
                <CheckCircle size={12} />
              </div>
              <div className="timeline-content timeline-content--plain">
                <p className="timeline-kicker timeline-kicker--completed">
                  {t("earlyDiagnosis.completed", "Completed")}
                </p>
                <p className="timeline-title">
                  {t("earlyDiagnosis.paymentVerified")}
                </p>
                <p className="timeline-description">
                  {(() => {
                    const transactionRef =
                      booking.payment?.transactionId ||
                      booking.payment?.tbank?.paymentId ||
                      booking.payment?.tbank?.orderId;
                    if (transactionRef) {
                      return `${t("earlyDiagnosis.transaction", "Transaction")} #${transactionRef} ${t("earlyDiagnosis.paymentProcessed", "successfully processed for this booking.")}`;
                    }
                    return t(
                      "earlyDiagnosis.paymentStatusUpdated",
                      "Payment was successfully verified for this booking.",
                    );
                  })()}
                </p>
                <div className="timeline-pills">
                  <span className="timeline-pill">
                    {formatDate(booking.payment.paidAt)}
                  </span>
                  <span className="timeline-pill">
                    {new Date(booking.payment.paidAt).toLocaleTimeString(
                      i18nLanguage === "ru" ? "ru-RU" : "en-US",
                      { hour: "2-digit", minute: "2-digit" },
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="timeline-item timeline-item--milestone">
            <div className="timeline-dot blue">
              <Calendar size={12} />
            </div>
            <div className="timeline-content timeline-content--plain">
              <p className="timeline-kicker timeline-kicker--milestone">
                {t("earlyDiagnosis.nextMilestone", "Next milestone")}
              </p>
              <p className="timeline-title">
                {t("earlyDiagnosis.appointmentScheduled")}
              </p>

              <div className="timeline-service-list">
                {[1, 2].map((day) => {
                  const dayItems = groupedSchedule?.[day] || [];
                  if (!dayItems.length) return null;
                  return (
                    <div
                      key={`timeline-day-${day}`}
                      className="timeline-day-group"
                    >
                      <p className="timeline-day-title">{`${t("earlyDiagnosis.dayLabel", "Day")} ${day}`}</p>
                      {dayItems.map((specialist, idx) => (
                        <div
                          key={`service-log-${day}-${idx}`}
                          className="timeline-service-card"
                        >
                          <div className="timeline-service-icon">
                            <FileText size={16} />
                          </div>
                          <div className="timeline-service-main">
                            <p className="timeline-service-title">
                              {specialist.title
                                ? t(
                                    `earlyDiagnosis.specialist_${normalizeSpecialistTitle(specialist.title)}`,
                                    specialist.title,
                                  )
                                : `${t("earlyDiagnosis.service", "Service")} ${idx + 1}`}
                            </p>
                            <p className="timeline-service-sub">
                              {specialist.date
                                ? formatDate(specialist.date)
                                : t("earlyDiagnosis.dateNotSet", "Date not set")}
                              {specialist.startTime && specialist.endTime
                                ? ` · ${specialist.startTime} - ${specialist.endTime}`
                                : ""}
                            </p>
                          </div>
                          <div className="timeline-service-side">
                            <p className="timeline-service-doctor">
                              <User size={12} />{" "}
                              {getDoctorDisplayName(specialist.doctor)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              <p className="timeline-date">
                {formatDateTime(booking.appointmentDate)}
              </p>
            </div>
          </div>

          <div className="timeline-item timeline-item--system">
            <div className="timeline-dot gray">
              <Clock size={12} />
            </div>
            <div className="timeline-content timeline-content--plain">
              <p className="timeline-kicker">
                {t("earlyDiagnosis.systemEvent", "System event")}
              </p>
              <p className="timeline-title">
                {t("earlyDiagnosis.bookingCreated")}
              </p>
              <p className="timeline-description">
                {t(
                  "earlyDiagnosis.bookingCreateDescription",
                  "Initial booking record created in system.",
                )}
              </p>
              <p className="timeline-date">{formatDateTime(booking.createdAt)}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Internal Notes ── */
  if (activeTab === "notes") {
    return (
      <div className="sidebar-section edb-notes-section">
        <div className="notes-shell">
          <div className="notes-toolbar">
            <h3 className="sidebar-title notes-title">
              {t("earlyDiagnosis.internalNotes").toUpperCase()}
            </h3>
            {!isAddingNote && (
              <button
                className="notes-add-btn"
                onClick={() => setIsAddingNote(true)}
              >
                <Plus size={14} />
                {t("earlyDiagnosis.addNote")}
              </button>
            )}
          </div>

          <div className="notes-content">
            {isAddingNote && (
              <div className="add-note-form note-add-card">
                <textarea
                  className="note-textarea"
                  placeholder={t("earlyDiagnosis.enterNoteHere")}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={4}
                />
                <div className="note-actions">
                  <button
                    className="cancel-note-btn"
                    onClick={() => {
                      setIsAddingNote(false);
                      setNewNote("");
                    }}
                    disabled={isSaving}
                  >
                    {t("earlyDiagnosis.cancel")}
                  </button>
                  <button
                    className="save-note-btn"
                    onClick={handleAddNote}
                    disabled={isSaving || !newNote.trim()}
                  >
                    {isSaving
                      ? t("earlyDiagnosis.saving")
                      : t("earlyDiagnosis.saveNote")}
                  </button>
                </div>
              </div>
            )}

            {booking.internalNotes && booking.internalNotes.length > 0 ? (
              <div className="notes-list notes-list--modern">
                {booking.internalNotes.map((note, index) => (
                  <article key={note._id || index} className="note-card">
                    <div className="note-card-top">
                      <div className="note-author-block">
                        <div className="note-avatar">
                          <User size={14} />
                        </div>
                        <div>
                          <p className="note-author">{note.addedBy}</p>
                          <p className="note-date">
                            {formatDateTime(note.addedAt)}
                          </p>
                        </div>
                      </div>

                      {editingNoteId !== note._id && (
                        <div className="note-buttons">
                          <button
                            className="edit-note-icon-btn"
                            onClick={() => handleEditNote(note)}
                            title={t("earlyDiagnosis.editNote")}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            className="delete-note-icon-btn"
                            onClick={() => handleDeleteNote(note._id)}
                            title={t("earlyDiagnosis.deleteNote")}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>

                    {editingNoteId === note._id ? (
                      <div className="edit-note-form note-edit-form">
                        <textarea
                          className="note-textarea"
                          value={editingNoteText}
                          onChange={(e) => setEditingNoteText(e.target.value)}
                          rows={3}
                        />
                        <div className="note-actions">
                          <button
                            className="cancel-note-btn"
                            onClick={() => {
                              setEditingNoteId(null);
                              setEditingNoteText("");
                            }}
                            disabled={isSaving}
                          >
                            {t("earlyDiagnosis.cancel")}
                          </button>
                          <button
                            className="save-note-btn"
                            onClick={() => handleUpdateNote(note._id)}
                            disabled={isSaving || !editingNoteText.trim()}
                          >
                            {isSaving
                              ? t("earlyDiagnosis.saving")
                              : t("earlyDiagnosis.save")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="note-text">{note.note}</p>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="notes-empty">
                <p className="note-text">{t("earlyDiagnosis.noNotesAdded")}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default EDHistoryNotesTab;
