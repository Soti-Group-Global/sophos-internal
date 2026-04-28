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
import { AuthContext } from "../context/AuthContext";
import { useTranslation } from "react-i18next";


function ProjectSidebar({
  selectedProject,
  onSelectProject,
  currentUserEmail,
}) {
  const [projects, setProjects] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeView, setActiveView] = useState("company"); // 👈 New toggle state
  const [isLoading, setIsLoading] = useState(true);
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
  });
  const { user } = useContext(AuthContext);
  const { t } = useTranslation();


  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const data = await getProjects(currentUserEmail, user.role);
      console.log(data);
      setProjects(data);
    } catch (error) {
      console.error("Error loading projects:", error);
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
      console.error("Error creating project:", error);
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
    <div className="modern-sidebar">
      {/* Header */}
      <div className="project-sidebar-header">
        <div className="project-header-main">
          <div className="header-title">
            <div className="title-with-badge">
              <FiGrid className="header-icon" />
              <h1>{t("tasks.projects")}</h1>
              <span className="project-count-badge">{projects.length}</span>
            </div>
            <p className="header-subtitle">{t("tasks.manageWorkspace")}</p>
          </div>
          {user?.role === "head_manager" && (
            <button
              className="create-project-btn modern-primary-btn"
              onClick={() => setShowModal(true)}
            >
              <FiPlus size={12} />
              <span>New Project</span>
            </button>
          )}
        </div>

        {/* Search */}
        <div className="search-section">
          <div className="search-container">
            <FiSearch className="search-icon" />
            <input
              type="text"
              placeholder={t("tasks.searchProjects")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            {searchTerm && (
              <button
                className="clear-search"
                onClick={() => setSearchTerm("")}
              >
                <FiX size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Toggle Buttons: Company / Personal */}
        <div className="view-toggle">
          <button
            className={`toggle-btn ${activeView === "company" ? "active" : ""}`}
            onClick={() => setActiveView("company")}
          >
            <FiBriefcase size={14} />
             {t("tasks.company")}
          </button>
          <button
            className={`toggle-btn ${
              activeView === "personal" ? "active" : ""
            }`}
            onClick={() => setActiveView("personal")}
          >
            <FiUser size={14} />
            {t("tasks.personal")}
          </button>
        </div>
      </div>

      {/* Projects List */}
      <div className="projects-container">
        <div className="project-list">
          {isLoading ? (
            <div className="loading-state">
              {[1, 2, 3].map((item) => (
                <div key={item} className="project-card-skeleton">
                  <div className="skeleton-avatar"></div>
                  <div className="skeleton-content">
                    <div className="skeleton-line short"></div>
                    <div className="skeleton-line medium"></div>
                    <div className="skeleton-line long"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="empty-state">
              <div className="empty-illustration">
                <FiFolder size={48} />
              </div>
              <h3 className="empty-title">{t("tasks.noProjectFound")}</h3>
              <p className="empty-description">
                {activeView === "company"
                  ? t("tasks.noCompanyYet")
                  : t("tasks.noProjectFound")
                }
              </p>
              {user?.role === "head_manager" && (
                <button
                  className="empty-action-btn modern-primary-btn outline"
                  onClick={() => setShowModal(true)}
                >
                  <FiPlus size={16} />
                  Create Project
                </button>
              )}
            </div>
          ) : (
            filteredProjects.map((project) => (
              <div
                key={project._id}
                className={`modern-project-card ${
                  selectedProject && selectedProject._id === project._id
                    ? "active"
                    : ""
                }`}
                onClick={() => onSelectProject(project)}
              >
                <div className="project-header">
                  <div
                    className="project-avatar"
                    style={{
                      background: getProjectColor(project._id),
                    }}
                  >
                    {getProjectInitials(project.name)}
                    {selectedProject && selectedProject._id === project._id && (
                      <div className="active-indicator"></div>
                    )}
                  </div>

                  <div className="project-info">
                    <h4 className="project-name">{project.name}</h4>
                    <p className="project-name-description">
                      {project.description || "No description"}
                    </p>
                  </div>

                  <div className="meta-item">
                    <FiUsers size={14} />
                    <span>{project.members?.length || 1}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal (unchanged) */}
      {showModal && (
        <div
          className="modern-modal-overlay"
          onClick={() => setShowModal(false)}
        >
          <div
            className="project-modern-modal-container"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="project-modern-modal-content">
              <div className="project-modern-modal-header">
                <div className="modal-title-section">
                  <div className="modal-icon-wrapper">
                    <FiFolder size={24} />
                  </div>
                  <div>
                    <h2>Create New Project</h2>
                    <p>Start organizing your work in a new project</p>
                  </div>
                </div>
                <button
                  className="modern-modal-close-btn"
                  onClick={() => setShowModal(false)}
                >
                  <FiX size={20} />
                </button>
              </div>

              <form className="modern-modal-body" onSubmit={handleCreate}>
                <div className="modern-form-group">
                  <label className="modern-form-label">
                    Project Name<span className="required-asterisk">*</span>
                  </label>
                  <input
                    type="text"
                    value={newProject.name}
                    onChange={(e) =>
                      setNewProject({ ...newProject, name: e.target.value })
                    }
                    placeholder="e.g., Website Redesign, Marketing Campaign"
                    className="modern-form-input"
                    required
                    autoFocus
                  />
                </div>

                <div className="modern-form-group">
                  <label className="modern-form-label">
                    Description <span className="optional-label">Optional</span>
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
                    placeholder="Describe the project goals..."
                    className="modern-form-textarea"
                  />
                </div>

                <div className="modern-modal-actions">
                  <button
                    type="button"
                    className="modern-cancel-btn"
                    onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="modern-create-btn"
                    disabled={!newProject.name.trim()}
                  >
                    <FiPlus size={18} />
                    Create Project
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
