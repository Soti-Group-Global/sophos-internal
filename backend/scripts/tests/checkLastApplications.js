/**
 * Check Last Two Applications in Database
 * Shows payment invoice numbers to diagnose the issue
 */

const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const Application = require("../../models/Application");

async function checkLastApplications() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Get the last 2 applications
    const applications = await Application.find()
      .sort({ createdAt: -1 })
      .limit(2)
      .lean();

    if (!applications || applications.length === 0) {
      await mongoose.connection.close();
      return;
    }


    applications.forEach((app, idx) => {

      if (app.payments && app.payments.length > 0) {
        app.payments.forEach((payment, pidx) => {
          if (payment.items && payment.items.length > 0) {
            payment.items.forEach((item) => {
            });
          }
        });
      } else {
      }
    });

    // Get the invoice counter

    const Counter = require("../../models/Counter");
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const counterName = `invoiceId-${month}/${year}`;

    const counter = await Counter.findOne({ name: counterName }).lean();

    if (counter) {
    } else {
    }

    // Check all invoice counters for current year

    const allCounters = await Counter.find({ name: /^invoiceId-.*\/2025$/ })
      .sort({ name: 1 })
      .lean();

    if (allCounters.length > 0) {
      allCounters.forEach((c) => {
      });
    } else {
    }

    await mongoose.connection.close();
  } catch (error) {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

checkLastApplications();
