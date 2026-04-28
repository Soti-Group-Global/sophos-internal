const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const controller = require("../../controllers/website/corporateFormRegistrationController");

// Public: submit form by link
router.post("/:link", controller.submitCorporateForm);

// Public: get results by link (password-protected on frontend)
router.get("/:link/results", controller.getResultsByLink);

// Protected: get all submissions (admin)
router.get("/", auth, controller.getAllSubmissions);

// Protected: delete a submission
router.delete("/:id", auth, controller.deleteSubmission);

module.exports = router;
