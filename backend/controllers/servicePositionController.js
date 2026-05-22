const mongoose = require("mongoose");
const ServicePosition = require("../models/ServicePosition");
const ServiceCategory = require("../models/ServiceCategory");
const Application = require("../models/Application");

//Get all positions
exports.getAllPositions = async (req, res) => {
    try {
        const { category, branch, search, page = 1, limit = 50, all, speciality } = req.query;
        const filter = {};
    
        if (speciality && mongoose.isValidObjectId(speciality)) {
          // Find all categories linked to this speciality (any level)
          const linkedCats = await ServiceCategory.find({
            specialities: new mongoose.Types.ObjectId(speciality),
          }).select("_id").lean();
          if (linkedCats.length === 0) {
            return res.json({ positions: [], total: 0, page: 1, limit: Number(limit) });
          }
          filter.category = { $in: linkedCats.map((c) => c._id) };
        } else if (all === "true") {
          // no category filter — return all positions across every category
        } else if (category === "root") {
          filter.category = null;
        } else if (category && mongoose.isValidObjectId(category)) {
          filter.category = category;
        } else if (!search) {
          filter.category = null; // default to root when no search and no category
        }
        // when search is given with no category: search across all categories
    
        if (branch && branch !== "all") filter.branch = branch;
    
        if (search) {
          filter.$or = [
            { name: { $regex: search, $options: "i" } },
            { serviceCode: { $regex: search, $options: "i" } },
            { shortName: { $regex: search, $options: "i" } },
          ];
        }
    
        const skip = (Number(page) - 1) * Number(limit);
        const [positions, total] = await Promise.all([
          ServicePosition.find(filter)
            .populate("category", "name")
            .sort({ sortOrder: 1, name: 1 })
            .skip(skip)
            .limit(Number(limit))
            .lean(),
          ServicePosition.countDocuments(filter),
        ]);
    
        res.json({ positions, total, page: Number(page), limit: Number(limit) });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
};

//Get position by id
exports.getPositionById = async (req, res) => {
    try {
        const position = await ServicePosition.findById(req.params.id)
          .populate("category", "name")
          .populate("relatedServices.service", "name price")
          .lean();
        if (!position) return res.status(404).json({ message: "Position not found" });
        res.json({ position });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
};

//Create new position
exports.createPosition = async (req, res) => {
     try {
    const position = new ServicePosition(req.body);
    await position.save();
    res.status(201).json({ position });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

//Update position by id
exports.updatePosition = async (req, res) => {
    try {
        const position = await ServicePosition.findByIdAndUpdate(
          req.params.id,
          req.body,
          { new: true, runValidators: true }
        );
        if (!position) return res.status(404).json({ message: "Position not found" });
        res.json({ position });
      } catch (err) {
        res.status(400).json({ message: err.message });
      }
};

//Delete position by id
exports.deletePosition = async (req, res) => {
    try {
    const position = await ServicePosition.findByIdAndDelete(req.params.id);
    if (!position) return res.status(404).json({ message: "Position not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/service-manager/positions/:id/move
// Body: { category: "<newCategoryId>" | null }
exports.movePosition = async (req, res) => {
     try {
    const { category } = req.body;
    const position = await ServicePosition.findByIdAndUpdate(
      req.params.id,
      { category: category || null },
      { new: true }
    );
    if (!position) return res.status(404).json({ message: "Position not found" });
    res.json({ position });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// GET /api/service-manager/folder
// ?parent=<id|root>  &branch=  — returns { categories, positions }
// Used for rendering a single folder view (like a file browser).
exports.getFolderContents = async (req, res) => {
     try {
    const { parent, branch, specialities } = req.query;
    const parentVal =
      !parent || parent === "root" ? null : parent;

    const catFilter = { parent: parentVal };
    const posFilter = { category: parentVal };
    if (branch && branch !== "all") {
      catFilter.branch = branch;
      posFilter.branch = branch;
    }

    // Filter by specialities when provided (for "My Services" tab)
    if (specialities) {
      const specIds = specialities
        .split(",")
        .map((id) => id.trim())
        .filter((id) => mongoose.isValidObjectId(id))
        .map((id) => new mongoose.Types.ObjectId(id));
      if (specIds.length > 0) {
        catFilter.specialities = { $in: specIds };
        posFilter.speciality = { $in: specIds };
      }
    }

    const [categories, positions] = await Promise.all([
      ServiceCategory.find(catFilter).sort({ sortOrder: 1, name: 1 }).lean(),
      ServicePosition.find(posFilter).sort({ sortOrder: 1, name: 1 }).lean(),
    ]);

    res.json({ categories, positions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// GET /api/service-manager/export
// Query: ?categories=id1,id2,id3  (omit for all)
// Returns a CSV file with BOM for Excel compatibility.
exports.exportCSV = async (req, res) => {
    try {
    const { categories } = req.query;

    let categoryIds = null;
    if (categories && categories.trim()) {
      const requestedIds = categories.split(",").map((id) => id.trim()).filter(Boolean);
      // Collect descendants of each requested category
      const allIds = new Set(requestedIds);
      for (const id of requestedIds) {
        const descendants = await collectDescendants(id);
        descendants.forEach((d) => allIds.add(d));
      }
      categoryIds = [...allIds];
    }

    const filter = categoryIds ? { category: { $in: categoryIds } } : {};
    const [allCategories, positions] = await Promise.all([
      ServiceCategory.find(categoryIds ? { _id: { $in: categoryIds } } : {})
        .select("_id name parent sortOrder")
        .sort({ sortOrder: 1, name: 1 })
        .lean(),
      ServicePosition.find(filter)
        .populate("category", "name parent")
        .sort({ sortOrder: 1, name: 1 })
        .lean(),
    ]);

    const escCsv = (val) => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes(";") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const categoriesByParent = new Map();
    const categoriesById = new Map();
    for (const category of allCategories) {
      const parentKey = category.parent ? category.parent.toString() : "root";
      if (!categoriesByParent.has(parentKey)) categoriesByParent.set(parentKey, []);
      categoriesByParent.get(parentKey).push(category);
      categoriesById.set(category._id.toString(), category);
    }

    const positionsByCategory = new Map();
    for (const position of positions) {
      const categoryKey = position.category?._id ? position.category._id.toString() : "root";
      if (!positionsByCategory.has(categoryKey)) positionsByCategory.set(categoryKey, []);
      positionsByCategory.get(categoryKey).push(position);
    }

    const roots = categoryIds
      ? allCategories.filter((category) => {
          const parentId = category.parent?.toString();
          return !parentId || !categoriesById.has(parentId);
        })
      : (categoriesByParent.get("root") || []);

    const rows = [];
    const childCounters = new Map();
    const nextChildCode = (parentCode, fallbackIndex) => {
      if (!parentCode) return String(fallbackIndex + 1);
      const count = (childCounters.get(parentCode) || 0) + 1;
      childCounters.set(parentCode, count);
      return `${parentCode}.${count}`;
    };

    const addCategoryRows = (category, parentCode = "", rootIndex = 0) => {
      const code = nextChildCode(parentCode, rootIndex);
      rows.push([code, "", category.name, "", ""]);

      for (const position of positionsByCategory.get(category._id.toString()) || []) {
        rows.push([
          position.serviceCode || "",
          position.pmuCode || "",
          position.name || "",
          position.price != null ? position.price : "",
          position.description || "",
        ]);
      }

      for (const child of categoriesByParent.get(category._id.toString()) || []) {
        addCategoryRows(child, code);
      }
    };

    roots.forEach((root, index) => addCategoryRows(root, "", index));

    if (!categoryIds) {
      for (const position of positionsByCategory.get("root") || []) {
        rows.push([
          position.serviceCode || "",
          position.pmuCode || "",
          position.name || "",
          position.price != null ? position.price : "",
          position.description || "",
        ]);
      }
    }

    const headers = ["Код", "Код НМУ", "Наименование", "Стоимость", "Описание"];

    const csvLines = [
      headers.map(escCsv).join(";"),
      ...rows.map((r) => r.map(escCsv).join(";")),
    ];
    const csv = "\uFEFF" + csvLines.join("\r\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="services-export.csv"');
    return res.send(csv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/service-manager/import
// Body: { rows: [{ categoryName, name, shortName, serviceCode, pmuCode, serialNumber,
//                  type, price, costPrice, duration, description, tag, isActive }] }
exports.importCSV = async (req, res) => {
    try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ message: "No rows provided" });
    }

    let created = 0;
    const errors = [];

    // folderStack[depth] = categoryId  (depth 1 = root, 2 = sub, 3 = sub-sub …)
    // Positions always land under the deepest active folder.
    const folderStack = {};

    // A "hierarchical code" is purely numeric dot-segments: 1 / 1.1 / 1.1.1
    const getHierarchyDepth = (code) => {
      if (!code) return 0;
      const parts = code.replace(/\.$/, "").split(".");
      return parts.every((p) => /^\d+$/.test(p)) ? parts.length : 0;
    };

    const currentFolderId = () => {
      const depths = Object.keys(folderStack).map(Number).sort((a, b) => b - a);
      return depths.length ? folderStack[depths[0]] : null;
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = normalizeCell(row.name || row.Name);
      const code = normalizeCell(row.serviceCode || row.code || row.Code);
      const pmuCode = normalizeCell(row.pmuCode);
      const price = normalizeCell(row.price || row.Price);
      const description = normalizeCell(row.description || row.Description);

      if (!name) {
        errors.push({ row: i + 1, message: "Name is required" });
        continue;
      }

      try {
        const isCategoryRow = !price && !pmuCode && !row.shortName && !row.type;
        const depth = getHierarchyDepth(code);

        if (isCategoryRow) {
          // Determine parent: for depth-based codes use the stack; otherwise nest under current folder
          let parentId;
          if (depth > 0) {
            parentId = depth > 1 ? (folderStack[depth - 1] || null) : null;
            // Clear stale deeper entries from a previous branch
            Object.keys(folderStack).forEach((k) => { if (Number(k) >= depth) delete folderStack[k]; });
          } else {
            parentId = currentFolderId();
          }

          let cat = await ServiceCategory.findOne({ name, parent: parentId }).lean();
          if (!cat) {
            cat = await ServiceCategory.create({ name, parent: parentId, isActive: true });
          }

          const stackDepth = depth > 0 ? depth : (Math.max(0, ...Object.keys(folderStack).map(Number)) + 1);
          folderStack[stackDepth] = cat._id.toString();
          created++;
          continue;
        }

        // Position row — place under the deepest active folder
        const categoryId = currentFolderId();
        await ServicePosition.create({
          name,
          shortName: row.shortName || "",
          serviceCode: code || "",
          pmuCode: pmuCode || "",
          serialNumber: row.serialNumber ? Number(row.serialNumber) : 0,
          type: ["service", "good", "complex"].includes(row.type) ? row.type : "service",
          price: price ? Number(String(price).replace(/\s/g, "").replace(",", ".")) : 0,
          costPrice: row.costPrice ? Number(row.costPrice) : 0,
          duration: row.duration ? Number(row.duration) : null,
          description,
          tag: row.tag || "",
          isActive: row.isActive === "false" || row.isActive === false ? false : true,
          category: categoryId,
        });
        created++;
      } catch (rowErr) {
        errors.push({ row: i + 1, message: rowErr.message });
      }
    }

    return res.json({ created, errors });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

//Service tab for application details page

exports.getPositions = async (req, res) => {
  try {
    const applicationId = req.params.applicationId;
    const application = await Application.findOne({ applicationId })
      .populate({ path: "services.servicePosition", strictPopulate: false })
      .lean();
    if (!application) return res.status(404).json({ message: "Application not found" });
    const positions = (application.services || []).map((s) => ({
      ...(s.servicePosition || {}),
      _id: s.servicePosition?._id ?? s.servicePosition,
      price: s.price ?? s.servicePosition?.price,
    }));
    res.json({ positions });
  }
  catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.addPosition = async (req, res) => {
  try {
    const applicationId = req.params.applicationId;
    const { positionId } = req.body;
    const application = await Application.findOne({ applicationId });
    if (!application) return res.status(404).json({ message: "Application not found" });
    if ((application.services || []).some((s) => s.servicePosition.toString() === positionId)) {
      return res.status(400).json({ message: "Position already added" });
    }
    const servicePos = await ServicePosition.findById(positionId).lean();
    application.services.push({
      servicePosition: positionId,
      price: servicePos?.price ?? null,
    });
    await application.save();
    res.json({ message: "Position added" });
  }
  catch (err) {
    res.status(500).json({ message: err.message });
  }
}

exports.removePosition = async (req, res) => {
  try {
    const applicationId = req.params.applicationId;
    const positionId = req.params.positionId;
    const application = await Application.findOne({ applicationId });
    if (!application) return res.status(404).json({ message: "Application not found" });
    application.services = (application.services || []).filter((s) => s.servicePosition.toString() !== positionId);
    await application.save();
    res.json({ message: "Position removed" });
  }
  catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// ─── HELPERS ─────────────────────────────────────────────────────────────────

async function collectDescendants(parentId) {
  const ids = [];
  const children = await ServiceCategory.find({ parent: parentId }, "_id").lean();
  for (const child of children) {
    ids.push(child._id.toString());
    const sub = await collectDescendants(child._id.toString());
    ids.push(...sub);
  }
  return ids;
}

function normalizeCell(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/^\uFEFF/, "").trim();
}
