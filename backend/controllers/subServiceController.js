const SubService = require("../models/SubService");
const Service = require("../models/Service");
const DoctorsProfile = require("../models/DoctorsProfile");

// Create SubService
exports.createSubService = async (req, res) => {
  try {
    const { serviceId } = req.body;
    
    
    const parentService = await Service.findById(serviceId);
    if (!parentService) {
      return res.status(404).json({ message: "Parent service not found" });
    }

    const subService = await SubService.create(req.body);
    res.status(201).json(subService);
  } catch (error) {
    
    // Send detailed validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message
      }));
      return res.status(400).json({ 
        message: "Validation error", 
        errors 
      });
    }
    
    res.status(400).json({ message: error.message });
  }
};

// Get All SubServices (optional filter by serviceId and branch)
exports.getAllSubServices = async (req, res) => {
  try {
    const { serviceId, branch, search } = req.query;

    const filter = {};

    // Filter by parent service
    if (serviceId) {
      filter.serviceId = serviceId;
    }

    // Filter by branch - only return sub-services whose parent service has this branch
    if (branch) {
      // First, find all services that have this branch
      const servicesWithBranch = await Service.find(
        { branches: branch },
        { _id: 1 }
      );

      const serviceIdsWithBranch = servicesWithBranch.map(service => service._id);

      // Filter sub-services by these service IDs
      if (serviceIdsWithBranch.length > 0) {
        filter.serviceId = { $in: serviceIdsWithBranch };
      } else {
        // If no services have this branch, return empty array
        return res.json([]);
      }
    }

    // Search by code, name (en/ru), or notes (en/ru)
    if (search) {
      filter.$or = [
        { code: { $regex: search, $options: "i" } },
        { "name.en": { $regex: search, $options: "i" } },
        { "name.ru": { $regex: search, $options: "i" } },
        { "notes.en": { $regex: search, $options: "i" } },
        { "notes.ru": { $regex: search, $options: "i" } },
      ];
    }

    const subServices = await SubService.find(filter)
      .populate({
        path: "serviceId",
        select: "name sectionCode branches", // Keep branches to verify in response
      })
      .sort({ createdAt: -1 });

    // Apply branch filter after population if needed (more accurate but less efficient)
    // Or we can keep the pre-filter approach above

    // Fetch all unique doctor emails from these sub-services
    const allDoctorEmails = [
      ...new Set(subServices.flatMap((s) => s.doctorEmails || [])),
    ];

    // Fetch details for these doctors from DoctorsProfile
    const doctorsData = await DoctorsProfile.find({
      email: { $in: allDoctorEmails },
    }).select("firstName middleName lastName email");

    // Create a map for quick lookup
    const doctorMap = doctorsData.reduce((map, doctor) => {
      map[doctor.email.toLowerCase()] = doctor;
      return map;
    }, {});

    // Attach doctor details to each sub-service
    const subServicesWithDoctors = subServices.map((ss) => {
      const populatedDoctors = (ss.doctorEmails || []).map(
        (email) => doctorMap[email.toLowerCase()] || { email }
      );

      // Return only the sub-service with assigned doctors
      const subServiceObj = ss.toObject();

      return {
        ...subServiceObj,
        doctors: populatedDoctors,
      };
    });

    res.json(subServicesWithDoctors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Get Single SubService
exports.getSubServiceById = async (req, res) => {
  try {
    const subService = await SubService.findById(req.params.id)
      .populate("serviceId", "name sectionCode branches");
    if (!subService)
      return res.status(404).json({ message: "SubService not found" });
    res.json(subService);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update SubService
exports.updateSubService = async (req, res) => {
  try {
    const subService = await SubService.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!subService)
      return res.status(404).json({ message: "SubService not found" });
    res.json(subService);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete SubService
exports.deleteSubService = async (req, res) => {
  try {
    const subService = await SubService.findByIdAndDelete(req.params.id);
    if (!subService)
      return res.status(404).json({ message: "SubService not found" });
    res.json({ message: "SubService deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
