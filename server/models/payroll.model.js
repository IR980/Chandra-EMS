import mongoose from "mongoose";

const { Schema, model } = mongoose;

const earningsSchema = new Schema(
  {
    basic: { type: Number, default: 0, min: 0 },
    hra: { type: Number, default: 0, min: 0 },
    da: { type: Number, default: 0, min: 0 },
    travelAllowance: { type: Number, default: 0, min: 0 },
    specialAllowance: { type: Number, default: 0, min: 0 },
    otherAllowances: { type: Number, default: 0, min: 0 },
    grossMonthly: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const deductionsSchema = new Schema(
  {
    pf: { type: Number, default: 0, min: 0 },
    esi: { type: Number, default: 0, min: 0 },
    professionalTax: { type: Number, default: 0, min: 0 },
    tds: { type: Number, default: 0, min: 0 },
    otherDeductions: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const attendanceSummarySchema = new Schema(
  {
    workingDays: { type: Number, default: 0, min: 0 },
    presentDays: { type: Number, default: 0, min: 0 },
    absentDays: { type: Number, default: 0, min: 0 },
    halfDays: { type: Number, default: 0, min: 0 },
    paidLeaveDays: { type: Number, default: 0, min: 0 },
    unpaidLeaveDays: { type: Number, default: 0, min: 0 },
    holidays: { type: Number, default: 0, min: 0 },
    weekOffs: { type: Number, default: 0, min: 0 },
    payableDays: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const payrollHistorySchema = new Schema(
  {
    action: {
      type: String,
      enum: [
        "created",
        "updated",
        "verified",
        "verification_rejected",
        "approved",
        "rejected",
        "paid",
      ],
      required: true,
    },

    // Null for system-generated actions.
    actionBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    actorType: {
      type: String,
      enum: ["user", "system"],
      default: "user",
    },

    actionAt: {
      type: Date,
      default: Date.now,
    },

    remarks: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    previousStatus: {
      type: String,
      default: null,
    },

    newStatus: {
      type: String,
      default: null,
    },
  },
  { _id: false },
);

const payrollSchema = new Schema(
  {
    employee: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },

    domain: {
      type: Schema.Types.ObjectId,
      ref: "Domain",
      required: true,
      index: true,
    },

    department: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      required: true,
      index: true,
    },

    salaryStructure: {
      type: Schema.Types.ObjectId,
      ref: "SalaryStructure",
      required: true,
    },

    payrollMonth: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },

    payrollYear: {
      type: Number,
      required: true,
      min: 2000,
      max: 2100,
    },

    periodStart: {
      type: Date,
      required: true,
    },

    periodEnd: {
      type: Date,
      required: true,
    },

    // Identifies how this payroll record was generated.
    generationSource: {
      type: String,
      enum: ["manual", "automatic"],
      default: "manual",
      index: true,
    },

    salarySnapshot: {
      salaryMode: {
        type: String,
        enum: ["component", "gross"],
        required: true,
      },

      currency: {
        type: String,
        enum: ["INR"],
        default: "INR",
      },

      payFrequency: {
        type: String,
        default: "monthly",
      },

      earnings: {
        type: earningsSchema,
        default: () => ({}),
      },

      deductions: {
        type: deductionsSchema,
        default: () => ({}),
      },

      effectiveFrom: {
        type: Date,
        required: true,
      },

      effectiveTo: {
        type: Date,
        default: null,
      },
    },

    attendanceSummary: {
      type: attendanceSummarySchema,
      default: () => ({}),
    },

    grossPay: {
      type: Number,
      required: true,
      min: 0,
    },

    totalDeductions: {
      type: Number,
      required: true,
      min: 0,
    },

    netPay: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: ["draft", "verified", "approved", "paid"],
      default: "draft",
      index: true,
    },

    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },

    verificationRemarks: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    approvalRemarks: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    paidBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    paymentMethod: {
      type: String,
      enum: ["bank_transfer", "upi", "cash", "cheque", "other"],
      default: null,
    },

    paymentReference: {
      type: String,
      trim: true,
      maxlength: 150,
      default: "",
    },

    remarks: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    history: {
      type: [payrollHistorySchema],
      default: [],
    },

    // Null is allowed for system-generated payroll.
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    createdByType: {
      type: String,
      enum: ["user", "system"],
      default: "user",
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Prevent duplicate payroll for an employee in the same month.
payrollSchema.index(
  {
    employee: 1,
    payrollMonth: 1,
    payrollYear: 1,
  },
  { unique: true },
);

payrollSchema.index({
  domain: 1,
  department: 1,
  payrollYear: 1,
  payrollMonth: 1,
  status: 1,
});

payrollSchema.virtual("monthName").get(function () {
  return new Date(this.payrollYear, this.payrollMonth - 1, 1).toLocaleString(
    "en-IN",
    { month: "long" },
  );
});

const Payroll = model("Payroll", payrollSchema);

export default Payroll;
