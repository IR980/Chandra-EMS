import mongoose from "mongoose";
import SalaryStructure from "../models/salaryStructure.model.js";
import Employee from "../models/employee.model.js";
import Domain from "../models/domain.model.js";
import Department from "../models/department.model.js";

const sendError = (res, status, message) =>
  res.status(status).json({ success: false, message });

const getPagination = (query) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(query.limit, 10) || 20),
  );
  return { page, limit, skip: (page - 1) * limit };
};

// Global users see all records; self users see their own;
// assigned users see their own plus domains/departments they manage.
const getPayrollScope = async (user) => {
  const scope = user.role?.scope || "self";
  if (scope === "global") return {};

  const ownEmployee = await Employee.findOne({ user: user._id })
    .select("_id domain department")
    .lean();

  if (!ownEmployee) return { employee: new mongoose.Types.ObjectId() };
  if (scope === "self") return { employee: ownEmployee._id };

  const [headedDomains, managedDepartments] = await Promise.all([
    Domain.find({ head: ownEmployee._id }).select("_id").lean(),
    Department.find({ manager: ownEmployee._id }).select("_id").lean(),
  ]);

  const conditions = [{ employee: ownEmployee._id }];
  if (headedDomains.length) {
    conditions.push({ domain: { $in: headedDomains.map((item) => item._id) } });
  }
  if (managedDepartments.length) {
    conditions.push({
      department: { $in: managedDepartments.map((item) => item._id) },
    });
  }
  return { $or: conditions };
};

const getEmployeeScope = async (user) => {
  const scope = await getPayrollScope(user);
  if (scope.employee) return { _id: scope.employee };
  if (scope.$or) {
    return {
      $or: scope.$or.map((condition) => {
        if (condition.employee) return { _id: condition.employee };
        return condition;
      }),
    };
  }
  return {};
};

const populateSalary = (query) =>
  query
    .populate("employee", "employeeCode fullName designation employmentStatus")
    .populate("domain", "name code")
    .populate("department", "name code")
    .populate("createdBy", "fullName email")
    .populate("updatedBy", "fullName email");

// POST /api/payroll/structures
export const createSalaryStructure = async (req, res, next) => {
  try {
    const { employee: employeeId, salaryMode, effectiveFrom } = req.body;

    if (!mongoose.isValidObjectId(employeeId)) {
      return sendError(res, 400, "A valid employee ID is required.");
    }
    if (!["component", "gross"].includes(salaryMode)) {
      return sendError(res, 400, "Salary mode must be component or gross.");
    }
    if (!effectiveFrom || Number.isNaN(Date.parse(effectiveFrom))) {
      return sendError(res, 400, "A valid salary effective date is required.");
    }

    const employeeScope = await getEmployeeScope(req.user);
    const employee = await Employee.findOne({
      $and: [{ _id: employeeId }, employeeScope],
    }).select("_id domain department employmentStatus");

    if (!employee) {
      return sendError(
        res,
        404,
        "Employee not found or outside your access scope.",
      );
    }
    if (!["active", "on_leave"].includes(employee.employmentStatus)) {
      return sendError(
        res,
        400,
        "Salary can only be assigned to an active or on-leave employee.",
      );
    }

    const existing = await SalaryStructure.findOne({
      employee: employee._id,
      isActive: true,
    });
    if (existing) {
      return sendError(
        res,
        409,
        "This employee already has an active salary structure. Use the salary update endpoint.",
      );
    }

    const salary = await SalaryStructure.create({
      employee: employee._id,
      domain: employee.domain,
      department: employee.department,
      salaryMode,
      currency: "INR",
      payFrequency: "monthly",
      earnings: salaryMode === "component" ? req.body.earnings : {},
      grossMonthly: salaryMode === "gross" ? req.body.grossMonthly : 0,
      deductions: req.body.deductions || {},
      effectiveFrom: new Date(effectiveFrom),
      remarks: req.body.remarks || "",
      createdBy: req.user._id,
    });

    const populated = await populateSalary(
      SalaryStructure.findById(salary._id),
    );
    return res.status(201).json({
      success: true,
      message: "Salary structure created successfully.",
      data: { salaryStructure: populated },
    });
  } catch (error) {
    if (error.code === 11000) {
      return sendError(
        res,
        409,
        "An active salary structure already exists for this employee.",
      );
    }
    if (error.name === "ValidationError")
      return sendError(res, 400, error.message);
    next(error);
  }
};

// GET /api/payroll/structures
export const getSalaryStructures = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filterParts = [await getPayrollScope(req.user)];

    for (const field of ["employee", "domain", "department"]) {
      if (req.query[field]) {
        if (!mongoose.isValidObjectId(req.query[field])) {
          return sendError(res, 400, `Invalid ${field} ID.`);
        }
        filterParts.push({ [field]: req.query[field] });
      }
    }
    if (req.query.isActive !== undefined) {
      filterParts.push({ isActive: req.query.isActive === "true" });
    }

    const filter = { $and: filterParts };
    const [salaryStructures, total] = await Promise.all([
      populateSalary(SalaryStructure.find(filter))
        .sort({ effectiveFrom: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      SalaryStructure.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        salaryStructures,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/payroll/employees/:employeeId/salary
export const getEmployeeSalaryHistory = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    if (!mongoose.isValidObjectId(employeeId)) {
      return sendError(res, 400, "Invalid employee ID.");
    }

    const employeeScope = await getEmployeeScope(req.user);
    const employee = await Employee.findOne({
      $and: [{ _id: employeeId }, employeeScope],
    }).select("employeeCode fullName designation domain department");

    if (!employee) {
      return sendError(
        res,
        404,
        "Employee not found or outside your access scope.",
      );
    }

    const salaryHistory = await populateSalary(
      SalaryStructure.find({ employee: employeeId }),
    ).sort({ effectiveFrom: -1 });

    return res.status(200).json({
      success: true,
      data: {
        employee,
        currentSalary: salaryHistory.find((item) => item.isActive) || null,
        salaryHistory,
      },
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/payroll/structures/:id
// Creates a new version and retains the previous version as history.
export const updateSalaryStructure = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return sendError(res, 400, "Invalid salary structure ID.");
    }

    const allowedFields = [
      "salaryMode",
      "earnings",
      "grossMonthly",
      "deductions",
      "effectiveFrom",
      "remarks",
    ];
    const fields = Object.keys(req.body);
    if (
      !fields.length ||
      fields.some((field) => !allowedFields.includes(field))
    ) {
      return sendError(res, 400, "Invalid or empty salary update.");
    }

    const current = await SalaryStructure.findOne({
      $and: [{ _id: id, isActive: true }, await getPayrollScope(req.user)],
    });
    if (!current) {
      return sendError(
        res,
        404,
        "Active salary structure not found or outside your access scope.",
      );
    }

    const nextMode = req.body.salaryMode || current.salaryMode;
    if (!["component", "gross"].includes(nextMode)) {
      return sendError(res, 400, "Salary mode must be component or gross.");
    }

    const nextEffectiveFrom = req.body.effectiveFrom
      ? new Date(req.body.effectiveFrom)
      : new Date();

    if (Number.isNaN(nextEffectiveFrom.getTime())) {
      return sendError(res, 400, "A valid salary effective date is required.");
    }
    if (nextEffectiveFrom <= current.effectiveFrom) {
      return sendError(
        res,
        400,
        "New salary effective date must be later than the current salary start date.",
      );
    }

    const newData = {
      employee: current.employee,
      domain: current.domain,
      department: current.department,
      salaryMode: nextMode,
      currency: "INR",
      payFrequency: "monthly",
      earnings:
        nextMode === "component" ? (req.body.earnings ?? current.earnings) : {},
      grossMonthly:
        nextMode === "gross"
          ? (req.body.grossMonthly ?? current.grossMonthly)
          : 0,
      deductions: req.body.deductions ?? current.deductions,
      effectiveFrom: nextEffectiveFrom,
      remarks: req.body.remarks ?? current.remarks,
      createdBy: req.user._id,
    };

    await session.withTransaction(async () => {
      const previousEffectiveTo = new Date(nextEffectiveFrom);
      previousEffectiveTo.setDate(previousEffectiveTo.getDate() - 1);
      previousEffectiveTo.setHours(23, 59, 59, 999);

      const result = await SalaryStructure.updateOne(
        { _id: current._id, isActive: true },
        {
          $set: {
            isActive: false,
            effectiveTo: previousEffectiveTo,
            updatedBy: req.user._id,
          },
        },
        { session },
      );
      if (result.modifiedCount !== 1) {
        throw new Error(
          "Salary structure changed during this request. Refresh and retry.",
        );
      }
      await SalaryStructure.create([newData], { session });
    });

    const latest = await populateSalary(
      SalaryStructure.findOne({ employee: current.employee, isActive: true }),
    );
    return res.status(200).json({
      success: true,
      message:
        "Salary updated successfully. Previous salary has been retained in history.",
      data: { salaryStructure: latest },
    });
  } catch (error) {
    if (error.code === 11000) {
      return sendError(
        res,
        409,
        "An active salary structure already exists for this employee.",
      );
    }
    if (error.name === "ValidationError")
      return sendError(res, 400, error.message);
    next(error);
  } finally {
    await session.endSession();
  }
};
