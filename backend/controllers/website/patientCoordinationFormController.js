const PatientCoordinationForm = require("../../models/website/patientCoordinationForm");
const telegramBot = require("../../services/telegramBot");
const maxBot = require("../../services/maxBot");

exports.submitPatientCooridnationForms = async (req, res) => {
  try {
    const patientCoordinationForm = await PatientCoordinationForm.create(
      req.body
    );

    // Send Telegram notification
    try {
      await telegramBot.sendPatientCoordinationNotification(patientCoordinationForm);
      await maxBot.sendPatientCoordinationNotification(patientCoordinationForm);
    } catch (telegramError) {
    }

    res.status(201).json({
      message: "Patient Coordination form Submitted successfully",
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error or Submit the form",
    });
  }
};

exports.getPatientCooridnationForms = async (req, res) => {
  try {
    const patientCoordinationForm = await PatientCoordinationForm.find();
    if (!patientCoordinationForm)
      return res.status(400).json({
        message: "No Form Submissions",
      });

    return res.status(201).json({
      message: "Form data successfully fetched",
      patientCoordinationForm: patientCoordinationForm,
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal server error",
    });
  }
};

exports.updatePatientCooridnationForm = async (req, res) => {
  try {
    const patientCoordinationForm =
      await PatientCoordinationForm.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
      });
    if (!patientCoordinationForm)
      return res.status(400).json({
        message: "Form data not found",
      });

    return res.status(201).json({
      message: "Form data fethced successfully",
      patientCoordinationForm: patientCoordinationForm,
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal server error",
    });
  }
};

exports.deletePatientCooridnationForm = async (req, res) => {
  try {

    const patientCoordinationForm =
      await PatientCoordinationForm.findByIdAndDelete(req.params.id);
    if (!patientCoordinationForm)
      return res.status(400).json({
        message: "Form data not found",
      });
    return res.status(201).json({
      message: "Data deleted successfully",
      patientCoordinationForm: patientCoordinationForm,
    });
  } catch (error) {
    res.status(500).json({
      message: "Interal server error",
    });
  }
};
