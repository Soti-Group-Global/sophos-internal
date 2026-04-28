const TelegramBot = require("node-telegram-bot-api");

class TelegramBotService {
  constructor() {
    this.bot = null;
    this.chatId = null; // Chat ID for notifications

    this.initializeBot();
  }

  initializeBot() {
    try {
      this.bot = new TelegramBot(
        process.env.TELEGRAM_BOT_TOKEN ||
        "8576347811:AAEuOGFqW44CWY56dicr2rnHe3KEixHaeJQ",
        {
          polling: false,
        }
      );

    } catch (error) {
    }
  }

  async sendBookingNotification(booking) {
    if (!this.bot) {
      return false;
    }

    try {
      const message = this.formatBookingMessage(booking);
      const chatId = process.env.TELEGRAM_CHAT_ID || this.chatId;

      if (!chatId) {
        return false;
      }

      await this.bot.sendMessage(chatId, message, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });

      return true;
    } catch (error) {
      
      // Check if group was migrated to supergroup
      if (error.response && error.response.body && error.response.body.parameters) {
        const migrateId = error.response.body.parameters.migrate_to_chat_id;
        if (migrateId) {
        }
      }
      
      return false;
    }
  }

  async sendPaymentNotification(booking, paymentStatus) {
    if (!this.bot) {
      return false;
    }

    try {
      const message = this.formatPaymentMessage(booking, paymentStatus);
      const chatId = process.env.TELEGRAM_CHAT_ID || this.chatId;

      if (!chatId) {
        return false;
      }

      await this.bot.sendMessage(chatId, message, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });

      return true;
    } catch (error) {
      return false;
    }
  }

  async sendErrorNotification(errorMessage, context = null) {
    if (!this.bot) {
      return false;
    }

    try {
      const message = this.formatErrorMessage(errorMessage, context);
      const chatId = process.env.TELEGRAM_CHAT_ID || this.chatId;

      if (!chatId) {
        return false;
      }

      await this.bot.sendMessage(chatId, message, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });

      return true;
    } catch (error) {
      return false;
    }
  }

  async sendContactUsNotification(contact) {
    if (!this.bot) {
      return false;
    }

    try {
      const message = this.formatContactUsMessage(contact);
      // Use a specific group for contact us if configured, otherwise use default
      const chatId = process.env.TELEGRAM_CONTACT_CHAT_ID || process.env.TELEGRAM_CHAT_ID || this.chatId;

      if (!chatId) {
        return false;
      }

      await this.bot.sendMessage(chatId, message, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });

      return true;
    } catch (error) {
      return false;
    }
  }

  async sendPatientCoordinationNotification(formData) {
    if (!this.bot) {
      return false;
    }

    try {
      const message = this.formatPatientCoordinationMessage(formData);
      const chatId = process.env.TELEGRAM_CONTACT_CHAT_ID || process.env.TELEGRAM_CHAT_ID || this.chatId;

      if (!chatId) {
        return false;
      }

      await this.bot.sendMessage(chatId, message, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });

      return true;
    } catch (error) {

      if (error.response && error.response.body) {
        const body = error.response.body;
        if (body.parameters && body.parameters.migrate_to_chat_id) {
        } else {
        }
      }
      return false;
    }
  }

  async sendPhoneContactNotification(contact) {
    if (!this.bot) {
      return false;
    }

    try {
      const message = this.formatPhoneContactMessage(contact);
      const chatId = process.env.TELEGRAM_CONTACT_CHAT_ID || process.env.TELEGRAM_CHAT_ID || this.chatId;

      if (!chatId) {
        return false;
      }

      await this.bot.sendMessage(chatId, message, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });

      return true;
    } catch (error) {
      return false;
    }
  }

  async sendComplicatedCasesNotification(formData) {
    if (!this.bot) {
      return false;
    }

    try {
      const message = this.formatComplicatedCasesMessage(formData);
      const chatId = process.env.TELEGRAM_CONTACT_CHAT_ID || process.env.TELEGRAM_CHAT_ID || this.chatId;

      if (!chatId) {
        return false;
      }

      await this.bot.sendMessage(chatId, message, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });

      return true;
    } catch (error) {

      if (error.response && error.response.body) {
        const body = error.response.body;
        if (body.parameters && body.parameters.migrate_to_chat_id) {
        } else {
        }
      }
      return false;
    }
  }

  async sendVacancyContactNotification(contactData) {
    if (!this.bot) {
      return false;
    }

    try {
      const message = this.formatVacancyContactMessage(contactData);
      const chatId = process.env.TELEGRAM_CONTACT_CHAT_ID || process.env.TELEGRAM_CHAT_ID || this.chatId;

      if (!chatId) {
        return false;
      }

      await this.bot.sendMessage(chatId, message, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });

      return true;
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
<b>ОПЛАТА: ${statusText}</b>

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
        ? "Оплата успешно получена!"
        : "Оплата не прошла или отменена."
      }
`;
  }

  formatErrorMessage(errorMessage, context = null) {
    const timestamp = new Date().toLocaleString("ru-RU");

    let message = `
<b>ОШИБКА СИСТЕМЫ</b>

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
<b>НОВАЯ ЗАЯВКА - ОБРАТНАЯ СВЯЗЬ</b>

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
<b>НОВАЯ ЗАЯВКА - КООРДИНАЦИЯ ПАЦИЕНТА</b>

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

<b>Сообщение:</b>
${message || "Нет сообщения"}
`;
  }

  formatComplicatedCasesMessage(formData) {
    const {
      firstName,
      lastName,
      middleName,
      email,
      phone,
      city,
      message,
      whatsapp,
      telegram,
      max,
      files
    } = formData;

    const timestamp = new Date().toLocaleString("ru-RU");

    const fullName = [lastName, firstName, middleName].filter(Boolean).join(" ").trim() || "Имя не указано";

    const hasFiles = files && files.length > 0;

    return `
<b>🏥 НОВАЯ ЗАЯВКА - СЛОЖНЫЙ СЛУЧАЙ</b>

<b>Время:</b> ${timestamp}

<b>Информация о пациенте:</b>
• ФИО: ${fullName}
• Почта: ${email}
• Телефон: ${phone}
• Город: ${city}

<b>Предпочитаемые каналы связи:</b>
${whatsapp ? "• WhatsApp: ✅" : ""}
${telegram ? "• Telegram: ✅" : ""}
${max ? "• MAX: ✅" : ""}

<b>Описание случая:</b>
${message || "Нет описания"}

${hasFiles ? `<b>📎 Прикреплено файлов:</b> ${files.length}` : ""}
`;
  }

  formatPhoneContactMessage(contact) {
    const { firstName, lastName, middleName, phone } = contact;
    const timestamp = new Date().toLocaleString("ru-RU");
    const fullName = [lastName, firstName, middleName].filter(Boolean).join(" ").trim() || "Имя не указано";

    return `
<b>ЗАКАЗ ОБРАТНОГО ЗВОНКА</b>

<b>Время:</b> ${timestamp}

<b>Информация о клиенте:</b>
• ФИО: ${fullName}
• Телефон: ${phone}

<b>Статус:</b> В ожидании
`;
  }

  formatVacancyContactMessage(contactData) {
    const { phoneNumber, vacancyTitle, department, location, status, createdAt } = contactData;
    const timestamp = createdAt 
      ? new Date(createdAt).toLocaleString("ru-RU") 
      : new Date().toLocaleString("ru-RU");
    
    // Handle multilingual vacancy title
    const jobTitle = typeof vacancyTitle === 'object' 
      ? (vacancyTitle.ru || vacancyTitle.en || 'Вакансия')
      : (vacancyTitle || 'Вакансия');

    return `
<b>💼 НОВЫЙ ЗАПРОС НА КОНТАКТ ПО ВАКАНСИИ</b>

<b>Время:</b> ${timestamp}

<b>Информация о вакансии:</b>
• Должность: ${jobTitle}
${department ? `• Отдел: ${department}` : ''}
${location ? `• Локация: ${location}` : ''}

<b>Контактная информация:</b>
• Телефон: ${phoneNumber}

<b>Статус:</b> ${status === 'pending' ? '⏳ В ожидании' : status === 'contacted' ? '✅ Связались' : status === 'resolved' ? '✔️ Решено' : '❌ Спам'}
`;
  }

  async sendStatistics(stats) {
    if (!this.bot) {
      return false;
    }

    try {
      const message = this.formatStatisticsMessage(stats);
      const chatId = process.env.TELEGRAM_CHAT_ID || this.chatId;

      if (!chatId) {
        return false;
      }

      await this.bot.sendMessage(chatId, message, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });

      return true;
    } catch (error) {
      return false;
    }
  }

  formatStatisticsMessage(stats) {
    const {
      dateRange,
      totalBookings,
      successfulPayments,
      pendingPayments,
      totalRevenue,
      averageBookingValue,
    } = stats;

    return `
<b>СТАТИСТИКА БРОНИРОВАНИЙ</b>

<b>Период:</b> ${dateRange}

<b>Общая статистика:</b>
• Всего броней: ${totalBookings}
• Успешных оплат: ${successfulPayments}
• Ожидающих оплаты: ${pendingPayments}
• Общий доход: ${totalRevenue.toFixed(2)} RUB
• Средний чек: ${averageBookingValue.toFixed(2)} RUB

<b>Последние брони:</b>
${stats.recentBookings
        ? stats.recentBookings
          .map(
            (booking) =>
              `• ${booking.bookingNumber}: ${booking.customer.firstName} ${booking.customer.lastName} - ${booking.package.name}`
          )
          .join("\n")
        : "Нет данных"
      }

<b>Топ пакетов:</b>
${stats.topPackages
        ? stats.topPackages
          .map((pkg) => `• ${pkg.name}: ${pkg.count} броней`)
          .join("\n")
        : "Нет данных"
      }
`;
  }

  setChatId(chatId) {
    this.chatId = chatId;
  }

  async setupWebhook() {
    if (!process.env.TELEGRAM_WEBHOOK_URL) {
      return;
    }

    try {
      await this.bot.setWebHook(
        `${process.env.TELEGRAM_WEBHOOK_URL}/telegram-webhook`
      );
    } catch (error) {
    }
  }

  async checkBotStatus() {
    if (!this.bot) {
      return { online: false, message: "Bot not initialized" };
    }

    try {
      const me = await this.bot.getMe();
      return {
        online: true,
        message: "Bot is running",
        username: me.username,
        firstName: me.first_name,
      };
    } catch (error) {
      return {
        online: false,
        message: `Status check failed: ${error.message}`,
      };
    }
  }

  async sendTestMessage() {
    if (!this.bot) {
      return false;
    }

    try {
      const chatId = process.env.TELEGRAM_CHAT_ID || this.chatId;

      if (!chatId) {
        return false;
      }

      await this.bot.sendMessage(
        chatId,
        "<b>ТЕСТОВОЕ СООБЩЕНИЕ</b>\n\n" +
        "Бот для уведомлений о бронировании работает корректно.\n" +
        `Время: ${new Date().toLocaleString("ru-RU")}\n` +
        "Все системы в норме.",
        { parse_mode: "HTML" }
      );

      return true;
    } catch (error) {
      return false;
    }
  }
}

const telegramBot = new TelegramBotService();
module.exports = telegramBot;
