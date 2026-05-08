const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const {
  createSpecialty,
  getAllSpecialties,
  getSpecialtyById,
  updateSpecialty,
  addTestToSpecialty,
  deleteTestFromSpecialty,
  deleteSpecialty,
  getAllTests,
  getSpecialtyByName,
  addMultipleTest,
  addTest,
  getOrdersByApplicationId,
} = require('../controllers/specialtiesController');
const { getOrdersByApplication } = require('../controllers/orderController');
const router = express.Router();

router.post(
  '/',
  [
    auth,
    body('name').trim().notEmpty().withMessage('Specialty name is required'),
  ],
  createSpecialty
);
router.get('/', auth, getAllSpecialties);
router.get('/all', auth, getAllSpecialties);
router.get('/all-tests', auth, getAllTests);
router.get('/tests', auth, getAllTests);
router.get('/name/:name', auth, getSpecialtyByName);
router.get('/orders/:applicationId', auth, getOrdersByApplicationId);

// Add test(s) to an application/appointment
router.post('/:applicationId/tests/multiple', auth, addMultipleTest);
router.post('/:applicationId/test', auth, addTest);

router.get('/:id', auth, getSpecialtyById);
router.put(
  '/:id',
  [
    auth,
    body('name').trim().notEmpty().withMessage('Specialty name is required'),
  ],
  updateSpecialty
);
router.post(
  '/:id/tests',
  [
    auth,
    body('name').trim().notEmpty().withMessage('Test name is required'),
  ],
  addTestToSpecialty
);
router.delete('/:id/tests/:testId', auth, deleteTestFromSpecialty);
router.delete('/:id', auth, deleteSpecialty);

module.exports = router;
