import React, { useState } from "react";
import { useTranslation } from "react-i18next";

const ShowAppointment = ({ selectedEvent, onRescheduleRequest }) => {
  const appointment = selectedEvent?.extendedProps;
  const [showRescheduleBox, setShowRescheduleBox] = useState(false);
  const [reason, setReason] = useState("");
  const { t } = useTranslation();

  const handleSend = () => {
    if (!reason.trim()) {
      alert(t('appointmentDetails.reasonRequired'));
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
      <h3 className="text-lg font-medium mb-4">{t('appointmentDetails.title')}</h3>
      
      <div className="space-y-2 mb-4">
        <p><strong>{t('appointmentDetails.patient')}:</strong> {appointment.patient}</p>
        <p><strong>{t('appointmentDetails.service')}:</strong> {appointment.serviceType}</p>
        <p><strong>{t('appointmentDetails.date')}:</strong> {appointment.date}</p>
        <p><strong>{t('appointmentDetails.time')}:</strong> {appointment.startTime} - {appointment.endTime}</p>
        <p><strong>{t('appointmentDetails.status')}:</strong> {appointment.appointmentStatus}</p>
        {appointment.notes && <p><strong>{t('appointmentDetails.notes')}:</strong> {appointment.notes}</p>}
      </div>

      {!showRescheduleBox ? (
        <button
          style={{
            padding: "6px 12px",
            background: "#2196f3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
          onClick={() => setShowRescheduleBox(true)}
        >
          {t('appointmentDetails.requestReschedule')}
        </button>
      ) : (
        <div className="space-y-2">
          <textarea
            rows="3"
            placeholder={t('appointmentDetails.enterReason')}
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
              {t('appointmentDetails.sendRequest')}
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
              {t('appointmentDetails.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShowAppointment;