import mongoose from "mongoose";

import Payroll from "../models/payroll.model.js";
import Employee from "../models/employee.model.js";
import Domain from "../models/domain.model.js";
import Department from "../models/department.model.js";
import User from "../models/user.model.js";
import Role from "../models/role.model.js";
import {
  createNotification,
  createBulkNotifications,
} from "../services/notification.service.js";
import {
  recalculateDraftPayroll,
  generateMonthlyPayroll,
} from "../services/payrollCalculation.service.js";

// ----------------------------------------------------
// COMMON HELPERS
// ----------------------------------------------------

const sendError = (res, status, message) =>
  res.status(status).json({
    success: false,
    message,
  });

// notification service can be used to send notifications to users when payroll is generated, verified, approved, or paid. This can help keep employees informed about the status of their payroll and any actions they may need to take.
const notifyPayrollEmployee = async ({
  employeeId,
  actorId,
  payrollId,
  title,
  message,
  priority = "medium",
}) => {
  try {
    const employee = await Employee.findById(employeeId).select("user").lean();

    if (!employee?.user) return;

    // Do not notify the same user who performed the action.
    if (String(employee.user) === String(actorId)) return;

    const activeUser = await User.findOne({
      _id: employee.user,
      accountStatus: "active",
      isDeleted: false,
    }).select("_id");

    if (!activeUser) return;

    await createNotification({
      recipient: activeUser._id,
      actor: actorId,
      category: "payroll",
      priority,
      title,
      message,
      actionUrl: "/payroll",
      relatedEntity: {
        type: "Payroll",
        id: payrollId,
      },
    });
  } catch (notificationError) {
    console.error("[Payroll Notification] Failed:", notificationError.message);
  }
};
const notifyPayrollSuperAdmins = async ({
  actorId,
  payrollId,
  title,
  message,
  priority = "medium",
}) => {
  try {
    const superAdminRole = await Role.findOne({
      slug: "super-admin",
      isActive: true,
    }).select("_id");

    if (!superAdminRole) return;

    const superAdmins = await User.find({
      role: superAdminRole._id,
      accountStatus: "active",
      isDeleted: false,
    }).select("_id");

    if (!superAdmins.length) return;

    await createBulkNotifications(
      superAdmins.map((admin) => admin._id),
      {
        actor: actorId,
        category: "payroll",
        priority,
        title,
        message,
        actionUrl: "/payroll",
        relatedEntity: {
          type: "Payroll",
          id: payrollId,
        },
      },
    );
  } catch (notificationError) {
    console.error(
      "[Payroll Super Admin Notification] Failed:",
      notificationError.message,
    );
  }
};

const validMonthYear = (month, year) =>
  Number.isInteger(month) &&
  month >= 1 &&
  month <= 12 &&
  Number.isInteger(year) &&
  year >= 2000 &&
  year <= 2100;

const getIndiaDateKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
};

const getMonthEndKey = (year, month) => {
  const end = new Date(Date.UTC(year, month, 0));
  return end.toISOString().slice(0, 10);
};

// ----------------------------------------------------
// PAYROLL ACCESS SCOPE
// ----------------------------------------------------

const getPayrollScope = async (user) => {
  const scope = user.role?.scope || "self";

  if (scope === "global") {
    return {};
  }

  const employee = await Employee.findOne({
    user: user._id,
  }).select("_id");

  if (!employee) {
    return {
      employee: new mongoose.Types.ObjectId(),
    };
  }

  if (scope === "self") {
    return {
      employee: employee._id,
    };
  }

  const [domains, departments] = await Promise.all([
    Domain.find({
      head: employee._id,
    }).select("_id"),

    Department.find({
      manager: employee._id,
    }).select("_id"),
  ]);

  const conditions = [
    {
      employee: employee._id,
    },
  ];

  if (domains.length > 0) {
    conditions.push({
      domain: {
        $in: domains.map((item) => item._id),
      },
    });
  }

  if (departments.length > 0) {
    conditions.push({
      department: {
        $in: departments.map((item) => item._id),
      },
    });
  }

  return {
    $or: conditions,
  };
};

const employeeScopeFromPayrollScope = (scope) => {
  if (scope.$or) {
    return {
      $or: scope.$or.map((condition) => {
        if (condition.employee) {
          return {
            _id: condition.employee,
          };
        }

        return condition;
      }),
    };
  }

  if (scope.employee) {
    return {
      _id: scope.employee,
    };
  }

  return {};
};

// ----------------------------------------------------
// 1. GENERATE MONTHLY PAYROLL
// POST /api/payroll/generate
// ----------------------------------------------------

export const generatePayroll = async (req, res, next) => {
  try {
    const month = Number(req.body.payrollMonth);
    const year = Number(req.body.payrollYear);

    if (!validMonthYear(month, year)) {
      return sendError(
        res,
        400,
        "Provide a valid payrollMonth and payrollYear.",
      );
    }

    // Payroll can only be generated after the month ends in India.
    const today = getIndiaDateKey();
    const monthEnd = getMonthEndKey(year, month);

    if (monthEnd >= today) {
      return sendError(
        res,
        400,
        "Payroll can only be generated after the selected month has ended in India.",
      );
    }

    const scope = await getPayrollScope(req.user);

    const employeeFilter = {
      ...employeeScopeFromPayrollScope(scope),
      employmentStatus: {
        $in: ["active", "on_leave"],
      },
    };

    if (req.body.domain) {
      if (!mongoose.isValidObjectId(req.body.domain)) {
        return sendError(res, 400, "Invalid domain ID.");
      }

      employeeFilter.domain = req.body.domain;
    }

    if (req.body.department) {
      if (!mongoose.isValidObjectId(req.body.department)) {
        return sendError(res, 400, "Invalid department ID.");
      }

      employeeFilter.department = req.body.department;
    }

    const employees = await Employee.find(employeeFilter)
      .select("_id employeeCode fullName domain department employmentStatus")
      .lean();

    const result = await generateMonthlyPayroll({
      employees,
      year,
      month,
      actorId: req.user._id,
      actorType: "user",
      generationSource: "manual",
    });

    // Notify Super Admins when monthly payroll is generated.
    if (result.generated.length > 0) {
      await notifyPayrollSuperAdmins({
        actorId: req.user._id,
        payrollId: result.generated[0]._id,
        title: "Monthly Payroll Generated",
        message: `Payroll generated for ${month}/${year}. ${result.generated.length} employee payroll records created; ${result.skipped.length} skipped.`,
        priority: "high",
      });
    }
    return res.status(201).json({
      success: true,
      message: "Monthly payroll generation completed.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ----------------------------------------------------
// 2. GET PAYROLL RECORDS
// GET /api/payroll
// ----------------------------------------------------

export const getPayrolls = async (req, res, next) => {
  try {
    const scope = await getPayrollScope(req.user);

    // Keep authorization scope separate from user filters.
    const filters = {};

    if (req.query.payrollMonth !== undefined) {
      const month = Number(req.query.payrollMonth);

      if (!Number.isInteger(month) || month < 1 || month > 12) {
        return sendError(res, 400, "Invalid payroll month.");
      }

      filters.payrollMonth = month;
    }

    if (req.query.payrollYear !== undefined) {
      const year = Number(req.query.payrollYear);

      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        return sendError(res, 400, "Invalid payroll year.");
      }

      filters.payrollYear = year;
    }

    for (const field of ["employee", "domain", "department"]) {
      if (req.query[field]) {
        if (!mongoose.isValidObjectId(req.query[field])) {
          return sendError(res, 400, `Invalid ${field} ID.`);
        }

        filters[field] = req.query[field];
      }
    }

    if (req.query.status) {
      const statuses = ["draft", "verified", "approved", "paid"];

      if (!statuses.includes(req.query.status)) {
        return sendError(res, 400, "Invalid payroll status.");
      }

      filters.status = req.query.status;
    }

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);

    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 20),
    );

    const filter = {
      $and: [scope, filters],
    };

    const [payrolls, total] = await Promise.all([
      Payroll.find(filter)
        .populate("employee", "employeeCode fullName designation")
        .populate("domain", "name code")
        .populate("department", "name code")
        .populate("salaryStructure")
        .populate("verifiedBy", "fullName email")
        .populate("approvedBy", "fullName email")
        .populate("paidBy", "fullName email")
        .sort({
          payrollYear: -1,
          payrollMonth: -1,
          createdAt: -1,
        })
        .skip((page - 1) * limit)
        .limit(limit),

      Payroll.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: {
        payrolls,
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

// ----------------------------------------------------
// 3. GET SINGLE PAYROLL
// GET /api/payroll/:id
// ----------------------------------------------------

export const getPayrollById = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return sendError(res, 400, "Invalid payroll ID.");
    }

    const scope = await getPayrollScope(req.user);

    const payroll = await Payroll.findOne({
      $and: [
        {
          _id: req.params.id,
        },
        scope,
      ],
    })
      .populate("employee", "employeeCode fullName designation employmentType")
      .populate("domain", "name code")
      .populate("department", "name code")
      .populate("salaryStructure")
      .populate("verifiedBy", "fullName email")
      .populate("approvedBy", "fullName email")
      .populate("paidBy", "fullName email")
      .populate("history.actionBy", "fullName email");

    if (!payroll) {
      return sendError(res, 404, "Payroll record not found.");
    }

    return res.json({
      success: true,
      data: {
        payroll,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ----------------------------------------------------
// COMMON PAYROLL ACTION HELPER
// ----------------------------------------------------

const getPayrollForAction = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    sendError(res, 400, "Invalid payroll ID.");
    return null;
  }

  const scope = await getPayrollScope(req.user);

  const payroll = await Payroll.findOne({
    $and: [
      {
        _id: req.params.id,
      },
      scope,
    ],
  });

  if (!payroll) {
    sendError(res, 404, "Payroll record not found in your authorized scope.");

    return null;
  }

  return { payroll, scope };
};

// ----------------------------------------------------
// 4. VERIFY PAYROLL
// PATCH /api/payroll/:id/verify
// ----------------------------------------------------

export const verifyPayroll = async (req, res, next) => {
  try {
    const actionData = await getPayrollForAction(req, res);

    if (!actionData) return;

    const { payroll, scope } = actionData;

    if (payroll.status !== "draft") {
      return sendError(res, 409, "Only draft payroll can be verified.");
    }

    const remarks =
      typeof req.body.remarks === "string" ? req.body.remarks.trim() : "";

    if (remarks.length > 1000) {
      return sendError(res, 400, "Remarks cannot exceed 1000 characters.");
    }

    // Conditional update protects against concurrent verification.
    const updatedPayroll = await Payroll.findOneAndUpdate(
      {
        $and: [
          {
            _id: payroll._id,
            status: "draft",
          },
          scope,
        ],
      },
      {
        $set: {
          status: "verified",
          verifiedBy: req.user._id,
          verifiedAt: new Date(),
          verificationRemarks: remarks,
          updatedBy: req.user._id,
        },
        $push: {
          history: {
            action: "verified",
            actionBy: req.user._id,
            actorType: "user",
            remarks,
            previousStatus: "draft",
            newStatus: "verified",
            actionAt: new Date(),
          },
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!updatedPayroll) {
      return sendError(
        res,
        409,
        "Payroll status changed. Refresh and try again.",
      );
    }

    // Notify Super Admins about payroll verification.
    await notifyPayrollSuperAdmins({
      actorId: req.user._id,
      payrollId: updatedPayroll._id,
      title: "Payroll Verified",
      message: `Payroll for ${updatedPayroll.payrollMonth}/${updatedPayroll.payrollYear} has been verified.`,
      priority: "medium",
    });

    return res.json({
      success: true,
      message: "Payroll verified successfully.",
      data: {
        payroll: updatedPayroll,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ----------------------------------------------------
// 5. APPROVE PAYROLL
// PATCH /api/payroll/:id/approve
// ----------------------------------------------------

export const approvePayroll = async (req, res, next) => {
  try {
    const actionData = await getPayrollForAction(req, res);

    if (!actionData) return;

    const { payroll, scope } = actionData;

    if (payroll.status !== "verified") {
      return sendError(res, 409, "Only verified payroll can be approved.");
    }

    const remarks =
      typeof req.body.remarks === "string" ? req.body.remarks.trim() : "";

    if (remarks.length > 1000) {
      return sendError(res, 400, "Remarks cannot exceed 1000 characters.");
    }

    const updatedPayroll = await Payroll.findOneAndUpdate(
      {
        $and: [
          {
            _id: payroll._id,
            status: "verified",
          },
          scope,
        ],
      },
      {
        $set: {
          status: "approved",
          approvedBy: req.user._id,
          approvedAt: new Date(),
          approvalRemarks: remarks,
          updatedBy: req.user._id,
        },
        $push: {
          history: {
            action: "approved",
            actionBy: req.user._id,
            actorType: "user",
            remarks,
            previousStatus: "verified",
            newStatus: "approved",
            actionAt: new Date(),
          },
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!updatedPayroll) {
      return sendError(
        res,
        409,
        "Payroll status changed. Refresh and try again.",
      );
    }

    // Notify the employee about payroll approval.
    await notifyPayrollEmployee({
      employeeId: updatedPayroll.employee,
      actorId: req.user._id,
      payrollId: updatedPayroll._id,
      title: "Payroll Approved",
      message: `Your payroll for ${updatedPayroll.payrollMonth}/${updatedPayroll.payrollYear} has been approved.`,
      priority: "medium",
    });

    await notifyPayrollSuperAdmins({
      actorId: req.user._id,
      payrollId: updatedPayroll._id,
      title: "Payroll Approved",
      message: `Payroll for ${updatedPayroll.payrollMonth}/${updatedPayroll.payrollYear} has been approved.`,
      priority: "medium",
    });

    return res.json({
      success: true,
      message: "Payroll approved successfully.",
      data: {
        payroll: updatedPayroll,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ----------------------------------------------------
// 6. MARK PAYROLL AS PAID
// PATCH /api/payroll/:id/pay
// ----------------------------------------------------

export const markPayrollPaid = async (req, res, next) => {
  try {
    const actionData = await getPayrollForAction(req, res);

    if (!actionData) return;

    const { payroll, scope } = actionData;

    if (payroll.status !== "approved") {
      return sendError(
        res,
        409,
        "Only approved payroll can be marked as paid.",
      );
    }

    const allowedMethods = ["bank_transfer", "upi", "cash", "cheque", "other"];

    const paymentMethod = req.body.paymentMethod;

    const paymentReference =
      typeof req.body.paymentReference === "string"
        ? req.body.paymentReference.trim()
        : "";

    if (!allowedMethods.includes(paymentMethod)) {
      return sendError(res, 400, "Select a valid payment method.");
    }

    if (paymentReference.length > 150) {
      return sendError(
        res,
        400,
        "Payment reference cannot exceed 150 characters.",
      );
    }

    const updatedPayroll = await Payroll.findOneAndUpdate(
      {
        $and: [
          {
            _id: payroll._id,
            status: "approved",
          },
          scope,
        ],
      },
      {
        $set: {
          status: "paid",
          paidBy: req.user._id,
          paidAt: new Date(),
          paymentMethod,
          paymentReference,
          updatedBy: req.user._id,
        },
        $push: {
          history: {
            action: "paid",
            actionBy: req.user._id,
            actorType: "user",
            remarks: paymentReference
              ? `Payment reference: ${paymentReference}`
              : "",
            previousStatus: "approved",
            newStatus: "paid",
            actionAt: new Date(),
          },
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!updatedPayroll) {
      return sendError(
        res,
        409,
        "Payroll status changed. Refresh and try again.",
      );
    }

    // Notify the employee about payroll payment.
    await notifyPayrollEmployee({
      employeeId: updatedPayroll.employee,
      actorId: req.user._id,
      payrollId: updatedPayroll._id,
      title: "Salary Credited",
      message: `Your payroll for ${updatedPayroll.payrollMonth}/${updatedPayroll.payrollYear} has been marked as paid.`,
      priority: "high",
    });

    // Notify Super Admins about payroll payment.
    await notifyPayrollSuperAdmins({
      actorId: req.user._id,
      payrollId: updatedPayroll._id,
      title: "Salary Payment Processed",
      message: `Payroll for ${updatedPayroll.payrollMonth}/${updatedPayroll.payrollYear} has been marked as paid.`,
      priority: "high",
    });

    return res.json({
      success: true,
      message: "Payroll marked as paid successfully.",
      data: {
        payroll: updatedPayroll,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const recalculatePayroll = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return sendError(res, 400, "Invalid payroll ID.");
    }

    const scope = await getPayrollScope(req.user);

    const payroll = await Payroll.findOne({
      $and: [{ _id: req.params.id }, scope],
    }).select("_id status");

    if (!payroll) {
      return sendError(res, 404, "Payroll record not found.");
    }

    if (payroll.status !== "draft") {
      return sendError(res, 409, "Only draft payroll can be recalculated.");
    }

    const updatedPayroll = await recalculateDraftPayroll({
      payrollId: payroll._id,
      actorId: req.user._id,
      scopeFilter: scope,
    });

    return res.json({
      success: true,
      message: "Draft payroll recalculated successfully.",
      data: {
        payroll: updatedPayroll,
      },
    });
  } catch (error) {
    if (error.message?.includes("Only draft payroll")) {
      return sendError(res, 409, error.message);
    }

    next(error);
  }
};
