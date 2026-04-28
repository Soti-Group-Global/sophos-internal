/**
 * Test Script: Verify Invoice Numbers Are Unique for Each Payment
 * Run: node testInvoiceNumbers.js
 */

const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const Application = require("../../models/Application");
const User = require("../../models/User");

async function testInvoiceNumbers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Get a valid doctor and patient email
    const patient = await User.findOne({ role: "patient" }).lean();
    const doctor = await User.findOne({ role: "doctor" }).lean();

    if (!patient || !doctor) {
      await mongoose.connection.close();
      return;
    }


    // Create test application
    const testApp = new Application({
      applicationId: `TEST-INV-${Date.now()}`,
      patientEmail: patient.email,
      doctorEmail: doctor.email,
      serviceType: "In-face and remote consultations",
      specialty: "General",
      appointmentMode: "Online",
      appointmentStatus: "New",
      date: new Date(),
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000),
      payments: [],
      comments: [],
      documents: [],
      serviceOrders: [],
    });

    await testApp.save();

    // Add first payment
    const payment1 = {
      status: "pending",
      amount: 5000,
      finalAmount: 5000,
      currency: "RUB",
      paymentMethod: "yookassa",
      paymentType: "card",
      items: [
        {
          name: "Test Service 1",
          amount: 5000,
          currency: "RUB",
          quantity: 1,
        },
      ],
      type: "consultation",
    };

    testApp.payments.push(payment1);
    await testApp.save();

    const app1 = await Application.findById(testApp._id).lean();
    const invoice1 = app1.payments[0].invoiceNumber;

    // Add second payment
    const payment2 = {
      status: "pending",
      amount: 3000,
      finalAmount: 3000,
      currency: "RUB",
      paymentMethod: "bank",
      paymentType: "qr",
      items: [
        {
          name: "Test Service 2",
          amount: 3000,
          currency: "RUB",
          quantity: 1,
        },
      ],
      type: "consultation",
    };

    testApp.payments.push(payment2);
    await testApp.save();

    const app2 = await Application.findById(testApp._id).lean();
    const invoice2 = app2.payments[1].invoiceNumber;

    // Add third payment
    const payment3 = {
      status: "pending",
      amount: 2000,
      finalAmount: 2000,
      currency: "RUB",
      paymentMethod: "yookassa",
      paymentType: "card",
      items: [
        {
          name: "Test Service 3",
          amount: 2000,
          currency: "RUB",
          quantity: 1,
        },
      ],
      type: "consultation",
    };

    testApp.payments.push(payment3);
    await testApp.save();

    const app3 = await Application.findById(testApp._id).lean();
    const invoice3 = app3.payments[2].invoiceNumber;

    // Verify all invoice numbers are unique

    const invoices = [invoice1, invoice2, invoice3];
    const uniqueInvoices = new Set(invoices);


    if (invoices.length === uniqueInvoices.size) {
    } else {
    }

    // Check sequence incrementing
    const seq1 = parseInt(invoice1.split("-").pop(), 10);
    const seq2 = parseInt(invoice2.split("-").pop(), 10);
    const seq3 = parseInt(invoice3.split("-").pop(), 10);


    if (seq2 === seq1 + 1 && seq3 === seq2 + 1) {
    } else {
    }

    // Cleanup
    await Application.deleteOne({ _id: testApp._id });


    await mongoose.connection.close();
  } catch (error) {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

testInvoiceNumbers();
