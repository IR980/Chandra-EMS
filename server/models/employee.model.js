import mongoose from "mongoose";
import Counter from "./counter.model.js";

const employeeSchema = new mongoose.Schema(
  {
    employeeCode: {
      type: String,
      unique: true,
      immutable: true,
      trim: true,
    },

    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      maxlength: 50,
    },

    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      maxlength: 50,
    },

    fullName: {
      type: String,
      trim: true,
    },

    profilePhoto: {
      type: String,
      default: null,
    },

    dateOfBirth: {
      type: Date,
      default: null,
    },

    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer_not_to_say"],
      default: "prefer_not_to_say",
    },

    workEmail: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true,
      unique: true,
    },

    personalEmail: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },

    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },

    alternatePhone: {
      type: String,
      default: null,
      trim: true,
    },

    address: {
      street: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      postalCode: { type: String, default: "" },
      country: { type: String, default: "India" },
    },

    designation: {
      type: String,
      required: [true, "Designation is required"],
      trim: true,
    },

    employmentType: {
      type: String,
      enum: ["full_time", "part_time", "contract", "intern"],
      default: "full_time",
    },

    joiningDate: {
      type: Date,
      required: [true, "Joining date is required"],
    },

    confirmationDate: {
      type: Date,
      default: null,
    },

    employmentStatus: {
      type: String,
      enum: ["active", "on_leave", "inactive", "terminated"],
      default: "active",
      index: true,
    },

    exitDate: {
      type: Date,
      default: null,
    },

    domain: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Domain",
      required: [true, "Business domain is required"],
      index: true,
    },

    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: [true, "Department is required"],
      index: true,
    },

    reportingManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
      index: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: undefined,
    },

    emergencyContact: {
      name: { type: String, default: "" },
      relationship: { type: String, default: "" },
      phone: { type: String, default: "" },
    },

    notes: {
      type: String,
      default: "",
      maxlength: 1000,
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

// Automatically generate full name and employee code.
employeeSchema.pre("validate", function () {
  if (this.firstName || this.lastName) {
    this.fullName = `${this.firstName || ""} ${this.lastName || ""}`.trim();
  }

  if (this.workEmail) {
    this.workEmail = this.workEmail.toLowerCase().trim();
  }

  if (this.personalEmail) {
    this.personalEmail = this.personalEmail.toLowerCase().trim();
  }
});

// Generate a unique employee code using an atomic counter.
employeeSchema.pre("save", async function () {
  if (this.isNew && !this.employeeCode) {
    const counter = await Counter.findOneAndUpdate(
      { name: "employee" },
      { $inc: { sequence: 1 } },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );

    this.employeeCode = `CE-EMP-${String(counter.sequence).padStart(4, "0")}`;
  }
});
employeeSchema.index(
  { user: 1 },
  {
    unique: true,
    partialFilterExpression: {
      user: { $type: "objectId" },
    },
  },
);
employeeSchema.index({ department: 1, employmentStatus: 1 });
employeeSchema.index({ domain: 1, employmentStatus: 1 });
employeeSchema.index({ fullName: 1 });
employeeSchema.index({ joiningDate: -1 });

const Employee = mongoose.model("Employee", employeeSchema);

export default Employee;
