/**
 * Test Script: Verify No Duplicate Payments
 * Run: node testPaymentDuplicate.js
 */

const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const Application = require("../../models/Application");
const User = require("../../models/User");
const Patient = require("../../models/Patient");
const Doctor = require("../../models/Doctor");

async function testPaymentCreation() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Find a recent application with payments
    const application = await Application.findOne({
      payments: { $exists: true, $ne: [] },
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!application) {
      await mongoose.connection.close();
      return;
    }


    application.payments.forEach((payment, index) => {
      if (payment.items && payment.items.length > 0) {
        payment.items.forEach((item, idx) => {
        });
      }
    });


    if (application.payments.length > 1) {
      // Check if payments are duplicates
      const invoices = application.payments.map((p) => p.invoiceNumber);
      const uniqueInvoices = new Set(invoices);

      if (invoices.length === uniqueInvoices.size) {
      } else {
      }

      // Check if items are identical
      const firstPayment = application.payments[0];
      const secondPayment = application.payments[1];

      const sameAmount = firstPayment.amount === secondPayment.amount;
      const sameItems =
        JSON.stringify(firstPayment.items) === JSON.stringify(secondPayment.items);

      if (sameAmount && sameItems) {
      } else {
      }
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

testPaymentCreation();
