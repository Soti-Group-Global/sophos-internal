const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const DoctorsProfile = require("../models/DoctorsProfile");
require("dotenv").config({ path: "../.env" });

async function addDoctors() {
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

    const doctors = [
      {
        userEmail: "doctor.nechushkina2@healthdirect.com",
        userPassword: "Doctor@123",
        firstName: "Valentina",
        middleName: "Mikhailovna",
        lastName: "Nechushkina",
        dateOfBirth: new Date("1975-03-15"),
        gender: "Female",
        age: 49,
        phoneNumber: "+7-495-123-4567",
        specialty: "Oncogynecology",
        subSpecialties: [
          "Gynecologic Oncology",
          "Surgical Oncology",
          "Fertility Preservation",
        ],
        placeOfWork: "Health-Direct Medical Center",
        position: "Head of Oncogynecology",
        regalia: "Professor, Chief Researcher",
        location: "Moscow, Russia",
        languages: ["Russian", "English"],
        services: ["Online", "Offline"],
        branches: ["Moscow Central", "Nizhny Novgorod"],
        about:
          "V. M. Nechushkina is a highly qualified surgical oncogynecologist, proficient in a full range of state-of-the-art diagnostic and therapeutic methods, and in all the surgical procedures used in modern oncogynecology, performed by both abdominal and laparoscopic approaches.",
        workExperience: `1999–2018 – Researcher, then Senior Researcher, Gynecology Department, N. N. Blokhin Research Institute of Clinical Oncology, RAMS.
2011–2015 – Associate Professor, Department of Oncology and Radiation Therapy, Faculty of Medicine, Pirogov Russian National Research Medical University.
2015–2020 – Professor, Department of Oncology and Radiation Therapy, Faculty of Medicine, Pirogov Russian National Research Medical University.
2019–present – Chief Researcher, Autonomous Nonprofit Organization 'Scientific and Educational Center "Eurasian Oncology Program"', EAFO.`,
        education: `1997 – Graduated with honors from the faculty for research and teaching staff training, I. M. Sechenov Moscow Medical Academy.
1999 – Completed residency in Oncology at N. N. Blokhin Russian Cancer Research Center, RAMS.
2002 – Defended dissertation for the degree of Candidate of Medical Sciences.
2014 – Defended doctoral dissertation on 'Uterine cancer (prognostic factors and treatment strategies)'.`,
        scientificActivities:
          "Author of more than 200 publications in Russian and international scientific journals, co-author of 7 manuals, 1 textbook, 2 patents, 7 guidelines, and over 20 clinical recommendations.",
        teachingActivity:
          "Professor at Department of Oncology, Radiation Therapy, and Radiology, Privolzhsky Research Medical University. Regular invited lecturer at national and international congresses.",
        professionalOrganizations: [
          {
            organization: "European Society of Gynecologic Oncology (ESGO)",
            role: "Member",
            region: "International",
          },
          {
            organization: "International Gynecologic Cancer Society (IGCS)",
            role: "Member",
            region: "International",
          },
          {
            organization: "Russian Society of Clinical Oncology (RUSSCO)",
            role: "Member",
            region: "Russian",
          },
        ],
        awards: [
          {
            name: "We Will Live award",
            year: 2019,
            category: "Dynasty in Oncology",
          },
          {
            name: "We Will Live award",
            year: 2021,
            category: "Best Department",
          },
          {
            name: "Medal Excellence in Healthcare",
            year: 2018,
            category: "Healthcare Excellence",
          },
        ],
        imageUrl:
          "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80",
        feesAmount: 200,
        currency: "USD",
        status: "active",
      },
      {
        userEmail: "doctor.petrov2@healthdirect.com",
        userPassword: "Doctor@123",
        firstName: "Alexander",
        middleName: "Ivanovich",
        lastName: "Petrov",
        dateOfBirth: new Date("1980-07-22"),
        gender: "Male",
        age: 44,
        phoneNumber: "+7-495-234-5678",
        specialty: "Cardiology",
        subSpecialties: [
          "Interventional Cardiology",
          "Heart Failure",
          "Preventive Cardiology",
        ],
        placeOfWork: "Moscow Cardiac Center",
        position: "Senior Cardiologist",
        regalia: "MD, PhD in Cardiology",
        location: "Moscow, Russia",
        languages: ["Russian", "English", "German"],
        services: ["Online", "Offline"],
        branches: ["Moscow Central", "St. Petersburg"],
        about:
          "Dr. Alexander Petrov is a renowned cardiologist with extensive experience in interventional cardiology and heart failure management. He specializes in complex coronary interventions and cardiac rehabilitation.",
        workExperience: `2005–2010 – Cardiology Resident, Moscow Medical Academy
2010–2015 – Cardiologist, City Clinical Hospital No. 1
2015–present – Senior Cardiologist, Moscow Cardiac Center`,
        education: `2000–2005 – MD, I.M. Sechenov First Moscow State Medical University
2005–2008 – PhD in Cardiology, Russian Cardiology Research Center`,
        scientificActivities:
          "Published over 50 research papers in international cardiology journals. Principal investigator in multiple clinical trials on heart failure management.",
        teachingActivity:
          "Visiting professor at Russian National Research Medical University. Regular speaker at national cardiology conferences.",
        professionalOrganizations: [
          {
            organization: "European Society of Cardiology (ESC)",
            role: "Fellow",
            region: "International",
          },
          {
            organization: "Russian Society of Cardiology",
            role: "Board Member",
            region: "Russian",
          },
        ],
        awards: [
          {
            name: "Best Young Cardiologist",
            year: 2016,
            category: "Cardiology Excellence",
          },
        ],
        imageUrl:
          "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80",
        feesAmount: 150,
        currency: "USD",
        status: "active",
      },
    ];

    let createdCount = 0;

    for (const doctorData of doctors) {
      const { userEmail, userPassword, ...doctorProfileData } = doctorData;

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
        role: "doctor",
        profileCompleted: true, // Doctor profile considered complete after creation
      });

      await user.save();

      // Create new doctor profile
      const doctorProfile = new DoctorsProfile({
        ...doctorProfileData,
        email: userEmail, // Use the same email for doctor profile
        phoneNumber: doctorProfileData.phoneNumber,
      });

      await doctorProfile.save();
      
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

addDoctors();
