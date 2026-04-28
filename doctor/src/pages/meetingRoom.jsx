import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FiArrowLeft,
  FiExternalLink,
  FiCopy,
  FiRefreshCw,
} from "react-icons/fi";
import "../styles/meetingRoom.css";

const MeetingRoom = () => {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const link = params.get("link");
  const role = params.get("role") || "";
  const titleParam = params.get("title");
  const [frameKey, setFrameKey] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setLoadError(false);
  }, [link, frameKey]);

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  const handleOpenNewTab = () => {
    if (!link) return;
    window.open(link, "_blank", "noopener,noreferrer");
  };

  const handleRefresh = () => {
    setFrameKey(Date.now());
  };

  if (!link) {
    return (
      <div className="meeting-room-empty">
        <h3>{t("meeting_room.missing_title") || "Meeting link is missing"}</h3>
        <p>
          {t("meeting_room.missing_desc") ||
            "Please return and generate a meeting link first."}
        </p>
      </div>
    );
  }

  return (
    <div className="meeting-shell">


      <div className="meeting-frame-wrapper">
        <div className="meeting-frame-card">
          {(loading || loadError) && (
            <div className="meeting-loading">
              {loadError
                ? t("meeting_room.load_error") ||
                  "Failed to load meeting. Try refresh or open in new tab."
                : t("meeting_room.connecting") ||
                  "Connecting to the meeting..."}
            </div>
          )}
          <iframe
            key={frameKey}
            title="Meeting"
            src={link}
            allow="camera; microphone; fullscreen; display-capture"
            allowFullScreen
            onLoad={() => {
              setLoading(false);
              setLoadError(false);
            }}
            onError={() => {
              setLoading(false);
              setLoadError(true);
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default MeetingRoom;
