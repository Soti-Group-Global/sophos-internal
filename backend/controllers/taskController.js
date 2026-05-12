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

// Debug-only: inspect payload and return task + siblings without mutating
exports.reorderTasksDebug = async (req, res) => {
  try {
    const { source, destination, taskId } = req.body || {};
    if (!taskId || !source || !destination) {
      return res.status(400).json({ success: false, message: "taskId, source and destination are required" });
    }

    const task = await Task.findById(taskId).lean();
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    const sourceSiblings = await Task.find({ projectId: task.projectId, status: source.droppableId }).sort({ order: 1 }).lean();
    const destSiblings = await Task.find({ projectId: task.projectId, status: destination.droppableId }).sort({ order: 1 }).lean();

    return res.json({ success: true, payload: req.body, task, sourceSiblings, destSiblings });
  } catch (err) {
    console.error("[reorderTasksDebug] error:", err.stack || err);
    return res.status(500).json({ success: false, message: err.message });
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
    const { source, destination, taskId } = req.body || {};

    if (!taskId || !source || !destination) {
      console.error("[reorderTasks] missing required fields", { taskId, source, destination });
      return res.status(400).json({ success: false, message: "taskId, source and destination are required" });
    }

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    // Normalize values
    const fromCol = source.droppableId;
    const toCol = destination.droppableId;
    const fromIndex = Number.isFinite(Number(source.index)) ? Number(source.index) : 0;
    const toIndex = Number.isFinite(Number(destination.index)) ? Number(destination.index) : 0;

    // If moved within same column, shift orders between indices
    if (fromCol === toCol) {
      // Remove the task from its current ordering and re-insert at new position
      const siblings = await Task.find({ projectId: task.projectId, status: fromCol }).sort({ order: 1 }).exec();
      // Remove the moved task from list
      const filtered = siblings.filter((s) => s._id.toString() !== task._id.toString());
      // Clamp destination index
      const insertIndex = Math.max(0, Math.min(toIndex, filtered.length));
      // Insert at destination index
      filtered.splice(insertIndex, 0, task);

      // Reassign orders sequentially with logging
      try {
        await Promise.all(
          filtered.map((t, idx) => Task.findByIdAndUpdate(t._id, { order: idx }, { new: true }))
        );
      } catch (err) {
        console.error("[reorderTasks] error resequencing same-column:", err.stack || err);
        return res.status(500).json({ success: false, message: "Error updating task order" });
      }

      // Ensure the moved task has the correct status & order
      task.status = toCol;
      task.order = insertIndex;
      await task.save();

      return res.json({ success: true, message: "Task reordered successfully" });
    }

    // Moving across columns
    // Decrement order of tasks after the source index in the source column
    try {
      await Task.updateMany(
        { projectId: task.projectId, status: fromCol, order: { $gt: fromIndex } },
        { $inc: { order: -1 } }
      );
    } catch (err) {
      console.error("[reorderTasks] error shifting source column:", err.stack || err);
      return res.status(500).json({ success: false, message: "Error updating source column orders" });
    }

    // Increment order of tasks at or after destination index in the target column
    try {
      await Task.updateMany(
        { projectId: task.projectId, status: toCol, order: { $gte: toIndex } },
        { $inc: { order: 1 } }
      );
    } catch (err) {
      console.error("[reorderTasks] error shifting destination column:", err.stack || err);
      return res.status(500).json({ success: false, message: "Error updating destination column orders" });
    }

    // Move the task
    task.status = toCol;
    task.order = toIndex;
    try {
      await task.save();
    } catch (err) {
      console.error("[reorderTasks] error saving moved task:", err.stack || err, err);
      return res.status(500).json({ success: false, message: "Error saving moved task" });
    }

    return res.json({ success: true, message: "Task moved across columns successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
