const express = require("express");
const router = express.Router();
const {
  createTask,
  getTasksByProject,
  updateTask,
  deleteTask,
  reorderTasks,
} = require("../controllers/taskController");

router.post("/", createTask);
router.get("/:projectId", getTasksByProject);
router.put("/:id", updateTask);
router.delete("/:id", deleteTask);
router.put("/reorder/move", reorderTasks);

module.exports = router;
