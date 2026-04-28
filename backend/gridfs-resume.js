const mongoose = require('mongoose');

let gfsResumes = null;

mongoose.connection.once('open', () => {
  gfsResumes = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'resumeFiles',
  });
});

module.exports = {
  getGfsResumes: () => {
    if (!gfsResumes) {
      throw new Error('GridFS for resumeFiles not initialized. Ensure MongoDB connection is established.');
    }
    return gfsResumes;
  },
};