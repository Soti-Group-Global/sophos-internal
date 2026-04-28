const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const Manager = require("../models/Manager");
const User = require("../models/User");

const managersToDelete = [
  "manager@gmail.com",
  "headmanager2@hdmc.com",
  "headmanager1@hdmc.com",
  "headmanager@hdmc.com"
];

async function deleteManagers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);

    for (const email of managersToDelete) {
      
      // Delete from Manager collection
      const managerResult = await Manager.deleteOne({ email });
      
      // Delete from User collection
      const userResult = await User.deleteOne({ email, role: "manager" });
    }

  } catch (error) {
  } finally {
    await mongoose.connection.close();
  }
}

deleteManagers();
