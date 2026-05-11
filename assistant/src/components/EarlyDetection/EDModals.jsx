import React from "react";
import { createPortal } from "react-dom";
import { Edit2, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * All portal-rendered modals for the Early Detection Booking Details page
 * (assistant interface).
 *
 * Props:
 *   // Managed-test settings modal
 *   showTestSettingsModal       – boolean
 *   setShowTestSettingsModal    – setter
 *   settingsSection             – string (active section key)
 *   testDraft                   – { en: string, ru: string }
 *   setTestDraft                – setter
 *   editingManagedTestId        – string
 *   setEditingManagedTestId     – setter
 *   managedTests                – { [section]: test[] }
 *   handleManagedTestSave       – () => Promise<void>
 *   handleManagedTestDelete     – (testId) => void
 *   savingManagedTest           – boolean
 *   normalizeId                 – id normalizer
 *
 *   // Upload modal
 *   showUploadModal             – boolean
 *   setShowUploadModal          – setter
 *   uploadSection               – string
 *   uploadItemId                – string
 *   setUploadItemId             – setter
 *   uploadCustomName            – string
 *   setUploadCustomName         – setter
 *   uploadFile                  – File | null
 *   setUploadFile               – setter
 *   uploadFiles                 – { file, customName }[]
 *   setUploadFiles              – setter
 *   managedTestOptions          – test[]
 *   readLocalizedName           – (value) => string
 *   handleUploadSectionFile     – () => Promise<void>
 *   isUploadingSectionFile      – boolean
 *   sectionsWithTestSelection   – string[]
 *   multiUploadSections         – string[]
 *
 *   // Manual payment modal
 *   showManualPaymentForm       – boolean
 *   setShowManualPaymentForm    – setter
 *   manualSelectedPkg           – string
 *   setManualSelectedPkg        – setter
 *   manualSelectedAddons        – string[]
 *   toggleManualAddon           – (addonId) => void
 *   manualTotal                 – number
 *   manualPayment               – { paymentStatus, transactionId, notes }
 *   setManualPayment            – setter
 *   handleManualPaymentSave     – () => Promise<void>
 *   isSavingManual              – boolean
 *   ED_PACKAGES                 – package[]
 *   ED_ADDONS                   – addon[]
 */
const EDModals = ({
  // Managed-test settings modal
  showTestSettingsModal,
  setShowTestSettingsModal,
  settingsSection,
  testDraft,
  setTestDraft,
  editingManagedTestId,
  setEditingManagedTestId,
  managedTests,
  handleManagedTestSave,
  handleManagedTestDelete,
  savingManagedTest,
  normalizeId,

  // Upload modal
  showUploadModal,
  setShowUploadModal,
  uploadSection,
  uploadItemId,
  setUploadItemId,
  uploadCustomName,
  setUploadCustomName,
  uploadFile,
  setUploadFile,
  uploadFiles,
  setUploadFiles,
  managedTestOptions,
  readLocalizedName,
  handleUploadSectionFile,
  isUploadingSectionFile,
  sectionsWithTestSelection,
  multiUploadSections,

  // Manual payment modal
  showManualPaymentForm,
  setShowManualPaymentForm,
  manualSelectedPkg,
  setManualSelectedPkg,
  manualSelectedAddons,
  toggleManualAddon,
  manualTotal,
  manualPayment,
  setManualPayment,
  handleManualPaymentSave,
  isSavingManual,
  ED_PACKAGES,
  ED_ADDONS,
}) => {
  const { t } = useTranslation();

  return (
    <>
      {/* ── Manage Tests Modal ── */}
      {showTestSettingsModal &&
        createPortal(
          <div
            className="mp-modal-overlay"
            onClick={() => setShowTestSettingsModal(false)}
          >
            <div
              className="mp-modal ed-manage-tests-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mp-modal-header">
                <h3>{t("earlyDiagnosis.manageTests", "Manage tests")}</h3>
                <button
                  className="mp-modal-close"
                  onClick={() => setShowTestSettingsModal(false)}
                >
                  ×
                </button>
              </div>

              <div className="mp-modal-body">
                <div className="mp-field">
                  <label className="mp-field-label">EN</label>
                  <input
                    className="mp-input"
                    value={testDraft.en}
                    onChange={(e) =>
                      setTestDraft((prev) => ({ ...prev, en: e.target.value }))
                    }
                    placeholder="Test name (EN)"
                  />
                </div>
                <div className="mp-field">
                  <label className="mp-field-label">RU</label>
                  <input
                    className="mp-input"
                    value={testDraft.ru}
                    onChange={(e) =>
                      setTestDraft((prev) => ({ ...prev, ru: e.target.value }))
                    }
                    placeholder="Название теста (RU)"
                  />
                </div>

                <div className="ed-manage-tests-actions">
                  <button
                    className="save-btn"
                    onClick={handleManagedTestSave}
                    disabled={savingManagedTest}
                  >
                    {savingManagedTest
                      ? t("earlyDiagnosis.saving", "Saving...")
                      : t("earlyDiagnosis.save", "Save")}
                  </button>
                  {editingManagedTestId && (
                    <button
                      className="cancel-btn"
                      onClick={() => {
                        setEditingManagedTestId("");
                        setTestDraft({ en: "", ru: "" });
                      }}
                    >
                      {t("earlyDiagnosis.cancel", "Cancel")}
                    </button>
                  )}
                </div>

                <div className="ed-managed-tests-list">
                  {(managedTests?.[settingsSection] || []).map((item) => (
                    <div
                      className="ed-managed-test-row"
                      key={normalizeId(item?._id)}
                    >
                      <div className="ed-managed-test-name">
                        <strong>{item?.name?.en}</strong>
                        <span>{item?.name?.ru}</span>
                      </div>
                      <div className="ed-managed-test-buttons">
                        <button
                          className="edit-note-icon-btn"
                          onClick={() => {
                            setEditingManagedTestId(normalizeId(item?._id));
                            setTestDraft({
                              en: item?.name?.en || "",
                              ru: item?.name?.ru || "",
                            });
                          }}
                          title={t("earlyDiagnosis.edit", "Edit")}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="delete-note-icon-btn"
                          onClick={() =>
                            handleManagedTestDelete(normalizeId(item?._id))
                          }
                          title={t("earlyDiagnosis.delete", "Delete")}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ── Upload File Modal ── */}
      {showUploadModal &&
        createPortal(
          <div
            className="mp-modal-overlay"
            onClick={() => setShowUploadModal(false)}
          >
            <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
              <div className="mp-modal-header">
                <h3>{t("earlyDiagnosis.uploadFile", "Upload file")}</h3>
                <button
                  className="mp-modal-close"
                  onClick={() => setShowUploadModal(false)}
                >
                  ×
                </button>
              </div>

              <div className="mp-modal-body">
                {sectionsWithTestSelection.includes(uploadSection) && (
                  <div className="mp-field">
                    <label className="mp-field-label">
                      {t("earlyDiagnosis.selectTest", "Select test")}
                    </label>
                    <select
                      className="mp-select"
                      value={uploadItemId}
                      onChange={(e) => setUploadItemId(e.target.value)}
                    >
                      <option value="">
                        {t("earlyDiagnosis.selectTest", "Select test")}
                      </option>
                      {managedTestOptions.map((item) => (
                        <option
                          key={normalizeId(item?._id)}
                          value={normalizeId(item?._id)}
                        >
                          {readLocalizedName(item?.name)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {!multiUploadSections.includes(uploadSection) && (
                  <div className="mp-field">
                    <label className="mp-field-label">
                      {t("earlyDiagnosis.customName", "Custom name")}
                    </label>
                    <input
                      className="mp-input"
                      value={uploadCustomName}
                      onChange={(e) => setUploadCustomName(e.target.value)}
                      placeholder={t(
                        "earlyDiagnosis.customNameOptional",
                        "Optional",
                      )}
                    />
                  </div>
                )}

                {multiUploadSections.includes(uploadSection) ? (
                  <>
                    <div className="mp-field">
                      <label className="mp-field-label">
                        {t("earlyDiagnosis.file", "File")}
                      </label>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <input
                          type="file"
                          className="mp-input"
                          style={{ flex: 1 }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setUploadFiles((prev) => [
                                ...prev,
                                { file, customName: "" },
                              ]);
                              e.target.value = "";
                            }
                          }}
                        />
                      </div>
                    </div>

                    {uploadFiles.length > 0 && (
                      <div style={{ marginTop: "12px" }}>
                        <label className="mp-field-label">
                          {t("earlyDiagnosis.files", "Files to upload")}
                        </label>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                          }}
                        >
                          {uploadFiles.map((fileItem, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: "flex",
                                gap: "8px",
                                alignItems: "center",
                              }}
                            >
                              <input
                                type="text"
                                className="mp-input"
                                placeholder={t(
                                  "earlyDiagnosis.customName",
                                  "Custom name",
                                )}
                                value={fileItem.customName}
                                onChange={(e) => {
                                  const newFiles = [...uploadFiles];
                                  newFiles[idx].customName = e.target.value;
                                  setUploadFiles(newFiles);
                                }}
                                style={{ flex: 1 }}
                              />
                              <span
                                style={{
                                  fontSize: "12px",
                                  color: "#6b7280",
                                  minWidth: "120px",
                                }}
                              >
                                {fileItem.file.name}
                              </span>
                              <button
                                type="button"
                                className="delete-note-icon-btn"
                                onClick={() => {
                                  setUploadFiles((prev) =>
                                    prev.filter((_, i) => i !== idx),
                                  );
                                }}
                                title={t("earlyDiagnosis.remove", "Remove")}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="mp-field">
                    <label className="mp-field-label">
                      {t("earlyDiagnosis.file", "File")}
                    </label>
                    <input
                      type="file"
                      className="mp-input"
                      onChange={(e) =>
                        setUploadFile(e.target.files?.[0] || null)
                      }
                    />
                  </div>
                )}
              </div>

              <div className="mp-modal-footer">
                <button
                  className="mp-btn-cancel"
                  onClick={() => setShowUploadModal(false)}
                  disabled={isUploadingSectionFile}
                >
                  {t("earlyDiagnosis.cancel", "Cancel")}
                </button>
                <button
                  className="mp-btn-save"
                  onClick={handleUploadSectionFile}
                  disabled={isUploadingSectionFile}
                >
                  {isUploadingSectionFile
                    ? t("earlyDiagnosis.saving", "Saving...")
                    : t("earlyDiagnosis.upload", "Upload")}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ── Manual Payment Modal ── */}
      {showManualPaymentForm &&
        createPortal(
          <div
            className="mp-modal-overlay"
            onClick={() => setShowManualPaymentForm(false)}
          >
            <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
              <div className="mp-modal-header">
                <h3>{t("earlyDiagnosis.manualPaymentEntry")}</h3>
                <button
                  className="mp-modal-close"
                  onClick={() => setShowManualPaymentForm(false)}
                >
                  ×
                </button>
              </div>

              <div className="mp-modal-body">
                {/* Package Selection */}
                <div className="mp-section">
                  <h4 className="mp-section-title">
                    {t("earlyDiagnosis.selectPackageAddons")}
                  </h4>

                  <label className="mp-field-label">
                    {t("earlyDiagnosis.mainPackage")}
                  </label>
                  <div className="mp-packages">
                    {ED_PACKAGES.map((pkg) => (
                      <label
                        key={pkg.id}
                        className={`mp-package-card${manualSelectedPkg === pkg.id ? " mp-package-card--active" : ""}`}
                      >
                        <input
                          type="radio"
                          name="mp-pkg"
                          value={pkg.id}
                          checked={manualSelectedPkg === pkg.id}
                          onChange={() => setManualSelectedPkg(pkg.id)}
                          style={{ display: "none" }}
                        />
                        <span className="mp-package-name">{pkg.name}</span>
                        <span className="mp-package-price">
                          {pkg.price.toLocaleString()} ₽
                        </span>
                      </label>
                    ))}
                  </div>

                  <label
                    className="mp-field-label"
                    style={{ marginTop: "12px" }}
                  >
                    {t("earlyDiagnosis.addons")}
                  </label>
                  <div className="mp-addons">
                    {ED_ADDONS.map((addon) => {
                      const isOn = manualSelectedAddons.includes(addon.id);
                      return (
                        <label
                          key={addon.id}
                          className={`mp-addon-row${isOn ? " mp-addon-row--active" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={isOn}
                            onChange={() => toggleManualAddon(addon.id)}
                          />
                          <span className="mp-addon-name">{addon.name}</span>
                          <span className="mp-addon-price">
                            {addon.price.toLocaleString()} ₽
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="mp-total-row">
                    <span>{t("earlyDiagnosis.selectedTotal")}</span>
                    <span className="mp-total-value">
                      {manualTotal.toLocaleString()} ₽
                    </span>
                  </div>
                </div>

                {/* Payment Details */}
                <div className="mp-section">
                  <div className="mp-field">
                    <label className="mp-field-label">
                      {t("earlyDiagnosis.paymentStatusLabel")}
                    </label>
                    <select
                      value={manualPayment.paymentStatus}
                      onChange={(e) =>
                        setManualPayment((p) => ({
                          ...p,
                          paymentStatus: e.target.value,
                        }))
                      }
                      className="mp-select"
                    >
                      <option value="paid">
                        {t("earlyDiagnosis.status_paid")}
                      </option>
                      <option value="pending">
                        {t("earlyDiagnosis.status_pending")}
                      </option>
                      <option value="processing">
                        {t("earlyDiagnosis.status_processing")}
                      </option>
                      <option value="failed">
                        {t("earlyDiagnosis.status_failed")}
                      </option>
                      <option value="refunded">
                        {t("earlyDiagnosis.status_refunded")}
                      </option>
                    </select>
                  </div>

                  <div className="mp-field">
                    <label className="mp-field-label">
                      {t("earlyDiagnosis.transactionId")}
                    </label>
                    <input
                      type="text"
                      value={manualPayment.transactionId}
                      onChange={(e) =>
                        setManualPayment((p) => ({
                          ...p,
                          transactionId: e.target.value,
                        }))
                      }
                      placeholder={t("earlyDiagnosis.enterTransactionId")}
                      className="mp-input"
                    />
                  </div>

                  <div className="mp-field">
                    <label className="mp-field-label">
                      {t("earlyDiagnosis.notesLabel")}
                    </label>
                    <textarea
                      value={manualPayment.notes}
                      onChange={(e) =>
                        setManualPayment((p) => ({
                          ...p,
                          notes: e.target.value,
                        }))
                      }
                      placeholder={t("earlyDiagnosis.enterNotes")}
                      className="mp-textarea"
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              <div className="mp-modal-footer">
                <button
                  className="mp-btn-cancel"
                  onClick={() => setShowManualPaymentForm(false)}
                  disabled={isSavingManual}
                >
                  {t("earlyDiagnosis.cancel")}
                </button>
                <button
                  className="mp-btn-save"
                  onClick={handleManualPaymentSave}
                  disabled={isSavingManual}
                >
                  {isSavingManual
                    ? t("earlyDiagnosis.saving")
                    : t("earlyDiagnosis.savePayment")}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

export default EDModals;
