import React, { useEffect, useState } from "react";
import { FiPlus } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { getTasksByProject, reorderTask, updateTask } from "../utils/api";
import "../styles/TaskBoard.css";

const columns = [
  { id: "todo", title: "To Do", icon: "📋" },
  { id: "inprocess", title: "In Progress", icon: "🔄" },
  { id: "completed", title: "Completed", icon: "✅" },
];

export default function TaskBoard({ projectId, currentUserEmail, projectType, userRole, t: propT }) {
  const { t: hookT } = useTranslation();
  const t = propT || hookT;
  const [tasks, setTasks] = useState({ todo: [], inprocess: [], completed: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    const load = async () => {
      setLoading(true);
      try {
        const data = await getTasksByProject(projectId);
        const grouped = { todo: [], inprocess: [], completed: [] };
        (data || []).forEach((it) => grouped[it.status] ? grouped[it.status].push(it) : grouped.todo.push(it));
        setTasks(grouped);
      } catch (err) {
        setTasks({ todo: [], inprocess: [], completed: [] });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId]);

  const moveTask = async (taskId, toColumn) => {
    // optimistic update
    const newTasks = { todo: [...tasks.todo], inprocess: [...tasks.inprocess], completed: [...tasks.completed] };
    for (const col of Object.keys(newTasks)) {
      const idx = newTasks[col].findIndex((t) => t._id === taskId);
      if (idx !== -1) {
        const [task] = newTasks[col].splice(idx, 1);
        task.status = toColumn;
        newTasks[toColumn].push(task);
        setTasks(newTasks);
        try {
          await updateTask(taskId, { status: toColumn });
        } catch (err) {
          // reload on error
          const data = await getTasksByProject(projectId);
          const grouped = { todo: [], inprocess: [], completed: [] };
          (data || []).forEach((it) => grouped[it.status] ? grouped[it.status].push(it) : grouped.todo.push(it));
          setTasks(grouped);
        }
        return;
      }
    }
  };

  if (!projectId) return <div className="modern-no-project">{t('taskBoard.noProject.title') || 'No project'}</div>;

  return (
    <div className="modern-task-board-container">
      <div className="modern-task-board">
        <div className="modern-task-columns">
          {columns.map((col) => (
            <div key={col.id} className="modern-column">
              <div className="modern-column-header">
                <div className="column-title-section">
                  <div className="column-accent-bar" />
                  <div className="column-icon-wrapper">
                    <span className="column-icon">{col.icon}</span>
                  </div>
                  <div className="column-info">
                    <h3 className="modern-column-title">{t(`taskBoard.columns.${col.id}`) || col.title}</h3>
                    <span className="modern-task-count">{tasks[col.id]?.length || 0} {t('taskBoard.tasks') || 'tasks'}</span>
                  </div>
                </div>
              </div>
              <div className="modern-task-list">
                {loading ? (
                  <div className="service-modal-state">{t('loading', 'Loading...')}</div>
                ) : (
                  (tasks[col.id] || []).map((task) => (
                    <div key={task._id} className="modern-task-card">
                      <div className="task-card-content">
                        <div className="task-main-info">
                          <div className="task-text-content">
                            <h4 className="modern-task-title">{task.title}</h4>
                            {task.description && <p className="modern-task-description">{task.description}</p>}
                          </div>
                        </div>
                        <div className="task-actions">
                          {col.id !== 'todo' && <button onClick={() => moveTask(task._id, 'todo')}>To Do</button>}
                          {col.id !== 'inprocess' && <button onClick={() => moveTask(task._id, 'inprocess')}>In Progress</button>}
                          {col.id !== 'completed' && <button onClick={() => moveTask(task._id, 'completed')}>Complete</button>}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
