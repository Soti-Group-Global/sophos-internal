import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
  FiVideo,
  FiPhoneOff,
  FiRefreshCw,
  FiExternalLink,
  FiCopy,
  FiUsers,
  FiClock,
  FiCheckCircle,
  FiAlertCircle,
} from "react-icons/fi";
import {
  telemedicineCreateRoom,
  telemedicineJoinRoom,
  telemedicineEndRoom,
  telemedicineGetStatus,
} from "../../utils/api";
import "./TelemedicineTab.css";

const TelemedicineTab = ({ application, doctorsMap }) => {
  const { t, i18n } = useTranslation("telemedicine_tab");
  const lang = i18n.language?.slice(0, 2) || "ru";
  const applicationId = application?.applicationId;

  /* Resolve language-aware doctor name from profile schema */
  const resolveDoctorName = () => {
    const docEntry = application?.doctors?.[0];
    const docEmail = docEntry?.doctorEmail;
    const profile = docEmail && doctorsMap ? doctorsMap[docEmail] : null;
    const getField = (f) => {
      if (!f) return "";
      if (typeof f === "string") return f;
      if (typeof f === "object") return f[lang] || f.ru || f.en || Object.values(f).find(v => typeof v === "string") || "";
      return "";
    };
    if (profile) {
      const name = [profile.lastName, profile.firstName, profile.middleName]
        .map(getField).filter(Boolean).join(" ");
      if (name) return name;
    }
    return docEntry?.doctorName || docEntry?.doctorEmail || "—";
  };

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [roomStatus, setRoomStatus] = useState(null); // { isActive, roomId, meetingStatus, participantCount, startedAt }
  const [joinUrl, setJoinUrl] = useState(null);

  // ── Fetch room status ──
  const fetchStatus = useCallback(async () => {
    if (!applicationId) return;
    try {
      setLoading(true);
      const data = await telemedicineGetStatus(applicationId);
      setRoomStatus(data);
    } catch {
      setRoomStatus(null);
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Auto-refresh status every 15 seconds when room is active
  useEffect(() => {
    if (!roomStatus?.isActive) return;
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [roomStatus?.isActive, fetchStatus]);

  const ensureJoinUrl = useCallback(
    async ({ open = false, createIfMissing = true } = {}) => {
      if (!applicationId) return null;

      if (createIfMissing && !roomStatus?.isActive) {
        await telemedicineCreateRoom(applicationId);
        await fetchStatus();
      }

      const data = await telemedicineJoinRoom(applicationId);
      const nextJoinUrl = data?.joinUrl;

      if (!nextJoinUrl) {
        throw new Error(t("no_join_url"));
      }

      setJoinUrl(nextJoinUrl);

      if (open) {
        const meetingUrl = `${window.location.origin}/meeting-room?link=${encodeURIComponent(nextJoinUrl)}&role=${encodeURIComponent(data.role || "")}`;
        window.open(meetingUrl, "_blank", "noopener");
      }

      return nextJoinUrl;
    },
    [applicationId, roomStatus?.isActive, fetchStatus, t]
  );

  // ── Create room ──
  const handleCreate = async () => {
    setActionLoading(true);
    try {
      await telemedicineCreateRoom(applicationId);
      await fetchStatus();
      await ensureJoinUrl({ open: false, createIfMissing: false });
      toast.success(t("room_created"));
    } catch (err) {
      toast.error(err?.response?.data?.message || t("room_create_error"));
    } finally {
      setActionLoading(false);
    }
  };

  // ── Join room ──
  const handleJoin = async () => {
    setActionLoading(true);
    try {
      await ensureJoinUrl({ open: true, createIfMissing: true });
      await fetchStatus();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || t("join_error"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyLink = async () => {
    setActionLoading(true);
    try {
      const nextJoinUrl = joinUrl || (await ensureJoinUrl({ open: false, createIfMissing: true }));
      await navigator.clipboard.writeText(nextJoinUrl);
      toast.success(t("url_copied"));
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || t("join_error"));
    } finally {
      setActionLoading(false);
    }
  };

  // ── End room ──
  const handleEnd = async () => {
    if (!window.confirm(t("end_confirm"))) return;
    setActionLoading(true);
    try {
      await telemedicineEndRoom(applicationId);
      toast.success(t("room_ended"));
      setJoinUrl(null);
      await fetchStatus();
    } catch (err) {
      toast.error(err?.response?.data?.message || t("end_error"));
    } finally {
      setActionLoading(false);
    }
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className="tmt-container">
        <div className="tmt-loading">
          <FiRefreshCw size={20} className="tmt-spin" />
          <span>{t("loading")}</span>
        </div>
      </div>
    );
  }

  const isActive = roomStatus?.isActive;
  const meetingStatus = roomStatus?.meetingStatus || "scheduled";
  const participantCount = roomStatus?.participantCount || 0;
  const startedAt = roomStatus?.startedAt;

  return (
    <div className="tmt-container">
      {/* ── Status Card ── */}
      <div className="tmt-card">
        <div className="tmt-card-header">
          <FiVideo size={18} className="tmt-header-icon" />
          <h3 className="tmt-card-title">{t("title")}</h3>
          <button
            className="tmt-refresh-btn"
            onClick={fetchStatus}
            disabled={actionLoading}
            title={t("refresh")}
          >
            <FiRefreshCw size={14} />
          </button>
        </div>

        {/* Status indicator */}
        <div className="tmt-status-section">
          <div className={`tmt-status-badge tmt-status-badge--${isActive ? "active" : meetingStatus}`}>
            {isActive ? (
              <>
                <FiCheckCircle size={13} />
                <span>{t("status_active")}</span>
              </>
            ) : meetingStatus === "ended" ? (
              <>
                <FiAlertCircle size={13} />
                <span>{t("status_ended")}</span>
              </>
            ) : (
              <>
                <FiClock size={13} />
                <span>{t("status_scheduled")}</span>
              </>
            )}
          </div>

          {isActive && (
            <div className="tmt-meta-row">
              <span className="tmt-meta-item">
                <FiUsers size={13} />
                {t("participants", { count: participantCount })}
              </span>
              {startedAt && (
                <span className="tmt-meta-item">
                  <FiClock size={13} />
                  {t("started_at", {
                    time: new Date(startedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                  })}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Appointment info */}
        <div className="tmt-info-grid">
          <div className="tmt-info-item">
            <span className="tmt-info-label">{t("appointment_id")}</span>
            <span className="tmt-info-value">#{applicationId}</span>
          </div>
          <div className="tmt-info-item">
            <span className="tmt-info-label">{t("patient")}</span>
            <span className="tmt-info-value">{application?.patientEmail || "—"}</span>
          </div>
          <div className="tmt-info-item">
            <span className="tmt-info-label">{t("doctor")}</span>
            <span className="tmt-info-value">{resolveDoctorName()}</span>
          </div>
          <div className="tmt-info-item">
            <span className="tmt-info-label">{t("date_time")}</span>
            <span className="tmt-info-value">
              {application?.date || "—"} &nbsp;·&nbsp; {application?.startTime || ""} – {application?.endTime || ""}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="tmt-actions">
          {!isActive && (
            <button
              className="tmt-btn tmt-btn--primary"
              onClick={handleCreate}
              disabled={actionLoading}
            >
              <FiVideo size={15} />
              {actionLoading
                ? t("creating")
                : meetingStatus === "ended"
                  ? t("restart_room")
                  : (t("create_room") || "Create Meeting")}
            </button>
          )}

          <button
            className="tmt-btn tmt-btn--secondary"
            onClick={handleCopyLink}
            disabled={actionLoading}
          >
            <FiCopy size={15} />
            {t("copy_link")}
          </button>

          {isActive && (
            <button
              className="tmt-btn tmt-btn--join"
              onClick={handleJoin}
              disabled={actionLoading}
            >
              <FiExternalLink size={15} />
              {actionLoading ? t("joining") : t("join_meeting")}
            </button>
          )}

          {isActive && (
            <button
              className="tmt-btn tmt-btn--danger"
              onClick={handleEnd}
              disabled={actionLoading}
            >
              <FiPhoneOff size={15} />
              {t("end_meeting")}
            </button>
          )}
        </div>

        {/* Copy join URL hint */}
        {joinUrl && (
          <div className="tmt-join-url-row">
            <div className="tmt-join-url-info">
              <span className="tmt-join-url-label">{t("join_url_label")}</span>
              <input
                className="tmt-join-url-input"
                value={joinUrl}
                readOnly
                onFocus={(e) => e.target.select()}
              />
            </div>
            <button
              className="tmt-copy-btn"
              onClick={handleCopyLink}
            >
              {t("copy_link")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TelemedicineTab;
