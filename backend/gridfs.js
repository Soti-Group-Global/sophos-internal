const mongoose = require("mongoose");

let gfs = null;

mongoose.connection.once("open", () => {
  gfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: "profilePictures",
  });
});

module.exports = {
  getGfs: () => {
    if (!gfs) {
      throw new Error(
        "GridFS not initialized. Ensure MongoDB connection is established."
      );
    }
    return gfs;
  },
};
