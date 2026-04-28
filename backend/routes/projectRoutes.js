const express = require("express");
const router = express.Router();
const {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  addMembersToProject,
  getProjectMembers
} = require("../controllers/projectController");

router.post("/", createProject);
router.get("/", getProjects);
router.get("/:id", getProjectById);
router.put("/:id", updateProject);
router.delete("/:id", deleteProject);
router.post("/:projectId/add-members", addMembersToProject);
router.get("/:projectId/members", getProjectMembers);

module.exports = router;
