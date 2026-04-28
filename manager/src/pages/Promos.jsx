import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, EffectFade, Navigation } from "swiper/modules";
import CommonRichTextEditor from "../components/RichTextEditor/CommonRichTextEditor";
import BannerDescriptionEditor from "../components/RichTextEditor/BannerDescriptionEditor";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import "swiper/css";
import "swiper/css/effect-fade";
import "swiper/css/navigation";
import "../styles/Promos.css";
import { 
  getPromos, 
  getActivePromos, 
  addPromo, 
  updatePromo, 
  deletePromo, 
  reorderPromos,
  getPromoFileUrl,
} from "../utils/api";

// Sortable Promo Card Component
const SortablePromoCard = ({ promo, onEdit, onDelete, currentLanguage, t, getPromoStatus, getStatusColor }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: promo._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const status = getPromoStatus(promo);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="promo-card"
    >
      <div className="promo-card-header">
        <div className="promo-card-info">
          <span className="promo-order">#{promo.order}</span>
          <span 
            className="promo-status"
            style={{ backgroundColor: getStatusColor(status) }}
          >
            {t(`promos.status_${status}`)}
          </span>
        </div>
        <div className="promo-card-actions">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(promo);
            }}
            className="promo-edit-button"
          >
            {t("promos.edit")}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(promo._id);
            }}
            className="promo-delete-button"
          >
            {t("promos.delete")}
          </button>
        </div>
      </div>
      
      <div className="promo-card-content">
        <div className="promo-thumbnail">
          {promo.fileType === "image" || promo.fileType === "gif" ? (
            <img
              src={getPromoFileUrl(promo.fileId)}
              alt={promo.filename}
              className="promo-thumbnail-image"
            />
          ) : (
            <div className="promo-thumbnail-video">
              <span>??</span>
            </div>
          )}
        </div>
        
        <div className="promo-details">
          <h4 className="promo-detail-title">
            {promo.promoBannerTitle?.[currentLanguage] ? (
              <div dangerouslySetInnerHTML={{ __html: promo.promoBannerTitle[currentLanguage] }} />
            ) : promo.promoBannerTitle?.en ? (
              <div dangerouslySetInnerHTML={{ __html: promo.promoBannerTitle.en }} />
            ) : (
              t("promos.no_title")
            )}
          </h4>
          <div className="promo-meta">
            <span className="promo-meta-item">
              {t("promos.filename")}: {promo.filename}
            </span>
            <span className="promo-meta-item">
              {t("promos.type")}: {t(`promos.${promo.fileType}`)}
            </span>
            <span className="promo-meta-item">
              {t("promos.starts")}: {new Date(promo.startDate).toLocaleDateString()}
            </span>
            {promo.endDate && (
              <span className="promo-meta-item">
                {t("promos.ends")}: {new Date(promo.endDate).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Preset images available in /public
const PRESET_IMAGES = ["/so-1.png", "/so-3.png", "/so-4.png"];

// Promo Form Popup Component
const PromoFormPopup = ({ isOpen, onClose, onSubmit, editingPromo, promos, t }) => {
  const [formData, setFormData] = useState({
    title: { en: "", ru: "" },
    description: { en: "", ru: "" },
    promoBannerTitle: { en: "", ru: "" },
    promoBannerDescription: { en: "", ru: "" },
    startDate: "",
    endDate: "",
    isActive: true,
    startColor: "#47a4d7",
    endColor: "#1cabe9",
  });
  const [file, setFile] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Keep preview URL in sync with selected file
  useEffect(() => {
    if (file instanceof File) {
      const url = URL.createObjectURL(file);
      setFilePreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (editingPromo?.fileId) {
      setFilePreviewUrl(getPromoFileUrl(editingPromo.fileId));
    } else {
      setFilePreviewUrl(null);
    }
  }, [file, editingPromo, isOpen]);

  useEffect(() => {
    if (editingPromo) {
      setFormData({
        title: editingPromo.title || { en: "", ru: "" },
        description: editingPromo.description || { en: "", ru: "" },
        promoBannerTitle: editingPromo.promoBannerTitle || { en: "", ru: "" },
        promoBannerDescription: editingPromo.promoBannerDescription || { en: "", ru: "" },
        startDate: editingPromo.startDate ? new Date(editingPromo.startDate).toISOString().split('T')[0] : "",
        endDate: editingPromo.endDate ? new Date(editingPromo.endDate).toISOString().split('T')[0] : "",
        isActive: editingPromo.isActive,
        startColor: editingPromo.startColor || "#47a4d7",
        endColor: editingPromo.endColor || "#1cabe9",
      });
    } else {
      setFormData({
        title: { en: "", ru: "" },
        description: { en: "", ru: "" },
        promoBannerTitle: { en: "", ru: "" },
        promoBannerDescription: { en: "", ru: "" },
        startDate: "",
        endDate: "",
        isActive: true,
        startColor: "#47a4d7",
        endColor: "#1cabe9",
      });
    }
    setFile(null);
    setRemoveFile(false);
    // Restore preset selection if the saved file matches one of the presets
    if (editingPromo?.filename) {
      const matched = PRESET_IMAGES.find(
        (src) => src.split("/").pop() === editingPromo.filename
      );
      setSelectedPreset(matched || null);
    } else {
      setSelectedPreset(null);
    }
  }, [editingPromo, isOpen]);

  const handleInputChange = (field, value, language = null) => {
    if (language) {
      setFormData(prev => ({
        ...prev,
        [field]: {
          ...prev[field],
          [language]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleRichTextChange = (field, language, data) => {
    setFormData(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        [language]: data
      }
    }));
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setSelectedPreset(null);
    setRemoveFile(false);
  };

  const handlePresetSelect = async (src) => {
    if (selectedPreset === src) {
      // deselect — if this was the saved file, mark it for removal
      setSelectedPreset(null);
      setFile(null);
      if (editingPromo?.fileId) setRemoveFile(true);
      return;
    }
    setRemoveFile(false);
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const filename = src.split("/").pop();
      const presetFile = new File([blob], filename, { type: blob.type });
      setFile(presetFile);
      setSelectedPreset(src);
    } catch {
      // silently ignore fetch errors
    }
  };

  const BANNER_TITLE_LIMIT = 80;
  const BANNER_DESC_LIMIT = 200;

  const validateForm = () => {
    const stripHtml = (html) => {
      const tmp = document.createElement("div");
      tmp.innerHTML = html;
      return tmp.textContent || tmp.innerText || "";
    };
    
    const englishTitleText = stripHtml(formData.promoBannerTitle.en).trim();
    if (!englishTitleText) {
      toast.error(t("promos.english_title_required"));
      return false;
    }

    // Banner title length check
    const bannerTitleEnText = stripHtml(formData.promoBannerTitle.en).trim();
    const bannerTitleRuText = stripHtml(formData.promoBannerTitle.ru).trim();
    if (bannerTitleEnText.length > BANNER_TITLE_LIMIT) {
      toast.error(`Banner Title (EN) exceeds ${BANNER_TITLE_LIMIT} character limit (${bannerTitleEnText.length}/${BANNER_TITLE_LIMIT})`);
      return false;
    }
    if (bannerTitleRuText.length > BANNER_TITLE_LIMIT) {
      toast.error(`Banner Title (RU) exceeds ${BANNER_TITLE_LIMIT} character limit (${bannerTitleRuText.length}/${BANNER_TITLE_LIMIT})`);
      return false;
    }

    // Banner description length check
    const bannerDescEnText = stripHtml(formData.promoBannerDescription.en).trim();
    const bannerDescRuText = stripHtml(formData.promoBannerDescription.ru).trim();
    if (bannerDescEnText.length > BANNER_DESC_LIMIT) {
      toast.error(`Banner Description (EN) exceeds ${BANNER_DESC_LIMIT} character limit (${bannerDescEnText.length}/${BANNER_DESC_LIMIT})`);
      return false;
    }
    if (bannerDescRuText.length > BANNER_DESC_LIMIT) {
      toast.error(`Banner Description (RU) exceeds ${BANNER_DESC_LIMIT} character limit (${bannerDescRuText.length}/${BANNER_DESC_LIMIT})`);
      return false;
    }
    
    if (!formData.startDate) {
      toast.error(t("promos.start_date_required"));
      return false;
    }
    
    if (formData.endDate && new Date(formData.startDate) > new Date(formData.endDate)) {
      toast.error(t("promos.invalid_date_range"));
      return false;
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setUploading(true);
    try {
      const submitData = new FormData();
      
      if (file) {
        submitData.append("promoFile", file);
      } else if (editingPromo && removeFile) {
        submitData.append("removeFile", "true");
      }
      
      // For edits, preserve the existing order
      if (editingPromo) {
        submitData.append("order", editingPromo.order);
      }
      submitData.append("description", JSON.stringify(formData.description));
      submitData.append("startDate", formData.startDate);
      submitData.append("endDate", formData.endDate || "");
      submitData.append("isActive", formData.isActive);
      submitData.append("startColor", formData.startColor || "#47a4d7");
      submitData.append("endColor", formData.endColor || "#1cabe9");
      submitData.append("promoBannerTitle", JSON.stringify(formData.promoBannerTitle));
      submitData.append("promoBannerDescription", JSON.stringify(formData.promoBannerDescription));

      await onSubmit(submitData, editingPromo);
      onClose();
    } catch (error) {
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="promo-popup-overlay">
      <div className="promo-popup">
        <div className="promo-popup-header">
          <h3 className="promo-popup-title">
            {editingPromo ? t("promos.edit_promo") : t("promos.create_promo")}
          </h3>
          <button className="promo-popup-close" onClick={onClose}>&times;</button>
        </div>

        <div className="promo-popup-content">
          {/* Website Live Preview */}
          <div className="promo-form-section-title">
            <span>🌐 WEBSITE LIVE PREVIEW</span>
          </div>
          <div
            className={`promo-website-preview-banner${filePreviewUrl ? " has-media" : ""}`}
            style={{
              background: `linear-gradient(135deg, ${formData.startColor}, ${formData.endColor})`,
            }}
          >
            <div className="promo-banner-pattern"></div>
            <div className="promo-preview-content">
              <h1 className="promo-preview-title">
                {formData.promoBannerTitle.en || formData.title.en
                  ? <span dangerouslySetInnerHTML={{ __html: formData.promoBannerTitle.en
                      ? formData.promoBannerTitle.en
                      : formData.title.en }} />
                  : "Promo title"}
              </h1>
              {(formData.promoBannerDescription.en || formData.description.en) && (
                <div
                  className="promo-preview-desc"
                  dangerouslySetInnerHTML={{ __html: formData.promoBannerDescription.en || formData.description.en }}
                />
              )}
            </div>
            {filePreviewUrl && (
              <div className="promo-preview-media-wrapper">
                {(file instanceof File ? file.type : (editingPromo?.fileType === "video" ? "video/" : "")).startsWith("video") ? (
                  <video src={filePreviewUrl} autoPlay muted loop className="promo-preview-banner-media" />
                ) : (
                  <img src={filePreviewUrl} alt="Preview" className="promo-preview-banner-media" />
                )}
                <div className="promo-preview-media-overlay" style={{
                  background: `linear-gradient(to right, ${formData.startColor} 0%, transparent 100%)`
                }}></div>
              </div>
            )}
          </div>

          {/* Color Pickers */}
          <div className="promo-form-grid">
            <div className="promo-form-group">
              <label className="promo-form-label">{t("promos.start_color") || "Start color"}</label>
              <div className="promo-color-input-wrapper">
                <input
                  type="color"
                  value={formData.startColor}
                  onChange={(e) => handleInputChange("startColor", e.target.value)}
                  className="promo-color-input"
                />
                <span className="promo-color-value">{formData.startColor}</span>
              </div>
            </div>
            <div className="promo-form-group">
              <label className="promo-form-label">{t("promos.end_color") || "End color"}</label>
              <div className="promo-color-input-wrapper">
                <input
                  type="color"
                  value={formData.endColor}
                  onChange={(e) => handleInputChange("endColor", e.target.value)}
                  className="promo-color-input"
                />
                <span className="promo-color-value">{formData.endColor}</span>
              </div>
            </div>
          </div>

          <div className="promo-form-grid">
            {/* File selector */}
            <div className="promo-form-group full-width">
              <label className="promo-form-label">{t("promos.promo_file")}</label>

              {/* Hidden real file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,video/mp4,image/gif"
                onChange={handleFileChange}
                className="promo-file-input"
                id="promo-file-input"
                style={{ display: "none" }}
              />

              {/* Preset grid + "+" upload button */}
              <div className="promo-preset-grid">
                {PRESET_IMAGES.map((src) => (
                  <button
                    key={src}
                    type="button"
                    className={`promo-preset-thumb${selectedPreset === src ? " selected" : ""}`}
                    onClick={() => handlePresetSelect(src)}
                    title={src.split("/").pop()}
                  >
                    <img src={src} alt={src.split("/").pop()} />
                    {selectedPreset === src && (
                      <span className="promo-preset-check">✓</span>
                    )}
                  </button>
                ))}

                {/* 4th option: custom file upload */}
                <button
                  type="button"
                  className={`promo-preset-thumb promo-preset-upload${file && !selectedPreset ? " selected" : ""}`}
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload custom file"
                >
                  {file && !selectedPreset ? (
                    <>
                      <img src={filePreviewUrl} alt={file.name} />
                      <span className="promo-preset-check">✓</span>
                    </>
                  ) : (
                    <span className="promo-preset-plus">+</span>
                  )}
                </button>
              </div>

              {/* File type / size info */}
              <p className="promo-file-info-text">
                <span className="promo-file-info-icon">ℹ️</span>
                {t("promos.file_info_supported")}: <strong>JPG, PNG, GIF, MP4</strong> &nbsp;·&nbsp; {t("promos.file_info_max_size")}: <strong>2 MB</strong>
              </p>

              {/* Selected file name hint */}
              {file && (
                <p className="promo-file-hint" style={{ marginTop: 8 }}>
                  {selectedPreset ? selectedPreset.split("/").pop() : file.name}
                  <button
                    type="button"
                    className="promo-preset-clear"
                    onClick={() => { setFile(null); setSelectedPreset(null); if (editingPromo?.fileId) setRemoveFile(true); }}
                  >✕</button>
                </p>
              )}
              {!file && editingPromo?.filename && !removeFile && (
                <p className="promo-file-hint" style={{ marginTop: 8 }}>
                  {t("promos.current_file")}: {editingPromo.filename}
                  <button
                    type="button"
                    className="promo-preset-clear"
                    onClick={() => { setRemoveFile(true); setSelectedPreset(null); }}
                  >✕</button>
                </p>
              )}
              {removeFile && !file && (
                <p className="promo-file-hint" style={{ marginTop: 8, color: "#ef4444" }}>
                  Image will be removed on save
                  <button
                    type="button"
                    className="promo-preset-clear"
                    style={{ color: "#6366f1" }}
                    onClick={() => {
                      setRemoveFile(false);
                      if (editingPromo?.filename) {
                        const matched = PRESET_IMAGES.find(s => s.split("/").pop() === editingPromo.filename);
                        setSelectedPreset(matched || null);
                      }
                    }}
                  >Undo</button>
                </p>
              )}
            </div>

            {/* Banner Title & Description divider */}
            <div className="promo-form-group full-width">
              <div className="promo-section-divider">
                <span>🎯 {t("promos.banner_section") || "Website Banner Text"}</span>
              </div>
            </div>

            {/* Banner Title - English */}
            <div className="promo-form-group full-width">
              <label className="promo-form-label">{t("promos.banner_title_english") || "Banner Title (EN)"}</label>
              <BannerDescriptionEditor
                hideToolbar
                value={formData.promoBannerTitle.en}
                onChange={(data) => handleRichTextChange("promoBannerTitle", "en", data)}
                placeholder="Enter banner title in English"
              />
              {(() => {
                const tmp = document.createElement("div");
                tmp.innerHTML = formData.promoBannerTitle.en || "";
                const len = (tmp.textContent || tmp.innerText || "").trim().length;
                return (
                  <span className={`promo-char-counter${len > BANNER_TITLE_LIMIT ? " over" : len > BANNER_TITLE_LIMIT * 0.85 ? " warn" : ""}`}>
                    {len} / {BANNER_TITLE_LIMIT}
                  </span>
                );
              })()}
            </div>

            {/* Banner Title - Russian */}
            <div className="promo-form-group full-width">
              <label className="promo-form-label">{t("promos.banner_title_russian") || "Banner Title (RU)"}</label>
              <BannerDescriptionEditor
                hideToolbar
                value={formData.promoBannerTitle.ru}
                onChange={(data) => handleRichTextChange("promoBannerTitle", "ru", data)}
                placeholder="Введите заголовок баннера…"
              />
              {(() => {
                const tmp = document.createElement("div");
                tmp.innerHTML = formData.promoBannerTitle.ru || "";
                const len = (tmp.textContent || tmp.innerText || "").trim().length;
                return (
                  <span className={`promo-char-counter${len > BANNER_TITLE_LIMIT ? " over" : len > BANNER_TITLE_LIMIT * 0.85 ? " warn" : ""}`}>
                    {len} / {BANNER_TITLE_LIMIT}
                  </span>
                );
              })()}
            </div>

            {/* Banner Description - English */}
            <div className="promo-form-group full-width">
              <label className="promo-form-label">{t("promos.banner_description_english") || "Banner Description (EN)"}</label>
              <BannerDescriptionEditor
                value={formData.promoBannerDescription.en}
                onChange={(data) => handleRichTextChange("promoBannerDescription", "en", data)}
                placeholder="Enter banner description in English"
              />
              {(() => {
                const tmp = document.createElement("div");
                tmp.innerHTML = formData.promoBannerDescription.en || "";
                const len = (tmp.textContent || tmp.innerText || "").trim().length;
                return (
                  <span className={`promo-char-counter${len > BANNER_DESC_LIMIT ? " over" : len > BANNER_DESC_LIMIT * 0.85 ? " warn" : ""}`}>
                    {len} / {BANNER_DESC_LIMIT}
                  </span>
                );
              })()}
            </div>

            {/* Banner Description - Russian */}
            <div className="promo-form-group full-width">
              <label className="promo-form-label">{t("promos.banner_description_russian") || "Banner Description (RU)"}</label>
              <BannerDescriptionEditor
                value={formData.promoBannerDescription.ru}
                onChange={(data) => handleRichTextChange("promoBannerDescription", "ru", data)}
                placeholder="Введите текст…"
              />
              {(() => {
                const tmp = document.createElement("div");
                tmp.innerHTML = formData.promoBannerDescription.ru || "";
                const len = (tmp.textContent || tmp.innerText || "").trim().length;
                return (
                  <span className={`promo-char-counter${len > BANNER_DESC_LIMIT ? " over" : len > BANNER_DESC_LIMIT * 0.85 ? " warn" : ""}`}>
                    {len} / {BANNER_DESC_LIMIT}
                  </span>
                );
              })()}
            </div>

            {/* Description - English */}
            <div className="promo-form-group full-width">
              <label className="promo-form-label">{t("promos.description_english")}</label>
              <div className="rich-text-editor">
                <CommonRichTextEditor
                  value={formData.description.en}
                  onChange={(data) => handleRichTextChange("description", "en", data)}
                />
              </div>
            </div>

            {/* Description - Russian */}
            <div className="promo-form-group full-width">
              <label className="promo-form-label">{t("promos.description_russian")}</label>
              <div className="rich-text-editor">
                <CommonRichTextEditor
                  value={formData.description.ru}
                  onChange={(data) => handleRichTextChange("description", "ru", data)}
                />
              </div>
            </div>

            {/* Start Date */}
            <div className="promo-form-group">
              <label className="promo-form-label">{t("promos.start_date")} *</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => handleInputChange("startDate", e.target.value)}
                className="promo-form-input"
              />
            </div>

            {/* End Date */}
            <div className="promo-form-group">
              <label className="promo-form-label">{t("promos.end_date")}</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => handleInputChange("endDate", e.target.value)}
                className="promo-form-input"
              />
            </div>

            {/* Active Status */}
            <div className="promo-form-group">
              <label className="promo-form-label">{t("promos.status")}</label>
              <div className="promo-checkbox">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => handleInputChange("isActive", e.target.checked)}
                  className="promo-checkbox-input"
                />
                <span className="promo-checkbox-label">{t("promos.active")}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="promo-popup-actions">
          <button
            onClick={handleSubmit}
            disabled={uploading}
            className="promo-submit-button"
          >
            {uploading ? t("promos.saving") : (editingPromo ? t("promos.update") : t("promos.create"))}
          </button>
          <button
            onClick={onClose}
            className="promo-cancel-button"
          >
            {t("promos.cancel")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Main Promos Component
const Promos = () => {
  const { t, i18n } = useTranslation();
  const [promos, setPromos] = useState([]);
  const [activePromos, setActivePromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFormPopupOpen, setIsFormPopupOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);
  const [activeDragId, setActiveDragId] = useState(null);
  
  const swiperRef = useRef(null);
  const videoRefs = useRef({});

  const currentLanguage = i18n.language;

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Require 5px movement to start drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchPromos();
    fetchActivePromos();
  }, [i18n.language]);

  const fetchPromos = async () => {
    try {
      const response = await getPromos();
      setPromos(response.promos || []);
      setLoading(false);
    } catch (err) {
      setError(t("promos.error_fetch"));
      setLoading(false);
      toast.error(t("promos.error_fetch"));
    }
  };

  const fetchActivePromos = async () => {
    try {
      const response = await getActivePromos({ lang: i18n.language });
      setActivePromos(response.promos || []);
    } catch (err) {
    }
  };

  const handleFormSubmit = async (formData, editingPromo) => {
    try {
      if (editingPromo) {
        await updatePromo(editingPromo._id, formData);
        toast.success(t("promos.promo_updated"));
      } else {
        await addPromo(formData);
        toast.success(t("promos.promo_created"));
      }
      fetchPromos();
      fetchActivePromos();
    } catch (error) {
      toast.error(error.response?.data?.message || t("promos.upload_failed"));
      throw error;
    }
  };

  const handleEdit = (promo) => {
    setEditingPromo(promo);
    setIsFormPopupOpen(true);
  };

  const handleAdd = () => {
    setEditingPromo(null);
    setIsFormPopupOpen(true);
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: t("promos.delete_confirmation_title"),
      text: t("promos.delete_confirmation_text"),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: t("promos.delete_confirm"),
      cancelButtonText: t("promos.delete_cancel"),
      reverseButtons: true,
    });

    if (result.isConfirmed) {
      try {
        await deletePromo(id);
        toast.success(t("promos.promo_deleted"));
        fetchPromos();
        fetchActivePromos();
      } catch (error) {
        toast.error(error.response?.data?.message || t("promos.delete_failed"));
      }
    }
  };

  // DnD Handlers
  const handleDragStart = (event) => {
    setActiveDragId(event.active.id);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (active.id !== over?.id) {
      const oldIndex = promos.findIndex((item) => item._id === active.id);
      const newIndex = promos.findIndex((item) => item._id === over.id);

      const newPromos = arrayMove(promos, oldIndex, newIndex);
      const updatedPromos = newPromos.map((promo, index) => ({
        ...promo,
        order: index + 1,
      }));

      setPromos(updatedPromos);

      try {
        const reorderData = updatedPromos.map((promo, index) => ({
          id: promo._id,
          order: index + 1,
        }));
        await reorderPromos(reorderData);
        toast.success(t("promos.promos_reordered"));
      } catch (error) {
        toast.error(t("promos.reorder_failed"));
        fetchPromos(); // Revert on error
      }
    }
  };

  const getPromoStatus = (promo) => {
    const now = new Date();
    const start = new Date(promo.startDate);
    const end = promo.endDate ? new Date(promo.endDate) : null;

    if (!promo.isActive) return "inactive";
    if (start > now) return "scheduled";
    if (end && end < now) return "expired";
    return "active";
  };

  const getStatusColor = (status) => {
    const colors = {
      active: "#10b981",
      scheduled: "#f59e0b",
      expired: "#ef4444",
      inactive: "#6b7280"
    };
    return colors[status] || "#6b7280";
  };

  const resetVideo = (video) => {
    if (video) {
      video.currentTime = 0;
      video.pause();
    }
  };

  const handleSlideChange = (swiper) => {
    const activeIndex = swiper.realIndex;
    const activePromo = activePromos[activeIndex];
    Object.values(videoRefs.current).forEach((video) => resetVideo(video));
    if (activePromo && activePromo.fileType === "video") {
      swiper.autoplay.stop();
      const video = videoRefs.current[activeIndex];
      if (video) {
        video.play().catch(() => {});
      }
    } else {
      swiper.autoplay.start();
    }
  };

  const handleVideoEnd = (swiper, index) => {
    resetVideo(videoRefs.current[index]);
    swiper.autoplay.start();
    swiper.slideNext();
  };

  const activePromo = activeDragId ? promos.find(p => p._id === activeDragId) : null;

  return (
    <div className="promo-management-system">
      {/* Header Section */}
      <div className="promo-header">
        <div className="promo-header-content">
          <h1 className="promo-title">{t("promos.title")}</h1>
        </div>
        <button
          className="promo-add-button"
          onClick={handleAdd}
        >
          {t("promos.add_promo")}
        </button>
      </div>

      {/* Form Popup */}
      <PromoFormPopup
        isOpen={isFormPopupOpen}
        onClose={() => setIsFormPopupOpen(false)}
        onSubmit={handleFormSubmit}
        editingPromo={editingPromo}
        promos={promos}
        t={t}
      />

      {/* Live Preview Section - Text Overlay on Media */}
      <div className="promo-preview-section">
        <h3 className="promo-section-title">{t("promos.live_preview")}</h3>
        <div className="promo-swiper-container">
          <Swiper
            modules={[Autoplay, EffectFade, Navigation]}
            autoplay={{ delay: 5000, disableOnInteraction: false }}
            effect="fade"
            loop={activePromos.length > 1}
            className="promo-swiper"
            onSwiper={(swiper) => (swiperRef.current = swiper)}
            onSlideChange={handleSlideChange}
          >
            {activePromos.length > 0 ? (
              activePromos.map((promo, index) => (
                <SwiperSlide key={promo._id}>
                  <div
                    className={`promo-slide promo-slide-banner${promo.fileId ? " has-media" : ""}`}
                    style={{
                      background: `linear-gradient(135deg, ${promo.startColor || "#47a4d7"}, ${promo.endColor || "#1cabe9"})`,
                    }}
                  >
                    {/* Wave pattern */}
                    <div className="promo-slide-pattern" />

                    {/* Text — left side */}
                    <div className="promo-slide-content">
                      {(promo.currentBannerTitle || promo.currentTitle) && (
                        <div
                          className="promo-slide-title"
                          dangerouslySetInnerHTML={{ __html: promo.currentBannerTitle || promo.currentTitle }}
                        />
                      )}
                      {(promo.currentBannerDescription || promo.currentDescription) && (
                        <div
                          className="promo-slide-description"
                          dangerouslySetInnerHTML={{ __html: promo.currentBannerDescription || promo.currentDescription }}
                        />
                      )}
                    </div>

                    {/* Media — right side */}
                    {promo.fileId && (
                      <div className="promo-slide-media-wrapper">
                        {promo.fileType === "video" ? (
                          <video
                            ref={(el) => (videoRefs.current[index] = el)}
                            src={getPromoFileUrl(promo.fileId)}
                            muted
                            className="promo-slide-media"
                            onEnded={() => handleVideoEnd(swiperRef.current, index)}
                          />
                        ) : (
                          <img
                            src={getPromoFileUrl(promo.fileId)}
                            alt={promo.currentTitle || promo.filename}
                            className="promo-slide-media"
                          />
                        )}
                        <div
                          className="promo-slide-media-fade"
                          style={{
                            background: `linear-gradient(to right, ${promo.startColor || "#47a4d7"} 0%, transparent 60%)`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </SwiperSlide>
              ))
            ) : (
              <SwiperSlide>
                <div className="promo-no-content">
                  <p className="promo-no-content-text">{t("promos.no_active_promos")}</p>
                </div>
              </SwiperSlide>
            )}
          </Swiper>
          
          {activePromos.length > 1 && (
            <>
              <button
                className="promo-nav-button promo-prev"
                onClick={() => swiperRef.current?.slidePrev()}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <button
                className="promo-nav-button promo-next"
                onClick={() => swiperRef.current?.slideNext()}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Promos Management Section */}
      <div className="promo-management-section">
        <div className="promo-management-header">
          <h3 className="promo-section-title">{t("promos.manage_promos")}</h3>
          <p className="promo-drag-hint">{t("promos.drag_to_reorder")}</p>
        </div>

        {loading ? (
          <div className="promo-loading">
            <div className="promo-spinner"></div>
            <p>{t("promos.loading")}</p>
          </div>
        ) : error ? (
          <div className="promo-error">
            <p>{error}</p>
          </div>
        ) : promos.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={promos.map(p => p._id)} strategy={verticalListSortingStrategy}>
              <div className="promo-list">
                {promos.map((promo) => (
                  <SortablePromoCard
                    key={promo._id}
                    promo={promo}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    currentLanguage={currentLanguage}
                    t={t}
                    getPromoStatus={getPromoStatus}
                    getStatusColor={getStatusColor}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activePromo ? (
                <div className="promo-card dragging">
                  <div className="promo-card-header">
                    <div className="promo-card-info">
                      <span className="promo-order">#{activePromo.order}</span>
                      <span 
                        className="promo-status"
                        style={{ backgroundColor: getStatusColor(getPromoStatus(activePromo)) }}
                      >
                        {t(`promos.status_${getPromoStatus(activePromo)}`)}
                      </span>
                    </div>
                  </div>
                  <div className="promo-card-content">
                    <div className="promo-thumbnail">
                      {activePromo.fileType === "image" || activePromo.fileType === "gif" ? (
                        <img
                          src={getPromoFileUrl(activePromo.fileId)}
                          alt={activePromo.filename}
                          className="promo-thumbnail-image"
                        />
                      ) : (
                        <div className="promo-thumbnail-video">
                          <span>??</span>
                        </div>
                      )}
                    </div>
                    <div className="promo-details">
                      <h4 className="promo-detail-title">
                        {activePromo.title?.[currentLanguage] ? (
                          <div dangerouslySetInnerHTML={{ __html: activePromo.title[currentLanguage] }} />
                        ) : activePromo.title?.en ? (
                          <div dangerouslySetInnerHTML={{ __html: activePromo.title.en }} />
                        ) : (
                          t("promos.no_title")
                        )}
                      </h4>
                    </div>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <div className="promo-empty-state">
            <p>{t("promos.no_promos")}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Promos;