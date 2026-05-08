"use strict";

/**
 * utils/emailService.js
 *
 * Single shared Nodemailer transporter and role-specific account-creation
 * email helpers.  All subjects and HTML content are identical to what was
 * previously duplicated in each individual controller.
 */

const nodemailer = require("nodemailer");

// ── Shared transporter ───────────────────────────────────────────────────────
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

// ── Shared CSS (identical across every controller template) ──────────────────
const EMAIL_STYLES = `
  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
  .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
  .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1e40af; }
  .credential-label { font-weight: normal; color: #64748b; margin-bottom: 5px; }
  .credential-value { font-weight: bold; font-size: 16px; color: #1e293b; margin-bottom: 15px; }
  .login-button { display: inline-block; background: #1e40af; color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
  .login-button:hover { background: #1e3a8a; }
  .footer { text-align: center; margin-top: 20px; color: #64748b; font-size: 14px; }
`;

// ── Generic HTML builder ─────────────────────────────────────────────────────
/**
 * Build the bilingual account-creation HTML body.
 *
 * @param {string} lang          - 'en' | 'ru'
 * @param {object} opts
 * @param {string} opts.fullName
 * @param {string} opts.email
 * @param {string} opts.password
 * @param {string} opts.loginLink
 * @param {string} opts.roleLabelEn  - e.g. "Doctor (Врач)"
 * @param {string} opts.roleLabelRu  - e.g. "Врача"
 */
function buildAccountCreationHtml(lang, { fullName, email, password, loginLink, roleLabelEn, roleLabelRu }) {
  if (lang === "ru") {
    return `<!DOCTYPE html>
<html>
<head>
  <style>${EMAIL_STYLES}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Добро пожаловать в СОФОС</h1>
    </div>
    <div class="content">
      <p>Уважаемый(-ая) ${fullName},</p>
      <p>Ваш аккаунт <strong>${roleLabelRu}</strong> был успешно создан. Ниже указаны ваши учетные данные для входа:</p>
      <div class="credentials">
        <div class="credential-label">Электронная почта:</div>
        <div class="credential-value">${email}</div>
        <div class="credential-label">Пароль:</div>
        <div class="credential-value">${password}</div>
      </div>
      <p>Нажмите на кнопку ниже, чтобы войти в свой аккаунт:</p>
      <div style="text-align: center;">
        <a href="${loginLink}" class="login-button">Войти</a>
      </div>
      <p style="color: #64748b; font-size: 14px;">Или скопируйте и вставьте эту ссылку: ${loginLink}</p>
      <p style="color: #ef4444; font-weight: bold;">Важно: Пожалуйста, смените пароль после первого входа в систему из соображений безопасности.</p>
      <div class="footer">
        <p>С уважением,<br><strong>Команда СОФОС</strong></p>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  // Default: English
  return `<!DOCTYPE html>
<html>
<head>
  <style>${EMAIL_STYLES}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to SOPHOS</h1>
    </div>
    <div class="content">
      <p>Dear ${fullName},</p>
      <p>Your <strong>${roleLabelEn}</strong> account has been successfully created. Below are your login credentials:</p>
      <div class="credentials">
        <div class="credential-label">Email:</div>
        <div class="credential-value">${email}</div>
        <div class="credential-label">Password:</div>
        <div class="credential-value">${password}</div>
      </div>
      <p>Click the button below to log in to your account:</p>
      <div style="text-align: center;">
        <a href="${loginLink}" class="login-button">Log In Now</a>
      </div>
      <p style="color: #64748b; font-size: 14px;">Or copy and paste this link: ${loginLink}</p>
      <p style="color: #ef4444; font-weight: bold;">Important: Please change your password after your first login for security purposes.</p>
      <div class="footer">
        <p>С уважением,<br><strong>Команда СОФОС</strong></p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ── Generic low-level sender ─────────────────────────────────────────────────
/**
 * Send an account-creation email.
 *
 * @param {object} opts
 * @param {string} opts.to            - recipient address
 * @param {string} opts.password      - plaintext password
 * @param {string} opts.fullName      - recipient full name
 * @param {string} opts.lang          - 'en' | 'ru'
 * @param {string} opts.subjectEn     - English subject line
 * @param {string} opts.subjectRu     - Russian subject line
 * @param {string} opts.roleLabelEn   - English role label for body
 * @param {string} opts.roleLabelRu   - Russian role label for body
 * @param {string} opts.loginLink     - portal URL
 */
async function sendAccountCreationEmail({
  to,
  password,
  fullName,
  lang = "en",
  subjectEn,
  subjectRu,
  roleLabelEn,
  roleLabelRu,
  loginLink,
}) {
  const subject = lang === "ru" ? subjectRu : subjectEn;
  const html = buildAccountCreationHtml(lang, {
    fullName,
    email: to,
    password,
    loginLink,
    roleLabelEn,
    roleLabelRu,
  });

  await transporter.sendMail({
    from: `"Медицинский центр СОФОС" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
}

// ── Role-specific wrappers ───────────────────────────────────────────────────

/** Doctor account created — portal: doctor.health-direct.ru */
async function sendDoctorAccountEmail(to, password, fullName, lang = "en") {
  return sendAccountCreationEmail({
    to,
    password,
    fullName,
    lang,
    subjectEn: "Your Doctor Account Has Been Created",
    subjectRu: "Ваш аккаунт врача создан",
    roleLabelEn: "Doctor (Врач)",
    roleLabelRu: "Врача",
    loginLink: "https://doctor.health-direct.ru/",
  });
}

/** Assistant account created — portal: assistant.health-direct.ru */
async function sendAssistantAccountEmail(to, password, fullName, lang = "en") {
  return sendAccountCreationEmail({
    to,
    password,
    fullName,
    lang,
    subjectEn: "Your Assistant Account Has Been Created",
    subjectRu: "Ваш аккаунт ассистента создан",
    roleLabelEn: "Assistant (Ассистент)",
    roleLabelRu: "Ассистента",
    loginLink: "https://assistant.health-direct.ru/",
  });
}

/** Head Doctor account created — portal: doctor.health-direct.ru */
async function sendHeadDoctorAccountEmail(to, password, fullName, lang = "en") {
  return sendAccountCreationEmail({
    to,
    password,
    fullName,
    lang,
    subjectEn: "Your Head Doctor Account Has Been Created",
    subjectRu: "Ваш аккаунт главного врача создан",
    roleLabelEn: "Head Doctor (Главный врач)",
    roleLabelRu: "Главного врача",
    loginLink: "https://doctor.health-direct.ru/",
  });
}

/** Head Assistant account created — portal: assistant.health-direct.ru */
async function sendHeadAssistantAccountEmail(to, password, fullName, lang = "en") {
  return sendAccountCreationEmail({
    to,
    password,
    fullName,
    lang,
    subjectEn: "Your Head Assistant Account Has Been Created",
    subjectRu: "Ваш аккаунт старшего ассистента создан",
    roleLabelEn: "Head Assistant (Старший ассистент)",
    roleLabelRu: "Старшего ассистента",
    loginLink: "https://assistant.health-direct.ru/",
  });
}

/** Specialist account created — portal: doctor.health-direct.ru */
async function sendSpecialistAccountEmail(to, password, fullName, lang = "en") {
  return sendAccountCreationEmail({
    to,
    password,
    fullName,
    lang,
    subjectEn: "Your Specialist Account Has Been Created",
    subjectRu: "Ваш аккаунт специалиста создан",
    roleLabelEn: "Specialist (Специалист)",
    roleLabelRu: "Специалиста",
    loginLink: "https://doctor.health-direct.ru/",
  });
}

/** Manager account created — portal: manager.sophos-med.ru */
async function sendManagerAccountEmail(to, password, fullName, lang = "en") {
  return sendAccountCreationEmail({
    to,
    password,
    fullName,
    lang,
    subjectEn: "Your Manager Account Has Been Created",
    subjectRu: "Ваш аккаунт менеджера создан",
    roleLabelEn: "Manager",
    roleLabelRu: "Менеджера",
    loginLink: "https://manager.sophos-med.ru/manager-signin",
  });
}

/** Content Manager account created — portal: manager.sophos-med.ru */
async function sendContentManagerAccountEmail(to, password, fullName, lang = "en") {
  return sendAccountCreationEmail({
    to,
    password,
    fullName,
    lang,
    subjectEn: "Your Content Manager Account Has Been Created",
    subjectRu: "Ваш аккаунт Контент-менеджера был создан",
    roleLabelEn: "Content Manager",
    roleLabelRu: "Контент-менеджера",
    loginLink: "https://manager.sophos-med.ru/manager-signin",
  });
}

/**
 * Forgot-password reset email (manager portal).
 *
 * @param {string} to        - recipient email
 * @param {string} resetUrl  - password-reset URL
 * @param {string} lang      - 'en' | 'ru'
 */
async function sendForgotPasswordEmail(to, resetUrl, lang = "en") {
  const templates = {
    en: {
      subject: "Password Reset - SOPHOS Manager",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0A2E5D;">Password Reset Request</h2>
          <p>Hello,</p>
          <p>We received a request to reset your password for your SOPHOS Manager account.</p>
          <p>Click the button below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}"
               style="background-color: #0A2E5D; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block;">
               Reset Password
            </a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="color: #666; word-break: break-all;">${resetUrl}</p>
          <p><strong>This link will expire in 1 hour.</strong></p>
          <p>If you didn't request this password reset, please ignore this email and contact your administrator.</p>
          <hr style="border: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">TEAM SOPHOS</p>
        </div>`,
    },
    ru: {
      subject: "Сброс пароля - СОФОС Менеджер",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0A2E5D;">Запрос на сброс пароля</h2>
          <p>Здравствуйте,</p>
          <p>Мы получили запрос на сброс пароля для вашей учетной записи СОФОС Менеджер.</p>
          <p>Нажмите на кнопку ниже, чтобы сбросить пароль:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}"
               style="background-color: #0A2E5D; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block;">
               Сбросить пароль
            </a>
          </div>
          <p>Или скопируйте и вставьте эту ссылку в браузер:</p>
          <p style="color: #666; word-break: break-all;">${resetUrl}</p>
          <p><strong>Срок действия ссылки истекает через 1 час.</strong></p>
          <p>Если вы не запрашивали сброс пароля, проигнорируйте это письмо и свяжитесь с администратором.</p>
          <hr style="border: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">Команда СОФОС</p>
        </div>`,
    },
  };

  const tmpl = templates[lang] || templates.en;
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: tmpl.subject,
    html: tmpl.html,
  });
}

// ── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  /** The shared transporter — use in controllers that have unique email content */
  transporter,

  // Role-specific account-creation helpers
  sendDoctorAccountEmail,
  sendAssistantAccountEmail,
  sendHeadDoctorAccountEmail,
  sendHeadAssistantAccountEmail,
  sendSpecialistAccountEmail,
  sendManagerAccountEmail,
  sendContentManagerAccountEmail,

  // Other shared email flows
  sendForgotPasswordEmail,
};
