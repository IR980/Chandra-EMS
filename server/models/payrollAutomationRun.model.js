import mongoose from "mongoose";

const payrollAutomationRunSchema = new mongoose.Schema(
  {
    payrollMonth: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },

    payrollYear: {
      type: Number,
      required: true,
      min: 2020,
    },

    status: {
      type: String,
      enum: ["running", "completed", "failed"],
      default: "running",
      required: true,
    },

    startedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    lastAttemptAt: {
      type: Date,
      default: Date.now,
    },

    lockedUntil: {
      type: Date,
      default: null,
    },

    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    generatedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    skippedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    errorMessage: {
      type: String,
      default: "",
      maxlength: 2000,
    },
  },
  {
    timestamps: true,
  },
);

// Only one automation tracking record per payroll month.
payrollAutomationRunSchema.index(
  {
    payrollYear: 1,
    payrollMonth: 1,
  },
  {
    unique: true,
  },
);

// Useful for checking incomplete or failed automation runs.
payrollAutomationRunSchema.index({
  status: 1,
  lockedUntil: 1,
});

const PayrollAutomationRun = mongoose.model(
  "PayrollAutomationRun",
  payrollAutomationRunSchema,
);

export default PayrollAutomationRun;
