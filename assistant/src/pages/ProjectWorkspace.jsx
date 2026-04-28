import React, { useState, useContext, useEffect } from "react";
import ProjectSidebar from "../components/ProjectSidebar";
import TaskBoard from "../components/TaskBoard";
import "../styles/Workspace.css";
import { AuthContext } from "../context/AuthContext";
import { FiUserPlus, FiX, FiCheck, FiUsers } from "react-icons/fi";

function ProjectWorkspace() {
  const { user } = useContext(AuthContext);
  const [selectedProject, setSelectedProject] = useState(null);
  const [isPersonalProject, setIsPersonalProject] = useState(false);
  // const [loading, setLoading] = useState(false);
  const currentUserEmail = user.email;

  useEffect(() => {
    if (selectedProject) {
      setIsPersonalProject(
        selectedProject.createdBy === currentUserEmail
      );
    }
  }, [selectedProject, currentUserEmail]);

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
            {/* Modern Header Section */}
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
              </div>
            </div>

            <TaskBoard
              projectId={selectedProject._id}
              isPersonalProject={isPersonalProject}
              currentUserEmail={currentUserEmail}
            />
          </>
        ) : (
          <div className="workspace-empty">
            <div className="empty-state">
              <FiUsers size={48} />
              <h2>Welcome to Your Workspace</h2>
              <p>Select a project from the sidebar to get started</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectWorkspace;
