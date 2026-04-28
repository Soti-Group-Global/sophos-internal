// src/pages/BlogsManagement.jsx
import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { getAllBlogs, createBlog, updateBlog, deleteBlog, getProfile, updateBlogsOrder } from "../utils/api";
import { Grid, List } from "lucide-react";
import "../styles/BlogsManagement.css";
import LoadingComponent from "../components/Loading/LoadingComponent";
import { useBranch } from "../context/BranchContext";
import CommonRichTextEditor from "../components/RichTextEditor/CommonRichTextEditor";


const BlogsManagement = () => {
  const { t, i18n } = useTranslation();
  const { selectedBranch } = useBranch();
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentBlogId, setCurrentBlogId] = useState(null);
  const [currentLang, setCurrentLang] = useState("en");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [availableBranches, setAvailableBranches] = useState([]);
  const [viewMode, setViewMode] = useState("grid"); // 'grid' or 'list'
  const [draggedItem, setDraggedItem] = useState(null);


  const [formData, setFormData] = useState({
    title: { en: "", ru: "" },
    description: { en: "", ru: "" },
    tags: [{ en: "", ru: "" }],
    categories: [{ en: "", ru: "" }],
    branch: "",
    status: "draft",
    showAt: new Date().toISOString().slice(0, 16),
    image: null,
    imagePreview: "",
    types: [],
  });

  const normalizeBranchKey = (value) => {
    if (!value) return "";
    const raw = String(value).trim();
    if (!raw) return "";
    const key = raw.toLowerCase();

    if (key === "all") return "";
    if (key.includes("moscow")) return "Moscow";
    if (key.includes("makhachkala")) return "Makhachkala";
    if (key === "spb" || key.includes("petersburg") || key.includes("saint")) return "spb";

    return raw;
  };

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

  const branchOptions = useMemo(() => {
    const list = availableBranches.length
      ? availableBranches
      : ["Moscow", "Makhachkala"];
    const canonical = list
      .map((b) => normalizeBranchKey(b) || b)
      .filter(Boolean);
    return Array.from(new Set(canonical));
  }, [availableBranches]);

  const singleBranch = useMemo(
    () => (branchOptions.length === 1 ? branchOptions[0] : null),
    [branchOptions]
  );

  useEffect(() => {
    fetchBlogs();
  }, [selectedBranch, singleBranch, statusFilter, typeFilter]);

  const fetchBlogs = async () => {
    setLoading(true);
    try {
      const normalizedSelected =
        String(selectedBranch).toLowerCase() === "all"
          ? undefined
          : normalizeBranchKey(selectedBranch);
      const branchFilter = normalizedSelected || singleBranch || undefined;

      const res = await getAllBlogs({
        limit: 100,
        branch: branchFilter,
        status: statusFilter === "all" ? undefined : statusFilter,
        type: typeFilter === "all" ? undefined : typeFilter,
      });
      setBlogs(res.blogs);
    } catch (err) {
      toast.error(t("blogs.fetch_error"));
    } finally {
      setLoading(false);
    }
  };

  // Load branches current user can access
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

  // Filter blogs based on search and status
  const filteredBlogs = blogs.filter((blog) => {
    const matchesSearch =
      blog.title?.en?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      blog.title?.ru?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      blog.description?.en?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getLocalizedText(blog.title).toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  // Drag and Drop handlers
  const handleDragStart = (e, index) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedItem === null || draggedItem === index) return;

    const newBlogs = [...blogs];
    const draggedBlog = newBlogs[draggedItem];
    newBlogs.splice(draggedItem, 1);
    newBlogs.splice(index, 0, draggedBlog);
    
    setBlogs(newBlogs);
    setDraggedItem(index);
  };

  const handleDragEnd = async () => {
    if (draggedItem === null) return;
    
    setDraggedItem(null);
    
    // Save the new order to the backend
    try {
      const orderedBlogIds = blogs.map(blog => blog._id);
      await updateBlogsOrder(orderedBlogIds);
      toast.success(t("blogs.order_updated"));
    } catch (error) {
      toast.error(t("blogs.order_update_error"));
      // Optionally refetch to restore original order
      fetchBlogs();
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(t("blogs.image_size_error"));
        return;
      }
      setFormData({
        ...formData,
        image: file,
        imagePreview: URL.createObjectURL(file),
      });
    }
  };

  const addTag = () => {
    setFormData({
      ...formData,
      tags: [...formData.tags, { en: "", ru: "" }],
    });
  };

  const updateTag = (index, lang, value) => {
    const newTags = [...formData.tags];
    newTags[index][lang] = value;
    setFormData({ ...formData, tags: newTags });
  };

  const removeTag = (index) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((_, i) => i !== index),
    });
  };

  const addCategory = () => {
    setFormData({
      ...formData,
      categories: [...formData.categories, { en: "", ru: "" }],
    });
  };

  const removeCategory = (index) => {
    setFormData({
      ...formData,
      categories: formData.categories.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async () => {
    if (submitting) return;

    if (!formData.title.en.trim()) {
      toast.error(t("blogs.english_title_required"));
      return;
    }

    const data = new FormData();
    data.append("title[en]", formData.title.en);
    data.append("title[ru]", formData.title.ru);
    data.append("description[en]", formData.description.en);
    data.append("description[ru]", formData.description.ru);
    data.append("branch", formData.branch || "");
    data.append("status", formData.status);
    data.append("showAt", formData.showAt);

    formData.tags.forEach((tag, i) => {
      if (tag.en.trim()) data.append(`tags[${i}][en]`, tag.en.trim());
      if (tag.ru.trim()) data.append(`tags[${i}][ru]`, tag.ru.trim());
    });

    formData.categories.forEach((cat, i) => {
      if (cat.en.trim()) data.append(`categories[${i}][en]`, cat.en.trim());
      if (cat.ru.trim()) data.append(`categories[${i}][ru]`, cat.ru.trim());
    });

    formData.types.forEach((type, i) => {
      data.append(`types[${i}]`, type);
    });

    if (formData.image) {
      data.append("image", formData.image);
    }

    setSubmitting(true);

    try {
      if (isEdit) {
        await updateBlog(currentBlogId, data);
        toast.success(t("blogs.updated"));
      } else {
        await createBlog(data);
        toast.success(t("blogs.created"));
      }
      setShowModal(false);
      resetForm();
      fetchBlogs();
    } catch (err) {
      toast.error(isEdit ? t("blogs.update_error") : t("blogs.create_error"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (blog) => {
    setIsEdit(true);
    setCurrentBlogId(blog._id);
    setFormData({
      title: blog.title || { en: "", ru: "" },
      description: blog.description || { en: "", ru: "" },
      tags:
        blog.tags && blog.tags.length > 0 ? blog.tags : [{ en: "", ru: "" }],
      categories:
        blog.categories && blog.categories.length > 0
          ? blog.categories
          : [{ en: "", ru: "" }],
      branch: normalizeBranchKey(
        Array.isArray(blog.branch) ? blog.branch[0] || "" : blog.branch || ""
      ),
      status: blog.status || "draft",
      showAt: blog.showAt
        ? new Date(blog.showAt).toISOString().slice(0, 16)
        : new Date().toISOString().slice(0, 16),
      image: null,
      imagePreview: blog.image || "",
      types: blog.types || [],
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t("blogs.confirm_delete"))) return;

    try {
      await deleteBlog(id);
      toast.success(t("blogs.deleted"));
      fetchBlogs();
    } catch (err) {
      toast.error(t("blogs.delete_error"));
    }
  };

  const resetForm = () => {
    const defaultBranch =
      singleBranch ||
      (String(selectedBranch).toLowerCase() === "all"
        ? ""
        : normalizeBranchKey(selectedBranch));
    setFormData({
      title: { en: "", ru: "" },
      description: { en: "", ru: "" },
      tags: [{ en: "", ru: "" }],
      categories: [{ en: "", ru: "" }],
      branch: defaultBranch,
      status: "draft",
      showAt: new Date().toISOString().slice(0, 16),
      image: null,
      imagePreview: "",
      types: [],
    });
    setIsEdit(false);
    setCurrentBlogId(null);
  };

  // Auto-assign branch when only one is available and form is open
  useEffect(() => {
    if (showModal && singleBranch && !formData.branch) {
      setFormData((prev) => ({ ...prev, branch: singleBranch }));
    }
  }, [showModal, singleBranch, formData.branch]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    // Cleanup function to restore scroll when component unmounts
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showModal]);

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case "published":
        return "success";
      case "draft":
        return "warning";
      case "archived":
        return "error";
      default:
        return "default";
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const activeLang = i18n.language?.toLowerCase().startsWith("ru")
    ? "ru"
    : "en";

  const getLocalizedText = (value) => {
    if (!value) return "";
    if (typeof value === "string") return value;
    return value[activeLang] || value.en || value.ru || "";
  };

  return (
    <div className="blogs-management-modern">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Header Section */}
      <div className="blogs-header">
        <div className="page-title-section">
          <div className="blog-breadcrumb">
            <a href="#" className="blog-breadcrumb-link">{t("blogs.dashboard")}</a>
            <span className="blog-breadcrumb-separator">/</span>
            <span className="blog-breadcrumb-current">{t("blogs.management")}</span>
          </div>
          <h1 className="blog-page-title">{t("blogs.management")}</h1>
        </div>
        <button className="create-blog-btn" onClick={openCreateModal}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 5V19"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M5 12H19"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          {t("blogs.add_new")}
        </button>
      </div>

      {/* Filters Section */}
      <div className="filters-section-modern">
        <div className="search-box-modern">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <input
            type="text"
            placeholder={t("blogs.search_placeholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filters-group-modern">
          <div className="view-toggle-buttons">
            <button
              className={`view-toggle-btn ${viewMode === "grid" ? "active" : ""}`}
              onClick={() => setViewMode("grid")}
              title="Grid View"
            >
              <Grid size={20} />
            </button>
            <button
              className={`view-toggle-btn ${viewMode === "list" ? "active" : ""}`}
              onClick={() => setViewMode("list")}
              title="List View"
            >
              <List size={20} />
            </button>
          </div>
          <select
            className="filter-select-modern"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">{t("blogs.filters.all")}</option>
            <option value="published">{t("blogs.filters.published")}</option>
            <option value="draft">{t("blogs.filters.draft")}</option>
            <option value="archived">{t("blogs.filters.archived")}</option>
          </select>
          <select
            className="filter-select-modern"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">{t("blogs.filters.types", { defaultValue: "All Sections" })}</option>
            <option value="blogs">{t("blogs.types.blogs")}</option>
            <option value="about_diseases">{t("blogs.types.about_diseases")}</option>
          </select>
        </div>
      </div>

      {/* Content Section */}
      <div className="blogs-content">
        {loading ? (
          <LoadingComponent message={t("blogs.loading")} />
        ) : filteredBlogs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-illustration">
              <svg width="120" height="120" viewBox="0 0 24 24" fill="none">
                <path
                  d="M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M8 7H16M8 11H16M8 15H12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h3>{t("blogs.empty.title")}</h3>
            <p>{t("blogs.empty.description")}</p>
            <button className="create-first-btn" onClick={openCreateModal}>
              {t("blogs.empty.action")}
            </button>
          </div>
        ) : (
          <div className={viewMode === "grid" ? "blogs-grid-modern" : "blogs-list-modern"}>
            {filteredBlogs.map((blog, index) => {
              const title =
                getLocalizedText(blog.title) ||
                getLocalizedText(blog.preview?.title) ||
                t("blogs.untitled");

              const rawDescription =
                getLocalizedText(blog.description) ||
                getLocalizedText(blog.preview?.description);
              const cleanDescription = rawDescription
                ? rawDescription.replace(/<[^>]*>/g, "")
                : "";
              const truncatedDescription = cleanDescription
                ? cleanDescription.slice(0, 120) +
                (cleanDescription.length > 120 ? "..." : "")
                : t("blogs.no_description");

              const tagsSource =
                (blog.tags && blog.tags.length
                  ? blog.tags
                  : blog.preview?.tags) || [];
              const localizedTags = tagsSource
                .map((tag) =>
                  typeof tag === "string" ? tag : getLocalizedText(tag)
                )
                .filter(Boolean);

              if (viewMode === "list") {
                return (
                  <div
                    key={blog._id}
                    className={`blog-list-item ${draggedItem === index ? "dragging" : ""}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="list-drag-handle">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M9 5H9.01M15 5H15.01M9 12H9.01M15 12H15.01M9 19H9.01M15 19H15.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </div>
                    {blog.image && (
                      <div className="list-image">
                        <img src={blog.image} alt={title} />
                      </div>
                    )}
                    <div className="list-content">
                      <h4 className="list-title">{title}</h4>
                      <p className="list-description">{truncatedDescription}</p>
                    </div>
                    <div className="list-meta">
                      <span className={`status-badge status-${getStatusBadgeVariant(blog.status)}`}>
                        {t(`blogs.status.${blog.status}`)}
                      </span>
                    </div>
                    <div className="list-actions">
                      <button
                        onClick={() => handleEdit(blog)}
                        className="action-btn edit-btn-modern"
                        title={t("blogs.actions.edit")}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M11 4H4C3.44772 4 3 4.44772 3 5V20C3 20.5523 3.44772 21 4 21H19C19.5523 21 20 20.5523 20 20V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          <path d="M18.5 2.5L21.5 5.5L12 15H9V12L18.5 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(blog._id)}
                        className="action-btn delete-btn-modern"
                        title={t("blogs.actions.delete")}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M3 6H5H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6M19 6V20C19 20.5523 18.5523 21 18 21H6C5.44772 21 5 20.5523 5 20V6H19Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={blog._id} className="blog-card-modern">
                  <div className="blog-image-container">
                    {blog.image ? (
                      <img
                        src={blog.image}
                        alt={title || "Blog image"}
                        className="blog-image-modern"
                        onError={(e) => {
                          e.target.style.display = "none";
                          e.target.nextSibling.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <div className="blog-image-placeholder">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M4 16L8 12L12 16L16 10L20 14V4H4V16Z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                        <path
                          d="M4 20H20"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                    <div className="blog-status">
                      <span
                        className={`status-badge status-${getStatusBadgeVariant(
                          blog.status
                        )}`}
                      >
                        {t(`blogs.status.${blog.status}`)}
                      </span>
                    </div>
                  </div>

                  <div className="blog-content-modern">
                    <h3 className="blog-title">{title}</h3>
                    <p className="blog-description">{truncatedDescription}</p>

                    <div className="blog-actions-modern">
                      <button
                        onClick={() => handleEdit(blog)}
                        className="action-btn edit-btn-modern"
                        title={t("blogs.actions.edit")}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M11 4H4C3.44772 4 3 4.44772 3 5V20C3 20.5523 3.44772 21 4 21H19C19.5523 21 20 20.5523 20 20V13"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                          <path
                            d="M18.5 2.5L21.5 5.5L12.5 14.5L9 15L9.5 11.5L18.5 2.5Z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        {t("blogs.actions.edit")}
                      </button>
                      <button
                        onClick={() => handleDelete(blog._id)}
                        className="action-btn delete-btn-modern"
                        title={t("blogs.actions.delete")}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M3 6H5H21"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                          <path
                            d="M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6M19 6V20C19 20.5523 18.5523 21 18 21H6C5.44772 21 5 20.5523 5 20V6H19Z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        </svg>
                        {t("blogs.actions.delete")}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL */}
      {showModal && createPortal(
        <div
          className="blog-modal-overlay"
          onClick={() => !submitting && setShowModal(false)}
        >
          <div
            className="blog-modal-modern"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="blog-modal-header">
              <div className="blog-modal-title">
                <h2>
                  {isEdit
                    ? t("blogs.modal.edit_title")
                    : t("blogs.modal.create_title")}
                </h2>
                <p>
                  {isEdit
                    ? t("blogs.modal.edit_subtitle")
                    : t("blogs.modal.create_subtitle")}
                </p>
              </div>
              <button
                className="close-btn-modern"
                onClick={() => !submitting && setShowModal(false)}
                disabled={submitting}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" />
                  <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" />
                </svg>
              </button>
            </div>

            <div className="blog-modal-body">
              {/* Language Tabs */}
              <div className="blog-language-tabs">
                <button
                  className={`lang-tab ${currentLang === "en" ? "active" : ""}`}
                  onClick={() => setCurrentLang("en")}
                >
                  {t("blogs.language.en")}
                </button>
                <button
                  className={`lang-tab ${currentLang === "ru" ? "active" : ""}`}
                  onClick={() => setCurrentLang("ru")}
                >
                  {t("blogs.language.ru")}
                </button>
              </div>

              {/* Form Content */}
              <div className="blog-form-content">
                {/* Title */}
                <div className="blog-form-group">
                  <label className="blog-form-label">
                    {t("blogs.modal.title")} ({currentLang.toUpperCase()}) *
                  </label>
                  <input
                    type="text"
                    className="blog-form-input"
                    value={
                      currentLang === "en"
                        ? formData.title.en
                        : formData.title.ru
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        title: {
                          ...formData.title,
                          [currentLang]: e.target.value,
                        },
                      })
                    }
                    placeholder={
                      currentLang === "en"
                        ? t("blogs.modal.title_placeholder_en")
                        : t("blogs.modal.title_placeholder_ru")
                    }
                  />
                </div>

                {/* Description - CKEditor */}
                <div className="blog-form-group">
                  <label className="blog-form-label">
                    {t("blogs.modal.description")} ({currentLang.toUpperCase()})
                  </label>
                  <CommonRichTextEditor
                    key={`description-${currentLang}`}
                    value={
                      currentLang === "en"
                        ? formData.description.en
                        : formData.description.ru
                    }
                    onChange={(data) => {
                      setFormData({
                        ...formData,
                        description: {
                          ...formData.description,
                          [currentLang]: data,
                        },
                      });
                    }}
                    placeholder={t("blogs.modal.description")}
                  />
                </div>

                {/* Branch */}
                <div className="blog-form-group">
                  <label className="blog-form-label">{t("blogs.modal.branch")}</label>
                  <select
                    className="blog-form-input"
                    value={formData.branch || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, branch: e.target.value }))
                    }
                  >
                    <option value="">{t("blogs.modal.select_branch")}</option>
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

                {/* Image Upload */}
                <div className="blog-form-group">
                  <label className="blog-form-label">
                    {t("blogs.modal.featured_image")}
                  </label>
                  <div className="image-upload-area">
                    {formData.imagePreview ? (
                      <div className="image-preview-modern">
                        <img
                          src={formData.imagePreview}
                          alt="Preview"
                          className="preview-image"
                        />
                        <button
                          type="button"
                          className="remove-image-btn"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              image: null,
                              imagePreview: "",
                            })
                          }
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <path
                              d="M18 6L6 18"
                              stroke="currentColor"
                              strokeWidth="2"
                            />
                            <path
                              d="M6 6L18 18"
                              stroke="currentColor"
                              strokeWidth="2"
                            />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <label className="upload-placeholder">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="file-input"
                        />
                        <svg
                          width="48"
                          height="48"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M14 2V8H20"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M16 13H8"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                          <path
                            d="M16 17H8"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                          <path
                            d="M10 9H9H8"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        </svg>
                        <span>{t("blogs.modal.upload_text")}</span>
                        <small>{t("blogs.modal.upload_hint")}</small>
                      </label>
                    )}
                  </div>
                </div>

                {/* Tags */}
                <div className="blog-form-group">
                  <label className="blog-form-label">{t("blogs.modal.tags")}</label>
                  <div className="tags-container">
                    {formData.tags.map((tag, index) => (
                      <div key={index} className="tag-input-row">
                        <input
                          type="text"
                          className="blog-form-input tag-input"
                          placeholder={t("blogs.modal.tag_placeholder_en")}
                          value={tag.en}
                          onChange={(e) =>
                            updateTag(index, "en", e.target.value)
                          }
                        />
                        <input
                          type="text"
                          className="blog-form-input tag-input"
                          placeholder={t("blogs.modal.tag_placeholder_ru")}
                          value={tag.ru}
                          onChange={(e) =>
                            updateTag(index, "ru", e.target.value)
                          }
                        />
                        {formData.tags.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeTag(index)}
                            className="remove-item-btn"
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                            >
                              <path
                                d="M18 6L6 18"
                                stroke="currentColor"
                                strokeWidth="2"
                              />
                              <path
                                d="M6 6L18 18"
                                stroke="currentColor"
                                strokeWidth="2"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addTag}
                      className="add-item-btn"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M12 5V19"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M5 12H19"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                      {t("blogs.modal.add_tag")}
                    </button>
                  </div>
                </div>

                {/* Categories */}
                <div className="blog-form-group">
                  <label className="blog-form-label">
                    {t("blogs.modal.categories")}
                  </label>
                  <div className="categories-container">
                    {formData.categories.map((category, index) => (
                      <div key={index} className="category-input-row">
                        <input
                          type="text"
                          className="blog-form-input category-input"
                          placeholder={t("blogs.modal.category_placeholder_en")}
                          value={category.en}
                          onChange={(e) => {
                            const newCategories = [...formData.categories];
                            newCategories[index].en = e.target.value;
                            setFormData({
                              ...formData,
                              categories: newCategories,
                            });
                          }}
                        />
                        <input
                          type="text"
                          className="blog-form-input category-input"
                          placeholder={t("blogs.modal.category_placeholder_ru")}
                          value={category.ru}
                          onChange={(e) => {
                            const newCategories = [...formData.categories];
                            newCategories[index].ru = e.target.value;
                            setFormData({
                              ...formData,
                              categories: newCategories,
                            });
                          }}
                        />
                        {formData.categories.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeCategory(index)}
                            className="remove-item-btn"
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                            >
                              <path
                                d="M18 6L6 18"
                                stroke="currentColor"
                                strokeWidth="2"
                              />
                              <path
                                d="M6 6L18 18"
                                stroke="currentColor"
                                strokeWidth="2"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addCategory}
                      className="add-item-btn"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M12 5V19"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M5 12H19"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                      {t("blogs.modal.add_category")}
                    </button>
                  </div>
                </div>

                <div className="blog-form-group">
                  <label className="blog-form-label">
                    {t("blogs.modal.types", { defaultValue: "Blog Sections" })}
                  </label>
                  <div className="types-checkbox-group">
                    <label className={`checkbox-label ${formData.types.includes("blogs") ? "active" : ""}`}>
                      <input
                        type="checkbox"
                        checked={formData.types.includes("blogs")}
                        onChange={(e) => {
                          const newTypes = e.target.checked
                            ? [...formData.types, "blogs"]
                            : formData.types.filter((t_item) => t_item !== "blogs");
                          setFormData({ ...formData, types: newTypes });
                        }}
                      />
                      <span>{t("blogs.types.blogs", { defaultValue: "Blogs" })}</span>
                    </label>
                    <label className={`checkbox-label ${formData.types.includes("about_diseases") ? "active" : ""}`}>
                      <input
                        type="checkbox"
                        checked={formData.types.includes("about_diseases")}
                        onChange={(e) => {
                          const newTypes = e.target.checked
                            ? [...formData.types, "about_diseases"]
                            : formData.types.filter((t_item) => t_item !== "about_diseases");
                          setFormData({ ...formData, types: newTypes });
                        }}
                      />
                      <span>{t("blogs.types.about_diseases", { defaultValue: "About Diseases" })}</span>
                    </label>
                  </div>
                </div>

                {/* Status & Date */}
                <div className="blog-form-row">
                  <div className="blog-form-group">
                    <label className="blog-form-label">
                      {t("blogs.modal.status")}
                    </label>
                    <select
                      className="blog-form-select"
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value })
                      }
                    >
                      <option value="draft">{t("blogs.status.draft")}</option>
                      <option value="published">
                        {t("blogs.status.published")}
                      </option>
                      <option value="archived">
                        {t("blogs.status.archived")}
                      </option>
                    </select>
                  </div>
                  <div className="blog-form-group">
                    <label className="blog-form-label">
                      {t("blogs.modal.publish_date")}
                    </label>
                    <input
                      type="datetime-local"
                      className="blog-form-input"
                      value={formData.showAt}
                      onChange={(e) =>
                        setFormData({ ...formData, showAt: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="blog-modal-footer">
              <button
                className="secondary-btn"
                onClick={() => setShowModal(false)}
                disabled={submitting}
              >
                {t("blogs.modal.cancel")}
              </button>
              <button
                className="primary-btn"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <div className="btn-spinner"></div>
                    {t("blogs.modal.saving")}
                  </>
                ) : isEdit ? (
                  t("blogs.modal.update")
                ) : (
                  t("blogs.modal.create")
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default BlogsManagement;
