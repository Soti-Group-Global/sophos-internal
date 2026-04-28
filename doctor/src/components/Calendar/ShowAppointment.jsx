import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDateISO, formatTimeHHMM } from "../../utils/dateFormat";

const ShowAppointment = ({ selectedEvent, onRescheduleRequest }) => {
  const { t } = useTranslation();
  const appointment = selectedEvent?.extendedProps;
  const [showRescheduleBox, setShowRescheduleBox] = useState(false);
  const [reason, setReason] = useState("");

  const handleSend = () => {
    if (!reason.trim()) {
      alert(t("showAppointment.alertPleaseEnterReason"));
      return;
    }
    // Call parent handler or API
    onRescheduleRequest(selectedEvent, reason);
    setShowRescheduleBox(false);
    setReason("");
  };

  if (!appointment) return null;

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-4">{t("showAppointment.title")}</h3>
      
      <div className="space-y-2 mb-4">
        <p><strong>{t("showAppointment.patient")}:</strong> {appointment.patient}</p>
        <p><strong>{t("showAppointment.service")}:</strong> {appointment.serviceType}</p>
        <p>
          <strong>{t("showAppointment.date")}:</strong> {formatDateISO(appointment.date)}
        </p>
        <p>
          <strong>{t("showAppointment.time")}:</strong> {`${formatTimeHHMM(appointment.startTime)} - ${formatTimeHHMM(appointment.endTime)}`}
        </p>
        <p><strong>{t("showAppointment.status")}:</strong> {appointment.appointmentStatus}</p>
        {appointment.notes && <p><strong>{t("showAppointment.notes")}:</strong> {appointment.notes}</p>}
      </div>

      {!showRescheduleBox ? (
        <button
          style={{
            padding: "6px 12px",
            background: "rgba(10, 46, 93, 0.1)",
            color: "#0A2E5D",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
          onClick={() => setShowRescheduleBox(true)}
        >
          {t("showAppointment.requestReschedule")}
        </button>
      ) : (
        <div className="space-y-2">
          <textarea
            rows="3"
            placeholder={t("showAppointment.enterReasonPlaceholder")}
            style={{ width: "100%", padding: "4px", border: "1px solid #ccc", borderRadius: "4px" }}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              style={{
                padding: "6px 12px",
                background: "#4caf50",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer"
              }}
              onClick={handleSend}
            >
              {t("showAppointment.sendRequest")}
            </button>
            <button
              style={{
                padding: "6px 12px",
                background: "#f44336",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer"
              }}
              onClick={() => {
                setShowRescheduleBox(false);
                setReason("");
              }}
            >
              {t("showAppointment.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShowAppointment;