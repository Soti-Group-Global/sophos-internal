const mongoose = require("mongoose");
const AuditLog = require("../models/AuditLog");
const Manager = require("../models/Manager");
const SuperAdmin = require("../models/SuperAdmin");
const ContentManager = require("../models/ContentManager");
const Assistant = require("../models/Assistant");
const HeadAssistant = require("../models/HeadAssistant");
const HeadDoctor = require("../models/HeadDoctor");
const Specialist = require("../models/Specialist");
const Doctor = require("../models/Doctor");
const Patient = require("../models/Patient");

const SENSITIVE_KEYS = [
  "password",
  "token",
  "authorization",
  "cookie",
  "secret",
  "refreshToken",
  "accessToken",
  "apiKey",
  "otp",
  "pin",
];

const MAX_FIELD_LENGTH = 8000;

const normalizeValue = (value) => {
  if (value === undefined) return null;
  if (typeof value === "string" && value.length > MAX_FIELD_LENGTH) {
    return `${value.slice(0, MAX_FIELD_LENGTH)}...[truncated]`;
  }
  return value;
};

const isSensitiveKey = (key) => {
  const lower = String(key || "").toLowerCase();
  return SENSITIVE_KEYS.some((sensitiveKey) => lower.includes(sensitiveKey.toLowerCase()));
};

const sanitizeDeep = (input, seen = new WeakSet()) => {
  if (input === null || input === undefined) return input;

  if (typeof input !== "object") {
    return normalizeValue(input);
  }

  if (input instanceof Date) return input;

  if (seen.has(input)) {
    return "[Circular]";
  }
  seen.add(input);

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeDeep(item, seen));
  }

  const output = {};
  Object.keys(input).forEach((key) => {
    if (isSensitiveKey(key)) {
      output[key] = "[REDACTED]";
      return;
    }
    output[key] = sanitizeDeep(input[key], seen);
  });
  return output;
};

const methodToActionType = (method) => {
  const upper = String(method || "").toUpperCase();
  if (upper === "POST") return "CREATE";
  if (upper === "PUT" || upper === "PATCH") return "UPDATE";
  if (upper === "DELETE") return "DELETE";
  return "OTHER";
};

const getRouteHandlerName = (req) => {
  try {
    const stack = req?.route?.stack;
    if (!Array.isArray(stack) || stack.length === 0) return null;
    const last = stack[stack.length - 1];
    return last?.name || null;
  } catch (e) {
    return null;
  }
};

const deriveEntityName = (handlerName, req) => {
  if (req?.auditContext?.entity) return req.auditContext.entity;

  const name = String(handlerName || "").trim();
  if (name) {
    const cleaned = name
      .replace(/^(create|update|delete|get|fetch|list|send|mark|add|remove|upload|generate)/i, "")
      .replace(/(ById|ByEmail|Status|Details|Info)$/i, "")
      .trim();

    if (cleaned) {
      return titleCase(cleaned);
    }
  }

  const path = String(req?.path || "")
    .split("/")
    .filter(Boolean)
    .find((segment) => !segment.startsWith(":"));

  if (!path) return null;

  return titleCase(path);
};

const deriveEntityId = (req) => {
  if (req?.auditContext?.entityId) return String(req.auditContext.entityId);

  const candidates = [
    req?.params?.id,
    req?.params?.messageId,
    req?.params?.notificationId,
    req?.params?.doctorId,
    req?.params?.patientId,
    req?.body?.id,
    req?.body?._id,
  ];

  const first = candidates.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
  return first ? String(first) : null;
};

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));

const buildFullName = (doc) => {
  if (!doc) return null;
  const parts = [doc.firstName, doc.middleName, doc.lastName]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  return parts.length ? parts.join(" ") : null;
};

const deriveNameFromEmail = (email) => {
  if (!email) return null;
  const localPart = String(email).split("@")[0] || "";
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const resolveActorName = async (role, email) => {
  if (!email) return null;

  const modelByRole = {
    manager: Manager,
    head_manager: Manager,
    super_admin: SuperAdmin,
    content_manager: ContentManager,
    assistant: Assistant,
    head_assistant: HeadAssistant,
    head_doctor: HeadDoctor,
    specialist: Specialist,
    doctor: Doctor,
    patient: Patient,
  };

  const Model = modelByRole[role];
  if (!Model) {
    return deriveNameFromEmail(email);
  }

  try {
    const profile = await Model.findOne({ email }).select("firstName middleName lastName").lean();
    return buildFullName(profile) || deriveNameFromEmail(email);
  } catch (error) {
    return deriveNameFromEmail(email);
  }
};

const prettifyLabel = (value) => {
  return String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .trim();
};

const titleCase = (value) => {
  return prettifyLabel(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const toActionCode = (value) => {
  const words = prettifyLabel(value)
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return null;

  return words.map((word) => word.toUpperCase()).join("_");
};

const getHandlerVerb = (handlerName, method) => {
  const firstWord = prettifyLabel(handlerName).split(/\s+/).filter(Boolean)[0]?.toLowerCase();

  const verbMap = {
    create: "Created",
    update: "Updated",
    delete: "Deleted",
    submit: "Submitted",
    send: "Sent",
    upload: "Uploaded",
    add: "Added",
    remove: "Removed",
    mark: "Marked",
    save: "Saved",
    generate: "Generated",
    cancel: "Cancelled",
    publish: "Published",
    close: "Closed",
    deactivate: "Deactivated",
    activate: "Activated",
    reorder: "Reordered",
    receive: "Received",
    init: "Initialized",
    initialize: "Initialized",
    join: "Joined",
    end: "Ended",
    approve: "Approved",
    reject: "Rejected",
    assign: "Assigned",
  };

  if (firstWord && verbMap[firstWord]) {
    return verbMap[firstWord];
  }

  const actionType = methodToActionType(method);
  if (actionType === "CREATE") return "Created";
  if (actionType === "UPDATE") return "Updated";
  if (actionType === "DELETE") return "Deleted";
  return "Processed";
};

const isPlainObject = (value) => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);
};

const buildNameFromParts = (value) => {
  if (!isPlainObject(value)) return null;

  const parts = [value.firstName, value.middleName, value.lastName]
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  return parts.length ? parts.join(" ") : null;
};

const readMultilingualValue = (value) => {
  if (!isPlainObject(value)) return null;

  const candidates = [value.en, value.ru, value.name, value.title]
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  return candidates[0] || null;
};

const extractReadableValue = (value) => {
  if (value === null || value === undefined) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (!isPlainObject(value)) return null;

  const fullName = buildNameFromParts(value);
  if (fullName) return fullName;

  const multilingualValue = readMultilingualValue(value);
  if (multilingualValue) return multilingualValue;

  const candidateKeys = [
    "name",
    "title",
    "fullName",
    "subject",
    "label",
    "email",
    "phone",
    "bookingNumber",
    "invoiceNumber",
    "orderNumber",
    "transactionId",
    "sessionName",
    "roomName",
    "code",
    "number",
  ];

  for (const key of candidateKeys) {
    const candidate = extractReadableValue(value[key]);
    if (candidate) {
      return candidate;
    }
  }

  return null;
};

const collectCandidateRecords = (responseBody, req) => {
  const records = [];
  const ignoredKeys = new Set([
    "success",
    "message",
    "error",
    "errors",
    "validationErrors",
    "total",
    "totalPages",
    "currentPage",
    "page",
    "limit",
    "pagination",
  ]);

  const pushRecord = (value) => {
    if (!value) return;

    if (Array.isArray(value)) {
      value.forEach(pushRecord);
      return;
    }

    if (isPlainObject(value)) {
      records.push(value);
    }
  };

  pushRecord(req?.auditContext?.metadata?.entityData);

  if (isPlainObject(responseBody)) {
    pushRecord(responseBody.data);

    Object.entries(responseBody).forEach(([key, value]) => {
      if (!ignoredKeys.has(key)) {
        pushRecord(value);
      }
    });
  }

  pushRecord(req?.body);

  return records;
};

const extractEntityLabel = (responseBody, req) => {
  const records = collectCandidateRecords(responseBody, req);

  for (const record of records) {
    const readable = extractReadableValue(record);
    if (readable) {
      return readable;
    }
  }

  const fallbackId = deriveEntityId(req);
  return fallbackId || null;
};

const normalizeMessage = (message) => {
  const text = String(message || "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const buildEntityDisplay = (entityName, entityLabel) => {
  const entityTitle = titleCase(entityName || "record") || "Record";
  if (!entityLabel) return entityTitle;

  const normalizedLabel = String(entityLabel).trim();
  if (!normalizedLabel) return entityTitle;

  if (normalizedLabel.toLowerCase() === entityTitle.toLowerCase()) {
    return entityTitle;
  }

  return `${entityTitle} ${normalizedLabel}`;
};

const buildFallbackDescription = ({ handlerName, method, entityName, entityLabel, responseBody, statusCode }) => {
  const responseMessage = normalizeMessage(responseBody?.message);
  if (responseMessage && statusCode < 400) {
    return responseMessage;
  }

  const verb = getHandlerVerb(handlerName, method);
  const entityDisplay = buildEntityDisplay(entityName || handlerName, entityLabel);
  const detailWords = prettifyLabel(handlerName)
    .split(/\s+/)
    .filter(Boolean)
    .slice(1)
    .join(" ");

  const loweredEntity = entityDisplay.toLowerCase();
  const loweredDetails = detailWords.toLowerCase();

  if (statusCode >= 400) {
    return `Failed to ${verb.toLowerCase()} ${loweredEntity}`;
  }

  if (loweredDetails && !loweredEntity.includes(loweredDetails)) {
    return `${verb} ${loweredEntity} ${loweredDetails}`;
  }

  return `${verb} ${loweredEntity}`;
};

const buildPerFunctionActionType = (req, handlerName) => {
  if (req?.auditContext?.actionType) {
    return String(req.auditContext.actionType).trim();
  }

  const controllerFunctionType = toActionCode(handlerName);
  if (controllerFunctionType) {
    return controllerFunctionType;
  }

  const methodPathType = toActionCode(`${req?.method || ""} ${req?.path || ""}`);
  return methodPathType || methodToActionType(req?.method);
};

const buildPerFunctionDescription = ({ req, handlerName, entityName, entityLabel, responseBody, statusCode }) => {
  if (req?.auditContext?.message) {
    return String(req.auditContext.message).trim();
  }

  const commonDescription = buildFallbackDescription({
    handlerName,
    method: req?.method,
    entityName,
    entityLabel,
    responseBody,
    statusCode,
  });

  const functionLabel = titleCase(handlerName || "Action") || "Action";
  if (!commonDescription) {
    return functionLabel;
  }

  return `${functionLabel}: ${commonDescription}`;
};

module.exports = (req, res, next) => {
  if (!req.originalUrl.startsWith("/api")) return next();

  // Exclude health endpoint from noisy logs
  if (req.originalUrl === "/api/health") return next();

  // Log only mutating operations (no fetch/read logs)
  const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
  if (!mutatingMethods.has(String(req.method || "").toUpperCase())) {
    return next();
  }

  let responseBody = null;

  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  res.json = (body) => {
    responseBody = body;
    return originalJson(body);
  };

  res.send = (body) => {
    if (responseBody === null) {
      responseBody = body;
    }
    return originalSend(body);
  };

  res.on("finish", async () => {
    const performedAt = new Date();

    const userId = req?.user?.id || null;
    const actorName = await resolveActorName(req?.user?.role, req?.user?.email);
    const actor = {
      userId: isObjectId(userId) ? new mongoose.Types.ObjectId(String(userId)) : null,
      name: actorName,
      email: req?.user?.email || null,
      role: req?.user?.role || "anonymous",
    };

    const handlerName = getRouteHandlerName(req);
    const entityName = deriveEntityName(handlerName, req);
    const entityId = deriveEntityId(req);
    const entityLabel = extractEntityLabel(responseBody, req);
    const fallbackDescription = buildFallbackDescription({
      handlerName,
      method: req.method,
      entityName,
      entityLabel,
      responseBody,
      statusCode: res.statusCode,
    });

    const action = {
      method: req.method,
      path: req.path,
      handler: handlerName,
      entity: entityName,
      entityId,
      type: buildPerFunctionActionType(req, handlerName),
      description: buildPerFunctionDescription({
        req,
        handlerName,
        entityName,
        entityLabel,
        responseBody,
        statusCode: res.statusCode,
      }) || fallbackDescription,
      metadata: sanitizeDeep({
        ...(req.auditContext?.metadata || {}),
        entityLabel,
      }),
    };

    const requestData = {
      params: sanitizeDeep(req.params || {}),
      query: sanitizeDeep(req.query || {}),
      body: sanitizeDeep(req.body || {}),
    };

    const statusCode = res.statusCode;
    const resultData = {
      statusCode,
      error:
        statusCode >= 400
          ? sanitizeDeep({
              message: res.locals?.auditError?.message || null,
              stack: res.locals?.auditError?.stack || null,
            })
          : null,
    };

    try {
      await AuditLog.create({
        actor,
        action,
        request: requestData,
        result: resultData,
        performedAt,
      });
    } catch (e) {
      // Avoid breaking API flow if audit write fails
    }
  });

  next();
};
