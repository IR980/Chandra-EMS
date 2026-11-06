import mongoose from "mongoose";

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Role name is required"],
      trim: true,
      maxlength: 80,
    },

    slug: {
      type: String,
      required: [true, "Role slug is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      maxlength: 300,
    },

    level: {
      type: Number,
      required: true,
      min: 1,
      default: 10,
    },

    permissions: [
      {
        type: String,
        trim: true,
      },
    ],

    scope: {
      type: String,
      enum: ["global", "assigned", "self"],
      default: "self",
    },

    isSystemRole: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Generate slug automatically from role name
roleSchema.pre("validate", function () {
  if (this.name) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }
});

// Indexes
roleSchema.index({ slug: 1 }, { unique: true });
roleSchema.index({ isActive: 1, level: 1 });

const Role = mongoose.model("Role", roleSchema);

export default Role;
