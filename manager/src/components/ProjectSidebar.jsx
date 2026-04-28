import React, { useEffect, useState, useContext } from "react";
import { getProjects, createProject } from "../utils/api";
import {
  FiPlus,
  FiFolder,
  FiX,
  FiSearch,
  FiUsers,
  FiGrid,
  FiUser,
  FiBriefcase,
} from "react-icons/fi";
import "../styles/ProjectSidebar.css";
import LoadingComponent from "./Loading/LoadingComponent";
import { AuthContext } from "../context/AuthContext";

function ProjectSidebar({
  selectedProject,
  onSelectProject,
  currentUserEmail,
  t, // Receive t function as prop
}) {
  const [projects, setProjects] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeView, setActiveView] = useState("company");
  const [isLoading, setIsLoading] = useState(true);
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
  });
  const { user } = useContext(AuthContext);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const data = await getProjects(currentUserEmail, user.role);
      setProjects(data);
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newProject.name.trim()) return;

    try {
      let payload = {
        name: newProject.name,
        description: newProject.description,
      };

      // Personal → attach creator and member
      if (activeView === "personal") {
        payload.createdBy = currentUserEmail;
        payload.members = [currentUserEmail];
      }

      // Company → leave creator blank or null
      if (activeView === "company") {
        payload.createdBy = null; // or ""
        payload.members = []; // you can later add members manually
      }

      const newProj = await createProject(payload);

      setProjects([...projects, newProj]);
      setNewProject({ name: "", description: "" });
      setShowModal(false);
      onSelectProject(newProj);
    } catch (error) {
    }
  };

  // Filter strictly based on creator
  const filteredProjects = projects
    .filter((project) =>
      project.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter((project) => {
      if (activeView === "personal") {
        // show projects created by this user
        return project.createdBy === currentUserEmail;
      } else if (activeView === "company") {
        // show all others (not created by this user)
        return project.createdBy !== currentUserEmail;
      }
      return true;
    });

  const getProjectInitials = (name) =>
    name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const getProjectColor = (projectId) => {
    const colors = [
      "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
      "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
      "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
      "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
      "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
      "linear-gradient(135deg, #cd9cf2 0%, #f6f3ff 100%)",
      "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
    ];
    const index = projectId ? projectId.charCodeAt(0) % colors.length : 0;
    return colors[index];
  };

  return (
    <div className="ps-sidebar-wrapper">
      {/* Header */}
      <div className="ps-header-container">
        <div className="ps-header-content">
          <div className="ps-title-section">
            <div className="ps-title-row">
              <FiGrid className="ps-icon-header" />
              <h1>{t('projects.title')}</h1>
              <span className="ps-count-badge">{projects.length}</span>
            </div>
            <p className="ps-subtitle">{t('projects.subtitle')}</p>
          </div>
          {(user?.role === "head_manager" || activeView === "personal") && (
            <button
              className="ps-create-btn"
              onClick={() => setShowModal(true)}
            >
              <FiPlus size={12} />
              <span>{t('projects.newProject')}</span>
            </button>
          )}
        </div>

        {/* Search */}
        <div className="ps-search-wrapper">
          <div className="ps-search-box">
            <FiSearch className="ps-search-icon" />
            <input
              type="text"
              placeholder={t('projects.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ps-search-input"
            />
            {searchTerm && (
              <button
                className="ps-clear-btn"
                onClick={() => setSearchTerm("")}
              >
                <FiX size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Toggle Buttons: Company / Personal */}
        <div className="ps-toggle-group">
          <button
            className={`ps-toggle-btn ${activeView === "company" ? "ps-active" : ""}`}
            onClick={() => setActiveView("company")}
          >
            <FiBriefcase size={14} />
            {t('projects.company')}
          </button>
          <button
            className={`ps-toggle-btn ${
              activeView === "personal" ? "ps-active" : ""
            }`}
            onClick={() => setActiveView("personal")}
          >
            <FiUser size={14} />
            {t('projects.personal')}
          </button>
        </div>
      </div>

      {/* Projects List */}
      <div className="ps-list-container">
        <div className="ps-project-list">
          {isLoading ? (
            <LoadingComponent message="Loading projects..." />
          ) : filteredProjects.length === 0 ? (
            <div className="ps-empty-state">
              <div className="ps-empty-icon">
                <FiFolder size={48} />
              </div>
              <h3 className="ps-empty-title">{t('projects.noProjects')}</h3>
              <p className="ps-empty-text">
                {activeView === "company"
                  ? t('projects.noCompanyProjects')
                  : t('projects.noPersonalProjects')}
              </p>
              {(user?.role === "head_manager" || activeView === "personal") && (
                <button
                  className="ps-create-btn"
                  onClick={() => setShowModal(true)}
                >
                  <FiPlus size={12} />
                  <span>{t('projects.newProject')}</span>
                </button>
              )}
            </div>
          ) : (
            filteredProjects.map((project) => (
              <div
                key={project._id}
                className={`ps-card ${
                  selectedProject && selectedProject._id === project._id
                    ? "ps-card-active"
                    : ""
                }`}
                onClick={() => onSelectProject(project)}
              >
                <div className="ps-card-header">
                  <div
                    className="ps-avatar"
                    style={{
                      background: getProjectColor(project._id),
                    }}
                  >
                    {getProjectInitials(project.name)}
                    {selectedProject && selectedProject._id === project._id && (
                      <div className="ps-active-dot"></div>
                    )}
                  </div>

                  <div className="ps-card-info">
                    <h4 className="ps-card-name">{project.name}</h4>
                    <p className="ps-card-desc">
                      {project.description || t('projects.project.noDescription')}
                    </p>
                  </div>

                  <div className="ps-members-badge">
                    <FiUsers size={14} />
                    <span>{project.members?.length || 1} {t('projects.project.members')}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div
          className="ps-modal-overlay"
          onClick={() => setShowModal(false)}
        >
          <div
            className="ps-modal-wrapper"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ps-modal-content">
              <div className="ps-modal-header">
                <div className="ps-modal-title-wrap">
                  <div className="ps-modal-icon">
                    <FiFolder size={24} />
                  </div>
                  <div>
                    <h2>{t('projects.createProject.title')}</h2>
                    <p>{t('projects.createProject.subtitle')}</p>
                  </div>
                </div>
                <button
                  className="ps-modal-close"
                  onClick={() => setShowModal(false)}
                >
                  <FiX size={20} />
                </button>
              </div>

              <form className="ps-modal-form" onSubmit={handleCreate}>
                <div className="ps-form-field">
                  <label className="ps-form-label">
                    {t('projects.createProject.nameLabel')}<span className="ps-required">*</span>
                  </label>
                  <input
                    type="text"
                    value={newProject.name}
                    onChange={(e) =>
                      setNewProject({ ...newProject, name: e.target.value })
                    }
                    placeholder={t('projects.createProject.namePlaceholder')}
                    className="ps-form-input"
                    required
                    autoFocus
                  />
                </div>

                <div className="ps-form-field">
                  <label className="ps-form-label">
                    {t('projects.createProject.descriptionLabel')} <span className="ps-optional">{t('projects.createProject.optional')}</span>
                  </label>
                  <textarea
                    rows={4}
                    value={newProject.description}
                    onChange={(e) =>
                      setNewProject({
                        ...newProject,
                        description: e.target.value,
                      })
                    }
                    placeholder={t('projects.createProject.descriptionPlaceholder')}
                    className="ps-form-textarea"
                  />
                </div>

                <div className="ps-modal-actions">
                  <button
                    type="button"
                    className="ps-btn-cancel"
                    onClick={() => setShowModal(false)}
                  >
                    {t('projects.createProject.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="ps-btn-submit"
                    disabled={!newProject.name.trim()}
                  >
                    <FiPlus size={18} />
                    {t('projects.createProject.create')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectSidebar;