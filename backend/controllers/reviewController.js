const mongoose = require("mongoose");
const Review = require("../models/reviews");
const { getGfsReviews } = require("../gridfs-reviews");

const normalizeBranch = (value) => {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value.filter(Boolean);

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch (_) {
      // ignore
    }
    return [trimmed];
  }

  return [String(value)].filter(Boolean);
};

const getBranchQuery = (branch) => {
  if (!branch) return undefined;
  const raw = String(branch).trim();
  if (!raw) return undefined;
  if (raw.toLowerCase() === "all") return undefined;

  const key = raw.toLowerCase();
  const values = new Set([raw]);

  if (key === "moscow" || key.includes("moscow")) {
    values.add("Moscow Clinic");
    values.add("Клиника Москва");
    values.add("Москва");
  } else if (key === "makhachkala" || key.includes("makhachkala")) {
    values.add("Makhachkala Clinic");
    values.add("Клиника Махачкала");
    values.add("Махачкала");
  }

  return { $in: Array.from(values) };
};

// Helper: upload a single file to GridFS
const uploadFileToGridFS = (file) => {
  return new Promise((resolve, reject) => {
    try {
      const gfs = getGfsReviews();

      const uploadStream = gfs.openUploadStream(file.originalname, {
        contentType: file.mimetype,
        metadata: {
          originalName: file.originalname,
          uploadDate: new Date(),
          contentType: file.mimetype,
          fileType:
            file.fieldname === "profilePicture"
              ? "profilePicture"
              : file.mimetype.startsWith("video/")
                ? "video"
                : "document",
        },
      });

      const fileId = uploadStream.id;

      uploadStream.on("error", (error) => {
        reject(error);
      });

      uploadStream.on("finish", () => {
        resolve(fileId);
      });

      uploadStream.end(file.buffer);
    } catch (error) {
      reject(error);
    }
  });
};

exports.submitReview = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Parse the incoming data
    const patientName =
      typeof req.body.patientName === "string"
        ? JSON.parse(req.body.patientName)
        : req.body.patientName;

    const description =
      typeof req.body.description === "string"
        ? JSON.parse(req.body.description)
        : req.body.description;

    const contactInfo =
      typeof req.body.contactInfo === "string"
        ? JSON.parse(req.body.contactInfo)
        : req.body.contactInfo;

    const reviewData = {
      patientName: patientName,
      description: description,
      contactInfo: contactInfo,
      rating: parseInt(req.body.rating, 10),
      status: req.body.status || "Posted",
      reviewFileIds: [], // For videos/documents only
      userProfileId: null, // Use userProfileId for profile picture file ID
      // Add doctor fields if provided
      ...(req.body.doctorId && { doctorId: req.body.doctorId }),
      ...(req.body.doctorEmail && { doctorEmail: req.body.doctorEmail }),
    };

    const branch = normalizeBranch(req.body.branch);
    if (branch !== undefined) {
      reviewData.branch = branch;
    }

    // Handle file uploads - separate profile picture from other files
    if (req.files) {

      // Handle profile picture (now in req.files.profilePicture array)
      if (req.files.profilePicture && req.files.profilePicture.length > 0) {
        const profilePicture = req.files.profilePicture[0];
        if (!profilePicture.mimetype.startsWith("image/")) {
          throw new Error("Profile picture must be an image file");
        }
        const profilePictureId = await uploadFileToGridFS(profilePicture);
        reviewData.userProfileId = profilePictureId; // Save in userProfileId
      }

      // Handle other files (videos/documents) - now in req.files.files array
      if (req.files.files && req.files.files.length > 0) {
        const fileUploadPromises = req.files.files.map((file) =>
          uploadFileToGridFS(file)
        );
        const fileIds = await Promise.all(fileUploadPromises);
        reviewData.reviewFileIds = fileIds;
      }
    }

    const [review] = await Review.create([reviewData], { session });

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      review,
      message: "Review posted successfully",
      success: true,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(400).json({
      message: "Error submitting the review: " + error.message,
      success: false,
    });
  }
};

exports.updateReview = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    // Parse the incoming data
    const patientName =
      typeof req.body.patientName === "string"
        ? JSON.parse(req.body.patientName)
        : req.body.patientName;

    const description =
      typeof req.body.description === "string"
        ? JSON.parse(req.body.description)
        : req.body.description;

    const contactInfo =
      typeof req.body.contactInfo === "string"
        ? JSON.parse(req.body.contactInfo)
        : req.body.contactInfo;

    const currentReview = await Review.findById(id);

    if (!currentReview) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        message: "Review not found",
        success: false,
      });
    }

    let updateData = {
      patientName: patientName,
      description: description,
      contactInfo: contactInfo,
      rating: parseInt(req.body.rating, 10),
      status: req.body.status,
      // Add doctor fields if provided
      ...(req.body.doctorId && { doctorId: req.body.doctorId }),
      ...(req.body.doctorEmail && { doctorEmail: req.body.doctorEmail }),
    };

    if (req.body.branch !== undefined) {
      updateData.branch = normalizeBranch(req.body.branch) || [];
    }

    // Handle file uploads for updates
    if (req.files) {
      // Handle profile picture upload
      if (req.files.profilePicture && req.files.profilePicture.length > 0) {
        const profilePicture = req.files.profilePicture[0];
        if (!profilePicture.mimetype.startsWith("image/")) {
          throw new Error("Profile picture must be an image file");
        }

        // Delete old profile picture if exists
        if (currentReview.userProfileId) {
          await deleteFileFromGridFS(currentReview.userProfileId);
        }

        const profilePictureId = await uploadFileToGridFS(profilePicture);
        updateData.userProfileId = profilePictureId; // Save in userProfileId
      }

      // Handle other files upload
      if (req.files.files && req.files.files.length > 0) {
        const fileUploadPromises = req.files.files.map((file) =>
          uploadFileToGridFS(file)
        );
        const newFileIds = await Promise.all(fileUploadPromises);

        const existingFileIds = currentReview.reviewFileIds || [];
        const allFileIds = [...existingFileIds, ...newFileIds];

        // Limit total files to prevent abuse
        const maxFiles = 3; // Adjust as needed
        updateData.reviewFileIds = allFileIds.slice(0, maxFiles);
      } else {
        updateData.reviewFileIds = currentReview.reviewFileIds || [];
      }
    } else {
      // Keep existing files if no new files uploaded
      updateData.userProfileId = currentReview.userProfileId;
      updateData.reviewFileIds = currentReview.reviewFileIds || [];
    }

    const review = await Review.findByIdAndUpdate(id, updateData, {
      new: true,
      session,
    });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      review,
      message: "Review updated successfully",
      success: true,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    return res.status(400).json({
      message: "Error updating the review: " + error.message,
      success: false,
    });
  }
};

// Helper function to delete file from GridFS
const deleteFileFromGridFS = (fileId) => {
  return new Promise((resolve, reject) => {
    const gfs = getGfsReviews();
    gfs.delete(new mongoose.Types.ObjectId(fileId), (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
};

// Get review with separate file information
exports.getReviewById = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id).populate(
      "doctorId",
      "firstName lastName email"
    );

    if (!review) {
      return res.status(404).json({
        message: "Review not found",
        success: false,
      });
    }

    const gfs = getGfsReviews();
    const filesInfo = {
      profilePicture: null,
      reviewFiles: [],
    };

    // Get profile picture information from userProfileId
    if (review.userProfileId) {
      const profileFiles = await gfs
        .find({ _id: new mongoose.Types.ObjectId(review.userProfileId) })
        .toArray();

      if (profileFiles && profileFiles.length > 0) {
        const file = profileFiles[0];
        filesInfo.profilePicture = {
          fileId: file._id,
          filename: file.filename,
          contentType: file.contentType,
          uploadDate: file.uploadDate,
        };
      }
    }

    // Get review files information
    if (review.reviewFileIds && review.reviewFileIds.length > 0) {
      for (const fileId of review.reviewFileIds) {
        const files = await gfs
          .find({ _id: new mongoose.Types.ObjectId(fileId) })
          .toArray();

        if (files && files.length > 0) {
          const file = files[0];
          filesInfo.reviewFiles.push({
            fileId: file._id,
            filename: file.filename,
            contentType: file.contentType,
            uploadDate: file.uploadDate,
            fileType: file.metadata?.fileType || "document",
          });
        }
      }
    }

    return res.status(200).json({
      review: {
        ...review.toObject(),
        files: filesInfo,
      },
      message: "Review fetched successfully",
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      success: false,
    });
  }
};

// Get public reviews with separate profile pictures
exports.getPublicReview = async (req, res) => {
  try {
    const reviews = await Review.find({
      status: "Approved",
    })
      .populate("doctorId", "firstName lastName email")
      .sort({ postedAt: -1 });

    const gfs = getGfsReviews();
    const reviewsWithFiles = await Promise.all(
      reviews.map(async (review) => {
        let profilePicture = null;

        // Get profile picture if exists from userProfileId
        if (review.userProfileId) {
          const profileFiles = await gfs
            .find({ _id: new mongoose.Types.ObjectId(review.userProfileId) })
            .toArray();

          if (profileFiles && profileFiles.length > 0) {
            const file = profileFiles[0];
            profilePicture = {
              fileId: file._id,
              filename: file.filename,
              contentType: file.contentType,
            };
          }
        }

        return {
          ...review.toObject(),
          profilePicture: profilePicture,
        };
      })
    );

    return res.status(200).json({
      message: "Reviews fetched successfully",
      success: true,
      reviews: reviewsWithFiles,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      success: false,
    });
  }
};

// Get specific file (profile picture or review file)
exports.getReviewFile = async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!fileId) {
      return res.status(400).json({
        message: "File ID is required",
        success: false,
      });
    }

    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({
        message: "Invalid file ID",
        success: false,
      });
    }

    const gfs = getGfsReviews();

    // Fetch file metadata
    const files = await gfs
      .find({ _id: new mongoose.Types.ObjectId(fileId) })
      .toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({
        message: "File not found",
        success: false,
      });
    }

    const file = files[0];

    // Determine content type
    const contentType =
      file.contentType ||
      file.metadata?.contentType ||
      "application/octet-stream";

    res.set("Content-Type", contentType);

    // For images and videos, display inline
    if (contentType.startsWith("image/") || contentType.startsWith("video/")) {
      res.set("Content-Disposition", `inline; filename="${file.filename}"`);
    } else {
      res.set("Content-Disposition", `attachment; filename="${file.filename}"`);
    }

    const readstream = gfs.openDownloadStream(file._id);

    readstream.on("error", (error) => {
      if (!res.headersSent) {
        res.status(500).json({
          message: "Error streaming file",
          success: false,
        });
      }
    });

    readstream.pipe(res);
  } catch (error) {
    if (!res.headersSent) {
      return res.status(500).json({
        message: "Internal server error fetching file",
        success: false,
      });
    }
  }
};

// Other functions remain similar but updated for separate file handling
exports.getReviews = async (req, res) => {
  try {
    const filter = {};
    const branchQuery = getBranchQuery(req.query.branch);
    if (branchQuery) filter.branch = branchQuery;

    const reviews = await Review.find(filter)
      .populate("doctorId", "firstName lastName middleName email")
      .sort({ postedAt: -1 });

    return res.status(200).json({
      reviews,
      message: "Reviews fetched successfully",
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error on fetching the reviews",
      success: false,
    });
  }
};

exports.getReviewsByDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;

    const reviews = await Review.find({
      doctorId: doctorId,
      status: "Approved",
    })
      .populate("doctorId", "firstName lastName email")
      .sort({ postedAt: -1 });

    return res.status(200).json({
      reviews,
      message: "Doctor approved reviews fetched successfully",
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error on fetching doctor reviews",
      success: false,
    });
  }
};

exports.deleteReview = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    const review = await Review.findById(id);

    if (!review) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        message: "Review not found",
        success: false,
      });
    }

    const gfs = getGfsReviews();

    // Delete profile picture if exists from userProfileId
    if (review.userProfileId) {
      await deleteFileFromGridFS(review.userProfileId);
    }

    // Delete review files
    if (review.reviewFileIds && review.reviewFileIds.length > 0) {
      const deleteFilePromises = review.reviewFileIds.map((fileId) =>
        deleteFileFromGridFS(fileId)
      );
      await Promise.all(deleteFilePromises);
    }

    await Review.findByIdAndDelete(id, { session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: "Review deleted successfully",
      success: true,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({
      message: "Error deleting the review",
      success: false,
    });
  }
};
