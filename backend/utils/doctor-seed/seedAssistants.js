// backend/utils/doctor-seed/seedAssistants.js
// Run with: node utils/doctor-seed/seedAssistants.js
//
// Seeds 4 test assistants with demo doctor assigned

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
dotenv.config();

const Assistant = require("../../models/Assistant");
const User = require("../../models/User");

async function seed() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("Missing MongoDB connection string. Set MONGODB_URI or MONGO_URI.");
  }

  await mongoose.connect(mongoUri);
  console.log("MongoDB connected for seeding assistants…");

  // Demo doctor email (should match the doctor in seedTestPatient.js)
  const demoDoctorEmail = "demo@doctor.com";

  // 4 test assistants data
  const assistantsData = [
    {
      firstName: "Elena",
      middleName: "V.",
      lastName: "Petrova",
      email: "elena.petrova@assistant.ru",
      phoneNumber: "+7-999-111-2222",
      gender: "Female",
      dateOfBirth: new Date("1995-03-15"),
      specialty: "Medical Assistant",
      branches: ["Moscow", "Clinic A"],
      notificationLanguage: "ru",
    },
    {
      firstName: "Dmitri",
      middleName: "A.",
      lastName: "Ivanov",
      email: "dmitri.ivanov@assistant.ru",
      phoneNumber: "+7-999-333-4444",
      gender: "Male",
      dateOfBirth: new Date("1992-07-22"),
      specialty: "Surgical Assistant",
      branches: ["Moscow", "Clinic B"],
      notificationLanguage: "ru",
    },
    {
      firstName: "Olga",
      middleName: "N.",
      lastName: "Smirnova",
      email: "olga.smirnova@assistant.ru",
      phoneNumber: "+7-999-555-6666",
      gender: "Female",
      dateOfBirth: new Date("1998-11-10"),
      specialty: "Nursing Assistant",
      branches: ["St. Petersburg", "Clinic C"],
      notificationLanguage: "en",
    },
    {
      firstName: "Alexei",
      middleName: "S.",
      lastName: "Kuznetsov",
      email: "alexei.kuznetsov@assistant.ru",
      phoneNumber: "+7-999-777-8888",
      gender: "Male",
      dateOfBirth: new Date("1990-05-30"),
      specialty: "Medical Assistant",
      branches: ["Moscow", "Clinic A"],
      notificationLanguage: "en",
    },
  ];

  // Create or update assistants
  for (const assistantData of assistantsData) {
    try {
      // Check if assistant already exists
      let assistant = await Assistant.findOne({ email: assistantData.email });

      if (!assistant) {
        // Create user account for the assistant
        const existingUser = await User.findOne({ email: assistantData.email });
        if (!existingUser) {
          const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
          const hashedPassword = await bcrypt.hash(randomPassword, 10);
          await User.create({
            email: assistantData.email,
            password: hashedPassword,
            role: "assistant",
            profileCompleted: true,
          });
          console.log("[SEED] Created user for assistant:", assistantData.email);
        }

        // Create assistant
        assistant = await Assistant.create({
          ...assistantData,
          profileCompleted: true,
          doctors: [
            {
              doctorEmail: demoDoctorEmail,
              startDateTime: new Date("2026-05-01T08:00:00Z"),
              endDateTime: new Date("2026-12-31T20:00:00Z"),
              status: "Access Granted",
            },
          ],
        });
        console.log("[SEED] ✅ Created assistant:", assistantData.email, "(_id:", assistant._id, ")");
      } else {
        console.log("[SEED] Assistant already exists:", assistantData.email, "(_id:", assistant._id, ")");
      }
    } catch (err) {
      console.error("[SEED ERROR] Error creating assistant:", assistantData.email, err.message);
    }
  }

  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  ASSISTANTS SEEDED SUCCESSFULLY");
  console.log("══════════════════════════════════════════════════════════════\n");

  await mongoose.disconnect();
  console.log("[SEED] Done.");
}

seed().catch((err) => {
  console.error("[SEED ERROR]", err.message || err);
  process.exit(1);
});
