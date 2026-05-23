import React from "react";
import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";

const EDMedicalSubnav = ({
  booking,
  activeScheduleTab,
  setActiveScheduleTab,
  activeTestId,
  setActiveTestId,
  managedTests,
  managedSectionTabs,
  setActiveSpecialistTab,
  openTestSettingsModal,
  normalizeId,
  readLocalizedName,
  getManagedTestEntries,
  setShowTestNoteEditor,
  setTestNoteDraft,
  setEditingTestNoteId,
  navExpanded,
}) => {
  const { t } = useTranslation();

  const subTabs = [
    ["specialistConsultation",     t("earlyDiagnosis.specialistConsultation", "Specialist Consultation")],
    ["laboratoryTests",            t("earlyDiagnosis.laboratoryTests", "Laboratory analysis")],
    ["instrumentalAnalysis",       t("earlyDiagnosis.instrumentalAnalysis", "Studies/manipulations")],
    ["morphologicalResearch",      t("earlyDiagnosis.morphologicalResearch", "Morphological research")],
    ["proceduresAndManipulations", t("earlyDiagnosis.proceduresAndManipulations", "Procedures and manipulations")],
    ["conclusion",                 t("earlyDiagnosis.conclusion", "Conclusion")],
  ];

  const clearTestState = () => {
    setShowTestNoteEditor?.(false);
    setTestNoteDraft?.("");
    setEditingTestNoteId?.(null);
  };

  return (
    <aside className={`ed-medical-history-sidebar${navExpanded ? " ed-medical-history-sidebar--nav-expanded" : ""}`}>
      <div className="ed-schedule-tabs ed-schedule-tabs--vertical">
        {subTabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`ed-schedule-tab-btn ${activeScheduleTab === key ? "active" : ""}`}
            onClick={() => {
              if (key === "specialistConsultation") {
                setActiveScheduleTab(key);
                setActiveTestId(null);
                clearTestState();
                setActiveSpecialistTab(0);
              } else if (managedSectionTabs.includes(key)) {
                setActiveScheduleTab(key);
                const firstTest = (managedTests?.[key] || [])[0];
                setActiveTestId(firstTest ? normalizeId(firstTest._id) : null);
                clearTestState();
              } else {
                setActiveScheduleTab(key);
                setActiveTestId(null);
                clearTestState();
              }
            }}
          >
            <span className="ed-tab-label-group">{label}</span>

            {managedSectionTabs.includes(key) && (
              <span
                className="ed-tab-add-btn"
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); openTestSettingsModal(key); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    openTestSettingsModal(key);
                  }
                }}
                title={t("earlyDiagnosis.manageTests", "Manage tests")}
              >
                <Settings size={13} />
              </span>
            )}
          </button>
        ))}
      </div>
    </aside>
  );
};

export default EDMedicalSubnav;
