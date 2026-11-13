import mongoose from "mongoose";

const leaveEntitlementSchema = new mongoose.Schema(
  {
    casual: {
      type: Number,
      default: 12,
      min: 0,
    },
    sick: {
      type: Number,
      default: 12,
      min: 0,
    },
    earned: {
      type: Number,
      default: 15,
      min: 0,
    },
    unpaid: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false },
);

const companyHolidaySchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true },
);

const leavePolicySchema = new mongoose.Schema(
  {
    domain: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Domain",
      required: true,
      index: true,
    },

    year: {
      type: Number,
      required: true,
      min: 2000,
      max: 2100,
      default: () => new Date().getFullYear(),
    },

    leaveEntitlements: {
      type: leaveEntitlementSchema,
      default: () => ({}),
    },

    // JavaScript weekday numbers:
    // Sunday = 0, Monday = 1, ..., Saturday = 6.
    // Default schedule: Monday to Saturday.
    workingDays: {
      type: [
        {
          type: Number,
          min: 0,
          max: 6,
        },
      ],
      default: [1, 2, 3, 4, 5, 6],
      validate: {
        validator: (days) =>
          Array.isArray(days) &&
          days.length > 0 &&
          new Set(days).size === days.length,
        message: "Working days must contain unique weekday values.",
      },
    },

    holidays: {
      type: [companyHolidaySchema],
      default: [],
    },

    allowUnpaidLeave: {
      type: Boolean,
      default: true,
    },

    allowHalfDayLeave: {
      type: Boolean,
      default: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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

leavePolicySchema.index({ domain: 1, year: 1 }, { unique: true });

leavePolicySchema.index({
  domain: 1,
  isActive: 1,
  year: 1,
});

const LeavePolicy = mongoose.model("LeavePolicy", leavePolicySchema);

export default LeavePolicy;
