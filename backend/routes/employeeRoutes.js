const express = require("express");
const {
  getEmployees,
  getAllAvailabilities,
  getApplicationByDate,
} = require("../controllers/employeeController");
const router = express.Router();

router.get("/", getEmployees);
router.get("/applicationsByDate", getApplicationByDate);
router.get("/availability", getAllAvailabilities);

module.exports = router;
