import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import DoctorsList from "./DoctorsList";
import DoctorsGrid from "./DoctorsGrid";
import { getDoctors } from "../utils/api";
import "../styles/Shared.css";

function Doctors() {
  const { t } = useTranslation("doctors");
  const [currentView, setCurrentView] = useState("list");
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const response = await getDoctors();

      setDoctors(Array.isArray(response.doctors) ? response.doctors : []);
      setLoading(false);
    } catch (err) {
       // Add this for debugging
      setError(t("error_fetch"));
      toast.error(t("error_fetch"));
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, [t]);

  const handleViewChange = (view) => {
    setCurrentView(view);
  };

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div>
      {currentView === "list" ? (
        <DoctorsList
          doctors={doctors}
          onViewChange={handleViewChange}
          currentView={currentView}
          refetchDoctors={fetchDoctors}
        />
      ) : (
        <DoctorsGrid
          doctors={doctors}
          onViewChange={handleViewChange}
          currentView={currentView}
          refetchDoctors={fetchDoctors}
        />
      )}
    </div>
  );
}

export default Doctors;
