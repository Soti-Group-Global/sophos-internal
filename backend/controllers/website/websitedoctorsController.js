const DoctorsProfile = require("../../models/DoctorsProfile");
const mongoose = require("mongoose");
const { getGfs } = require("../../gridfs");

// Helper function to get image data from GridFS
const getImageData = async (fileId) => {
  try {
    if (!fileId || !mongoose.Types.ObjectId.isValid(fileId)) {
      return null;
    }

    const gfs = getGfs();
    const file = await gfs
      .find({ _id: new mongoose.Types.ObjectId(fileId) })
      .toArray();

    if (file.length === 0) {
      return null;
    }

    const readStream = gfs.openDownloadStream(file[0]._id);
    const chunks = [];

    return new Promise((resolve, reject) => {
      readStream.on("data", (chunk) => chunks.push(chunk));
      readStream.on("end", () => {
        const base64Image = Buffer.concat(chunks).toString("base64");
        const imageUrl = `data:${file[0].contentType};base64,${base64Image}`;

        resolve({
          imageUrl,
          profilePicture: base64Image,
          contentType: file[0].contentType,
          filename: file[0].filename,
        });
      });
      readStream.on("error", (error) => {
        resolve(null); // Return null instead of rejecting to prevent breaking the entire request
      });
    });
  } catch (error) {
    return null;
  }
};

// @desc    Get all doctors with filtering for website (with image data)
// @route   GET /api/website/doctors
// @access  Public
const getWebsiteDoctors = async (req, res) => {
  try {
    const {
      type,
      specialization,
      specialtyId,
      search,
      branch,
      language = "en",
      status = "active",
      page = 1,
      limit = 12,
      expert,
      specialist,
      doctorType
    } = req.query;


    // Build filter object
    let filter = { status };

    // Filter by service type (online/offline)
    if (type === "Personal") {
      filter["services.offline"] = true;
    } else if (type === "Remote") {
      filter["services.online"] = true;
    }

    // Filter by specialty ID (more efficient - direct MongoDB filter)
    if (specialtyId && specialtyId !== "All") {
      if (mongoose.Types.ObjectId.isValid(specialtyId)) {
        filter.specialtyIds = new mongoose.Types.ObjectId(specialtyId);
      }
    }
    // Fallback to specialty name filtering if specialtyId not provided
    else if (specialization && specialization !== "All") {
      // We'll filter after populate since we need to search in populated specialty names
      filter._specialization = specialization; // Store for later filtering
    }

    // Filter by expert status / doctor type
    if (expert === "true" || doctorType === "expert") {
      filter.expert = true;
    } else if (specialist === "true" || doctorType === "specialist") {
      filter.expert = { $ne: true };
    }

    // Filter by branch (accepts: "Makhachkala" / "Moscow" or full clinic labels)
    if (branch && branch !== "All") {
      const raw = String(branch).trim();
      const key = raw.toLowerCase();

      let enPattern = raw;
      let ruPattern = raw;

      if (key.includes("moscow")) {
        enPattern = "Moscow";
        ruPattern = "Москва";
      } else if (key.includes("makhachkala")) {
        enPattern = "Makhachkala";
        ruPattern = "Махачкала";
      }

      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { "branches.en": { $regex: enPattern, $options: "i" } },
          { "branches.ru": { $regex: ruPattern, $options: "i" } },
        ],
      });
    }

    // Search across multiple fields
    if (search) {
      filter.$or = [
        { [`firstName.${language}`]: { $regex: search, $options: "i" } },
        { [`lastName.${language}`]: { $regex: search, $options: "i" } },
        { [`middleName.${language}`]: { $regex: search, $options: "i" } },
        { [`about.${language}`]: { $regex: search, $options: "i" } },
        { [`placeOfWork.${language}`]: { $regex: search, $options: "i" } },
      ];
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;


    // Execute query with pagination
    let doctors = await DoctorsProfile.find(filter)
      .populate('specialtyIds', 'name_en name_ru')
      .populate('subSpecialityIds', 'name_en name_ru')
      .select(
        "-professionalOrganizations -awards -videoUrl -workExperience -education -scientificActivities -teachingActivity"
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Apply post-query filtering for specialty name if needed
    if (filter._specialization) {
      doctors = doctors.filter(doctor => {
        if (!doctor.specialtyIds || doctor.specialtyIds.length === 0) return false;
        return doctor.specialtyIds.some(specialty => {
          const specialtyName = language === 'ru' ? specialty.name_ru : specialty.name_en;
          return specialtyName && specialtyName.toLowerCase().includes(filter._specialization.toLowerCase());
        });
      });
    }

    // Get total count for pagination (adjust for post-filtering if needed)
    let total;
    if (filter._specialization) {
      // For name-based filtering, we need to count after populate and filter
      const allDoctors = await DoctorsProfile.find({ 
        ...filter, 
        _specialization: undefined // Remove the custom filter flag
      })
        .populate('specialtyIds', 'name_en name_ru')
        .lean();
      
      const filteredDoctors = allDoctors.filter(doctor => {
        if (!doctor.specialtyIds || doctor.specialtyIds.length === 0) return false;
        return doctor.specialtyIds.some(specialty => {
          const specialtyName = language === 'ru' ? specialty.name_ru : specialty.name_en;
          return specialtyName && specialtyName.toLowerCase().includes(filter._specialization.toLowerCase());
        });
      });
      total = filteredDoctors.length;
    } else {
      total = await DoctorsProfile.countDocuments(filter);
    }
    const totalPages = Math.ceil(total / limitNum);

    // Process doctors with image data
    const doctorsWithImages = await Promise.all(
      doctors.map(async (doctor) => {
        let imageData = null;

        // If profileFileId exists, fetch image data
        if (doctor.profileFileId) {
          imageData = await getImageData(doctor.profileFileId);
        }

        // Format specialty data
        const specialties = doctor.specialtyIds ? doctor.specialtyIds.map(s => ({
          id: s._id,
          name: language === 'ru' ? s.name_ru : s.name_en
        })) : [];

        const subSpecialties = doctor.subSpecialityIds ? doctor.subSpecialityIds.map(s => ({
          id: s._id,
          name: language === 'ru' ? s.name_ru : s.name_en
        })) : [];

        // Generate public image URL for SEO
        const baseUrl = process.env.API_BASE_URL || req.protocol + '://' + req.get('host');
        const publicImageUrl = doctor.publicImagePath 
          ? `${baseUrl}${doctor.publicImagePath}`
          : (doctor.profileFileId ? `${baseUrl}/api/website/doctors/profile-image/${doctor.profileFileId}` : null);

        return {
          id: doctor._id,
          slug: doctor.slug,
          firstName: doctor.firstName,
          lastName: doctor.lastName,
          middleName: doctor.middleName,
          specialties: specialties,
          subSpecialties: subSpecialties,
          placeOfWork: doctor.placeOfWork,
          description: doctor.position,
          location: doctor.location,
          languages: doctor.languages,
          services: doctor.services,
          about: doctor.about,
          yearOfExperience: doctor.yearOfExperience,
          expert: doctor.expert, // Include expert field in the response
          imageUrl: imageData ? imageData.imageUrl : doctor.imageUrl,
          publicImageUrl: publicImageUrl, // Direct URL for SEO meta tags
          profilePicture: imageData ? imageData.profilePicture : null,
          profileFileId: doctor.profileFileId,
          feesAmount: doctor.feesAmount,
          currency: doctor.currency,
          reviewStats: doctor.reviewStats,
          status: doctor.status,
          createdAt: doctor.createdAt,
        };
      })
    );


    res.json({
      success: true,
      data: doctorsWithImages,
      pagination: {
        current: pageNum,
        total: totalPages,
        totalDoctors: total,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Server error while fetching doctors",
      message: "Unable to load doctors list. Please try again later.",
    });
  }
};

// @desc    Get all unique specializations for website
// @route   GET /api/website/doctors/specializations
// @access  Public
const getWebsiteSpecializations = async (req, res) => {
  try {
    const { language = "en", branch, doctorType } = req.query;
    const matchStage = { status: "active" };

    // Filter by doctor type
    if (doctorType === "expert") {
      matchStage.expert = true;
    } else if (doctorType === "specialist") {
      matchStage.expert = { $ne: true };
    }

    // Optional branch filter (accepts: "Makhachkala" / "Moscow" or full clinic labels)
    if (branch && branch !== "All") {
      const raw = String(branch).trim();
      const key = raw.toLowerCase();

      let enPattern = raw;
      let ruPattern = raw;

      if (key.includes("moscow")) {
        enPattern = "Moscow";
        ruPattern = "Москва";
      } else if (key.includes("makhachkala")) {
        enPattern = "Makhachkala";
        ruPattern = "Махачкала";
      }

      matchStage.$and = matchStage.$and || [];
      matchStage.$and.push({
        $or: [
          { "branches.en": { $regex: enPattern, $options: "i" } },
          { "branches.ru": { $regex: ruPattern, $options: "i" } },
        ],
      });
    }

    const specializations = await DoctorsProfile.aggregate([
      { $match: matchStage },
      { $unwind: "$specialtyIds" },
      {
        $lookup: {
          from: "specialtymasters",
          localField: "specialtyIds",
          foreignField: "_id",
          as: "specialty"
        }
      },
      { $unwind: "$specialty" },
      {
        $group: {
          _id: {
            specialtyId: "$specialty._id",
            name: language === 'ru' ? "$specialty.name_ru" : "$specialty.name_en"
          },
          count: { $sum: 1 },
        },
      },
      { $match: { "_id.name": { $ne: null, $ne: "" } } },
      { $sort: { count: -1, "_id.name": 1 } },
    ]);

    const formattedSpecializations = specializations.map((spec, index) => ({
      id: `specialization${index + 1}`,
      specialtyId: spec._id.specialtyId,
      label: spec._id.name,
      count: spec.count,
    }));

    res.json({
      success: true,
      data: formattedSpecializations,
      total: formattedSpecializations.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Server error while fetching specializations",
      message: "Unable to load specializations. Please try again later.",
    });
  }
};

// @desc    Get single doctor by ID for website (with full image data)
// @route   GET /api/website/doctors/:id
// @access  Public
const getWebsiteDoctorById = async (req, res) => {
  try {
    const doctor = await DoctorsProfile.findById(req.params.id)
      .populate('specialtyIds', 'name_en name_ru')
      .populate('subSpecialityIds', 'name_en name_ru');

    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: "Doctor not found",
        message: "The requested doctor profile was not found.",
      });
    }

    let imageData = null;

    // If profileFileId exists, fetch image data
    if (doctor.profileFileId) {
      imageData = await getImageData(doctor.profileFileId);
    }

    // Format specialty data
    const specialties = doctor.specialtyIds ? doctor.specialtyIds.map(s => ({
      id: s._id,
      name_en: s.name_en,
      name_ru: s.name_ru
    })) : [];

    const subSpecialties = doctor.subSpecialityIds ? doctor.subSpecialityIds.map(s => ({
      id: s._id,
      name_en: s.name_en,
      name_ru: s.name_ru
    })) : [];

    // Generate public image URL for SEO
    const baseUrl = process.env.API_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const publicImageUrl = doctor.publicImagePath 
      ? `${baseUrl}${doctor.publicImagePath}`
      : (doctor.profileFileId ? `${baseUrl}/api/website/doctors/profile-image/${doctor.profileFileId}` : null);

    // Format response for website
    const formattedDoctor = {
      id: doctor._id,
      slug: doctor.slug,
      firstName: doctor.firstName,
      lastName: doctor.lastName,
      middleName: doctor.middleName,
      dateOfBirth: doctor.dateOfBirth,
      gender: doctor.gender,
      age: doctor.age,
      email: doctor.email,
      phoneNumber: doctor.phoneNumber,
      specialties: specialties,
      subSpecialties: subSpecialties,
      position: doctor.position,
      regalia: doctor.regalia,
      location: doctor.location,
      languages: doctor.languages,
      services: doctor.services,
      branches: doctor.branches,
      yearOfExperience: doctor.yearOfExperience,
      about: doctor.about,
      workExperience: doctor.workExperience,
      education: doctor.education,
      advancedTraining: doctor.advancedTraining,
      scientificActivities: doctor.scientificActivities,
      internationalMemberships: doctor.internationalMemberships,
      russianMemberships: doctor.russianMemberships,
      professionalDevelopments: doctor.professionalDevelopments,
      awards: doctor.awards,
      imageUrl: imageData
        ? imageData.imageUrl
        : (doctor.imageUrl || doctor.photo || null),
      publicImageUrl: publicImageUrl, // Direct URL for SEO meta tags
      profilePicture: imageData ? imageData.profilePicture : null,
      profileFileId: doctor.profileFileId || null,
      photo: doctor.photo || null, // Direct photo field
      videoUrl: doctor.videoUrl,
      feesAmount: doctor.feesAmount,
      currency: doctor.currency,
      reviewStats: doctor.reviewStats,
      status: doctor.status,
      createdAt: doctor.createdAt,
      updatedAt: doctor.updatedAt,
    };

    res.json({
      success: true,
      data: formattedDoctor,
    });
  } catch (error) {

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        error: "Invalid doctor ID",
        message: "The provided doctor ID is invalid.",
      });
    }

    res.status(500).json({
      success: false,
      error: "Server error while fetching doctor",
      message: "Unable to load doctor profile. Please try again later.",
    });
  }
};

// @desc    Get single doctor by slug for website (with full image data)
// @route   GET /api/website/doctors/slug/:slug
// @access  Public
const getWebsiteDoctorBySlug = async (req, res) => {
  try {
    const doctor = await DoctorsProfile.findOne({ slug: req.params.slug })
      .populate('specialtyIds', 'name_en name_ru')
      .populate('subSpecialityIds', 'name_en name_ru');

    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: "Doctor not found",
        message: "The requested doctor profile was not found.",
      });
    }

    let imageData = null;

    // If profileFileId exists, fetch image data
    if (doctor.profileFileId) {
      imageData = await getImageData(doctor.profileFileId);
    }

    // Format specialty data
    const specialties = doctor.specialtyIds ? doctor.specialtyIds.map(s => ({
      id: s._id,
      name_en: s.name_en,
      name_ru: s.name_ru
    })) : [];

    const subSpecialties = doctor.subSpecialityIds ? doctor.subSpecialityIds.map(s => ({
      id: s._id,
      name_en: s.name_en,
      name_ru: s.name_ru
    })) : [];

    // Generate public image URL for SEO
    const baseUrl = process.env.API_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const publicImageUrl = doctor.publicImagePath 
      ? `${baseUrl}${doctor.publicImagePath}`
      : (doctor.profileFileId ? `${baseUrl}/api/website/doctors/profile-image/${doctor.profileFileId}` : null);

    // Format response for website
    const formattedDoctor = {
      id: doctor._id,
      slug: doctor.slug,
      firstName: doctor.firstName,
      lastName: doctor.lastName,
      middleName: doctor.middleName,
      dateOfBirth: doctor.dateOfBirth,
      gender: doctor.gender,
      age: doctor.age,
      email: doctor.email,
      phoneNumber: doctor.phoneNumber,
      specialties: specialties,
      subSpecialties: subSpecialties,
      position: doctor.position,
      regalia: doctor.regalia,
      location: doctor.location,
      languages: doctor.languages,
      services: doctor.services,
      branches: doctor.branches,
      yearOfExperience: doctor.yearOfExperience,
      about: doctor.about,
      workExperience: doctor.workExperience,
      education: doctor.education,
      advancedTraining: doctor.advancedTraining,
      scientificActivities: doctor.scientificActivities,
      internationalMemberships: doctor.internationalMemberships,
      russianMemberships: doctor.russianMemberships,
      professionalDevelopments: doctor.professionalDevelopments,
      awards: doctor.awards,
      imageUrl: imageData
        ? imageData.imageUrl
        : (doctor.imageUrl || doctor.photo || null),
      publicImageUrl: publicImageUrl, // Direct URL for SEO meta tags
      profilePicture: imageData ? imageData.profilePicture : null,
      profileFileId: doctor.profileFileId || null,
      photo: doctor.photo || null, // Direct photo field
      videoUrl: doctor.videoUrl,
      feesAmount: doctor.feesAmount,
      currency: doctor.currency,
      reviewStats: doctor.reviewStats,
      status: doctor.status,
      createdAt: doctor.createdAt,
      updatedAt: doctor.updatedAt,
    };

    res.json({
      success: true,
      data: formattedDoctor,
    });
  } catch (error) {

    res.status(500).json({
      success: false,
      error: "Server error while fetching doctor",
      message: "Unable to load doctor profile. Please try again later.",
    });
  }
};

// @desc    Get website doctor statistics
// @route   GET /api/website/doctors/stats/summary
// @access  Public
const getWebsiteDoctorStats = async (req, res) => {
  try {
    const stats = await DoctorsProfile.aggregate([
      {
        $facet: {
          totalDoctors: [{ $match: { status: "active" } }, { $count: "count" }],
          byServiceType: [
            { $match: { status: "active" } },
            {
              $group: {
                _id: null,
                online: {
                  $sum: { $cond: [{ $eq: ["$services.online", true] }, 1, 0] },
                },
                offline: {
                  $sum: { $cond: [{ $eq: ["$services.offline", true] }, 1, 0] },
                },
                both: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ["$services.online", true] },
                          { $eq: ["$services.offline", true] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ],
          topSpecializations: [
            { $match: { status: "active" } },
            { $unwind: "$specialtyIds" },
            {
              $lookup: {
                from: "specialtymasters",
                localField: "specialtyIds",
                foreignField: "_id",
                as: "specialty"
              }
            },
            { $unwind: "$specialty" },
            {
              $group: {
                _id: "$specialty.name_en",
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 10 },
          ],
          topRatedDoctors: [
            {
              $match: {
                status: "active",
                "reviewStats.averageRating": { $gte: 4 },
              },
            },
            { $sort: { "reviewStats.averageRating": -1 } },
            { $limit: 5 },
            {
              $project: {
                name: { $concat: ["$firstName.en", " ", "$lastName.en"] },
                rating: "$reviewStats.averageRating",
                reviews: "$reviewStats.totalReviews",
              },
            },
          ],
        },
      },
    ]);

    const formattedStats = {
      total: stats[0].totalDoctors[0]?.count || 0,
      services: stats[0].byServiceType[0] || { online: 0, offline: 0, both: 0 },
      topSpecializations: stats[0].topSpecializations,
      topRated: stats[0].topRatedDoctors,
    };

    res.json({
      success: true,
      data: formattedStats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Server error while fetching statistics",
      message: "Unable to load statistics. Please try again later.",
    });
  }
};

// @desc    Search doctors for website search functionality (with image data)
// @route   GET /api/website/doctors/search/suggestions
// @access  Public
const getSearchSuggestions = async (req, res) => {
  try {
    const { q, language = "en" } = req.query;

    if (!q || q.length < 2) {
      return res.json({
        success: true,
        data: [],
        message: "Please enter at least 2 characters for search",
      });
    }

    const doctors = await DoctorsProfile.find({
      status: "active",
      $or: [
        { [`firstName.${language}`]: { $regex: q, $options: "i" } },
        { [`lastName.${language}`]: { $regex: q, $options: "i" } },
      ],
    })
      .populate('specialtyIds', 'name_en name_ru')
      .select("firstName lastName specialtyIds profileFileId imageUrl reviewStats")
      .limit(10)
      .lean();

    // Process doctors with image data for search suggestions
    const suggestionsWithImages = await Promise.all(
      doctors.map(async (doctor) => {
        let imageData = null;

        // If profileFileId exists, fetch image data
        if (doctor.profileFileId) {
          imageData = await getImageData(doctor.profileFileId);
        }

        const specialtyName = doctor.specialtyIds && doctor.specialtyIds.length > 0
          ? (language === 'ru' ? doctor.specialtyIds[0].name_ru : doctor.specialtyIds[0].name_en)
          : 'General Medicine';

        return {
          id: doctor._id,
          name: `${doctor.firstName[language]} ${doctor.lastName[language]}`,
          specialty: specialtyName,
          // Use image data from GridFS if available, otherwise fallback to imageUrl
          imageUrl: imageData ? imageData.imageUrl : doctor.imageUrl,
          rating: doctor.reviewStats?.averageRating,
        };
      })
    );

    res.json({
      success: true,
      data: suggestionsWithImages,
      total: suggestionsWithImages.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Server error while fetching search suggestions",
      message: "Unable to load search results. Please try again later.",
    });
  }
};

// @desc    Get doctor profile image by fileId (returns JSON with base64)
// @route   GET /api/website/doctors/image/:fileId
// @access  Public
const getDoctorProfileImage = async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid file ID",
      });
    }

    const imageData = await getImageData(fileId);

    if (!imageData) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    res.json({
      success: true,
      imageUrl: imageData.imageUrl,
      profilePicture: imageData.profilePicture,
      contentType: imageData.contentType,
      filename: imageData.filename,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching image",    });
  }
};

// @desc    Serve doctor profile image directly as file (for SEO, meta tags, direct access)
// @route   GET /api/website/doctors/profile-image/:fileId
// @access  Public
const serveDoctorProfileImageFile = async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).send("Invalid file ID");
    }

    const gfs = getGfs();
    const file = await gfs
      .find({ _id: new mongoose.Types.ObjectId(fileId) })
      .toArray();

    if (file.length === 0) {
      return res.status(404).send("Image not found");
    }

    // Set proper headers for image serving
    res.set("Content-Type", file[0].contentType);
    res.set("Content-Disposition", `inline; filename="${file[0].filename}"`);
    res.set("Cache-Control", "public, max-age=31536000"); // Cache for 1 year
    res.set("Access-Control-Allow-Origin", "*"); // Allow cross-origin access for SEO

    // Stream the image directly to response
    const readStream = gfs.openDownloadStream(file[0]._id);
    readStream.pipe(res);
    
    readStream.on("error", (error) => {
      if (!res.headersSent) {
        res.status(500).send("Error serving image");
      }
    });
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).send("Error serving image");
    }
  }
};

// Helper function to get specialization labels for filtering
const getSpecializationLabels = async () => {
  const specializations = await DoctorsProfile.aggregate([
    { $match: { status: "active" } },
    { $unwind: "$specialtyIds" },
    {
      $lookup: {
        from: "specialtymasters",
        localField: "specialtyIds",
        foreignField: "_id",
        as: "specialty"
      }
    },
    { $unwind: "$specialty" },
    {
      $group: {
        _id: "$specialty.name_en",
      },
    },
    { $match: { _id: { $ne: null, $ne: "" } } },
  ]);

  return specializations.map((spec, index) => ({
    id: `specialization${index + 1}`,
    label: spec._id,
  }));
};

module.exports = {
  getWebsiteDoctors,
  getWebsiteSpecializations,
  getWebsiteDoctorById,
  getWebsiteDoctorBySlug,
  getWebsiteDoctorStats,
  getSearchSuggestions,
  getDoctorProfileImage,
  serveDoctorProfileImageFile,
};
