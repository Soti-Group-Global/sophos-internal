const express = require("express");
const router = express.Router();
const {
  submitContactViaPhone,
  getContactRequests,
  getContactRequest,
  updateContactRequest,
  deleteContactRequest,
} = require("../../controllers/website/contactViaPhoneController");

router.post("/", submitContactViaPhone);
router.get("/", getContactRequests);
router.get("/:id", getContactRequest);
router.put("/:id", updateContactRequest);
router.delete("/:id", deleteContactRequest);
 
module.exports = router;