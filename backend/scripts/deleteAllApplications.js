const mongoose = require('mongoose');
const Application = require('../models/Application');
require('dotenv').config({ path: '../.env' });

const deleteAllApplications = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/health-direct');

    const result = await Application.deleteMany({});

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
};

deleteAllApplications();
