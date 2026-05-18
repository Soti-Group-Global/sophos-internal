const express = require("express");
const multer = require("multer");
const { body } = require("express-validator");
const auth = require("../middleware/auth");
const validateUpload = require("../middleware/validateUpload");
const {
  getPublicBlogs,
  getPublicBlogById,
  createBlog,
  getAllBlogs,
  getBlogById,
  reorderBlogs,
  updateBlog,
  deleteBlog,
  getBlogImage,
} = require("../controllers/blogController");

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp|gif|svg/;
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype) return cb(null, true);
    cb(new Error("Only image files are allowed"));
  },
}).single("image");

// Public routes
router.get("/public", getPublicBlogs);
router.get("/public/:id", getPublicBlogById);
router.get("/image/:fileId", getBlogImage);

// Admin routes
router.post(
  "/",
  [
    auth,
    upload,
    body("title.en").trim().notEmpty().withMessage("English title is required"),
  ],
  validateUpload(["image"]),
  createBlog
);
router.get("/", auth, getAllBlogs);
router.put("/reorder", auth, reorderBlogs);
router.get("/:id", auth, getBlogById);
router.put(
  "/:id",
  [
    auth,
    upload,
    body("title.en")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("English title cannot be empty"),
  ],
  validateUpload(["image"]),
  updateBlog
);
router.delete("/:id", auth, deleteBlog);

module.exports = router;
