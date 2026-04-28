import React, { useEffect, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  getTasksByProject,
  createTask,
  reorderTask,
  updateTask,
  getProjectMembers,
} from "../utils/api";
import {
  FiPlus,
  FiCalendar,
  FiUser,
  FiMoreVertical,
  FiFlag,
  FiCheckCircle,
  FiChevronDown,
  FiFilter,
  FiEdit3,
  FiMessageSquare,
  FiPaperclip,
  FiClock,
  FiAlertCircle,
} from "react-icons/fi";
import "../styles/TaskBoard.css";

const columns = [
  {
    id: "todo",
    title: "To Do",
    icon: "📋",
    accentColor: "#ef4444",
    gradient: "linear-gradient(135deg, #ef4444, #dc2626)",
  },
  {
    id: "inprocess",
    title: "In Progress",
    icon: "🔄",
    accentColor: "#06b6d4",
    gradient: "linear-gradient(135deg, #06b6d4, #0891b2)",
  },
  {
    id: "completed",
    title: "Completed",
    icon: "✅",
    accentColor: "#22c55e",
    gradient: "linear-gradient(135deg, #22c55e, #16a34a)",
  },
];

const priorityLevels = {
  low: { color: "#10b981", label: "Low", icon: "⬇️", bgColor: "#ecfdf5" },
  medium: { color: "#f59e0b", label: "Medium", icon: "⏸️", bgColor: "#fffbeb" },
  high: { color: "#ef4444", label: "High", icon: "⬆️", bgColor: "#fef2f2" },
  critical: {
    color: "#dc2626",
    label: "Critical",
    icon: "🚨",
    bgColor: "#fef2f2",
  },
};

const AssigneePopover = ({ task, projectId, onClose, onUpdate }) => {
  const [members, setMembers] = useState([]);
  const [selected, setSelected] = useState(task.assignedTo || []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const res = await getProjectMembers(projectId);
      setMembers(res.data.data || []);
    } catch (err) {
      console.error("Error fetching project members:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleMember = (email) => {
    setSelected((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  };

  const handleSave = async () => {
    try {
      await updateTask(task._id, { assignedTo: selected });
      onUpdate();
      onClose();
    } catch (err) {
      console.error("Error updating task assignees:", err);
    }
  };

  return (
    <div className="modern-popover assignees-popover">
      <div className="popover-header">
        <h4>Assign Team Members</h4>
      </div>
      <div className="popover-content">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <span>Loading team members...</span>
          </div>
        ) : members.length ? (
          <div className="modern-employee-list">
            {members.map((email, idx) => (
              <label key={idx} className="modern-employee-item">
                <div className="checkbox-wrapper">
                  <input
                    type="checkbox"
                    checked={selected.includes(email)}
                    onChange={() => toggleMember(email)}
                  />
                  <span className="checkmark"></span>
                </div>
                <div className="employee-avatar">
                  {email.charAt(0).toUpperCase()}
                </div>
                <span className="employee-email">{email}</span>
              </label>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <FiUser size={20} />
            <span>No team members found</span>
          </div>
        )}
      </div>
      <div className="popover-actions">
        <button className="modern-btn secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="modern-btn primary" onClick={handleSave}>
          Save Changes
        </button>
      </div>
    </div>
  );
};

function TaskBoard({ projectId, isPersonalProject, currentUserEmail }) {
  const [tasks, setTasks] = useState({
    todo: [],
    inprocess: [],
    completed: [],
  });
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isAddingTask, setIsAddingTask] = useState(null);
  const [activeCalendar, setActiveCalendar] = useState(null);
  const [activePriority, setActivePriority] = useState(null);
  const [activeMenu, setActiveMenu] = useState(null);
  const [expandedTasks, setExpandedTasks] = useState(new Set());

  useEffect(() => {
    if (projectId) loadTasks();
  }, [projectId]);

  const loadTasks = async () => {
    const data = await getTasksByProject(projectId);
    const grouped = { todo: [], inprocess: [], completed: [] };
    data.forEach((t) => grouped[t.status].push(t));
    setTasks(grouped);
  };

  const handleAddTask = async (status) => {
    if (!newTaskTitle.trim()) return;
    await createTask({
      title: newTaskTitle,
      projectId,
      status,
      assignedTo: [currentUserEmail],
      priority: "medium",
    });
    setNewTaskTitle("");
    setIsAddingTask(null);
    loadTasks();
  };

  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    )
      return;

    const startCol = source.droppableId;
    const endCol = destination.droppableId;

    const newTasks = JSON.parse(JSON.stringify(tasks));
    const startTasks = Array.from(newTasks[startCol]);
    const movedTaskIndex = startTasks.findIndex((t) => t._id === draggableId);

    if (movedTaskIndex === -1) return;

    const [movedTask] = startTasks.splice(movedTaskIndex, 1);
    newTasks[startCol] = startTasks;

    const endTasks = Array.from(newTasks[endCol]);
    const updatedTask = {
      ...movedTask,
      status: endCol,
    };
    endTasks.splice(destination.index, 0, updatedTask);
    newTasks[endCol] = endTasks;

    setTasks(newTasks);

    try {
      await reorderTask({
        taskId: draggableId,
        source,
        destination,
      });
    } catch (err) {
      console.error("Reorder error:", err);
      loadTasks();
    }
  };

  const handleDateChange = async (taskId, newDate) => {
    try {
      await updateTask(taskId, { dueDate: newDate });
      loadTasks();
    } catch (err) {
      console.error("Error updating date:", err);
    }
    setActiveCalendar(null);
  };

  const handlePriorityChange = async (taskId, newPriority) => {
    try {
      await updateTask(taskId, { priority: newPriority });
      loadTasks();
    } catch (err) {
      console.error("Error updating priority:", err);
    }
    setActivePriority(null);
  };

  const handleCompleteTask = async (taskId, currentStatus) => {
    try {
      const newStatus = currentStatus === "completed" ? "todo" : "completed";
      await updateTask(taskId, { status: newStatus });
      loadTasks();
    } catch (err) {
      console.error("Error updating task status:", err);
    }
  };

  const toggleTaskExpansion = (taskId) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays === -1) return "Yesterday";
    if (diffDays < 0) return `${Math.abs(diffDays)}d ago`;

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatDateForInput = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toISOString().split("T")[0];
  };

  const getUserInitials = (email) => {
    return email ? email.charAt(0).toUpperCase() : "U";
  };

  const getUserColor = (email) => {
    const colors = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6"];
    const index = email ? email.charCodeAt(0) % colors.length : 0;
    return colors[index];
  };

  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const getDaysUntilDue = (dueDate) => {
    if (!dueDate) return null;
    const date = new Date(dueDate);
    const now = new Date();
    const diffTime = date - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  useEffect(() => {
  const closePopovers = (e) => {
    if (!e.target.closest('.modern-popover') && !e.target.closest('.modern-meta-btn')) {
      setActiveCalendar(null);
      setActivePriority(null);
      setActiveMenu(null);
    }
  };
  document.addEventListener("click", closePopovers);
  return () => document.removeEventListener("click", closePopovers);
}, []);


  return (
    <div className="modern-task-board-container">
      {projectId ? (
        <div className="modern-task-board">
          {/* Modern Board Header 
          <div className="modern-board-header">
            <div className="header-main">
              <div className="header-title-section">
                <h1 className="modern-board-title">Task Board</h1>
                <div className="board-stats">
                  <div className="stat-item">
                    <span className="stat-number">
                      {tasks.todo.length + tasks.inprocess.length + tasks.completed.length}
                    </span>
                    <span className="stat-label">Total Tasks</span>
                  </div>
                  <div className="stat-divider"></div>
                  <div className="stat-item">
                    <span className="stat-number completed">{tasks.completed.length}</span>
                    <span className="stat-label">Completed</span>
                  </div>
                  <div className="stat-divider"></div>
                  <div className="stat-item">
                    <span className="stat-number in-progress">{tasks.inprocess.length}</span>
                    <span className="stat-label">In Progress</span>
                  </div>
                </div>
              </div>
              <div className="header-actions">
                <button className="modern-icon-btn" title="Filter tasks">
                  <FiFilter size={18} />
                </button>
                <button className="modern-primary-btn">
                  <FiPlus size={18} />
                  <span>Add Task</span>
                </button>
              </div>
            </div>
          </div>
*/}
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="modern-task-columns">
              {columns.map((column) => (
                <div key={column.id} className="modern-column">
                  {/* Modern Column Header */}
                  <div className="modern-column-header">
                    <div className="column-title-section">
                      <div
                        className="column-accent-bar"
                        style={{ background: column.gradient }}
                      ></div>
                      <div className="column-icon-wrapper">
                        <span className="column-icon">{column.icon}</span>
                      </div>
                      <div className="column-info">
                        <h3 className="modern-column-title">{column.title}</h3>
                        <span className="modern-task-count">
                          {tasks[column.id]?.length || 0} tasks
                        </span>
                      </div>
                    </div>
                    {isPersonalProject && (
                      <button
                        className="modern-add-task-btn"
                        onClick={() =>
                          setIsAddingTask(
                            isAddingTask === column.id ? null : column.id
                          )
                        }
                        title="Add new task"
                      >
                        <FiPlus size={16} />
                      </button>
                    )}
                  </div>

                  {/* Modern Add Task Card */}
                  {isAddingTask === column.id && (
                    <div className="modern-add-task-card">
                      <div className="add-task-header">
                        <div className="task-avatar">
                          {getUserInitials(currentUserEmail)}
                        </div>
                        <input
                          type="text"
                          placeholder="What needs to be done?"
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          onKeyPress={(e) =>
                            e.key === "Enter" && handleAddTask(column.id)
                          }
                          autoFocus
                          className="modern-task-input"
                        />
                      </div>
                      <div className="add-task-actions">
                        <button
                          onClick={() => setIsAddingTask(null)}
                          className="modern-btn secondary"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleAddTask(column.id)}
                          className="modern-btn primary"
                          disabled={!newTaskTitle.trim()}
                        >
                          Add Task
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Modern Task List */}
                  <Droppable droppableId={column.id}>
                    {(provided, snapshot) => (
                      <div
                        className={`modern-task-list ${
                          snapshot.isDraggingOver ? "dragging-over" : ""
                        }`}
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                      >
                        {(tasks[column.id] || []).map((task, index) => {
                          const daysUntilDue = getDaysUntilDue(task.dueDate);
                          const isTaskOverdue = isOverdue(task.dueDate);

                          return (
                            <Draggable
                              key={task._id}
                              draggableId={task._id}
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`modern-task-card ${
                                    snapshot.isDragging ? "dragging" : ""
                                  } ${
                                    task.status === "completed"
                                      ? "completed"
                                      : ""
                                  } ${
                                    expandedTasks.has(task._id)
                                      ? "expanded"
                                      : ""
                                  } ${isTaskOverdue ? "overdue" : ""}`}
                                >
                                  <div className="task-card-content">
                                    {/* Task Header */}
                                    <div className="task-header">
                                      <div className="task-main-info">
                                        <button
                                          className={`modern-complete-btn ${
                                            task.status === "completed"
                                              ? "completed"
                                              : ""
                                          }`}
                                          onClick={() =>
                                            handleCompleteTask(
                                              task._id,
                                              task.status
                                            )
                                          }
                                        >
                                          <FiCheckCircle size={16} />
                                        </button>
                                        <div className="task-text-content">
                                          <h4
                                            className="modern-task-title"
                                            onClick={() =>
                                              toggleTaskExpansion(task._id)
                                            }
                                          >
                                            {task.title}
                                          </h4>
                                          {task.description &&
                                            expandedTasks.has(task._id) && (
                                              <p className="modern-task-description">
                                                {task.description}
                                              </p>
                                            )}
                                        </div>
                                      </div>

                                      {/* Task Actions */}
                                      <div className="task-actions">
                                        {/* Priority Badge */}
                                        {task.priority && (
                                          <div
                                            className="modern-priority-badge"
                                            style={{
                                              backgroundColor:
                                                priorityLevels[task.priority]
                                                  ?.bgColor,
                                              color:
                                                priorityLevels[task.priority]
                                                  ?.color,
                                            }}
                                            title={
                                              priorityLevels[task.priority]
                                                ?.label
                                            }
                                          >
                                            <FiFlag size={12} />
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Task Meta */}
                                    {isPersonalProject && (
                                    <div className="modern-task-meta">
                                      {/* Due Date */}
                                      <div className="meta-item-wrapper">
                                        <button
                                          className={`modern-meta-btn date ${
                                            isTaskOverdue ? "overdue" : ""
                                          } ${
                                            daysUntilDue === 0 ? "today" : ""
                                          } ${
                                            daysUntilDue === 1 ? "tomorrow" : ""
                                          }`}
                                          onClick={() =>
                                            setActiveCalendar(
                                              activeCalendar === task._id
                                                ? null
                                                : task._id
                                            )
                                          }
                                        >
                                          <FiCalendar size={14} />
                                          <span>
                                            {task.dueDate
                                              ? formatDate(task.dueDate)
                                              : "Set due date"}
                                          </span>
                                          {isTaskOverdue && (
                                            <FiAlertCircle size={12} />
                                          )}
                                        </button>

                                        {activeCalendar === task._id && (
                                          <div className="modern-popover date-popover">
                                            <div className="popover-header">
                                              <h4>Due Date</h4>
                                            </div>
                                            <div className="popover-content">
                                              <input
                                                type="date"
                                                value={formatDateForInput(
                                                  task.dueDate
                                                )}
                                                onChange={(e) =>
                                                  handleDateChange(
                                                    task._id,
                                                    e.target.value
                                                  )
                                                }
                                                className="modern-date-input"
                                                autoFocus
                                              />
                                            </div>
                                            <div className="popover-actions">
                                              <button
                                                onClick={() =>
                                                  handleDateChange(
                                                    task._id,
                                                    null
                                                  )
                                                }
                                                className="modern-btn secondary"
                                              >
                                                Clear
                                              </button>
                                              <button
                                                onClick={() =>
                                                  setActiveCalendar(null)
                                                }
                                                className="modern-btn primary"
                                              >
                                                Apply
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      {/* Priority */}
                                      <div className="meta-item-wrapper popover-wrapper">
                                        <button
                                          className="modern-meta-btn priority"
                                          onClick={() =>
                                            setActivePriority(
                                              activePriority === task._id
                                                ? null
                                                : task._id
                                            )
                                          }
                                        >
                                          <FiFlag size={14} />
                                          <span>
                                            {task.priority
                                              ? `${
                                                  task.priority
                                                    .charAt(0)
                                                    .toUpperCase() +
                                                  task.priority.slice(1)
                                                } Priority`
                                              : "Set priority"}
                                          </span>
                                        </button>

                                        {activePriority === task._id && (
                                          <div className="modern-popover priority-popover">
                                            <div className="popover-header">
                                              <h4>Priority</h4>
                                            </div>
                                            <div className="popover-content">
                                              {Object.entries(
                                                priorityLevels
                                              ).map(
                                                ([
                                                  key,
                                                  { color, label, icon },
                                                ]) => (
                                                  <button
                                                    key={key}
                                                    className="modern-priority-option"
                                                    onClick={() =>
                                                      handlePriorityChange(
                                                        task._id,
                                                        key
                                                      )
                                                    }
                                                  >
                                                    <span className="priority-icon">
                                                      {icon}
                                                    </span>
                                                    <span style={{ color }}>
                                                      {label}
                                                    </span>
                                                  </button>
                                                )
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div> )}
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}

                        {/* Modern Empty State */}
                        {tasks[column.id]?.length === 0 && !isAddingTask && (
                          <div className="modern-empty-state">
                            <div className="empty-illustration">
                              <div className="empty-icon">📝</div>
                              <div className="empty-glow"></div>
                            </div>
                            <h4>No tasks yet</h4>
                            {isPersonalProject && (
                            <>
                              <p>Get started by creating your first task</p>
                              <button
                                className="modern-btn outline"
                                onClick={() => setIsAddingTask(column.id)}
                              >
                                <FiPlus size={16} />
                                Add First Task
                              </button>
                            </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              ))}
            </div>
          </DragDropContext>
        </div>
      ) : (
        <div className="modern-no-project">
          <div className="modern-empty-board">
            <div className="empty-board-illustration">
              <div className="board-icon">🚀</div>
              <div className="board-glow"></div>
            </div>
            <h2>No Project Selected</h2>
            <p>Choose a project from the sidebar to start managing tasks</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default TaskBoard;
