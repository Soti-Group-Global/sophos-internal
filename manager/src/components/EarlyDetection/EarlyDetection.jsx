import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import PatientSelection from "./PatientSelection";
import EarlyDetectionForm from "./EarlyDetectionForm";
import PackageSelection from "./PackageSelection";
import EarlyDetectionApplications from "./EarlyDetectionApplications";
import "./EarlyDetection.css";

const EarlyDetection = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("applications"); // "applications" | "create"
  const [currentStep, setCurrentStep] = useState(1);

  const [formData, setFormData] = useState({
    patient: null,
    answers: {},
    selectedPackage: null,
  });

  const nextStep = () => setCurrentStep((prev) => prev + 1);
  const prevStep = () => setCurrentStep((prev) => prev - 1);

  const updateFormData = (newData) => {
    setFormData((prev) => ({ ...prev, ...newData }));
  };

  const handleSubmit = (finalFormData) => {
    alert(t("early_detection.form_submitted")); // Updated to use translation
    setFormData({ patient: null, answers: {}, selectedPackage: null });
    setCurrentStep(1);
    setActiveTab("applications");
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <PatientSelection
            formData={formData}
            updateFormData={updateFormData}
            nextStep={nextStep}
          />
        );
      case 2:
        return (
          <EarlyDetectionForm
            formData={formData}
            updateFormData={updateFormData}
            nextStep={nextStep}
            prevStep={prevStep}
          />
        );
      case 3:
        return (
          <PackageSelection
            formData={formData}
            updateFormData={updateFormData}
            nextStep={nextStep}
            prevStep={prevStep}
            onSubmit={handleSubmit}
          />
        );
      default:
        return <PatientSelection />;
    }
  };

  return (
    <div className="early-detection-wrapper">
      <div className="early-detection-container">
        {/* Tabs */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === "applications" ? "active" : ""}`}
            onClick={() => setActiveTab("applications")}
          >
            {t("EarlyDetectionApplications.header")}
          </button>
          <button
            className={`tab ${activeTab === "create" ? "active" : ""}`}
            onClick={() => setActiveTab("create")}
          >
            {t("EarlyDetectionApplications.createTab")}
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === "applications" && (
            <div className="applications-tab">
              <EarlyDetectionApplications />
            </div>
          )}

          {activeTab === "create" && (
            <>
              {/* Progress Bar */}
              <div className="progress-bar">
                <div className="progress-steps">
                  <div className={`step ${currentStep >= 1 ? "active" : ""}`}>
                    <span className="step-number">1</span>
                    <span className="step-label">
                      {t("EarlyDetectionApplications.step_patient")}
                    </span>
                  </div>
                  <div className={`step ${currentStep >= 2 ? "active" : ""}`}>
                    <span className="step-number">2</span>
                    <span className="step-label">
                      {t("EarlyDetectionApplications.step_questions")}
                    </span>
                  </div>
                  <div className={`step ${currentStep >= 3 ? "active" : ""}`}>
                    <span className="step-number">3</span>
                    <span className="step-label">
                      {t("EarlyDetectionApplications.step_package")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="form-content">{renderStep()}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EarlyDetection;
