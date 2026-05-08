const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const serviceCategoryController = require("../controllers/serviceCategoryController");
const ServicePosition = require("../models/ServicePosition");

// ─── CATEGORIES (folders) ────────────────────────────────────────────────────

// GET /api/service-manager/categories
// Returns flat list; pass ?parent=<id> to get children of a folder,
// omit parent (or pass parent=root) for top-level.
// Pass ?linkedOnly=true to get ALL categories with isLinkedWithSpeciality=true (any level).
router.get("/categories", serviceCategoryController.getAllCategories);

// GET /api/service-manager/categories/:id
router.get("/categories/:id", serviceCategoryController.getCategoryById);

// GET /api/service-manager/categories/:id/breadcrumb
// Returns ancestor chain: [root, ..., parent, current]
router.get("/categories/:id/breadcrumb", serviceCategoryController.getCategoryBreadcrumb);

// POST /api/service-manager/categories
router.post("/categories", serviceCategoryController.createCategory);

// PUT /api/service-manager/categories/:id
router.put("/categories/:id", serviceCategoryController.updateCategory);

// DELETE /api/service-manager/categories/:id
// Cascades: deletes all descendant categories and their positions.
router.delete("/categories/:id", serviceCategoryController.deleteCategory);

// ─── MOVE ────────────────────────────────────────────────────────────────────

// PATCH /api/service-manager/categories/:id/move
// Body: { parent: "<newParentId>" | null }
router.patch("/categories/:id/move", serviceCategoryController.moveCategory);


// ─── FOLDER CONTENTS (categories + positions in one call) ────────────────────

// GET /api/service-manager/folder
// ?parent=<id|root>  &branch=  — returns { categories, positions }
// Used for rendering a single folder view (like a file browser).
router.get("/folder", serviceCategoryController.getFolderContents);

// ─── EXPORT ──────────────────────────────────────────────────────────────────

// GET /api/service-manager/export
// Query: ?categories=id1,id2,id3  (omit for all)
// Returns a CSV file with BOM for Excel compatibility.
router.get("/export", serviceCategoryController.exportToCSV);

// ─── IMPORT ──────────────────────────────────────────────────────────────────

// POST /api/service-manager/import
// Body: { rows: [{ categoryName, name, shortName, serviceCode, pmuCode, serialNumber,
//                  type, price, costPrice, duration, description, tag, isActive }] }
router.post("/import", serviceCategoryController.importFromCSV);

module.exports = router;