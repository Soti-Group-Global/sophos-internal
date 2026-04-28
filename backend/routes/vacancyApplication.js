// vacancyApplicationRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  submitApplication,
  getApplicationsByVacancy,
  getAllApplications,
  getApplication,
  updateApplicationStatus,
  getVacancyStats,
  downloadResume,
  submitContactRequest,
  getContactRequests,
  getContactRequest,
  updateContactRequest,
  deleteContactRequest,
  getContactRequestsByVacancy
} = require('../controllers/vacancyApplicationController');
const auth = require('../middleware/auth');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'resume') {
      const allowedMimeTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only PDF, DOC, and DOCX files are allowed.'), false);
      }
    } else {
      cb(null, true);
    }
  }
});

// ====== REORDER ROUTES ======

router.get('/:vacancyId/contact-requests', auth, getContactRequestsByVacancy);

// 1. Specific routes first
router.get('/contact-requests', auth, getContactRequests);
router.get('/contact-requests/:requestId', auth, getContactRequest);
router.put('/contact-requests/:requestId', auth, updateContactRequest);
router.delete('/contact-requests/:requestId', auth, deleteContactRequest);

// 2. Vacancy-specific contact requests (no pagination)

// 3. Other routes
router.get('/applications/all', auth, getAllApplications);
router.get('/applications/:applicationId', auth, getApplication);
router.put('/applications/:applicationId/status', auth, updateApplicationStatus);
router.get('/stats/overview', auth, getVacancyStats);
router.get('/resume/:fileId', auth, downloadResume);

// 4. Parameterized routes last
router.post('/:id/apply', upload.single('resume'), submitApplication);
router.post('/:id/contact', submitContactRequest);
router.get('/:id/applications', auth, getApplicationsByVacancy);

module.exports = router;