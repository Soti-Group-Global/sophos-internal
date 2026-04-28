/**
 * Test Script: Verify Invoice Numbers Continue Globally Across Applications
 * Run: node testInvoicesContinue.js
 */

const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const Application = require("../../models/Application");
const User = require("../../models/User");

async function testInvoicesContinue() {
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


    // Create first application with 2 payments
    const app1 = new Application({
      applicationId: `TEST-APP1-${Date.now()}`,
      patientEmail: patient.email,
      doctorEmail: doctor.email,
      serviceType: "In-face and remote consultations",
      specialty: "General",
      appointmentMode: "Online",
      appointmentStatus: "New",
      date: new Date(),
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000),
      payments: [
        {
          status: "pending",
          amount: 5000,
          finalAmount: 5000,
          currency: "RUB",
          paymentMethod: "yookassa",
          paymentType: "card",
          items: [{ name: "Service A", amount: 5000, currency: "RUB", quantity: 1 }],
          type: "consultation",
        },
        {
          status: "pending",
          amount: 3000,
          finalAmount: 3000,
          currency: "RUB",
          paymentMethod: "bank",
          paymentType: "qr",
          items: [{ name: "Service B", amount: 3000, currency: "RUB", quantity: 1 }],
          type: "consultation",
        },
      ],
      comments: [],
      documents: [],
      serviceOrders: [],
    });

    await app1.save();

    const savedApp1 = await Application.findById(app1._id).lean();
    const inv1_1 = savedApp1.payments[0].invoiceNumber;
    const inv1_2 = savedApp1.payments[1].invoiceNumber;


    // Create second application with 2 payments
    const app2 = new Application({
      applicationId: `TEST-APP2-${Date.now()}`,
      patientEmail: patient.email,
      doctorEmail: doctor.email,
      serviceType: "In-face and remote consultations",
      specialty: "General",
      appointmentMode: "Online",
      appointmentStatus: "New",
      date: new Date(),
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000),
      payments: [
        {
          status: "pending",
          amount: 2000,
          finalAmount: 2000,
          currency: "RUB",
          paymentMethod: "yookassa",
          paymentType: "card",
          items: [{ name: "Service C", amount: 2000, currency: "RUB", quantity: 1 }],
          type: "consultation",
        },
        {
          status: "pending",
          amount: 4000,
          finalAmount: 4000,
          currency: "RUB",
          paymentMethod: "bank",
          paymentType: "card",
          items: [{ name: "Service D", amount: 4000, currency: "RUB", quantity: 1 }],
          type: "consultation",
        },
      ],
      comments: [],
      documents: [],
      serviceOrders: [],
    });

    await app2.save();

    const savedApp2 = await Application.findById(app2._id).lean();
    const inv2_1 = savedApp2.payments[0].invoiceNumber;
    const inv2_2 = savedApp2.payments[1].invoiceNumber;


    // Create third application with 1 payment
    const app3 = new Application({
      applicationId: `TEST-APP3-${Date.now()}`,
      patientEmail: patient.email,
      doctorEmail: doctor.email,
      serviceType: "In-face and remote consultations",
      specialty: "General",
      appointmentMode: "Online",
      appointmentStatus: "New",
      date: new Date(),
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000),
      payments: [
        {
          status: "pending",
          amount: 1500,
          finalAmount: 1500,
          currency: "RUB",
          paymentMethod: "yookassa",
          paymentType: "card",
          items: [{ name: "Service E", amount: 1500, currency: "RUB", quantity: 1 }],
          type: "consultation",
        },
      ],
      comments: [],
      documents: [],
      serviceOrders: [],
    });

    await app3.save();

    const savedApp3 = await Application.findById(app3._id).lean();
    const inv3_1 = savedApp3.payments[0].invoiceNumber;


    // Verify continuity

    const invoices = [inv1_1, inv1_2, inv2_1, inv2_2, inv3_1];
    const sequences = invoices.map((inv) => parseInt(inv.split("-").pop(), 10));


    // Check if sequences are continuous
    const isContinuous = sequences.every((seq, idx) => {
      if (idx === 0) return true;
      return seq === sequences[idx - 1] + 1;
    });

    if (isContinuous) {
    } else {
    }

    // Cleanup
    await Application.deleteMany({
      _id: { $in: [app1._id, app2._id, app3._id] },
    });


    await mongoose.connection.close();
  } catch (error) {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

testInvoicesContinue();
