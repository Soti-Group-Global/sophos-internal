import React, { useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { toast } from "react-toastify";

export default function ScheduleConsultation() {
  const [doctorEmail, setDoctorEmail] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());

  const handleSchedule = async () => {
    try {
      const res = await fetch("http://localhost:3003/api/meeting/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctorEmail, patientEmail, startTime, endTime }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success("Meeting scheduled successfully!");
      } else {
        toast.error("Failed to schedule meeting");
      }
    } catch (err) {
      toast.error("Server error");
    }
  };

  return (
    <div className="schedule-container">
      <h2>Schedule Consultation</h2>

      <label>Doctor Email</label>
      <input
        type="email"
        value={doctorEmail}
        onChange={(e) => setDoctorEmail(e.target.value)}
        placeholder="doctor@example.com"
      />

      <label>Patient Email</label>
      <input
        type="email"
        value={patientEmail}
        onChange={(e) => setPatientEmail(e.target.value)}
        placeholder="patient@example.com"
      />

      <label>Start Time</label>
      <DatePicker
        selected={startTime}
        onChange={(d) => setStartTime(d)}
        showTimeSelect
        dateFormat="Pp"
      />

      <label>End Time</label>
      <DatePicker
        selected={endTime}
        onChange={(d) => setEndTime(d)}
        showTimeSelect
        dateFormat="Pp"
      />

      <button onClick={handleSchedule}>Create & Log Invite</button>
    </div>
  );
}
