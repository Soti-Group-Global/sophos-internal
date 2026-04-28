const Counter = require("../models/Counter");

const incrementCounter = async (req, res) => {
  try {
    const date = new Date();
    const monthYear = `${(date.getMonth() + 1)
      .toString()
      .padStart(2, "0")}/${date.getFullYear()}`;

    const counter = await Counter.findOneAndUpdate(
      { name: req.params.name },
      [
        {
          $set: {
            monthYear,
            monthlyCount: {
              $cond: {
                if: { $eq: ["$monthYear", monthYear] },
                then: { $add: ["$monthlyCount", 1] },
                else: 1,
              },
            },
            overallCount: { $add: ["$overallCount", 1] },
          },
        },
      ],
      { new: true, upsert: true }
    );

    return res.json({
      monthlyCount: counter.monthlyCount,
      overallCount: counter.overallCount,
      monthYear: counter.monthYear,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  incrementCounter,
};
