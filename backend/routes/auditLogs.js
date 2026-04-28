const express = require("express");
const auth = require("../middleware/auth");
const {
  requireAuditAccess,
  getAuditLogs,
} = require("../controllers/auditLogsController");

const router = express.Router();

router.get("/", auth, requireAuditAccess, getAuditLogs);

module.exports = router;
