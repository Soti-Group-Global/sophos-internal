const mongoose = require('mongoose');

let gfsReviews = null;

mongoose.connection.once('open', () => {
  gfsReviews = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'reviewFiles',
  });
});

module.exports = {
  getGfsReviews: () => {
    if (!gfsReviews) {
      throw new Error('GridFS for reviewFiles not initialized. Ensure MongoDB connection is established.');
    }
    return gfsReviews;
  },
};