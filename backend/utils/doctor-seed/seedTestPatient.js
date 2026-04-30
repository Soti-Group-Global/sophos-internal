// utils/seedTestPatient.js
// Run with: node utils/seedTestPatient.js
//
// Seeds one Patient + one Application + prints a JWT so you can test
// every patient-update API from the browser or curl.

const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();

const Patient = require("../../models/Patient");
const Application = require("../../models/Application");
const User = require("../../models/User");

async function seed() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("Missing MongoDB connection string. Set MONGODB_URI or MONGO_URI.");
  }

  await mongoose.connect(mongoUri);
  console.log("MongoDB connected for seeding test patient…");

  // ── 1. Upsert demo User (needed for JWT) ──────────────────────────────────
  const demoEmail = "demo@doctor.com";
  let user = await User.findOne({ email: demoEmail });
  if (!user) {
    const bcrypt = require("bcryptjs");
    const hashed = await bcrypt.hash("demoPassword123", 10);
    user = await User.create({
      email: demoEmail,
      password: hashed,
      role: "doctor",
      profileCompleted: true,
    });
    console.log("[SEED] Created demo user:", demoEmail);
  }

  // ── 2. Upsert Patient ─────────────────────────────────────────────────────
  const patientEmail = "john@example.com";
  let patient = await Patient.findOne({ email: patientEmail });

  if (!patient) {
    patient = await Patient.create({
      email: patientEmail,
      firstName: "John",
      middleName: "A.",
      lastName: "Doe",
      gender: "Male",
      dateOfBirth: new Date("1990-05-15"),
      phoneNumber: "+7-999-123-4567",
      additionalPhone: "+7-999-765-4321",
      notes: "Test patient created by seed script",
      // Contacts
      telegramNickname: "@johndoe",
      telegramId: "123456789",
      newsletter: true,
      egisz: false,
      instagram: "john_doe_ig",
      vk: "john_doe_vk",
      facebook: "john.doe.fb",
      ok: "",
      contactPerson: "Jane Doe",
      contactPersonPhone: "+7-999-000-0000",
      // Documents
      cmip: "1234567890123456",
      cmipDate: new Date("2023-01-15"),
      cmipOrgCode: "ORG-001",
      snils: "123-456-789 00",
      medInsuranceOrg: "Alpha Insurance",
      socialSupportCode: "SSC-100",
      citizenship: "Russia",
      documentType: "Passport",
      documentSeries: "45 00",
      documentNumber: "123456",
      documentIssuedDate: new Date("2010-06-20"),
      departmentCode: "770-001",
      documentIssuedBy: "UFMS Moscow",
      inn: "770312345678",
      // Address
      addressType: "Primary Residence",
      region: "Moscow Oblast",
      district: "Central",
      city: "Moscow",
      settlement: "",
      street: "Tverskaya",
      house: "10",
      terrain: "",
      apartment: "42",
      postcode: "125009",
      geocoordinates: "55.7558,37.6173",
      registrationChange: "",
      // Personal data
      maritalStatus: "Married",
      education: "Higher",
      employment: "Employed",
      placeOfWork: "Tech Corp",
      workSpecialty: "Software Engineer",
      changePlaceOfWork: "",
      changeOfPosition: "",
      // Disability
      disability: "No",
      // Anamnesis
      bloodGroup: "A",
      rhFactor: "Positive",
      kellAntigen: "Negative",
      otherBloodInfo: "",
      allergies: "Pollen, Dust",
      // Sub-arrays
      diseases: [
        {
          startDate: new Date("2024-01-10"),
          endDate: new Date("2024-03-10"),
          diagnosis: "Hypertension",
          icdCode: "I10",
          doctor: "Dr. Smith",
        },
      ],
      finalDiagnoses: [
        {
          date: new Date("2024-03-10"),
          diagnosis: "Essential hypertension",
          icdCode: "I10",
          primary: "1",
          doctorName: "Dr. Smith",
          jobTitle: "Cardiologist",
          speciality: "Cardiology",
        },
      ],
      radiationDoses: [
        {
          date: new Date("2024-02-01"),
          researchType: "Chest X-ray",
          effectiveDose: 0.02,
          note: "Routine check",
        },
      ],
      legalRepresentatives: [
        {
          lastName: "Doe",
          firstName: "Jane",
          middleName: "B.",
          isCurrent: true,
          birthday: new Date("1992-08-20"),
          gender: "Female",
          relationship: "Spouse",
          attitudeToPatient: "Supportive",
          documentOfAuthority: "Power of Attorney #123",
          documentType: "Passport",
          series: "45 01",
          number: "654321",
          whenIssued: new Date("2012-04-15"),
          issuedBy: "UFMS Moscow",
          snils: "987-654-321 00",
          address: "Moscow, Tverskaya 10, apt 42",
          addressType: "Same as patient",
          city: "Moscow",
          street: "Tverskaya",
          house: "10",
          apartment: "42",
        },
      ],
    });
    console.log("[SEED] ✅ Created test patient:", patientEmail, "(_id:", patient._id, ")");
  } else {
    console.log("[SEED] Test patient already exists:", patientEmail, "(_id:", patient._id, ")");
  }

  // ── 3. Upsert Application for the patient ─────────────────────────────────
  const appId = "A1001";
  let application = await Application.findOne({ applicationId: appId });

  if (!application) {
    application = await Application.create({
      applicationId: appId,
      patientEmail: patientEmail,
      doctorEmail: demoEmail,
      serviceType: "Consultation",
      appointmentStatus: "Confirmed",
      date: "2026-02-28",
      startTime: "10:00",
      endTime: "10:30",
      payments: [
        {
          status: "paid",
          amount: 5000,
          finalAmount: 5000,
          currency: "RUB",
          type: "consultation",
        },
      ],
      historyForm: { isFirstAppointment: true }, // mark as first visit
    });
    console.log("[SEED] ✅ Created test application:", appId);
  } else {
    console.log("[SEED] Test application already exists:", appId);
    // ensure the flag is set even if the app already existed
    if (!application.historyForm || !application.historyForm.isFirstAppointment) {
      await Application.updateOne(
        { _id: application._id },
        { $set: { 'historyForm.isFirstAppointment': true } }
      );
      console.log("[SEED] Updated existing application to mark first appointment");
    }
  }

  // ── 4. Generate a JWT for manual / curl testing ────────────────────────────
  const token = jwt.sign(
    { id: user._id, email: user.email, role: user.role || "doctor" },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  PATIENT_ID  :", patient._id.toString());
  console.log("  LEGAL_REP_ID:", patient.legalRepresentatives?.[0]?._id?.toString() || "N/A");
  console.log("  APP_ID      :", appId);
  console.log("  JWT TOKEN   :", token);
  console.log("══════════════════════════════════════════════════════════════\n");

  await mongoose.disconnect();
  console.log("[SEED] Done.");
}

seed().catch((err) => {
  console.error("[SEED ERROR]", err);
  process.exit(1);
});
