import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
  Plus,
  Edit2,
  Trash2,
  Eye,
  Users,
  MapPin,
  Briefcase,
  TrendingUp,
  FileText,
  Clock,
  Archive,
  Calendar,
} from "lucide-react";
import { getVacancies, deleteVacancy } from "../utils/api";
import VacancyModal from "./VacancyModal";
import "../styles/JobPostsManagement.css";
import LoadingComponent from "../components/Loading/LoadingComponent";
import { useBranch } from "../context/BranchContext";

const JobPostsManagement = () => {
  const { t, i18n } = useTranslation();
  const { selectedBranch } = useBranch();
  const [vacancies, setVacancies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVacancy, setSelectedVacancy] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0,
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchVacancies();
  }, [pagination.page, i18n.language, selectedBranch]);

  const onViewApplications = (vacancy) => {
    navigate(`/vacancies/${vacancy._id}`);
  };

  const fetchVacancies = async () => {
    try {
      setLoading(true);
      const response = await getVacancies({
        page: pagination.page,
        limit: pagination.limit,
        lang: i18n.language,
        branch: selectedBranch,
      });
      setVacancies(response.data);
      setPagination((prev) => ({
        ...prev,
        total: response.total,
        totalPages: response.totalPages,
      }));
    } catch (error) {
      toast.error(t("vacancies.error_fetch"));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVacancy = () => {
    setSelectedVacancy(null);
    setIsModalOpen(true);
  };

  const handleEditVacancy = async (vacancy) => {
    try {
      setSelectedVacancy(vacancy);
      setIsModalOpen(true);
    } catch (error) {
      toast.error(t("vacancies.error_fetch"));
    }
  };

  const handleDeleteVacancy = async (vacancy) => {
    if (window.confirm(t("vacancies.delete_confirm"))) {
      try {
        await deleteVacancy(vacancy._id);
        toast.success(t("vacancies.delete_success"));
        fetchVacancies();
      } catch (error) {
        toast.error(t("vacancies.delete_error"));
      }
    }
  };

  const handleViewApplications = (vacancy) => {
    onViewApplications(vacancy);
  };

  const handleCardClick = (vacancy, e) => {
    if (e.target.closest(".hd-compact-card-actions")) {
      return;
    }
    handleViewApplications(vacancy);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedVacancy(null);
    fetchVacancies();
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString(
      i18n.language === "ru" ? "ru-RU" : "en-US"
    );
  };

  const formatSalary = (salary, salaryRange) => {
    if (salary) return salary;
    if (!salaryRange?.min && !salaryRange?.max) return null;
    const min = salaryRange.min
      ? salaryRange.min.toLocaleString(i18n.language)
      : "";
    const max = salaryRange.max
      ? salaryRange.max.toLocaleString(i18n.language)
      : "";
    return `${min}${min && max ? " - " : ""}${max} RUB`;
  };

  const getStatusBadge = (vacancy) => {
    const statusConfig = {
      draft: {
        label: t("vacancies.status_draft"),
        class: "hd-compact-status-draft",
        icon: <FileText size={10} />,
      },
      published: {
        label: t("vacancies.status_published"),
        class: "hd-compact-status-active",
        icon: <TrendingUp size={10} />,
      },
      closed: {
        label: t("vacancies.status_closed"),
        class: "hd-compact-status-closed",
        icon: <Calendar size={10} />,
      },
      archived: {
        label: t("vacancies.status_archived"),
        class: "hd-compact-status-archived",
        icon: <Archive size={10} />,
      },
    };

    return statusConfig[vacancy.status] || statusConfig.draft;
  };

  // Helper to get localized text from vacancy
  const getLocalizedText = (vacancy, field) => {
    if (!vacancy || !vacancy[field]) return "";

    // If it's already a string (backward compatibility)
    if (typeof vacancy[field] === "string") return vacancy[field];

    // If it's a multilingual object
    if (typeof vacancy[field] === "object") {
      return vacancy[field][i18n.language] || vacancy[field].en || "";
    }

    return "";
  };

  if (loading) {
    return <LoadingComponent message={t("vacancies.loading")} />;
  }

  return (
    <div className="hd-compact-management">
      {/* Header */}
      <div className="hd-compact-header">
        <div className="hd-compact-header-content">
          <h1 className="hd-compact-title">{t("vacancies.job_posts")}</h1>
          <p className="hd-compact-subtitle">
            {t("vacancies.manage_job_posts")}
          </p>
        </div>
        <button className="hd-compact-create-btn" onClick={handleCreateVacancy}>
          <Plus size={16} />
          <span>{t("vacancies.create_job_post")}</span>
        </button>
      </div>

      {/* Compact Vacancies Grid */}
      <div className="hd-compact-grid">
        {vacancies.length === 0 ? (
          <div className="hd-compact-empty">
            <div className="hd-compact-empty-icon">
              <Briefcase size={48} />
            </div>
            <h3 className="hd-compact-empty-title">
              {t("vacancies.no_job_posts")}
            </h3>
            <p className="hd-compact-empty-description">
              {t("vacancies.create_first_job_post")}
            </p>
            <button
              className="hd-compact-empty-action"
              onClick={handleCreateVacancy}
            >
              <Plus size={16} />
              {t("vacancies.create_job_post")}
            </button>
          </div>
        ) : (
          vacancies.map((vacancy) => {
            const status = getStatusBadge(vacancy);
            const salary = formatSalary(vacancy.salary, vacancy.salaryRange);

            return (
              <div
                key={vacancy._id}
                className="hd-compact-card"
                onClick={(e) => handleCardClick(vacancy, e)}
                style={{ cursor: "pointer" }}
              >
                {/* Card Header - Compact */}
                <div className="hd-compact-card-header">
                  <div className="hd-compact-card-main">
                    <h3 className="hd-compact-card-title">
                      {getLocalizedText(vacancy, "title")}
                    </h3>
                    <div className="hd-compact-card-meta">
                      <div className="hd-compact-meta-item">
                        <MapPin size={12} />
                        <span>{getLocalizedText(vacancy, "location")}</span>
                      </div>
                      {getLocalizedText(vacancy, "department") && (
                        <div className="hd-compact-meta-item">
                          <Briefcase size={12} />
                          <span>{getLocalizedText(vacancy, "department")}</span>
                        </div>
                      )}
                      {salary && (
                        <div className="hd-compact-meta-item">
                          <TrendingUp size={12} />
                          <span>{salary}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="hd-compact-card-actions">
                    <div className={`hd-compact-status ${status.class}`}>
                      {status.icon}
                      <span>{status.label}</span>
                    </div>
                    <div className="hd-compact-action-buttons">
                      <button
                        className="hd-compact-action-btn hd-compact-action-view"
                        onClick={() => handleViewApplications(vacancy)}
                        title={t("vacancies.view_applications")}
                      >
                        <Users size={14} />
                      </button>
                      <button
                        className="hd-compact-action-btn hd-compact-action-edit"
                        onClick={() => handleEditVacancy(vacancy)}
                        title={t("vacancies.edit")}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        className="hd-compact-action-btn hd-compact-action-delete"
                        onClick={() => handleDeleteVacancy(vacancy)}
                        title={t("vacancies.delete")}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Card Content - Compact */}
                <div className="hd-compact-card-content">
                  <div
                    className="hd-compact-description"
                    dangerouslySetInnerHTML={{
                      __html:
                        getLocalizedText(vacancy, "description")?.substring(
                          0,
                          120
                        ) +
                        (getLocalizedText(vacancy, "description")?.length > 120
                          ? "..."
                          : ""),
                    }}
                  />

                  <div className="hd-compact-stats">
                    <div className="hd-compact-stat">
                      <Eye size={12} />
                      <span>{vacancy.viewCount || 0}</span>
                    </div>
                    <div className="hd-compact-stat">
                      <Users size={12} />
                      <span>{vacancy.applicationCount || 0}</span>
                    </div>
                    {vacancy.applicationDeadline && (
                      <div className="hd-compact-stat">
                        <Clock size={12} />
                        <span>{formatDate(vacancy.applicationDeadline)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="hd-compact-pagination">
          <button
            disabled={pagination.page === 1}
            onClick={() =>
              setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
            }
            className="hd-compact-pagination-btn hd-compact-pagination-prev"
          >
            {t("vacancies.previous")}
          </button>

          <div className="hd-compact-pagination-info">
            {t("vacancies.page_info", {
              page: pagination.page,
              totalPages: pagination.totalPages,
            })}
          </div>

          <button
            disabled={pagination.page === pagination.totalPages}
            onClick={() =>
              setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
            }
            className="hd-compact-pagination-btn hd-compact-pagination-next"
          >
            {t("vacancies.next")}
          </button>
        </div>
      )}

      {/* Modal */}
      <VacancyModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalClose}
        vacancy={selectedVacancy}
      />
    </div>
  );
};

export default JobPostsManagement;
