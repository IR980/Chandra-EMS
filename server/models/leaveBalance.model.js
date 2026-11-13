import mongoose from "mongoose";

export const DEFAULT_LEAVE_ENTITLEMENTS = {
  casual: 12,
  sick: 12,
  earned: 15,
  unpaid: 0,
};

const leaveBalanceAdjustmentSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true,
      validate: {
        validator: (value) => Number.isFinite(value) && value !== 0,
        message: "Adjustment amount must be a non-zero number.",
      },
    },
    previousAdjustment: { type: Number, required: true },
    newAdjustment: { type: Number, required: true },
    previousTotalEntitlement: { type: Number, required: true },
    newTotalEntitlement: { type: Number, required: true },
    previousRemaining: { type: Number, required: true },
    newRemaining: { type: Number, required: true },
    reason: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 500,
    },
    adjustedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    adjustedAt: { type: Date, default: Date.now, required: true },
  },
  { _id: true },
);

const leaveBalanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    domain: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Domain",
      required: true,
      index: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
      index: true,
    },
    leaveType: {
      type: String,
      enum: ["casual", "sick", "earned", "unpaid"],
      required: true,
    },
    year: {
      type: Number,
      required: true,
      min: 2000,
      max: 2100,
    },
    annualEntitlement: {
      type: Number,
      required: true,
      min: 0,
    },
    carriedForward: {
      type: Number,
      default: 0,
      min: 0,
    },
    used: {
      type: Number,
      default: 0,
      min: 0,
    },
    adjustment: {
      type: Number,
      default: 0,
    },
    adjustmentHistory: {
      type: [leaveBalanceAdjustmentSchema],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
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

leaveBalanceSchema.virtual("totalEntitlement").get(function () {
  return this.annualEntitlement + this.carriedForward + this.adjustment;
});

leaveBalanceSchema.virtual("remaining").get(function () {
  return Math.max(0, this.totalEntitlement - this.used);
});

leaveBalanceSchema.set("toJSON", { virtuals: true });
leaveBalanceSchema.set("toObject", { virtuals: true });

leaveBalanceSchema.index(
  { employee: 1, leaveType: 1, year: 1 },
  { unique: true },
);

leaveBalanceSchema.index({ domain: 1, department: 1, year: 1 });

const LeaveBalance = mongoose.model("LeaveBalance", leaveBalanceSchema);

export default LeaveBalance;
