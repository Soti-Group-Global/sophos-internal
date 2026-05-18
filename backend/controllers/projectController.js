const Project = require("../models/Project");
const User = require("../models/User");

// Create a new project
exports.createProject = async (req, res) => {
  try {
    const { name, description, createdBy, members } = req.body;

    // Basic validation
    if (!name) {
      return res
        .status(400)
        .json({ success: false, message: "Project name is required" });
    }

    // Create the project
    const project = await Project.create({
      name,
      description: description || "",
      createdBy: createdBy || null,
      members: Array.isArray(members) ? members : [],
    });

    res.status(201).json({ success: true, project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// Get all projects (handles company & personal visibility)
exports.getProjects = async (req, res) => {
  try {
    const { email, role } = req.query;

    if (!email || !role) {
      return res
        .status(400)
        .json({ success: false, message: "Email and role are required" });
    }

    let filter = {};

    if (role === "head_manager") {
      // Head manager sees all company projects + any shared/created ones
      filter = {
        $or: [
          { createdBy: null },     // company-level projects
          { createdBy: email },    // their own personal projects
          { members: email },      // where they’re added as a member
        ],
      };
    } else {
      // All other users: see only their personal & shared ones
      filter = {
        $or: [
          { createdBy: email },    // personal projects
          { members: email },      // shared projects
        ],
      };
    }

    const projects = await Project.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, projects });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



// Get single project by ID
exports.getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    res.json({ success: true, project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update project
exports.updateProject = async (req, res) => {
  try {
    const project = await Project.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.json({ success: true, project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete project
exports.deleteProject = async (req, res) => {
  try {
    await Project.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Project deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addMembersToProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { emails } = req.body; // Array of emails

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ message: "No emails provided" });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Normalize emails (trim + lowercase)
    const normalizedEmails = emails.map((email) => email.trim().toLowerCase());

    // Merge with existing, removing duplicates
    const updatedMembers = Array.from(
      new Set([...(project.members || []), ...normalizedEmails])
    );

    project.members = updatedMembers;
    await project.save();

    res.status(200).json({
      message: "Members added successfully",
      members: project.members,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};


exports.getProjectMembers = async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId).lean();

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.status(200).json({
      message: "Members fetched successfully",
      data: project.members || [],
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error while fetching project members",    });
  }
};