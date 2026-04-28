const mongoose = require("mongoose");

let gfsServices = null;

mongoose.connection.once("open", () => {
    gfsServices = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: "serviceFiles",
    });
});

module.exports = {
    getGfsServices: () => {
        if (!gfsServices) {
            throw new Error(
                "GridFS for serviceFiles not initialized. Ensure MongoDB connection is established."
            );
        }
        return gfsServices;
    },
};
