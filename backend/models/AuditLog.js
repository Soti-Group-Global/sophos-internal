const mongoose = require("mongoose");

const actorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    name: { type: String, default: null },
    email: { type: String, default: null },
    role: { type: String, default: "anonymous" },
  },
  { _id: false }
);

const actionSchema = new mongoose.Schema(
  {
    method: { type: String, required: true },
    path: { type: String, required: true },
    handler: { type: String, default: null },
    entity: { type: String, default: null },
    entityId: { type: String, default: null },
    type: { type: String, required: true },
    description: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const requestSchema = new mongoose.Schema(
  {
    params: { type: mongoose.Schema.Types.Mixed, default: {} },
    query: { type: mongoose.Schema.Types.Mixed, default: {} },
    body: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const resultSchema = new mongoose.Schema(
  {
    statusCode: { type: Number, required: true },
    error: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: actorSchema, required: true },
    action: { type: actionSchema, required: true },
    request: { type: requestSchema, required: true },
    result: { type: resultSchema, required: true },
    performedAt: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false }
);

auditLogSchema.index({ "actor.userId": 1, performedAt: -1 });
auditLogSchema.index({ "actor.email": 1, performedAt: -1 });
auditLogSchema.index({ "action.method": 1, performedAt: -1 });
auditLogSchema.index({ "action.handler": 1, performedAt: -1 });
auditLogSchema.index({ "action.path": 1, performedAt: -1 });
auditLogSchema.index({ "result.statusCode": 1, performedAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
