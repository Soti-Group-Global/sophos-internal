const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const Application = require("../models/Application");

async function run() {
  const MONGO_URI = process.env.MONGODB_URI;
  if (!MONGO_URI) {
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  try {
    // Get the latest application
    const app = await Application.findOne({}).sort({ createdAt: -1 });
    if (!app) {
      return;
    }


    // Build two payments (cash/fallback to avoid external gateways)
    const now = Date.now();
    const paymentsToAdd = [
      {
        id: `local-${now}`,
        status: "pending",
        items: [
          { name: "Consultation", amount: 10 },
          { name: "Tests", amount: 15 },
        ],
        amount: 25,
        finalAmount: 25,
        currency: "RUB",
        type: "consultation",
      },
      {
        id: `local-${now + 1}`,
        status: "pending",
        items: [
          { name: "Follow-up", amount: 12 },
        ],
        amount: 12,
        finalAmount: 12,
        currency: "RUB",
        type: "consultation",
      },
    ];

    // Push payments and save to trigger invoice generation
    for (const p of paymentsToAdd) app.payments.push(p);
    await app.save();


    // Show the last two payment invoices
    const lastTwo = app.payments.slice(-2);
    lastTwo.forEach((p, i) => {
    });

    // Confirm applicationId remains unchanged
  } catch (err) {
  } finally {
    await mongoose.disconnect();
  }
}

run();
