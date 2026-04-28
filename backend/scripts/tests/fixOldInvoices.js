/**
 * Fix Old Application Invoice Numbers
 * Reassign proper sequential invoice numbers to applications that have 0001
 */

const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const Application = require("../../models/Application");
const Counter = require("../../models/Counter");

async function fixOldInvoices() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Get all applications with the broken invoice number
    const applications = await Application.find({
      "payments.invoiceNumber": "INV-12/2025-0001"
    })
      .sort({ createdAt: 1 })
      .lean();


    if (applications.length === 0) {
      await mongoose.connection.close();
      return;
    }

    const month = "12";
    const year = "2025";
    const monthYear = `${month}/${year}`;
    const counterName = `invoiceId-${monthYear}`;

    // Reset counter to 0 to start fresh numbering
    await Counter.updateOne(
      { name: counterName },
      { $set: { monthlyCount: 0 } }
    );

    // Fix each application
    for (let i = 0; i < applications.length; i++) {
      const app = applications[i];

      // Get the next number
      const counter = await Counter.findOneAndUpdate(
        { name: counterName },
        { $inc: { monthlyCount: 1 } },
        { new: true }
      );

      const newInvoiceNumber = `INV-${monthYear}-${String(
        counter.monthlyCount
      ).padStart(4, "0")}`;

      // Update the payment with the correct invoice number
      await Application.updateOne(
        { _id: app._id, "payments.invoiceNumber": "INV-12/2025-0001" },
        {
          $set: {
            "payments.$.invoiceNumber": newInvoiceNumber
          }
        }
      );

    }


    // Verify the fix
    const fixed = await Application.find({
      _id: { $in: applications.map(a => a._id) }
    })
      .sort({ createdAt: 1 })
      .select("applicationId payments.invoiceNumber")
      .lean();

    fixed.forEach((app, idx) => {
    });


    await mongoose.connection.close();
  } catch (error) {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

fixOldInvoices();
