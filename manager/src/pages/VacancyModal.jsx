import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
  Calendar,
  MapPin,
  Briefcase,
  X,
  Save,
  Languages,
  CheckSquare,
  Square,
} from "lucide-react";
import { createVacancy, updateVacancy, getVacancy, getProfile } from "../utils/api";
import CommonRichTextEditor from "../components/RichTextEditor/CommonRichTextEditor";
import { useBranch } from "../context/BranchContext";
import LoadingComponent from "../components/Loading/LoadingComponent";


const VacancyModal = ({ isOpen, onClose, onSuccess, vacancy = null }) => {
  const { t, i18n } = useTranslation();
  const { selectedBranch } = useBranch();
  const [availableBranches, setAvailableBranches] = useState([]);
  
  const normalizeLang = (lang) =>
    String(lang || "")
      .toLowerCase()
      .startsWith("ru")
      ? "ru"
      : "en";

  const normalizeBranches = (rawBranches) => {
    if (!rawBranches) return [];
    if (Array.isArray(rawBranches)) {
      return rawBranches
        .map((b) => (typeof b === "string" ? b : b?.name || b?.branch))
        .filter(Boolean);
    }
    if (typeof rawBranches === "string") return [rawBranches];
    if (typeof rawBranches === "object") return [rawBranches.name || rawBranches.branch].filter(Boolean);
    return [];
  };


  const normalizeBranchToOption = (value) => {
    if (!value) return "";

    const raw = String(value).trim();
    if (!raw) return "";

    const lower = raw.toLowerCase();

    if (
      lower === "moscow clinic" ||
      lower === "moscow" ||
      lower.includes("moscow")
    ) {
      return "Moscow Clinic";
    }

    if (
      lower === "makhachkala clinic" ||
      lower === "makhachkala" ||
      lower.includes("makhachkala")
    ) {
      return "Makhachkala Clinic";
    }

    return raw;
  };

  const branchOptions = useMemo(() => {
    const list = availableBranches.length
      ? availableBranches
      : ["Moscow", "Makhachkala"];
    const canonical = list
      .map((b) => normalizeBranchToOption(b) || b)
      .filter(Boolean);
    return Array.from(new Set(canonical));
  }, [availableBranches]);

  const singleBranch = useMemo(
    () => (branchOptions.length === 1 ? branchOptions[0] : null),
    [branchOptions]
  );

  const [loading, setLoading] = useState(false);
  const [currentLang, setCurrentLang] = useState(normalizeLang(i18n.language));
  const [titleError, setTitleError] = useState("");
  const [otherEmploymentError, setOtherEmploymentError] = useState("");
  
  // Initial form data structure
  const initialFormData = {
    title: { en: "", ru: "" },
    department: { en: "", ru: "" },
    location: { en: "", ru: "" },
    description: { en: "", ru: "" },
    requirements: { en: "", ru: "" },
    responsibilities: { en: "", ru: "" },
    possibilities: { en: "", ru: "" },
    employmentType: "",
    experienceLevel: { en: "", ru: "" },
    salary: { en: "", ru: "" },
    schedule: { en: "", ru: "" },
    selectionStage: { en: "", ru: "" },
    branch: singleBranch || normalizeBranchToOption(selectedBranch) || "",
    applicationDeadline: "",
    status: "draft",
    showApplyButton: true,
    otherEmploymentType: { en: "", ru: "" },
  };

  const [formData, setFormData] = useState(initialFormData);
  const [isFetching, setIsFetching] = useState(false);


  useEffect(() => {
    const loadBranches = async () => {
      try {
        const res = await getProfile();
        const branches = normalizeBranches(res?.data?.user?.branches || res?.data?.user?.branch);
        if (branches.length) {
          setAvailableBranches(branches);
        }
      } catch (error) {
      }
    };
    loadBranches();
  }, []);

  useEffect(() => {
    const fetchFullData = async () => {
      if (isOpen && vacancy && vacancy._id) {
        try {
          setIsFetching(true);
          const response = await getVacancy(vacancy._id);
          
          // Check if response.data has the full multilingual structure
          // If it returns localized data (flattened), we need to handle it differently
          const data = response.data;
          
          // Helper to extract multilingual data
          const extractField = (field) => {
            if (!data[field]) return { en: "", ru: "" };
            
            // If it's already a multilingual object
            if (typeof data[field] === 'object' && (data[field].en !== undefined || data[field].ru !== undefined)) {
              return {
                en: data[field].en || "",
                ru: data[field].ru || ""
              };
            }
            
            // If it's a localized string (from getLocalizedData)
            if (typeof data[field] === 'string') {
              // Try to get both languages from the main response
              return {
                en: data[`${field}En`] || data[field] || "",
                ru: data[`${field}Ru`] || data[field] || ""
              };
            }
            
            return { en: "", ru: "" };
          };

          const newFormData = {
            title: extractField('title'),
            department: extractField('department'),
            location: extractField('location'),
            description: extractField('description'),
            requirements: extractField('requirements'),
            responsibilities: extractField('responsibilities'),
            possibilities: extractField('possibilities'),
            employmentType: data.employmentType || "",
            experienceLevel: extractField('experienceLevel'),
            salary: extractField('salary'),
            schedule: extractField('schedule'),
            selectionStage: extractField('selectionStage'),
            branch: normalizeBranchToOption(
              Array.isArray(data.branch) ? data.branch[0] || "" : data.branch || singleBranch || ""
            ),
            applicationDeadline: data.applicationDeadline
              ? new Date(data.applicationDeadline)
                  .toISOString()
                  .split("T")[0]
              : "",
            status: data.status || "draft",
            showApplyButton:
              data.showApplyButton !== undefined
                ? data.showApplyButton
                : true,
            otherEmploymentType: extractField('otherEmploymentType'),
          };

          setFormData(newFormData);
          setCurrentLang(normalizeLang(i18n.language));
        } catch (error) {
          toast.error(t("vacancies.error_fetch"));
          setFormData(initialFormData);
        } finally {
          setIsFetching(false);
        }
      } else if (isOpen && !vacancy) {
        // Reset for new vacancy
        setFormData(initialFormData);
        setCurrentLang(normalizeLang(i18n.language));
      }
    };

    fetchFullData();
  }, [isOpen, vacancy, t, i18n.language, singleBranch]);

  // Handle RichTextEditor changes
  const handleEditorChange = (field, data, lang) => {
    setFormData((prev) => ({
      ...prev,
      [field]: {
        ...prev[field],
        [lang]: data,
      },
    }));
  };

  // Handle input changes - FIXED for language switching
  const handleInputChange = (field, value, lang = null) => {
    if (lang) {
      // Handle multilingual fields
      setFormData((prev) => ({
        ...prev,
        [field]: {
          ...prev[field],
          [lang]: value,
        },
      }));
    } else {
      // Handle regular fields
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
  };


  useEffect(() => {
    if (isOpen && singleBranch && !formData.branch) {
      setFormData((prev) => ({ ...prev, branch: singleBranch }));
    }
  }, [isOpen, singleBranch, formData.branch]);

  const handleEmploymentTypeChange = (value) => {
    setFormData((prev) => ({
      ...prev,
      employmentType: value,
      otherEmploymentType:
        value === "other" ? prev.otherEmploymentType : { en: "", ru: "" },
    }));
    setOtherEmploymentError("");
  };

  const toggleShowApplyButton = () => {
    setFormData((prev) => ({
      ...prev,
      showApplyButton: !prev.showApplyButton,
    }));
  };

  const validateForm = () => {
    // Title must exist in at least one language
    const hasEnglishTitle = formData.title?.en?.trim();
    const hasRussianTitle = formData.title?.ru?.trim();

    if (!hasEnglishTitle && !hasRussianTitle) {
      const message = t("vacancies.title_required");
      setTitleError(message);
      toast.error(message);
      return false;
    }

    if (formData.employmentType === "other") {
      const hasOtherEn = formData.otherEmploymentType?.en?.trim();
      const hasOtherRu = formData.otherEmploymentType?.ru?.trim();
      if (!hasOtherEn && !hasOtherRu) {
        const message = t("vacancies.specify_employment_type");
        setOtherEmploymentError(message);
        toast.error(message);
        return false;
      }
    }

    setTitleError("");
    setOtherEmploymentError("");
    return true;
  };

  const switchLanguage = (lang) => {
    setCurrentLang(lang);
  };

  // Get current value for a field based on selected language
  const getCurrentValue = (field) => {
    if (!formData[field]) return "";
    
    if (typeof formData[field] === 'object') {
      return formData[field][currentLang] || "";
    }
    
    return formData[field];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    try {
      // Prepare data for submission
      const submitData = {
        title: {
          en: formData.title.en || "",
          ru: formData.title.ru || ""
        },
        department: {
          en: formData.department.en || "",
          ru: formData.department.ru || ""
        },
        location: {
          en: formData.location.en || "",
          ru: formData.location.ru || ""
        },
        description: {
          en: formData.description.en || "",
          ru: formData.description.ru || ""
        },
        requirements: {
          en: formData.requirements.en || "",
          ru: formData.requirements.ru || ""
        },
        responsibilities: {
          en: formData.responsibilities.en || "",
          ru: formData.responsibilities.ru || ""
        },
        possibilities: {
          en: formData.possibilities.en || "",
          ru: formData.possibilities.ru || ""
        },
        employmentType: formData.employmentType || "",
        experienceLevel: {
          en: formData.experienceLevel.en || "",
          ru: formData.experienceLevel.ru || ""
        },
        salary: {
          en: formData.salary.en || "",
          ru: formData.salary.ru || ""
        },
        schedule: {
          en: formData.schedule.en || "",
          ru: formData.schedule.ru || ""
        },
        selectionStage: {
          en: formData.selectionStage.en || "",
          ru: formData.selectionStage.ru || ""
        },
        branch: formData.branch || singleBranch || "",
        applicationDeadline: formData.applicationDeadline || undefined,
        status: formData.status || "draft",
        showApplyButton: formData.showApplyButton !== false,
      };

      // Add otherEmploymentType only if employmentType is "other"
      if (formData.employmentType === "other") {
        submitData.otherEmploymentType = {
          en: formData.otherEmploymentType.en || "",
          ru: formData.otherEmploymentType.ru || ""
        };
      }


      if (vacancy) {
        await updateVacancy(vacancy._id, submitData);
        toast.success(t("vacancies.update_success"));
      } else {
        await createVacancy(submitData);
        toast.success(t("vacancies.create_success"));
      }

      onSuccess();
    } catch (error) {
      
      if (error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error(
          vacancy ? t("vacancies.update_error") : t("vacancies.create_error")
        );
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  if (isFetching) {
    return createPortal(
      <div className="hd-vacancy-modal-overlay">
        <div className="hd-vacancy-modal-content">
          <LoadingComponent message={t("vacancies.loading")} />
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="hd-vacancy-modal-overlay">
      <div className="hd-vacancy-modal-content">
        <div className="hd-vacancy-modal-header">
          <div className="hd-vacancy-modal-header-content">
            <h2 className="hd-vacancy-modal-title">
              {vacancy
                ? t("vacancies.edit_job_post")
                : t("vacancies.create_job_post")}
            </h2>
            <p className="hd-vacancy-modal-subtitle">
              {vacancy
                ? t("vacancies.edit_subtitle")
                : t("vacancies.create_subtitle")}
            </p>
          </div>
          <button className="hd-vacancy-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Language Switcher */}
        <div className="hd-vacancy-language-switcher">
          <div className="hd-vacancy-language-tabs">
            <button
              type="button"
              className={`hd-vacancy-language-tab ${
                currentLang === "en" ? "active" : ""
              }`}
              onClick={() => switchLanguage("en")}
            >
              <Languages size={14} />
              English
            </button>
            <button
              type="button"
              className={`hd-vacancy-language-tab ${
                currentLang === "ru" ? "active" : ""
              }`}
              onClick={() => switchLanguage("ru")}
            >
              <Languages size={14} />
              Russian
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="hd-vacancy-modal-form">
          <div className="hd-vacancy-form-grid">
            {/* Title */}
            <div className="hd-vacancy-form-group hd-vacancy-form-group-full">
              <label className="hd-vacancy-form-label">
                {t("vacancies.title")}{" "}
                <span className="hd-vacancy-required">*</span>
                <span className="hd-vacancy-language-badge">
                  {currentLang.toUpperCase()}
                </span>
              </label>
              <input
                type="text"
                value={getCurrentValue("title")}
                onChange={(e) =>
                  handleInputChange("title", e.target.value, currentLang)
                }
                className="hd-vacancy-form-input"
                placeholder={t("vacancies.title_placeholder")}
              />
              {titleError && (
                <p className="hd-vacancy-error-text">{titleError}</p>
              )}
            </div>

            {/* Branch */}
            <div className="hd-vacancy-form-group">
              <label className="hd-vacancy-form-label">
                {t("vacancies.branch")}
              </label>
              <select
                value={formData.branch || ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, branch: e.target.value }))
                }
                className="hd-vacancy-form-input"
              >
                <option value="">{t("vacancies.select_branch")}</option>
                {branchOptions.map((branch) => {
                  const key = branch.toLowerCase().replace(/\s+/g, "_");
                  return (
                    <option key={branch} value={branch}>
                      {t(`branches.${key}`, { defaultValue: branch })}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Department & Location */}
            <div className="hd-vacancy-form-group">
              <label className="hd-vacancy-form-label">
                {t("vacancies.department")}
                <span className="hd-vacancy-language-badge">
                  {currentLang.toUpperCase()}
                </span>
              </label>
              <input
                type="text"
                value={getCurrentValue("department")}
                onChange={(e) =>
                  handleInputChange("department", e.target.value, currentLang)
                }
                className="hd-vacancy-form-input"
                placeholder={t("vacancies.department_placeholder")}
              />
            </div>

            <div className="hd-vacancy-form-group">
              <label className="hd-vacancy-form-label">
                {t("vacancies.location")}{" "}
                <span className="hd-vacancy-language-badge">
                  {currentLang.toUpperCase()}
                </span>
              </label>
              <input
                type="text"
                value={getCurrentValue("location")}
                onChange={(e) =>
                  handleInputChange("location", e.target.value, currentLang)
                }
                className="hd-vacancy-form-input"
                placeholder={t("vacancies.location_placeholder")}
              />
            </div>

            {/* Employment Type & Experience Level */}
            <div className="hd-vacancy-form-group">
              <label className="hd-vacancy-form-label">
                {t("vacancies.employment_type")}
              </label>
              <div className="hd-vacancy-select-wrapper">
                <select
                  value={formData.employmentType}
                  onChange={(e) => handleEmploymentTypeChange(e.target.value)}
                  className="hd-vacancy-form-select"
                >
                  <option value="">
                    {t("vacancies.select_employment_type")}
                  </option>
                  <option value="labor_agreement"> {t("vacancies.labour_type")}</option>
                  <option value="self_employment"> {t("vacancies.self_type")}</option>
                  <option value="other"> {t("vacancies.other_type")}</option>
                </select>
              </div>
            </div>

            {formData.employmentType === "other" && (
              <div className="hd-vacancy-form-group">
                <label className="hd-vacancy-form-label">
                  {t("vacancies.specify_employment_type")}
                  <span className="hd-vacancy-language-badge">
                    {currentLang.toUpperCase()}
                  </span>
                </label>
                <input
                  type="text"
                  value={getCurrentValue("otherEmploymentType")}
                  onChange={(e) =>
                    handleInputChange(
                      "otherEmploymentType",
                      e.target.value,
                      currentLang
                    )
                  }
                  className="hd-vacancy-form-input"
                  placeholder={t("vacancies.specify_employment_type")}
                />
                {otherEmploymentError && (
                  <p className="hd-vacancy-error-text">
                    {otherEmploymentError}
                  </p>
                )}
              </div>
            )}

            <div className="hd-vacancy-form-group">
              <label className="hd-vacancy-form-label">
                {t("vacancies.experience_level")}
              </label>
              <input
                type="text"
                value={getCurrentValue("experienceLevel")}
                onChange={(e) =>
                  handleInputChange("experienceLevel", e.target.value, currentLang)
                }
                className="hd-vacancy-form-input"
                placeholder={t("vacancies.experience_level")}
              />
            </div>

            {/* Status */}
            <div className="hd-vacancy-form-group">
              <label className="hd-vacancy-form-label">
                {t("vacancies.status")}
              </label>
              <div className="hd-vacancy-select-wrapper">
                <select
                  value={formData.status}
                  onChange={(e) => handleInputChange("status", e.target.value)}
                  className="hd-vacancy-form-select"
                >
                  <option value="draft">{t("vacancies.status_draft")}</option>
                  <option value="published">
                    {t("vacancies.status_published")}
                  </option>
                  <option value="closed">{t("vacancies.status_closed")}</option>
                  <option value="archived">
                    {t("vacancies.status_archived")}
                  </option>
                </select>
              </div>
            </div>

            {/* Application Deadline */}
            <div className="hd-vacancy-form-group">
              <label className="hd-vacancy-form-label">
                {t("vacancies.application_deadline")}
              </label>
              <div className="hd-vacancy-date-input-wrapper">
                <Calendar size={16} className="hd-vacancy-date-icon" />
                <input
                  type="date"
                  value={formData.applicationDeadline}
                  onChange={(e) =>
                    handleInputChange("applicationDeadline", e.target.value)
                  }
                  className="hd-vacancy-form-input hd-vacancy-date-input"
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
            </div>

            {/* Show Apply Button Checkbox */}
            <div className="hd-vacancy-form-group hd-vacancy-form-group-full">
              <div className="hd-vacancy-checkbox-group">
                <button
                  type="button"
                  className={`hd-vacancy-checkbox ${
                    formData.showApplyButton ? "checked" : ""
                  }`}
                  onClick={toggleShowApplyButton}
                >
                  {formData.showApplyButton ? (
                    <CheckSquare size={18} />
                  ) : (
                    <Square size={18} />
                  )}
                </button>
                <div className="hd-vacancy-checkbox-content">
                  <label className="hd-vacancy-checkbox-label">
                    {t("vacancies.show_apply_button")}
                  </label>
                  <p className="hd-vacancy-checkbox-description">
                    {t("vacancies.show_apply_button_description")}
                  </p>
                </div>
              </div>
            </div>

            {/* Salary */}
            <div className="hd-vacancy-form-group hd-vacancy-form-group-full">
              <label className="hd-vacancy-form-label">
                {t("vacancies.salary_range")}
                <span className="hd-vacancy-language-badge">
                  {currentLang.toUpperCase()}
                </span>
              </label>
              <input
                type="text"
                value={getCurrentValue("salary")}
                onChange={(e) => handleInputChange("salary", e.target.value, currentLang)}
                className="hd-vacancy-form-input"
                placeholder={t("vacancies.salary_range")}
              />
            </div>

            {/* Schedule - Text Input */}
            <div className="hd-vacancy-form-group hd-vacancy-form-group-full">
              <label className="hd-vacancy-form-label">
                {t("vacancies.schedule")}
                <span className="hd-vacancy-language-badge">
                  {currentLang.toUpperCase()}
                </span>
              </label>
              <input
                type="text"
                value={getCurrentValue("schedule")}
                onChange={(e) =>
                  handleInputChange("schedule", e.target.value, currentLang)
                }
                className="hd-vacancy-form-input"
                placeholder={t("vacancies.schedule")}
              />
            </div>

            {/* Selection Stage - Text Input */}
            <div className="hd-vacancy-form-group hd-vacancy-form-group-full">
              <label className="hd-vacancy-form-label">
                {t("vacancies.selection_stage")}
                <span className="hd-vacancy-language-badge">
                  {currentLang.toUpperCase()}
                </span>
              </label>
              <input
                type="text"
                value={getCurrentValue("selectionStage")}
                onChange={(e) =>
                  handleInputChange("selectionStage", e.target.value, currentLang)
                }
                className="hd-vacancy-form-input"
                placeholder={t("vacancies.selection_stage")}
              />
            </div>

            {/* Description - CKEditor */}
            <div className="hd-vacancy-form-group hd-vacancy-form-group-full">
              <label className="hd-vacancy-form-label">
                {t("vacancies.description")}{" "}
                <span className="hd-vacancy-language-badge">
                  {currentLang.toUpperCase()}
                </span>
              </label>
              <div className="hd-vacancy-editor-wrapper">
                <CommonRichTextEditor
                  key={`description-${currentLang}`}
                  value={formData.description?.[currentLang] || ""}
                  onChange={(data) =>
                    handleEditorChange("description", data, currentLang)
                  }
                  placeholder={t("vacancies.rich_text_placeholder")}
                />
              </div>
            </div>

            {/* Requirements - CKEditor */}
            <div className="hd-vacancy-form-group hd-vacancy-form-group-full">
              <label className="hd-vacancy-form-label">
                {t("vacancies.requirements")}
                <span className="hd-vacancy-language-badge">
                  {currentLang.toUpperCase()}
                </span>
              </label>
              <div className="hd-vacancy-editor-wrapper">
                <CommonRichTextEditor
                  key={`requirements-${currentLang}`}
                  value={formData.requirements?.[currentLang] || ""}
                  onChange={(data) =>
                    handleEditorChange("requirements", data, currentLang)
                  }
                  placeholder={t("vacancies.rich_text_placeholder")}
                />
              </div>
            </div>

            {/* Responsibilities - CKEditor */}
            <div className="hd-vacancy-form-group hd-vacancy-form-group-full">
              <label className="hd-vacancy-form-label">
                {t("vacancies.responsibilities")}
                <span className="hd-vacancy-language-badge">
                  {currentLang.toUpperCase()}
                </span>
              </label>
              <div className="hd-vacancy-editor-wrapper">
                <CommonRichTextEditor
                  key={`responsibilities-${currentLang}`}
                  value={formData.responsibilities?.[currentLang] || ""}
                  onChange={(data) =>
                    handleEditorChange("responsibilities", data, currentLang)
                  }
                  placeholder={t("vacancies.rich_text_placeholder")}
                />
              </div>
            </div>

            {/* Possibilities - CKEditor */}
            <div className="hd-vacancy-form-group hd-vacancy-form-group-full">
              <label className="hd-vacancy-form-label">
                {t("vacancies.possibilities")}
                <span className="hd-vacancy-language-badge">
                  {currentLang.toUpperCase()}
                </span>
              </label>
              <div className="hd-vacancy-editor-wrapper">
                <CommonRichTextEditor
                  key={`possibilities-${currentLang}`}
                  value={formData.possibilities?.[currentLang] || ""}
                  onChange={(data) =>
                    handleEditorChange("possibilities", data, currentLang)
                  }
                  placeholder={t("vacancies.rich_text_placeholder")}
                />
              </div>
            </div>
          </div>

          <div className="hd-vacancy-modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="hd-vacancy-cancel-btn"
              disabled={loading}
            >
              {t("vacancies.cancel")}
            </button>
            <button
              type="submit"
              className="hd-vacancy-submit-btn"
              disabled={loading}
            >
              {loading ? (
                <div className="hd-vacancy-loading-spinner"></div>
              ) : (
                <Save size={16} />
              )}
              {loading
                ? t("vacancies.saving")
                : vacancy
                ? t("vacancies.update")
                : t("vacancies.create")}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default VacancyModal;
