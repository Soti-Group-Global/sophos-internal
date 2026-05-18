const Application = require("../models/Application");
const Media = require("../models/Media");
const moment = require('moment-timezone');
const Patient = require("../models/Patient");
const Doctor = require("../models/Doctor");
const DoctorsProfile = require("../models/DoctorsProfile");
const ServicePosition = require("../models/ServicePosition");
const User = require("../models/User");
const Assistant = require('../models/Assistant');
const HeadAssistant = require('../models/HeadAssistant');
const Counter = require("../models/Counter");
const Order = require("../models/Order");
const multer = require("multer");
const { GridFsStorage } = require("multer-gridfs-storage");
const mongoose = require("mongoose");
const { gfsMedia } = require("../gridfs-media");
const { v4: uuidv4 } = require("uuid");
const { transporter } = require('../utils/emailService');
const { ObjectId } = mongoose.Types;

const https = require("https");
const fs = require("fs");
const path = require("path");
const tls = require("tls");

// Pick a "primary" doctor email from an Application record.
// Supports both Mongoose docs and `.lean()` plain objects.

const ALLOWED_APPOINTMENT_STATUSES = ['Confirmed', 'Completed', 'Upcoming'];

function getPrimaryDoctorEmail(application) {
  if (!application) return null;
  // Preferred: doctors array (current schema)
  const doctors = application.doctors;
  if (Array.isArray(doctors) && doctors.length > 0) {
    const first = doctors.find((d) => d && typeof d.doctorEmail === "string");
    if (first && first.doctorEmail.trim()) return first.doctorEmail.trim();
  }

  // Backward-compat fallbacks (older data shapes)
  if (typeof application.doctorEmail === "string" && application.doctorEmail.trim()) {
    return application.doctorEmail.trim();
  }
  if (
    application.doctor &&
    typeof application.doctor.email === "string" &&
    application.doctor.email.trim()
  ) {
    return application.doctor.email.trim();
  }

  return null;
}

// ── HTML Document Generators ─────────────────────────────────────────────
function invoiceHTML(payment, patient, appId) {
  const fmtM = (n, c = "RUB") => {
    try {
      return new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: c,
        maximumFractionDigits: 2,
      }).format(n || 0);
    } catch {
      return `${n || 0} ${c}`;
    }
  };
  const fmtD = (d) =>
    d
      ? new Date(d).toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
      : "—";
  const name = patient
    ? [patient.lastName, patient.firstName, patient.middleName]
      .filter(Boolean)
      .join(" ")
    : "Не указан";
  const rows = (payment.items || [])
    .map(
      (it, i) =>
        `<tr><td>${i + 1}</td><td>${it.name}</td><td>1</td><td style="text-align:right">${fmtM(it.amount, payment.currency)}</td></tr>`,
    )
    .join("");
  const disc = payment.discount
    ? `<div class="tr"><span>Скидка:</span><span>− ${fmtM(payment.discount, payment.currency)}</span></div>`
    : "";
  const SM = {
    paid: ["Оплачен", "#166534", "#dcfce7"],
    free: ["Бесплатно", "#1e40af", "#dbeafe"],
    pending: ["Ожидает", "#854d0e", "#fef9c3"],
    cancelled: ["Отменён", "#991b1b", "#fee2e2"],
    "invoice-sent": ["Счёт отправлен", "#6d28d9", "#ede9fe"],
    new: ["Новый", "#374151", "#f3f4f6"],
  };
  const [st, sc, sb] = SM[payment.status] || SM.new;
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><title>Счёт ${payment.invoiceNumber || ""}</title><style>*{box-sizing:border-box;margin:0;padding:0}@media print{.np{display:none!important}@page{margin:15mm}}body{font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a;background:#f5f5f5;padding:24px}.pg{background:#fff;max-width:794px;margin:0 auto;padding:40px 48px;border-radius:4px;box-shadow:0 2px 16px rgba(0,0,0,.1)}.hd{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid #0c3870}.logo{font-size:20px;font-weight:800;color:#0c3870}.logo small{display:block;font-size:11px;font-weight:400;color:#888;margin-top:2px}.meta{text-align:right}.dt{font-size:18px;font-weight:700;color:#0c3870}.dn{font-size:13px;color:#555;margin-top:4px}.dd{font-size:12px;color:#888}.prt{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:28px}.pb{background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px}.pr{font-size:10px;font-weight:700;text-transform:uppercase;color:#9ca3af;letter-spacing:.5px;margin-bottom:6px}.pn{font-size:15px;font-weight:600;margin-bottom:4px}.pi{font-size:12px;color:#6b7280;line-height:1.6}table{width:100%;border-collapse:collapse;margin-bottom:20px}thead tr{background:#0c3870}th{color:#fff;padding:10px 12px;text-align:left;font-size:12px;font-weight:600}td{padding:10px 12px;border-bottom:1px solid #f0f0f0}tbody tr:last-child td{border-bottom:none}tbody tr:nth-child(even) td{background:#f9fafb}.tw{display:flex;justify-content:flex-end;margin-bottom:24px}.tb{width:280px;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px}.tr{display:flex;justify-content:space-between;align-items:center;padding:5px 0;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6}.tr:last-child{border:none;padding-top:10px;font-size:15px;font-weight:700;color:#0c3870}.sp{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600}.ft{margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center}.pb-btn{background:#0c3870;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:20px}.pb-btn:hover{background:#0a2d5e}</style></head><body><div class="np" style="max-width:794px;margin:0 auto 12px"><button class="pb-btn" onclick="window.print()">🖨 Распечатать / Сохранить PDF</button></div><div class="pg"><div class="hd"><div class="logo">HealthDirect<small>Медицинский центр</small></div><div class="meta"><div class="dt">СЧЁТ НА ОПЛАТУ</div><div class="dn">№ ${payment.invoiceNumber || "—"}</div><div class="dd">от ${fmtD(payment.createdAt)}</div></div></div><div class="prt"><div class="pb"><div class="pr">Исполнитель</div><div class="pn">HealthDirect Medical</div><div class="pi">Медицинский центр</div></div><div class="pb"><div class="pr">Плательщик</div><div class="pn">${name}</div><div class="pi">${patient?.email || ""}<br>${patient?.phoneNumber || ""}</div></div></div><table><thead><tr><th style="width:40px">#</th><th>Наименование услуги</th><th style="width:70px">Кол-во</th><th style="width:130px;text-align:right">Сумма</th></tr></thead><tbody>${rows}</tbody></table><div class="tw"><div class="tb"><div class="tr"><span>Итого:</span><span>${fmtM(payment.amount, payment.currency)}</span></div>${disc}<div class="tr"><span>К оплате:</span><span>${fmtM(payment.finalAmount, payment.currency)}</span></div></div></div><div>Статус: <span class="sp" style="color:${sc};background:${sb}">${st}</span>${payment.status === "paid" ? ` &nbsp; Дата оплаты: ${fmtD(payment.paidAt)}` : ""}</div><div class="ft">Документ сформирован автоматически · Заявка: ${appId}</div></div></body></html>`;
}

function aktHTML(payment, patient, appId) {
  const fmtM = (n, c = "RUB") => {
    try {
      return new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: c,
        maximumFractionDigits: 2,
      }).format(n || 0);
    } catch {
      return `${n || 0} ${c}`;
    }
  };
  const fmtD = (d) =>
    d
      ? new Date(d).toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
      : "—";
  const name = patient
    ? [patient.lastName, patient.firstName, patient.middleName]
      .filter(Boolean)
      .join(" ")
    : "Не указан";
  const rows = (payment.items || [])
    .map(
      (it, i) =>
        `<tr><td>${i + 1}</td><td>${it.name}</td><td>1</td><td>шт</td><td style="text-align:right">${fmtM(it.amount, payment.currency)}</td><td style="text-align:right">${fmtM(it.amount, payment.currency)}</td></tr>`,
    )
    .join("");
  const disc = payment.discount
    ? `<div class="tr"><span>Скидка:</span><span>− ${fmtM(payment.discount, payment.currency)}</span></div>`
    : "";
  const aktNum = (payment.invoiceNumber || "").replace("INV-", "АКТ-");
  const aktDate = payment.paidAt || payment.createdAt;
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><title>Акт ${aktNum}</title><style>*{box-sizing:border-box;margin:0;padding:0}@media print{.np{display:none!important}@page{margin:15mm}}body{font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a;background:#f5f5f5;padding:24px}.pg{background:#fff;max-width:794px;margin:0 auto;padding:40px 48px;border-radius:4px;box-shadow:0 2px 16px rgba(0,0,0,.1)}h1{font-size:18px;font-weight:700;text-align:center;color:#0c3870;margin-bottom:8px}.am{text-align:center;font-size:13px;color:#555;margin-bottom:28px}.pb{border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:24px;display:grid;grid-template-columns:1fr 1fr;gap:20px}.pr{font-size:10px;font-weight:700;text-transform:uppercase;color:#9ca3af;letter-spacing:.5px;margin-bottom:6px}.pn{font-size:14px;font-weight:600;margin-bottom:3px}.pi{font-size:12px;color:#6b7280;line-height:1.5}table{width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px}th{background:#0c3870;color:#fff;padding:9px 10px;text-align:left;font-size:12px}td{padding:9px 10px;border-bottom:1px solid #f0f0f0}tbody tr:nth-child(even) td{background:#f9fafb}.tw{display:flex;justify-content:flex-end;margin-bottom:28px}.tb{border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;width:260px}.tr{display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6}.tr:last-child{border:none;font-weight:700;font-size:15px;color:#0c3870;padding-top:10px}.sg{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb}.sr{font-size:11px;color:#888;margin-bottom:28px}.sl{border-top:1px solid #1a1a1a;padding-top:4px;font-size:11px;color:#888}.ft{margin-top:24px;font-size:11px;color:#9ca3af;text-align:center}.pb-btn{background:#0c3870;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:20px}.pb-btn:hover{background:#0a2d5e}</style></head><body><div class="np" style="max-width:794px;margin:0 auto 12px"><button class="pb-btn" onclick="window.print()">🖨 Распечатать / Сохранить PDF</button></div><div class="pg"><h1>АКТ ОБ ОКАЗАНИИ УСЛУГ</h1><div class="am">№ ${aktNum} &nbsp;·&nbsp; от ${fmtD(aktDate)}<br>к счёту № ${payment.invoiceNumber || "—"}</div><div class="pb"><div><div class="pr">Исполнитель</div><div class="pn">HealthDirect Medical</div><div class="pi">Медицинский центр</div></div><div><div class="pr">Заказчик</div><div class="pn">${name}</div><div class="pi">${patient?.email || ""}<br>${patient?.phoneNumber || ""}</div></div></div><p style="margin-bottom:12px">Исполнитель оказал, а Заказчик принял следующие услуги:</p><table><thead><tr><th style="width:40px">#</th><th>Наименование услуги</th><th style="width:60px">Кол-во</th><th style="width:50px">Ед.</th><th style="width:120px;text-align:right">Цена</th><th style="width:130px;text-align:right">Сумма</th></tr></thead><tbody>${rows}</tbody></table><div class="tw"><div class="tb"><div class="tr"><span>Итого:</span><span>${fmtM(payment.amount, payment.currency)}</span></div>${disc}<div class="tr"><span>Итого к оплате:</span><span>${fmtM(payment.finalAmount, payment.currency)}</span></div></div></div><p style="margin-bottom:32px">Услуги выполнены в полном объёме. Стороны претензий друг к другу не имеют.</p><div class="sg"><div><div class="sr">Исполнитель: HealthDirect Medical</div><div class="sl">Подпись / ФИО</div></div><div><div class="sr">Заказчик: ${name}</div><div class="sl">Подпись / ФИО</div></div></div><div class="ft">Документ сформирован автоматически · Заявка: ${appId}</div></div></body></html>`;
}
// ─────────────────────────────────────────────────────────────────────────

// Valid enums for appointmentStatus and paymentStatus
// ── historyForm legacy-string migration helper ───────────────────────────
const HISTORY_KEYS = [
  "complaints",
  "anamnesisMorbi",
  "anamnesisVitae",
  "physicalExam",
  "respiratory",
  "circulatory",
  "digestive",
  "urinary",
  "endocrine",
  "preliminaryDiagnosis",
  "examinationPlan",
  "examinationResults",
  "clinicalDiagnosis",
  "treatmentPlan",
];
async function migrateHistoryFormLegacy(applicationId) {
  const raw = await Application.collection.findOne({ applicationId });
  if (!raw) return;
  const needsMigration = HISTORY_KEYS.some(
    (k) => typeof raw.historyForm?.[k] === "string",
  );
  if (!needsMigration) return;
  const $set = {};
  for (const k of HISTORY_KEYS) {
    const f = raw.historyForm?.[k];
    if (typeof f === "string") {
      $set[`historyForm.${k}`] = {
        value: f,
        isVerified: false,
        verifiedBy: null,
        verifiedAt: null,
      };
    }
  }
  await Application.collection.updateOne({ applicationId }, { $set });
}
// ─────────────────────────────────────────────────────────────────────────

const validAppointmentStatuses = [
  "Paid",
  "Cancelled",
  "Unconfirmed",
  "Confirmed",
  "Pending payment",
  "Completed",
];

const validPaymentStatuses = [
  "new",
  "invoice-sent",
  "paid",
  "cancelled",
  "pending",
];

// Configure Nodemailer transporter

// Helper: populate documents with GridFS file info
async function populateDocuments(documents) {
  return Promise.all(
    (documents || []).map(async (doc) => {
      if (doc.fileId) {
        const gfs = gfsMedia();
        const file = await gfs
          .find({ _id: new mongoose.Types.ObjectId(doc.fileId) })
          .toArray();
        if (file.length > 0) {
          return {
            ...doc,
            fileId: {
              _id: file[0]._id,
              filename: file[0].filename,
              contentType: file[0].contentType,
              size: file[0].length,
            },
          };
        }
      }
      return doc;
    }),
  );
}

// Helper: build a fully populated application object
async function buildPopulatedApplication(application) {
  const populatedApplication = application.toObject
    ? application.toObject()
    : { ...application };
  populatedApplication.applicationId =
    application.applicationId || application._id;
  populatedApplication.patient = await Patient.findOne({
    email: application.patientId,
  })
    .select("firstName middleName lastName email phoneNumber _id")
    .lean();
  populatedApplication.doctor = await DoctorsProfile.findOne({
    email: application.doctorEmail,
  })
    .select("firstName middleName lastName specialty email phoneNumber _id")
    .lean();
  populatedApplication.documents = await populateDocuments(
    application.documents,
  );
  // Populate services array (service tab selections)
  try {
    const appWithServices = await Application.findById(application._id || application.id)
      .populate({ path: "services.servicePosition", strictPopulate: false })
      .lean();
    const populated = (appWithServices?.services || []).map((s) => ({
      ...(s.servicePosition || {}),
      _id: s.servicePosition?._id ?? s.servicePosition,
      price: s.price ?? s.servicePosition?.price,
    }));
    populatedApplication.addedServicePositions = populated;
    populatedApplication.services = appWithServices?.services || [];
  } catch (err) {
    populatedApplication.addedServicePositions = [];
  }
  return populatedApplication;
}

// --- File Upload ---
async function uploadDocumentFile(req, res) {
  try {
    const id = decodeURIComponent(req.params.id);
    if (!req.file) {
      return res.status(400).json({ message: "No file received" });
    }
    await migrateHistoryFormLegacy(id);

    const application = await Application.findOne({ applicationId: id });
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    const gfs = gfsMedia();
    const writeStream = gfs.openUploadStream(req.file.originalname, {
      contentType: req.file.mimetype,
    });
    writeStream.end(req.file.buffer);

    const fileId = await new Promise((resolve, reject) => {
      writeStream.on("finish", () => resolve(writeStream.id));
      writeStream.on("error", reject);
    });

    application.documents.push({
      filename: req.file.originalname,
      fileId,
      verificationStatus: "Verified",
      uploadedAt: new Date(),
    });

    await application.save();
    res
      .status(201)
      .json({ message: "File uploaded", documents: application.documents });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

// --- URL Upload ---
async function uploadDocumentUrl(req, res) {
  try {
    const id = decodeURIComponent(req.params.id);

    await migrateHistoryFormLegacy(id);

    if (!req.body?.url) {
      return res.status(400).json({ message: "URL is required" });
    }

    const application = await Application.findOne({ applicationId: id });
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    const filename = req.body.filename || "Cloud Link";

    application.documents.push({
      filename,
      fileId: null,
      url: req.body.url.trim(),
      verificationStatus: "Under Review", // or Verified (your choice)
      uploadedAt: new Date(),
    });

    await application.save();

    res.status(201).json({
      message: "URL uploaded successfully",
      applicationId: application.applicationId,
      documents: application.documents,
    });

  } catch (error) {
    console.error("URL Upload Error:", error);
    res.status(400).json({ message: error.message });
  }
}

// upload appointment documents
async function uploadAppointmentDocument(req, res) {
  try {
    const appId = req.params.id;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'media',
    });
    const uploadStream = bucket.openUploadStream(file.originalname, {
      contentType: file.mimetype,
    });
    const fileId = uploadStream.id;
    uploadStream.end(file.buffer);
    uploadStream.on('finish', async () => {
      const documentEntry = {
        filename: file.originalname,
        fileId,
        uploadedAt: new Date(),
        verificationStatus: 'Under Review',
      };
      const updatedApp = await Application.findByIdAndUpdate(
        appId,
        { $push: { documents: documentEntry } },
        { new: true }
      );
      res.json(updatedApp);
    });
    uploadStream.on('error', (err) => {
      console.error('GridFS upload error:', err);
      res.status(500).json({ message: 'Upload failed' });
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Server error' });
  }
}
// Get user ID by email and role
async function getUserIdByEmail(req, res) {
  try {
    const { email } = req.params;
    const user = await User.findOne({ email, role: "patient" })
      .select("_id")
      .lean();
    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found or not a patient" });
    }
    res.status(200).json({ userId: user._id });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch user ID" });
  }
}


//Get medical history by application ID (for medical history details view)
async function getMedicalHistory(req, res) {
  const patientId = req.params.patientId;

  try {
    const applications = await Application.find({
      patientId: patientId,
      appointmentStatus: { $nin: ['Unconfirmed', 'Cancelled'] }
    }).sort({ date: -1 });

    if (!applications.length) {
      return res.status(404).json({
        success: false,
        message: 'No medical history found for this patient.',
        patientId
      });
    }
    const doctorEmails = [
      ...new Set(applications.flatMap((app) => (app.doctors || []).map((d) => d.doctorEmail)).filter(Boolean)),
    ];
    const doctors = await DoctorProfile.find(
      { email: { $in: doctorEmails } },
      'email firstName middleName lastName'
    ).lean();
    const doctorMap = Object.fromEntries(doctors.map((doc) => [doc.email, doc]));
    const enrichedApplications = applications.map((app) => {
      const enrichedDoctors = (app.doctors || []).map((d) => {
        const profile = doctorMap[d.doctorEmail];
        return {
          ...d,
          doctorName: profile
            ? {
              en: [profile.firstName?.en, profile.middleName?.en, profile.lastName?.en].filter(Boolean).join(' '),
              ru: [profile.firstName?.ru, profile.middleName?.ru, profile.lastName?.ru].filter(Boolean).join(' '),
            }
            : d.doctorName || null,
        };
      });
      return { ...app, doctors: enrichedDoctors };
    });

    res.json({ success: true, data: enrichedApplications });


  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
}
// Get applications by patient ID
async function getApplicationsByPatientId(req, res) {
  try {
    const { patientId } = req.params;
    const applications = await Application.find({ patientId })
      .sort({ date: -1 })
      .lean();

    for (let app of applications) {
      app.applicationId = app.applicationId || app._id;
      app.patient = await Patient.findOne({ patientId: app.patientId })
        .select("firstName middleName lastName email phoneNumber")
        .lean();
      app.doctor = await DoctorsProfile.findOne({ email: app.doctorEmail })
        .select("firstName middleName lastName specialty email phoneNumber")
        .lean();
      app.documents = Array.isArray(app.documents) ? app.documents : [];
      app.documents = await populateDocuments(app.documents);
    }

    res.status(200).json(applications);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch applications" });
  }
}

// Get application counts per day for a given month (mini-calendar badges)
async function getApplicationCountsByMonth(req, res) {
  try {
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ message: "year and month are required." });
    }

    const monthPadded = String(month).padStart(2, "0");
    const prefix = `${year}-${monthPadded}-`;

    const applications = await Application.find(
      { date: { $regex: `^${prefix}` } },
      { date: 1, _id: 0 }   // only fetch date field — lightweight
    ).lean();

    // Build { "YYYY-MM-DD": count } map
    const counts = {};
    for (const app of applications) {
      if (app.date) {
        counts[app.date] = (counts[app.date] || 0) + 1;
      }
    }

    res.status(200).json(counts);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch monthly counts" });
  }
}

// Get applications by date for calendar view
async function getApplicationsByDate(req, res) {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ message: "date is required." });
    }

    // Date is stored as string in format YYYY-MM-DD, so we do exact match
    const applications = await Application.find({
      date: date, // Direct string comparison
    })
      .sort({ startTime: 1 })
      .lean();

    // Populate patient and doctor information
    for (let app of applications) {
      app.applicationId = app.applicationId || app._id;

      // Resolve doctor email from top-level or from the doctors array
      const docEmail =
        app.doctorEmail || (app.doctors && app.doctors[0]?.doctorEmail);

      app.patient = await Patient.findOne({ patientId: app.patientId })
        .select("firstName middleName lastName email phoneNumber _id")
        .lean();

      // Return full multilingual name objects (en and ru)
      if (docEmail) {
        app.doctor = await DoctorsProfile.findOne({ email: docEmail })
          .select(
            "firstName middleName lastName specialtyIds email phoneNumber _id",
          )
          .populate("specialtyIds", "name_en name_ru")
          .lean();
      }
    }

    res.status(200).json(applications);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
}

// Get a single application by ID
async function getApplicationById(req, res) {
  try {
    const id = decodeURIComponent(req.params.id);
    await migrateHistoryFormLegacy(id);
    const applicationDoc = await Application.findOne({ applicationId: id });
    if (!applicationDoc) {
      return res.status(404).json({ message: "Application not found" });
    }

    const application = applicationDoc.toObject();
    application.applicationId = application.applicationId || application._id;

    const _patientQuery = application.patientId
      ? { patientId: application.patientId }
      : application.patientEmail
        ? { email: application.patientEmail }
        : null;
    application.patient = _patientQuery
      ? await Patient.findOne(_patientQuery)
          .select("firstName middleName lastName email phoneNumber _id patientId dateOfBirth gender")
          .lean()
      : null;

    application.doctor = await DoctorsProfile.findOne({
      email: application.doctorEmail,
    })
      .select("firstName middleName lastName specialty email phoneNumber _id")
      .lean();
    application.documents = Array.isArray(application.documents)
      ? application.documents
      : [];
    application.documents = await populateDocuments(application.documents);

    res.json(application);
  } catch (error) {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid application ID" });
    }
    res.status(500).json({ message: "Server error" });
  }
}

// Update an application by ID
async function updateApplication(req, res) {
  try {
    const id = decodeURIComponent(req.params.id);
    await migrateHistoryFormLegacy(id);
    const application = await Application.findOne({ applicationId: id });
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    if (
      req.body.doctorEmail &&
      req.body.doctorEmail !== application.doctorEmail
    ) {
      const doctor = await User.findOne({
        email: req.body.doctorEmail,
        role: "doctor",
      });
      if (!doctor) {
        return res.status(404).json({ message: "Doctor not found" });
      }
      application.doctorEmail = req.body.doctorEmail;
    }

    if (
      req.body.patientId &&
      req.body.patientId !== application.patientId
    ) {
      const patient = await User.findOne({
        patientId: req.body.patientId,
        role: "patient",
      });
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      application.patientId = req.body.patientId;
    }

    if (
      req.body.appointmentStatus &&
      !validAppointmentStatuses.includes(req.body.appointmentStatus)
    ) {
      return res.status(400).json({
        message: `Invalid appointmentStatus. Must be one of: ${validAppointmentStatuses.join(
          ", ",
        )}`,
      });
    }

    if (req.body.payments && Array.isArray(req.body.payments)) {
      for (const payment of req.body.payments) {
        if (payment.status && !validPaymentStatuses.includes(payment.status)) {
          return res.status(400).json({
            message: `Invalid payment status. Must be one of: ${validPaymentStatuses.join(
              ", ",
            )}`,
          });
        }
        if (payment.paymentMethod && payment.paymentMethod !== "yookassa") {
          return res
            .status(400)
            .json({ message: "Invalid payment method. Must be yookassa" });
        }
      }
    }

    if (req.body.serviceOrders && req.body.serviceOrders.length > 0) {
      for (const serviceOrder of req.body.serviceOrders) {
        if (serviceOrder.userId) {
          const user = await User.findById(serviceOrder.userId);
          if (
            !user ||
            user.role !== "patient" ||
            (req.body.patientId && user.patientId !== req.body.patientId)
          ) {
            return res
              .status(400)
              .json({ message: "Invalid userId in serviceOrders" });
          }
        }
      }
    }

    application.serviceType = req.body.serviceType || application.serviceType;
    application.specialty = req.body.specialty || application.specialty;
    application.appointmentMode =
      req.body.appointmentMode || application.appointmentMode;
    application.appointmentStatus =
      req.body.appointmentStatus || application.appointmentStatus;
    application.meetingLink =
      req.body.meetingLink !== undefined
        ? req.body.meetingLink
        : application.meetingLink;
    application.date = req.body.date || application.date;
    application.startTime = req.body.startTime || application.startTime;
    application.endTime = req.body.endTime || application.endTime;
    application.payments = req.body.payments || application.payments;
    application.serviceOrders =
      req.body.serviceOrders || application.serviceOrders;
    application.conclusion = req.body.conclusion || application.conclusion;
    application.prescription =
      req.body.prescription || application.prescription;
    application.pathologica =
      req.body.pathologica !== undefined
        ? req.body.pathologica
        : application.pathologica;
    application.expertReview =
      req.body.expertReview !== undefined
        ? req.body.expertReview
        : application.expertReview;
    application.documents = Array.isArray(req.body.documents)
      ? req.body.documents
      : application.documents || [];
    if (req.body.comments && Array.isArray(req.body.comments)) {
      application.comments.push(...req.body.comments);
    }
    if (req.body.followUp !== undefined) {
      application.followUp = {
        ...((application.followUp || {}).toObject
          ? application.followUp.toObject()
          : application.followUp || {}),
        ...req.body.followUp,
      };
    }

    // Allow setting addedServicePositions (array of ServicePosition ids)
    if (req.body.addedServicePositions && Array.isArray(req.body.addedServicePositions)) {
      application.addedServicePositions = req.body.addedServicePositions;
    }

    await application.save();

    const populatedApplication = await buildPopulatedApplication(application);

    res.json(populatedApplication);
  } catch (error) {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid application ID" });
    }
    res.status(500).json({ message: "Server error" });
  }
}


// Get all applications
async function getAllApplications(req, res) {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      appointmentStatus,
      paymentStatus,
      doctorEmail,
      date,
      start,
      end,
      branch,
      dateFrom,
      dateTo,
    } = req.query;

    let query = {};

    if (
      appointmentStatus &&
      !validAppointmentStatuses.includes(appointmentStatus)
    ) {
      return res.status(400).json({
        message: `Invalid appointmentStatus. Must be one of: ${validAppointmentStatuses.join(
          ", ",
        )}`,
      });
    }

    if (paymentStatus && !validPaymentStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        message: `Invalid paymentStatus. Must be one of: ${validPaymentStatuses.join(
          ", ",
        )}`,
      });
    }

    if (search) {
      const patientQuery = {
        $or: [
          { patientId: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { phoneNumber: { $regex: search, $options: "i" } },
          {
            $or: [
              { firstName: { $regex: search, $options: "i" } },
              { middleName: { $regex: search, $options: "i" } },
              { lastName: { $regex: search, $options: "i" } },
              {
                $expr: {
                  $regexMatch: {
                    input: {
                      $concat: [
                        "$firstName",
                        " ",
                        "$middleName",
                        " ",
                        "$lastName",
                      ],
                    },
                    regex: search,
                    options: "i",
                  },
                },
              },
            ],
          },
        ],
      };

      const matchingPatients = await Patient.find(patientQuery).select("patientId");
      const patientIds = matchingPatients.map((p) => p.patientId);

      query.$or = [
        { applicationId: { $regex: search, $options: "i" } },
        { patientId: { $in: patientIds } },
        { patientId: { $regex: search, $options: "i" } },
        { doctorEmail: { $regex: search, $options: "i" } },
      ];
    }

    if (appointmentStatus) query.appointmentStatus = appointmentStatus;
    if (paymentStatus) query["payments.status"] = paymentStatus;
    if (doctorEmail) query.doctorEmail = doctorEmail;

    if (dateFrom || dateTo) {
      query.date = {};
      if (dateFrom) query.date.$gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        query.date.$lte = to;
      }
    }

    if (start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);
      query.$and = [
        { startTime: { $lt: endDate } },
        { endTime: { $gt: startDate } },
      ];
    } else if (date) {
      query.date = date;
    }

    if (branch && branch !== "All") {
      const branchCondition = {
        $or: [
          { appointmentMode: "Online" },
          {
            $and: [
              { appointmentMode: "Offline" },
              {
                branch: {
                  $exists: true,
                  $regex: `^${branch}$`,
                  $options: "i",
                },
              },
            ],
          },
        ],
      };
      query.$and = [...(query.$and || []), branchCondition];
    }

    const applications = await Application.find(query)
      .sort({ startTime: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    const total = await Application.countDocuments(query);

    for (let app of applications) {
      app.applicationId = app.applicationId || app._id;
      app.patient = await Patient.findOne({ patientId: app.patientId })
        .select(
          "firstName middleName lastName email phoneNumber _id dateOfBirth phoneNumber",
        )
        .lean();
      const docEmail = app.doctorEmail || app.doctors?.[0]?.doctorEmail;
      app.doctor = docEmail
        ? await DoctorsProfile.findOne({ email: docEmail })
          .select(
            "firstName middleName lastName specialty email phoneNumber _id",
          )
          .lean()
        : null;
    }

    res.json({
      applications,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
}

// Get all applications for a patient by Id (for medical history)
async function getMedicalHistoryByPatientId(req, res) {
  try {
    const { patientId } = req.params;

    const applications = await Application.find({ patientId: patientId, appointmentStatus: { $nin: ['Unconfirmed', 'Cancelled'] } })
      .sort({ createdAt: -1 })
      .lean();

    for (let app of applications) {
      app.applicationId = app.applicationId || app._id;
      try {
        app.patient = await Patient.findOne({ patientId: app.patientId })
          .select("firstName middleName lastName email phoneNumber")
          .lean();
      } catch {
        app.patient = null;
      }

      try {
        const docEmail = app.doctorEmail || app.doctors?.[0]?.doctorEmail;
        if (docEmail) {
          const docProfile = await DoctorsProfile.findOne({ email: docEmail })
            .select("firstName middleName lastName specialty email")
            .lean();
          if (docProfile) {
            app.doctor = {
              firstName:
                docProfile.firstName?.en ||
                docProfile.firstName?.ru ||
                (typeof docProfile.firstName === "string"
                  ? docProfile.firstName
                  : ""),
              middleName:
                docProfile.middleName?.en ||
                docProfile.middleName?.ru ||
                (typeof docProfile.middleName === "string"
                  ? docProfile.middleName
                  : ""),
              lastName:
                docProfile.lastName?.en ||
                docProfile.lastName?.ru ||
                (typeof docProfile.lastName === "string"
                  ? docProfile.lastName
                  : ""),
              specialty: docProfile.specialty,
              email: docProfile.email,
            };
          } else {
            // Fallback to doctorName stored in the application
            const storedName = app.doctors?.[0]?.doctorName;
            app.doctor = storedName
              ? {
                firstName: storedName,
                middleName: "",
                lastName: "",
                email: docEmail,
              }
              : null;
          }
        } else {
          app.doctor = null;
        }
      } catch {
        app.doctor = null;
      }
    }

    res.status(200).json(applications);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch medical history",    });
  }
}


//-----------------Doctor related Functions------------------------//

//Post Upload document for doctors interface
async function uploadDocumentForDoctors(req, res) {
  try {
    const appId = req.params.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'media' });

    const uploadStream = bucket.openUploadStream(file.originalname, {
      contentType: file.mimetype
    });

    const fileId = uploadStream.id;

    uploadStream.end(file.buffer);

    uploadStream.on('finish', async () => {

      const documentEntry = {
        filename: file.originalname,
        fileId: fileId,
        verificationStatus: "Verified",
        uploadedAt: new Date()
      };

      const updatedApp = await Application.findByIdAndUpdate(
        appId,
        { $push: { documents: documentEntry } },
        { new: true }
      );

      res.json(updatedApp);
    });

    uploadStream.on('error', (err) => {
      console.error('GridFS upload error:', err);
      res.status(500).json({ message: 'Upload failed' });
    });

  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Server error' });
  }
}

//Get Document by ID for doctors interface
async function getDocumentByIdForDoctors(req, res) {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid file ID format' });
    }

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'media'
    });

    const fileId = new ObjectId(req.params.id);
    const files = await bucket.find({ _id: fileId }).toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({ message: 'Document not found' });
    }

    res.set('Content-Type', files[0].contentType);

    const readStream = bucket.openDownloadStream(fileId);

    readStream.on('error', (err) => {
      console.error('Stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error streaming document', error: err.message });
      }
    });

    readStream.pipe(res);

  } catch (err) {
    console.error('Retrieve error:', err);
    res.status(500).json({ message: 'Error retrieving document', error: err.message });
  }
}

// GET medical history by email - Doctors Interface
async function getMedicalHistoryByEmailForDoctors(req, res) {
  const email = req.params.email;

  try {
    const applications = await Application.find({
      patientEmail: email,
      appointmentStatus: { $nin: ['Unconfirmed', 'Cancelled'] }
    }).sort({ date: -1 });

    if (!applications.length) {
      return res.status(404).json({
        success: false,
        message: 'No medical history found for this email.',
        email
      });
    }

    res.json({
      success: true,
      data: applications
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
}

//Get all application - Doctors Interface
async function getAllApplicationsForDoctors(req, res) {
  try {
    const { doctorEmail, start, end } = req.query;

    if (!doctorEmail || !start || !end) {
      return res
        .status(400)
        .json({ error: "doctorEmail, start, and end are required" });
    }
    const applications = await Application.find({
      "doctors.doctorEmail": doctorEmail,
      date: {
        $gte: start.slice(0, 10),
        $lte: end.slice(0, 10),
      },
      appointmentStatus: { $ne: "Unconfirmed" },
    }).sort({ date: 1, startTime: 1 });



    res.json(applications);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
}

//Get Application by id - Doctors Interface
async function getApplicationByIdForDoctors(req, res) {
  const applicationId = req.params.id;
  try {
    const appointment = await Application.findOne({ applicationId });

    if (!appointment) {
      return res.status(404).json({
        error: 'Appointment not found',
        applicationId
      });
    }


    return res.json(appointment);
  } catch (error) {
    return res.status(500).json({
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

//Update a comment- Doctors Interface
async function updateCommentForDoctors(req, res) {
  const { appointmentId, commentId } = req.params;
  const { text, edited, editTimestamp } = req.body;
  try {
    // Find by custom ID
    const appointment = await Application.findOne({ applicationId: appointmentId });
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });

    const comment = appointment.comments.id(commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    // Update fields
    comment.text = text;
    comment.edited = edited;
    comment.editTimestamp = editTimestamp;

    await appointment.save();
    res.json(comment);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

//Add a comment - Doctors Interface
async function addCommentForDoctors(req, res) {
  const appointmentId = decodeURIComponent(req.params.id); // e.g., APP/005/0001
  const { comments } = req.body;
  // Ensure it's a single new comment
  const newComment = Array.isArray(comments) ? comments[comments.length - 1] : comments;
  try {
    const appointment = await Application.findOneAndUpdate(
      { applicationId: appointmentId },
      { $push: { comments: newComment } },
      { new: true }

    );

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    res.json(appointment);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

// Delete a comment - Doctors Interface
async function deleteCommentForDoctors(req, res) {
  const { appointmentId, commentId } = req.params;
  try {
    // Find appointment by custom applicationId
    const appointment = await Application.findOne({ applicationId: appointmentId });
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Find the comment index
    const commentIndex = appointment.comments.findIndex(
      comment => comment._id.toString() === commentId
    );

    if (commentIndex === -1) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Remove the comment from the array
    appointment.comments.splice(commentIndex, 1);

    // Save the updated appointment
    await appointment.save();

    res.json({
      success: true,
      message: 'Comment deleted successfully',
      appointmentId,
      commentId
    });

  } catch (error) {
    res.status(500).json({
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

//Put add description for doctors interface
async function addDescriptionForDoctors(req, res) {
  try {
    const appointment = await Application.findOne({ applicationId: req.params.id });

    if (!appointment) {
      return res.status(404).json({ msg: 'Appointment not found' });
    }

    appointment.prescription = {
      text: req.body.prescription || '',
      verificationStatus: 'Verified'
    };

    await appointment.save();
    res.json(appointment);
  } catch (err) {
    res.status(500).send('Server Error');
  }
}

// PUT add conclusion for doctors interface
async function addConclusionForDoctors(req, res) {
  try {
    const appointment = await Application.findOne({ applicationId: req.params.id });

    if (!appointment) {
      return res.status(404).json({ msg: 'Appointment not found' });
    }

    appointment.conclusion = {
      text: req.body.conclusion || '',
      verificationStatus: 'Verified'
    };

    await appointment.save();
    res.json(appointment);
  } catch (err) {
    res.status(500).send('Server Error');
  }
}

//PUT Update the verification of document , Conclusion or Description
async function updateVerificationStatusForDoctors(req, res) {
  const { id } = req.params;
  const { type, field, status } = req.body;
  try {
    const appointment = await Application.findById(id);
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    if (type === "document") {
      const doc = appointment.documents.find(d => String(d.fileId) === String(field));
      if (doc) {
        doc.verificationStatus = status;
      } else {
        console.warn("Document not found with fileId:", field);
      }
    } else if (["prescription", "conclusion"].includes(type)) {
      if (!appointment[type]) {
        appointment[type] = {};
      }

      appointment[type].verificationStatus = status;
    } else {
      console.warn("Unknown type provided:", type);
    }

    await appointment.save();
    res.json({ message: "Verification status updated", appointment });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
}

//GET appointments by doctor email and date range for doctors interface
async function getAppointmentsByDoctorEmail(req, res) {
  const doctorEmail = req.params.email;
  const { page = 1, limit = 21, status = 'all', search = '' } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  try {
    const normalizedDoctorEmail = doctorEmail.trim();
    const escapedDoctorEmail = normalizedDoctorEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const query = {
      "doctors.doctorEmail": {
        $regex: new RegExp(`^${escapedDoctorEmail}$`, "i"),
      },
    };

    // Handle status filter
    if (status !== 'all') {
      if (status.toLowerCase() === 'cancelled') {
        // Cancelled is normally excluded — override the default $nin
        query.appointmentStatus = 'Cancelled';
      } else if (status.toLowerCase() === 'unconfirmed') {
        // Unconfirmed is normally excluded — override the default $nin
        query.appointmentStatus = 'Unconfirmed';
      } else {
        // Convert other status values
        const statusMap = {
          'completed': 'Completed',
          'confirmed': 'Confirmed',
        };

        query.appointmentStatus = statusMap[status.toLowerCase()] || status;
      }
    }

    // Search: applicationId, serviceType, or patient details
    if (search) {
      // Find patients whose name or email matches the search term
      const matchingPatients = await Patient.find({
        $or: [
          { firstName: new RegExp(search, 'i') },
          { lastName: new RegExp(search, 'i') },
          { email: new RegExp(search, 'i') },
        ]
      }).select('email').lean();
      const matchingEmails = matchingPatients.map(p => p.email);

      query.$or = [
        { applicationId: new RegExp(search, 'i') },
        { serviceType: new RegExp(search, 'i') },
        { patientEmail: new RegExp(search, 'i') },
        ...(matchingEmails.length > 0 ? [{ patientEmail: { $in: matchingEmails } }] : []),
      ];
    }

    const [appointments, totalCount] = await Promise.all([
      Application.find(query)
        .sort({ date: -1 })
        .skip(Number(skip))
        .limit(Number(limit)),
      Application.countDocuments(query)
    ]);

    const patientIds = [...new Set(appointments.map(a => a.patientId))].filter(Boolean);
    const doctorEmails = [
      ...new Set(
        appointments.map((a) => getPrimaryDoctorEmail(a)).filter(Boolean)
      ),
    ];

    const [patientsRaw, doctors] = await Promise.all([
      patientIds.length > 0 ? Patient.find({ patientId: { $in: patientIds } }) : [],
      Doctor.find({ email: { $in: doctorEmails } })
    ]);

    const patientMap = {};
    patientsRaw.forEach(p => {
      patientMap[p.patientId] = {
        firstName: p.firstName,
        middleName: p.middleName,
        lastName: p.lastName,
        gender: p.gender,
        dateOfBirth: p.dateOfBirth
      };
    });

    const doctorMap = {};
    doctors.forEach(d => {
      doctorMap[d.email] = {
        firstName: d.firstName,
        middleName: d.middleName,
        lastName: d.lastName
      };
    });

    const enrichedAppointments = appointments.map(appt => {
      const obj = appt.toObject();
      const primaryDoctorEmail = getPrimaryDoctorEmail(appt);
      obj.patientDetails = (appt.patientId && patientMap[appt.patientId]) || null;
      obj.doctorDetails = doctorMap[primaryDoctorEmail] || null;
      return obj;
    });

    res.json({
      success: true,
      data: {
        appointments: enrichedAppointments,
        totalCount
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointments',    });
  }
}

// GET appointments accessible to an assistant by assistant email

async function getAppointmentsByAssistantEmail(req, res) {
  const assistantEmail = req.params.email;
  const { page = 1, limit = 21, status = 'all', search = '', startDate, endDate } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  try {
    const assistant = await Assistant.findOne({ email: assistantEmail }).lean();
    if (!assistant) {
      return res.status(404).json({ success: false, message: 'Assistant not found' });
    }

    // Collect doctor emails the assistant has access to
    const doctorEmails = (assistant.doctors || []).map(d => d.doctorEmail).filter(Boolean);
    if (doctorEmails.length === 0) {
      return res.json({ success: true, data: { appointments: [], totalCount: 0 } });
    }

    const query = {
      'doctors.doctorEmail': { $in: doctorEmails.map(e => new RegExp(`^${e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, 'i')) }
    };

    // Date range filter (optional)
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }

    // Status filter
    if (status !== 'all') {
      if (status.toLowerCase() === 'cancelled') {
        query.appointmentStatus = 'Cancelled';
      } else if (status.toLowerCase() === 'unconfirmed') {
        query.appointmentStatus = 'Unconfirmed';
      } else {
        const statusMap = { 'completed': 'Completed', 'confirmed': 'Confirmed' };
        query.appointmentStatus = statusMap[status.toLowerCase()] || status;
      }
    }

    // Search across applicationId, serviceType and patient id/name
    if (search) {
      const matchingPatients = await Patient.find({
        $or: [
          { firstName: new RegExp(search, 'i') },
          { lastName: new RegExp(search, 'i') },
          { email: new RegExp(search, 'i') },
        ]
      }).select('patientId').lean();
      const matchingIds = matchingPatients.map(p => p.patientId);

      query.$or = [
        { applicationId: new RegExp(search, 'i') },
        { serviceType: new RegExp(search, 'i') },
        { patientId: new RegExp(search, 'i') },
        ...(matchingIds.length > 0 ? [{ patientId: { $in: matchingIds } }] : []),
      ];
    }

    const [appointments, totalCount] = await Promise.all([
      Application.find(query).sort({ date: -1 }).skip(Number(skip)).limit(Number(limit)),
      Application.countDocuments(query),
    ]);

    // Enrich with patient and doctor details
    const patientIds = [...new Set(appointments.map(a => a.patientId))].filter(Boolean);
    const doctorEmailsPrimary = [...new Set(appointments.map(a => getPrimaryDoctorEmail(a)).filter(Boolean))];

    const [patientsRaw, doctors] = await Promise.all([
      patientIds.length > 0 ? Patient.find({ patientId: { $in: patientIds } }) : [],
      Doctor.find({ email: { $in: doctorEmailsPrimary } }),
    ]);

    const patientMap = {};
    patientsRaw.forEach(p => {
      patientMap[p.patientId] = {
        firstName: p.firstName,
        middleName: p.middleName,
        lastName: p.lastName,
        gender: p.gender,
        dateOfBirth: p.dateOfBirth,
      };
    });

    const doctorMap = {};
    doctors.forEach(d => {
      doctorMap[d.email] = { firstName: d.firstName, middleName: d.middleName, lastName: d.lastName };
    });

    const enrichedAppointments = appointments.map(appt => {
      const obj = appt.toObject();
      const primaryDoctorEmail = getPrimaryDoctorEmail(appt);
      obj.patientDetails = (appt.patientId && patientMap[appt.patientId]) || null;
      obj.doctorDetails = doctorMap[primaryDoctorEmail] || null;
      return obj;
    });

    return res.json({ success: true, data: { appointments: enrichedAppointments, totalCount } });
  } catch (error) {
    console.error('Assistant appointments fetch error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch appointments' });
  }
}

//Upload test result
async function uploadTestResult(req, res) {
  try {
    const { applicationId, testId } = req.body;
    const file = req.file;

    if (!applicationId || !testId || !file) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const decodedId = decodeURIComponent(applicationId);

    // Find the order by testId (since each test is a separate document)
    const order = await Order.findOne({
      applicationId: decodedId,
      testId: testId
    });

    if (!order) {
      return res.status(404).json({ error: "Test order not found" });
    }

    const resultBucket = req.app.locals.resultBucket;
    if (!resultBucket) {
      return res.status(500).json({ message: "Internal server error" });
    }

    const uploadStream = resultBucket.openUploadStream(`${Date.now()}_${file.originalname}`, {
      contentType: file.mimetype
    });

    const fileId = uploadStream.id;
    uploadStream.end(file.buffer);

    uploadStream.on('finish', async () => {

      // Update the order document directly (since it's a single test per document)
      order.resultFileId = fileId;
      order.uploadedAt = new Date();
      order.status = 'Completed';

      await order.save();

      res.json({
        message: "Result uploaded successfully",
        fileId,
        appointmentId: order.appointmentId,
        testId: order.testId
      });
    });

    uploadStream.on('error', (err) => {
      res.status(500).json({ message: 'Upload failed' });
    });

  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
}

// GET get result of the particular test results
async function getTestResult(req, res) {
  try {
    const fileId = new ObjectId(req.params.id);

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'results',
    });

    const files = await bucket.find({ _id: fileId }).toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({ message: 'File not found' });
    }

    const file = files[0];
    const stream = bucket.openDownloadStream(fileId);

    res.set('Content-Type', file.contentType || 'application/octet-stream');

    if (req.query.download === 'true') {
      res.set('Content-Disposition', `attachment; filename="${file.filename}"`);
    }

    stream.pipe(res);
  } catch (err) {
    console.error('Error streaming result file:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

// PUT Add Followup appointment
async function addFollowUpAppointment(req, res) {
  try {
    const { applicationId } = req.params;
    const { needed, comment, booked } = req.body;

    // Always match using applicationId
    const appointment = await Application.findOne({ applicationId });
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Only allow setting follow-up once
    if (appointment.followUp && appointment.followUp.needed) {
      return res.status(400).json({ error: "Follow-up already assigned" });
    }

    // Save/update follow-up
    appointment.followUp = {
      needed: needed ?? false,
      comment: comment ?? "",
      applicationId,
      booked: booked || false,
    };

    await appointment.save();

    res.json({
      message: "Follow-up saved successfully",
      followUp: appointment.followUp,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
}

//Get Application for calendar view
async function getApplicationsForCalendar(req, res) {
  try {
    const { start, end, status, followup, doctorEmail } = req.query;

    if (!start || !end) {
      return res.status(400).json({ message: "Start and End dates are required" });
    }

    const startDateStr = start.slice(0, 10);
    const endDateStr = end.slice(0, 10);

    // Filter by the authenticated doctor's email (or explicit param)
    const targetEmail = doctorEmail || req.user?.email;
    const query = {
      date: { $gte: startDateStr, $lte: endDateStr },
    };
    if (targetEmail) {
      const escaped = String(targetEmail).replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
      query["doctors.doctorEmail"] = { $regex: new RegExp(`^${escaped}$`, "i") };
    }

    // Calendar view should include these statuses (allow Upcoming too)
    const allowedCalendarStatuses = ALLOWED_APPOINTMENT_STATUSES;

    // Status filter — map frontend tab keys to DB values
    const statusMap = {
      'confirmed': 'Confirmed',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
      'unconfirmed': 'Unconfirmed',
      // 'new':                 'New',
      // 'paid':                'Paid',
      // 'pending':             'Pending payment',
      // 'awaiting for payment':'Awaiting for Payment',
    };

    if (status && status.toLowerCase() !== 'all') {
      const mapped = statusMap[status.toLowerCase()];
      if (mapped && allowedCalendarStatuses.includes(mapped)) {
        query.appointmentStatus = mapped;
      } else {
        // Any non-allowed status should return no calendar appointments.
        query.appointmentStatus = { $in: [] };
      }
    } else {
      query.appointmentStatus = { $in: allowedCalendarStatuses };
    }

    if (followup === "true") {
      query["followUp.needed"] = true;
    } else if (followup === "false") {
      query["$or"] = [
        { "followUp.needed": { $exists: false } },
        { "followUp.needed": false },
      ];
    }

    const applications = await Application.find(query).sort({ startTime: 1 }).lean();

    const results = [];

    for (const app of applications) {
      const appDoctorEmail = getPrimaryDoctorEmail(app);
      const patient = await Patient.findOne({ email: app.patientEmail })
        .select("firstName middleName lastName")
        .lean();

      const doctor = await Doctor.findOne({ email: appDoctorEmail })
        .select("firstName middleName lastName")
        .lean();

      const patientName = patient
        ? `${patient.firstName || ""} ${patient.middleName || ""} ${patient.lastName || ""}`.trim()
        : app.patientEmail;

      const doctorName = doctor
        ? `${doctor.firstName || ""} ${doctor.middleName || ""} ${doctor.lastName || ""}`.trim()
        : appDoctorEmail;

      results.push({
        applicationId: app.applicationId || app._id,
        date: app.date,
        startTime: app.startTime,
        endTime: app.endTime,
        serviceType: app.serviceType || "",
        appointmentStatus: app.appointmentStatus,
        isFollowUp: false,
        patientName,
        doctorName,
        followUpApplicationId: app.followUp?.applicationId || null,
      });

      // Include follow-up details
      if (app.followUp?.needed && app.followUp.booked && app.followUp.applicationId) {
        const followUpApp = await Application.findOne({
          applicationId: app.followUp.applicationId,
        }).lean();

        if (followUpApp) {
          const followUpDoctorEmail = getPrimaryDoctorEmail(followUpApp);
          const followUpPatient = await Patient.findOne({
            email: followUpApp.patientEmail,
          })
            .select("firstName middleName lastName")
            .lean();

          const followUpDoctor = await Doctor.findOne({
            email: followUpDoctorEmail,
          })
            .select("firstName middleName lastName")
            .lean();

          const followUpPatientName = followUpPatient
            ? `${followUpPatient.firstName || ""} ${followUpPatient.middleName || ""} ${followUpPatient.lastName || ""}`.trim()
            : followUpApp.patientEmail;

          const followUpDoctorName = followUpDoctor
            ? `${followUpDoctor.firstName || ""} ${followUpDoctor.middleName || ""} ${followUpDoctor.lastName || ""}`.trim()
            : followUpDoctorEmail;

          results.push({
            applicationId: followUpApp.applicationId || followUpApp._id,
            date: followUpApp.date,
            startTime: followUpApp.startTime,
            endTime: followUpApp.endTime,
            serviceType: followUpApp.serviceType || "",
            appointmentStatus: followUpApp.appointmentStatus,
            isFollowUp: true,
            parentApplicationId: app.applicationId,
            patientName: followUpPatientName,
            doctorName: followUpDoctorName,
            followUpComment: app.followUp.comment || "",
          });
        }
      }
    }

    // Apply follow-up filters again
    let filteredResults = results;
    if (followup === "true") {
      filteredResults = results.filter((r) => r.isFollowUp);
    } else if (followup === "false") {
      filteredResults = results.filter((r) => !r.isFollowUp);
    }

    res.json({ applications: filteredResults });
  } catch (error) {
    console.error("Get Applications Error:", error);
    res.status(500).json({ message: "Server error" });
  }
}

//Update history form schema - doctors interface
async function updateHistoryFormForDoctor(req, res) {
  try {
    const { applicationId } = req.params;
    const { isFirstAppointment, isRepetitiveAppointment } = req.body;

    // Build $set dynamically — accept { value, isVerified, ... } objects or plain strings
    const setFields = {};

    HISTORY_KEYS.forEach((key) => {
      const val = req.body[key];
      if (val === undefined) return;

      if (val === null || val === "") {
        setFields[`historyForm.${key}`] = { value: "", isVerified: false };
      } else if (typeof val === "object" && !Array.isArray(val)) {
        // Full object passed from frontend — use as-is
        setFields[`historyForm.${key}`] = val;
      } else if (typeof val === "string") {
        setFields[`historyForm.${key}`] = { value: val, isVerified: false };
      }
    });

    if (isFirstAppointment !== undefined) {
      setFields["historyForm.isFirstAppointment"] = Boolean(isFirstAppointment);
      if (isFirstAppointment) {
        setFields["historyForm.isRepetitiveAppointment"] = false;
      }
    }

    if (isRepetitiveAppointment !== undefined) {
      setFields["historyForm.isRepetitiveAppointment"] = Boolean(isRepetitiveAppointment);
      if (isRepetitiveAppointment) {
        setFields["historyForm.isFirstAppointment"] = false;
      }
    }

    const application = await Application.findOneAndUpdate(
      { applicationId },
      { $set: setFields },
      { new: true, runValidators: false }
    );

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    res.json({ message: "History form updated successfully", historyForm: application.historyForm });
  } catch (error) {
    console.error("Error updating history form:", error, "request body:", req.body);
    res.status(500).json({ message: "Failed to update history form" });
  }
}

//-----------------Assistant related Functions------------------------//

// GET /api/applications/
async function getCalendarApplications(req, res) {
  try {
    const { doctorEmail, start, end } = req.query;
    if (!doctorEmail || !start || !end) {
      return res.status(400).json({ error: 'doctorEmail, start, and end are required' });
    }
    const escaped = String(doctorEmail).replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
    const applications = await Application.find({
      "doctors.doctorEmail": { $regex: new RegExp(`^${escaped}$`, 'i') },
      date: { $gte: start.slice(0, 10), $lte: end.slice(0, 10) },
      appointmentStatus: { $ne: 'Unconfirmed' },
    }).sort({ date: 1, startTime: 1 });
    res.json(applications);
  } catch (err) {
    console.error('Error fetching applications:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function getByApplicationId(req, res) {
   const applicationId = req.params.id;
  try {
    const appointment = await Application.findOne({ applicationId });
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found', applicationId });
    }
    const doctor = await Doctor.findOne(
      { email: appointment.doctorEmail },
      { firstName: 1, middleName: 1, lastName: 1, email: 1 }
    ).lean();
    const doctorName = doctor
      ? {
          en: [doctor.firstName?.en, doctor.middleName?.en, doctor.lastName?.en]
            .filter(Boolean)
            .join(' '),
          ru: [doctor.firstName?.ru, doctor.middleName?.ru, doctor.lastName?.ru]
            .filter(Boolean)
            .join(' '),
        }
      : null;
    return res.json({ ...appointment.toObject(), doctorName });
  } catch (error) {
    return res.status(500).json({
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function getByPatientEmail(req, res) {
try {
    const email = decodeURIComponent(req.params.email).toLowerCase().trim();
    const { limit = 50 } = req.query;
    const apps = await Application.find({ patientEmail: email })
      .sort({ date: -1 })
      .limit(Number(limit))
      .lean();
    res.json({ applications: apps });
  } catch (err) {
    console.error('GET by-patient-email error:', err);
    res.status(500).json({ message: 'Server error' });
  }
}

async function addCommentAssistant(req, res) {
  const appointmentId = decodeURIComponent(req.params.id);
  const { comments } = req.body;
  const newComment = Array.isArray(comments) ? comments[comments.length - 1] : comments;
  try {
    const appointment = await Application.findOneAndUpdate(
      { applicationId: appointmentId },
      { $push: { comments: newComment } },
      { new: true }
    );
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    res.json(appointment);
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

async function updateCommentAssistant(req, res) {
  const { appointmentId, commentId } = req.params;
  const { text, edited, editTimestamp } = req.body;
  try {
    const appointment = await Application.findOne({ applicationId: appointmentId });
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
    const comment = appointment.comments.id(commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    comment.text = text;
    comment.edited = edited;
    comment.editTimestamp = editTimestamp;
    await appointment.save();
    res.json(comment);
  } catch (err) {
    console.error('Error updating comment:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function deleteCommentAssistant(req, res) {
  const { appointmentId, commentId } = req.params;
  try {
    const appointment = await Application.findOne({ applicationId: appointmentId });
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    const commentIndex = appointment.comments.findIndex(
      (comment) => comment._id.toString() === commentId
    );
    if (commentIndex === -1) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    appointment.comments.splice(commentIndex, 1);
    await appointment.save();
    res.json({
      success: true,
      message: 'Comment deleted successfully',
      appointmentId,
      commentId,
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function updatePrescriptionAssistant(req, res) {
   try {
    const appointment = await Application.findOne({ applicationId: req.params.id });
    if (!appointment) {
      return res.status(404).json({ msg: 'Appointment not found' });
    }
    appointment.prescription = {
      text: req.body.prescription || '',
      verificationStatus: 'Under Review',
    };
    await appointment.save();
    res.json(appointment);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
}

async function updateConclusionAssistant(req, res) {
  try {
    const appointment = await Application.findOne({ applicationId: req.params.id });
    if (!appointment) {
      return res.status(404).json({ msg: 'Appointment not found' });
    }
    appointment.conclusion = {
      text: req.body.conclusion || '',
      verificationStatus: 'Under Review',
    };
    await appointment.save();
    res.json(appointment);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
}

async function getAssistantAppointments(req,res){
  const assistantEmail = req.params.email;
  const { page = 1, limit = 21, status = 'all', search = '' } = req.query;
  const skip = (page - 1) * limit;

  try {
    const assistantModel = req.user.role === 'head_assistant' ? HeadAssistant : Assistant;
    const assistant = await assistantModel.findOne({ email: assistantEmail });

    if (!assistant) {
      return res.status(404).json({ success: false, message: 'No assigned doctors found for this assistant' });
    }

    if (!assistant.doctors || assistant.doctors.length === 0) {
      return res.status(200).json({ success: true, data: { appointments: [], totalCount: 0 } });
    }

    // Determine active doctors by overlap with requested range (if provided)
    const reqStart = req.query.startDate ? moment.tz(req.query.startDate, 'Europe/Moscow') : null;
    const reqEnd = req.query.endDate ? moment.tz(req.query.endDate, 'Europe/Moscow') : null;

    const activeDoctorEmails = assistant.doctors
      .filter((doc) => {
        if (!doc.startDateTime || !doc.endDateTime) return false;
        const docStart = moment.tz(doc.startDateTime, 'Europe/Moscow');
        const docEnd = moment.tz(doc.endDateTime, 'Europe/Moscow');
        // If no requested range, fall back to "now" overlap
        if (!reqStart || !reqEnd) {
          const nowIST = moment().tz('Europe/Moscow');
          return nowIST.isBetween(docStart, docEnd);
        }
        // Overlap: docStart <= reqEnd && docEnd >= reqStart
        return docStart.isSameOrBefore(reqEnd) && docEnd.isSameOrAfter(reqStart);
      })
      .map((doc) => doc.doctorEmail);

    if (activeDoctorEmails.length === 0) {
      return res.status(200).json({
        success: true,
        data: { appointments: [], totalCount: 0 },
        message: 'No doctors available at this time',
      });
    }

    // Default for assistant-facing calendar and mini-calendar: only show Confirmed and Completed
    const DEFAULT_ASSISTANT_CALENDAR_STATUSES = ["Confirmed", "Completed"];

    const regexes = activeDoctorEmails.map(e => new RegExp(`^${String(e).replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}$`, 'i'));

    const query = {
      branch: { $in: assistant.branches },
      'doctors.doctorEmail': { $in: regexes },
      appointmentStatus: { $in: DEFAULT_ASSISTANT_CALENDAR_STATUSES },
    };

    if (req.query.doctorEmail && req.query.doctorEmail !== 'all') {
      query['doctors.doctorEmail'] = req.query.doctorEmail;
    }
    if (req.query.patientEmail) {
      query.patientEmail = req.query.patientEmail.toLowerCase().trim();
    }
    if (req.query.startDate && req.query.endDate) {
      query.date = { $gte: req.query.startDate, $lte: req.query.endDate };
    }

    if (status !== 'all') {
      const statusMap = {
        completed: 'Completed',
        confirmed: 'Confirmed',
        upcoming: 'Upcoming',
      };
      const normalizedStatus = statusMap[String(status).toLowerCase()] || status;
      // Allow overriding when explicit, but keep safety: only allow statuses we know about
      if (['Confirmed', 'Completed', 'Upcoming', 'Unconfirmed', 'Cancelled'].includes(normalizedStatus)) {
        query.appointmentStatus = normalizedStatus;
      }
    }

    if (search) {
      query.$or = [
        { applicationId: new RegExp(search, 'i') },
        { serviceType: new RegExp(search, 'i') },
        { patientEmail: new RegExp(search, 'i') },
        { 'doctors.doctorEmail': new RegExp(search, 'i') },
        { patientName: new RegExp(search, 'i') },
        { 'patientDetails.firstName': new RegExp(search, 'i') },
        { 'patientDetails.lastName': new RegExp(search, 'i') },
        { 'doctorDetails.firstName': new RegExp(search, 'i') },
        { 'doctorDetails.lastName': new RegExp(search, 'i') },
      ];
    }


    const diagApps = await Application.find({ 'doctors.doctorEmail': { $in: activeDoctorEmails } })
      .select('applicationId doctors branch appointmentStatus')
      .limit(10)
      .lean();


    const [appointments, totalCount] = await Promise.all([
      Application.find(query).sort({ date: -1 }).skip(Number(skip)).limit(Number(limit)),
      Application.countDocuments(query),
    ]);


    const patientEmails = [...new Set(appointments.map((a) => a.patientEmail))].filter(Boolean);
    const uniqueDoctorEmails = [
      ...new Set(appointments.flatMap((a) => (a.doctors || []).map((d) => d.doctorEmail))),
    ].filter(Boolean);

    const [patients, doctors] = await Promise.all([
      Patient.find({ email: { $in: patientEmails } }),
      Doctor.find({ email: { $in: uniqueDoctorEmails } }),
    ]);

    const patientMap = {};
    patients.forEach((p) => {
      patientMap[p.email] = { firstName: p.firstName, middleName: p.middleName, lastName: p.lastName };
    });

    const doctorMap = {};
    doctors.forEach((d) => {
      doctorMap[d.email] = {
        firstName: d.firstName || {},
        middleName: d.middleName || {},
        lastName: d.lastName || {},
      };
    });

    const enrichedAppointments = appointments.map((appt) => {
      const obj = appt.toObject();
      obj.patientDetails = patientMap[appt.patientEmail] || null;
      const primaryDoctorEmail = appt.doctors?.[0]?.doctorEmail;
      obj.doctorDetails = doctorMap[primaryDoctorEmail] || null;
      return obj;
    });

    res.json({ success: true, data: { appointments: enrichedAppointments, totalCount } });
  } catch (error) {
    console.error('[Appointments] ✗ Error:', error.message);
    console.error(error.stack);
    res.status(500).json({ success: false, message: 'Failed to fetch appointments' });
  }
}

async function getResultFile(req, res) {
  try {
    const fileId = new ObjectId(req.params.id);
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'results',
    });
    const files = await bucket.find({ _id: fileId }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ message: 'File not found' });
    }
    const file = files[0];
    const stream = bucket.openDownloadStream(fileId);
    res.set('Content-Type', file.contentType || 'application/octet-stream');
    if (req.query.download === 'true') {
      res.set('Content-Disposition', `attachment; filename="${file.filename}"`);
    }
    stream.pipe(res);
  } catch (err) {
    console.error('Error streaming result file:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

async function updateFollowUp(req,res){
  try {
    const { applicationId } = req.params;
    const { needed, comment, booked } = req.body;
    const appointment = await Application.findOne({ applicationId });
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    if (appointment.followUp && appointment.followUp.needed) {
      return res.status(400).json({ error: 'Follow-up already assigned' });
    }
    appointment.followUp = {
      needed: needed ?? false,
      comment: comment ?? '',
      applicationId,
      booked: booked || false,
    };
    await appointment.save();
    res.json({ message: 'Follow-up saved successfully', followUp: appointment.followUp });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getCalendar(req,res){
  try {
    const { start, end, status, followup, doctorEmail } = req.query;
    if (!start || !end) {
      return res.status(400).json({ message: 'Start and End dates are required' });
    }
    const assistant = await Assistant.findOne({ email: req.user.email });
    if (!assistant) {
      return res.status(404).json({ success: false, message: 'No assistant found' });
    }
    if (!assistant.doctors?.length) {
      return res.status(200).json({
        success: true,
        data: { appointments: [], totalCount: 0 },
        message: 'No doctors assigned to this assistant',
      });
    }
    const startRange = moment.tz(start, 'Asia/Kolkata');
    const endRange = moment.tz(end, 'Asia/Kolkata');
    if (!startRange.isValid() || !endRange.isValid()) {
      return res.status(400).json({ success: false, message: 'Invalid start or end date' });
    }
    const activeDoctorEmails = assistant.doctors
      .filter((doc) => {
        if (doc.status !== 'Access Granted') return false;
        if (doctorEmail !== 'all' && doctorEmail !== doc.doctorEmail) return false;
        if (!doc.startDateTime || !doc.endDateTime) return false;
        const docStart = moment.tz(doc.startDateTime, 'Asia/Kolkata');
        const docEnd = moment.tz(doc.endDateTime, 'Asia/Kolkata');
        return docStart.isSameOrBefore(endRange) && docEnd.isSameOrAfter(startRange);
      })
      .map((doc) => doc.doctorEmail);

    if (!activeDoctorEmails.length) {
      return res.status(200).json({
        success: true,
        data: { appointments: [], totalCount: 0 },
        message: 'No active doctors available in this time range',
      });
    }

    const startDateStr = start.slice(0, 10);
    const endDateStr = end.slice(0, 10);

    const escapedEmails = activeDoctorEmails.map(e => String(e).replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"));
    const regexes = escapedEmails.map(e => new RegExp(`^${e}$`, 'i'));
    const query = {
      branch: { $in: assistant.branches },
      'doctors.doctorEmail': { $in: regexes },
      date: { $gte: startDateStr, $lte: endDateStr },
    };



    const validStatuses = ['unconfirmed', 'confirmed', 'cancelled'];
    if (status && validStatuses.includes(status.toLowerCase())) {
      query.appointmentStatus = new RegExp(`^${status}$`, 'i');
    }

    const basicQuery = query;

    if (followup === 'true') {
      query['followUp.needed'] = true;
    } else if (followup === 'false') {
      query['$or'] = [
        { 'followUp.needed': { $exists: false } },
        { 'followUp.needed': false },
      ];
    }

    let applications = await Application.find(query).sort({ startTime: 1 }).lean();
    const results = [];

    for (const app of applications) {
      const patient = await Patient.findOne({ email: app.patientEmail })
        .select('firstName middleName lastName')
        .lean();
      const doctor = await Doctor.findOne({ email: app.doctorEmail })
        .select('firstName middleName lastName')
        .lean();

      const patientName = patient
        ? `${patient.firstName || ''} ${patient.middleName || ''} ${patient.lastName || ''}`.trim()
        : app.patientEmail;

      const doctorName = doctor
        ? {
            en: `${doctor.firstName?.en || ''} ${doctor.middleName?.en || ''} ${doctor.lastName?.en || ''}`.trim(),
            ru: `${doctor.firstName?.ru || ''} ${doctor.middleName?.ru || ''} ${doctor.lastName?.ru || ''}`.trim(),
          }
        : { en: app.doctorEmail, ru: app.doctorEmail };

      results.push({
        applicationId: app.applicationId || app._id,
        branch: app.branch,
        date: app.date,
        startTime: app.startTime,
        endTime: app.endTime,
        serviceType: app.serviceType || '',
        appointmentStatus: app.appointmentStatus,
        isFollowUp: false,
        patientName,
        doctorName,
        followUpApplicationId: app.followUp?.applicationId || null,
      });

      if (app.followUp?.needed && app.followUp.booked && app.followUp.applicationId) {
        const followUpApp = await Application.findOne({
          ...basicQuery,
          applicationId: app.followUp.applicationId,
        }).lean();

        if (followUpApp) {
          const followUpPatient = await Patient.findOne({ email: followUpApp.patientEmail })
            .select('firstName middleName lastName')
            .lean();
          const followUpDoctor = await Doctor.findOne({ email: followUpApp.doctorEmail })
            .select('firstName middleName lastName')
            .lean();

          const followUpPatientName = followUpPatient
            ? `${followUpPatient.firstName || ''} ${followUpPatient.middleName || ''} ${followUpPatient.lastName || ''}`.trim()
            : followUpApp.patientEmail;

          const followUpDoctorName = followUpDoctor
            ? {
                en: `${followUpDoctor.firstName?.en || ''} ${followUpDoctor.middleName?.en || ''} ${followUpDoctor.lastName?.en || ''}`.trim(),
                ru: `${followUpDoctor.firstName?.ru || ''} ${followUpDoctor.middleName?.ru || ''} ${followUpDoctor.lastName?.ru || ''}`.trim(),
              }
            : { en: followUpApp.doctorEmail, ru: followUpApp.doctorEmail };

          results.push({
            applicationId: followUpApp.applicationId || followUpApp._id,
            branch: followUpApp.branch,
            date: followUpApp.date,
            startTime: followUpApp.startTime,
            endTime: followUpApp.endTime,
            serviceType: followUpApp.serviceType || '',
            appointmentStatus: followUpApp.appointmentStatus,
            isFollowUp: true,
            parentApplicationId: app.applicationId,
            patientName: followUpPatientName,
            doctorName: followUpDoctorName,
            followUpComment: app.followUp.comment || '',
          });
        }
      }
    }

    let filteredResults = results;
    if (followup === 'true') {
      filteredResults = filteredResults.filter((r) => r.isFollowUp);
    } else if (followup === 'false') {
      filteredResults = filteredResults.filter((r) => !r.isFollowUp);
    }

    res.json({ applications: filteredResults });
  } catch (error) {
    console.error('Get Applications Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}

async function patchApplication(req,res){
  try {
    const { applicationId } = req.params;
    const allowedFields = ['appointmentStatus', 'branch', 'meetingLink'];
    const update = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    const updated = await Application.findOneAndUpdate(
      { applicationId },
      { $set: update },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Application not found' });
    res.json(updated);
  } catch (err) {
    console.error('PATCH application error:', err);
    res.status(500).json({ message: 'Server error' });
  }
}

// Create a new application
async function createApplication(req, res) {
  try {
    const { patientId, patientEmail, doctors, serviceOrders } = req.body;

    // Resolve patient by patientId OR email
    const patientRecord = await Patient.findOne({
      $or: [
        ...(patientId ? [{ patientId }] : []),
        ...(patientEmail ? [{ email: patientEmail }] : []),
      ],
    }).lean();
    if (!patientRecord) {
      return res.status(404).json({ message: "Patient not found" });
    }
    const resolvedPatientId = patientRecord.patientId || patientId;
    const resolvedPatientEmail = patientRecord.email || patientEmail;

    // Resolve User record for serviceOrders userId
    const patient = await User.findOne({
      $or: [
        ...(resolvedPatientEmail ? [{ email: resolvedPatientEmail }] : []),
        ...(patientRecord.phoneNumber ? [{ phoneNumber: patientRecord.phoneNumber }] : []),
      ],
      role: "patient",
    }).catch(() => null);

    if (!doctors || doctors.length === 0) {
      return res.status(400).json({ message: "At least one doctor is required" });
    }

    for (const doctorEntry of doctors) {
      if (doctorEntry.doctorEmail) {
        const doctor = await DoctorsProfile.findOne({ email: doctorEntry.doctorEmail });
        if (!doctor) {
          return res.status(404).json({ message: `Doctor with email ${doctorEntry.doctorEmail} not found` });
        }
      }
    }

    if (serviceOrders && serviceOrders.length > 0) {
      for (const serviceOrder of serviceOrders) {
        if (!serviceOrder.userId && !serviceOrder.email) {
          serviceOrder.userId = patient?._id || undefined;
        } else if (serviceOrder.email) {
          serviceOrder.userId = patient?._id || undefined;
          delete serviceOrder.email;
        } else if (serviceOrder.userId) {
          if (typeof serviceOrder.userId === "object") {
            return res.status(400).json({ message: "Invalid userId format in serviceOrders" });
          }
          try {
            const user = await User.findById(serviceOrder.userId);
            if (!user || user.role !== "patient") {
              return res.status(400).json({ message: "Invalid userId in serviceOrders" });
            }
          } catch (err) {
            return res.status(400).json({ message: "Invalid userId format" });
          }
        }
      }
    }

    // ---------- COUNTER LOGIC ----------
    const date = new Date();
    const monthYear = `${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getFullYear()}`;
    let counter = await Counter.findOne({ name: "applicationId" });

    if (!counter || counter.monthYear !== monthYear) {
      counter = await Counter.findOneAndUpdate(
        { name: "applicationId" },
        { $set: { name: "applicationId", monthlyCount: 1, overallCount: counter ? counter.overallCount + 1 : 1, monthYear } },
        { new: true, upsert: true },
      );
    } else {
      counter = await Counter.findOneAndUpdate(
        { name: "applicationId", monthYear },
        { $inc: { monthlyCount: 1, overallCount: 1 } },
        { new: true },
      );
    }

    if (!counter) throw new Error("Failed to create or update counter document");

    const applicationId = `HD-R${counter.monthlyCount.toString().padStart(3, "0")}-${monthYear}-${counter.overallCount.toString().padStart(4, "0")}`;

    // ---------- BUILD SERVICES ARRAY ----------
    const seen = new Set();
    const allServiceIds = [];

    for (const d of (doctors || [])) {
      if (!d.serviceId || !mongoose.isValidObjectId(d.serviceId)) continue;
      const key = `${d.serviceId}-${d.doctorEmail || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const position = await ServicePosition.findById(d.serviceId)
        .select("price isConsultation consultationDoctors")
        .lean();
      if (!position) continue;

      let price = position.price;
      let doctorProfileId = null;

      if (d.doctorEmail) {
        const docProfile = await DoctorsProfile.findOne({ email: d.doctorEmail }).select("_id").lean();
        doctorProfileId = docProfile?._id || null;

        if (position.isConsultation && doctorProfileId) {
          const match = (position.consultationDoctors || []).find(
            (cd) => cd.doctor && cd.doctor.toString() === doctorProfileId.toString()
          );
          if (match != null) price = match.price;
        }
      }

      allServiceIds.push({
        servicePosition: new mongoose.Types.ObjectId(d.serviceId),
        doctorProfile: doctorProfileId,
        price,
      });
    }

    // ---------- APPLICATION CREATION ----------
    const applicationData = {
      applicationId,
      patientId: resolvedPatientId,
      patientEmail: resolvedPatientEmail,
      doctors: doctors || [],
      serviceType: req.body.serviceType,
      branch: req.body.branch || "",
      appointmentStatus: req.body.appointmentStatus,
      date: req.body.date,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      payments: [],
      comments: req.body.comments || [],
      documents: req.body.documents || [],
      serviceOrders: serviceOrders || [],
      services: allServiceIds,
    };

    const application = new Application(applicationData);
    await application.save();

    const populatedApplication = application.toObject();
    populatedApplication.patient = await Patient.findOne({
      $or: [
        ...(resolvedPatientId ? [{ patientId: resolvedPatientId }] : []),
        ...(resolvedPatientEmail ? [{ email: resolvedPatientEmail }] : []),
      ],
    })
      .select("firstName middleName lastName email phoneNumber _id patientId dateOfBirth gender")
      .lean();

    if (doctors && doctors.length > 0) {
      populatedApplication.doctorProfiles = await Promise.all(
        doctors.map(async (d) => {
          return DoctorsProfile.findOne({ email: d.doctorEmail })
            .select("firstName middleName lastName specialty email phoneNumber _id")
            .lean();
        }),
      );
    }

    res.status(201).json(populatedApplication);
  } catch (error) {
    let errorMessage = "Failed to create application";
    if (error.name === "CastError") {
      errorMessage = "Invalid data format. Please check your input.";
    } else if (error.name === "ValidationError") {
      errorMessage = "Validation failed. Please check required fields.";
    } else if (error.message && (error.message.includes("not found") || error.message.includes("required"))) {
      errorMessage = error.message;
    }
    res.status(400).json({ message: errorMessage });
  }
}

// Add a comment
async function addComment(req, res) {
  try {
    const application = await Application.findById(req.params.id);
    if (!application)
      return res.status(404).json({ message: "Application not found" });

    if (req.user.role !== "manager") {
      return res.status(403).json({ message: "Access denied. Managers only." });
    }

    const commentData = {
      text: req.body.text,
      email: req.user.email,
      role: req.user.role,
      createdAt: new Date(),
    };

    if (!commentData.text || !commentData.text.trim()) {
      return res.status(400).json({ message: "Comment text is required" });
    }

    application.comments.push(commentData);
    await application.save();

    const populatedApplication = await buildPopulatedApplication(application);

    res.status(201).json(populatedApplication);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// Update a comment
async function updateComment(req, res) {
  try {
    const application = await Application.findOne({
      "comments._id": req.params.commentId,
    });
    if (!application)
      return res.status(404).json({ message: "Comment not found" });

    const comment = application.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    if (!req.body.text || !req.body.text.trim()) {
      return res.status(400).json({ message: "Comment text is required" });
    }

    comment.text = req.body.text.trim();
    await application.save();

    const populatedApplication = await buildPopulatedApplication(application);

    res.json(populatedApplication);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// Get payments for an application
async function getPayments(req, res) {
  try {
    const appId = decodeURIComponent(req.params.id);
    const application = await Application.findOne({ applicationId: appId })
      .select("payments")
      .lean();
    if (!application)
      return res.status(404).json({ message: "Application not found" });
    return res.status(200).json({ payments: application.payments || [] });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch payments" });
  }
}

// Create a payment
async function createPayment(req, res) {
  try {
    const { id } = req.params;
    const {
      items,
      amount,
      finalAmount,
      currency = "RUB",
      attendanceMode,
      status = "pending", // Default to pending for new payments
      paymentMethod = "yookassa", // 'yookassa' or 'bank'
      paymentType = "card", // 'card' or 'qr'
      vat = 0,
      discount = 0,
    } = req.body;

    if (!amount || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message:
          "Missing required fields: amount and non-empty items are required",
      });
    }

    const parsedAmount =
      status === "free" ? Number(amount) || 0 : Number(amount);
    if (isNaN(parsedAmount) || (parsedAmount <= 0 && status !== "free"))
      return res.status(400).json({ message: "Invalid amount" });

    const decodedId = decodeURIComponent(id);
    await migrateHistoryFormLegacy(decodedId);

    const application = await Application.findOne({ applicationId: decodedId });
    if (!application)
      return res.status(404).json({ message: "Application not found" });

    // Create payment object without invoiceNumber - it will be generated by mongoose middleware
    const newPayment = {
      id: uuidv4(),
      // invoiceNumber will be auto-generated by mongoose pre-save middleware
      status,
      amount: parsedAmount,
      discount: Number(discount) || 0,
      vat: Number(vat) || 0,
      finalAmount: finalAmount ?? parsedAmount,
      paymentMethod,
      paymentType,
      items: items.map((item) => ({
        name: item.name,
        amount: Number(item.amount),
        discount: Number(item.discount) || 0,
        currency: item.currency || "RUB",
        quantity: Number(item.quantity) || 1,
      })),
      paidAt: null,
      attendanceMode: attendanceMode || null,
      currency,
      type: "consultation",
    };

    // ----------------------------------------------------------
    // YooKassa Integration
    // ----------------------------------------------------------
    if (paymentMethod === "yookassa") {
      const { YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY, PAYMENT_RETURN_URL } =
        process.env;
      if (!YOOKASSA_SHOP_ID || !YOOKASSA_SECRET_KEY || !PAYMENT_RETURN_URL)
        return res.status(500).json({ message: "YooKassa config missing" });

      // Push payment to application first to trigger invoice number generation
      application.payments.push(newPayment);
      await application.save();

      // Get the saved payment with generated invoice number
      const savedPayment =
        application.payments[application.payments.length - 1];
      const invoiceNumber = savedPayment.invoiceNumber;

      const idempotenceKey = uuidv4();
      const paymentData = {
        amount: { value: parsedAmount.toFixed(2), currency },
        confirmation: { type: "redirect", return_url: PAYMENT_RETURN_URL },
        capture: true,
        description: `Payment for invoice ${invoiceNumber}`,
        metadata: { applicationId: id, invoiceNumber },
      };

      try {
        const response = await fetch("https://api.yookassa.ru/v3/payments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotence-Key": idempotenceKey,
            Authorization:
              "Basic " +
              Buffer.from(
                `${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`,
              ).toString("base64"),
          },
          body: JSON.stringify(paymentData),
          signal: AbortSignal.timeout(10000),
        });

        const json = await response.json();
        if (!response.ok) {
          // Save payment without link so application is not broken
          return res
            .status(201)
            .json({
              ...savedPayment.toObject(),
              paymentLink: null,
              gatewayError: json,
            });
        }

        // Update payment with YooKassa details
        savedPayment.id = json.id;
        savedPayment.paymentLink = json.confirmation.confirmation_url;
        await application.save();

        return res.status(201).json(savedPayment);
      } catch (gatewayError) {
        // Payment is already saved - return it without a link rather than failing
        return res
          .status(201)
          .json({
            ...savedPayment.toObject(),
            paymentLink: null,
            gatewayError: gatewayError.message,
          });
      }
    } else if (paymentMethod === "bank") {
      const {
        BANK_CLIENT_ID,
        BANK_CLIENT_SECRET,
        VTB_MERCHANT_AUTH,
        PAYMENT_RETURN_URL,
      } = process.env;

      // Keep full client_id for OAuth token request (with @ext.vtb.ru)
      const fullClientId = BANK_CLIENT_ID?.trim().replace(/^["']|["']$/g, "");
      const clientSecret = BANK_CLIENT_SECRET?.trim().replace(
        /^["']|["']$/g,
        "",
      );

      if (!fullClientId || !clientSecret) {
        return res.status(500).json({
          message: "Missing VTB credentials",
        });
      }

      // Push payment to application first to trigger invoice number generation
      application.payments.push(newPayment);
      await application.save();

      // Get the saved payment with generated invoice number
      const savedPayment =
        application.payments[application.payments.length - 1];
      const invoiceNumber = savedPayment.invoiceNumber;

      // Merge Node.js default root CAs with VTB-specific certificates
      const vtbCaCerts = [
        ...tls.rootCertificates,
        fs.readFileSync(
          path.join(__dirname, "../vtb/rootca_ssl_rsa2022.crt"),
          "utf8",
        ),
        fs.readFileSync(
          path.join(__dirname, "../vtb/subca_ssl_rsa2022.crt"),
          "utf8",
        ),
      ];

      const agent = new https.Agent({
        ca: vtbCaCerts,
        rejectUnauthorized: true,
        minVersion: "TLSv1.2",
      });

      // Use official VTB API URLs based on IS_SANDBOX flag
      const isSandbox = process.env.IS_SANDBOX === "true";
      const TOKEN_URL = isSandbox
        ? "https://epa-ift-sbp.vtb.ru:443/passport/oauth2/token"
        : "https://open.api.vtb.ru:443/passport/oauth2/token";
      const BASE_URL = isSandbox
        ? "https://test3.api.vtb.ru:8443/openapi/smb/efcp/e-commerce/v1"
        : "https://gw.api.vtb.ru/openapi/smb/efcp/e-commerce/v1";

      try {
        // Step 1: Get OAuth2 access token - use FULL client_id with domain

        const tokenData = await new Promise((resolve, reject) => {
          // Build form body manually to avoid URLSearchParams encoding @ as %40
          const postData = `grant_type=client_credentials&client_id=${encodeURIComponent(fullClientId)}&client_secret=${encodeURIComponent(clientSecret)}`;

          const url = new URL(TOKEN_URL);
          const options = {
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname + url.search,
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "Content-Length": Buffer.byteLength(postData),
            },
            ca: vtbCaCerts,
            // Sandbox test3.api.vtb.ru uses Russian Trusted CA not in Node.js trust store
            rejectUnauthorized: !isSandbox,
            minVersion: "TLSv1.2",
          };

          // === COMPLETE HTTP LOG FOR TOKEN REQUEST ===
          Object.entries(options.headers).forEach(([key, value]) => { });

          const req = https.request(options, (res) => {
            // Log response headers
            Object.entries(res.headers).forEach(([key, value]) => { });

            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
              try {
                const parsed = JSON.parse(data);
                resolve({
                  ok: res.statusCode === 200,
                  status: res.statusCode,
                  data: parsed,
                });
              } catch (e) {
                resolve({
                  ok: false,
                  status: res.statusCode,
                  data: { error: data },
                });
              }
            });
          });

          req.on("error", (error) => {
            reject(error);
          });
          req.write(postData);
          req.end();
        });

        if (!tokenData.ok || !tokenData.data.access_token) {
          application.payments.pop();
          await application.save();
          return res
            .status(500)
            .json({
              message: "Failed to obtain VTB access token",
              error: tokenData.data,
            });
        }

        const accessToken = tokenData.data.access_token;

        // Extract client_id without @ext.vtb.ru domain for X-IBM-Client-Id header
        const xIbmClientId = fullClientId.split("@")[0].toLowerCase();
        // Create Order with merchant authorization
        const expire = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        const amountValue = Math.round(parsedAmount * 100) / 100;
        const orderBody = {
          orderId: invoiceNumber,
          orderName: `Invoice ${invoiceNumber}`.substring(0, 255),
          expire,
          amount: { value: amountValue, code: "RUB" },
          returnUrl: PAYMENT_RETURN_URL,
        };

        if (paymentType === "qr") orderBody.returnPaymentData = "sbp";

        // Step 2: Create order with Bearer token
        const orderData = await new Promise((resolve, reject) => {
          const postData = JSON.stringify(orderBody);
          const url = new URL(`${BASE_URL}/orders`);

          const headers = {
            Authorization: `Bearer ${accessToken}`,
            "X-IBM-Client-Id": xIbmClientId,
            "Content-Type": "application/json",
            Accept: "application/json",
            "Content-Length": Buffer.byteLength(postData),
          };

          // Add Merchant-Authorization only if provided (for multiple resources)
          if (VTB_MERCHANT_AUTH) {
            headers["Merchant-Authorization"] = VTB_MERCHANT_AUTH;
          }

          const options = {
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname,
            method: "POST",
            headers,
            ca: vtbCaCerts,
            // Sandbox test3.api.vtb.ru uses Russian Trusted CA not in Node.js trust store
            rejectUnauthorized: !isSandbox,
            minVersion: "TLSv1.2",
          };

          // === COMPLETE HTTP LOG FOR ORDER REQUEST ===
          Object.entries(headers).forEach(([key, value]) => {
            // Redact sensitive token but show first/last few characters
            if (key === "Authorization") {
              const token = value.replace("Bearer ", "");
            } else {
            }
          });

          const req = https.request(options, (res) => {
            // Log response headers immediately
            Object.entries(res.headers).forEach(([key, value]) => { });

            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
              try {
                const parsed = JSON.parse(data);
                resolve({
                  ok: res.statusCode >= 200 && res.statusCode < 300,
                  status: res.statusCode,
                  data: parsed,
                });
              } catch (e) {
                resolve({
                  ok: false,
                  status: res.statusCode,
                  data: { error: data },
                });
              }
            });
          });

          req.on("error", (error) => {
            reject(error);
          });
          req.write(postData);
          req.end();
        });

        if (!orderData.ok) {
          // Remove payment if order creation fails
          application.payments.pop();
          await application.save();

          return res.status(500).json({
            message: "Failed to create VTB payment order",
            error: orderData,
          });
        }

        const responseData = orderData.data;
        const payUrl =
          responseData?.object?.payUrl ||
          responseData?.payUrl ||
          responseData?.paymentUrl;

        if (!payUrl) {
          // Remove payment if no payUrl
          application.payments.pop();
          await application.save();

          return res.status(500).json({
            message: "No payment URL received from VTB",
            response: responseData,
          });
        }

        // Update payment with VTB details
        savedPayment.id = responseData?.object?.orderId || invoiceNumber;
        savedPayment.paymentLink = payUrl;
        savedPayment.bankResponse = responseData;
        await application.save();
        return res.status(201).json(savedPayment);
      } catch (err) {
        // If payment was saved but gateway failed, return it without a link
        if (application.payments.length > 0) {
          const savedPayment =
            application.payments[application.payments.length - 1];
          return res
            .status(201)
            .json({
              ...savedPayment.toObject(),
              paymentLink: null,
              gatewayError: err.message,
            });
        }
        return res.status(500).json({
          message: "VTB integration failed",
          error: err.message,
        });
      }
    } else {
      // For cash and other payment methods without gateway integration
      application.payments.push(newPayment);
      await application.save();

      const savedPayment =
        application.payments[application.payments.length - 1];
      return res.status(201).json(savedPayment);
    }
  } catch (error) {
    return res.status(500).json({
      message: "Failed to create payment",    });
  }
}

// Update payment (PATCH)
async function updatePayment(req, res) {
  try {
    const application = await Application.findById(req.params.id);
    if (!application)
      return res.status(404).json({ message: "Application not found" });

    const {
      id,
      invoiceNumber,
      totalAmount,
      currency,
      packages,
      paymentLink,
      status,
      attendanceMode,
    } = req.body;

    if (!invoiceNumber || !totalAmount || !packages) {
      return res.status(400).json({
        message:
          "Missing required payment fields: invoiceNumber, totalAmount, and packages are required",
      });
    }

    if (!Array.isArray(packages) || packages.length === 0) {
      return res
        .status(400)
        .json({ message: "Packages must be a non-empty array" });
    }

    for (const pkg of packages) {
      if (
        !pkg.name ||
        pkg.amount == null ||
        !pkg.currency ||
        pkg.quantity == null
      ) {
        return res.status(400).json({
          message:
            "Each package must have name, amount, currency, and quantity",
        });
      }
    }

    if (status && !validPaymentStatuses.includes(status)) {
      return res.status(400).json({
        message: `Invalid payment status. Must be one of: ${validPaymentStatuses.join(
          ", ",
        )}`,
      });
    }

    const paymentData = {
      id: id || uuidv4(),
      invoiceNumber,
      status: status || "pending",
      totalAmount: totalAmount.toString(),
      paymentLink: paymentLink || null,
      paymentMethod: "yookassa",
      packages: packages.map((pkg) => ({
        name: pkg.name,
        amount: Number(pkg.amount),
        currency: pkg.currency,
        quantity: Number(pkg.quantity) || 1,
      })),
      paidAt: null,
      attendanceMode: attendanceMode || null,
    };

    application.payments.push(paymentData);
    await application.save();

    const populatedApplication = await buildPopulatedApplication(application);

    res.status(200).json(populatedApplication);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// Mark payment as paid
async function markPaymentPaid(req, res) {
  try {
    const { applicationId, paymentId } = req.params;
    const decodedAppId = decodeURIComponent(applicationId);
    await migrateHistoryFormLegacy(decodedAppId);

    const application = await Application.findOne({
      applicationId: decodedAppId,
    });
    if (!application)
      return res.status(404).json({ message: "Application not found" });

    const payment = application.payments.find((p) => p.id === paymentId);
    if (!payment)
      return res.status(404).json({ message: "Payment not found" });

    if (payment.status === "paid") {
      return res
        .status(400)
        .json({ message: "Payment is already marked as paid" });
    }

    payment.status = "paid";
    payment.paidAt = new Date();

    await application.save();

    res.status(200).json({ message: "Payment marked as paid", payment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Mark payment as free
async function markPaymentFree(req, res) {
  try {
    const { applicationId, paymentId } = req.params;
    const decodedAppId = decodeURIComponent(applicationId);
    await migrateHistoryFormLegacy(decodedAppId);

    const application = await Application.findOne({
      applicationId: decodedAppId,
    });
    if (!application)
      return res.status(404).json({ message: "Application not found" });

    const payment = application.payments.find((p) => p.id === paymentId);

    if (!payment)
      return res.status(404).json({ message: "Payment not found" });

    if (payment.status === "paid") {
      return res
        .status(400)
        .json({ message: "Payment already marked as paid" });
    }
    if (payment.status === "free") {
      return res
        .status(400)
        .json({ message: "Payment already marked as free" });
    }

    payment.status = "free";
    payment.paidAt = new Date(); // reuse for timestamp display in UI
    await application.save();

    res.status(200).json({ message: "Payment marked as free", payment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Cancel a payment
async function cancelPayment(req, res) {
  try {
    const appId = decodeURIComponent(req.params.applicationId);
    const { paymentId } = req.params;
    await migrateHistoryFormLegacy(appId);
    const application = await Application.findOne({ applicationId: appId });
    if (!application)
      return res.status(404).json({ message: "Application not found" });
    const payment = application.payments.find((p) => p.id === paymentId);
    if (!payment)
      return res.status(404).json({ message: "Payment not found" });
    if (["paid", "cancelled"].includes(payment.status))
      return res
        .status(400)
        .json({ message: `Payment is already ${payment.status}` });
    payment.status = "cancelled";
    await application.save();
    res.status(200).json({ message: "Payment cancelled", payment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Invoice HTML
async function getPaymentInvoice(req, res) {
  try {
    const appId = decodeURIComponent(req.params.applicationId);
    const { paymentId } = req.params;
    const application = await Application.findOne({
      applicationId: appId,
    }).lean();
    if (!application)
      return res.status(404).json({ message: "Application not found" });
    const payment = application.payments.find((p) => p.id === paymentId);
    if (!payment)
      return res.status(404).json({ message: "Payment not found" });
    const patient = await Patient.findOne({ email: application.patientEmail })
      .select("firstName lastName middleName email phoneNumber")
      .lean();
    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(invoiceHTML(payment, patient, appId));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Akt HTML
async function getPaymentAkt(req, res) {
  try {
    const appId = decodeURIComponent(req.params.applicationId);
    const { paymentId } = req.params;
    const application = await Application.findOne({
      applicationId: appId,
    }).lean();
    if (!application)
      return res.status(404).json({ message: "Application not found" });
    const payment = application.payments.find((p) => p.id === paymentId);
    if (!payment)
      return res.status(404).json({ message: "Payment not found" });
    const patient = await Patient.findOne({ email: application.patientEmail })
      .select("firstName lastName middleName email phoneNumber")
      .lean();
    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(aktHTML(payment, patient, appId));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Delete a document by filename
async function deleteDocument(req, res) {
  try {
    const id = decodeURIComponent(req.params.id);
    await migrateHistoryFormLegacy(id);

    const application = await Application.findOne({ applicationId: id });
    if (!application)
      return res.status(404).json({ message: "Application not found" });

    const documentIndex = application.documents.findIndex(
      (doc) => doc.filename === req.params.filename,
    );
    if (documentIndex === -1)
      return res.status(404).json({ message: "Document not found" });

    const document = application.documents[documentIndex];
    if (document.fileId) {
      const gfs = gfsMedia();
      try {
        await gfs.delete(new mongoose.Types.ObjectId(document.fileId));
      } catch (err) { }
    }

    application.documents.splice(documentIndex, 1);
    await application.save();

    const populatedApplication = await buildPopulatedApplication(application);

    res.json(populatedApplication);
  } catch (error) {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid application ID" });
    }
    res.status(500).json({ message: "Server error" });
  }
}

// Retrieve a media file (with /media/ prefix)
async function getMediaFile(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid media ID" });
    }

    const gfs = gfsMedia();
    const files = await gfs.find({ _id: new mongoose.Types.ObjectId(id) }).toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({ message: "Media not found" });
    }

    const file = files[0];

    res.set("Content-Type", file.contentType);

    if (req.query.download === "true") {
      res.set("Content-Disposition", `attachment; filename="${file.filename}"`);
    } else {
      res.set("Content-Disposition", `inline; filename="${file.filename}"`);
    }

    const readStream = gfs.openDownloadStream(file._id);

    readStream.on("error", (err) => {
      if (!res.headersSent) {
        res.status(500).json({ message: "Error streaming file", error: err.message });
      }
    });

    readStream.pipe(res);

  } catch (error) {
    console.error("Media Fetch Error:", error);
    res.status(500).json({ message: "Server error" });
  }
}

// Send email for a specific application
async function sendApplicationEmail(req, res) {
  try {
    const { id } = req.params;
    const { to, subject, body } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid application ID" });
    }

    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    if (!to || !subject || !body) {
      return res
        .status(400)
        .json({ message: "Recipient, subject, and body are required" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({ message: "Invalid email address" });
    }

    // Verify the recipient is either the patient or doctor associated with the application
    if (to !== application.patientEmail && to !== application.doctorEmail) {
      return res.status(403).json({
        message: "Recipient email must match patient or doctor email",
      });
    }

    // Send email using Nodemailer
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      text: body,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Email sent successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to send email" });
  }
}

// YooKassa webhook
async function yookassaWebhook(req, res) {
  try {
    const { type, event, object } = req.body;

    if (type === "notification") {
      if (event === "payment.succeeded") {
        const paymentId = object.id;
        const app = await Application.findOne({ "payments.id": paymentId });
        if (app) {
          const pay = app.payments.find((p) => p.id === paymentId);
          pay.status = "paid";
          pay.paidAt = new Date();
          await app.save();
        }
      } else if (event === "payment.canceled") {
        const paymentId = object.id;
        const app = await Application.findOne({ "payments.id": paymentId });
        if (app) {
          const pay = app.payments.find((p) => p.id === paymentId);
          pay.status = "cancelled";
          await app.save();
        }
      }
    }

    res.sendStatus(200);
  } catch (error) {
    res.sendStatus(500);
  }
}

// Return URL handler (user redirected here after payment)
async function paymentReturnHandler(req, res) {
  const paymentId = req.query.payment_id;
  if (!paymentId) {
    return res.status(400).send("Missing payment ID");
  }

  try {
    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;

    const response = await fetch(
      `https://api.yookassa.ru/v3/payments/${paymentId}`,
      {
        method: "GET",
        headers: {
          Authorization:
            "Basic " + Buffer.from(`${shopId}:${secretKey}`).toString("base64"),
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch payment status");
    }

    const paymentData = await response.json();
    const status = paymentData.status;

    // Update DB
    const app = await Application.findOne({ "payments.id": paymentId });
    if (app) {
      const pay = app.payments.find((p) => p.id === paymentId);
      pay.status = status;
      if (status === "succeeded") pay.paidAt = new Date();
      await app.save();
    }

    // Render HTML response
    let html = `
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Payment Status</title><style>body{font-family:Arial,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background-color:#f0f2f5;}.container{text-align:center;padding:20px;background:white;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);}</style></head>
      <body><div class="container">`;

    if (status === "succeeded") {
      html += `<h1 style="color:#28a745;">Payment Successful!</h1><p>Your payment of ${paymentData.amount.value} ${paymentData.amount.currency} has been processed successfully.</p>`;
    } else if (status === "canceled") {
      html += `<h1 style="color:#dc3545;">Payment Failed</h1><p>Your payment was canceled or could not be processed. Please try again.</p>`;
    } else {
      html += `<h1 style="color:#ffc107;">Payment Pending</h1><p>Your payment is still processing. Please check back later.</p>`;
    }

    html += `</div></body></html>`;
    res.send(html);
  } catch (error) {
    res.status(500).send("Error checking payment status");
  }
}

// Get application by appointment ID
async function getApplicationByAppointmentId(req, res) {
  try {
    const { appointmentId } = req.params;
    const application = await Application.findOne({
      applicationId: appointmentId,
    }).lean();
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    application.applicationId = application.applicationId || application._id;

    const _patientQuery2 = application.patientId
      ? { patientId: application.patientId }
      : application.patientEmail
        ? { email: application.patientEmail }
        : null;
    application.patient = _patientQuery2
      ? await Patient.findOne(_patientQuery2)
          .select("firstName middleName lastName email phoneNumber _id patientId dateOfBirth gender")
          .lean()
      : null;

    application.doctor = await DoctorsProfile.findOne({
      email: application.doctorEmail,
    })
      .select("firstName middleName lastName specialty email phoneNumber _id")
      .lean();
    application.documents = Array.isArray(application.documents)
      ? application.documents
      : [];
    application.documents = await populateDocuments(application.documents);

    res.json(application);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
}

// Update prescription
async function updatePrescription(req, res) {
  try {
    const id = decodeURIComponent(req.params.id);
    const { text } = req.body;

    if (req.user.role !== "manager" && req.user.role !== "head_manager") {
      return res.status(403).json({ message: "Access denied. Managers only." });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Prescription text is required" });
    }

    const application = await Application.findOne({ applicationId: id });

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    application.prescription = {
      text: text.trim(),
      verificationStatus:
        application.prescription?.verificationStatus || "Unverified",
    };

    await application.save();

    const populatedApplication = await buildPopulatedApplication(application);

    res.status(200).json(populatedApplication);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to update prescription" });
  }
}

// Update conclusion
async function updateConclusion(req, res) {
  try {
    const id = decodeURIComponent(req.params.id);
    const { text } = req.body;

    if (req.user.role !== "manager" && req.user.role !== "head_manager") {
      return res.status(403).json({ message: "Access denied. Managers only." });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Conclusion text is required" });
    }

    const application = await Application.findOne({ applicationId: id });
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    application.conclusion = {
      text: text.trim(),
      verificationStatus:
        application.conclusion?.verificationStatus || "Unverified",
    };

    await application.save();

    const populatedApplication = await buildPopulatedApplication(application);

    res.status(200).json(populatedApplication);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to update conclusion" });
  }
}

// Get media by ID (GridFS bucket)
async function getMediaById(req, res) {
  try {
    const fileId = new ObjectId(req.params.id);

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "media",
    });

    const files = await bucket.find({ _id: fileId }).toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({ message: "File not found" });
    }

    const file = files[0];
    const stream = bucket.openDownloadStream(fileId);

    res.set("Content-Type", file.contentType || "application/octet-stream");

    if (req.query.download === "true") {
      res.set("Content-Disposition", `attachment; filename="${file.filename}"`);
    }

    stream.pipe(res);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

// Save Follow-Up
async function saveFollowUp(req, res) {
  try {
    const id = decodeURIComponent(req.params.id);
    const { needed, comment, booked, applicationId: followUpAppId } = req.body;

    const update = {};
    if (needed !== undefined) update["followUp.needed"] = needed;
    if (comment !== undefined) update["followUp.comment"] = comment;
    if (booked !== undefined) update["followUp.booked"] = booked;
    if (followUpAppId !== undefined)
      update["followUp.applicationId"] = followUpAppId;

    const application = await Application.findOneAndUpdate(
      { applicationId: id },
      { $set: update },
      { new: true, runValidators: true },
    );

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    return res.status(200).json({
      message: "Follow-up saved successfully",
      followUp: application.followUp,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
}

// Update History Form
async function updateHistoryForm(req, res) {
  try {
    const applicationId = decodeURIComponent(req.params.id);
    const { historyForm } = req.body;
    const existing = await Application.findOne({ applicationId }).lean();
    if (!existing) return res.status(404).json({ message: 'Application not found' });

    const historyFieldKeys = [
      "complaints",
      "anamnesisMorbi",
      "anamnesisVitae",
      "physicalExam",
      "respiratory",
      "circulatory",
      "digestive",
      "urinary",
      "endocrine",
      "preliminaryDiagnosis",
      "examinationPlan",
      "examinationResults",
      "clinicalDiagnosis",
      "treatmentPlan",
    ];

    const update = {};

    // isFirstAppointment / isRepetitiveAppointment live at Application top level
    if ('isFirstAppointment' in historyForm) {
      update['isFirstAppointment'] = Boolean(historyForm.isFirstAppointment);
    }
    if ('isRepetitiveAppointment' in historyForm) {
      update['isRepetitiveAppointment'] = Boolean(historyForm.isRepetitiveAppointment);
    }

    for (const key of historyFieldKeys) {
      if (key in historyForm) {
        update[`historyForm.${key}`] = historyForm[key];
      }
    }

    const application = await Application.findOneAndUpdate(
      { applicationId },
      { $set: update },
      { new: true, runValidators: true },
    );

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    try {
      const io = req.app.get("io");
      io.emit("application:history-updated", {
        applicationId,
        historyForm: application.historyForm,
      });
    } catch (socketError) { }

    return res.status(200).json({
      message: "History form updated successfully",
      historyForm: application.historyForm,
      isFirstAppointment: application.isFirstAppointment,
      isRepetitiveAppointment: application.isRepetitiveAppointment,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
}

// Toggle single history field verification
async function verifyHistoryField(req, res) {
  try {
    const id = decodeURIComponent(req.params.id);
    const { fieldKey } = req.params;
    const { isVerified } = req.body;

    const allowedKeys = [
      "complaints",
      "anamnesisMorbi",
      "anamnesisVitae",
      "physicalExam",
      "respiratory",
      "circulatory",
      "digestive",
      "urinary",
      "endocrine",
      "preliminaryDiagnosis",
      "examinationPlan",
      "examinationResults",
      "clinicalDiagnosis",
      "treatmentPlan",
    ];

    if (!allowedKeys.includes(fieldKey)) {
      return res.status(400).json({ message: "Invalid fieldKey" });
    }
    if (typeof isVerified !== "boolean") {
      return res.status(400).json({ message: "isVerified must be a boolean" });
    }

    // Use raw MongoDB collection to bypass Mongoose casting.
    const raw = await Application.collection.findOne({ applicationId: id });
    if (!raw) {
      return res.status(404).json({ message: "Application not found" });
    }

    // Build $set: migrate every legacy string field to an object, and apply
    // isVerified to the requested fieldKey
    const allHistoryKeys = [
      "complaints",
      "anamnesisMorbi",
      "anamnesisVitae",
      "physicalExam",
      "respiratory",
      "circulatory",
      "digestive",
      "urinary",
      "endocrine",
      "preliminaryDiagnosis",
      "examinationPlan",
      "examinationResults",
      "clinicalDiagnosis",
      "treatmentPlan",
    ];

    const historyUpdate = {};
    for (const k of allHistoryKeys) {
      const f = raw.historyForm?.[k];
      const isLegacyString = typeof f === "string";
      const existingObj = isLegacyString
        ? { value: f, isVerified: false, verifiedBy: null, verifiedAt: null }
        : f && typeof f === "object"
          ? f
          : {
            value: "",
            isVerified: false,
            verifiedBy: null,
            verifiedAt: null,
          };

      if (k === fieldKey) {
        historyUpdate[`historyForm.${k}`] = {
          ...existingObj,
          isVerified,
          verifiedBy: isVerified ? req.user?.email || null : null,
          verifiedAt: isVerified ? new Date() : null,
        };
      } else if (isLegacyString) {
        // Migrate other legacy string fields to the object format at the same time
        historyUpdate[`historyForm.${k}`] = existingObj;
      }
    }

    await Application.collection.updateOne(
      { applicationId: id },
      { $set: historyUpdate },
    );

    // Now Mongoose can safely hydrate the (fully migrated) document
    const application = await Application.findOne({ applicationId: id });

    try {
      const io = req.app.get("io");
      io.emit("application:history-updated", {
        applicationId: id,
        historyForm: application.historyForm,
      });
    } catch (socketError) { }

    return res.status(200).json({
      message: "Field verification updated",
      fieldKey,
      field: application.historyForm[fieldKey],
    });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
}

async function deleteApplication(req, res) {
  try {
    const { id } = req.params;
    const app = await Application.findOne({ applicationId: id })
      || (mongoose.Types.ObjectId.isValid(id) ? await Application.findById(id) : null);
    if (!app) return res.status(404).json({ message: "Application not found" });
    await app.deleteOne();
    res.status(200).json({ message: "Application deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

module.exports = {
  uploadDocumentFile,
  uploadDocumentUrl,
  getUserIdByEmail,
  getMedicalHistoryByPatientId,
  getApplicationsByPatientId,
  getApplicationsByDate,
  getApplicationCountsByMonth,
  getApplicationById,
  updateApplication,
  getAllApplications,
  uploadDocumentForDoctors,
  getDocumentByIdForDoctors,
  getAllApplicationsForDoctors,
  getApplicationByIdForDoctors,
  createApplication,
  addComment,
  updateComment,
  getPayments,
  createPayment,
  updatePayment,
  markPaymentPaid,
  markPaymentFree,
  cancelPayment,
  getPaymentInvoice,
  getPaymentAkt,
  deleteDocument,
  getMediaFile,
  sendApplicationEmail,
  yookassaWebhook,
  paymentReturnHandler,
  getApplicationByAppointmentId,
  updatePrescription,
  updateConclusion,
  getMediaById,
  saveFollowUp,
  updateHistoryForm,
  verifyHistoryField,
  getMedicalHistoryByEmailForDoctors,
  updateCommentForDoctors,
  addCommentForDoctors,
  deleteCommentForDoctors,
  addDescriptionForDoctors,
  addConclusionForDoctors,
  updateVerificationStatusForDoctors,
  getAppointmentsByDoctorEmail,
  getAppointmentsByAssistantEmail,
  getCalendarApplications,
  getByApplicationId,
  getByPatientEmail,
  addCommentAssistant,
  updateCommentAssistant,
  deleteCommentAssistant,
  updatePrescriptionAssistant,
  updateConclusionAssistant,
  getAssistantAppointments,
  getResultFile,
  updateFollowUp,
  getCalendar,
  patchApplication,
  deleteApplication,
  uploadTestResult,
  getTestResult,
  addFollowUpAppointment,
  getApplicationsForCalendar,
  getCalendarDataForDoctors: getApplicationsForCalendar,
  updateHistoryFormForDoctor,
};
