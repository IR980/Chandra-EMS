import mongoose from "mongoose";

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Department name is required"],
      trim: true,
      maxlength: 100,
    },

    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 20,
    },

    description: {
      type: String,
      default: "",
      maxlength: 500,
    },

    domain: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Domain",
      required: [true, "Domain is required"],
      index: true,
    },

    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },

    parentDepartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
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

departmentSchema.pre("validate", function () {
  if (this.name) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  if (this.code) {
    this.code = this.code.toUpperCase().trim();
  }
});

// Department name and code must be unique within each domain.
departmentSchema.index({ domain: 1, slug: 1 }, { unique: true });

departmentSchema.index({ domain: 1, code: 1 }, { unique: true });

departmentSchema.index({ status: 1, domain: 1 });

const Department = mongoose.model("Department", departmentSchema);

export default Department;
