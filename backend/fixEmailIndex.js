// Load environment variables FIRST
require('dotenv').config();

const mongoose = require('mongoose');

async function fixEmailIndex() {
  try {
    
    // Check if MONGODB_URI exists
    if (!process.env.MONGODB_URI) {
      process.exit(1);
    }
    
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
    
    
    const db = mongoose.connection.db;
    const collection = db.collection('doctorsprofiles');
    
    // Check existing indexes
    const indexes = await collection.indexes();
    
    // Drop the email index if it exists
    try {
      await collection.dropIndex('email_1');
    } catch (error) {
      if (error.code === 27) {
      } else {
      }
    }
    
    // Create new unique index with sparse option
    await collection.createIndex({ email: 1 }, { unique: true, sparse: true });
    
    // Verify new indexes
    const newIndexes = await collection.indexes();
    
    
  } catch (error) {
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

fixEmailIndex();
