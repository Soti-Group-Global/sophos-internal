import React, { useState, useContext, useEffect } from "react";
import ProjectSidebar from "../components/ProjectSidebar";
import TaskBoard from "../components/TaskBoard";
import "../styles/Workspace.css";
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
      console.error("Error fetching employees:", error);
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
      alert("Members added successfully!");
      setShowAddMember(false);
      setSelectedEmployees([]);
    } catch (error) {
      console.error("Error adding members:", error);
      alert("Failed to add members.");
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

                {user.role == "head_manager" &&
                (                <div className="header-actions">
                  <button
                    className="add-member-btn modern-btn"
                    onClick={() => setShowAddMember((prev) => !prev)}
                    title="Add project members"
                  >
                    <FiUserPlus size={14} />
                    <span>Add Team</span>
                  </button>
                </div>)
                }


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
                        <h3>Add Team Members</h3>
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
                          <p>Loading team members...</p>
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
                                      : "Unnamed User"}
                                  </span>
                                  <span className="employee-email">
                                    {emp.email}
                                  </span>
                                </div>
                                {emp.assigned && (
                                  <span className="assigned-badge">
                                    <FiCheck size={12} />
                                    Added
                                  </span>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="empty-state">
                              <FiUsers size={32} />
                              <p>No team members available</p>
                              <span>
                                All employees are already part of this project
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
                        Add Selected Members
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
            />
          </>
        ) : (
          <div className="workspace-empty">
            <div className="empty-state">
              <FiUsers size={48} />
              <h2>{t("tasks.welcome")}</h2>
              <p>{t("tasks.selectaProject")}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectWorkspace;
