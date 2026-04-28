const ContactRequest = require('../../models/website/ContactRequest');
const telegramBot = require("../../services/telegramBot");
const maxBot = require("../../services/maxBot");

exports.submitContactViaPhone = async (req, res) => {
  try {
    const contact = await ContactRequest.create(req.body);

    // Send Telegram notification
    try {
      await telegramBot.sendPhoneContactNotification(contact);
      await maxBot.sendPhoneContactNotification(contact);
    } catch (telegramError) {
    }

    res.status(201).json({
      message: "Contact request submitted successfully",
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
};

exports.getContactRequests = async (req, res) => {
  try {
    const contacts = await ContactRequest.find().sort({ createdAt: -1 });
    res.status(200).json({
      message: "Contact requests fetched successfully",
      data: contacts,
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
};

exports.getContactRequest = async (req, res) => {
  try {
    const contact = await ContactRequest.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({
        message: "Contact request not found",
      });
    }
    res.status(200).json({
      message: "Contact request fetched successfully",
      data: contact,
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
};

exports.updateContactRequest = async (req, res) => {
  try {
    const contact = await ContactRequest.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!contact) {
      return res.status(404).json({
        message: "Contact request not found",
      });
    }
    res.status(200).json({
      message: "Contact request updated successfully",
      data: contact,
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
};

exports.deleteContactRequest = async (req, res) => {
  try {
    const contact = await ContactRequest.findByIdAndDelete(req.params.id);
    if (!contact) {
      return res.status(404).json({
        message: "Contact request not found",
      });
    }
    res.status(200).json({
      message: "Contact request deleted successfully",
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
};