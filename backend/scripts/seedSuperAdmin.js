/**
 * Seed Super Admin User Script
 * Run: node seedSuperAdmin.js
 * Run with delete: node seedSuperAdmin.js --delete <email>
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const path = require("path");
const User = require("../models/User");
const SuperAdmin = require("../models/SuperAdmin");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

// Function to delete user by email
async function deleteUserByEmail(email) {
  try {
    // Connect to MongoDB Atlas
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Delete from User collection
    const userResult = await User.deleteOne({ email });
    if (userResult.deletedCount > 0) {
    } else {
    }

    // Delete from SuperAdmin collection
    const superAdminResult = await SuperAdmin.deleteOne({ email });
    if (superAdminResult.deletedCount > 0) {
    } else {
    }

    await mongoose.connection.close();
  } catch (error) {
    await mongoose.connection.close();
  }
}

async function addSuperAdmin() {
  try {
    // Connect to MongoDB Atlas
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const email = "sasikumar.n@eafo.com";
    const plainPassword = "Sasikumar@2003";

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
      role: "super_admin",
      profileCompleted: true,
    });
    await user.save();

    // Check if SuperAdmin profile already exists
    let superAdmin = await SuperAdmin.findOne({ email });
    if (!superAdmin) {
      // Create minimal SuperAdmin profile
      superAdmin = new SuperAdmin({
        firstName: "Sasikumar",
        lastName: "N",
        middleName: "",
        gender: "Male",
        dateOfBirth: new Date("2003-01-01"),
        age: 0,
        email,
        phoneNumber: "1234567890",
        cityOfResidence: "Head Office",
        comments: "Super Admin account",
        branches: ["Moscow", "Makhachkala"],
      });

      await superAdmin.save();
    } else {
    }

    await mongoose.connection.close();
  } catch (error) {
    await mongoose.connection.close();
  }
}

// Check command line arguments
const args = process.argv.slice(2);
if (args[0] === "--delete" && args[1]) {
  deleteUserByEmail(args[1]);
} else if (args[0] === "--delete") {
  process.exit(1);
} else {
  addSuperAdmin();
}
