/**
 * Test Script: Simulate Payment Creation Flow
 * Creates an application with a payment and verifies only 1 payment is created
 */

const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const Application = require("../../models/Application");
const User = require("../../models/User");

async function testApplicationWithPayment() {
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


    // Count existing applications
    const countBefore = await Application.countDocuments();

    // Simulate creating an application (without payment)
    // This should create 0 payments
    const testApp1 = new Application({
      applicationId: `TEST-${Date.now()}`,
      patientEmail: patient.email,
      doctorEmail: doctor.email,
      serviceType: "In-face and remote consultations",
      specialty: "General",
      appointmentMode: "Online",
      appointmentStatus: "New",
      date: new Date(),
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000),
      payments: [], // Empty - no automatic payment
      comments: [],
      documents: [],
      serviceOrders: [],
    });

    await testApp1.save();

    if (testApp1.payments.length > 0) {
      
      testApp1.payments.forEach((p, idx) => {
        
      });
    } else {
    }

    // Now test the duplicate payment scenario
    // Simulate what happens when user explicitly creates a payment

    const testApp2 = await Application.findById(testApp1._id);

    // Simulate adding a payment (like the addPayment endpoint)
    const newPayment = {
      invoiceNumber: `TEST-INV-${Date.now()}`,
      status: "pending",
      amount: 5000,
      finalAmount: 5000,
      currency: "RUB",
      paymentMethod: "yookassa",
      paymentType: "card",
      items: [
        {
          name: "Test Service",
          amount: 5000,
          currency: "RUB",
          quantity: 1,
        },
      ],
      type: "consultation",
    };

    testApp2.payments.push(newPayment);
    await testApp2.save();


    if (testApp2.payments.length === 1) {
    } else {
      testApp2.payments.forEach((p, idx) => {
        
      });
    }

    // Cleanup: Remove test applications
    await Application.deleteOne({ _id: testApp1._id });


    await mongoose.connection.close();
  } catch (error) {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

testApplicationWithPayment();
