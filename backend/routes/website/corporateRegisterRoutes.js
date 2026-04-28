const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const controller = require("../../controllers/website/corporateRegisterController");

// Protected: create corporate registration (sends welcome email to HR)
router.post("/", auth, controller.createCorporateRegistration);

// Public: get form by link (used for URL: form.sophos.med.ru/${link})
router.get("/form/:link", controller.getCorporateRegistrationByLink);

// Protected: get all registrations
router.get("/", auth, controller.getAllCorporateRegistrations);

// Protected: update a registration
router.put("/:id", auth, controller.updateCorporateRegistration);

// Protected: delete a registration
router.delete("/:id", auth, controller.deleteCorporateRegistration);

module.exports = router;
