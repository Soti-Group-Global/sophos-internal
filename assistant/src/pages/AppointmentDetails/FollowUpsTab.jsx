import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiSave, FiCalendar, FiExternalLink, FiCheckCircle } from "react-icons/fi";
import { LuCalendarClock } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { saveFollowUp, getApplication } from "../../utils/api";
import { toast } from "react-toastify";
import "./FollowUpsTab.css";

const FollowUpsTab = ({ application, onApplicationUpdate }) => {
  const { t } = useTranslation("appointment_details_page");
  const navigate = useNavigate();
  const followUp = application?.followUp;

  const [needed, setNeeded] = useState(false);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!comment.trim()) return;
    setSaving(true);
    try {
      await saveFollowUp(application.applicationId, {
        needed: true,
        comment: comment.trim(),
        booked: false,
      });
      toast.success(t("followups_tab.save_success"));
      setComment("");
      setNeeded(false);
      if (onApplicationUpdate) {
        const refreshed = await getApplication(application.applicationId);
        onApplicationUpdate(refreshed?.data);
      }
    } catch (err) {
      toast.error(`${t("followups_tab.save_failed")}: ${err.response?.data?.message || err.message}`);
    } finally {
      setSaving(false);
    }
  };

  /* ── Already has a follow-up ── */
  if (followUp?.needed) {
    return (
      <div className="fut-container">
        <div className="fut-card fut-card--summary">
          <div className="fut-summary-header">
            <FiCheckCircle size={16} className="fut-summary-icon" />
            <span className="fut-summary-title">{t("followups_tab.recorded_title")}</span>
          </div>

          <div className="fut-summary-row">
            <span className="fut-summary-label">{t("followups_tab.label_comment")}</span>
            <span className="fut-summary-value">{followUp.comment || "—"}</span>
          </div>

          <div className="fut-summary-row">
            <span className="fut-summary-label">{t("followups_tab.label_booked")}</span>
            <span className={`fut-booked-badge fut-booked-badge--${followUp.booked ? "yes" : "no"}`}>
              {followUp.booked ? t("followups_tab.booked_yes") : t("followups_tab.booked_no")}
            </span>
          </div>

          {followUp.booked && followUp.applicationId && (
            <div className="fut-summary-row">
              <span className="fut-summary-label">{t("followups_tab.label_appointment")}</span>
              <button
                className="fut-link-btn"
                onClick={() =>
                  navigate(`/appointments/${encodeURIComponent(followUp.applicationId)}?tab=general`)
                }
              >
                <FiExternalLink size={13} />
                #{followUp.applicationId}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── No follow-up yet ── */
  return (
    <div className="fut-container">
      {!needed ? (
        <div className="fut-empty">
          <LuCalendarClock size={42} className="fut-empty-icon" />
          <p className="fut-empty-title">{t("followups_tab.empty_title")}</p>
          <p className="fut-empty-text">{t("followups_tab.empty_text")}</p>
          <button className="fut-require-btn" onClick={() => setNeeded(true)}>
            <FiCalendar size={14} />
            {t("followups_tab.require_btn")}
          </button>
        </div>
      ) : (
        <div className="fut-card">
          <p className="fut-card-heading">{t("followups_tab.form_heading")}</p>
          <textarea
            className="fut-textarea"
            rows={4}
            placeholder={t("followups_tab.placeholder")}
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
              {t("followups_tab.cancel")}
            </button>
            <button
              className="fut-btn fut-btn--save"
              onClick={handleSave}
              disabled={!comment.trim() || saving}
            >
              <FiSave size={13} />
              {saving ? t("followups_tab.saving") : t("followups_tab.save")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FollowUpsTab;
