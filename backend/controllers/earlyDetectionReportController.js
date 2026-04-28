const EarlyDetectionReport = require("../models/EarlyDetectionReport");
const EarlyDetectionBooking = require("../models/EarlyDetectionBooking");

// GET report by booking ID — returns existing or empty shell
const getReport = async (req, res) => {
  try {
    const { bookingId } = req.params;

    let report = await EarlyDetectionReport.findOne({ booking: bookingId }).lean();

    if (!report) {
      // Check booking exists
      const booking = await EarlyDetectionBooking.findById(bookingId).select("patient").lean();
      if (!booking) return res.status(404).json({ message: "Booking not found" });

      return res.status(200).json({ data: null });
    }

    res.status(200).json({ data: report });
  } catch (err) {
    console.error("getReport error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// PUT — upsert (save or update) report for a booking
const saveReport = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const {
      coverFields,
      introText,
      vitals,
      labCardStatus,
      page4Entries,
      diagnosisText,
      followUpText,
      recommendationsText,
    } = req.body;

    // Verify booking exists and get patient ref
    const booking = await EarlyDetectionBooking.findById(bookingId).select("patient").lean();
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const update = {
      booking: bookingId,
      patient: booking.patient,
      ...(coverFields !== undefined && { coverFields }),
      ...(introText !== undefined && { introText }),
      ...(vitals !== undefined && { vitals }),
      ...(labCardStatus !== undefined && { labCardStatus }),
      ...(page4Entries !== undefined && { page4Entries }),
      ...(diagnosisText !== undefined && { diagnosisText }),
      ...(followUpText !== undefined && { followUpText }),
      ...(recommendationsText !== undefined && { recommendationsText }),
    };

    const report = await EarlyDetectionReport.findOneAndUpdate(
      { booking: bookingId },
      { $set: update },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ data: report, message: "Report saved" });
  } catch (err) {
    console.error("saveReport error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

module.exports = { getReport, saveReport };
