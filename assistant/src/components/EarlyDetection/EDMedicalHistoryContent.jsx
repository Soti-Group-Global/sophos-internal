import React from "react";
import { useTranslation } from "react-i18next";
import RichTextEditor from "../RichTextEditor/RichTextEditor";
import SpecialistHistoryForm from "../SpecialistHistoryForm/SpecialistHistoryForm";
import EarlyDetectionReportTab from "../../pages/EarlyDetectionReportTab";

/**
 * Main content area for the "Medical History" tab (assistant interface).
 *
 * Props:
 *   booking                         – full booking object
 *   activeScheduleTab               – current sub-tab key
 *   activeSpecialistTab             – current specialist index
 *   managedSectionTabs              – string[] of sections handled by renderManagedTestSection
 *   renderManagedTestSection        – (section) => JSX  (render-prop from parent)
 *   renderFileActionButtons         – (file) => JSX     (render-prop from parent)
 *   sectionEditors                  – { [section]: { value, saving } }
 *   updateSectionEditor             – (section, patch) => void
 *   handleSaveManagedSectionComment – (section) => Promise<void>
 *   openUploadSectionModal          – (section) => void
 *   normalizeId                     – id normalizer
 *   normalizeSpecialistTitle        – title normalizer
 *   getFileExtension                – (file) => string
 *   getFileLabel                    – (file) => string
 *   formatFileSize                  – (file) => string
 *   accessibleDoctorEmails          – "all" | Set<string> | null
 *   resolveDoctorEmail              – (doctor) => string
 *   specialistForms                 – { [idx]: formData }
 *   specialistFormSaving            – { [idx]: boolean }
 *   handleSaveSpecialistForm        – (idx, formData) => Promise<void>
 */
const EDMedicalHistoryContent = ({
  booking,
  activeScheduleTab,
  activeSpecialistTab,
  managedSectionTabs,
  renderManagedTestSection,
  renderFileActionButtons,
  sectionEditors,
  updateSectionEditor,
  handleSaveManagedSectionComment,
  openUploadSectionModal,
  normalizeId,
  normalizeSpecialistTitle,
  getFileExtension,
  getFileLabel,
  formatFileSize,
  formatDateTime,
  accessibleDoctorEmails,
  resolveDoctorEmail,
  specialistForms,
  specialistFormSaving,
  handleSaveSpecialistForm,
}) => {
  const { t } = useTranslation();

  return (
    <div className="ed-medical-history-content">
      <div className="detail-section">
        {/* Managed sections (laboratoryTests, instrumentalAnalysis) */}
        {managedSectionTabs.includes(activeScheduleTab) &&
          renderManagedTestSection(activeScheduleTab)}

        {/* Morphological Research */}
        {activeScheduleTab === "morphologicalResearch" && (
          <div className="ed-schedule-section-list">
            <div className="ed-section-actions-row">
              <button
                type="button"
                className="ed-upload-btn"
                onClick={() => openUploadSectionModal("morphologicalResearch")}
              >
                {t("earlyDiagnosis.uploadFile")}
              </button>
            </div>

            {(booking?.schedule?.morphologicalResearch?.files || []).length ===
            0 ? (
              <div className="ed-schedule-empty">
                {t("earlyDiagnosis.noFiles")}
              </div>
            ) : (
              <div className="ed-section-card ed-test-card">
                <ul className="ed-files-list ed-test-files-list">
                  {(booking?.schedule?.morphologicalResearch?.files || []).map(
                    (file, fileIndex) => (
                      <li
                        key={
                          normalizeId(file?.fileId) || file?._id || fileIndex
                        }
                        className="ed-file-row ed-test-file-row"
                      >
                        <div className="ed-test-file-left">
                          <span
                            className={`ed-test-file-badge ${getFileExtension(file) === "pdf" ? "is-pdf" : "is-doc"}`}
                          >
                            {getFileExtension(file).toUpperCase()}
                          </span>
                          <span className="ed-test-file-meta">
                            <span className="ed-test-file-name">
                              {getFileLabel(file)}
                            </span>
                            <span className="ed-test-file-subtext">
                              {[
                                formatFileSize(file),
                                file?.uploadedByName ||
                                  file?.uploadedBy ||
                                  file?.uploadedByDoctorName,
                                formatDateTime
                                  ? formatDateTime(file?.uploadedAt || file?.createdAt || file?.date)
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" • ")}
                            </span>
                          </span>
                        </div>
                        <span className="ed-file-actions ed-test-file-actions">
                          {renderFileActionButtons(file)}
                        </span>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            )}

            <div className="ed-section-card">
              <div className="ed-section-head-row">
                <div className="ed-section-title">
                  {t("earlyDiagnosis.morphologicalResearch")}
                </div>
                <div className="ed-history-actions">
                  <button
                    type="button"
                    className="save-btn"
                    onClick={() =>
                      handleSaveManagedSectionComment("morphologicalResearch")
                    }
                    disabled={!!sectionEditors?.morphologicalResearch?.saving}
                  >
                    {sectionEditors?.morphologicalResearch?.saving
                      ? t("earlyDiagnosis.saving")
                      : t("earlyDiagnosis.save")}
                  </button>
                </div>
              </div>
              <div className="ed-history-rich-editor">
                <RichTextEditor
                  value={sectionEditors?.morphologicalResearch?.value || ""}
                  onChange={(html) =>
                    updateSectionEditor("morphologicalResearch", {
                      value: html,
                    })
                  }
                  placeholder={t("history_tab.enter_text")}
                />
              </div>
            </div>
          </div>
        )}

        {/* Procedures and Manipulations */}
        {activeScheduleTab === "proceduresAndManipulations" && (
          <div className="ed-schedule-section-list">
            <div className="ed-section-actions-row">
              <button
                type="button"
                className="ed-upload-btn"
                onClick={() =>
                  openUploadSectionModal("proceduresAndManipulations")
                }
              >
                {t("earlyDiagnosis.uploadFile")}
              </button>
            </div>

            {(booking?.schedule?.proceduresAndManipulations?.files || [])
              .length === 0 ? (
              <div className="ed-schedule-empty">
                {t("earlyDiagnosis.noFiles")}
              </div>
            ) : (
              <div className="ed-section-card ed-test-card">
                <ul className="ed-files-list ed-test-files-list">
                  {(
                    booking?.schedule?.proceduresAndManipulations?.files || []
                  ).map((file, fileIndex) => (
                    <li
                      key={
                        normalizeId(file?.fileId) || file?._id || fileIndex
                      }
                      className="ed-file-row ed-test-file-row"
                    >
                      <div className="ed-test-file-left">
                        <span
                          className={`ed-test-file-badge ${getFileExtension(file) === "pdf" ? "is-pdf" : "is-doc"}`}
                        >
                          {getFileExtension(file).toUpperCase()}
                        </span>
                        <span className="ed-test-file-meta">
                          <span className="ed-test-file-name">
                            {getFileLabel(file)}
                          </span>
                          <span className="ed-test-file-subtext">
                            {[
                              formatFileSize(file),
                              file?.uploadedByName ||
                                file?.uploadedBy ||
                                file?.uploadedByDoctorName,
                              formatDateTime
                                ? formatDateTime(file?.uploadedAt || file?.createdAt || file?.date)
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" • ")}
                          </span>
                        </span>
                      </div>
                      <span className="ed-file-actions ed-test-file-actions">
                        {renderFileActionButtons(file)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="ed-section-card">
              <div className="ed-section-head-row">
                <div className="ed-section-title">
                  {t("earlyDiagnosis.proceduresAndManipulations")}
                </div>
                <div className="ed-history-actions">
                  <button
                    type="button"
                    className="save-btn"
                    onClick={() =>
                      handleSaveManagedSectionComment(
                        "proceduresAndManipulations",
                      )
                    }
                    disabled={
                      !!sectionEditors?.proceduresAndManipulations?.saving
                    }
                  >
                    {sectionEditors?.proceduresAndManipulations?.saving
                      ? t("earlyDiagnosis.saving")
                      : t("earlyDiagnosis.save")}
                  </button>
                </div>
              </div>
              <div className="ed-history-rich-editor">
                <RichTextEditor
                  value={
                    sectionEditors?.proceduresAndManipulations?.value || ""
                  }
                  onChange={(html) =>
                    updateSectionEditor("proceduresAndManipulations", {
                      value: html,
                    })
                  }
                  placeholder={t("history_tab.enter_text")}
                />
              </div>
            </div>
          </div>
        )}

        {/* Specialist Consultation */}
        {activeScheduleTab === "specialistConsultation" &&
          (() => {
            const specialist =
              booking?.schedule?.specialistConsultations?.[activeSpecialistTab];
            if (!specialist) return null;

            const specialistDoctorEmail = String(
              resolveDoctorEmail(specialist?.doctor) || "",
            );
            const canEdit =
              !!specialistDoctorEmail &&
              (accessibleDoctorEmails === "all" ||
                (accessibleDoctorEmails instanceof Set &&
                  accessibleDoctorEmails.has(specialistDoctorEmail)));

            const displaySpecialistTitle = specialist.title
              ? t(
                  `earlyDiagnosis.specialist_${normalizeSpecialistTitle(specialist.title)}`,
                  specialist.title,
                )
              : specialist.title;

            return (
              <SpecialistHistoryForm
                key={`specialist_form_${activeSpecialistTab}`}
                specialistTitle={displaySpecialistTitle}
                historyForm={
                  specialistForms[activeSpecialistTab] ||
                  specialist.historyForm ||
                  {}
                }
                isSaving={!!specialistFormSaving[activeSpecialistTab]}
                readOnly={!canEdit}
                onSave={(formData) =>
                  handleSaveSpecialistForm(activeSpecialistTab, formData)
                }
              />
            );
          })()}

        {/* Conclusion */}
        {activeScheduleTab === "conclusion" && (
          <div className="ed-schedule-section-list ed-conclusion-report-tab">
            <EarlyDetectionReportTab booking={booking} />
          </div>
        )}
      </div>
    </div>
  );
};

export default EDMedicalHistoryContent;
