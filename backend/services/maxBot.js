const axios = require("axios");

class MaxBotService {
  constructor() {
    this.apiUrl = process.env.MAX_BOT_API_URL || "https://api.max.com/v1";
    this.apiToken = process.env.MAX_BOT_TOKEN;
    this.chatId = process.env.MAX_BOT_CHAT_ID;
    this.contactChatId = process.env.MAX_BOT_CONTACT_CHAT_ID;

    this.initializeBot();
  }

  initializeBot() {
    try {
      if (!this.apiToken) {
        return;
      }
    } catch (error) {
      // Bot initialization failed
    }
  }

  async sendMessage(chatId, message) {
    if (!this.apiToken) {
      return false;
    }

    try {
      const response = await axios.post(
        `${this.apiUrl}/messages?chat_id=${chatId}`,
        {
          text: message,
          format: "html",
        },
        {
          headers: {
            Authorization: this.apiToken,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data?.message ? true : false;
    } catch (error) {
      return false;
    }
  }

  async sendBookingNotification(booking) {
    try {
      const message = this.formatBookingMessage(booking);
      const chatId = this.chatId;

      if (!chatId) {
        return false;
      }

      return await this.sendMessage(chatId, message);
    } catch (error) {
      return false;
    }
  }

  async sendPaymentNotification(booking, paymentStatus) {
    try {
      const message = this.formatPaymentMessage(booking, paymentStatus);
      const chatId = this.chatId;

      if (!chatId) {
        return false;
      }

      return await this.sendMessage(chatId, message);
    } catch (error) {
      return false;
    }
  }

  async sendErrorNotification(errorMessage, context = null) {
    try {
      const message = this.formatErrorMessage(errorMessage, context);
      const chatId = this.chatId;

      if (!chatId) {
        return false;
      }

      return await this.sendMessage(chatId, message);
    } catch (error) {
      return false;
    }
  }

  async sendContactUsNotification(contact) {
    try {
      const message = this.formatContactUsMessage(contact);
      const chatId = this.contactChatId || this.chatId;

      if (!chatId) {
        return false;
      }

      return await this.sendMessage(chatId, message);
    } catch (error) {
      return false;
    }
  }

  async sendPatientCoordinationNotification(formData) {
    try {
      const message = this.formatPatientCoordinationMessage(formData);
      const chatId = this.contactChatId || this.chatId;

      if (!chatId) {
        return false;
      }

      return await this.sendMessage(chatId, message);
    } catch (error) {
      return false;
    }
  }

  async sendPhoneContactNotification(contact) {
    try {
      const message = this.formatPhoneContactMessage(contact);
      const chatId = this.contactChatId || this.chatId;

      if (!chatId) {
        return false;
      }

      return await this.sendMessage(chatId, message);
    } catch (error) {
      return false;
    }
  }

  async sendComplicatedCasesNotification(formData) {
    try {
      const message = this.formatComplicatedCasesMessage(formData);
      const chatId = this.contactChatId || this.chatId;

      if (!chatId) {
        return false;
      }

      return await this.sendMessage(chatId, message);
    } catch (error) {
      return false;
    }
  }

  async sendVacancyContactNotification(contactData) {
    try {
      const message = this.formatVacancyContactMessage(contactData);
      const chatId = this.contactChatId || this.chatId;

      if (!chatId) {
        return false;
      }

      return await this.sendMessage(chatId, message);
    } catch (error) {
      return false;
    }
  }

  formatBookingMessage(booking) {
    const {
      customer,
      appointmentDate,
      package: pkg,
      bookingNumber,
      invoiceNumber,
      createdAt,
    } = booking;

    const date = new Date(createdAt).toLocaleString("ru-RU");
    const appointmentDateFormatted = appointmentDate 
      ? new Date(appointmentDate).toLocaleDateString("ru-RU")
      : "Не указана";

    return `
<b>🔔 НОВАЯ БРОНЬ ПОЛУЧЕНА</b>

<b>Детали брони:</b>
• Номер счета: ${invoiceNumber}
• Дата создания: ${date}
• Дата приёма: ${appointmentDateFormatted}

<b>Информация о клиенте:</b>
• ФИО: ${customer.lastName} ${customer.firstName} ${customer.middleName || ""}
• Почта: ${customer.email}
• Телефон: ${customer.phone}
${customer.company ? `• Компания: ${customer.company}` : ""}
${customer.notes ? `• Примечания: ${customer.notes}` : ""}

<b>Выбранный пакет:</b>
• Пакет: ${pkg.name}
• Цена: ${pkg.price?.toLocaleString('ru-RU')} ${pkg.currency || "RUB"}
${pkg.description ? `• Описание: ${pkg.description}` : ""}

${booking.addOns && booking.addOns.length > 0 ? `
<b>Дополнительные опции:</b>
${booking.addOns.map(a => `• ${a.name} — ${a.price?.toLocaleString('ru-RU')} ₽`).join('\n')}
` : ''}

${booking.totalAmount ? `<b>Итого:</b> ${booking.totalAmount.toLocaleString('ru-RU')} ₽` : `<b>Итого:</b> ${(pkg.price || 0).toLocaleString('ru-RU')} ${pkg.currency || 'RUB'}`}

<b>Статус оплаты:</b> ${booking.payment.status.toUpperCase()}
<b>Ссылка на оплату:</b> ${booking.payment.paymentLink || "Не сгенерирована"}

`;
  }

  formatPaymentMessage(booking, paymentStatus) {
    const {
      customer,
      package: pkg,
      bookingNumber,
      invoiceNumber,
      payment,
    } = booking;

    const statusText =
      paymentStatus === "paid" ? "УСПЕШНО ОПЛАЧЕНО" : "ОШИБКА ОПЛАТЫ";
    const paidAt = payment.paidAt
      ? new Date(payment.paidAt).toLocaleString("ru-RU")
      : "Н/Д";

    return `
<b>💳 ОПЛАТА: ${statusText}</b>

<b>Детали брони:</b>
• Номер счета: ${invoiceNumber}
• Время оплаты: ${paidAt}

<b>Клиент:</b>
• ФИО: ${customer.lastName} ${customer.firstName} ${customer.middleName || ""}
• Почта: ${customer.email}

<b>Пакет:</b>
• ${pkg.name} — ${pkg.price?.toLocaleString('ru-RU')} ${pkg.currency || "RUB"}

${booking.addOns && booking.addOns.length > 0 ? `<b>Доп. опции:</b>
${booking.addOns.map(a => `• ${a.name} — ${a.price?.toLocaleString('ru-RU')} ₽`).join('\n')}
` : ''}

• <b>Итого:</b> ${(booking.totalAmount || pkg.price || 0).toLocaleString('ru-RU')} ₽

<b>ID транзакции:</b> ${payment.transactionId || "Н/Д"}

${paymentStatus === "paid"
      ? "✅ Оплата успешно получена!"
      : "❌ Оплата не прошла или отменена."
    }
`;
  }

  formatErrorMessage(errorMessage, context = null) {
    const timestamp = new Date().toLocaleString("ru-RU");

    let message = `
<b>⚠️ ОШИБКА СИСТЕМЫ</b>

<b>Сообщение об ошибке:</b>
${errorMessage}

<b>Время:</b> ${timestamp}
`;

    if (context) {
      message += `\n<b>Контекст:</b>\n`;
      for (const [key, value] of Object.entries(context)) {
        message += `• ${key}: ${value}\n`;
      }
    }

    message += `\n<b>Рекомендуемое действие:</b> Проверить логи и систему.`;

    return message;
  }

  formatContactUsMessage(contact) {
    const {
      firstName,
      lastName,
      middleName,
      email,
      phoneNumber,
      city,
      message,
      whatsapp,
      telegram,
      max
    } = contact;

    const timestamp = new Date().toLocaleString("ru-RU");
    const fullName = [lastName, firstName, middleName].filter(Boolean).join(" ").trim() || "Имя не указано";

    return `
<b>📬 НОВАЯ ЗАЯВКА - ОБРАТНАЯ СВЯЗЬ</b>

<b>Время:</b> ${timestamp}

<b>Информация о клиенте:</b>
• ФИО: ${fullName}
• Почта: ${email}
• Телефон: ${phoneNumber}
• Город: ${city}

<b>Предпочитаемые каналы связи:</b>
${whatsapp ? "• WhatsApp: ✅" : ""}
${telegram ? "• Telegram: ✅" : ""}
${max ? "• MAX: ✅" : ""}

<b>Сообщение:</b>
${message || "Нет сообщения"}
`;
  }

  formatPatientCoordinationMessage(formData) {
    const {
      firstName,
      lastName,
      middleName,
      email,
      phoneNumber,
      city,
      message,
      whatsapp,
      telegram,
      max
    } = formData;

    const timestamp = new Date().toLocaleString("ru-RU");
    const fullName = [lastName, firstName, middleName].filter(Boolean).join(" ").trim() || "Имя не указано";

    return `
<b>👨‍⚕️ ЗАЯВКА НА КООРДИНАЦИЮ ПАЦИЕНТА</b>

<b>Время:</b> ${timestamp}

<b>Информация о пациенте:</b>
• ФИО: ${fullName}
• Почта: ${email}
• Телефон: ${phoneNumber}
• Город: ${city}

<b>Предпочитаемые каналы связи:</b>
${whatsapp ? "• WhatsApp: ✅" : ""}
${telegram ? "• Telegram: ✅" : ""}
${max ? "• MAX: ✅" : ""}

<b>Запрос:</b>
${message || "Нет сообщения"}
`;
  }

  formatPhoneContactMessage(contact) {
    const timestamp = new Date().toLocaleString("ru-RU");

    return `
<b>📞 ЗАПРОС ОБРАТНОГО ЗВОНКА</b>

<b>Время:</b> ${timestamp}

<b>Информация:</b>
• Телефон: ${contact.phoneNumber || "Не указан"}
• Имя: ${contact.name || "Не указано"}

<b>Статус:</b> Ожидает обработки
`;
  }

  formatComplicatedCasesMessage(formData) {
    const {
      firstName,
      lastName,
      middleName,
      email,
      phoneNumber,
      city,
      message,
      whatsapp,
      telegram,
      max
    } = formData;

    const timestamp = new Date().toLocaleString("ru-RU");
    const fullName = [lastName, firstName, middleName].filter(Boolean).join(" ").trim() || "Имя не указано";

    return `
<b>🏥 ЗАЯВКА НА СЛОЖНЫЙ СЛУЧАЙ</b>

<b>Время:</b> ${timestamp}

<b>Информация о пациенте:</b>
• ФИО: ${fullName}
• Почта: ${email}
• Телефон: ${phoneNumber}
• Город: ${city}

<b>Предпочитаемые каналы связи:</b>
${whatsapp ? "• WhatsApp: ✅" : ""}
${telegram ? "• Telegram: ✅" : ""}
${max ? "• MAX: ✅" : ""}

<b>Описание случая:</b>
${message || "Нет описания"}
`;
  }

  formatVacancyContactMessage(contactData) {
    const {
      name,
      email,
      phone,
      vacancyTitle,
      message,
      resumeFileName
    } = contactData;

    const timestamp = new Date().toLocaleString("ru-RU");

    return `
<b>💼 ОТКЛИК НА ВАКАНСИЮ</b>

<b>Время:</b> ${timestamp}

<b>Вакансия:</b> ${vacancyTitle || "Не указана"}

<b>Информация о кандидате:</b>
• Имя: ${name}
• Почта: ${email}
• Телефон: ${phone}

${resumeFileName ? `<b>Резюме:</b> ${resumeFileName}` : ""}

${message ? `<b>Сообщение:</b>\n${message}` : ""}
`;
  }

  async checkStatus() {
    if (!this.apiToken) {
      return { online: false, message: "Bot not initialized - token missing" };
    }

    try {
      const response = await axios.get(`${this.apiUrl}/bot/status`, {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
        },
      });

      return {
        online: true,
        message: "Bot is running",
        data: response.data,
      };
    } catch (error) {
      return {
        online: false,
        message: `Status check failed: ${error.message}`,
      };
    }
  }

  async sendTestMessage() {
    try {
      const chatId = this.chatId;

      if (!chatId) {
        return false;
      }

      const message = 
        "<b>✅ ТЕСТОВОЕ СООБЩЕНИЕ</b>\n\n" +
        "Бот Max Messenger для уведомлений работает корректно.\n" +
        `Время: ${new Date().toLocaleString("ru-RU")}\n` +
        "Все системы в норме.";

      return await this.sendMessage(chatId, message);
    } catch (error) {
      return false;
    }
  }
}

const maxBot = new MaxBotService();
module.exports = maxBot;
