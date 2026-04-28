const Task = require("../models/Task");

// Create new task
exports.createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      priority,
      deadline,
      status,
      assignedTo,
      projectId,
    } = req.body;

    // find max order in this project & status for drag order
    const maxOrderTask = await Task.findOne({ projectId, status })
      .sort({ order: -1 })
      .select("order");

    const order = maxOrderTask ? maxOrderTask.order + 1 : 0;

    const task = await Task.create({
      title,
      description,
      priority,
      deadline,
      status,
      assignedTo,
      projectId,
      order,
    });

    res.status(201).json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all tasks by projectId
exports.getTasksByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const tasks = await Task.find({ projectId }).sort({ status: 1, order: 1 });
    res.json({ success: true, tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update task details (title, deadline, etc.)
exports.updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findByIdAndUpdate(id, req.body, { new: true });
    if (!task) return res.status(404).json({ message: "Task not found" });
    res.json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete task
exports.deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    await Task.findByIdAndDelete(id);
    res.json({ success: true, message: "Task deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Reorder tasks (for drag & drop)
exports.reorderTasks = async (req, res) => {
  try {
    const { source, destination, taskId } = req.body;
    const task = await Task.findById(taskId);

    if (!task) return res.status(404).json({ message: "Task not found" });

    // Update task's status if moved to another column
    task.status = destination.droppableId;
    task.order = destination.index;
    await task.save();

    // Optionally reorder other tasks in the destination column
    await Task.updateMany(
      {
        projectId: task.projectId,
        status: task.status,
        _id: { $ne: task._id },
      },
      { $inc: { order: 1 } }
    );

    res.json({ success: true, message: "Task reordered successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
