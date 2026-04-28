const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { incrementCounter } = require("../controllers/counterController");

router.get("/:name", auth, incrementCounter);

module.exports = router;
