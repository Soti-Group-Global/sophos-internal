const SpecialtyMaster = require('../models/SpecialtyMaster');
const SubSpecialityMaster = require('../models/SubSpecialityMaster');
const { setAuditLogContext } = require('../utils/auditLogHelper');

// ======================= SPECIALTY MASTER =======================

// Get all specialties
exports.getAllSpecialties = async (req, res) => {
  try {
    const specialties = await SpecialtyMaster.find().sort({ name_en: 1 });
    res.status(200).json(specialties);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch specialties', error: error.message });
  }
};

// Get specialty by ID
exports.getSpecialtyById = async (req, res) => {
  try {
    const { id } = req.params;
    const specialty = await SpecialtyMaster.findById(id);
    
    if (!specialty) {
      return res.status(404).json({ message: 'Specialty not found' });
    }
    
    res.status(200).json(specialty);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch specialty', error: error.message });
  }
};

// Create new specialty
exports.createSpecialty = async (req, res) => {
  try {
    const { name_en, name_ru } = req.body;
    
    // Validate required fields
    if (!name_en || !name_ru) {
      return res.status(400).json({ message: 'Both English and Russian names are required' });
    }
    
    // Check for duplicates
    const existingSpecialty = await SpecialtyMaster.findOne({
      $or: [
        { name_en: name_en.trim() },
        { name_ru: name_ru.trim() }
      ]
    });
    
    if (existingSpecialty) {
      return res.status(400).json({ message: 'Specialty with this name already exists' });
    }
    
    const newSpecialty = new SpecialtyMaster({
      name_en: name_en.trim(),
      name_ru: name_ru.trim()
    });
    
    await newSpecialty.save();
    setAuditLogContext(req, {
      actionType: 'CREATE',
      entity: 'SpecialtyMaster',
      entityId: newSpecialty._id,
      message: `Created specialty: ${newSpecialty.name_en} / ${newSpecialty.name_ru}`,
    });
    res.status(201).json(newSpecialty);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create specialty', error: error.message });
  }
};

// Update specialty
exports.updateSpecialty = async (req, res) => {
  try {
    const { id } = req.params;
    const { name_en, name_ru } = req.body;
    
    // Validate required fields
    if (!name_en || !name_ru) {
      return res.status(400).json({ message: 'Both English and Russian names are required' });
    }
    
    // Check for duplicates (excluding current specialty)
    const existingSpecialty = await SpecialtyMaster.findOne({
      _id: { $ne: id },
      $or: [
        { name_en: name_en.trim() },
        { name_ru: name_ru.trim() }
      ]
    });
    
    if (existingSpecialty) {
      return res.status(400).json({ message: 'Specialty with this name already exists' });
    }
    
    const updatedSpecialty = await SpecialtyMaster.findByIdAndUpdate(
      id,
      {
        name_en: name_en.trim(),
        name_ru: name_ru.trim(),
        updatedAt: Date.now()
      },
      { new: true, runValidators: true }
    );
    
    if (!updatedSpecialty) {
      return res.status(404).json({ message: 'Specialty not found' });
    }

    setAuditLogContext(req, {
      actionType: 'UPDATE',
      entity: 'SpecialtyMaster',
      entityId: updatedSpecialty._id,
      message: `Updated specialty: ${updatedSpecialty.name_en} / ${updatedSpecialty.name_ru}`,
    });
    
    res.status(200).json(updatedSpecialty);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update specialty', error: error.message });
  }
};

// Delete specialty
exports.deleteSpecialty = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if there are any sub-specialties linked to this specialty
    const subSpecialties = await SubSpecialityMaster.find({ specialtyId: id });
    
    if (subSpecialties.length > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete specialty with existing sub-specialties. Please delete sub-specialties first.' 
      });
    }
    
    const deletedSpecialty = await SpecialtyMaster.findByIdAndDelete(id);
    
    if (!deletedSpecialty) {
      return res.status(404).json({ message: 'Specialty not found' });
    }

    setAuditLogContext(req, {
      actionType: 'DELETE',
      entity: 'SpecialtyMaster',
      entityId: deletedSpecialty._id,
      message: `Deleted specialty: ${deletedSpecialty.name_en} / ${deletedSpecialty.name_ru}`,
    });
    
    res.status(200).json({ message: 'Specialty deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete specialty', error: error.message });
  }
};

// ======================= SUB-SPECIALITY MASTER =======================

// Get all sub-specialties (optionally filter by specialty)
exports.getAllSubSpecialities = async (req, res) => {
  try {
    const { specialtyId } = req.query;
    
    const query = specialtyId ? { specialtyId } : {};
    const subSpecialities = await SubSpecialityMaster.find(query)
      .populate('specialtyId', 'name_en name_ru')
      .sort({ name_en: 1 });
    
    res.status(200).json(subSpecialities);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch sub-specialities', error: error.message });
  }
};

// Get sub-speciality by ID
exports.getSubSpecialityById = async (req, res) => {
  try {
    const { id } = req.params;
    const subSpeciality = await SubSpecialityMaster.findById(id)
      .populate('specialtyId', 'name_en name_ru');
    
    if (!subSpeciality) {
      return res.status(404).json({ message: 'Sub-speciality not found' });
    }
    
    res.status(200).json(subSpeciality);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch sub-speciality', error: error.message });
  }
};

// Create new sub-speciality
exports.createSubSpeciality = async (req, res) => {
  try {
    const { name_en, name_ru, specialtyId } = req.body;
    
    // Validate required fields
    if (!name_en || !name_ru || !specialtyId) {
      return res.status(400).json({ message: 'English name, Russian name, and specialty are required' });
    }
    
    // Verify specialty exists
    const specialty = await SpecialtyMaster.findById(specialtyId);
    if (!specialty) {
      return res.status(404).json({ message: 'Specialty not found' });
    }
    
    // Check for duplicates within the same specialty
    const existingSubSpeciality = await SubSpecialityMaster.findOne({
      specialtyId,
      $or: [
        { name_en: name_en.trim() },
        { name_ru: name_ru.trim() }
      ]
    });
    
    if (existingSubSpeciality) {
      return res.status(400).json({ message: 'Sub-speciality with this name already exists for this specialty' });
    }
    
    const newSubSpeciality = new SubSpecialityMaster({
      name_en: name_en.trim(),
      name_ru: name_ru.trim(),
      specialtyId
    });
    
    await newSubSpeciality.save();
    
    // Populate specialty details before sending response
    await newSubSpeciality.populate('specialtyId', 'name_en name_ru');

    setAuditLogContext(req, {
      actionType: 'CREATE',
      entity: 'SubSpecialityMaster',
      entityId: newSubSpeciality._id,
      message: `Created sub-speciality: ${newSubSpeciality.name_en} / ${newSubSpeciality.name_ru}`,
    });
    
    res.status(201).json(newSubSpeciality);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create sub-speciality', error: error.message });
  }
};

// Update sub-speciality
exports.updateSubSpeciality = async (req, res) => {
  try {
    const { id } = req.params;
    const { name_en, name_ru, specialtyId } = req.body;
    
    // Validate required fields
    if (!name_en || !name_ru || !specialtyId) {
      return res.status(400).json({ message: 'English name, Russian name, and specialty are required' });
    }
    
    // Verify specialty exists
    const specialty = await SpecialtyMaster.findById(specialtyId);
    if (!specialty) {
      return res.status(404).json({ message: 'Specialty not found' });
    }
    
    // Check for duplicates (excluding current sub-speciality)
    const existingSubSpeciality = await SubSpecialityMaster.findOne({
      _id: { $ne: id },
      specialtyId,
      $or: [
        { name_en: name_en.trim() },
        { name_ru: name_ru.trim() }
      ]
    });
    
    if (existingSubSpeciality) {
      return res.status(400).json({ message: 'Sub-speciality with this name already exists for this specialty' });
    }
    
    const updatedSubSpeciality = await SubSpecialityMaster.findByIdAndUpdate(
      id,
      {
        name_en: name_en.trim(),
        name_ru: name_ru.trim(),
        specialtyId,
        updatedAt: Date.now()
      },
      { new: true, runValidators: true }
    ).populate('specialtyId', 'name_en name_ru');
    
    if (!updatedSubSpeciality) {
      return res.status(404).json({ message: 'Sub-speciality not found' });
    }

    setAuditLogContext(req, {
      actionType: 'UPDATE',
      entity: 'SubSpecialityMaster',
      entityId: updatedSubSpeciality._id,
      message: `Updated sub-speciality: ${updatedSubSpeciality.name_en} / ${updatedSubSpeciality.name_ru}`,
    });
    
    res.status(200).json(updatedSubSpeciality);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update sub-speciality', error: error.message });
  }
};

// Delete sub-speciality
exports.deleteSubSpeciality = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedSubSpeciality = await SubSpecialityMaster.findByIdAndDelete(id);
    
    if (!deletedSubSpeciality) {
      return res.status(404).json({ message: 'Sub-speciality not found' });
    }

    setAuditLogContext(req, {
      actionType: 'DELETE',
      entity: 'SubSpecialityMaster',
      entityId: deletedSubSpeciality._id,
      message: `Deleted sub-speciality: ${deletedSubSpeciality.name_en} / ${deletedSubSpeciality.name_ru}`,
    });
    
    res.status(200).json({ message: 'Sub-speciality deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete sub-speciality', error: error.message });
  }
};
