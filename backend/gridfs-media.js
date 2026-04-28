// backend/gridfs-media.js
const mongoose = require('mongoose');

let gfsMedia = null;

// initialize manually after connection
function initGridFS() {
  if (!mongoose.connection.db) {
    return;
  }
  gfsMedia = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'media',
  });
}

mongoose.connection.once('open', initGridFS);

function getGfsMedia() {
  if (!gfsMedia) {
    throw new Error('GridFS for media not initialized. Ensure MongoDB connection is established.');
  }
  return gfsMedia;
}

module.exports = { initGridFS, gfsMedia: getGfsMedia };
