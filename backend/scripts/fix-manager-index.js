const mongoose = require('mongoose');
require('dotenv').config();

async function fixManagerIndexes() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);

    // Get the managers collection
    const db = mongoose.connection.db;
    const managersCollection = db.collection('managers');

    // Check existing indexes
    const indexes = await managersCollection.indexes();

    // Check if there's a user_1 index
    const userIndex = indexes.find(index => index.name === 'user_1');
    if (userIndex) {
      await managersCollection.dropIndex('user_1');
    } else {
    }

    // Check for any managers with null user field
    const managersWithNullUser = await managersCollection.find({ user: null }).toArray();

    // Remove the user field from all manager documents if it exists
    const updateResult = await managersCollection.updateMany(
      { user: { $exists: true } },
      { $unset: { user: "" } }
    );

  } catch (error) {
  } finally {
    await mongoose.disconnect();
  }
}

// Run the fix
fixManagerIndexes();