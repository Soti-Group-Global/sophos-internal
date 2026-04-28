const express = require("express");
const router = express.Router();
const {
  getTransactions,
  createTransaction
} = require("../controllers/transactionController");

router.get("/", getTransactions);
router.post("/", createTransaction); // handles issue/usage/transfer etc.

module.exports = router;
