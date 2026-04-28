const mongoose = require("mongoose");
const Blog = require("../models/Blog");
const { getGfsBlogs } = require("../gridfs-blogs");

const normalizeBranch = (value) => {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value.filter(Boolean);

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch (_) {
      // ignore
    }
    return [trimmed];
  }

  return [String(value)].filter(Boolean);
};

const getBranchQuery = (branch) => {
  if (!branch) return undefined;
  const raw = String(branch).trim();
  if (!raw) return undefined;
  if (raw.toLowerCase() === "all") return undefined;

  const key = raw.toLowerCase();
  const values = new Set([raw]);

  if (key === "moscow" || key.includes("moscow")) {
    values.add("Moscow Clinic");
    values.add("Клиника Москва");
  } else if (key === "makhachkala" || key.includes("makhachkala")) {
    values.add("Makhachkala Clinic");
    values.add("Клиника Махачкала");
  } else if (key === "spb" || key.includes("petersburg") || key.includes("saint")) {
    values.add("Saint Petersburg Clinic");
    values.add("Клиника Санкт-Петербург");
  }

  return { $in: Array.from(values) };
};

const getImageUrl = (req, imageFileId) => {
  if (!imageFileId) return null;
  return `${req.protocol}://${req.get('host')}/api/blogs/image/${imageFileId}`;
};

// GET PUBLIC BLOGS
const getPublicBlogs = async (req, res) => {
  try {
    const { tag, category, branch, type, lang = "en", page = 1, limit = 10 } = req.query;

    const query = {
      status: "published",
      showAt: { $lte: new Date() },
    };

    if (tag) query[`tags.${lang}`] = { $in: [tag] };
    if (category) query[`categories.${lang}`] = { $in: [category] };
    if (type) query.types = { $in: [type] };
    const branchQuery = getBranchQuery(branch);
    if (branchQuery) query.branch = branchQuery;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const blogs = await Blog.find(query)
      .sort({ order: 1, showAt: 1, createdAt: 1 })
      .skip(skip)
      .limit(limitNumber);

    const transformedBlogs = blogs.map((blog) => ({
      _id: blog._id,
      title: blog.getTitle(lang),
      description: blog.getDescription(lang),
      tags: blog.getTags(lang),
      categories: blog.getCategories(lang),
      image: getImageUrl(req, blog.imageFileId),
      branch: blog.branch || [],
      status: blog.status,
      showAt: blog.showAt,
      types: blog.types || [],
      createdAt: blog.createdAt,
      updatedAt: blog.updatedAt,
    }));

    const total = await Blog.countDocuments(query);
    const totalPages = Math.ceil(total / limitNumber);

    res.json({
      success: true,
      blogs: transformedBlogs,
      total,
      page: pageNumber,
      limit: limitNumber,
      totalPages,
      hasNextPage: pageNumber < totalPages,
      hasPrevPage: pageNumber > 1,
      language: lang,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// GET SINGLE BLOG (Public)
const getPublicBlogById = async (req, res) => {
  try {
    const { lang = "en" } = req.query;

    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    if (blog.status !== "published") {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    if (blog.showAt > new Date()) {
      return res.status(404).json({
        success: false,
        message: "Blog not available yet",
      });
    }

    const transformedBlog = {
      _id: blog._id,
      title: blog.getTitle(lang),
      description: blog.getDescription(lang),
      tags: blog.getTags(lang),
      categories: blog.getCategories(lang),
      image: getImageUrl(req, blog.imageFileId),
      branch: blog.branch || [],
      status: blog.status,
      showAt: blog.showAt,
      types: blog.types || [],
      createdAt: blog.createdAt,
      updatedAt: blog.updatedAt,
    };

    res.json({
      success: true,
      blog: transformedBlog,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// CREATE BLOG (Admin only)
const createBlog = async (req, res) => {
  try {
    const { validationResult } = require("express-validator");
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });

    const {
      title = {},
      description = {},
      tags = [],
      categories = [],
      branch,
      status = "draft",
      showAt = new Date(),
      types = [],
    } = req.body;

    if (!title.en || title.en.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "English title is required",
      });
    }

    const blog = new Blog({
      title: {
        en: title.en.trim(),
        ru: title.ru?.trim() || "",
      },
      description: {
        en: description.en?.trim() || "",
        ru: description.ru?.trim() || "",
      },
      tags: tags.map((tag) => ({
        en: tag.en?.trim() || "",
        ru: tag.ru?.trim() || "",
      })),
      categories: categories.map((cat) => ({
        en: cat.en?.trim() || "",
        ru: cat.ru?.trim() || "",
      })),
      branch: normalizeBranch(branch) || [],
      status,
      showAt,
      types: Array.isArray(types) ? types : (typeof types === 'string' ? JSON.parse(types) : []),
    });

    if (req.file) {
      const gfs = getGfsBlogs();
      const writeStream = gfs.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype,
      });
      writeStream.end(req.file.buffer);

      const fileId = await new Promise((resolve, reject) => {
        writeStream.on("finish", () => resolve(writeStream.id));
        writeStream.on("error", reject);
      });

      blog.imageFileId = fileId;
    }

    await blog.save();

    const blogResponse = blog.toObject();
    blogResponse.image = getImageUrl(req, blog.imageFileId);

    res.status(201).json({
      success: true,
      blog: blogResponse,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// GET ALL BLOGS (Admin only)
const getAllBlogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      tag,
      category,
      branch,
      type,
      lang = "en",
    } = req.query;

    const query = {};

    if (status) query.status = status;
    if (tag) query[`tags.${lang}`] = { $in: [tag] };
    if (category) query[`categories.${lang}`] = { $in: [category] };
    if (type) query.types = { $in: [type] };
    const branchQuery = getBranchQuery(branch);
    if (branchQuery) query.branch = branchQuery;

    const skip = (page - 1) * limit;

    const blogs = await Blog.find(query)
      .sort({ order: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const transformedBlogs = blogs.map((blog) => ({
      _id: blog._id,
      title: blog.title,
      description: blog.description,
      tags: blog.tags,
      categories: blog.categories,
      image: getImageUrl(req, blog.imageFileId),
      branch: blog.branch || [],
      status: blog.status,
      showAt: blog.showAt,
      types: blog.types || [],
      createdAt: blog.createdAt,
      updatedAt: blog.updatedAt,
      preview: {
        title: blog.getTitle(lang),
        description: blog.getDescription(lang),
        tags: blog.getTags(lang),
        categories: blog.getCategories(lang),
      },
    }));

    const total = await Blog.countDocuments(query);

    res.json({
      success: true,
      blogs: transformedBlogs,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// GET BLOG BY ID (Admin only)
const getBlogById = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog)
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });

    const blogResponse = blog.toObject();
    blogResponse.image = getImageUrl(req, blog.imageFileId);

    res.json({
      success: true,
      blog: blogResponse,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// UPDATE BLOGS ORDER (Admin only)
const reorderBlogs = async (req, res) => {
  try {
    const { orderedBlogIds } = req.body;

    if (!Array.isArray(orderedBlogIds)) {
      return res.status(400).json({
        success: false,
        message: "orderedBlogIds must be an array",
      });
    }

    const updatePromises = orderedBlogIds.map((blogId, index) =>
      Blog.findByIdAndUpdate(blogId, { order: index })
    );

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: "Blog order updated successfully",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// UPDATE BLOG (Admin only)
const updateBlog = async (req, res) => {
  try {
    const { validationResult } = require("express-validator");
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });

    const blog = await Blog.findById(req.params.id);
    if (!blog)
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });

    const { title, description, tags, categories, status, showAt, types } = req.body;

    if (title) {
      if (title.en !== undefined) blog.title.en = title.en.trim();
      if (title.ru !== undefined) blog.title.ru = title.ru.trim();
    }

    if (description) {
      if (description.en !== undefined)
        blog.description.en = description.en.trim();
      if (description.ru !== undefined)
        blog.description.ru = description.ru.trim();
    }

    if (tags) {
      blog.tags = tags.map((tag) => ({
        en: tag.en?.trim() || "",
        ru: tag.ru?.trim() || "",
      }));
    }

    if (categories) {
      blog.categories = categories.map((cat) => ({
        en: cat.en?.trim() || "",
        ru: cat.ru?.trim() || "",
      }));
    }

    if (status) blog.status = status;
    if (showAt) blog.showAt = showAt;
    if (types) blog.types = Array.isArray(types) ? types : (typeof types === 'string' ? JSON.parse(types) : []);

    if (req.body.branch !== undefined) {
      blog.branch = normalizeBranch(req.body.branch) || [];
    }

    if (req.file) {
      const gfs = getGfsBlogs();

      if (blog.imageFileId) {
        try {
          await gfs.delete(new mongoose.Types.ObjectId(blog.imageFileId));
        } catch (e) {
        }
      }

      const writeStream = gfs.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype,
      });
      writeStream.end(req.file.buffer);

      const fileId = await new Promise((resolve, reject) => {
        writeStream.on("finish", () => resolve(writeStream.id));
        writeStream.on("error", reject);
      });

      blog.imageFileId = fileId;
    }

    await blog.save();

    const blogResponse = blog.toObject();
    blogResponse.image = getImageUrl(req, blog.imageFileId);

    res.json({
      success: true,
      blog: blogResponse,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// DELETE BLOG (Admin only)
const deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog)
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });

    if (blog.imageFileId) {
      try {
        const gfs = getGfsBlogs();
        await gfs.delete(new mongoose.Types.ObjectId(blog.imageFileId));
      } catch (e) {
      }
    }

    await blog.deleteOne();

    res.json({
      success: true,
      message: "Blog deleted",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// SERVE BLOG IMAGE (Public)
const getBlogImage = async (req, res) => {
  try {
    const gfs = getGfsBlogs();
    const file = await gfs
      .find({ _id: new mongoose.Types.ObjectId(req.params.fileId) })
      .toArray();

    if (!file.length)
      return res.status(404).json({
        success: false,
        message: "Image not found",
      });

    res.set("Content-Type", file[0].contentType);
    const readStream = gfs.openDownloadStream(file[0]._id);
    readStream.pipe(res);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = {
  getPublicBlogs,
  getPublicBlogById,
  createBlog,
  getAllBlogs,
  getBlogById,
  reorderBlogs,
  updateBlog,
  deleteBlog,
  getBlogImage,
};
