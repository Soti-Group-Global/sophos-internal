import { useTranslation } from "react-i18next";
import moment from "moment-timezone";

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

  const formatDob = (dob) => {
    if (!dob) return "";
    const d = new Date(dob);
    const month = t(`months.${d.getMonth()}`);
    const day = d.getDate();
    const year = d.getFullYear();
    return `${month} ${day}, ${year}`;
  };

  const formatAppointment = (patient) => {
    if (!patient.date) return t("common.notAvailable");
    const d = new Date(patient.date);
    const month = t(`months.${d.getMonth()}`);
    const day = d.getDate();
    const year = d.getFullYear();
    return `${month} ${day}, ${year}`;
  };

  const initials = (patient) => {
    const names = [patient.firstName, patient.middleName, patient.lastName]
      .filter(Boolean)
      .map((n) => n[0].toUpperCase());
    return names.slice(0, 2).join("");
  };

  const serviceBadgeClass = (serviceType) => {
    if (!serviceType) return "service-badge";
    const s = serviceType.toLowerCase();
    if (s.includes("telemedicine")) return "service-badge badge-telemedicine";
    if (s.includes("consultation")) return "service-badge badge-consultation";
    if (s.includes("follow")) return "service-badge badge-followup";
    if (s.includes("emergency")) return "service-badge badge-emergency";
    if (s.includes("lab") || s.includes("test")) return "service-badge badge-lab";
    return "service-badge badge-default";
  };

  return (
    <table className="patients-table">
      <thead>
        <tr>
          <th>{t("patients.table.patient")}</th>
          <th>{t("patients.table.contact")}</th>
          <th>{t("patients.table.dob")}</th>
          <th>{t("patients.table.lastAppointment")}</th>
          <th>{t("patients.table.service")}</th>
        </tr>
      </thead>
      <tbody>
        {patients.map((patient, index) => (
          <tr
            key={patient.email || index}
            className="clickable-row"
            onClick={() => {
              setCurrentPatient(patient);
              if (patient.applicationId) {
                navigate(`/appointments/${encodeURIComponent(patient.applicationId)}`, {
                  state: { appointmentId: patient.applicationId },
                });
              }
            }}
          >
            <td className="patient-cell">
              <div className="avatar">{initials(patient)}</div>
              <div className="info">
                <div className="name">
                  {patient.firstName} {patient.middleName} {patient.lastName}
                </div>
                <div className="email">{patient.email}</div>
              </div>
            </td>
            <td className="contact-cell">
              {patient.phone || patient.phoneNumber || "\u2014"}
            </td>
            <td className="dob-cell">
              {formatDob(patient.dateOfBirth)}
              {patient.dateOfBirth && (
                <div className="age-text">{calculateAge(patient.dateOfBirth)} yrs</div>
              )}
            </td>
            <td className="appointment-cell">
              {formatAppointment(patient)}
              {patient.applicationId && (
                <div className="app-id">#{patient.applicationId}</div>
              )}
            </td>
            <td>
              {patient.serviceType && (
                <span className={serviceBadgeClass(patient.serviceType)}>
                  {t(`serviceType.${patient.serviceType}`) || patient.serviceType}
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default PatientList;
