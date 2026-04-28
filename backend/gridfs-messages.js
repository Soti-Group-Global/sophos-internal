// gridfs-messages.js
const mongoose = require('mongoose');

let gfsMessages = null;

mongoose.connection.once('open', () => {
  gfsMessages = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'messageFiles',
  });
});

module.exports = {
  getGfsMessages: () => {
    if (!gfsMessages) {
      throw new Error('GridFS for messageFiles not initialized. Ensure MongoDB connection is established.');
    }
    return gfsMessages;
  },
};