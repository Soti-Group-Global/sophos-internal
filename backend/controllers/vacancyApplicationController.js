const Vacancy = require("../models/Vacancy");
const VacancyApplication = require("../models/VacancyApplication");
const VacancyContactRequest = require("../models/VacancyContactRequest");

const { getGfsResumes } = require("../gridfs-resume");
const mongoose = require("mongoose");
const telegramBot = require("../services/telegramBot");
const maxBot = require("../services/maxBot");

// @desc    Submit job application
// @route   POST /api/vacancies/:id/apply
// @access  Public
exports.submitApplication = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const vacancy = await Vacancy.findById(req.params.id).session(session);

    if (!vacancy) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Vacancy not found",
      });
    }

    // Check if vacancy is published and open for applications
    if (vacancy.status !== "published") {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Vacancy not found or not accepting applications",
      });
    }

    // Check application deadline
    if (
      vacancy.applicationDeadline &&
      new Date() > vacancy.applicationDeadline
    ) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Application deadline has passed",
      });
    }

    // Check if already applied with this email
    const existingApplication = await VacancyApplication.findOne({
      jobPost: req.params.id,
      email: req.body.email,
    }).session(session);

    if (existingApplication) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "You have already applied for this position",
      });
    }

    // Handle file upload
    let resumeFileId = null;
    if (req.file) {
      const resumeFile = req.file;

      // Upload to GridFS
      resumeFileId = await new Promise((resolve, reject) => {
        const uploadStream = getGfsResumes().openUploadStream(
          resumeFile.originalname,
          {
            contentType: resumeFile.mimetype,
            metadata: {
              originalName: resumeFile.originalname,
              uploadedBy: req.body.email,
              uploadedAt: new Date(),
            },
          }
        );

        uploadStream.write(resumeFile.buffer);
        uploadStream.end();

        uploadStream.on("finish", () => {
          resolve(uploadStream.id);
        });

        uploadStream.on("error", (error) => {
          reject(error);
        });
      });
    } else {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Resume file is required",
      });
    }

    // Parse agreedToTerms - handle both string and boolean
    const agreedToTerms =
      req.body.agreedToTerms === "true" || req.body.agreedToTerms === true;

    // Create application data
    const applicationData = {
      firstName: req.body.firstName,
      middleName: req.body.middleName || "",
      lastName: req.body.lastName,
      email: req.body.email,
      phoneNumber: req.body.phoneNumber,
      resume: {
        fileId: resumeFileId,
      },
      agreedToTerms: agreedToTerms,
      jobPost: req.params.id,
    };


    // Create and save application
    const application = new VacancyApplication(applicationData);
    await application.save({ session });


    // Update application count
    await vacancy.incrementApplicationCount();

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      data: {
        id: application._id,
        fullName: application.fullName,
        email: application.email,
        submittedAt: application.submittedAt,
      },
      message: "Application submitted successfully",
    });

  } catch (error) {
    // Abort transaction on error
    await session.abortTransaction();
    session.endSession();

    res.status(400).json({
      success: false,
      message: "Error submitting application",    });
  }
};

// @desc    Get applications for a vacancy
// @route   GET /api/vacancies/:id/applications
// @access  Private
exports.getApplicationsByVacancy = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const applications = await VacancyApplication.getByJobPost(req.params.id, {
      page: parseInt(page),
      limit: parseInt(limit),
      status,
    });

    const total = await VacancyApplication.countDocuments({
      jobPost: req.params.id,
    });

    res.status(200).json({
      success: true,
      data: applications,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",    });
  }
};

// @desc    Get all applications
// @route   GET /api/vacancies/applications/all
// @access  Private
exports.getAllApplications = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, department } = req.query;

    let filter = {};
    if (status) filter.status = status;

    let query = VacancyApplication.find(filter)
      .sort({ submittedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate("jobPost", "title department location");

    if (department) {
      query = query.where("jobPost.department").equals(department);
    }

    const applications = await query.exec();
    const total = await VacancyApplication.countDocuments(filter);


    res.status(200).json({
      success: true,
      data: applications,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",    });
  }
};

// @desc    Get single application
// @route   GET /api/vacancies/applications/:applicationId
// @access  Private
exports.getApplication = async (req, res) => {
  try {
    const application = await VacancyApplication.findById(
      req.params.applicationId
    ).populate("jobPost", "title department location employmentType");

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    res.status(200).json({
      success: true,
      data: application,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",    });
  }
};

// @desc    Update application status
// @route   PUT /api/vacancies/applications/:applicationId/status
// @access  Private
exports.updateApplicationStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;

    const application = await VacancyApplication.findById(
      req.params.applicationId
    );

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    await application.updateStatus(status, notes);

    res.status(200).json({
      success: true,
      data: application,
      message: "Application status updated successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error updating application",    });
  }
};

// @desc    Get vacancy statistics
// @route   GET /api/vacancies/stats/overview
// @access  Private
exports.getVacancyStats = async (req, res) => {
  try {
    const totalVacancies = await Vacancy.countDocuments();
    const activeVacancies = await Vacancy.countDocuments({
      isActive: true,
      isPublished: true,
    });
    const totalApplications = await VacancyApplication.countDocuments();

    const applicationsByStatus = await VacancyApplication.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const vacanciesByDepartment = await Vacancy.aggregate([
      {
        $group: {
          _id: "$department",
          count: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalVacancies,
        activeVacancies,
        totalApplications,
        applicationsByStatus,
        vacanciesByDepartment,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",    });
  }
};

// @desc    Download resume file
// @route   GET /api/resumes/:fileId
// @access  Private
exports.downloadResume = async (req, res) => {
  try {
    // Validate file ID
    if (!mongoose.Types.ObjectId.isValid(req.params.fileId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid file ID",
      });
    }

    // Find the application that contains this resume file
    const application = await VacancyApplication.findOne({
      "resume.fileId": req.params.fileId,
    }).populate("jobPost", "title department");

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Resume not found",
      });
    }

    const gfsResumes = getGfsResumes();

    // Find the file in GridFS
    const files = await gfsResumes
      .find({ _id: new mongoose.Types.ObjectId(req.params.fileId) })
      .toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    const file = files[0];

    // Set response headers for download
    res.set({
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Content-Length": file.length,
      "Cache-Control": "no-cache",
    });

    // Create download stream
    const downloadStream = gfsResumes.openDownloadStream(file._id);

    // Handle stream events
    downloadStream.on("data", (chunk) => {
      res.write(chunk);
    });

    downloadStream.on("error", (error) => {
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Error downloading file",        });
      } else {
        res.end();
      }
    });

    downloadStream.on("end", () => {
      res.end();
    });

    // Handle client disconnect
    req.on("close", () => {
      downloadStream.destroy();
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",    });
  }
};


exports.getContactRequests = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      vacancyId,
      startDate,
      endDate,
      sortBy = "createdAt",
      sortOrder = "desc",
      search,
    } = req.query;

    // Build filter
    const filter = {};

    if (status) filter.status = status;
    if (vacancyId) filter.vacancyId = vacancyId;

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Search filter
    if (search) {
      filter.$or = [
        { phoneNumber: { $regex: search, $options: "i" } },
        { vacancyTitle: { $regex: search, $options: "i" } },
        { notes: { $regex: search, $options: "i" } },
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Sort
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Execute query
    const [contactRequests, total] = await Promise.all([
      VacancyContactRequest.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate({
          path: "vacancyId",
          select: "title.en title.ru department status",
        })
        .populate({
          path: "createdBy",
          select: "name email",
        })
        .populate({
          path: "updatedBy",
          select: "name email",
        })
        .lean(),
      VacancyContactRequest.countDocuments(filter),
    ]);

    // Calculate stats
    const stats = await VacancyContactRequest.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const statsMap = {};
    stats.forEach((stat) => {
      statsMap[stat._id] = stat.count;
    });

    res.json({
      success: true,
      data: {
        contactRequests,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
        stats: {
          total,
          pending: statsMap.pending || 0,
          contacted: statsMap.contacted || 0,
          resolved: statsMap.resolved || 0,
          spam: statsMap.spam || 0,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch contact requests",
    });
  }
};

exports.getContactRequest = async (req, res) => {
  try {
    const { requestId } = req.params;

    const contactRequest = await VacancyContactRequest.findById(requestId)
      .populate({
        path: "vacancyId",
        select:
          "title.en title.ru department location experienceLevel employmentType",
      })
      .populate({
        path: "createdBy",
        select: "name email",
      })
      .populate({
        path: "updatedBy",
        select: "name email",
      });

    if (!contactRequest) {
      return res.status(404).json({
        success: false,
        message: "Contact request not found",
      });
    }

    res.json({
      success: true,
      data: contactRequest,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch contact request",
    });
  }
};

exports.updateContactRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status, notes } = req.body;

    const updateData = {};

    if (status) {
      // Validate status
      const validStatuses = ["pending", "contacted", "resolved", "spam"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid status. Must be: pending, contacted, resolved, or spam",
        });
      }
      updateData.status = status;
    }

    if (notes !== undefined) updateData.notes = notes;

    // Add updatedBy information
    updateData.updatedBy = req.user._id;

    const updatedRequest = await VacancyContactRequest.findByIdAndUpdate(
      requestId,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .populate({
        path: "vacancyId",
        select: "title.en title.ru department",
      })
      .populate({
        path: "updatedBy",
        select: "name email",
      });

    if (!updatedRequest) {
      return res.status(404).json({
        success: false,
        message: "Contact request not found",
      });
    }

    res.json({
      success: true,
      message: "Contact request updated successfully",
      data: updatedRequest,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update contact request",
    });
  }
};

exports.deleteContactRequest = async (req, res) => {
  try {
    const { requestId } = req.params;

    const deletedRequest = await VacancyContactRequest.findByIdAndDelete(
      requestId
    );

    if (!deletedRequest) {
      return res.status(404).json({
        success: false,
        message: "Contact request not found",
      });
    }

    res.json({
      success: true,
      message: "Contact request deleted successfully",
      data: {
        requestId: deletedRequest._id,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete contact request",
    });
  }
};

exports.submitContactRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { phoneNumber } = req.body;

    // Validation
    if (!phoneNumber || phoneNumber.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    // Basic phone validation
    const cleanPhone = phoneNumber.replace(/\D/g, "");

    if (cleanPhone.length < 10) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid phone number (minimum 10 digits)",
      });
    }

    // Check if vacancy exists and is published
    const vacancy = await Vacancy.findById(id);

    if (!vacancy) {
      return res.status(404).json({
        success: false,
        message: "Vacancy not found",
      });
    }

    if (vacancy.status !== "published") {
      return res.status(400).json({
        success: false,
        message: "This vacancy is not currently accepting contact requests",
      });
    }

    // Check for duplicate request in last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existingRequest = await VacancyContactRequest.findOne({
      phoneNumber: cleanPhone,
      vacancyId: id,
      createdAt: { $gte: twentyFourHoursAgo },
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message:
          "You have already submitted a contact request for this vacancy in the last 24 hours",
      });
    }

    // Create contact request
    const contactRequest = new VacancyContactRequest({
      vacancyId: id,
      phoneNumber: cleanPhone,
      vacancyTitle: vacancy.title.en || vacancy.title.ru || "Vacancy",
      status: "pending",
    });

    await contactRequest.save();

    // Update vacancy contact count
    await Vacancy.findByIdAndUpdate(id, {
      $inc: { contactCount: 1 },
    });

    // Send Telegram notification
    try {
      await telegramBot.sendVacancyContactNotification({
        ...contactRequest.toObject(),
        vacancyTitle: vacancy.title,
        department: vacancy.department,
        location: vacancy.location
      });
      await maxBot.sendVacancyContactNotification({
        ...contactRequest.toObject(),
        vacancyTitle: vacancy.title,
        department: vacancy.department,
        location: vacancy.location
      });
    } catch (telegramError) {
      // Don't fail the request if Telegram notification fails
    }

    res.status(201).json({
      success: true,
      message: "Thank you! We will contact you soon.",
      data: {
        requestId: contactRequest._id,
        submittedAt: contactRequest.createdAt,
      },
    });
  } catch (error) {

    // Handle specific errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors,
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate contact request",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};



exports.getContactRequestsByVacancy = async (req, res) => {
  try {
    const { vacancyId } = req.params;
    const { status, search } = req.query;

    // Build filter - always include vacancyId from params
    const filter = { vacancyId };

    if (status) filter.status = status;

    // Search filter
    if (search) {
      filter.$or = [
        { phoneNumber: { $regex: search, $options: 'i' } },
        { vacancyTitle: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ];
    }

    // Execute query - NO PAGINATION
    const contactRequests = await VacancyContactRequest.find(filter)
      .sort({ createdAt: -1 }) // Sort by newest first
      .populate({
        path: 'vacancyId',
        select: 'title.en title.ru department status'
      })
      .populate({
        path: 'createdBy',
        select: 'name email'
      })
      .populate({
        path: 'updatedBy',
        select: 'name email'
      })
      .lean();

    // Get total count for stats
    const total = await VacancyContactRequest.countDocuments(filter);

    // Calculate stats for this vacancy - FIX THIS LINE
    const stats = await VacancyContactRequest.aggregate([
      { $match: { vacancyId: new mongoose.Types.ObjectId(vacancyId) } }, // ADD 'new' keyword
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statsMap = {};
    stats.forEach(stat => {
      statsMap[stat._id] = stat.count;
    });

    res.json({
      success: true,
      data: {
        contactRequests, // Return all contacts, no pagination
        stats: {
          total,
          pending: statsMap.pending || 0,
          contacted: statsMap.contacted || 0,
          resolved: statsMap.resolved || 0,
          spam: statsMap.spam || 0
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contact requests'
    });
  }
};