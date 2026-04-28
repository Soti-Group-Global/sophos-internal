const express = require("express");
const router = express.Router();
const subServiceController = require("../controllers/subServiceController");

router.post("/", subServiceController.createSubService);
router.get("/", subServiceController.getAllSubServices);
router.get("/:id", subServiceController.getSubServiceById);
router.put("/:id", subServiceController.updateSubService);
router.delete("/:id", subServiceController.deleteSubService);

module.exports = router;
