const nodemailer = require("nodemailer");
const CorporateFormRegistration = require("../../models/website/CorporateFormRegistration");
const CorporateRegister = require("../../models/website/CorporateRegister");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: { rejectUnauthorized: false },
});

// Generate coupon: SPH-<COMPANYSHORT>-<4 random digits>
const generateCoupon = (corporateName) => {
  const companyShort = corporateName
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 8);
  const numbers = Math.floor(1000 + Math.random() * 9000);
  return `SPH-${companyShort}-${numbers}`;
};

const sendConfirmationEmail = async ({ email, firstName, lastName, couponCode, discountPercentage, corporateName, lang }) => {
  const isRu = lang === "ru";

  const subject = isRu
    ? "Ваш код купона — СОФОС"
    : "Your Coupon Code — SOPHOS";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 560px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%); color: white; padding: 28px 32px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 22px; }
        .content { background: #f8fafc; padding: 28px 32px; border-radius: 0 0 12px 12px; }
        .coupon-box { background: #fff; border: 2px dashed #1e40af; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0; }
        .coupon-code { font-size: 28px; font-weight: 800; font-family: monospace; color: #1e40af; letter-spacing: 0.08em; }
        .discount { background: #eff6ff; color: #1e40af; border-radius: 20px; padding: 4px 14px; display: inline-block; font-weight: 700; font-size: 14px; margin-top: 8px; }
        .btn { display: inline-block; background: #1e40af; color: #fff !important; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; margin-top: 20px; }
        .footer { text-align: center; margin-top: 20px; color: #94a3b8; font-size: 13px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${isRu ? "СОФОС" : "SOPHOS"}</h1>
          <p style="margin:8px 0 0; opacity:0.85;">${corporateName}</p>
        </div>
        <div class="content">
          <p>${isRu ? `Уважаемый(-ая) ${lastName} ${firstName},` : `Dear ${firstName} ${lastName},`}</p>
          <p>${isRu ? "Вы успешно зарегистрировались. Ваш персональный код купона:" : "You have successfully registered. Your personal coupon code is:"}</p>

          <div class="coupon-box">
            <div class="coupon-code">${couponCode}</div>
            ${discountPercentage > 0 ? `<div class="discount">${discountPercentage}% ${isRu ? "скидка" : "discount"}</div>` : ""}
          </div>

          <p>${isRu
            ? `Используйте этот код при записи на приём, чтобы получить скидку <strong>${discountPercentage}%</strong> на услуги.`
            : `Use this code when booking an appointment to receive a <strong>${discountPercentage}%</strong> discount on services.`
          }</p>

          <div style="text-align:center;">
            <a href="https://ed.sophos-med.ru" class="btn">
              ${isRu ? "Записаться на приём" : "Book an Appointment"}
            </a>
          </div>

          <div class="footer">
            <p>${isRu ? "С уважением,<br><strong>Команда СОФОС</strong>" : "Best regards,<br><strong>SOPHOS Team</strong>"}</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: "Медицинский центр СОФОС",
    to: email,
    subject,
    html,
  });
};

// POST /api/corporate-form-registrations/:link — public submission
exports.submitCorporateForm = async (req, res) => {
  try {
    const { link } = req.params;
    const { email, lang } = req.body;

    const corporate = await CorporateRegister.findOne({ link });
    if (!corporate) {
      return res.status(404).json({ message: "Form not found" });
    }

    // One submission per email per form
    const existing = await CorporateFormRegistration.findOne({ formLink: link, email: email?.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({
        message: "already_registered",
        couponCode: existing.couponCode,
      });
    }

    // Generate unique coupon (retry on collision)
    let couponCode;
    let attempts = 0;
    while (!couponCode && attempts < 5) {
      const candidate = generateCoupon(corporate.corporateName);
      const exists = await CorporateFormRegistration.findOne({ couponCode: candidate });
      if (!exists) couponCode = candidate;
      attempts++;
    }

    const registration = await CorporateFormRegistration.create({
      formLink: link,
      couponCode,
      ...req.body,
      email: email?.toLowerCase().trim(),
    });

    // Send confirmation email (non-blocking)
    try {
      await sendConfirmationEmail({
        email: registration.email,
        firstName: registration.firstName,
        lastName: registration.lastName,
        couponCode: registration.couponCode,
        discountPercentage: corporate.discountPercentage,
        corporateName: corporate.corporateName,
        lang: lang || "ru",
      });
    } catch (emailErr) {
      console.error("Failed to send confirmation email:", emailErr.message);
    }

    res.status(201).json({
      message: "Registration submitted successfully",
      couponCode: registration.couponCode,
      data: registration,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// GET /api/corporate-form-registrations/:link/results — view results by link
exports.getResultsByLink = async (req, res) => {
  try {
    const { link } = req.params;

    const corporate = await CorporateRegister.findOne({ link });
    if (!corporate) {
      return res.status(404).json({ message: "Form not found" });
    }

    const results = await CorporateFormRegistration.find({ formLink: link }).sort({ createdAt: -1 });

    res.status(200).json({
      corporateName: corporate.corporateName,
      discountPercentage: corporate.discountPercentage,
      password: corporate.password,
      data: results,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// GET /api/corporate-form-registrations — protected, get all submissions (admin)
exports.getAllSubmissions = async (req, res) => {
  try {
    const results = await CorporateFormRegistration.find().sort({ createdAt: -1 });
    res.status(200).json({ data: results });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// DELETE /api/corporate-form-registrations/:id — protected
exports.deleteSubmission = async (req, res) => {
  try {
    const record = await CorporateFormRegistration.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ message: "Record not found" });
    res.status(200).json({ message: "Deleted successfully" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
