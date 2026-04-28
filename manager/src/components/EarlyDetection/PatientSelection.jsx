import React, { useState, useEffect } from "react";
import {
  getPatients as getAllPatients,
  addPatient as createPatient,
} from "../../utils/api";
import { useTranslation } from "react-i18next";

const PatientSelection = ({ formData = {}, updateFormData, nextStep }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("select");
  const [searchTerm, setSearchTerm] = useState("");
  const [patients, setPatients] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const [newPatient, setNewPatient] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    countryCode: "+7",
    gender: "Male",
    dateOfBirth: "",
  });

  const { t } = useTranslation();

  useEffect(() => {
    if (isModalOpen) {
      fetchPatients();
    }
  }, [isModalOpen]);

  const fetchPatients = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const patientsData = await getAllPatients();
      const patientsArray = patientsData?.data?.patients || [];
      setPatients(patientsArray);
    } catch (err) {
      setError(t("patient_selection.messages.load_error"));
      setPatients([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPatients = Array.isArray(patients)
    ? patients.filter((patient) => {
        const patientName = `${patient.firstName || ""} ${
          patient.lastName || ""
        }`
          .trim()
          .toLowerCase();
        const lowerSearch = searchTerm.toLowerCase();
        return (
          patientName.includes(lowerSearch) ||
          (patient.email || "").toLowerCase().includes(lowerSearch) ||
          (patient.phoneNumber || "").includes(searchTerm)
        );
      })
    : [];

  const handleSelectPatient = (patient) => {
    updateFormData({ patient });
    nextStep();
  };

  const handleCreatePatient = async () => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const patientData = {
        firstName: newPatient.firstName,
        middleName: newPatient.middleName,
        lastName: newPatient.lastName,
        email: newPatient.email,
        phoneNumber: `${newPatient.countryCode} ${newPatient.phoneNumber}`,
        gender: newPatient.gender,
        dateOfBirth: newPatient.dateOfBirth,
      };

      const createdPatient = await createPatient(patientData);

      setSuccessMessage(t("patient_selection.messages.patient_created"));

      setTimeout(() => {
        updateFormData({
          patient: {
            id: createdPatient.id,
            name: createdPatient.name,
            email: createdPatient.email,
          },
        });
        setIsModalOpen(false);
        nextStep();
      }, 1500);
    } catch (err) {
      setError(err.message || t("patient_selection.messages.create_error"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewPatient((prev) => ({ ...prev, [name]: value }));
  };

  const clearMessages = () => {
    setError(null);
    setSuccessMessage(null);
  };

  return (
    <div className="step-container">
      <h2>{t("patient_selection.title")}</h2>

      {formData?.patient ? (
        <div className="selected-patient">
          <h3>{t("patient_selection.selected_patient")}</h3>
          <div className="early-patient-card">
            <div className="early-patient-name">{formData.patient.name}</div>
            <div className="patient-email">{formData.patient.email}</div>
            <button
              className="change-patient-btn"
              onClick={() => setIsModalOpen(true)}
            >
              {t("patient_selection.change_patient")}
            </button>
          </div>
          <button className="next-btn" onClick={nextStep}>
            {t("patient_selection.continue_to_questions")}
          </button>
        </div>
      ) : (
        <div className="select-patient-initial">
          <button
            className="select-patient-btn"
            onClick={() => setIsModalOpen(true)}
          >
            {t("patient_selection.select_patient")}
          </button>
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <button
              className="close-button"
              onClick={() => {
                setIsModalOpen(false);
                clearMessages();
              }}
              disabled={isLoading}
            >
              ×
            </button>

            <div className="modal-tabs">
              <button
                className={activeTab === "select" ? "tab active" : "tab"}
                onClick={() => {
                  setActiveTab("select");
                  clearMessages();
                }}
                disabled={isLoading}
              >
                {t("patient_selection.select_patient")}
              </button>
              <button
                className={activeTab === "create" ? "tab active" : "tab"}
                onClick={() => {
                  setActiveTab("create");
                  clearMessages();
                }}
                disabled={isLoading}
              >
                {t("patient_selection.create_patient")}
              </button>
            </div>

            {error && (
              <div className="error-message">
                {error}
                <button onClick={() => setError(null)}>
                  {t("patient_selection.buttons.dismiss")}
                </button>
              </div>
            )}

            {successMessage && (
              <div className="success-message">{successMessage}</div>
            )}

            {isLoading && (
              <div className="loading-overlay">
                <div className="spinner"></div>
                <p>{t("patient_selection.messages.loading")}</p>
              </div>
            )}

            {activeTab === "select" ? (
              <div className="select-patient-modal">
                <div className="search-box">
                  <input
                    type="text"
                    placeholder={t("patient_selection.search_placeholder")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <div className="patients-list">
                  {filteredPatients.length > 0 ? (
                    filteredPatients.map((patient) => (
                      <div
                        key={patient.id}
                        className="patient-item"
                        onClick={() =>
                          !isLoading && handleSelectPatient(patient)
                        }
                      >
                        <div className="patient-name">{patient.name}</div>
                        <div className="patient-details">
                          {patient.email}{" "}
                          {patient.phone && `• ${patient.phone}`}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="no-results">
                      {t("patient_selection.no_patients")}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="create-patient-modal">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="firstName">
                      {t("patient_selection.form.first_name")} *
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={newPatient.firstName}
                      onChange={handleInputChange}
                      placeholder={t("patient_selection.form.enter_first_name")}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="middleName">
                      {t("patient_selection.form.middle_name")}
                    </label>
                    <input
                      type="text"
                      id="middleName"
                      name="middleName"
                      value={newPatient.middleName}
                      onChange={handleInputChange}
                      placeholder={t(
                        "patient_selection.form.enter_middle_name"
                      )}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="lastName">
                    {t("patient_selection.form.last_name")} *
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={newPatient.lastName}
                    onChange={handleInputChange}
                    placeholder={t("patient_selection.form.enter_last_name")}
                    disabled={isLoading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">
                    {t("patient_selection.form.email")} *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={newPatient.email}
                    onChange={handleInputChange}
                    placeholder={t("patient_selection.form.enter_email")}
                    disabled={isLoading}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="gender">
                      {t("patient_selection.form.gender")} *
                    </label>
                    <select
                      id="gender"
                      name="gender"
                      value={newPatient.gender}
                      onChange={handleInputChange}
                      disabled={isLoading}
                    >
                      <option value="Male">
                        {t("patient_selection.gender.male")}
                      </option>
                      <option value="Female">
                        {t("patient_selection.gender.female")}
                      </option>
                      <option value="Other">
                        {t("patient_selection.gender.other")}
                      </option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="dateOfBirth">
                      {t("patient_selection.form.date_of_birth")} *
                    </label>
                    <input
                      type="date"
                      id="dateOfBirth"
                      name="dateOfBirth"
                      value={newPatient.dateOfBirth}
                      onChange={handleInputChange}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="phoneNumber">
                    {t("patient_selection.form.phone_number")} *
                  </label>
                  <div className="phone-input">
                    <select
                      name="countryCode"
                      value={newPatient.countryCode}
                      onChange={handleInputChange}
                      disabled={isLoading}
                    >
                      <option value="+7">
                        {t("patient_selection.country_codes.russia")}
                      </option>
                      <option value="+1">
                        {t("patient_selection.country_codes.usa")}
                      </option>
                      <option value="+44">
                        {t("patient_selection.country_codes.uk")}
                      </option>
                      <option value="+49">
                        {t("patient_selection.country_codes.germany")}
                      </option>
                      <option value="+33">
                        {t("patient_selection.country_codes.france")}
                      </option>
                    </select>
                    <input
                      type="tel"
                      id="phoneNumber"
                      name="phoneNumber"
                      value={newPatient.phoneNumber}
                      onChange={handleInputChange}
                      placeholder={t("patient_selection.form.enter_phone")}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="modal-actions">
                  <button
                    className="cancel-button"
                    onClick={() => {
                      setIsModalOpen(false);
                      clearMessages();
                    }}
                    disabled={isLoading}
                  >
                    {t("patient_selection.buttons.cancel")}
                  </button>
                  <button
                    className="confirm-button"
                    disabled={
                      !newPatient.firstName ||
                      !newPatient.lastName ||
                      !newPatient.email ||
                      !newPatient.phoneNumber ||
                      !newPatient.dateOfBirth ||
                      isLoading
                    }
                    onClick={handleCreatePatient}
                  >
                    {isLoading
                      ? t("patient_selection.buttons.creating")
                      : t("patient_selection.buttons.create_patient")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientSelection;
