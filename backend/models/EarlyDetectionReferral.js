const mongoose = require("mongoose");
const Counter = require("./Counter");

const earlyDetectionReferralSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName:  { type: String, required: true, trim: true },
    middleName: { type: String, trim: true, default: "" },

    email:       { type: String, required: true, trim: true, lowercase: true },
    phoneNumber: { type: String, required: true, trim: true },

    limit: { type: Number, required: true, default: 1, min: 1 },

    referralCode: { type: String, unique: true, trim: true },
  },
  { timestamps: true }
);

/* ── Auto-generate referral code before first save ──────────────────────── */
earlyDetectionReferralSchema.pre("save", async function (next) {
  if (this.referralCode) return next();

  try {
    const now = new Date();
    const monthYear = `${now.getMonth() + 1}-${now.getFullYear()}`;

    // Upsert the counter for early detection referrals
    const counter = await Counter.findOneAndUpdate(
      { name: "earlyDetectionReferral" },
      {
        $inc: { overallCount: 1 },
        $setOnInsert: { monthlyCount: 0, monthYear },
      },
      { upsert: true, new: true }
    );

    const seq = String(counter.overallCount).padStart(3, "0");

    // First 3 letters of firstName (uppercase, padded with X if shorter)
    const prefix = this.firstName
      .replace(/\s+/g, "")
      .substring(0, 3)
      .toUpperCase()
      .padEnd(3, "X");

    this.referralCode = `${prefix}SOP${seq}`;
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("EarlyDetectionReferral", earlyDetectionReferralSchema);
