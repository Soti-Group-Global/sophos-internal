/**
 * Test Real Application Creation with Invoice Number Continuation
 */

const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const Application = require("../../models/Application");
const User = require("../../models/User");

async function testRealApplicationCreation() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Get current counter
    const Counter = require("../../models/Counter");
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const counterName = `invoiceId-${month}/${year}`;

    const counterBefore = await Counter.findOne({ name: counterName }).lean();
    const countBefore = counterBefore ? counterBefore.monthlyCount : 0;

    .padStart(4, "0")}\n`);

    // Get a valid doctor and patient email
    const patient = await User.findOne({ role: "patient" }).lean();
    const doctor = await User.findOne({ role: "doctor" }).lean();

    if (!patient || !doctor) {
      await mongoose.connection.close();
      return;
    }

    // Create a new application with 1 payment
    const testApp = new Application({
      applicationId: `REAL-TEST-${Date.now()}`,
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
          amount: 100,
          finalAmount: 100,
          currency: "RUB",
          paymentMethod: "yookassa",
          paymentType: "card",
          items: [
            {
              name: "Test Service",
              amount: 100,
              currency: "RUB",
              quantity: 1,
            },
          ],
          type: "consultation",
        },
      ],
      comments: [],
      documents: [],
      serviceOrders: [],
    });

    await testApp.save();

    // Get the saved application
    const savedApp = await Application.findById(testApp._id).lean();
    const invoiceNumber = savedApp.payments[0].invoiceNumber;
    const expectedInvoice = `INV-${month}/${year}-${String(
      countBefore + 1
    ).padStart(4, "0")}`;


    if (invoiceNumber === expectedInvoice) {
    } else {
    }

    // Check counter after creation
    const counterAfter = await Counter.findOne({ name: counterName }).lean();

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

testRealApplicationCreation();
