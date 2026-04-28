import React from "react";

const AppointmentPDFTemplate = ({ appointment, patient }) => {
  if (!appointment) return null;

  const {
    date,
    startTime,
    endTime,
    serviceType,
    appointmentMode,
    meetingLink,
    prescription,
    conclusion,
    appointmentStatus,
    doctor,
    location,
  } = appointment;

  return (
    <div
      id="appointment-pdf-content"
      style={{
        position: "absolute",
        top: "-9999px",
        left: "-9999px",
        width: "210mm",   // A4 width
        padding: "20px",
        fontFamily: "Arial",
        background: "#fff"  // important for PDF background
      }}
      
    >
      <h1 style={{ textAlign: "center" }}>Appointment Summary</h1>

      <h2>Patient Information</h2>
      <p><strong>Name:</strong> {patient?.name || "Not specified"}</p>
      <p><strong>Email:</strong> {patient?.email || "Not specified"}</p>
      <p><strong>Phone:</strong> {patient?.phone || "Not specified"}</p>

      <h2>Appointment Details</h2>
      <p><strong>Date:</strong> {date || "Not specified"}</p>
      <p><strong>Time:</strong> {startTime || "--"} - {endTime || "--"}</p>
      <p><strong>Service Type:</strong> {serviceType || "Not specified"}</p>
      <p><strong>Mode:</strong> {appointmentMode || "Not specified"}</p>
      <p><strong>Doctor:</strong> {doctor?.email || "Not specified"}</p>
      <p><strong>Status:</strong> {appointmentStatus || "Not specified"}</p>

      <h2>Prescription</h2>
      <p>{prescription.text || "No prescription added"}</p>

      <h2>Conclusion</h2>
      <p>{conclusion.text || "No conclusion added"}</p>
    </div>
  );
};

export default AppointmentPDFTemplate;
