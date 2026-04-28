const Specialty = require('../models/Specialty');

// Create specialty
const createSpecialty = async (req, res) => {
  try {
    const { validationResult } = require('express-validator');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, tests } = req.body;

    const existingSpecialty = await Specialty.findOne({ name });
    if (existingSpecialty) {
      return res.status(400).json({ message: 'Specialty name already exists' });
    }

    const specialty = new Specialty({
      name,
      tests: tests || [],
    });

    await specialty.save();

    res.status(201).json({ specialty });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all specialties
const getAllSpecialties = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const specialties = await Specialty.find()
      .skip(skip)
      .limit(limit);

    const total = await Specialty.countDocuments();

    res.json({
      specialties,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get specialty by ID
const getSpecialtyById = async (req, res) => {
  try {
    const specialty = await Specialty.findById(req.params.id);
    if (!specialty) {
      return res.status(404).json({ message: 'Specialty not found' });
    }
    res.json({ specialty });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Update specialty
const updateSpecialty = async (req, res) => {
  try {
    const { validationResult } = require('express-validator');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, tests } = req.body;

    const specialty = await Specialty.findById(req.params.id);
    if (!specialty) {
      return res.status(404).json({ message: 'Specialty not found' });
    }

    if (name !== specialty.name) {
      const existingSpecialty = await Specialty.findOne({ name });
      if (existingSpecialty) {
        return res.status(400).json({ message: 'Specialty name already exists' });
      }
    }

    specialty.name = name;
    if (tests) {
      specialty.tests = tests;
    }

    await specialty.save();

    res.json({ specialty });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add test to specialty
const addTestToSpecialty = async (req, res) => {
  try {
    const { validationResult } = require('express-validator');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name } = req.body;

    const specialty = await Specialty.findById(req.params.id);
    if (!specialty) {
      return res.status(404).json({ message: 'Specialty not found' });
    }

    if (specialty.tests.some(test => test.name === name)) {
      return res.status(400).json({ message: 'Test name already exists in this specialty' });
    }

    specialty.tests.push({ name });

    await specialty.save();

    res.json({ specialty });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete test from specialty
const deleteTestFromSpecialty = async (req, res) => {
  try {
    const specialty = await Specialty.findById(req.params.id);
    if (!specialty) {
      return res.status(404).json({ message: 'Specialty not found' });
    }

    const testIndex = specialty.tests.findIndex(test => test._id.toString() === req.params.testId);
    if (testIndex === -1) {
      return res.status(404).json({ message: 'Test not found' });
    }

    specialty.tests.splice(testIndex, 1);

    await specialty.save();

    res.json({ specialty });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete specialty
const deleteSpecialty = async (req, res) => {
  try {
    const specialty = await Specialty.findById(req.params.id);
    if (!specialty) {
      return res.status(404).json({ message: 'Specialty not found' });
    }

    await specialty.deleteOne();

    res.json({ message: 'Specialty deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET all tests
const getAllTests = async (req, res) => {
  try {
    const specialties = await Specialty.find().select('tests');
    const tests = specialties.flatMap(specialty =>
      specialty.tests.map(test => ({
        _id: test._id,
        name: test.name,
        specialtyId: specialty._id,
        specialtyName: specialty.name
      }))
    );
    res.json(tests);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Get specialty by name
const getSpecialtyByName = async (req, res) => {
  try {
    const raw = req.params.name;
    const decoded = decodeURIComponent(raw || '');
    const candidates = decoded
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (candidates.length === 0) {
      return res.status(400).json({ message: 'Invalid specialty name' });
    }

    const regexes = candidates.map((n) => new RegExp(`^${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));

    const specialty = await Specialty.findOne({ name: { $in: regexes } });
    if (!specialty) {
      return res.status(404).json({ message: 'Specialty not found' });
    }
    res.json({ specialty });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createSpecialty,
  getAllSpecialties,
  getSpecialtyById,
  updateSpecialty,
  addTestToSpecialty,
  deleteTestFromSpecialty,
  deleteSpecialty,
  getAllTests,
  getSpecialtyByName,
};
