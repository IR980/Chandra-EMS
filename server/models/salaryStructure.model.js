import mongoose from "mongoose";
const { Schema } = mongoose;

// Reusable salary component schema.
// All amounts are monthly amounts in INR.
const salaryComponentsSchema = new Schema(
  {
    basic: {
      type: Number,
      default: 0,
      min: [0, "Basic salary cannot be negative"],
    },
    hra: {
      type: Number,
      default: 0,
      min: [0, "HRA cannot be negative"],
    },
    da: {
      type: Number,
      default: 0,
      min: [0, "DA cannot be negative"],
    },
    travelAllowance: {
      type: Number,
      default: 0,
      min: [0, "Travel allowance cannot be negative"],
    },
    specialAllowance: {
      type: Number,
      default: 0,
      min: [0, "Special allowance cannot be negative"],
    },
    otherAllowances: {
      type: Number,
      default: 0,
      min: [0, "Other allowances cannot be negative"],
    },
  },
  { _id: false },
);

const salaryDeductionsSchema = new Schema(
  {
    pf: {
      type: Number,
      default: 0,
      min: [0, "PF deduction cannot be negative"],
    },
    esi: {
      type: Number,
      default: 0,
      min: [0, "ESI deduction cannot be negative"],
    },
    professionalTax: {
      type: Number,
      default: 0,
      min: [0, "Professional tax cannot be negative"],
    },
    tds: {
      type: Number,
      default: 0,
      min: [0, "TDS cannot be negative"],
    },
    otherDeductions: {
      type: Number,
      default: 0,
      min: [0, "Other deductions cannot be negative"],
    },
  },
  { _id: false },
);

const salaryStructureSchema = new Schema(
  {
    employee: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Employee is required"],
      index: true,
    },

    domain: {
      type: Schema.Types.ObjectId,
      ref: "Domain",
      required: [true, "Domain is required"],
      index: true,
    },

    department: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      required: [true, "Department is required"],
      index: true,
    },

    // Both salary entry modes are supported.
    salaryMode: {
      type: String,
      enum: {
        values: ["component", "gross"],
        message: "Salary mode must be component or gross",
      },
      required: true,
    },

    currency: {
      type: String,
      enum: ["INR"],
      default: "INR",
      required: true,
    },

    payFrequency: {
      type: String,
      enum: ["monthly"],
      default: "monthly",
      required: true,
    },

    // Used when salaryMode is "component".
    earnings: {
      type: salaryComponentsSchema,
      default: () => ({}),
    },

    // Used when salaryMode is "gross".
    grossMonthly: {
      type: Number,
      min: [0, "Gross monthly salary cannot be negative"],
      default: 0,
    },

    // Deductions apply to both salary modes.
    deductions: {
      type: salaryDeductionsSchema,
      default: () => ({}),
    },

    effectiveFrom: {
      type: Date,
      required: [true, "Salary effective date is required"],
    },

    effectiveTo: {
      type: Date,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    remarks: {
      type: String,
      trim: true,
      maxlength: [1000, "Remarks cannot exceed 1000 characters"],
      default: "",
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
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

// Component-wise gross monthly earnings.
salaryStructureSchema.virtual("totalEarnings").get(function () {
  if (this.salaryMode === "gross") {
    return Number(this.grossMonthly || 0);
  }

  const earnings = this.earnings || {};

  return (
    Number(earnings.basic || 0) +
    Number(earnings.hra || 0) +
    Number(earnings.da || 0) +
    Number(earnings.travelAllowance || 0) +
    Number(earnings.specialAllowance || 0) +
    Number(earnings.otherAllowances || 0)
  );
});

// Total monthly deductions.
salaryStructureSchema.virtual("totalDeductions").get(function () {
  const deductions = this.deductions || {};

  return (
    Number(deductions.pf || 0) +
    Number(deductions.esi || 0) +
    Number(deductions.professionalTax || 0) +
    Number(deductions.tds || 0) +
    Number(deductions.otherDeductions || 0)
  );
});

// Net monthly salary before attendance-based payroll adjustments.
salaryStructureSchema.virtual("netMonthlySalary").get(function () {
  return Math.max(0, this.totalEarnings - this.totalDeductions);
});

// Validate salary mode and effective dates.
salaryStructureSchema.pre("validate", function () {
  if (this.effectiveFrom && this.effectiveTo) {
    if (this.effectiveTo < this.effectiveFrom) {
      this.invalidate(
        "effectiveTo",
        "Effective end date cannot be earlier than start date",
      );
    }
  }

  if (this.salaryMode === "component") {
    const earnings = this.earnings || {};

    const total =
      Number(earnings.basic || 0) +
      Number(earnings.hra || 0) +
      Number(earnings.da || 0) +
      Number(earnings.travelAllowance || 0) +
      Number(earnings.specialAllowance || 0) +
      Number(earnings.otherAllowances || 0);

    if (total <= 0) {
      this.invalidate(
        "earnings",
        "At least one salary earning component must be greater than zero",
      );
    }
  }

  if (this.salaryMode === "gross") {
    if (Number(this.grossMonthly || 0) <= 0) {
      this.invalidate(
        "grossMonthly",
        "Gross monthly salary must be greater than zero",
      );
    }
  }
});

// Only one active salary structure per employee.
// Previous salary records can remain stored as inactive history.
salaryStructureSchema.index(
  { employee: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
    name: "one_active_salary_structure_per_employee",
  },
);

salaryStructureSchema.index({
  domain: 1,
  department: 1,
  isActive: 1,
});

salaryStructureSchema.index({
  employee: 1,
  effectiveFrom: -1,
});

const SalaryStructure = mongoose.model(
  "SalaryStructure",
  salaryStructureSchema,
);

export default SalaryStructure;