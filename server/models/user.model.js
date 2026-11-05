import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 150,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address"],
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      select: false,
      minlength: 8,
    },

    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: [true, "User role is required"],
      index: true,
    },

    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },

    phone: {
      type: String,
      trim: true,
      default: null,
    },

    profilePhoto: {
      type: String,
      default: null,
    },

    accountStatus: {
      type: String,
      enum: ["active", "inactive", "suspended", "pending"],
      default: "active",
      index: true,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    passwordChangedAt: {
      type: Date,
      default: null,
    },

    failedLoginAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    lockUntil: {
      type: Date,
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Normalize email before validation
userSchema.pre("validate", function () {
  if (this.email) {
    this.email = this.email.toLowerCase().trim();
  }
});

// Virtual property for account lock status
userSchema.virtual("isLocked").get(function () {
  return Boolean(this.lockUntil && this.lockUntil > new Date());
});

// Useful indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1, accountStatus: 1 });
userSchema.index({ employee: 1 }, { sparse: true });

const User = mongoose.model("User", userSchema);

export default User;
