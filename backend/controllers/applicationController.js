const Application = require("../models/Application");
const Media = require("../models/Media");
const Patient = require("../models/Patient");
const DoctorsProfile = require("../models/DoctorsProfile");
const User = require("../models/User");
const Counter = require("../models/Counter");
const mongoose = require("mongoose");
const { gfsMedia } = require("../gridfs-media");
const { v4: uuidv4 } = require("uuid");
const nodemailer = require("nodemailer");
const { ObjectId } = mongoose.Types;

const https = require("https");
const fs = require("fs");
const path = require("path");
const tls = require("tls");

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
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

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
    email: application.patientEmail,
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

    const application = await Application.findOne({ applicationId: id });
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    if (!req.body?.url) {
      return res.status(400).json({ message: "URL is required" });
    }

    const filename = req.body.filename || "Cloud Link";
    const url = req.body.url.trim();

    application.documents.push({
      filename,
      fileId: null,
      url,
      verificationStatus: "Verified",
      uploadedAt: new Date(),
    });

    await application.save();

    res.status(201).json({
      message: "URL uploaded successfully",
      applicationId: application.applicationId,
      documents: application.documents,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
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
      .json({ message: "Failed to fetch user ID", error: error.message });
  }
}

// Get all applications for a patient by email (for medical history)
async function getMedicalHistoryByEmail(req, res) {
  try {
    const { email } = req.params;

    const applications = await Application.find({ patientEmail: email })
      .sort({ createdAt: -1 })
      .lean();

    for (let app of applications) {
      app.applicationId = app.applicationId || app._id;
      try {
        app.patient = await Patient.findOne({ email: app.patientEmail })
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
      message: "Failed to fetch medical history",
      error: error.message,
    });
  }
}

// Get applications by patient email
async function getApplicationsByPatientEmail(req, res) {
  try {
    const { email } = req.params;
    const applications = await Application.find({ patientEmail: email })
      .sort({ date: -1 })
      .lean();

    for (let app of applications) {
      app.applicationId = app.applicationId || app._id;
      app.patient = await Patient.findOne({ email: app.patientEmail })
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
      .json({ message: "Failed to fetch applications", error: error.message });
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
    res.status(500).json({ message: "Failed to fetch monthly counts", error: error.message });
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

      app.patient = await Patient.findOne({ email: app.patientEmail })
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
    res.status(500).json({ message: "Server Error", error: error.message });
  }
}

// Get a single application by ID
async function getApplicationById(req, res) {
  try {
    const id = decodeURIComponent(req.params.id);
    await migrateHistoryFormLegacy(id);

    const application = await Application.findOne({ applicationId: id });
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    application.applicationId = application.applicationId || application._id;
    application.patient = await Patient.findOne({
      email: application.patientEmail,
    })
      .select("firstName middleName lastName email phoneNumber _id")
      .lean();
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
      req.body.patientEmail &&
      req.body.patientEmail !== application.patientEmail
    ) {
      const patient = await User.findOne({
        email: req.body.patientEmail,
        role: "patient",
      });
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      application.patientEmail = req.body.patientEmail;
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
            (req.body.patientEmail && user.email !== req.body.patientEmail)
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

    await application.save();

    const populatedApplication = await buildPopulatedApplication(application);

    res.json(populatedApplication);
  } catch (error) {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid application ID" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
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

      const matchingPatients = await Patient.find(patientQuery).select("email");
      const patientEmails = matchingPatients.map((p) => p.email);

      query.$or = [
        { applicationId: { $regex: search, $options: "i" } },
        { patientEmail: { $in: patientEmails } },
        { patientEmail: { $regex: search, $options: "i" } },
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
      app.patient = await Patient.findOne({ email: app.patientEmail })
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

// Create a new application
async function createApplication(req, res) {
  try {
    const { patientEmail, doctors, serviceOrders } = req.body;

    const patient = await User.findOne({
      email: patientEmail,
      role: "patient",
    });
    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    // Validate doctors array
    if (!doctors || doctors.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one doctor is required" });
    }

    // Validate each doctor in the doctors array
    for (const doctorEntry of doctors) {
      if (doctorEntry.doctorEmail) {
        const doctor = await DoctorsProfile.findOne({
          email: doctorEntry.doctorEmail,
        });
        if (!doctor) {
          return res
            .status(404)
            .json({
              message: `Doctor with email ${doctorEntry.doctorEmail} not found`,
            });
        }
      } else {
      }
    }

    // validate serviceOrders
    if (serviceOrders && serviceOrders.length > 0) {
      for (const serviceOrder of serviceOrders) {
        // Use patient._id for userId if not provided
        if (!serviceOrder.userId && !serviceOrder.email) {
          serviceOrder.userId = patient._id;
        } else if (serviceOrder.email) {
          // If email is provided, use patient._id
          serviceOrder.userId = patient._id;
          delete serviceOrder.email; // Remove email field, keep userId
        } else if (serviceOrder.userId) {
          // Validate userId if provided
          if (typeof serviceOrder.userId === "object") {
            return res
              .status(400)
              .json({ message: "Invalid userId format in serviceOrders" });
          }

          try {
            const user = await User.findById(serviceOrder.userId);
            if (
              !user ||
              user.role !== "patient" ||
              user.email !== patientEmail
            ) {
              return res
                .status(400)
                .json({ message: "Invalid userId in serviceOrders" });
            }
          } catch (err) {
            return res.status(400).json({ message: "Invalid userId format" });
          }
        }
      }
    }

    // ---------- COUNTER LOGIC ----------
    const date = new Date();
    const monthYear = `${(date.getMonth() + 1)
      .toString()
      .padStart(2, "0")}/${date.getFullYear()}`;
    let counter = await Counter.findOne({ name: "applicationId" });

    if (!counter || counter.monthYear !== monthYear) {
      counter = await Counter.findOneAndUpdate(
        { name: "applicationId" },
        {
          $set: {
            name: "applicationId",
            monthlyCount: 1,
            overallCount: counter ? counter.overallCount + 1 : 1,
            monthYear,
          },
        },
        { new: true, upsert: true },
      );
    } else {
      counter = await Counter.findOneAndUpdate(
        { name: "applicationId", monthYear },
        { $inc: { monthlyCount: 1, overallCount: 1 } },
        { new: true },
      );
    }

    if (!counter)
      throw new Error("Failed to create or update counter document");

    const applicationId = `HD-R${counter.monthlyCount
      .toString()
      .padStart(3, "0")}-${monthYear}-${counter.overallCount
      .toString()
      .padStart(4, "0")}`;

    // ---------- PAYMENT LOGIC ----------
    // Payment creation is now handled separately by the frontend via addPayment endpoint
    // Do NOT automatically create payments here to avoid duplicates
    let payments = [];

    // ---------- APPLICATION CREATION ----------
    const applicationData = {
      applicationId,
      patientEmail,
      doctors: doctors || [],
      serviceType: req.body.serviceType,
      branch: req.body.branch || "",
      appointmentStatus: req.body.appointmentStatus,
      date: req.body.date,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      payments,
      comments: req.body.comments || [],
      documents: req.body.documents || [],
      serviceOrders: serviceOrders || [],
    };

    const application = new Application(applicationData);
    await application.save();

    // ---------- POPULATE (your existing population logic) ----------
    const populatedApplication = application.toObject();
    populatedApplication.patient = await Patient.findOne({
      email: patientEmail,
    })
      .select("firstName middleName lastName email phoneNumber _id")
      .lean();

    // Populate all doctors
    if (doctors && doctors.length > 0) {
      populatedApplication.doctorProfiles = await Promise.all(
        doctors.map(async (d) => {
          const doctorProfile = await DoctorsProfile.findOne({
            email: d.doctorEmail,
          })
            .select(
              "firstName middleName lastName specialty email phoneNumber _id",
            )
            .lean();
          return doctorProfile;
        }),
      );
    }

    res.status(201).json(populatedApplication);
  } catch (error) {
    // Send user-friendly error messages
    let errorMessage = "Failed to create application";

    if (error.name === "CastError") {
      errorMessage = "Invalid data format. Please check your input.";
    } else if (error.name === "ValidationError") {
      errorMessage = "Validation failed. Please check required fields.";
    } else if (error.message) {
      // Use the error message if it's descriptive
      if (
        error.message.includes("not found") ||
        error.message.includes("required")
      ) {
        errorMessage = error.message;
      }
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
      finalAmount: finalAmount ?? parsedAmount,
      paymentMethod,
      paymentType,
      items: items.map((item) => ({
        name: item.name,
        amount: Number(item.amount),
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
          Object.entries(options.headers).forEach(([key, value]) => {});

          const req = https.request(options, (res) => {
            // Log response headers
            Object.entries(res.headers).forEach(([key, value]) => {});

            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
              console.log("[VTB] Token response status:", res.statusCode);
              console.log(
                "[VTB] Token response body:",
                data.substring(0, 200) + (data.length > 200 ? "..." : ""),
              );
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
          console.log(
            "[VTB] Order request headers:",
            JSON.stringify({
              ...headers,
              Authorization: "Bearer ***" + accessToken.slice(-10),
            }),
          );

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
            Object.entries(res.headers).forEach(([key, value]) => {});

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
      message: "Failed to create payment",
      error: error.message,
    });
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
      } catch (err) {}
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
    const gfs = gfsMedia();
    const file = await gfs
      .find({ _id: new mongoose.Types.ObjectId(req.params.id) })
      .toArray();
    if (!file || file.length === 0) {
      return res.status(404).json({ message: "Media not found" });
    }

    const readStream = gfs.openDownloadStream(file[0]._id);
    res.set("Content-Type", file[0].contentType);
    res.set("Content-Disposition", `inline; filename="${file[0].filename}"`);
    readStream.pipe(res);
  } catch (error) {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid media ID" });
    }
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
      .json({ message: "Failed to send email", error: error.message });
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
    application.patient = await Patient.findOne({
      email: application.patientEmail,
    })
      .select("firstName middleName lastName email phoneNumber _id")
      .lean();
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
    res.status(500).json({ message: "Server error", error: error.message });
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
      .json({ message: "Failed to update prescription", error: error.message });
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
      .json({ message: "Failed to update conclusion", error: error.message });
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
    const id = decodeURIComponent(req.params.id);
    const { historyForm } = req.body;

    if (!historyForm || typeof historyForm !== "object") {
      return res
        .status(400)
        .json({ message: "historyForm object is required" });
    }

    const allowedKeys = [
      "isFirstAppointment",
      "isRepetitiveAppointment",
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
    for (const key of allowedKeys) {
      if (key in historyForm) {
        update[`historyForm.${key}`] = historyForm[key];
      }
    }

    const application = await Application.findOneAndUpdate(
      { applicationId: id },
      { $set: update },
      { new: true, runValidators: true },
    );

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    try {
      const io = req.app.get("io");
      io.emit("application:history-updated", {
        applicationId: id,
        historyForm: application.historyForm,
      });
    } catch (socketError) {}

    return res.status(200).json({
      message: "History form updated successfully",
      historyForm: application.historyForm,
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
    } catch (socketError) {}

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

module.exports = {
  uploadDocumentFile,
  uploadDocumentUrl,
  getUserIdByEmail,
  getMedicalHistoryByEmail,
  getApplicationsByPatientEmail,
  getApplicationsByDate,
  getApplicationCountsByMonth,
  getApplicationById,
  updateApplication,
  getAllApplications,
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
};
