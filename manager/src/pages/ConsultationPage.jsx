import React from "react";
import { useParams, useSearchParams } from "react-router-dom";
import VideoConsultation from "./VideoConsultation";

export default function ConsultationPage({ currentUser }) {
  const { id } = useParams(); // appointment ID
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  // Optional extra info passed via query params (if needed later)
  const doctorName = searchParams.get("doctor");
  const patientName = searchParams.get("patient");
  const roomName = id || searchParams.get("room");

  return (
    <div className="consultation-page" style={styles.page}>
      <div style={styles.header}>
        <h2 style={styles.title}>🩺 Live Consultation</h2>
        <p style={styles.subtitle}>
          Room: <strong>{roomName}</strong>
        </p>
        <p style={styles.info}>
          Doctor: {doctorName || "Unknown"} | Patient:{" "}
          {patientName || currentUser?.name || "Guest"}
        </p>
      </div>

      {/* 🔹 Video Area */}
      <div style={styles.videoContainer}>
        {token ? (
          <VideoConsultation
            user={currentUser}
            token={token}
            roomName={roomName}
          />
        ) : (
          <div style={styles.noToken}>
            <p>🔒 Missing meeting token.</p>
            <p>Please go back and click “Join Now” again.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// 💅 Inline styles (or move to CSS)
const styles = {
  page: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "20px",
    backgroundColor: "#f8fafc",
    height: "100vh",
    overflow: "hidden",
  },
  header: {
    textAlign: "center",
    marginBottom: "20px",
  },
  title: {
    color: "#0f172a",
    fontSize: "28px",
    marginBottom: "8px",
  },
  subtitle: {
    color: "#475569",
    fontSize: "16px",
  },
  info: {
    color: "#64748b",
    fontSize: "15px",
  },
  videoContainer: {
    background: "#1e293b",
    borderRadius: "12px",
    padding: "10px",
    width: "80%",
    maxWidth: "1000px",
    minHeight: "500px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  noToken: {
    textAlign: "center",
    color: "#facc15",
    backgroundColor: "#1e293b",
    padding: "20px",
    borderRadius: "8px",
  },
};
