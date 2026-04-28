const mongoose = require("mongoose");

let gfsComplicatedCases = null;

mongoose.connection.once("open", () => {
  gfsComplicatedCases = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: "complicatedCasesFiles",
  });
});

module.exports = {
  getGfsComplicatedCases: () => {
    if (!gfsComplicatedCases) {
      throw new Error(
        "GridFS for complicatedCasesFiles not initialized. Ensure MongoDB connection is established."
      );
    }
    return gfsComplicatedCases;
  },
};
