const express = require('express');
const router = express.Router();
const {
  getVacancies,
  getVacancy,
  createVacancy,
  updateVacancy,
  deleteVacancy
} = require('../controllers/vacancyController');
const auth = require('../middleware/auth');

// Public routes
router.get('/', getVacancies);
router.get('/:id', getVacancy);

// Protected routes
router.post('/', auth, createVacancy);
router.put('/:id', auth, updateVacancy);
router.delete('/:id', auth, deleteVacancy);

module.exports = router;