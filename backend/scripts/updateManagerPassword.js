const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Manager = require("../models/Manager");
require("dotenv").config();

async function updatePassword() {
  const accounts = [
    { email: "manager@gmail.com", role: "manager" },
    { email: "headmanager@gmail.com", role: "head_manager" },
  ];
  const newPassword = "Manager@123";
  const branchList = ["Moscow", "Makhachkala"];

  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not defined in environment variables");
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    for (const account of accounts) {
      const { email, role } = account;
      let user = await User.findOne({ email });

      if (!user) {
        user = new User({
          email,
          password: hashedPassword,
          role,
          profileCompleted: true,
        });
        await user.save();
      } else {
        user.password = hashedPassword;
        user.role = role;
        user.profileCompleted = true;
        await user.save();
      }

      const managerProfile = await Manager.findOneAndUpdate(
        { email },
        { $set: { branches: branchList } },
        { new: true }
      );

      if (managerProfile) {
      } else {
      }
    }

    await mongoose.connection.close();
  } catch (err) {
    await mongoose.connection.close();
    process.exit(1);
  }
}

updatePassword();
