const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const Application = require("../models/Application");

(async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      process.exit(1);
    }

    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const before = await Application.countDocuments();

    if (before === 0) {
      await mongoose.disconnect();
      process.exit(0);
    }

    const res = await Application.deleteMany({});

    const after = await Application.countDocuments();

  } catch (err) {
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  }
})();
