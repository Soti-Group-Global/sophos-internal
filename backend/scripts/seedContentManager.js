const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const ContentManager = require("../models/ContentManager");
require("dotenv").config({ path: "../.env" });

async function addContentManagers() {
  try {
    // Get MongoDB URI from environment or use default
    const mongoURI =
      process.env.MONGODB_URI ||
      "mongodb+srv://vanshvjain20:KuyMGvzK8owDXW7J@cluster0.hkecx.mongodb.net/health-direct?retryWrites=true&w=majority&appName=Cluster0";

    if (!mongoURI) {
      throw new Error(
        "MongoDB URI is not defined. Please check your .env file"
      );
    }


    // Connect to MongoDB Atlas
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const contentManagers = [
      {
        userEmail: "content.manager1@healthdirect.com",
        userPassword: "Content@123",
        firstName: "Elena",
        middleName: "Sergeevna",
        lastName: "Ivanova",
        dateOfBirth: new Date("1990-05-15"),
        gender: "Female",
        age: 34,
        phoneNumber: "+7-495-111-2233",
        cityOfResidence: "Moscow",
        contentSpecialties: ["blog", "social media", "video", "email marketing"],
        profileImage: "https://images.unsplash.com/photo-1494790108755-2616b612b786?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80",
      },
      {
        userEmail: "content.manager2@healthdirect.com",
        userPassword: "Content@123",
        firstName: "Dmitry",
        middleName: "Alexandrovich",
        lastName: "Sokolov",
        dateOfBirth: new Date("1988-12-10"),
        gender: "Male",
        age: 35,
        phoneNumber: "+7-495-222-3344",
        cityOfResidence: "St. Petersburg",
        contentSpecialties: ["SEO", "content strategy", "analytics", "technical writing"],
      },
      {
        userEmail: "content.manager3@healthdirect.com",
        userPassword: "Content@123",
        firstName: "Anna",
        middleName: "Viktorovna",
        lastName: "Kuznetsova",
        dateOfBirth: new Date("1992-08-22"),
        gender: "Female",
        age: 31,
        phoneNumber: "+7-495-333-4455",
        cityOfResidence: "Moscow",
        contentSpecialties: ["medical writing", "patient education", "blog", "social media"],
      }
    ];

    let createdCount = 0;

    for (const contentManagerData of contentManagers) {
      const { userEmail, userPassword, ...contentManagerProfileData } = contentManagerData;

      // Check if user already exists
      let user = await User.findOne({ email: userEmail });
      if (user) {
        continue;
      }

      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userPassword, salt);

      // Create new user for login details
      user = new User({
        email: userEmail,
        password: hashedPassword,
        role: "content_manager",
        profileCompleted: true,
      });

      await user.save();

      // Create new content manager profile using only schema fields
      const contentManagerProfile = new ContentManager({
        firstName: contentManagerProfileData.firstName,
        middleName: contentManagerProfileData.middleName,
        lastName: contentManagerProfileData.lastName,
        dateOfBirth: contentManagerProfileData.dateOfBirth,
        gender: contentManagerProfileData.gender,
        age: contentManagerProfileData.age,
        email: userEmail,
        phoneNumber: contentManagerProfileData.phoneNumber,
        profileImage: contentManagerProfileData.profileImage,
        cityOfResidence: contentManagerProfileData.cityOfResidence,
      });

      await contentManagerProfile.save();
      
      createdCount++;
    }


    if (createdCount === 0) {
    }

    // Close the connection
    await mongoose.connection.close();
  } catch (error) {
    await mongoose.connection.close();
  }
}

addContentManagers();