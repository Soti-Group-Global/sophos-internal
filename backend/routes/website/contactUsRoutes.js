const express = require("express");
const router = express.Router();
const contactController = require("../../controllers/website/contactUsController");

router.post("/", contactController.submitContactUsForm);
router.get("/", contactController.getContactUsForm);

router.put("/:id", contactController.updateContact);
router.delete("/:id", contactController.deleteContact);

module.exports = router;
