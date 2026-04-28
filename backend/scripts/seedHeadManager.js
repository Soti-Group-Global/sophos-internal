/**
 * Seed Head Manager User Script
 * Run: node seedHeadManager.js
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const path = require("path");

// Load environment variables from the root .env file
const envPath = path.join(__dirname, '..', '.env');
require("dotenv").config({ path: envPath });

// Debug: Check if environment variables are loaded

// Check if MONGODB_URI is defined
if (!process.env.MONGODB_URI) {
  process.exit(1);
}

// Import models after dotenv is configured
const User = require("../models/User");
const Manager = require("../models/Manager");

async function addHeadManager() {
  try {
    
    // Connect to MongoDB Atlas
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const email = "headmanager2@hdmc.com";
    const plainPassword = "HeadManager@123";

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      await mongoose.connection.close();
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(plainPassword, salt);

    // Create User entry
    user = new User({
      email,
      password: hashedPassword,
      role: "head_manager",
      profileCompleted: true,
    });
    await user.save();

    // Check if HeadManager profile already exists
    let headManager = await Manager.findOne({ email });
    if (!headManager) {
      // Create HeadManager profile
      headManager = new Manager({
        firstName: "Head",
        lastName: "Manager",
        middleName: "",
        gender: "Male",
        dateOfBirth: new Date("1980-01-01"),
        age: 44,
        email,
        phoneNumber: "+10000000001",
        cityOfResidence: "Moscow",
        comments: "Initial Head Manager account",
        branch: "Moscow",
        department: "Management",
        salary: 80000,
        employmentStatus: "Full-time",
        branches: ["Moscow", "Makhachkala"],
      });

      await headManager.save();
    } else {
    }

    await mongoose.connection.close();
  } catch (error) {
    
    // Ensure connection is closed even on error
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    
    process.exit(1);
  }
}

addHeadManager();