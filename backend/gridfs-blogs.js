// gridfs-blogs.js
const mongoose = require("mongoose");

let gfsBlogs = null;

mongoose.connection.once("open", () => {
  gfsBlogs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: "blogMedia",
  });
});

module.exports = {
  getGfsBlogs: () => {
    if (!gfsBlogs) {
      throw new Error(
        "GridFS for blogMedia not initialized. Ensure MongoDB connection is established."
      );
    }
    return gfsBlogs;
  },
};
