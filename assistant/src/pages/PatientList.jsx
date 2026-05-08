import { useTranslation } from "react-i18next";

const PatientList = ({ patients, loading, error, navigate, setCurrentPatient }) => {
  const { t } = useTranslation();

  const calculateAge = (dob) => {
    if (!dob) return "";
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  if (loading) return <p>{t("patients.loading")}</p>;
  if (error) return <p>{t("patients.error", { message: error })}</p>;
  if (patients.length === 0) return <p>{t("patients.noResults")}</p>;

  return (
    <div className="patients-grid">
      {patients.map((patient, index) => (
        <div
          key={patient.email || index}
          className="patient-card"
          style={{ cursor: "pointer" }}
          onClick={() => {
            setCurrentPatient(patient);
            navigate(`/patients/${patient.email}`, {
              state: { appointmentId: patient.applicationId || null },
            });
          }}
        >
          <div className="patient-card-header">
            <div className="patient-info">
              <div className="patient-name">
                {patient.firstName} {patient.middleName} {patient.lastName}
              </div>
              <div>{t("patients.applicationId")}: {patient.applicationId || "N/A"}</div>
            </div>
            <div className="patient-icon-container">
              <div className="patient-icon">
                {patient.gender?.toLowerCase() === "male" ? "\u2642" : "\u2640"}
              </div>
              <span className={`patient-age ${patient.gender?.toLowerCase() === "male" ? "male" : "female"}`}>
                {calculateAge(patient.dateOfBirth)}
              </span>
            </div>
          </div>

          <div className="patient-card-body">
            {patient.serviceType ? (
              <div className="appointment-wrapper">
                <div className="service-info">
                  <div className="appointment-label">{t("patients.service")}</div>
                  <div className="service-value">{patient.serviceType}</div>
                </div>
                <div className="appointment-info">
                  <div className="appointment-row">
                    <div className="appointment-item">
                      <div className="appointment-label">{t("patients.appointmentDate")}</div>
                      <div className="appointment-value">{patient.date || "N/A"}</div>
                    </div>
                    <div className="appointment-item">
                      <div className="appointment-label">{t("patients.time")}</div>
                      <div className="appointment-value">
                        {new Date(patient.startTime).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })} - {new Date(patient.endTime).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="no-appointments">{t("patients.noAppointments")}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default PatientList;
