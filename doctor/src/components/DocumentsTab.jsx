import React, { useState, useRef } from "react";
import {
  FiEye,
  FiDownload,
  FiUpload,
  FiLink,
  FiCheckCircle,
  FiClock,
  FiXCircle,
} from "react-icons/fi";
import { LuFileText } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import {
  viewDocument,
  downloadDocument,
  uploadDocumentFile,
  uploadDocumentUrl,
  getApplication,
} from "../utils/api";
import { toast } from "react-toastify";
import moment from "moment-timezone";
import "./DocumentsTab.css";

const getFileType = (filename = "") => {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return "image";
  if (["doc", "docx"].includes(ext)) return "word";
  if (["xls", "xlsx", "csv"].includes(ext)) return "excel";
  return "file";
};

const TYPE_LABELS = { pdf: "PDF", image: "IMG", word: "DOC", excel: "XLS", file: "FILE" };

const DocumentsTab = ({ application }) => {
  const { t } = useTranslation();
  const [docs, setDocs] = useState(application?.documents || []);
  const [loadingDocs, setLoadingDocs] = useState({});
  const [uploadMode, setUploadMode] = useState("file");
  const [selectedFile, setSelectedFile] = useState(null);
  const [urlValue, setUrlValue] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const refreshDocs = async () => {
    try {
      const refreshed = await getApplication(application.applicationId);
      setDocs(refreshed?.data?.documents || []);
    } catch { /* non-critical */ }
  };

  const setDocLoading = (key, val) =>
    setLoadingDocs((prev) => ({ ...prev, [key]: val }));

  const handleView = async (doc, e) => {
    e.stopPropagation();
    if (doc.url && !doc.fileId) {
      window.open(doc.url, "_blank", "noopener,noreferrer");
      return;
    }
    const docId = doc._id || doc.fileId;
    setDocLoading(`view-${docId}`, true);
    try {
      await viewDocument(docId);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setDocLoading(`view-${docId}`, false);
    }
  };

  const handleDownload = async (doc, e) => {
    e.stopPropagation();
    const docId = doc._id || doc.fileId;
    setDocLoading(`download-${docId}`, true);
    try {
      await downloadDocument(docId, doc.filename || "document");
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setDocLoading(`download-${docId}`, false);
    }
  };

  const handleAdd = async () => {
    if (uploading) return;
    if (uploadMode === "file" && !selectedFile) { toast.warn(t("appointment.selectFileFirst", "Select a file first")); return; }
    if (uploadMode === "url" && !urlValue.trim()) { toast.warn(t("appointment.enterUrl", "Enter a URL")); return; }
    setUploading(true);
    try {
      if (uploadMode === "file") {
        await uploadDocumentFile(application.applicationId, selectedFile);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        await uploadDocumentUrl(application.applicationId, urlValue.trim());
        setUrlValue("");
      }
      toast.success(t("appointment.toast.documentUploaded", "Document added"));
      await refreshDocs();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setUploading(false);
    }
  };

  const canAdd = uploadMode === "file" ? !!selectedFile : !!urlValue.trim();

  const renderTypeChip = (filename) => {
    const type = getFileType(filename);
    return <span className={`dt-type-chip dt-type-chip--${type}`}>{TYPE_LABELS[type]}</span>;
  };

  const renderStatus = (status) => {
    if (!status) return null;
    const map = {
      Verified: { icon: <FiCheckCircle size={11} />, cls: "verified" },
      "Under Review": { icon: <FiClock size={11} />, cls: "review" },
      Disapproved: { icon: <FiXCircle size={11} />, cls: "disapproved" },
    };
    const entry = map[status] || { icon: null, cls: "default" };
    return (
      <span className={`dt-status dt-status--${entry.cls}`}>
        {entry.icon}{status}
      </span>
    );
  };

  return (
    <div className="dt-container">
      <div className="dt-toolbar">
        <div className="dt-mode-group">
          <button className={`dt-mode-btn${uploadMode === "file" ? " dt-mode-btn--active" : ""}`} onClick={() => setUploadMode("file")}>
            <FiUpload size={13} />{t("appointment.chooseFile", "Choose file")}
          </button>
          <button className={`dt-mode-btn${uploadMode === "url" ? " dt-mode-btn--active" : ""}`} onClick={() => setUploadMode("url")}>
            <FiLink size={13} />URL
          </button>
        </div>

        {uploadMode === "file" ? (
          <label className={`dt-file-label${uploading ? " dt-file-label--disabled" : ""}`}>
            <FiUpload size={13} />
            {selectedFile ? selectedFile.name : t("appointment.chooseFile", "Choose file")}
            <input ref={fileInputRef} type="file" className="dt-file-input"
              onChange={(e) => setSelectedFile(e.target.files[0] || null)} disabled={uploading} />
          </label>
        ) : (
          <input type="url" className="dt-url-input" placeholder="https://..."
            value={urlValue} onChange={(e) => setUrlValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && canAdd && handleAdd()} disabled={uploading} />
        )}

        <button className="dt-add-btn" onClick={handleAdd} disabled={!canAdd || uploading}>
          {uploading ? t("appointment.uploading", "Uploading…") : t("appointment.add", "Add")}
        </button>
      </div>

      {docs.length === 0 ? (
        <div className="dt-empty">
          <LuFileText size={42} className="dt-empty-icon" />
          <p className="dt-empty-title">{t("appointment.noDocuments", "No documents uploaded yet")}</p>
          <p className="dt-empty-text">{t("appointment.noDocumentsHint", "Upload a file or add a URL link above.")}</p>
        </div>
      ) : (
        <div className="dt-list">
          {docs.map((doc) => {
            const docId = doc._id || doc.fileId;
            const filename = doc.filename || "Document";
            const uploadedAt = doc.uploadedAt
              ? moment(doc.uploadedAt).tz("Europe/Moscow").format("DD.MM.YYYY HH:mm")
              : null;
            return (
              <div key={docId} className="dt-item">
                <div className="dt-item-icon-col">{renderTypeChip(filename)}</div>
                <div className="dt-item-body">
                  <span className="dt-item-name">{filename}</span>
                  <div className="dt-item-meta">
                    {uploadedAt && <span className="dt-item-date">{uploadedAt}</span>}
                    {renderStatus(doc.verificationStatus)}
                  </div>
                </div>
                <div className="dt-item-actions">
                  <button className="dt-action-btn dt-action-btn--view"
                    onClick={(e) => handleView(doc, e)} disabled={loadingDocs[`view-${docId}`]}>
                    <FiEye size={13} />{loadingDocs[`view-${docId}`] ? "…" : t("appointment.view", "View")}
                  </button>
                  {!(doc.url && !doc.fileId) && (
                    <button className="dt-action-btn dt-action-btn--download"
                      onClick={(e) => handleDownload(doc, e)} disabled={loadingDocs[`download-${docId}`]}>
                      <FiDownload size={13} />{loadingDocs[`download-${docId}`] ? "…" : t("appointment.download", "Download")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DocumentsTab;
