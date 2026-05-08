const { transporter } = require('../../utils/emailService');
const crypto = require("crypto");
const CorporateRegister = require("../../models/website/CorporateRegister");

const generatePassword = () => crypto.randomBytes(10).toString("base64url").slice(0, 12);


const sendCorporateWelcomeEmail = async ({ email, hrName, link, password }) => {
  const formUrl = `https://forms.sophos-med.ru/${link}`;
  const resultsUrl = `https://forms.sophos-med.ru/${link}/results`;

  const mailOptions = {
    from: "Медицинский центр СОФОС",
    to: email,
    subject: "Доступ к корпоративной форме",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
          .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1e40af; }
          .credential-label { font-weight: normal; color: #64748b; margin-bottom: 5px; }
          .credential-value { font-weight: bold; font-size: 16px; color: #1e293b; margin-bottom: 15px; }
          .btn { display: inline-block; background: #1e40af; color: #ffffff !important; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 8px 4px; }
          .footer { text-align: center; margin-top: 20px; color: #64748b; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>СОФОС</h1>
          </div>
          <div class="content">
            <p>Уважаемый(-ая) ${hrName},</p>
            <p>Корпоративная форма была успешно создана. Ниже указаны ваши данные для доступа:</p>

            <div class="credentials">
              <div class="credential-label">Ссылка на форму:</div>
              <div class="credential-value"><a href="${formUrl}">${formUrl}</a></div>
              <div class="credential-label">Ссылка на результаты:</div>
              <div class="credential-value"><a href="${resultsUrl}">${resultsUrl}</a></div>
              <div class="credential-label">Электронная почта:</div>
              <div class="credential-value">${email}</div>
              <div class="credential-label">Пароль:</div>
              <div class="credential-value">${password}</div>
            </div>

            <div style="text-align: center;">
              <a href="${formUrl}" class="btn">Открыть форму</a>
              <a href="${resultsUrl}" class="btn">Просмотр результатов</a>
            </div>

            <div class="footer">
              <p>С уважением,<br><strong>Команда СОФОС</strong></p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
};

exports.createCorporateRegistration = async (req, res) => {
  try {
    const plainPassword = generatePassword();
    const record = await CorporateRegister.create({ ...req.body, password: plainPassword });

    const hrName = [record.hr.lastName, record.hr.firstName, record.hr.middleName].filter(Boolean).join(" ");
    try {
      await sendCorporateWelcomeEmail({
        email: record.email,
        hrName,
        link: record.link,
        password: plainPassword,
      });
    } catch (emailError) {
      console.error("Failed to send corporate welcome email:", emailError.message);
    }

    res.status(201).json({
      message: "Corporate registration created successfully",
      data: record,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getAllCorporateRegistrations = async (req, res) => {
  try {
    const records = await CorporateRegister.find().sort({ createdAt: -1 });
    res.status(200).json({ data: records });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getCorporateRegistrationByLink = async (req, res) => {
  try {
    const { link } = req.params;
    const record = await CorporateRegister.findOne({ link });
    if (!record) return res.status(404).json({ message: "Form not found" });
    res.status(200).json({ data: record });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateCorporateRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await CorporateRegister.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (!record) return res.status(404).json({ message: "Record not found" });
    res.status(200).json({ data: record });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteCorporateRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await CorporateRegister.findByIdAndDelete(id);
    if (!record) return res.status(404).json({ message: "Record not found" });
    res.status(200).json({ message: "Record deleted successfully" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
