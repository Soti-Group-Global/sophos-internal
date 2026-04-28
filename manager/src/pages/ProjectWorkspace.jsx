import React, { useState, useContext, useEffect } from "react";
import ProjectSidebar from "../components/ProjectSidebar";
import TaskBoard from "../components/TaskBoard";
import "../styles/Workspace.css";
import LoadingComponent from "../components/Loading/LoadingComponent";
import { AuthContext } from "../context/AuthContext";
import { FiUserPlus, FiX, FiCheck, FiUsers } from "react-icons/fi";
import { getEmployees, addMembersToProject } from "../utils/api";
import { useTranslation } from "react-i18next";

function ProjectWorkspace() {
  const { t } = useTranslation();
  const { user } = useContext(AuthContext);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [loading, setLoading] = useState(false);

  const currentUserEmail = user.email;

  // Fetch employees when popup opens
  useEffect(() => {
    if (showAddMember) {
      fetchEmployees();
    }
  }, [showAddMember]);

  const fetchEmployees = async () => {
    if (!selectedProject?._id) return;
    try {
      setLoading(true);
      const response = await getEmployees(selectedProject._id);
      setEmployees(response.data.data || []);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEmployee = (email) => {
    setSelectedEmployees((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  };

  const handleAddMembers = async () => {
    if (!selectedEmployees.length || !selectedProject) return;

    try {
      await addMembersToProject(selectedProject._id, selectedEmployees);
      alert(t("workspace.addMembers.addedSuccess"));
      setShowAddMember(false);
      setSelectedEmployees([]);
    } catch (error) {
      alert(t("workspace.addMembers.failedToAdd"));
    }
  };

  // Determine project type (personal or company)
  const projectType =
    selectedProject && selectedProject.createdBy === null
      ? "company"
      : "personal";

  return (
    <div className="workspace-container">
      <ProjectSidebar
        selectedProject={selectedProject}
        onSelectProject={setSelectedProject}
        currentUserEmail={currentUserEmail}
        t={t}
      />

      <div className="workspace-content">
        {selectedProject ? (
          <>
            {/* Header Section */}
            <div className="workspace-header">
              <div className="workspace-header-content">
                <div className="project-info">
                  <h1 className="project-title">{selectedProject.name}</h1>
                  {selectedProject.description && (
                    <p className="project-description">
                      {selectedProject.description}
                    </p>
                  )}
                </div>

                {user.role == "head_manager" && (
                  <div className="header-actions">
                    <button
                      className="add-member-btn modern-btn"
                      onClick={() => setShowAddMember((prev) => !prev)}
                      title={t("workspace.addTeam")}
                    >
                      <FiUserPlus size={14} />
                      <span>{t("workspace.addTeam")}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Popover */}
              {showAddMember && (
                <div
                  className="modern-popover-overlay"
                  onClick={() => setShowAddMember(false)}
                >
                  <div
                    className="project-modern-popover"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="popover-header">
                      <div className="popover-title">
                        <FiUsers size={20} />
                        <h3>{t("workspace.addMembers.title")}</h3>
                      </div>
                      <button
                        className="popover-close-btn"
                        onClick={() => setShowAddMember(false)}
                      >
                        <FiX size={18} />
                      </button>
                    </div>

                    <div className="popover-content">
                      {loading ? (
                        <div className="loading-state">
                          <div className="loading-spinner"></div>
                          <p>{t("workspace.addMembers.loading")}</p>
                        </div>
                      ) : (
                        <div className="employee-list">
                          {employees.length ? (
                            employees.map((emp, idx) => (
                              <div
                                key={idx}
                                className={`employee-item ${
                                  emp.assigned ? "already-assigned" : ""
                                }`}
                              >
                                <label className="employee-checkbox">
                                  <input
                                    type="checkbox"
                                    checked={
                                      emp.assigned ||
                                      selectedEmployees.includes(emp.email)
                                    }
                                    disabled={emp.assigned}
                                    onChange={() =>
                                      handleToggleEmployee(emp.email)
                                    }
                                  />
                                  <span className="checkmark"></span>
                                </label>
                                <div className="employee-info">
                                  <span className="employee-name">
                                    {emp.name !== "N/A"
                                      ? emp.name
                                      : t("workspace.addMembers.unnamedUser")}
                                  </span>
                                  <span className="employee-email">
                                    {emp.email}
                                  </span>
                                </div>
                                {emp.assigned && (
                                  <span className="assigned-badge">
                                    <FiCheck size={12} />
                                    {t("workspace.addMembers.assignedBadge")}
                                  </span>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="empty-state">
                              <FiUsers size={32} />
                              <p>{t("workspace.addMembers.noMembers")}</p>
                              <span>
                                {t("workspace.addMembers.allAssigned")}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="popover-actions">
                      <button
                        className="confirm-btn modern-btn primary"
                        onClick={handleAddMembers}
                        disabled={!selectedEmployees.length}
                      >
                        {t("workspace.addMembers.addSelected")}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <TaskBoard
              projectId={selectedProject._id}
              projectType={projectType}
              userRole={user.role}
              currentUserEmail={currentUserEmail}
              t={t}
            />
          </>
        ) : (
          <div className="workspace-empty">
            <div className="empty-state">
              <FiUsers size={48} />
              <h2>{t("workspace.welcome")}</h2>
              <p>{t("workspace.selectProject")}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectWorkspace;
