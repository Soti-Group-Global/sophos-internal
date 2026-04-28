import "../styles/Patients.css";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { getPatientsByDoctor, getEmailFromToken } from "../utils/api";
import { usePatient } from "../context/PatientContext";
import { useTranslation } from "react-i18next";
import { ToastContainer, toast } from "react-toastify";
import { FiSearch, FiDownload, FiUser } from "react-icons/fi";

const calculateAge = (dob) => {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

const Avatar = ({ name, email }) => {
  const initials = name
    ? name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : (email?.[0] || "?").toUpperCase();
  return (
    <div className="pt-avatar">
      {initials}
    </div>
  );
};

const Patients = () => {
  const navigate = useNavigate();
  const { setCurrentPatient } = usePatient();
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "ru" ? "ru" : "en";

  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const recordsPerPage = 20;
  const assistantEmail = getEmailFromToken();

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const fetchPatients = useCallback(async (search, page) => {
    if (!assistantEmail) return;
    try {
      setLoading(true);
      const data = await getPatientsByDoctor(assistantEmail, page, recordsPerPage, search);
      setPatients(data || []);
      setTotalRecords(data.length || 0);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [recordsPerPage]);

  useEffect(() => {
    fetchPatients(debouncedSearchTerm, currentPage);
  }, [debouncedSearchTerm, currentPage, fetchPatients]);

  const totalPages = Math.max(1, Math.ceil(totalRecords / recordsPerPage));
  const paginate = (p) => { if (p > 0 && p <= totalPages) setCurrentPage(p); };

  const exportToCSV = () => {
    if (patients.length === 0) { toast.info(t("patients.noDataToExport")); return; }
    const headers = ["First Name","Last Name","Email","Gender","Age","Date of Birth","Phone","Application ID","Service","Appt Date"];
    const rows = patients.map(p => [
      p.firstName||"", p.lastName||"", p.email||"", p.gender||"",
      calculateAge(p.dateOfBirth)||"",
      p.dateOfBirth ? new Date(p.dateOfBirth).toLocaleDateString("en-GB") : "",
      p.telephone||"", p.applicationId||"", p.serviceType||"",
      p.date||"",
    ]);
    const csv = [headers, ...rows].map(r => r.map(f => `"${String(f).replace(/"/g,'""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `patients_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    toast.success(t("patients.exportSuccess"));
  };

  const formatDate = (d) => {
    if (!d) return "—";
    try { return new Date(d).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { day: "2-digit", month: "short", year: "numeric" }); }
    catch { return d; }
  };

  const from = (currentPage - 1) * recordsPerPage + 1;
  const to   = Math.min(currentPage * recordsPerPage, totalRecords);

  return (
    <div className="pt-page">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Header */}
      <div className="pt-header">
        <div className="pt-header-left">
          <h1 className="pt-title">{t("patients.title", "Patients")}</h1>
          {!loading && <span className="pt-badge">{totalRecords}</span>}
        </div>
        <div className="pt-header-right">
          <div className="pt-search-wrap">
            <FiSearch className="pt-search-icon" />
            <input
              className="pt-search"
              type="text"
              placeholder={t("patients.searchPlaceholder", "Search by name or email...")}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          {patients.length > 0 && (
            <button className="pt-export-btn" onClick={exportToCSV}>
              <FiDownload size={15} />
              <span className="pt-export-btn-label">{t("patients.exportCSV", "Export as CSV")}</span>
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="pt-table-wrap">
        {loading ? (
          <div className="pt-empty">{t("patients.loading", "Loading...")}</div>
        ) : error ? (
          <div className="pt-empty pt-empty--error">{error}</div>
        ) : patients.length === 0 ? (
          <div className="pt-empty">{t("patients.noResults", "No patients found.")}</div>
        ) : (
          <table className="pt-table">
            <thead>
              <tr>
                <th>{t("patients.columns.patient", "Patient")}</th>
                <th>{t("patients.columns.contact", "Contact")}</th>
                <th>{t("patients.columns.dob", "Date of Birth")}</th>
                <th>{t("patients.columns.lastAppointment", "Last Appointment")}</th>
                <th>{t("patients.columns.service", "Service")}</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((patient, i) => {
                const fullName = [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(" ") || patient.email;
                const age = calculateAge(patient.dateOfBirth);
                return (
                  <tr
                    key={patient.email || i}
                    className="pt-row"
                    style={{ cursor: patient.applicationId ? "pointer" : "default" }}
                    onClick={() => {
                      if (patient.applicationId) {
                        navigate(`/appointments/${encodeURIComponent(patient.applicationId)}`);
                      }
                    }}
                  >
                    <td>
                      <div className="pt-patient-cell">
                        <Avatar name={fullName} email={patient.email} />
                        <div>
                          <div className="pt-patient-name">{fullName}</div>
                          <div className="pt-patient-email">{patient.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="pt-sub">{patient.telephone || "—"}</div>
                    </td>
                    <td>
                      <div>{formatDate(patient.dateOfBirth)}</div>
                      {age !== null && <div className="pt-sub">{age} {t("patients.yrs", "yrs")}</div>}
                    </td>
                    <td>
                      <div>{patient.date ? formatDate(patient.date) : "—"}</div>
                      {patient.applicationId && <div className="pt-sub">#{patient.applicationId}</div>}
                    </td>
                    <td>
                      {patient.serviceType
                        ? <span className="pt-service-badge">{t(`application.service_type.${patient.serviceType.toLowerCase().replace(/\s+/g, "_")}`, { defaultValue: patient.serviceType })}</span>
                        : <span className="pt-sub">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className="pt-footer">
        <span className="pt-results-count">
          {!loading && totalRecords > 0 && `Showing ${from}–${to} of ${totalRecords} patients`}
        </span>
        {totalPages > 1 && (
          <div className="pt-pagination">
            <button className="pt-page-btn" onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1}>â€¹</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p;
              if (totalPages <= 5) p = i + 1;
              else if (currentPage <= 3) p = i + 1;
              else if (currentPage >= totalPages - 2) p = totalPages - 4 + i;
              else p = currentPage - 2 + i;
              return (
                <button key={p} className={`pt-page-btn${currentPage === p ? " active" : ""}`} onClick={() => paginate(p)}>{p}</button>
              );
            })}
            <button className="pt-page-btn" onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages}>â€º</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Patients;

