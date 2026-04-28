import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getDoctorProfileById } from "../utils/api";
import DoctorProfileDetails from "./DoctorProfileDetails";

/**
 * Wrapper component to handle URL parameter-based doctor loading
 * Used when navigating directly to /doctors-profile/:id
 */
const DoctorProfileWrapper = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDoctor = async () => {
      try {
        setLoading(true);
        const response = await getDoctorProfileById(id);
        setDoctor(response.data);
      } catch (err) {
        setError(err.message || "Failed to load doctor profile");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchDoctor();
    }
  }, [id]);

  const handleClose = () => {
    navigate("/doctors-profile");
  };

  const handleSave = () => {
    // Refetch the doctor data after save
    const fetchDoctor = async () => {
      try {
        const response = await getDoctorProfileById(id);
        setDoctor(response.data);
      } catch (err) {
      }
    };
    fetchDoctor();
  };

  const handleDelete = () => {
    // Navigate back to list after deletion
    navigate("/doctors-profile");
  };

  if (loading) {
    return (
      <div className="doctor-profile-loading">
        <div className="spinner"></div>
        <p>Loading doctor profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="doctor-profile-error">
        <div className="error-content">
          <h3>Error Loading Doctor Profile</h3>
          <p>{error}</p>
          <button onClick={handleClose} className="btn btn-primary">
            Back to Doctors List
          </button>
        </div>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="doctor-profile-error">
        <div className="error-content">
          <h3>Doctor Not Found</h3>
          <p>The requested doctor profile could not be found.</p>
          <button onClick={handleClose} className="btn btn-primary">
            Back to Doctors List
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="doctor-profile-wrapper">
      <DoctorProfileDetails
        doctor={doctor}
        isEdit={true}
        onClose={handleClose}
        onSave={handleSave}
        onDelete={handleDelete}
        showDeleteButton={true}
      />
    </div>
  );
};

export default DoctorProfileWrapper;
