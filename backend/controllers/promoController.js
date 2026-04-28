const mongoose = require("mongoose");
const { getGfsPromos } = require("../gridfs-promos");
const Promo = require("../models/Promo");
const ffmpeg = require("fluent-ffmpeg");
const { Readable } = require("stream");

// Helper to check video/GIF duration
const checkVideoDuration = (buffer, filename) => {
  return new Promise((resolve, reject) => {
    const stream = Readable.from(buffer);
    ffmpeg(stream).ffprobe((err, data) => {
      if (err) {
        return reject(new Error("Error processing file duration"));
      }
      const duration = data.format.duration;
      if (duration > 30) {
        return reject(new Error("Video or GIF exceeds 30 seconds"));
      }
      resolve();
    });
  });
};

// Helper function to format promo response
async function formatPromoResponse(promo, language = "en") {
  const promoObj = promo.toObject();
  return {
    ...promoObj,
    startColor: promo.startColor || "#47a4d7",
    endColor: promo.endColor || "#1cabe9",
    currentBannerTitle: promo.getBannerTitle(language),
    currentBannerDescription: promo.getBannerDescription(language),
    currentDescription: promo.getDescription(language),
    isCurrentlyActive: promo.isCurrentlyActive,
    isScheduled: promo.isScheduled,
    isExpired: promo.isExpired,
  };
}

// Helper to strip HTML tags
const stripHtmlTags = (str) => (str || "").replace(/<[^>]*>/g, "").trim();

// Create promo
const createPromo = async (req, res) => {
  try {
    const {
      description,
      startDate,
      endDate,
      isActive = true,
      startColor = "#47a4d7",
      endColor = "#1cabe9",
      promoBannerTitle,
      promoBannerDescription,
    } = req.body;

    if (!startDate) {
      return res.status(400).json({ message: "Start date is required" });
    }

    // Auto-assign next available order
    const existingPromoCount = await Promo.countDocuments();
    if (existingPromoCount >= 10) {
      return res.status(400).json({ message: "Maximum 10 promos allowed" });
    }
    const usedOrders = (await Promo.find({}, { order: 1 })).map((p) => p.order);
    let nextOrder = 1;
    while (usedOrders.includes(nextOrder)) nextOrder++;
    const order = nextOrder;

    // Parse multilingual fields
    let descriptionObj;
    let promoBannerTitleObj = {}, promoBannerDescriptionObj = {};
    try {
      descriptionObj = description
        ? typeof description === "string"
          ? JSON.parse(description)
          : description
        : {};
      if (promoBannerTitle) {
        promoBannerTitleObj = typeof promoBannerTitle === "string" ? JSON.parse(promoBannerTitle) : promoBannerTitle;
      }
      if (promoBannerDescription) {
        promoBannerDescriptionObj = typeof promoBannerDescription === "string" ? JSON.parse(promoBannerDescription) : promoBannerDescription;
      }
    } catch (parseError) {
      return res
        .status(400)
        .json({ message: "Invalid description format" });
    }

    // Validate banner title/description length (strip HTML tags first)
    for (const lang of ["en", "ru"]) {
      if (promoBannerTitleObj[lang] && stripHtmlTags(promoBannerTitleObj[lang]).length > 80) {
        return res.status(400).json({ message: `Banner title (${lang.toUpperCase()}) must be 80 characters or less` });
      }
      if (promoBannerDescriptionObj[lang] && stripHtmlTags(promoBannerDescriptionObj[lang]).length > 200) {
        return res.status(400).json({ message: `Banner description (${lang.toUpperCase()}) must be 200 characters or less` });
      }
    }

    // Validate dates
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : null;

    if (isNaN(start.getTime())) {
      return res.status(400).json({ message: "Invalid start date" });
    }

    if (end && isNaN(end.getTime())) {
      return res.status(400).json({ message: "Invalid end date" });
    }

    if (end && start > end) {
      return res
        .status(400)
        .json({ message: "Start date cannot be after end date" });
    }

    // Determine file type and validate duration
    let fileId = null, fileType = null, filename = null;
    if (req.file) {
      if (req.file.mimetype.includes("image")) {
        fileType = req.file.mimetype === "image/gif" ? "gif" : "image";
      } else if (req.file.mimetype.includes("video")) {
        fileType = "video";
        await checkVideoDuration(req.file.buffer, req.file.originalname);
      } else {
        return res.status(400).json({ message: "Invalid file type" });
      }

      // Upload file to GridFS
      const gfs = getGfsPromos();
      const writeStream = gfs.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype,
      });
      writeStream.end(req.file.buffer);
      fileId = await new Promise((resolve, reject) => {
        writeStream.on("finish", () => resolve(writeStream.id));
        writeStream.on("error", reject);
      });
      filename = req.file.originalname;
    }

    // Create promo document
    const promo = new Promo({
      ...(fileId && { fileId, fileType, filename }),
      order: parseInt(order),
      description: descriptionObj,
      startDate: start,
      endDate: end,
      isActive: isActive === "true" || isActive === true,
      startColor: startColor || "#47a4d7",
      endColor: endColor || "#1cabe9",
      promoBannerTitle: promoBannerTitleObj,
      promoBannerDescription: promoBannerDescriptionObj,
    });

    await promo.save();
    res.status(201).json({
      message: "Promo created successfully",
      promo: await formatPromoResponse(promo),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Stream promo file directly (public - used by frontend and external sites)
const streamPromoFile = async (req, res) => {
  try {
    const gfs = getGfsPromos();
    const fileId = new mongoose.Types.ObjectId(req.params.fileId);
    const files = await gfs.find({ _id: fileId }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ message: "File not found" });
    }
    const file = files[0];
    res.set("Content-Type", file.contentType || "application/octet-stream");
    res.set("Cache-Control", "public, max-age=86400"); // cache 1 day
    gfs.openDownloadStream(fileId).pipe(res);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get all promos (admin - with all details)
const getAllPromos = async (req, res) => {
  try {
    const promos = await Promo.find().sort({ order: 1 });
    const promosWithFiles = await Promise.all(
      promos.map(async (promo) => {
        return await formatPromoResponse(promo);
      })
    );
    res.json({ promos: promosWithFiles });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get active promos for public display (no auth required)
const getActivePromos = async (req, res) => {
  try {
    const language = req.query.lang || "en"; // Get language from query param
    const now = new Date();

    const activePromos = await Promo.find({
      isActive: true,
      startDate: { $lte: now },
      $or: [
        { endDate: { $exists: false } },
        { endDate: null },
        { endDate: { $gte: now } },
      ],
    }).sort({ order: 1 });

    const promosWithFiles = await Promise.all(
      activePromos.map(async (promo) => {
        const formattedPromo = await formatPromoResponse(promo, language);
        return {
          ...formattedPromo,
          description: promo.getDescription(language),
          isCurrentlyActive: promo.isCurrentlyActive,
          isScheduled: promo.isScheduled,
          isExpired: promo.isExpired,
        };
      })
    );

    res.json({ promos: promosWithFiles });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get single active promo by ID (no auth required)
const getActivePromoById = async (req, res) => {
  try {
    const language = req.query.lang || "en";
    const now = new Date();

    const promo = await Promo.findOne({
      _id: req.params.id,
      isActive: true,
      startDate: { $lte: now },
      $or: [
        { endDate: { $exists: false } },
        { endDate: null },
        { endDate: { $gte: now } },
      ],
    });

    if (!promo) {
      return res.status(404).json({ message: "Promo not found or not active" });
    }

    const formattedPromo = await formatPromoResponse(promo, language);
    res.json({
      promo: {
        ...formattedPromo,
        currentDescription: promo.getDescription(language),
        isCurrentlyActive: promo.isCurrentlyActive,
        isScheduled: promo.isScheduled,
        isExpired: promo.isExpired,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Reorder promos
const reorderPromos = async (req, res) => {
  try {
    const { promos } = req.body; // Array of { id, order }
    if (!Array.isArray(promos) || promos.length > 10) {
      return res
        .status(400)
        .json({ message: "Invalid promos array or exceeds 10 slides" });
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const { id, order } of promos) {
          if (
            !mongoose.Types.ObjectId.isValid(id) ||
            isNaN(order) ||
            order < 1 ||
            order > 10
          ) {
            throw new Error("Invalid promo ID or order");
          }
          await Promo.findByIdAndUpdate(id, { order }, { session });
        }
      });
    } finally {
      session.endSession();
    }
    res.json({ message: "Promos reordered successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get single promo by ID (public - used by external website)
const getPromoById = async (req, res) => {
  try {
    const language = req.query.lang || "en";
    const promo = await Promo.findById(req.params.id);
    if (!promo) {
      return res.status(404).json({ message: "Promo not found" });
    }

    const formattedPromo = await formatPromoResponse(promo, language);
    res.json({ promo: formattedPromo });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Update promo
const updatePromo = async (req, res) => {
  try {
    const promo = await Promo.findById(req.params.id);
    if (!promo) {
      return res.status(404).json({ message: "Promo not found" });
    }

    const { order, description, startDate, endDate, isActive, startColor, endColor, promoBannerTitle, promoBannerDescription, removeFile } =
      req.body;

    // Parse and validate fields
    if (order && (isNaN(order) || order < 1 || order > 10)) {
      return res
        .status(400)
        .json({ message: "Order must be between 1 and 10" });
    }

    let descriptionObj;
    if (description) {
      try {
        descriptionObj =
          typeof description === "string"
            ? JSON.parse(description)
            : description;
      } catch (parseError) {
        return res.status(400).json({ message: "Invalid description format" });
      }
    }

    let promoBannerTitleObj, promoBannerDescriptionObj;
    if (promoBannerTitle) {
      try {
        promoBannerTitleObj = typeof promoBannerTitle === "string" ? JSON.parse(promoBannerTitle) : promoBannerTitle;
      } catch (parseError) {
        return res.status(400).json({ message: "Invalid banner title format" });
      }
    }
    if (promoBannerDescription) {
      try {
        promoBannerDescriptionObj = typeof promoBannerDescription === "string" ? JSON.parse(promoBannerDescription) : promoBannerDescription;
      } catch (parseError) {
        return res.status(400).json({ message: "Invalid banner description format" });
      }
    }

    // Validate banner title/description length (strip HTML tags first)
    for (const lang of ["en", "ru"]) {
      if (promoBannerTitleObj && promoBannerTitleObj[lang] && stripHtmlTags(promoBannerTitleObj[lang]).length > 80) {
        return res.status(400).json({ message: `Banner title (${lang.toUpperCase()}) must be 80 characters or less` });
      }
      if (promoBannerDescriptionObj && promoBannerDescriptionObj[lang] && stripHtmlTags(promoBannerDescriptionObj[lang]).length > 200) {
        return res.status(400).json({ message: `Banner description (${lang.toUpperCase()}) must be 200 characters or less` });
      }
    }

    // Validate dates
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    if (start && isNaN(start.getTime())) {
      return res.status(400).json({ message: "Invalid start date" });
    }

    if (end && isNaN(end.getTime())) {
      return res.status(400).json({ message: "Invalid end date" });
    }

    if (start && end && start > end) {
      return res
        .status(400)
        .json({ message: "Start date cannot be after end date" });
    }

    // Check for order conflict if order is being updated
    if (order && order !== promo.order) {
      const existingOrder = await Promo.findOne({
        order,
        _id: { $ne: promo._id },
      });
      if (existingOrder) {
        return res
          .status(400)
          .json({ message: "Order position already taken" });
      }
    }

    // Handle file upload if new file is provided, or removal if requested
    let fileUpdate = {};
    if (req.file) {
      let fileType;
      if (req.file.mimetype.includes("image")) {
        fileType = req.file.mimetype === "image/gif" ? "gif" : "image";
      } else if (req.file.mimetype.includes("video")) {
        fileType = "video";
        await checkVideoDuration(req.file.buffer, req.file.originalname);
      } else {
        return res.status(400).json({ message: "Invalid file type" });
      }

      // Upload new file to GridFS
      const gfs = getGfsPromos();
      const writeStream = gfs.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype,
      });
      writeStream.end(req.file.buffer);
      const fileId = await new Promise((resolve, reject) => {
        writeStream.on("finish", () => resolve(writeStream.id));
        writeStream.on("error", reject);
      });

      // Delete old file from GridFS
      try {
        await gfs.delete(new mongoose.Types.ObjectId(promo.fileId));
      } catch (err) {
      }

      fileUpdate = {
        fileId,
        fileType,
        filename: req.file.originalname,
      };
    } else if (removeFile === "true" && promo.fileId) {
      // Delete the existing file from GridFS and clear file fields
      try {
        const gfs = getGfsPromos();
        await gfs.delete(new mongoose.Types.ObjectId(promo.fileId));
      } catch (err) {
        // ignore if already deleted
      }
      fileUpdate = { fileId: null, fileType: null, filename: null };
    }

    // Update promo
    const updateData = {
      ...(order && { order: parseInt(order) }),
      ...(descriptionObj && { description: descriptionObj }),
      ...(startDate && { startDate: start }),
      ...(endDate !== undefined && { endDate: end }),
      ...(isActive !== undefined && {
        isActive: isActive === "true" || isActive === true,
      }),
      ...(startColor && { startColor }),
      ...(endColor && { endColor }),
      ...(promoBannerTitleObj && { promoBannerTitle: promoBannerTitleObj }),
      ...(promoBannerDescriptionObj && { promoBannerDescription: promoBannerDescriptionObj }),
      ...fileUpdate,
    };

    const updatedPromo = await Promo.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      message: "Promo updated successfully",
      promo: await formatPromoResponse(updatedPromo),
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Delete promo
const deletePromo = async (req, res) => {
  try {
    const promo = await Promo.findById(req.params.id);
    if (!promo) {
      return res.status(404).json({ message: "Promo not found" });
    }

    const gfs = getGfsPromos();
    try {
      await gfs.delete(new mongoose.Types.ObjectId(promo.fileId));
    } catch (err) {
    }

    await promo.deleteOne();
    res.json({ message: "Promo deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createPromo,
  streamPromoFile,
  getAllPromos,
  getActivePromos,
  getActivePromoById,
  reorderPromos,
  getPromoById,
  updatePromo,
  deletePromo,
};
