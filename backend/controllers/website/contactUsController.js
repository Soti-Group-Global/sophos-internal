const ContactUs = require("../../models/website/contact");
const telegramBot = require("../../services/telegramBot");
const maxBot = require("../../services/maxBot");

exports.submitContactUsForm = async (req, res) => {
  try {
    const contact = await ContactUs.create(req.body);

    // Send Telegram notification
    try {
      await telegramBot.sendContactUsNotification(contact);
      await maxBot.sendContactUsNotification(contact);
    } catch (telegramError) {
      // We don't want to fail the request if Telegram notification fails
    }

    res.status(201).json({
      message: "Contact us form submitted successfully",
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
};

exports.getContactUsForm = async (req, res) => {
  try {
    const contact = await ContactUs.find();
    res.status(201).json({
      message: "Contact list fetched successfully",
      contacts: contact,
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
};

exports.updateContact = async (req, res) => {
  try {
    const { id } = req.params;

    const contact = await ContactUs.findByIdAndUpdate(id, req.body, {
      new: true,
    });

    if (!contact) return res.status(400).json({ message: "Contact not found" });
    res.json({ contact: contact });
  } catch (error) {
    res.status(400).json({
      message: error.message,
      success: false,
    });
  }
};

exports.deleteContact = async (req, res) => {
  try {
    const { id } = req.params;

    const contact = await ContactUs.findByIdAndDelete(id);
    if (!contact) return res.status(400).json({ message: "Conact not found" });
    return res.json({ message: "Contact deleted successfully" });
  } catch (error) {
    res.status(400).json({
      message: message.error,
      success: false,
    });
  }
};
