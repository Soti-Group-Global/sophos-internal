const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Manager = require('../models/Manager');
require('dotenv').config();

async function addManager() {
  try {
    // Connect to MongoDB Atlas
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const email = 'manager1@gmail.com'; // Change to desired email
    const password = 'Manager@123'; // Change to desired password

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      await mongoose.connection.close();
      return;
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user for login details
    user = new User({
      email,
      password: hashedPassword,
      role: 'manager',
      profileCompleted: true, // Manager profile considered complete after creation
    });

    await user.save();

    // Create new manager for the for personal details
    const manager = new Manager({
      user: user._id,
      surname: 'Doe', // Required: Surname
      firstName: 'John', // Required: First Name
      patronymicName: '', // Optional
      gender: 'Male', // Required
      dateOfBirth: new Date('1980-01-01'), // Required: Date of Birth
      cityOfResidence: 'New York', // Required: City of Residence
    });

    await manager.save();

    // Close the connection
    await mongoose.connection.close();
  } catch (error) {
    await mongoose.connection.close();
  }
}

addManager();