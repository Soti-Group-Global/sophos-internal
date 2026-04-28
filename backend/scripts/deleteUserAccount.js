require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const emailToDelete = 'theva.prime@gmail.com';

async function deleteUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const result = await User.deleteOne({ email: emailToDelete });
    
    if (result.deletedCount > 0) {
    } else {
    }

    await mongoose.connection.close();
  } catch (error) {
    process.exit(1);
  }
}

deleteUser();
