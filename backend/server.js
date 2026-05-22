const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
require("dotenv").config();
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const auditLogger = require("./middleware/auditLogger");
const auth = require("./middleware/auth");

const { initSocket } = require("./socket");

// Routes
const managerRoutes = require("./routes/manager");
const profileRoutes = require("./routes/profile");
const doctorRoutes = require("./routes/doctors");
const doctorProfileRoutes = require("./routes/doctorsRoutes");

const patientRoutes = require("./routes/patients");
const applicationRoutes = require("./routes/applications");
const messagesRoutes = require("./routes/messages");
const availabilityRoutes = require("./routes/availability");
const doctorAvailabilityRoutes = require("./routes/doctorAvailabilityRoutes");
const whatsappRoutes = require("./routes/whatsappRoutes");
const telegramRoutes = require("./routes/telegramRoutes");
const notificationsRoutes = require("./routes/notificationsRoutes");
const promoRoutes = require("./routes/promos");
const assistantRoutes = require("./routes/assistants");
const specialtyRoutes = require("./routes/specialties");
const vendorRoutes = require("./routes/vendors");
const orderRoutes = require("./routes/orders");
const headDoctorRoutes = require("./routes/headDoctor");
const headAssistantRoutes = require("./routes/headAssistant");
const specialistRoutes = require("./routes/specialist");
const superAdminRoutes = require("./routes/superAdmin");
const contentManagerRoutes = require("./routes/contentManagerRoutes");

//Inventory routes
const inventoryItemRoutes = require("./routes/inventoryItemRoutes");
const stockRoutes = require("./routes/stockRoutes");
const supplierRoutes = require("./routes/supplierRoutes");
const supplierItemRoutes = require("./routes/supplierItemRoutes");
const purchaseOrderRoutes = require("./routes/purchaseOrderRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const stockRequestRoutes = require("./routes/stockRequestRoutes");

//Analytics routes
const earlyDetectionAnalyticsRoutes = require("./routes/earlyDetectionAnalyticsRoutes");
const applicationAnalyticsRoutes = require("./routes/applicationAnalyticsRoutes");

const maxRoutes = require("./routes/maxRoutes");
const messageRoutes = require("./routes/messageRoutes");

// Import managers list controller for direct route
const { getManagersData } = require("./controllers/managerController");

// Task routes
const projectRoutes = require("./routes/projectRoutes");
const taskRoutes = require("./routes/taskRoutes");
const employeeRoutes = require("./routes/employeeRoutes");

const livekitRoutes = require("./routes/livekit");
const vtbTestRoutes = require("./routes/vtbTest");
const meetingRoutes = require("./routes/meetingRoutes");
const plugnmeetWebhookRoutes = require("./routes/plugnmeetWebhook");
const bbbTelemedicineRoutes = require("./routes/bbbTelemedicineRoutes");

// Services routes
const serviceRoutes = require("./routes/serviceRoutes");
const subServiceRoutes = require("./routes/subServiceRoutes");

const vacancyRoutes = require('./routes/vacancy');
const vacancyApplicationRoutes = require('./routes/vacancyApplication');

const websiteDoctorsRoutes = require('./routes/website/websitedoctorsRoutes');
const blogsRoutes = require('./routes/blogs');

const reviewRoutes = require('./routes/reviewRoutes');
const contactUsRoutes = require('./routes/website/contactUsRoutes');

const patientCoordinationFormRoutes = require('./routes/website/patientCoordinationFormRoutes')
const complicatedCasesFormRoutes = require('./routes/website/complicatedCasesFormRoutes');

const contactViaPhone = require('./routes/website/contactViaPhone');

const earlyDetectionFormRoutes = require('./routes/earlyDetectionRoutes');
const earlyDetectionReportRoutes = require('./routes/earlyDetectionReportRoutes');
const earlyDetectionTemplateRoutes = require('./routes/earlyDetectionTemplateRoutes');
const doctorLeaveRoutes = require('./routes/doctorLeaveRoutes');

const specialtyMasterRoutes = require('./routes/specialtyRoutes');
const historyTemplateRoutes = require('./routes/historyTemplateRoutes');
const auditLogsRoutes = require("./routes/auditLogs");
const corporateRegisterRoutes = require('./routes/website/corporateRegisterRoutes');
const corporateFormRegistrationRoutes = require('./routes/website/corporateFormRegistrationRoutes');

const applicationSectionRoutes = require("./routes/applicationSectionRoutes");
const patientSectionRoutes = require("./routes/patientSectionRoutes");
const patientLaboratoryTestRoutes = require("./routes/patientLaboratoryTestRoutes");
const patientInstrumentalAnalysisRoutes = require("./routes/patientInstrumentalAnalysisRoutes");

//Categories and services routes
const serviceCategoryRoutes = require("./routes/serviceCategoryRoutes");
const servicePositionRoutes = require("./routes/servicePositionRoutes");

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO in one place
const io = initSocket(server);

// Make io available in all routes
app.set("io", io);

// MongoDB Connection
const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not defined");
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 2,
    });
  } catch (err) {
    console.error("Failed to start backend:", err.message);
    process.exit(1);
  }
};

// Handle MongoDB connection events
mongoose.connection.on("connected", () => {
});

mongoose.connection.on("error", (err) => {
});

mongoose.connection.on("disconnected", () => {
});

// Connect to database
connectDB();



// ── Security headers ──────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // allow GridFS image responses
}));

// ── Rate limiting ─────────────────────────────────────────────────
// Skipped in development: React Strict Mode double-invokes effects, and all
// three frontend dev servers share the same localhost IP bucket, which causes
// legitimate requests to hit the limit instantly.
const IS_DEV = process.env.NODE_ENV !== "production";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // max 20 signin attempts per window per IP
  skip: () => IS_DEV,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts, please try again after 15 minutes." },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 300,                  // generous limit for normal API usage
  skip: () => IS_DEV,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please slow down." },
});

app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5177",
        "http://localhost:5175",
        "http://localhost:5178",
        "http://localhost:5176",
        "https://health-direct-manager.vercel.app",
        "https://manager.sophos-med.ru",
        "https://health-direct-site.vercel.app",
        ...(process.env.ALLOWED_ORIGINS
          ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
          : []),
      ];

      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "x-auth-token", "Authorization", "Access-Control-Allow-Origin"],
    credentials: true,
    optionsSuccessStatus: 200 // Some legacy browsers choke on 204
  })
);

// Handle preflight requests explicitly
app.options('*', cors());

// Serve static files from public directory (auth required)
app.use('/uploads', auth, express.static('public/uploads'));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());

// ── NoSQL injection sanitization (must be AFTER body parsers) ─────
app.use(mongoSanitize());

// Global audit logging for all API requests
app.use(auditLogger);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    express: "running",
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date().toISOString()
  });
});

// ── Apply rate limits ─────────────────────────────────────────────
// Strict limit on all signin/auth endpoints
app.use("/api/auth", authLimiter);
app.use("/api/doctors/doctor-signin", authLimiter);
app.use("/api/assistants/assistant-signin", authLimiter);
app.use("/api/head-assistant/signin", authLimiter);
app.use("/api/head-doctor/signin", authLimiter);
app.use("/api/specialist/signin", authLimiter);
// General API throttle
app.use("/api", apiLimiter);

// Routes
app.use("/api/applications", applicationRoutes);
app.use("/api/auth", managerRoutes);

// Managers list endpoint (for sidebar and UI lists)
const managersListRouter = express.Router();
managersListRouter.get("/", auth, getManagersData);
app.use("/api/managers", managersListRouter);

app.use("/api/profile", profileRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/doctors-profile", doctorProfileRoutes);
app.use("/api/doctor-availability", doctorAvailabilityRoutes);
app.use("/api/doctor-leaves", doctorLeaveRoutes);

app.use("/api/patients", patientRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/availability", availabilityRoutes);

app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/telegram", telegramRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/promos", promoRoutes);
app.use("/api/assistants", assistantRoutes);
app.use("/api/specialties", specialtyRoutes);
app.use("/api/vendors", vendorRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/application-section", applicationSectionRoutes);
app.use("/api/patient-sections", patientSectionRoutes);
app.use("/api/patient-laboratory-test", patientLaboratoryTestRoutes);
app.use("/api/patient-instrumental-analysis", patientInstrumentalAnalysisRoutes);
app.use("/api/early-detection", earlyDetectionFormRoutes);
app.use("/api/head-doctors", headDoctorRoutes);
app.use("/api/head-assistants", headAssistantRoutes);
app.use("/api/specialists-doctor", specialistRoutes);
app.use("/api/super-admin", superAdminRoutes);
app.use("/api/content-managers", contentManagerRoutes);

//Inventory apis
app.use("/api/inventory/items", inventoryItemRoutes);
app.use("/api/inventory/stocks", stockRoutes);
app.use("/api/inventory/suppliers", supplierRoutes);
app.use("/api/inventory/supplier-items", supplierItemRoutes);
app.use("/api/inventory/purchase-orders", purchaseOrderRoutes);
app.use("/api/inventory/transactions", transactionRoutes);
app.use("/api/inventory/stock-requests", stockRequestRoutes);

//Analytics apis
app.use("/api/early-detection/analytics", earlyDetectionAnalyticsRoutes);
app.use("/api/applications/analytics", applicationAnalyticsRoutes);

app.use("/api/max", maxRoutes);
app.use("/api/chat-messages", messageRoutes);

//Task apis
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/employees", employeeRoutes);

app.use("/api/livekit", livekitRoutes);
app.use("/api/vtb", vtbTestRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/plugnmeet", plugnmeetWebhookRoutes);
app.use("/api/telemedicine", bbbTelemedicineRoutes);

// Services apis
app.use("/api/services", serviceRoutes);
app.use("/api/sub-services", subServiceRoutes);
app.use("/api/service-manager", serviceCategoryRoutes);
app.use("/api/service-manager/positions", servicePositionRoutes);

app.use('/api/vacancies', vacancyRoutes);
app.use('/api/vacancies', vacancyApplicationRoutes);

app.use('/api/website/doctors', websiteDoctorsRoutes);
app.use('/api/blogs', blogsRoutes);

app.use('/api/reviews', reviewRoutes);
app.use('/api/contact-us', contactUsRoutes);
app.use('/api/patient-coordination-forms', patientCoordinationFormRoutes);
app.use('/api/complicated-cases-forms', complicatedCasesFormRoutes);

app.use('/api/website/contact-via-phone', contactViaPhone);
app.use("/api/early-detection/form", earlyDetectionFormRoutes);
app.use("/api/early-detection/report", earlyDetectionReportRoutes);
app.use("/api/early-detection/templates", earlyDetectionTemplateRoutes);

app.use('/api/specialty-master', specialtyMasterRoutes);
app.use('/api/history-templates', historyTemplateRoutes);
app.use('/api/audit-logs', auditLogsRoutes);
app.use('/api/corporate-register', corporateRegisterRoutes);
app.use('/api/corporate-form-registrations', corporateFormRegistrationRoutes);


const boardRoutes = require('./routes/boardRoutes');
app.use('/api/board', boardRoutes);

// Health check / root route
app.get('/', (req, res) => {
  res.send('Server is running');
});

// Error handling middleware
app.use((err, req, res, next) => {
  res.locals.auditError = {
    message: err?.message || "Unknown server error",
    stack: err?.stack || null,
  };
  res.status(500).json({ message: "Something went wrong!" });
});

const PORT = process.env.PORT || 3003;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

