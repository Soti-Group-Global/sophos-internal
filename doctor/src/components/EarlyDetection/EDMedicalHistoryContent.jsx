import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { Download, X } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import RichTextEditor from "../RichTextEditor";
import SpecialistHistoryForm from "../SpecialistHistoryForm";
import EarlyDetectionReportTab from "../../pages/EarlyDetectionReportTab";

const CLINIC_INFO_ED = {
  name: "Медицинский центр «СОФОС»",
  phone: "+7-495-324-11-11",
  website: "www.sophos-med.ru",
  address: "ООО «ЭЙЧДИ КЛИНИК» · Бизнес-центр 'Квартал West' · Аминьевское Шоссе, 6, Москва, 119517",
};

function EDSectionPDFModal({ title, commentHtml, files, booking, onClose }) {
  const reportRef = useRef(null);
  const [generating, setGenerating] = useState(false);
  const bookingNum = booking?.invoiceNumber || booking?.bookingNumber || booking?._id || "report";

  const handleDownload = async () => {
    if (!reportRef.current) return;
    setGenerating(true);
    try {
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const A4_W_MM = 210, A4_H_MM = 297, PAGE_H_PX = 1123, SCALE = 2;
      const pageEls = Array.from(reportRef.current.querySelectorAll(".ed-page"));
      for (let i = 0; i < pageEls.length; i++) {
        const el = pageEls[i];
        const elH = Math.round(el.getBoundingClientRect().height);
        const canvas = await html2canvas(el, { scale: SCALE, useCORS: true, allowTaint: true, backgroundColor: "#ffffff", width: 794, height: elH });
        const canvasPageH = PAGE_H_PX * SCALE;
        const totalSlices = Math.max(1, Math.ceil(canvas.height / canvasPageH));
        for (let s = 0; s < totalSlices; s++) {
          if (i > 0 || s > 0) pdf.addPage();
          const srcY = s * canvasPageH;
          const srcH = Math.min(canvasPageH, canvas.height - srcY);
          if (srcH <= 0) break;
          const sc = document.createElement("canvas");
          sc.width = canvas.width; sc.height = srcH;
          const ctx = sc.getContext("2d");
          ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, sc.width, srcH);
          ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
          pdf.addImage(sc.toDataURL("image/jpeg", 0.98), "JPEG", 0, 0, A4_W_MM, (srcH / canvasPageH) * A4_H_MM);
        }
      }
      pdf.save(`section_${bookingNum}.pdf`);
    } finally { setGenerating(false); }
  };

  return createPortal(
    <div className="ht-spdf-overlay" onClick={onClose}>
      <div className="ht-spdf-container" onClick={(e) => e.stopPropagation()}>
        <div className="ht-spdf-toolbar">
          <button className="ht-spdf-download-btn" onClick={handleDownload} disabled={generating}>
            <Download size={14} />{generating ? "Генерация..." : "Скачать PDF"}
          </button>
          <button className="ht-spdf-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="ht-spdf-preview">
          <div ref={reportRef} className="ed-report-doc">
            <div className="ed-page">
              <div className="ed-page-header">
                <img src="/logo_ru.png" alt="Logo" className="ed-header-logo" />
                <div className="ed-header-clinic">
                  <span className="ed-header-clinic-name">{CLINIC_INFO_ED.name}</span>
                  <span className="ed-header-clinic-contact">{CLINIC_INFO_ED.phone} &nbsp; | &nbsp; {CLINIC_INFO_ED.website}</span>
                </div>
              </div>
              <hr className="ed-header-line" />
              <div className="ed-conclusions-body">
                <div className="ed-field-title" style={{ marginBottom: 16 }}>{title}</div>
                <div className="ed-section-content-text" dangerouslySetInnerHTML={{ __html: commentHtml || "<p>—</p>" }} />
              </div>
              <div className="ed-page-footer">
                <span>{CLINIC_INFO_ED.address}</span>
                <span>тел: <strong>{CLINIC_INFO_ED.phone}</strong> &nbsp;|&nbsp; {CLINIC_INFO_ED.website}</span>
              </div>
              <div className="ed-page-footer-bar">
                ИНН 9727077651 &nbsp;·&nbsp; ОГРН 1247700412068 &nbsp;·&nbsp; Ежедневно с 09:00 до 21:00
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * Main content area for the "Medical History" tab (activeTab === "medicalHistory").
 *
 * Props:
 *   booking                     – full booking object
 *   activeScheduleTab           – current sub-tab key
 *   activeSpecialistTab         – current specialist index
 *   managedSectionTabs          – string[] of sections handled by renderManagedTestSection
 *   renderManagedTestSection    – (section) => JSX  (render-prop from parent)
 *   renderFileActionButtons     – (file) => JSX     (render-prop from parent)
 *   sectionEditors              – { [section]: { value, saving } }
 *   updateSectionEditor         – (section, patch) => void
 *   handleSaveManagedSectionComment – (section) => Promise<void>
 *   openUploadSectionModal      – (section) => void
 *   normalizeId                 – id normalizer
 *   normalizeSpecialistTitle    – title normalizer
 *   getFileExtension            – (file) => string
 *   getFileLabel                – (file) => string
 *   formatFileSize              – (file) => string
 *   getVisibleSpecialistConsultations – (booking) => specialist[]
 *   currentDoctorEmail          – logged-in doctor's email (string)
 *   normalizeDoctorEmail        – (doctor) => string
 *   specialistForms             – { [idx]: formData }
 *   specialistFormSaving        – { [idx]: boolean }
 *   handleSaveSpecialistForm    – (idx, formData) => Promise<void>
 */
const EDMedicalHistoryContent = ({
  booking,
  activeScheduleTab,
  activeSpecialistTab,
  managedSectionTabs,
  renderFileActionButtons,
  patientSectionData,
  renderPatientFileActions,
  sectionEditors,
  updateSectionEditor,
  handleSaveManagedSectionComment,
  openUploadSectionModal,
  normalizeId,
  normalizeSpecialistTitle,
  getFileExtension,
  getFileLabel,
  formatFileSize,
  getVisibleSpecialistConsultations,
  currentDoctorEmail,
  normalizeDoctorEmail,
  specialistForms,
  specialistFormSaving,
  handleSaveSpecialistForm,
}) => {
  const { t } = useTranslation();
  const [edSectionPdfModal, setEdSectionPdfModal] = useState(null);

  return (
    <div className={`ed-medical-history-content${activeScheduleTab === "conclusion" ? " ed-medical-history-content--conclusion" : ""}`}>
      <div className={`detail-section${activeScheduleTab === "conclusion" ? " detail-section--compact" : ""}`}>

          {/* Managed sections (laboratoryTests, instrumentalAnalysis) — patient-level flat entries */}
          {managedSectionTabs.includes(activeScheduleTab) && (() => {
            const psSection = activeScheduleTab === "laboratoryTests" ? "laboratoryAnalysis" : "studiesManipulations";
            const entries = patientSectionData?.[psSection] || [];
            return (
              <div className="ed-schedule-section-list">
                <div className="ed-section-actions-row">
                  <button type="button" className="ed-upload-btn" onClick={() => openUploadSectionModal(activeScheduleTab)}>
                    {t("earlyDiagnosis.uploadFile")}
                  </button>
                </div>
                {entries.length === 0 ? (
                  <div className="ed-schedule-empty">{t("earlyDiagnosis.noFiles")}</div>
                ) : (
                  <div className="ed-section-card ed-test-card">
                    <ul className="ed-files-list ed-test-files-list">
                      {entries.map((entry, i) => (
                        <li key={entry._id || i} className="ed-file-row ed-test-file-row">
                          <div className="ed-test-file-left">
                            <span className={`ed-test-file-badge ${entry.kind === "file" && getFileExtension({ filename: entry.filename }) === "pdf" ? "is-pdf" : "is-doc"}`}>
                              {entry.kind === "file" ? (getFileExtension({ filename: entry.filename }) || "FILE").toUpperCase() : "TXT"}
                            </span>
                            <span className="ed-test-file-meta">
                              <span className="ed-test-file-name">{entry.label || entry.filename || entry.text || "—"}</span>
                              {entry.kind === "text" && entry.text && (
                                <span className="ed-test-file-subtext">{entry.text}</span>
                              )}
                            </span>
                          </div>
                          <span className="ed-file-actions ed-test-file-actions">
                            {renderPatientFileActions(psSection, entry)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })()}

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

              {(patientSectionData?.morphologicalResearch?.files || []).length === 0 ? (
                <div className="ed-schedule-empty">{t("earlyDiagnosis.noFiles")}</div>
              ) : (
                <div className="ed-section-card ed-test-card">
                  <ul className="ed-files-list ed-test-files-list">
                    {(patientSectionData?.morphologicalResearch?.files || []).map(
                      (file, fileIndex) => (
                        <li
                          key={normalizeId(file?.fileId) || file?._id || fileIndex}
                          className="ed-file-row ed-test-file-row"
                        >
                          <div className="ed-test-file-left">
                            <span
                              className={`ed-test-file-badge ${
                                getFileExtension(file) === "pdf" ? "is-pdf" : "is-doc"
                              }`}
                            >
                              {getFileExtension(file).toUpperCase()}
                            </span>
                            <span className="ed-test-file-meta">
                              <span className="ed-test-file-name">{getFileLabel(file)}</span>
                              <span className="ed-test-file-subtext">
                                {[
                                  formatFileSize(file),
                                  file?.uploadedByName ||
                                    file?.uploadedBy ||
                                    file?.uploadedByDoctorName,
                                ]
                                  .filter(Boolean)
                                  .join(" • ")}
                              </span>
                            </span>
                          </div>
                          <span className="ed-file-actions ed-test-file-actions">
                            {renderPatientFileActions("morphologicalResearch", file)}
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
                      className="ht-sp-pdf-btn"
                      title={t("history_tab.export_pdf", "Export PDF")}
                      onClick={() => setEdSectionPdfModal({
                        title: t("earlyDiagnosis.morphologicalResearch", "Morphological research"),
                        commentHtml: sectionEditors?.morphologicalResearch?.value || "",
                        files: patientSectionData?.morphologicalResearch?.files || [],
                      })}
                    >
                      <Download size={14} />
                    </button>
                    <button
                      type="button"
                      className="save-btn"
                      onClick={() => handleSaveManagedSectionComment("morphologicalResearch")}
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
                      updateSectionEditor("morphologicalResearch", { value: html })
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
                  onClick={() => openUploadSectionModal("proceduresAndManipulations")}
                >
                  {t("earlyDiagnosis.uploadFile")}
                </button>
              </div>

              {(patientSectionData?.proceduresAndManipulations?.files || []).length === 0 ? (
                <div className="ed-schedule-empty">{t("earlyDiagnosis.noFiles")}</div>
              ) : (
                <div className="ed-section-card ed-test-card">
                  <ul className="ed-files-list ed-test-files-list">
                    {(patientSectionData?.proceduresAndManipulations?.files || []).map(
                      (file, fileIndex) => (
                        <li
                          key={normalizeId(file?.fileId) || file?._id || fileIndex}
                          className="ed-file-row ed-test-file-row"
                        >
                          <div className="ed-test-file-left">
                            <span
                              className={`ed-test-file-badge ${
                                getFileExtension(file) === "pdf" ? "is-pdf" : "is-doc"
                              }`}
                            >
                              {getFileExtension(file).toUpperCase()}
                            </span>
                            <span className="ed-test-file-meta">
                              <span className="ed-test-file-name">{getFileLabel(file)}</span>
                              <span className="ed-test-file-subtext">
                                {[
                                  formatFileSize(file),
                                  file?.uploadedByName ||
                                    file?.uploadedBy ||
                                    file?.uploadedByDoctorName,
                                ]
                                  .filter(Boolean)
                                  .join(" • ")}
                              </span>
                            </span>
                          </div>
                          <span className="ed-file-actions ed-test-file-actions">
                            {renderPatientFileActions("proceduresAndManipulations", file)}
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
                    {t("earlyDiagnosis.proceduresAndManipulations")}
                  </div>
                  <div className="ed-history-actions">
                    <button
                      type="button"
                      className="ht-sp-pdf-btn"
                      title={t("history_tab.export_pdf", "Export PDF")}
                      onClick={() => setEdSectionPdfModal({
                        title: t("earlyDiagnosis.proceduresAndManipulations", "Procedures and manipulations"),
                        commentHtml: sectionEditors?.proceduresAndManipulations?.value || "",
                        files: patientSectionData?.proceduresAndManipulations?.files || [],
                      })}
                    >
                      <Download size={14} />
                    </button>
                    <button
                      type="button"
                      className="save-btn"
                      onClick={() =>
                        handleSaveManagedSectionComment("proceduresAndManipulations")
                      }
                      disabled={!!sectionEditors?.proceduresAndManipulations?.saving}
                    >
                      {sectionEditors?.proceduresAndManipulations?.saving
                        ? t("earlyDiagnosis.saving")
                        : t("earlyDiagnosis.save")}
                    </button>
                  </div>
                </div>
                <div className="ed-history-rich-editor">
                  <RichTextEditor
                    value={sectionEditors?.proceduresAndManipulations?.value || ""}
                    onChange={(html) =>
                      updateSectionEditor("proceduresAndManipulations", { value: html })
                    }
                    placeholder={t("history_tab.enter_text")}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Specialist Consultation */}
          {activeScheduleTab === "specialistConsultation" && (
            (() => {
              const specialistList = getVisibleSpecialistConsultations(booking);

              if (specialistList.length === 0) {
                return (
                  <div className="ed-schedule-empty">
                    {t("earlyDiagnosis.noSpecialistConsultations")}
                  </div>
                );
              }

              const currentIndex =
                activeSpecialistTab !== null &&
                activeSpecialistTab >= 0 &&
                activeSpecialistTab < specialistList.length
                  ? activeSpecialistTab
                  : 0;

              const specialist = specialistList[currentIndex];

              if (!specialist) {
                return (
                  <div className="ed-schedule-empty">
                    {t("earlyDiagnosis.noSpecialistConsultations")}
                  </div>
                );
              }

              const specialistDoctorEmail = normalizeDoctorEmail(specialist?.doctor);
              const isSpecialistOwner =
                !!currentDoctorEmail && specialistDoctorEmail === currentDoctorEmail;
              const displaySpecialistTitle = specialist.title
                ? t(
                    `earlyDiagnosis.specialist_${normalizeSpecialistTitle(specialist.title)}`,
                    specialist.title,
                  )
                : specialist.title;

              return (
                <div className="ed-specialist-consultation-wrapper">
                  <SpecialistHistoryForm
                    key={`specialist_form_${currentIndex}`}
                    specialistTitle={displaySpecialistTitle}
                    historyForm={specialistForms[currentIndex] || specialist.historyForm || {}}
                    isSaving={!!specialistFormSaving[currentIndex]}
                    isEditable={isSpecialistOwner}
                    onSave={(formData) => handleSaveSpecialistForm(currentIndex, formData)}
                  />
                </div>
              );
            })()
          )}

      </div>
      {activeScheduleTab === "conclusion" && (
        <EarlyDetectionReportTab booking={booking} />
      )}

      {edSectionPdfModal && (
        <EDSectionPDFModal
          title={edSectionPdfModal.title}
          commentHtml={edSectionPdfModal.commentHtml}
          files={edSectionPdfModal.files || []}
          booking={booking}
          onClose={() => setEdSectionPdfModal(null)}
        />
      )}
    </div>
  );
};

export default EDMedicalHistoryContent;
