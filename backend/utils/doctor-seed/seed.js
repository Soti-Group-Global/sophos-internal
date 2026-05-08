// utils/seed.js
// Run with: node utils/seed.js (from backend folder)
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load .env from backend directory
dotenv.config({ path: path.join(__dirname, '../../.env') });
if (!process.env.MONGODB_URI) {
  console.error('[SEED ERROR] Failed to load MONGODB_URI from .env at', path.join(__dirname, '../../.env'));
}

const User = require('../../models/User');
const Doctor = require('../../models/DoctorsProfile');
const Patient = require('../../models/Patient');

async function seedDemoDoctor() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected for seeding...');

  const demoEmail = 'demo@doctor.com';
  const demoPassword = 'demoPassword123';

  // --- User ---
  let user = await User.findOne({ email: demoEmail });
  if (!user) {
    const hashed = await bcrypt.hash(demoPassword, 10);
    user = new User({
      email: demoEmail,
      password: hashed,
      role: 'doctor',
      profileCompleted: true,
    });
    await user.save();
    console.log('[SEED] Created demo user:', demoEmail, '| password:', demoPassword);
  } else {
    console.log('[SEED] Demo user already exists:', demoEmail);
  }

  // --- Specialties ---
  // create several specialties so dropdown has entries
  const Specialty = require('../../models/Specialty');
  const sampleSpecs = [
    'Ultrasound',
    'Cardiology',
    'Dermatology',
    'Neurology',
    'Pediatrics',
  ];
  for (const name of sampleSpecs) {
    const exists = await Specialty.findOne({ name });
    if (!exists) {
      await new Specialty({ name }).save();
      console.log('[SEED] created specialty', name);
    }
  }

  // Find an actual specialty document for the one area restriction
  const ultrasoundSpecialty = await Specialty.findOne({ name: 'Ultrasound' });

  // --- DoctorsProfile ---
  // Always delete and recreate to keep seed data fresh
  await Doctor.deleteOne({ email: demoEmail });
  let profile = new Doctor({
      firstName:   { en: 'Demo',   ru: 'Демо'    },
      middleName:  { en: '',       ru: ''         },
      lastName:    { en: 'Doctor', ru: 'Доктор'  },
      dateOfBirth: new Date('1990-01-01'),
      gender:      'Other',
      age:         36,
      email:       demoEmail,
      phoneNumber: '0000000000',
      currency:    'USD',
      services:    { online: true, offline: false },
      status:      'active',
      specialist:  true,
      specialtyIds: ultrasoundSpecialty ? [ultrasoundSpecialty._id] : [],
      subSpecialityIds: [],

      // Professional
      position:         { en: 'General Practitioner', ru: 'Терапевт' },
      regalia:          { en: 'PhD, Associate Professor', ru: 'К.м.н., доцент' },
      yearOfExperience: 5,

      // Location & Services
      location: { en: 'Moscow Medical Center', ru: 'Московский медицинский центр' },
      feesAmount: 3000,

      // Education & Experience
      education:               { en: 'Medical University, Faculty of Medicine, 2012. Residency in Therapy, 2014.', ru: 'Медицинский университет, лечебный факультет, 2012. Ординатура по терапии, 2014.' },
      workExperience:          { en: '5 years in general practice at City Hospital No. 1. Specialises in preventive medicine and chronic disease management.', ru: '5 лет в общей практике в Городской больнице №1. Специализация: профилактическая медицина и ведение хронических заболеваний.' },
      advancedTraining:        { en: 'Advanced course in Cardiology, 2020. Certificate in Ultrasound Diagnostics, 2021.', ru: 'Курс повышения квалификации по кардиологии, 2020. Сертификат по ультразвуковой диагностике, 2021.' },
      professionalDevelopments:{ en: 'Annual CME conferences in Internal Medicine. Online course: Modern approaches to diabetes management, 2022.', ru: 'Ежегодные конференции НМО по внутренним болезням. Онлайн-курс: Современные подходы к лечению диабета, 2022.' },

      // Achievements
      awards:                  { en: 'Best Doctor of the Year 2019, City Hospital No. 1. Excellence in Patient Care Award 2021.', ru: 'Лучший врач года 2019, Городская больница №1. Награда за excellence в уходе за пациентами 2021.' },
      internationalMemberships:{ en: 'European Society of Internal Medicine (ESIM). World Medical Association (WMA).', ru: 'Европейское общество внутренней медицины (ESIM). Всемирная медицинская ассоциация (WMA).' },
      russianMemberships:      { en: 'Russian Society of Therapists. National Medical Chamber of Russia.', ru: 'Российское общество терапевтов. Национальная медицинская палата России.' },
      scientificActivities:    { en: 'Published 3 articles in peer-reviewed journals on hypertension management. Co-author of clinical guidelines for primary care.', ru: '3 статьи в рецензируемых журналах по ведению гипертонии. Соавтор клинических рекомендаций для первичной помощи.' },

      // About
      about: { en: 'Dr. Demo Doctor is a compassionate General Practitioner with 5 years of experience in preventive and internal medicine. Committed to evidence-based care and patient education.', ru: 'Доктор Демо — внимательный терапевт с 5-летним опытом в профилактической и внутренней медицине. Приверженец доказательной медицины и просвещения пациентов.' },
  });
  await profile.save();
  console.log('[SEED] Upserted demo DoctorsProfile for:', demoEmail);


  // also seed another doctor to populate dropdown
  await Doctor.deleteOne({ email: 'alice@doctor.com' });
  await new Doctor({
    firstName: { en: 'Alice', ru: 'Алиса' },
    middleName: { en: 'B.', ru: '' },
    lastName: { en: 'Smith', ru: 'Смит' },
    dateOfBirth: new Date('1985-05-15'),
    gender: 'Female',
    age: 41,
    email: 'alice@doctor.com',
    phoneNumber: '1112223333',
    currency: 'USD',
    services: { online: true, offline: true },
    status: 'active',
    position: { en: 'Cardiologist', ru: 'Кардиолог' },
    location: { en: 'City Heart Center', ru: 'Городской кардиологический центр' },
    feesAmount: 5000,
    education: { en: 'Cardiology Institute, 2010', ru: '' },
  }).save();

  // --- attach a profile image via GridFS ---
  try {
    let buffer;
    let uploadFilename = 'demo-profile.jpg';
    let contentType = 'image/jpeg';

    // Primary: use the specified local image
    const localImagePath = '"C:\\Users\\Lenovo\\Downloads\\media.png"';

    if (fs.existsSync(localImagePath)) {
      buffer = fs.readFileSync(localImagePath);
      uploadFilename = path.basename(localImagePath);
      contentType = 'image/jpeg';
      console.log('[SEED] Using local image:', localImagePath);
    } else {
      // Fallback: frontend default-user.png
      const frontendImagePath = path.resolve(
        __dirname,
        '..',
        '..',
        'frontend',
        'src',
        'assets',
        'default-user.png',
      );
      if (fs.existsSync(frontendImagePath)) {
        buffer = fs.readFileSync(frontendImagePath);
        uploadFilename = 'demo-profile.png';
        contentType = 'image/png';
        console.log('[SEED] Local image not found, using frontend default-user.png');
      } else {
        const dummyBase64 =
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgBekuXUAAAAASUVORK5CYII=';
        buffer = Buffer.from(dummyBase64, 'base64');
        uploadFilename = 'demo-profile.png';
        contentType = 'image/png';
        console.log('[SEED] Using tiny placeholder image');
      }
    }

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'profileImages',
    });
    const uploadStream = bucket.openUploadStream(uploadFilename, {
      contentType,
    });
    uploadStream.end(buffer);
    await new Promise((resolve, reject) => {
      uploadStream.on('finish', resolve);
      uploadStream.on('error', reject);
    });

    const fileId = uploadStream.id;
    profile.profileFileId = fileId;
    profile.imageUrl = `/api/doctors/image-by-id/${fileId}`;
    await profile.save();
    console.log('[SEED] Uploaded profile image with id', fileId);
  } catch (imgErr) {
    console.error('[SEED] Failed to upload profile image', imgErr);
  }

  // --- Sample Application with historyForm ---
  const Application = require('../../models/Application');
  const sampleAppId = 'SEED-A1001';
  let app = await Application.findOne({ applicationId: sampleAppId });
  if (!app) {
    app = new Application({
      applicationId: sampleAppId,
      patientEmail: 'demo@patient.com',
      serviceType: 'Physical consultation',
      appointmentStatus: 'Confirmed',
      date: new Date().toISOString().slice(0, 10),
      startTime: new Date().toISOString(),
      endTime: new Date(new Date().getTime() + 3600000).toISOString(),
      historyForm: {
        complaints: { value: 'Patient reports mild headache for 3 days.' },
        anamnesisMorbi: { value: 'No history of chronic illness.' },
        anamnesisVitae: { value: 'Non-smoker, moderate alcohol use.' },
        physicalExam: { value: 'Normal vitals.' },
        respiratory: { value: 'Clear lungs.' },
        circulatory: { value: 'Regular rhythm.' },
        digestive: { value: 'No complaints.' },
        urinary: { value: 'Normal.' },
        endocrine: { value: 'No abnormalities.' },
        preliminaryDiagnosis: { value: 'Tension headache.' },
        examinationPlan: { value: 'MRI if persists.' },
        examinationResults: { value: '' },
        clinicalDiagnosis: { value: '' },
        treatmentPlan: { value: 'Prescribe analgesics.' },
      },
    });
    await app.save();
    console.log('[SEED] Created sample Application with historyForm:', sampleAppId);
  } else {
    console.log('[SEED] Sample application already exists:', sampleAppId);
  }

  // --- Sample Bookings for demo doctor ---
  const EarlyDetectionBooking = require('../../models/EarlyDetectionBooking');
  let bookingsData = [];

  // Ensure patient exists for bookings
  let seedPatient = await Patient.findOne({ email: 'booking1@patient.com' });
  if (!seedPatient) {
    seedPatient = new Patient({
      email: 'booking1@patient.com',
      firstName: 'Booking',
      middleName: 'Seed',
      lastName: 'Patient',
      gender: 'Other',
      dateOfBirth: new Date('1980-01-01'),
      phoneNumber: '0000000000',
    });
    await seedPatient.save();
    console.log('[SEED] Created sample Patient for booking:', seedPatient.email);
  }

  // Get doctor ID for schedule link
  const seedDoctor = await Doctor.findOne({ email: demoEmail });
  
  // DEBUG: Log seedDoctor info
  console.log('[SEED-DEBUG] seedDoctor found:', {
    exists: !!seedDoctor,
    email: seedDoctor?.email,
    id: seedDoctor?._id,
    idType: typeof seedDoctor?._id,
  });

  // after we create the EarlyDetection document below we will mirror its appointments


  // --- also seed an EarlyDetection application so table can show something ---
  const EarlyDetection = require('../../models/EarlyDetection');
  const edAppId = 'ED-SEED-001';
  // Always delete and recreate to keep  seed data fresh
  await EarlyDetection.deleteOne({ applicationId: edAppId });
  const ed = new EarlyDetection({  
    applicationId: edAppId,
    patientEmail: 'booking1@patient.com',
    serviceType: 'Consultation',
    appointments: [
  {
    doctorEmail: demoEmail,
    appointmentStatus: 'Confirmed',
    date: new Date().toISOString().slice(0, 10),
    startTime: new Date(new Date().setHours(10, 30, 0, 0)).toISOString(), // Today at 10:30 AM
    endTime: new Date(new Date().setHours(11, 15, 0, 0)).toISOString(),   // Today at 11:15 AM
  },
  {
    doctorEmail: demoEmail,
    appointmentStatus: 'Upcoming',
    date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
    startTime: new Date(new Date(Date.now() + 2 * 86400000).setHours(14, 0, 0, 0)).toISOString(), // Day after tomorrow at 2:00 PM
    endTime: new Date(new Date(Date.now() + 2 * 86400000).setHours(15, 0, 0, 0)).toISOString(),   // Day after tomorrow at 3:00 PM
  },
],
  });
  await ed.save();
  console.log('[SEED] Upserted EarlyDetection application', edAppId);

  // build bookings array from appointments to keep both views identical
  // /!\n  // For the “specialist ownership lock” scenario, we create one demo-owned Ultrasound slot and one non-demo slot.
  const aliceDoctor = await Doctor.findOne({ email: 'alice@doctor.com' });

  bookingsData = ed.appointments.map((appt, idx) => {
    const bookingStatus = appt.appointmentStatus === 'Confirmed' ? 'confirmed' : 'pending';
    return {
      patient: seedPatient._id,
      schedule: {
        specialistConsultations: [
          {
            title: 'Ultrasound',
            date: new Date(appt.date),
            startTime: appt.startTime ? appt.startTime.slice(11, 16) : '09:00',
            endTime: appt.endTime ? appt.endTime.slice(11, 16) : '10:00',
            doctor: seedDoctor ? seedDoctor._id : null, // demo owns this slot - EDITABLE
            historyForm: {
              complaints: { value: 'Demo ultrasound complaint text.' },
              physicalExam: { value: 'Ultrasound exam notes.' },
              treatmentPlan: { value: 'Wait and watch.' },
            },
          },
          {
            title: 'Gynecologist',
            date: new Date(appt.date),
            startTime: appt.startTime ? appt.startTime.slice(11, 16) : '10:00',
            endTime: appt.endTime ? appt.endTime.slice(11, 16) : '11:00',
            doctor: aliceDoctor ? aliceDoctor._id : null, // other specialist, locked for demo
            historyForm: {
              complaints: { value: 'Gynecological check notes (read-only for demo).' },
            },
          },
          {
            title: 'Therapist',
            date: new Date(appt.date),
            startTime: appt.startTime ? appt.startTime.slice(11, 16) : '11:00',
            endTime: appt.endTime ? appt.endTime.slice(11, 16) : '12:00',
            doctor: aliceDoctor ? aliceDoctor._id : null, // assigned to Alice, read-only for demo
            historyForm: {
              complaints: { value: 'Therapy session notes (read-only for demo).' },
            },
          },
          {
            title: 'Dermatologist',
            date: new Date(appt.date),
            startTime: appt.startTime ? appt.startTime.slice(11, 16) : '12:00',
            endTime: appt.endTime ? appt.endTime.slice(11, 16) : '13:00',
            doctor: null, // unassigned
            historyForm: {
              complaints: { value: 'Dermatology examination (unassigned).' },
            },
          },
          {
            title: 'Ophthalmologist',
            date: new Date(appt.date),
            startTime: appt.startTime ? appt.startTime.slice(11, 16) : '13:00',
            endTime: appt.endTime ? appt.endTime.slice(11, 16) : '14:00',
            doctor: aliceDoctor ? aliceDoctor._id : null, // assigned to Alice, read-only for demo
            historyForm: {
              complaints: { value: 'Eye examination notes (read-only for demo).' },
            },
          },
          {
            title: 'Surgeon',
            date: new Date(appt.date),
            startTime: appt.startTime ? appt.startTime.slice(11, 16) : '14:00',
            endTime: appt.endTime ? appt.endTime.slice(11, 16) : '15:00',
            doctor: aliceDoctor ? aliceDoctor._id : null, // assigned to Alice, read-only for demo
            historyForm: {
              complaints: { value: 'Surgical consultation (read-only for demo).' },
            },
          },
          {
            title: 'ENT',
            date: new Date(appt.date),
            startTime: appt.startTime ? appt.startTime.slice(11, 16) : '15:00',
            endTime: appt.endTime ? appt.endTime.slice(11, 16) : '16:00',
            doctor: null, // unassigned
            historyForm: {
              complaints: { value: 'ENT examination (unassigned).' },
            },
          },
        ],
      },
      consents: { dataProcessing: true, marketing: false },
      package: { id: 'predict', name: '«ПРЕДИКТ»', price: 99500, currency: 'RUB' },
      totalAmount: 99500,
      status: bookingStatus,
    };
  });

  const createdBookings = [];
  for (const b of bookingsData) {
    await EarlyDetectionBooking.deleteOne({ patient: b.patient, 'schedule.specialistConsultations.date': b.schedule.specialistConsultations[0].date });
    
    // DEBUG: Log booking before save
    console.log('[SEED-DEBUG] Booking data before save:', {
      specialistConsultations: b.schedule.specialistConsultations.map((s, i) => ({
        index: i,
        title: s.title,
        doctor: s.doctor,
        doctorType: typeof s.doctor,
      })),
    });
    
    const created = await new EarlyDetectionBooking(b).save();
    createdBookings.push(created);
    console.log('[SEED] Upserted booking', created.bookingNumber, 'status', created.status);
    
    // DEBUG: Log booking after save
    console.log('[SEED-DEBUG] Booking data after save:', {
      specialistConsultations: created.schedule.specialistConsultations.map((s, i) => ({
        index: i,
        title: s.title,
        doctor: s.doctor,
        doctorType: typeof s.doctor,
      })),
    });
  }

  // Log the correct URLs to access
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║              ⚠️  CORRECT BOOKING URLs TO ACCESS  ⚠️                ║');
  console.log('╠════════════════════════════════════════════════════════════════════╣');
  createdBookings.forEach((booking, idx) => {
    console.log(`║ Booking ${idx + 1}: ${booking.bookingNumber} (${booking.status})                         ║`);
    console.log(`║ URL: http://localhost:5173/early-detection/${booking.bookingNumber}         ║`);
    console.log(`║ MongoDB _id: ${booking._id.toString()}                       ║`);
  });
  console.log('╠════════════════════════════════════════════════════════════════════╣');
  console.log('║ NOTE: DO NOT use ED-SEED-001 - that is an Application, not a      ║');
  console.log('║ Booking! Use the booking numbers above (ED260403013, etc.)        ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log('\n\n');

  // --- seed assistants related to demo doctor ---
  const Assistant = require('../../models/Assistant');
  // clear existing access entries for demo doctor so we start fresh
  await Assistant.deleteMany({ 'doctors.doctorEmail': demoEmail });

  const now = new Date();
  const later = new Date(now.getTime() + 2 * 3600 * 1000); // 2 hours later

  const sampleAssistants = [
    {
      firstName: 'Ana',
      middleName: 'M.',
      lastName: 'Brown',
      email: 'ana.brown@example.com',
      phoneNumber: '5551234567',
      gender: 'Female',
      dateOfBirth: new Date('1992-07-12'),
      specialty: 'Administration',
      doctors: [
        {
          doctorEmail: demoEmail,
          startDateTime: now,
          endDateTime: later,
          status: 'Access Granted',
        }
      ],
    },
    {
      firstName: 'Mark',
      middleName: '',
      lastName: 'Lee',
      email: 'mark.lee@example.com',
      phoneNumber: '5559876543',
      gender: 'Male',
      dateOfBirth: new Date('1988-03-05'),
      specialty: 'Scheduling',
      doctors: [
        {
          doctorEmail: demoEmail,
          startDateTime: new Date(now.getTime() - 86400000), // yesterday
          endDateTime: new Date(now.getTime() + 86400000), // tomorrow
          status: 'Request Sent',
        }
      ],
    },
  ];

  for (const a of sampleAssistants) {
    await Assistant.deleteOne({ email: a.email });
    await new Assistant(a).save();
    console.log('[SEED] Created assistant', a.email);
  }

  // Print comprehensive testing guide
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║                  📋 SEED SETUP COMPLETE - TEST GUIDE               ║');
  console.log('╠════════════════════════════════════════════════════════════════════╣');
  console.log('║                                                                    ║');
  console.log('║  TEST USER CREDENTIALS:                                           ║');
  console.log(`║  ─────────────────────────────────────────────────────────────────  ║`);
  console.log(`║  Email: ${demoEmail}                                  ║`);
  console.log(`║  Password: demoPassword123                                        ║`);
  console.log(`║  Role: DOCTOR (Ultrasound Specialist)                             ║`);
  console.log('║                                                                    ║');
  console.log('║  SPECIALIST OWNERSHIP SETUP:                                      ║');
  console.log(`║  ─────────────────────────────────────────────────────────────────  ║`);
  console.log(`║  • ${demoEmail} owns ONLY "Ultrasound" tab → EDITABLE✏️ ║`);
  console.log(`║  • alice@doctor.com owns other specialty tabs → 🔒 READ-ONLY      ║`);
  console.log(`║  • Unassigned specialists → 🔒 READ-ONLY                          ║`);
  console.log('║                                                                    ║');
  console.log('║  EXAMPLE BOOKING URLS:                                            ║');
  console.log(`║  ─────────────────────────────────────────────────────────────────  ║`);
  if (createdBookings.length > 0) {
    createdBookings.forEach((b, idx) => {
      console.log(`║  ${idx + 1}. http://localhost:5173/early-detection/${b.bookingNumber}`);
    });
  }
  console.log('║                                                                    ║');
  console.log('║  ⚠️  IMPORTANT:                                                    ║');
  console.log('║  • Use BOOKING URLs above (ED260403013, ED260403014, etc.)       ║');
  console.log('║  • DO NOT use ED-SEED-001 (that is an Application, not Booking)  ║');
  console.log('║  • Login as demo@doctor.com to see specialist ownership locks    ║');
  console.log('║                                                                    ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log('\n\n');

  await mongoose.disconnect();
  console.log('[SEED] Done.');
}

seedDemoDoctor().catch((err) => {
  console.error('[SEED ERROR]', err);
  process.exit(1);
});
