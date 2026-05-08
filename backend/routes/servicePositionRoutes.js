const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const servicePositionController = require("../controllers/servicePositionController");
const ServicePosition = require("../models/ServicePosition");
// ─── POSITIONS (files) ───────────────────────────────────────────────────────

// GET /api/service-manager/positions
// Pass ?category=<id> to list positions inside a folder.
// Omit or pass category=root for uncategorised positions.
router.get("/positions", servicePositionController.getAllPositions);

// GET /api/service-manager/positions/:id
router.get("/positions/:id", servicePositionController.getPositionById);

// POST /api/service-manager/positions
router.post("/positions", servicePositionController.createPosition);

// PUT /api/service-manager/positions/:id
router.put("/positions/:id", servicePositionController.updatePosition);

// DELETE /api/service-manager/positions/:id
router.delete("/positions/:id", servicePositionController.deletePosition);

//Service tab for application details page
router.get("/application/:applicationId/positions", servicePositionController.getPositions);

router.post("/application/:applicationId/positions", servicePositionController.addPosition);
router.delete("/application/:applicationId/positions/:positionId", servicePositionController.removePosition);

// ─── MOVE ────────────────────────────────────────────────────────────────────


// PATCH /api/service-manager/positions/:id/move
// Body: { category: "<newCategoryId>" | null }
router.patch("/positions/:id/move", servicePositionController.movePosition);

// ─── FOLDER CONTENTS (categories + positions in one call) ────────────────────

// GET /api/service-manager/folder
// ?parent=<id|root>  &branch=  — returns { categories, positions }
// Used for rendering a single folder view (like a file browser).
router.get("/folder", servicePositionController.getFolderContents);

// ─── EXPORT ──────────────────────────────────────────────────────────────────

// GET /api/service-manager/export
// Query: ?categories=id1,id2,id3  (omit for all)
// Returns a CSV file with BOM for Excel compatibility.
router.get("/export", servicePositionController.exportCSV);


// ─── IMPORT ──────────────────────────────────────────────────────────────────

// POST /api/service-manager/import
// Body: { rows: [{ categoryName, name, shortName, serviceCode, pmuCode, serialNumber,
//                  type, price, costPrice, duration, description, tag, isActive }] }
router.post("/import", servicePositionController.importCSV);

module.exports = router;