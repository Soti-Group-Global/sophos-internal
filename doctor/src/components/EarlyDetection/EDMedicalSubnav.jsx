import React, { useState } from "react";
import { ChevronDown, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";

const EDMedicalSubnav = ({
  booking,
  activeScheduleTab,
  setActiveScheduleTab,
  activeTestId,
  setActiveTestId,
  managedTests,
  managedSectionTabs,
  specialistAccordionOpen,
  setSpecialistAccordionOpen,
  activeSpecialistTab,
  setActiveSpecialistTab,
  openTestSettingsModal,
  normalizeId,
  normalizeSpecialistTitle,
  readLocalizedName,
  getManagedTestEntries,
  setShowTestNoteEditor,
  setTestNoteDraft,
  setEditingTestNoteId,
}) => {
  const { t } = useTranslation();
  const [managedAccordion, setManagedAccordion] = useState({});

  const subTabs = [
    ["specialistConsultation",     t("earlyDiagnosis.specialistConsultation", "Specialist Consultation")],
    ["laboratoryTests",            t("earlyDiagnosis.laboratoryTests", "Laboratory analysis")],
    ["instrumentalAnalysis",       t("earlyDiagnosis.instrumentalAnalysis", "Instrumental analysis")],
    ["morphologicalResearch",      t("earlyDiagnosis.morphologicalResearch", "Morphological research")],
    ["proceduresAndManipulations", t("earlyDiagnosis.proceduresAndManipulations", "Procedures and manipulations")],
    ["conclusion",                 t("earlyDiagnosis.conclusion", "Conclusion")],
  ];

  const clearTestState = () => {
    setShowTestNoteEditor?.(false);
    setTestNoteDraft?.("");
    setEditingTestNoteId?.(null);
  };

  const handleManagedTabClick = (key) => {
    if (activeScheduleTab === key) {
      setManagedAccordion((prev) => ({ ...prev, [key]: !prev[key] }));
    } else {
      setActiveScheduleTab(key);
      setManagedAccordion((prev) => ({ ...prev, [key]: true }));
      const firstTest = (managedTests?.[key] || [])[0];
      setActiveTestId(firstTest ? normalizeId(firstTest._id) : null);
      clearTestState();
    }
  };

  const isManagedOpen = (key) =>
    activeScheduleTab === key && !!managedAccordion[key];

  return (
    <aside className="ed-medical-history-sidebar">
      <div className="ed-schedule-tabs ed-schedule-tabs--vertical">
        {subTabs.map(([key, label]) => (
          <React.Fragment key={key}>
            <button
              type="button"
              className={`ed-schedule-tab-btn ${activeScheduleTab === key ? "active" : ""}`}
              onClick={() => {
                if (key === "specialistConsultation") {
                  if (activeScheduleTab === key) {
                    setSpecialistAccordionOpen((o) => !o);
                  } else {
                    setActiveScheduleTab(key);
                    setSpecialistAccordionOpen(true);
                  }
                  setActiveTestId(null);
                  clearTestState();
                } else if (managedSectionTabs.includes(key)) {
                  handleManagedTabClick(key);
                } else {
                  setActiveScheduleTab(key);
                  setActiveTestId(null);
                  clearTestState();
                }
              }}
            >
              <span className="ed-tab-label-group">
                {label}
                {key === "specialistConsultation" && (
                  <ChevronDown
                    size={13}
                    className="ed-tab-chevron"
                    style={{
                      transform: (activeScheduleTab === key && specialistAccordionOpen) ? "rotate(180deg)" : "none",
                      transition: "transform 0.2s",
                    }}
                  />
                )}
              </span>

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

            {/* Specialist Consultation accordion */}
            {key === "specialistConsultation" &&
              activeScheduleTab === "specialistConsultation" &&
              specialistAccordionOpen &&
              Array.isArray(booking?.schedule?.specialistConsultations) &&
              booking.schedule.specialistConsultations.length > 0 && (
                <div className="ed-subnav-test-list">
                  {booking.schedule.specialistConsultations.map((s, i) => {
                    const title = s?.title
                      ? t(`earlyDiagnosis.specialist_${normalizeSpecialistTitle(s.title)}`, s.title)
                      : `Specialist ${i + 1}`;
                    return (
                      <button
                        key={i}
                        type="button"
                        className={`ed-subnav-test-item${activeSpecialistTab === i ? " ed-subnav-test-item--active" : ""}`}
                        onClick={() => setActiveSpecialistTab(i)}
                      >
                        <span className="ed-subnav-test-name">{title}</span>
                      </button>
                    );
                  })}
                </div>
              )}

            {/* Managed section accordion (laboratoryTests / instrumentalAnalysis) */}
            {managedSectionTabs.includes(key) && isManagedOpen(key) && (() => {
              const filledTests = (managedTests?.[key] || []).filter((test) => {
                const entries = getManagedTestEntries(key, normalizeId(test?._id));
                return entries.some(
                  (e) =>
                    (Array.isArray(e.files) && e.files.length > 0) ||
                    (Array.isArray(e.notes) && e.notes.length > 0)
                );
              });
              if (filledTests.length === 0) return null;
              return (
                <div className="ed-subnav-test-list">
                  {filledTests.map((test) => {
                    const testId = normalizeId(test?._id);
                    const entries = getManagedTestEntries(key, testId);
                    const isDone = entries.some((e) => Array.isArray(e.files) && e.files.length > 0);
                    const isActive = activeTestId === testId;
                    return (
                      <button
                        key={testId}
                        type="button"
                        className={`ed-subnav-test-item${isDone ? " ed-subnav-test-item--done" : ""}${isActive ? " ed-subnav-test-item--active" : ""}`}
                        onClick={() => {
                          setActiveTestId(isActive ? null : testId);
                          clearTestState();
                        }}
                      >
                        <span className="ed-subnav-test-name">{readLocalizedName(test?.name)}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </React.Fragment>
        ))}
      </div>
    </aside>
  );
};

export default EDMedicalSubnav;
