import "../styles/Patients.css";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback, useRef } from "react";
import { getDoctor, getPatientsByDoctor } from "../utils/api";
import { usePatient } from "../context/PatientContext";
import PatientList from "./PatientList";
import { useTranslation } from "react-i18next";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { formatDateISO, formatTimeHHMM } from "../utils/dateFormat";

const Patients = () => {
  const navigate = useNavigate();
  const { setCurrentPatient } = usePatient();

  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const recordsPerPage = 20;
  const { t } = useTranslation();

  const doctorEmailRef = useRef("");

  // Fetch doctor email ONCE and trigger initial fetch
  useEffect(() => {
    const loadDoctorEmail = async () => {
      try {
        const doctorResponse = await getDoctor();
        doctorEmailRef.current = doctorResponse.data.doctor.email;
        fetchPatients("", 1); // Initial fetch
      } catch (err) {
        console.error("Failed to get doctor email:", err);
        setError(t("patients.failedLoadDoctorInfo"));
        setLoading(false);
      }
    };
    loadDoctorEmail();
  }, []);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Reset page when search changes
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const fetchPatients = useCallback(
    async (search, page) => {
      if (!doctorEmailRef.current) return;
      try {
        setLoading(true);
        const data = await getPatientsByDoctor(
          doctorEmailRef.current,
          page,
          recordsPerPage,
          search,
        );
        const patientList = Array.isArray(data) ? data : data?.patients ?? [];
        setPatients(patientList);
        setTotalRecords(patientList.length);
      } catch (err) {
        setError(err.message || t("patients.somethingWentWrong"));
      } finally {
        setLoading(false);
      }
    },
    [recordsPerPage],
  );

  // Fetch when debounced search or page changes
  useEffect(() => {
    fetchPatients(debouncedSearchTerm, currentPage);
  }, [debouncedSearchTerm, currentPage, fetchPatients]);

  // Function to export patients data as CSV
  const exportToCSV = () => {
    if (patients.length === 0) {
      toast.info(t("patients.noDataToExport"));
      return;
    }

    // Prepare CSV content
    // CSV should mirror the table columns
    const headers = [
      t("patients.table.patient"),
      t("patients.table.contact"),
      t("patients.table.dob"),
      t("patients.table.appointment"),
      t("patients.table.service"),
    ];

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

    const formatTimeForCSV = (timeStr) => {
      const formatted = formatTimeHHMM(timeStr);
      return formatted || t("common.notAvailable");
    };

    const formatDateForCSV = (dateStr) => {
      const formatted = formatDateISO(dateStr);
      return formatted || t("common.notAvailable");
    };

    const rows = patients.map((patient) => [
      `${patient.firstName || ""} ${patient.middleName || ""} ${patient.lastName || ""}`.trim(),
      patient.email || "",
      patient.dateOfBirth ? formatDateForCSV(patient.dateOfBirth) : "",
      `${patient.date ? formatDateForCSV(patient.date) : t("common.notAvailable")} ${
        patient.startTime && patient.endTime
          ? `${formatTimeForCSV(patient.startTime)}-${formatTimeForCSV(patient.endTime)}`
          : ""
      }`.trim(),
      patient.serviceType || "",
    ]);

    // Create CSV content
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    // Create download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `patients_export_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(t("patients.exportSuccess"));
  };

  const totalPages = Math.max(1, Math.ceil(totalRecords / recordsPerPage));

  const paginate = (pageNum) => {
    if (pageNum > 0 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
    }
  };

  return (
    <div className="patients-grid-container">
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="patients-header">
        <div className="patient-title-container">
          <h2 className="patient-page-title">{t("patients.title")}</h2>
          {totalRecords > 0 && (
            <span className="patients-count-badge">{totalRecords}</span>
          )}
        </div>
        <div className="patients-header-controlers">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t("patients.searchPlaceholder")}
            className="search-input"
          />
          <button
            className="exportcsv"
            onClick={exportToCSV}
          >
            <svg
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            {t("patients.exportCSV")}
          </button>
        </div>
      </div>

      <PatientList
        patients={patients}
        loading={loading}
        error={error}
        navigate={navigate}
        setCurrentPatient={setCurrentPatient}
      />

      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => paginate(currentPage - 1)}
            disabled={currentPage === 1}
          >
            {t("patients.pagination.previous")}
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }
            return (
              <button
                key={pageNum}
                onClick={() => paginate(pageNum)}
                className={currentPage === pageNum ? "active" : ""}
              >
                {pageNum}
              </button>
            );
          })}
          <button
            onClick={() => paginate(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            {t("patients.pagination.next")}
          </button>
        </div>
      )}

      <div className="results-count">
        {t("patients.showingResults", {
          start: (currentPage - 1) * recordsPerPage + 1,
          end: Math.min(currentPage * recordsPerPage, totalRecords),
          total: totalRecords,
        })}
      </div>
    </div>
  );
};

export default Patients;
