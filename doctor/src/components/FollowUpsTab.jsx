import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiSave, FiCalendar, FiExternalLink, FiCheckCircle } from "react-icons/fi";
import { LuCalendarClock } from "react-icons/lu";
import { saveFollowUp, getApplication } from "../utils/api";
import { toast } from "react-toastify";
import "./FollowUpsTab.css";

const FollowUpsTab = ({ application, onApplicationUpdate }) => {
  const navigate = useNavigate();
  const { t } = useTranslation("followups_tab");
  const followUp = application?.followUp;

  const [needed, setNeeded] = useState(false);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedFollowUp, setSavedFollowUp] = useState(null);

  const displayFollowUp = savedFollowUp || followUp;

  const handleSave = async () => {
    if (!comment.trim()) return;
    setSaving(true);
    const followUpData = { needed: true, comment: comment.trim(), booked: false };
    setSavedFollowUp(followUpData);
    setComment("");
    setNeeded(false);
    try {
      await saveFollowUp(application.applicationId, followUpData);
      toast.success(t("toast_saved", { defaultValue: "Follow-up saved" }));
      if (onApplicationUpdate) {
        const refreshed = await getApplication(application.applicationId);
        onApplicationUpdate(refreshed?.data);
      }
    } catch (err) {
      setSavedFollowUp(null);
      toast.error(t("toast_error", { defaultValue: "Failed to save follow-up" }));
    } finally {
      setSaving(false);
    }
  };

  if (displayFollowUp?.needed) {
    return (
      <div className="fut-container">
        <div className="fut-card fut-card--summary">
          <div className="fut-summary-header">
            <FiCheckCircle size={16} className="fut-summary-icon" />
            <span className="fut-summary-title">{t("recorded_title", { defaultValue: "Follow-up Recorded" })}</span>
          </div>

          <div className="fut-summary-row">
            <span className="fut-summary-label">{t("label_comment", { defaultValue: "Comment" })}</span>
            <span className="fut-summary-value">{displayFollowUp.comment || "—"}</span>
          </div>

          <div className="fut-summary-row">
            <span className="fut-summary-label">{t("label_booked", { defaultValue: "Booked" })}</span>
            <span className={`fut-booked-badge fut-booked-badge--${displayFollowUp.booked ? "yes" : "no"}`}>
              {displayFollowUp.booked
                ? t("booked_yes", { defaultValue: "Yes" })
                : t("booked_no", { defaultValue: "Not yet" })}
            </span>
          </div>

          {displayFollowUp.booked && displayFollowUp.applicationId && (
            <div className="fut-summary-row">
              <span className="fut-summary-label">{t("label_appointment", { defaultValue: "Appointment" })}</span>
              <button
                className="fut-link-btn"
                onClick={() =>
                  navigate(`/appointments/${encodeURIComponent(displayFollowUp.applicationId)}`)
                }
              >
                <FiExternalLink size={13} />
                #{displayFollowUp.applicationId}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fut-container">
      {!needed ? (
        <div className="fut-empty">
          <LuCalendarClock size={42} className="fut-empty-icon" />
          <p className="fut-empty-title">{t("empty_title", { defaultValue: "No follow-up recorded" })}</p>
          <p className="fut-empty-text">{t("empty_text", { defaultValue: "Record a follow-up appointment requirement for this patient." })}</p>
          <button className="fut-require-btn" onClick={() => setNeeded(true)}>
            <FiCalendar size={14} />
            {t("btn_require", { defaultValue: "Require Follow-Up" })}
          </button>
        </div>
      ) : (
        <div className="fut-card">
          <p className="fut-card-heading">{t("card_heading", { defaultValue: "Record follow-up details" })}</p>
          <textarea
            className="fut-textarea"
            rows={4}
            placeholder={t("textarea_placeholder", { defaultValue: "Enter follow-up notes or instructions…" })}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            autoFocus
          />
          <div className="fut-actions">
            <button
              className="fut-btn fut-btn--cancel"
              onClick={() => { setNeeded(false); setComment(""); }}
              disabled={saving}
            >
              {t("btn_cancel", { defaultValue: "Cancel" })}
            </button>
            <button
              className="fut-btn fut-btn--save"
              onClick={handleSave}
              disabled={!comment.trim() || saving}
            >
              <FiSave size={13} />
              {saving ? t("btn_saving", { defaultValue: "Saving…" }) : t("btn_save", { defaultValue: "Save" })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FollowUpsTab;
