const mongoose = require('mongoose');

let gfsPromos = null;

mongoose.connection.once('open', () => {
  gfsPromos = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'promoFiles',
  });
});

module.exports = {
  getGfsPromos: () => {
    if (!gfsPromos) {
      throw new Error('GridFS for promoFiles not initialized. Ensure MongoDB connection is established.');
    }
    return gfsPromos;
  },
};