const { body, param } = require('express-validator');

const doctorValidator = {
  // Validation for creating a new doctor
  validateDoctor: [
    body('firstName')
      .notEmpty()
      .withMessage('First name is required')
      .trim(),
    
    body('lastName')
      .notEmpty()
      .withMessage('Last name is required')
      .trim(),
    
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail(),
    
    body('phoneNumber')
      .notEmpty()
      .withMessage('Phone number is required')
      .trim(),
    
    body('dateOfBirth')
      .isDate()
      .withMessage('Please provide a valid date of birth'),
    
    body('gender')
      .isIn(['Male', 'Female', 'Other'])
      .withMessage('Gender must be Male, Female, or Other'),
    
    body('age')
      .isInt({ min: 1, max: 150 })
      .withMessage('Age must be a valid number between 1 and 150'),
    
    body('specialty')
      .notEmpty()
      .withMessage('Specialty is required')
      .trim(),
    
    body('placeOfWork')
      .notEmpty()
      .withMessage('Place of work is required')
      .trim(),
    
    body('feesAmount')
      .isNumeric()
      .withMessage('Fees amount must be a number')
      .isFloat({ min: 0 })
      .withMessage('Fees amount must be positive'),
    
    body('currency')
      .isIn(['USD', 'EUR', 'GBP', 'INR', 'RUP', 'AUD'])
      .withMessage('Invalid currency'),
    
    body('services')
      .isArray({ min: 1 })
      .withMessage('At least one service must be selected'),
    
    body('services.*')
      .isIn(['Online', 'Offline'])
      .withMessage('Service must be either Online or Offline'),
    
    body('languages')
      .optional()
      .isArray()
      .withMessage('Languages must be an array'),
    
    body('languages.*')
      .optional()
      .isString()
      .trim(),
    
    body('subSpecialties')
      .optional()
      .isArray()
      .withMessage('Sub-specialties must be an array'),
    
    body('subSpecialties.*')
      .optional()
      .isString()
      .trim(),
    
    body('location')
      .optional()
      .trim(),
    
    body('position')
      .optional()
      .trim(),
    
    body('regalia')
      .optional()
      .trim(),
    
    body('branches')
      .optional()
      .isArray()
      .withMessage('Branches must be an array'),
    
    body('branches.*')
      .optional()
      .isString()
      .trim(),
    
    body('about')
      .optional()
      .trim(),
    
    body('workExperience')
      .optional()
      .trim(),
    
    body('education')
      .optional()
      .trim(),
    
    body('scientificActivities')
      .optional()
      .trim(),
    
    body('teachingActivity')
      .optional()
      .trim(),
    
    body('status')
      .optional()
      .isIn(['active', 'inactive', 'pending'])
      .withMessage('Invalid status value')
  ],

  // Validation for updating a doctor (all fields optional)
  validateDoctorUpdate: [
    body('firstName')
      .optional()
      .trim(),
    
    body('lastName')
      .optional()
      .trim(),
    
    body('email')
      .optional()
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail(),
    
    body('phoneNumber')
      .optional()
      .trim(),
    
    body('dateOfBirth')
      .optional()
      .isDate()
      .withMessage('Please provide a valid date of birth'),
    
    body('gender')
      .optional()
      .isIn(['Male', 'Female', 'Other'])
      .withMessage('Gender must be Male, Female, or Other'),
    
    body('age')
      .optional()
      .isInt({ min: 1, max: 150 })
      .withMessage('Age must be a valid number between 1 and 150'),
    
    body('specialty')
      .optional()
      .trim(),
    
    body('placeOfWork')
      .optional()
      .trim(),
    
    body('feesAmount')
      .optional()
      .isNumeric()
      .withMessage('Fees amount must be a number')
      .isFloat({ min: 0 })
      .withMessage('Fees amount must be positive'),
    
    body('currency')
      .optional()
      .isIn(['USD', 'EUR', 'GBP', 'INR', 'RUP', 'AUD'])
      .withMessage('Invalid currency'),
    
    body('services')
      .optional()
      .isArray({ min: 1 })
      .withMessage('At least one service must be selected'),
    
    body('services.*')
      .optional()
      .isIn(['Online', 'Offline'])
      .withMessage('Service must be either Online or Offline'),
    
    body('languages')
      .optional()
      .isArray()
      .withMessage('Languages must be an array'),
    
    body('languages.*')
      .optional()
      .isString()
      .trim(),
    
    body('subSpecialties')
      .optional()
      .isArray()
      .withMessage('Sub-specialties must be an array'),
    
    body('subSpecialties.*')
      .optional()
      .isString()
      .trim(),
    
    body('location')
      .optional()
      .trim(),
    
    body('position')
      .optional()
      .trim(),
    
    body('regalia')
      .optional()
      .trim(),
    
    body('branches')
      .optional()
      .isArray()
      .withMessage('Branches must be an array'),
    
    body('branches.*')
      .optional()
      .isString()
      .trim(),
    
    body('about')
      .optional()
      .trim(),
    
    body('workExperience')
      .optional()
      .trim(),
    
    body('education')
      .optional()
      .trim(),
    
    body('scientificActivities')
      .optional()
      .trim(),
    
    body('teachingActivity')
      .optional()
      .trim(),
    
    body('status')
      .optional()
      .isIn(['active', 'inactive', 'pending'])
      .withMessage('Invalid status value')
  ],

  // Validation for ID parameter
  validateId: [
    param('id')
      .isMongoId()
      .withMessage('Invalid doctor ID format')
  ]
};

module.exports = doctorValidator;