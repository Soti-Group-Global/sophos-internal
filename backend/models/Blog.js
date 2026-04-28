// models/Blog.js
const mongoose = require("mongoose");

const BlogSchema = new mongoose.Schema(
  {
    title: {
      en: {
        type: String,
        required: true,
        trim: true,
      },
      ru: {
        type: String,
        trim: true,
        default: "",
      },
    },
    imageFileId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    description: {
      en: {
        type: String,
        default: "",
      },
      ru: {
        type: String,
        default: "",
      },
    },
    tags: [
      {
        en: {
          type: String,
          trim: true,
        },
        ru: {
          type: String,
          trim: true,
        },
      },
    ],
    categories: [
      {
        en: {
          type: String,
          trim: true,
        },
        ru: {
          type: String,
          trim: true,
        },
      },
    ],
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    branch: [{
      type: String,
    }],
    showAt: {
      type: Date,
      default: Date.now,
    },
    types: {
      type: [String],
      default: [],
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

BlogSchema.virtual("titleText").get(function () {
  return this.title?.en || "";
});

BlogSchema.virtual("descriptionText").get(function () {
  return this.description?.en || "";
});

BlogSchema.methods.getTitle = function (lang = "en") {
  return this.title[lang] || this.title.en || "";
};

BlogSchema.methods.getDescription = function (lang = "en") {
  return this.description[lang] || this.description.en || "";
};

BlogSchema.methods.getTags = function (lang = "en") {
  return this.tags.map((tag) => tag[lang] || tag.en || "").filter((tag) => tag);
};

BlogSchema.methods.getCategories = function (lang = "en") {
  return this.categories
    .map((cat) => cat[lang] || cat.en || "")
    .filter((cat) => cat);
};

BlogSchema.index({ status: 1, showAt: -1 });
BlogSchema.index({ "categories.en": 1, showAt: -1 });
BlogSchema.index({ "categories.ru": 1, showAt: -1 });
BlogSchema.index({ "tags.en": 1 });
BlogSchema.index({ "tags.ru": 1 });
BlogSchema.index({ createdAt: -1 });
BlogSchema.index({ imageFileId: 1 });
BlogSchema.index({ order: 1 });

module.exports = mongoose.model("Blog", BlogSchema);
