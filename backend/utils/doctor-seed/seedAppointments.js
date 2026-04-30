// utils/seedAppointments.js
// Run with:  node utils/seedAppointments.js
//
// Seeds 12 Application documents with various statuses so you can test
// the Appointments-table filters (All / Upcoming / Confirmed / Completed / Cancelled).
// Also ensures the referenced patients exist so the search-by-name feature works.

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, '../../.env') });
if (!process.env.MONGODB_URI) {
  console.error('[SEED-APPTS] Failed to load MONGODB_URI from .env at', path.join(__dirname, '../../.env'));
}

const Patient = require("../../models/Patient");
const Application = require("../../models/Application");

const DOCTOR_EMAIL = "demo@doctor.com";
const DOCTOR_NAME = "Demo Doctor";

// Helper: returns an ISO-date string N days from now
const daysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
};

// Helper: full ISO string for a date + HH:mm
const toISO = (dateStr, hhmm) => new Date(`${dateStr}T${hhmm}:00`).toISOString();

// ─── Patients ────────────────────────────────────────────────────────────────
const patients = [
  { email: "john@example.com", firstName: "John", lastName: "Doe", gender: "Male", dateOfBirth: new Date("1990-05-15"), phoneNumber: "+7-999-111-0001" },
  { email: "anna@example.com", firstName: "Anna", lastName: "Smith", gender: "Female", dateOfBirth: new Date("1985-03-22"), phoneNumber: "+7-999-111-0002" },
  { email: "ivan@example.com", firstName: "Ivan", lastName: "Petrov", gender: "Male", dateOfBirth: new Date("1978-11-08"), phoneNumber: "+7-999-111-0003" },
  { email: "maria@example.com", firstName: "Maria", lastName: "Ivanova", gender: "Female", dateOfBirth: new Date("1995-07-30"), phoneNumber: "+7-999-111-0004" },
  { email: "alex@example.com", firstName: "Alex", lastName: "Johnson", gender: "Male", dateOfBirth: new Date("2000-01-12"), phoneNumber: "+7-999-111-0005" },
];
 
// ─── Appointments ────────────────────────────────────────────────────────────
const appointments = [
  // Confirmed
  { id: "HD-R030-02/2026-0179", patient: "john@example.com",  status: "Confirmed",         date: daysFromNow(1),   start: "09:00", end: "09:30", service: "Physical consultation" },
  { id: "HD-R030-02/2026-0177", patient: "anna@example.com",  status: "Confirmed",         date: daysFromNow(2),   start: "10:00", end: "10:30", service: "Telemedicine" },
  { id: "HD-R030-02/2026-0181", patient: "ivan@example.com",  status: "Confirmed",         date: daysFromNow(3),   start: "11:00", end: "11:30", service: "Physical consultation" },

  // Completed (past)
  { id: "HD-R030-02/2026-0192", patient: "maria@example.com", status: "Completed",         date: daysFromNow(-5),  start: "14:00", end: "14:30", service: "Telemedicine" },
  { id: "HD-R030-02/2026-0203", patient: "alex@example.com",  status: "Completed",         date: daysFromNow(-10), start: "15:00", end: "15:30", service: "Physical consultation" },
  { id: "HD-R030-02/2026-0213", patient: "john@example.com",  status: "Completed",         date: daysFromNow(-15), start: "16:00", end: "16:30", service: "Telemedicine" },

  // Unconfirmed (hidden by default filter — visible under Unconfirmed tab)
  { id: "HD-R030-02/2026-0225", patient: "anna@example.com",  status: "Unconfirmed",       date: daysFromNow(-2),  start: "12:00", end: "12:30", service: "Physical consultation" },

  // Upcoming
  { id: "HD-R030-02/2026-0236", patient: "ivan@example.com",  status: "Upcoming",          date: daysFromNow(4),   start: "13:00", end: "13:30", service: "Telemedicine" },
  { id: "HD-R030-02/2026-0247", patient: "maria@example.com", status: "Upcoming",          date: daysFromNow(6),   start: "08:00", end: "08:30", service: "Physical consultation" },

  // Paid
  { id: "HD-R030-02/2026-0101", patient: "alex@example.com",  status: "Paid",              date: daysFromNow(5),   start: "17:00", end: "17:30", service: "Telemedicine" },

  // Pending payment
  { id: "HD-R030-02/2026-0112", patient: "john@example.com",  status: "Pending payment",   date: daysFromNow(0),   start: "10:00", end: "10:30", service: "Physical consultation" },

  // Awaiting for Payment (hidden by default filter)
  { id: "HD-R030-02/2026-0123", patient: "anna@example.com",  status: "Awaiting for Payment", date: daysFromNow(7), start: "11:00", end: "11:30", service: "Telemedicine" },

  // New
  { id: "HD-R030-02/2026-0132", patient: "ivan@example.com",  status: "New",               date: daysFromNow(8),   start: "09:30", end: "10:00", service: "Physical consultation" },

  // Unconfirmed (second one)
  { id: "HD-R030-02/2026-0146", patient: "maria@example.com", status: "Unconfirmed",       date: daysFromNow(9),   start: "14:00", end: "14:30", service: "Telemedicine" },

  // Cancelled
  { id: "HD-R030-02/2026-0157", patient: "alex@example.com",  status: "Cancelled",         date: daysFromNow(-3),  start: "15:00", end: "15:30", service: "Physical consultation" },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("[SEED-APPTS] Connected to MongoDB");

  // ── 1. Upsert patients ────────────────────────────────────────────────────
  for (const p of patients) {
    const exists = await Patient.findOne({ email: p.email });
    if (!exists) {
      await Patient.create(p);
      console.log(`  ✅ Created patient: ${p.firstName} ${p.lastName} (${p.email})`);
    } else {
      console.log(`  ⏩ Patient already exists: ${p.email}`);
    }
  }

  // ── 2. Force-reseed appointments ────────────────────────────────────────────
  // Always delete & re-insert so status changes are reflected on each run.
  const ids = appointments.map((a) => a.id);
  const { deletedCount } = await Application.collection.deleteMany({
    applicationId: { $in: ids },
  });
  console.log(`  🗑️  Deleted ${deletedCount} existing seed appointments`);

  await Application.collection.insertMany(
    appointments.map((a) => ({
      applicationId: a.id,
      patientEmail: a.patient,
      doctorEmail: DOCTOR_EMAIL,
      doctors: [{ doctorEmail: DOCTOR_EMAIL, doctorName: DOCTOR_NAME }],
      serviceType: a.service,
      appointmentStatus: a.status,
      date: a.date,
      startTime: toISO(a.date, a.start),
      endTime: toISO(a.date, a.end),
      payments: [],
      comments: [],
      documents: [],
      serviceOrders: [],
      followUp: { needed: false, comment: "", applicationId: null, booked: false },
      meeting: { status: "scheduled" },
      historyForm: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    }))
  );

  const statusSummary = appointments.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {});
  console.log(`\n[SEED-APPTS] Done — inserted ${appointments.length} appointments`);
  console.log("[SEED-APPTS] Status breakdown:", statusSummary);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("[SEED-APPTS ERROR]", err);
  process.exit(1);
});
