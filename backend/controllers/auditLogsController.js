const AuditLog = require("../models/AuditLog");

const ALLOWED_ROLES = ["super_admin", "head_manager", "manager"];

const requireAuditAccess = (req, res, next) => {
  if (!req.user || !ALLOWED_ROLES.includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied" });
  }
  next();
};

const getAuditLogs = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.userId) {
      filter["actor.userId"] = req.query.userId;
    }

    if (req.query.email) {
      filter["actor.email"] = { $regex: req.query.email, $options: "i" };
    }

    if (req.query.method) {
      filter["action.method"] = String(req.query.method).toUpperCase();
    }

    if (req.query.path) {
      filter["action.path"] = { $regex: req.query.path, $options: "i" };
    }

    if (req.query.statusCode) {
      filter["result.statusCode"] = Number(req.query.statusCode);
    }

    if (req.query.from || req.query.to) {
      filter.performedAt = {};
      if (req.query.from) {
        filter.performedAt.$gte = new Date(req.query.from);
      }
      if (req.query.to) {
        filter.performedAt.$lte = new Date(req.query.to);
      }
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ performedAt: -1 }).skip(skip).limit(limit),
      AuditLog.countDocuments(filter),
    ]);

    return res.json({
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch audit logs" });
  }
};

module.exports = {
  requireAuditAccess,
  getAuditLogs,
};
