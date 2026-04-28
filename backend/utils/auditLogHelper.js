const setAuditLogContext = (req, payload = {}) => {
  if (!req || typeof req !== "object") return;

  const {
    actionType,
    entity,
    entityId,
    message,
    metadata,
  } = payload;

  req.auditContext = {
    actionType: actionType || req.auditContext?.actionType || null,
    entity: entity || req.auditContext?.entity || null,
    entityId: entityId || req.auditContext?.entityId || null,
    message: message || req.auditContext?.message || null,
    metadata: metadata || req.auditContext?.metadata || null,
  };
};

module.exports = {
  setAuditLogContext,
};
