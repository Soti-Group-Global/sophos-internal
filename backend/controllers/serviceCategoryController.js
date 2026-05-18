const mongoose = require("mongoose");
const ServiceCategory = require("../models/ServiceCategory");
const ServicePosition = require("../models/ServicePosition");


// ─── CATEGORIES (folders) ────────────────────────────────────────────────────

//get all categories
exports.getAllCategories = async (req, res) => {
    try {
    const { parent, branch, linkedOnly, flat } = req.query;

    // Special mode: return ALL categories with minimal fields for tree building
    if (flat === "true") {
      const cats = await ServiceCategory.find({})
        .select("name parent isActive sortOrder")
        .sort({ sortOrder: 1, name: 1 })
        .lean();
      return res.json({ categories: cats });
    }

    // Special mode: return all linked-speciality categories across every level
    if (linkedOnly === "true") {
      const categories = await ServiceCategory.find(
        { isLinkedWithSpeciality: true }
      ).lean();
      return res.json({ categories });
    }

    const filter = {};

    if (parent === "root" || parent === undefined) {
      filter.parent = null;
    } else if (mongoose.isValidObjectId(parent)) {
      filter.parent = parent;
    }

    if (branch && branch !== "all") filter.branch = branch;

    const categories = await ServiceCategory.find(filter)
      .populate("speciality", "name_en name_ru")
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    res.json({ categories });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

//get category by id
exports.getCategoryById = async (req, res) => {
    try {
    const category = await ServiceCategory.findById(req.params.id)
      .populate("parent", "name")
      .populate("speciality", "name_en name_ru")
      .lean();
    if (!category) return res.status(404).json({ message: "Category not found" });
    res.json({ category });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

//get category breadcrumb
exports.getCategoryBreadcrumb = async (req,res) => {
    try {
    const breadcrumb = [];
    let current = await ServiceCategory.findById(req.params.id).lean();
    if (!current) return res.status(404).json({ message: "Category not found" });

    breadcrumb.unshift(current);
    while (current.parent) {
      current = await ServiceCategory.findById(current.parent).lean();
      if (!current) break;
      breadcrumb.unshift(current);
    }
    res.json({ breadcrumb });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

//create category
exports.createCategory = async (req, res) =>{
    try {
    const body = { ...req.body };
    if (!body.parent || body.parent === "root") body.parent = null;
    if (!Array.isArray(body.specialities)) body.specialities = [];
    const category = new ServiceCategory(body);
    await category.save();
    res.status(201).json({ category });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

//update category
exports.updateCategory = async (req, res) => {
    try {
        const body = { ...req.body };
        if (!body.parent || body.parent === "root") body.parent = null;
        if (!Array.isArray(body.specialities)) body.specialities = [];
    
        // Prevent a category from becoming its own ancestor
        if (body.parent && body.parent.toString() === req.params.id.toString()) {
          return res.status(400).json({ message: "A category cannot be its own parent" });
        }
    
        const category = await ServiceCategory.findByIdAndUpdate(
          req.params.id,
          body,
          { new: true, runValidators: true }
        );
        if (!category) return res.status(404).json({ message: "Category not found" });
        res.json({ category });
      } catch (err) {
        res.status(400).json({ message: err.message });
      }
};

//delete category
exports.deleteCategory = async (req, res) => {
    try {
    const toDelete = await collectDescendants(req.params.id);
    toDelete.push(req.params.id);

    await ServicePosition.deleteMany({ category: { $in: toDelete } });
    await ServiceCategory.deleteMany({ _id: { $in: toDelete } });

    res.json({ message: "Deleted", count: toDelete.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/service-manager/categories/:id/move
// Body: { parent: "<newParentId>" | null }
exports.moveCategory = async (req, res) => {
  try {
      const { parent } = req.body;
      const category = await ServiceCategory.findByIdAndUpdate(
        req.params.id,
        { parent: parent || null },
        { new: true }
      );
      if (!category) return res.status(404).json({ message: "Category not found" });
      res.json({ category });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
};

// GET /api/service-manager/folder
// Build a Set of category IDs that match specialities or have a matching descendant.
// Uses a single bulk query — no N+1.
async function buildMatchingCategoryIds(specIdSet) {
  const allCats = await ServiceCategory.find({}).select("_id parent specialities").lean();

  // Map: parentId -> [childId, ...]
  const childrenMap = {};
  const matchesDirectly = new Set();
  for (const cat of allCats) {
    const parentKey = cat.parent ? cat.parent.toString() : "__root__";
    if (!childrenMap[parentKey]) childrenMap[parentKey] = [];
    childrenMap[parentKey].push(cat._id.toString());

    const specs = (cat.specialities || []).map((s) => s.toString());
    if (specs.some((s) => specIdSet.has(s))) matchesDirectly.add(cat._id.toString());
  }

  // Expand: any category whose descendant matches also matches
  const result = new Set(matchesDirectly);
  const propagate = (id) => {
    const children = childrenMap[id] || [];
    for (const childId of children) {
      if (result.has(childId)) {
        result.add(id);
        return true;
      }
      if (propagate(childId)) {
        result.add(id);
        return true;
      }
    }
    return false;
  };
  for (const cat of allCats) {
    if (!result.has(cat._id.toString())) propagate(cat._id.toString());
  }
  return result;
}

// ?parent=<id|root>  &branch=  &specialities=id1,id2  — returns { categories, positions }
// Used for rendering a single folder view (like a file browser).
exports.getFolderContents = async (req, res) => {
  try {
    const { parent, branch, specialities } = req.query;
    const parentVal = !parent || parent === "root" ? null : parent;

    const catFilter = { parent: parentVal };
    const posFilter = { category: parentVal };
    if (branch && branch !== "all") {
      catFilter.branch = branch;
      posFilter.branch = branch;
    }

    const [categories, positions] = await Promise.all([
      ServiceCategory.find(catFilter).sort({ sortOrder: 1, name: 1 }).lean(),
      ServicePosition.find(posFilter).sort({ sortOrder: 1, name: 1 }).lean(),
    ]);

    if (specialities) {
      const specIdSet = new Set(specialities.split(",").map((s) => s.trim()).filter(Boolean));
      const matchingIds = await buildMatchingCategoryIds(specIdSet);
      const filtered = categories.filter((cat) => matchingIds.has(cat._id.toString()));
      return res.json({ categories: filtered, positions });
    }

    res.json({ categories, positions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/service-manager/export
// Query: ?categories=id1,id2,id3  (omit for all)
// Returns a CSV file with BOM for Excel compatibility.
exports.exportToCSV = async (req, res) => {
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
exports.importFromCSV = async (req, res) => {
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