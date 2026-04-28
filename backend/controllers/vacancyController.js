const Vacancy = require('../models/Vacancy');
const VacancyApplication = require('../models/VacancyApplication');

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
  } else if (key === "spb" || key.includes("petersburg") || key.includes("saint")) {
    values.add("Saint Petersburg Clinic");
    values.add("Клиника Санкт-Петербург");
    values.add("Санкт-Петербург");
  }

  return { $in: Array.from(values) };
};

// @desc    Get all vacancies
// @route   GET /api/vacancies
// @access  Public/Private
exports.getVacancies = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      department,
      employmentType,
      branch,
      status, // Optional status filter
      lang = 'en' // Language parameter
    } = req.query;

    const filter = {};

    // Add filters if provided
    if (department) filter['department.en'] = department; // Update for multilingual
    if (employmentType) filter.employmentType = employmentType;

    const branchQuery = getBranchQuery(branch);
    if (branchQuery) {
      filter.branch = branchQuery;
    }

    // Status filter - optional, if not provided, get ALL statuses
    if (status) {
      const statuses = status.split(',');
      if (statuses.length > 1) {
        filter.status = { $in: statuses };
      } else {
        filter.status = status;
      }
    }
    // If no status filter provided, get ALL vacancies (all statuses)

    const vacancies = await Vacancy.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    const total = await Vacancy.countDocuments(filter);

    // Convert to localized data
    const localizedVacancies = vacancies.map(vacancy =>
      vacancy.getLocalizedData(lang)
    );

    res.status(200).json({
      success: true,
      data: localizedVacancies,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get single vacancy
// @route   GET /api/vacancies/:id
// @access  Public
exports.getVacancy = async (req, res) => {
  try {
    const vacancy = await Vacancy.findById(req.params.id);

    if (!vacancy) {
      return res.status(404).json({
        success: false,
        message: 'Vacancy not found'
      });
    }

    await vacancy.incrementViewCount();

    // Return FULL multilingual structure for editing
    res.status(200).json({
      success: true,
      data: {
        _id: vacancy._id,
        // Multilingual fields
        title: vacancy.title || { en: "", ru: "" },
        department: vacancy.department || { en: "", ru: "" },
        location: vacancy.location || { en: "", ru: "" },
        description: vacancy.description || { en: "", ru: "" },
        requirements: vacancy.requirements || { en: "", ru: "" },
        responsibilities: vacancy.responsibilities || { en: "", ru: "" },
        possibilities: vacancy.possibilities || { en: "", ru: "" },
        otherEmploymentType: vacancy.otherEmploymentType || { en: "", ru: "" },
        experienceLevel: vacancy.experienceLevel && typeof vacancy.experienceLevel === 'object'
          ? {
            en: vacancy.experienceLevel.en || "",
            ru: vacancy.experienceLevel.ru || ""
          }
          : { en: vacancy.experienceLevel || "", ru: "" },
        salary: vacancy.salary && typeof vacancy.salary === 'object'
          ? { en: vacancy.salary.en || "", ru: vacancy.salary.ru || "" }
          : { en: vacancy.salary || "", ru: "" },
        schedule: vacancy.schedule && typeof vacancy.schedule === 'object'
          ? { en: vacancy.schedule.en || "", ru: vacancy.schedule.ru || "" }
          : { en: vacancy.schedule || "", ru: "" },
        selectionStage: vacancy.selectionStage && typeof vacancy.selectionStage === 'object'
          ? { en: vacancy.selectionStage.en || "", ru: vacancy.selectionStage.ru || "" }
          : { en: vacancy.selectionStage || "", ru: "" },

        // Single value fields
        employmentType: vacancy.employmentType || "",
        branch: vacancy.branch || [],
        applicationDeadline: vacancy.applicationDeadline || null,
        status: vacancy.status || "draft",
        showApplyButton: vacancy.showApplyButton !== false,
        viewCount: vacancy.viewCount || 0,
        applicationCount: vacancy.applicationCount || 0,
        publishedAt: vacancy.publishedAt || null,
        createdAt: vacancy.createdAt,
        createdBy: vacancy.createdBy,

        // Also include localized version if needed
        localized: vacancy.getLocalizedData(req.query.lang || 'en')
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Create new vacancy
// @route   POST /api/vacancies
// @access  Private
exports.createVacancy = async (req, res) => {
  try {

    // Deep debug: Check the exact structure
    if (req.body.possibilities) {
    }

    // Prepare the data with guaranteed string values
    const vacancyData = {
      createdBy: req.user?.id || new mongoose.Types.ObjectId(), // For testing
    };

    const branch = normalizeBranch(req.body.branch);
    if (branch !== undefined) {
      vacancyData.branch = branch;
    }

    // List of all multilingual fields
    const multilingualFields = [
      'title', 'department', 'location', 'description',
      'requirements', 'responsibilities', 'possibilities',
      'otherEmploymentType', 'experienceLevel', 'salary', 'schedule', 'selectionStage'
    ];

    // Process each field to ensure proper string values
    multilingualFields.forEach(field => {
      if (req.body[field]) {
        // Force conversion to proper object with string values
        const fieldValue = req.body[field];

        if (typeof fieldValue === 'string') {
          // If it's a string, use it for both languages
          vacancyData[field] = {
            en: fieldValue,
            ru: fieldValue
          };
        } else if (typeof fieldValue === 'object') {
          // Ensure we have string values, not objects
          vacancyData[field] = {
            en: typeof fieldValue.en === 'string' ? fieldValue.en :
              (fieldValue.en ? String(fieldValue.en) : ""),
            ru: typeof fieldValue.ru === 'string' ? fieldValue.ru :
              (fieldValue.ru ? String(fieldValue.ru) : "")
          };
        }
      } else {
        // Provide empty object for required fields
        if (field === 'title') {
          vacancyData[field] = { en: "", ru: "" };
        }
      }
    });

    // Add non-multilingual fields
    const simpleFields = [
      'employmentType', 'salary', 'salaryRange',
      'applicationDeadline', 'status', 'showApplyButton'
    ];

    simpleFields.forEach(field => {
      if (req.body[field] !== undefined && req.body[field] !== '') {
        vacancyData[field] = req.body[field];
      }
    });

    // Create and validate
    const vacancy = new Vacancy(vacancyData);

    // Manual validation
    try {
      await vacancy.validate();
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: validationError.message,
        details: validationError.errors
      });
    }

    await vacancy.save();

    res.status(201).json({
      success: true,
      data: vacancy,
      message: 'Vacancy created successfully'
    });
  } catch (error) {

    if (error.name === 'ValidationError') {
      const errorMessages = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message,
        value: err.value
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: error.message,
        validationErrors: errorMessages
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating vacancy',
      error: error.message
    });
  }
};

// @desc    Update vacancy
// @route   PUT /api/vacancies/:id
// @access  Private
exports.updateVacancy = async (req, res) => {
  try {
    const vacancy = await Vacancy.findById(req.params.id);

    if (!vacancy) {
      return res.status(404).json({
        success: false,
        message: 'Vacancy not found'
      });
    }

    // Normalize legacy string values for multilingual fields before applying updates
    ['salary', 'experienceLevel', 'schedule', 'selectionStage'].forEach((field) => {
      if (vacancy[field] && typeof vacancy[field] === 'string') {
        vacancy[field] = { en: vacancy[field], ru: '' };
      } else if (!vacancy[field]) {
        vacancy[field] = { en: '', ru: '' };
      }
    });

    // Process multilingual updates
    const multilingualFields = ['title', 'department', 'location', 'description', 'requirements', 'responsibilities', 'possibilities', 'otherEmploymentType', 'experienceLevel', 'salary', 'schedule', 'selectionStage'];

    multilingualFields.forEach(field => {
      if (req.body[field]) {
        // If updating specific language
        if (typeof req.body[field] === 'object') {
          Object.keys(req.body[field]).forEach(lang => {
            vacancy.setLocalizedText(field, lang, req.body[field][lang]);
          });
        } else {
          // If updating both languages with same value (backward compatibility)
          vacancy.setLocalizedText(field, 'en', req.body[field]);
          vacancy.setLocalizedText(field, 'ru', req.body[field]);
        }
      }
    });

    // Update non-multilingual fields
    const nonMultilingualFields = [
      'employmentType',
      'salaryRange',
      'applicationDeadline',
      'status',
      'showApplyButton' // Added the new field
    ];

    nonMultilingualFields.forEach(field => {
      if (req.body[field] !== undefined) {
        vacancy[field] = req.body[field];
      }
    });

    if (req.body.branch !== undefined) {
      vacancy.branch = normalizeBranch(req.body.branch) || [];
    }

    await vacancy.save();

    res.status(200).json({
      success: true,
      data: vacancy,
      message: 'Vacancy updated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating vacancy',
      error: error.message
    });
  }
};

// @desc    Delete vacancy
// @route   DELETE /api/vacancies/:id
// @access  Private
exports.deleteVacancy = async (req, res) => {
  try {
    const vacancy = await Vacancy.findByIdAndDelete(req.params.id);

    if (!vacancy) {
      return res.status(404).json({
        success: false,
        message: 'Vacancy not found'
      });
    }

    // Delete all associated applications
    await VacancyApplication.deleteMany({ jobPost: req.params.id });

    res.status(200).json({
      success: true,
      message: 'Vacancy deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Search vacancies
// @route   GET /api/vacancies/search
// @access  Public
exports.searchVacancies = async (req, res) => {
  try {
    const { q: query, lang = 'en', page = 1, limit = 10 } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const vacancies = await Vacancy.search(query, lang)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Vacancy.countDocuments({
      $and: [
        {
          status: 'published',
          $or: [
            { applicationDeadline: { $gte: new Date() } },
            { applicationDeadline: null }
          ]
        },
        {
          $or: [
            { [`title.${lang}`]: { $regex: query, $options: 'i' } },
            { [`description.${lang}`]: { $regex: query, $options: 'i' } },
            { [`requirements.${lang}`]: { $regex: query, $options: 'i' } }
          ]
        }
      ]
    });

    const localizedVacancies = vacancies.map(vacancy =>
      vacancy.getLocalizedData(lang)
    );

    res.status(200).json({
      success: true,
      data: localizedVacancies,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Publish vacancy
// @route   PUT /api/vacancies/:id/publish
// @access  Private
exports.publishVacancy = async (req, res) => {
  try {
    const vacancy = await Vacancy.findById(req.params.id);

    if (!vacancy) {
      return res.status(404).json({
        success: false,
        message: 'Vacancy not found'
      });
    }

    await vacancy.publish();

    res.status(200).json({
      success: true,
      data: vacancy,
      message: 'Vacancy published successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error publishing vacancy',
      error: error.message
    });
  }
};

// @desc    Close vacancy
// @route   PUT /api/vacancies/:id/close
// @access  Private
exports.closeVacancy = async (req, res) => {
  try {
    const vacancy = await Vacancy.findById(req.params.id);

    if (!vacancy) {
      return res.status(404).json({
        success: false,
        message: 'Vacancy not found'
      });
    }

    await vacancy.close();

    res.status(200).json({
      success: true,
      data: vacancy,
      message: 'Vacancy closed successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error closing vacancy',
      error: error.message
    });
  }
};
