const express = require("express");
const { generateToken } = require("../controllers/livekitController");

const router = express.Router();

router.post("/generate-token", generateToken);

module.exports = router;