import mongoose from "mongoose";

import Leave from "../models/leave.model.js";
import LeaveBalance from "../models/leaveBalance.model.js";
import LeavePolicy from "../models/leavePolicy.model.js";
import Employee from "../models/employee.model.js";
import Domain from "../models/domain.model.js";
import Department from "../models/department.model.js";
import User from "../models/user.model.js";
import {
  createBulkNotifications,
  createNotification,
} from "../services/notification.service.js";
const LEAVE_TYPES = ["casual", "sick", "earned", "unpaid"];
const LEAVE_STATUSES = ["pending", "approved", "rejected", "cancelled"];
const MAX_PAGE_SIZE = 100;

const sendError = (res, statusCode, message) =>
  res.status(statusCode).json({
    success: false,
    message,
  });

const sendSuccess = (res, message, data = {}, statusCode = 200) =>
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });

const hasPermission = (user, permission) => {
  const permissions = user?.role?.permissions || [];
  return permissions.includes("*") || permissions.includes(permission);
};

const getCompanyDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const parseDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }

  return date;
};

const dateKey = (date) => new Date(date).toISOString().slice(0, 10);

const getYearFromDate = (date) => Number(dateKey(date).slice(0, 4));

const addDays = (date, days) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

const getPagination = (query) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.parseInt(query.limit, 10) || 20),
  );

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

const getEmployeeForUser = async (userId) =>
  Employee.findOne({
    user: userId,
    employmentStatus: { $in: ["active", "on_leave"] },
  }).select("_id domain department user employmentStatus");

const notifyLeaveManagers = async ({
  employee,
  actorId,
  leaveId,
  title,
  message,
}) => {
  try {
    const [department, domain] = await Promise.all([
      Department.findById(employee.department).select("manager"),
      Domain.findById(employee.domain).select("head"),
    ]);

    const managerIds = [department?.manager, domain?.head].filter(Boolean);

    // Find active manager accounts.
    const managers = managerIds.length
      ? await Employee.find({
          _id: { $in: managerIds },
          employmentStatus: "active",
          user: { $exists: true, $ne: null },
        }).select("user")
      : [];

    const managerUserIds = managers
      .map((manager) => manager.user?.toString())
      .filter(Boolean);

    // Find active Super Admin accounts independently of managers.
    const superAdmins = await User.find({
      accountStatus: "active",
      isDeleted: false,
    })
      .populate({
        path: "role",
        match: { slug: "super-admin" },
        select: "slug",
      })
      .select("_id role");

    const superAdminUserIds = superAdmins
      .filter((user) => user.role)
      .map((user) => user._id.toString());

    // Combine manager and Super Admin recipients.
    const actorUserId = actorId.toString();

    const recipientIds = [
      ...new Set([...managerUserIds, ...superAdminUserIds]),
    ].filter((id) => id !== actorUserId);

    if (!recipientIds.length) return;

    await createBulkNotifications(recipientIds, {
      actor: actorId,
      category: "leave",
      priority: "medium",
      title,
      message,
      actionUrl: "/leaves",
      relatedEntity: {
        type: "Leave",
        id: leaveId,
      },
    });
  } catch (notificationError) {
    console.error(
      "[Leave Notification] Manager notification failed:",
      notificationError.message,
    );
  }
};

const getLeaveScope = async (user) => {
  const scope = user?.role?.scope || "self";

  if (scope === "global") {
    return {
      filter: {},
      ownEmployee: null,
      isGlobal: true,
    };
  }

  const ownEmployee = await getEmployeeForUser(user._id);

  if (!ownEmployee) {
    return {
      filter: { employee: new mongoose.Types.ObjectId() },
      ownEmployee: null,
      isGlobal: false,
    };
  }

  if (scope === "self") {
    return {
      filter: { employee: ownEmployee._id },
      ownEmployee,
      isGlobal: false,
    };
  }

  const [headedDomains, managedDepartments] = await Promise.all([
    Domain.find({ head: ownEmployee._id }).distinct("_id"),
    Department.find({ manager: ownEmployee._id }).distinct("_id"),
  ]);

  const accessConditions = [{ employee: ownEmployee._id }];

  if (headedDomains.length) {
    accessConditions.push({ domain: { $in: headedDomains } });
  }

  if (managedDepartments.length) {
    accessConditions.push({ department: { $in: managedDepartments } });
  }

  return {
    filter: { $or: accessConditions },
    ownEmployee,
    isGlobal: false,
  };
};

const canAccessLeave = async (user, leave) => {
  const { filter } = await getLeaveScope(user);

  return Boolean(
    await Leave.exists({
      _id: leave._id,
      ...filter,
    }),
  );
};

const canManageDomain = async (user, domainId) => {
  if (user?.role?.scope === "global") return true;

  const employee = await getEmployeeForUser(user._id);
  if (!employee) return false;

  if (String(employee.domain) === String(domainId)) {
    const domain = await Domain.findOne({
      _id: domainId,
      head: employee._id,
    }).select("_id");

    if (domain) return true;
  }

  const department = await Department.findOne({
    domain: domainId,
    manager: employee._id,
  }).select("_id");

  return Boolean(department);
};

// Only global administrators, domain heads, and department managers may
// adjust another employee's leave balance. Self-adjustment is not allowed.
const canManageBalance = async (user, balance) => {
  if (user?.role?.scope === "global") return true;
  if (user?.role?.scope !== "assigned") return false;

  const employee = await getEmployeeForUser(user?._id);
  if (!employee) return false;
  if (String(balance.employee) === String(employee._id)) return false;

  const [isDomainHead, isDepartmentManager] = await Promise.all([
    Domain.exists({ _id: balance.domain, head: employee._id }),
    Department.exists({
      _id: balance.department,
      domain: balance.domain,
      manager: employee._id,
    }),
  ]);
  return Boolean(isDomainHead || isDepartmentManager);
};

const roundBalance = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const getPolicy = async (domainId, year, session = null) => {
  let query = LeavePolicy.findOne({
    domain: domainId,
    year,
    isActive: true,
  });

  if (session) query = query.session(session);

  return query;
};

const getEntitlement = (policy, leaveType) => {
  const value = policy?.leaveEntitlements?.[leaveType];
  return Number.isFinite(Number(value)) ? Number(value) : 0;
};

const calculateWorkingDays = (startDate, endDate, policy) => {
  const workingDays = policy.workingDays || [1, 2, 3, 4, 5, 6];

  const holidays = new Set(
    (policy.holidays || [])
      .filter((holiday) => holiday.isActive !== false)
      .map((holiday) => dateKey(holiday.date)),
  );

  let total = 0;

  for (
    let current = new Date(startDate);
    current <= endDate;
    current = addDays(current, 1)
  ) {
    const weekday = current.getUTCDay();
    const currentKey = dateKey(current);

    if (workingDays.includes(weekday) && !holidays.has(currentKey)) {
      total += 1;
    }
  }

  return total;
};

const validateLeaveDates = (startDate, endDate) => {
  if (!startDate || !endDate) {
    return "Valid startDate and endDate are required in YYYY-MM-DD format.";
  }

  if (endDate < startDate) {
    return "End date cannot be earlier than start date.";
  }

  if (getYearFromDate(startDate) !== getYearFromDate(endDate)) {
    return "A leave application cannot cross calendar years. Please submit separate applications.";
  }

  return null;
};

const initializeLeaveBalance = async ({
  employee,
  leaveType,
  year,
  policy,
  userId,
  session = null,
}) => {
  const options = {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  };

  if (session) options.session = session;

  return LeaveBalance.findOneAndUpdate(
    {
      employee: employee._id,
      leaveType,
      year,
    },
    {
      $setOnInsert: {
        employee: employee._id,
        domain: employee.domain,
        department: employee.department,
        leaveType,
        year,
        annualEntitlement: getEntitlement(policy, leaveType),
        carriedForward: 0,
        used: 0,
        adjustment: 0,
        isActive: true,
        createdBy: userId,
      },
      $set: {
        updatedBy: userId,
      },
    },
    options,
  );
};

const populateLeave = (query) =>
  query
    .populate("employee", "employeeCode fullName designation")
    .populate("domain", "name code")
    .populate("department", "name code")
    .populate("approvedBy", "fullName email")
    .populate("rejectedBy", "fullName email")
    .populate("cancelledBy", "fullName email")
    .populate("createdBy", "fullName email");

const getLeaveFilters = (query) => {
  const filters = {};

  if (query.status && LEAVE_STATUSES.includes(query.status)) {
    filters.status = query.status;
  }

  if (query.leaveType && LEAVE_TYPES.includes(query.leaveType)) {
    filters.leaveType = query.leaveType;
  }

  if (query.employee && mongoose.isValidObjectId(query.employee)) {
    filters.employee = query.employee;
  }

  if (query.domain && mongoose.isValidObjectId(query.domain)) {
    filters.domain = query.domain;
  }

  if (query.department && mongoose.isValidObjectId(query.department)) {
    filters.department = query.department;
  }

  if (query.from) {
    const from = parseDate(query.from);
    if (from) filters.startDate = { $gte: from };
  }

  if (query.to) {
    const to = parseDate(query.to);
    if (to) {
      filters.endDate = {
        ...(filters.endDate || {}),
        $lte: to,
      };
    }
  }

  return filters;
};

/* -------------------------------------------------------------------------- */
/* APPLY FOR LEAVE                                                            */
/* POST /api/leaves                                                           */
/* -------------------------------------------------------------------------- */

export const applyLeave = async (req, res) => {
  try {
    const employee = await getEmployeeForUser(req.user._id);

    if (!employee) {
      return sendError(
        res,
        403,
        "No active employee profile is linked to your account.",
      );
    }

    const {
      leaveType,
      startDate: startDateInput,
      endDate: endDateInput,
      isHalfDay = false,
      halfDayPeriod = null,
      reason,
    } = req.body;

    if (!LEAVE_TYPES.includes(leaveType)) {
      return sendError(res, 400, "Please select a valid leave type.");
    }

    const startDate = parseDate(startDateInput);
    const endDate = parseDate(endDateInput);
    const dateError = validateLeaveDates(startDate, endDate);

    if (dateError) return sendError(res, 400, dateError);

    if (typeof reason !== "string" || reason.trim().length < 5) {
      return sendError(
        res,
        400,
        "Please provide a reason of at least 5 characters.",
      );
    }

    if (reason.trim().length > 1000) {
      return sendError(res, 400, "Leave reason cannot exceed 1000 characters.");
    }

    if (isHalfDay && dateKey(startDate) !== dateKey(endDate)) {
      return sendError(res, 400, "Half-day leave must be for a single date.");
    }

    if (isHalfDay && !["first_half", "second_half"].includes(halfDayPeriod)) {
      return sendError(
        res,
        400,
        "Select first_half or second_half for a half-day leave.",
      );
    }

    if (!isHalfDay && halfDayPeriod) {
      return sendError(
        res,
        400,
        "Half-day period is only valid for half-day leave.",
      );
    }

    const year = getYearFromDate(startDate);
    const policy = await getPolicy(employee.domain, year);

    if (!policy) {
      return sendError(
        res,
        400,
        `No active leave policy is configured for your domain for ${year}. Please contact HR.`,
      );
    }

    if (isHalfDay && !policy.allowHalfDayLeave) {
      return sendError(
        res,
        400,
        "Half-day leave is not allowed by the current policy.",
      );
    }

    if (leaveType === "unpaid" && !policy.allowUnpaidLeave) {
      return sendError(
        res,
        400,
        "Unpaid leave is not allowed by the current policy.",
      );
    }

    const workingDays = calculateWorkingDays(startDate, endDate, policy);
    const requestedDays = isHalfDay ? 0.5 : workingDays;

    if (requestedDays <= 0) {
      return sendError(
        res,
        400,
        "The selected date range contains no working days under the current leave policy.",
      );
    }

    const overlappingLeave = await Leave.findOne({
      employee: employee._id,
      status: { $in: ["pending", "approved"] },
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
    }).select("_id status startDate endDate");

    if (overlappingLeave) {
      return sendError(
        res,
        409,
        "You already have a pending or approved leave application overlapping these dates.",
      );
    }

    if (leaveType !== "unpaid") {
      await initializeLeaveBalance({
        employee,
        leaveType,
        year,
        policy,
        userId: req.user._id,
      });
    }

    const leave = await Leave.create({
      employee: employee._id,
      domain: employee.domain,
      department: employee.department,
      leaveType,
      startDate,
      endDate,
      requestedDays,
      isHalfDay,
      halfDayPeriod: isHalfDay ? halfDayPeriod : null,
      reason: reason.trim(),
      status: "pending",
      appliedAt: new Date(),
      approvalHistory: [
        {
          action: "submitted",
          actionBy: req.user._id,
          remarks: reason.trim(),
          newStatus: "pending",
        },
      ],
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    await notifyLeaveManagers({
      employee,
      actorId: req.user._id,
      leaveId: leave._id,
      title: "New Leave Application",
      message: `${employee.fullName} has submitted a ${leaveType} leave request from ${startDateInput} to ${endDateInput}.`,
    });

    const populatedLeave = await populateLeave(Leave.findById(leave._id));

    return sendSuccess(
      res,
      "Leave application submitted successfully.",
      { leave: populatedLeave },
      201,
    );
  } catch (error) {
    console.error("Apply leave error:", error);
    return sendError(res, 500, "Unable to submit leave application.");
  }
};

/* -------------------------------------------------------------------------- */
/* MY LEAVE HISTORY                                                           */
/* GET /api/leaves/me                                                         */
/* -------------------------------------------------------------------------- */

export const getMyLeaves = async (req, res) => {
  try {
    const employee = await getEmployeeForUser(req.user._id);

    if (!employee) {
      return sendError(
        res,
        403,
        "No employee profile is linked to your account.",
      );
    }

    const { page, limit, skip } = getPagination(req.query);
    const filters = getLeaveFilters(req.query);

    const query = {
      ...filters,
      employee: employee._id,
    };

    const [leaves, total] = await Promise.all([
      populateLeave(
        Leave.find(query).sort({ appliedAt: -1 }).skip(skip).limit(limit),
      ),
      Leave.countDocuments(query),
    ]);

    return sendSuccess(res, "Leave history retrieved successfully.", {
      leaves,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get my leaves error:", error);
    return sendError(res, 500, "Unable to retrieve your leave history.");
  }
};

/* -------------------------------------------------------------------------- */
/* ALL ACCESSIBLE LEAVE REQUESTS                                              */
/* GET /api/leaves                                                            */
/* -------------------------------------------------------------------------- */

export const getLeaves = async (req, res) => {
  try {
    const { filter: scopeFilter } = await getLeaveScope(req.user);
    const { page, limit, skip } = getPagination(req.query);
    const filters = getLeaveFilters(req.query);
    const query = { $and: [scopeFilter, filters] };

    const [leaves, total] = await Promise.all([
      populateLeave(
        Leave.find(query).sort({ appliedAt: -1 }).skip(skip).limit(limit),
      ),
      Leave.countDocuments(query),
    ]);

    return sendSuccess(res, "Leave requests retrieved successfully.", {
      leaves,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get leaves error:", error);
    return sendError(res, 500, "Unable to retrieve leave requests.");
  }
};

/* -------------------------------------------------------------------------- */
/* APPROVE LEAVE                                                              */
/* PATCH /api/leaves/:id/approve                                              */
/* -------------------------------------------------------------------------- */

export const approveLeave = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let approvedLeave = null;

    await session.withTransaction(async () => {
      const leave = await Leave.findById(req.params.id).session(session);

      if (!leave) {
        const error = new Error("Leave application not found.");
        error.statusCode = 404;
        throw error;
      }

      if (!(await canAccessLeave(req.user, leave))) {
        const error = new Error(
          "You do not have access to this leave application.",
        );
        error.statusCode = 403;
        throw error;
      }

      if (
        String(leave.employee) ===
        String((await getEmployeeForUser(req.user._id))?._id)
      ) {
        const error = new Error(
          "You cannot approve your own leave application.",
        );
        error.statusCode = 403;
        throw error;
      }

      if (leave.status !== "pending") {
        const error = new Error(
          "Only pending leave applications can be approved.",
        );
        error.statusCode = 400;
        throw error;
      }

      const remarks =
        typeof req.body.remarks === "string" ? req.body.remarks.trim() : "";

      if (leave.leaveType !== "unpaid") {
        const year = getYearFromDate(leave.startDate);
        const employee = await Employee.findById(leave.employee).session(
          session,
        );

        if (!employee) {
          const error = new Error(
            "Employee record for this leave was not found.",
          );
          error.statusCode = 404;
          throw error;
        }

        const policy = await getPolicy(employee.domain, year, session);

        if (!policy) {
          const error = new Error(
            "No active leave policy exists for this employee's domain.",
          );
          error.statusCode = 400;
          throw error;
        }

        await initializeLeaveBalance({
          employee,
          leaveType: leave.leaveType,
          year,
          policy,
          userId: req.user._id,
          session,
        });

        const balance = await LeaveBalance.findOneAndUpdate(
          {
            employee: employee._id,
            leaveType: leave.leaveType,
            year,
            isActive: true,
            $expr: {
              $lte: [
                { $add: ["$used", leave.requestedDays] },
                {
                  $add: [
                    "$annualEntitlement",
                    "$carriedForward",
                    "$adjustment",
                  ],
                },
              ],
            },
          },
          {
            $inc: { used: leave.requestedDays },
            $set: { updatedBy: req.user._id },
          },
          { new: true, session },
        );

        if (!balance) {
          const error = new Error(
            "Insufficient leave balance to approve this application.",
          );
          error.statusCode = 400;
          throw error;
        }
      }

      approvedLeave = await Leave.findOneAndUpdate(
        {
          _id: leave._id,
          status: "pending",
        },
        {
          $set: {
            status: "approved",
            approvedBy: req.user._id,
            approvedAt: new Date(),
            updatedBy: req.user._id,
          },
          $push: {
            approvalHistory: {
              action: "approved",
              actionBy: req.user._id,
              remarks,
              previousStatus: "pending",
              newStatus: "approved",
            },
          },
        },
        { new: true, session },
      );

      if (!approvedLeave) {
        const error = new Error(
          "This leave application has already been updated.",
        );
        error.statusCode = 409;
        throw error;
      }
    });

    try {
      const employee = await Employee.findById(approvedLeave.employee).select(
        "user",
      );

      if (employee?.user) {
        const activeUser = await User.findOne({
          _id: employee.user,
          accountStatus: "active",
          isDeleted: false,
        }).select("_id");

        if (activeUser) {
          await createNotification({
            recipient: activeUser._id,
            actor: req.user._id,
            category: "leave",
            priority: "medium",
            title: "Leave Application Approved",
            message: `Your ${approvedLeave.leaveType} leave application has been approved.`,
            actionUrl: "/leaves",
            relatedEntity: {
              type: "Leave",
              id: approvedLeave._id,
            },
          });
        }
      }
    } catch (notificationError) {
      console.error(
        "[Leave Notification] Approval notification failed:",
        notificationError.message,
      );
    }

    const populatedLeave = await populateLeave(
      Leave.findById(approvedLeave._id),
    );

    return sendSuccess(res, "Leave application approved successfully.", {
      leave: populatedLeave,
    });
  } catch (error) {
    console.error("Approve leave error:", error);
    return sendError(
      res,
      error.statusCode || 500,
      error.statusCode ? error.message : "Unable to approve leave application.",
    );
  } finally {
    await session.endSession();
  }
};

/* -------------------------------------------------------------------------- */
/* REJECT LEAVE                                                               */
/* PATCH /api/leaves/:id/reject                                               */
/* -------------------------------------------------------------------------- */

export const rejectLeave = async (req, res) => {
  try {
    const { reason } = req.body;

    if (typeof reason !== "string" || reason.trim().length < 3) {
      return sendError(res, 400, "Please provide a rejection reason.");
    }

    if (reason.trim().length > 1000) {
      return sendError(
        res,
        400,
        "Rejection reason cannot exceed 1000 characters.",
      );
    }

    const leave = await Leave.findById(req.params.id);

    if (!leave) {
      return sendError(res, 404, "Leave application not found.");
    }

    if (!(await canAccessLeave(req.user, leave))) {
      return sendError(
        res,
        403,
        "You do not have access to this leave application.",
      );
    }

    const ownEmployee = await getEmployeeForUser(req.user._id);

    if (ownEmployee && String(leave.employee) === String(ownEmployee._id)) {
      return sendError(
        res,
        403,
        "You cannot reject your own leave application.",
      );
    }

    if (leave.status !== "pending") {
      return sendError(
        res,
        400,
        "Only pending leave applications can be rejected.",
      );
    }

    const updatedLeave = await Leave.findOneAndUpdate(
      { _id: leave._id, status: "pending" },
      {
        $set: {
          status: "rejected",
          rejectedBy: req.user._id,
          rejectedAt: new Date(),
          rejectionReason: reason.trim(),
          updatedBy: req.user._id,
        },
        $push: {
          approvalHistory: {
            action: "rejected",
            actionBy: req.user._id,
            remarks: reason.trim(),
            previousStatus: "pending",
            newStatus: "rejected",
          },
        },
      },
      { new: true },
    );

    if (!updatedLeave) {
      return sendError(
        res,
        409,
        "This leave application has already been updated.",
      );
    }

    try {
      const employee = await Employee.findById(updatedLeave.employee).select(
        "user",
      );

      if (employee?.user) {
        const activeUser = await User.findOne({
          _id: employee.user,
          accountStatus: "active",
          isDeleted: false,
        }).select("_id");

        if (activeUser) {
          await createNotification({
            recipient: activeUser._id,
            actor: req.user._id,
            category: "leave",
            priority: "high",
            title: "Leave Application Rejected",
            message: `Your ${updatedLeave.leaveType} leave application was rejected. Reason: ${updatedLeave.rejectionReason}`,
            actionUrl: "/leaves",
            relatedEntity: {
              type: "Leave",
              id: updatedLeave._id,
            },
          });
        }
      }
    } catch (notificationError) {
      console.error(
        "[Leave Notification] Rejection notification failed:",
        notificationError.message,
      );
    }

    const populatedLeave = await populateLeave(
      Leave.findById(updatedLeave._id),
    );

    return sendSuccess(res, "Leave application rejected.", {
      leave: populatedLeave,
    });
  } catch (error) {
    console.error("Reject leave error:", error);
    return sendError(res, 500, "Unable to reject leave application.");
  }
};

/* -------------------------------------------------------------------------- */
/* CANCEL LEAVE                                                               */
/* PATCH /api/leaves/:id/cancel                                               */
/* -------------------------------------------------------------------------- */

export const cancelLeave = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let cancelledLeave = null;
    let isOwner = false;
    await session.withTransaction(async () => {
      const leave = await Leave.findById(req.params.id).session(session);

      if (!leave) {
        const error = new Error("Leave application not found.");
        error.statusCode = 404;
        throw error;
      }

      if (!(await canAccessLeave(req.user, leave))) {
        const error = new Error(
          "You do not have access to this leave application.",
        );
        error.statusCode = 403;
        throw error;
      }

      const ownEmployee = await getEmployeeForUser(req.user._id);
      isOwner =
        ownEmployee && String(leave.employee) === String(ownEmployee._id);
      const canManage = hasPermission(req.user, "leave.manage");

      if (!isOwner && !canManage) {
        const error = new Error(
          "You can only cancel your own leave application.",
        );
        error.statusCode = 403;
        throw error;
      }

      if (!["pending", "approved"].includes(leave.status)) {
        const error = new Error(
          "Only pending or approved leave can be cancelled.",
        );
        error.statusCode = 400;
        throw error;
      }

      const remarks =
        typeof req.body.reason === "string" ? req.body.reason.trim() : "";

      if (leave.status === "approved" && leave.leaveType !== "unpaid") {
        const year = getYearFromDate(leave.startDate);

        const balance = await LeaveBalance.findOneAndUpdate(
          {
            employee: leave.employee,
            leaveType: leave.leaveType,
            year,
            isActive: true,
            used: { $gte: leave.requestedDays },
          },
          {
            $inc: { used: -leave.requestedDays },
            $set: { updatedBy: req.user._id },
          },
          { new: true, session },
        );

        if (!balance) {
          const error = new Error(
            "Unable to restore the leave balance. Please contact HR.",
          );
          error.statusCode = 409;
          throw error;
        }
      }

      cancelledLeave = await Leave.findOneAndUpdate(
        {
          _id: leave._id,
          status: leave.status,
        },
        {
          $set: {
            status: "cancelled",
            cancelledBy: req.user._id,
            cancelledAt: new Date(),
            updatedBy: req.user._id,
          },
          $push: {
            approvalHistory: {
              action: "cancelled",
              actionBy: req.user._id,
              remarks,
              previousStatus: leave.status,
              newStatus: "cancelled",
            },
          },
        },
        { new: true, session },
      );

      if (!cancelledLeave) {
        const error = new Error(
          "This leave application has already been updated.",
        );
        error.statusCode = 409;
        throw error;
      }
    });

    try {
      if (isOwner) {
        const employee = await Employee.findById(
          cancelledLeave.employee,
        ).select("_id domain department");

        if (employee) {
          await notifyLeaveManagers({
            employee,
            actorId: req.user._id,
            leaveId: cancelledLeave._id,
            title: "Leave Application Cancelled",
            message: `An employee has cancelled their ${cancelledLeave.leaveType} leave application.`,
          });
        }
      } else {
        const employee = await Employee.findById(
          cancelledLeave.employee,
        ).select("user");

        if (employee?.user) {
          const activeUser = await User.findOne({
            _id: employee.user,
            accountStatus: "active",
            isDeleted: false,
          }).select("_id");

          if (activeUser) {
            await createNotification({
              recipient: activeUser._id,
              actor: req.user._id,
              category: "leave",
              priority: "medium",
              title: "Leave Application Cancelled",
              message: `Your ${cancelledLeave.leaveType} leave application has been cancelled by a manager.`,
              actionUrl: "/leaves",
              relatedEntity: {
                type: "Leave",
                id: cancelledLeave._id,
              },
            });
          }
        }
      }
    } catch (notificationError) {
      console.error(
        "[Leave Notification] Cancellation notification failed:",
        notificationError.message,
      );
    }

    const populatedLeave = await populateLeave(
      Leave.findById(cancelledLeave._id),
    );

    return sendSuccess(res, "Leave application cancelled successfully.", {
      leave: populatedLeave,
    });
  } catch (error) {
    console.error("Cancel leave error:", error);
    return sendError(
      res,
      error.statusCode || 500,
      error.statusCode ? error.message : "Unable to cancel leave application.",
    );
  } finally {
    await session.endSession();
  }
};

/* -------------------------------------------------------------------------- */
/* MY LEAVE BALANCES                                                          */
/* GET /api/leaves/balances/me                                                */
/* -------------------------------------------------------------------------- */

export const getMyLeaveBalances = async (req, res) => {
  try {
    const employee = await getEmployeeForUser(req.user._id);

    if (!employee) {
      return sendError(
        res,
        403,
        "No employee profile is linked to your account.",
      );
    }

    const year =
      Number.parseInt(req.query.year, 10) ||
      getYearFromDate(parseDate(getCompanyDate()));

    if (year < 2000 || year > 2100) {
      return sendError(res, 400, "Please provide a valid leave year.");
    }

    const policy = await getPolicy(employee.domain, year);

    if (!policy) {
      return sendError(
        res,
        404,
        `No active leave policy is configured for ${year}.`,
      );
    }

    const balances = await Promise.all(
      LEAVE_TYPES.filter((type) => type !== "unpaid").map((leaveType) =>
        initializeLeaveBalance({
          employee,
          leaveType,
          year,
          policy,
          userId: req.user._id,
        }),
      ),
    );

    return sendSuccess(res, "Leave balances retrieved successfully.", {
      year,
      balances,
      unpaidLeaveAllowed: policy.allowUnpaidLeave,
      halfDayLeaveAllowed: policy.allowHalfDayLeave,
    });
  } catch (error) {
    console.error("Get my leave balances error:", error);
    return sendError(res, 500, "Unable to retrieve leave balances.");
  }
};

/* -------------------------------------------------------------------------- */
/* ALL ACCESSIBLE LEAVE BALANCES                                              */
/* GET /api/leaves/balances                                                   */
/* -------------------------------------------------------------------------- */

export const getLeaveBalances = async (req, res) => {
  try {
    const { filter: scopeFilter } = await getLeaveScope(req.user);
    const year =
      Number.parseInt(req.query.year, 10) ||
      getYearFromDate(parseDate(getCompanyDate()));

    if (year < 2000 || year > 2100) {
      return sendError(res, 400, "Please provide a valid leave year.");
    }

    const filters = { $and: [scopeFilter, { year, isActive: true }] };

    if (req.query.leaveType && LEAVE_TYPES.includes(req.query.leaveType)) {
      filters.leaveType = req.query.leaveType;
    }

    if (req.query.employee && mongoose.isValidObjectId(req.query.employee)) {
      filters.employee = req.query.employee;
    }

    if (req.query.domain && mongoose.isValidObjectId(req.query.domain)) {
      filters.domain = req.query.domain;
    }

    if (
      req.query.department &&
      mongoose.isValidObjectId(req.query.department)
    ) {
      filters.department = req.query.department;
    }

    const { page, limit, skip } = getPagination(req.query);

    const [balances, total] = await Promise.all([
      LeaveBalance.find(filters)
        .populate("employee", "employeeCode fullName designation")
        .populate("domain", "name code")
        .populate("department", "name code")
        .sort({ "employee.fullName": 1, leaveType: 1 })
        .skip(skip)
        .limit(limit),
      LeaveBalance.countDocuments(filters),
    ]);

    return sendSuccess(res, "Leave balances retrieved successfully.", {
      year,
      balances,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get leave balances error:", error);
    return sendError(res, 500, "Unable to retrieve leave balances.");
  }
};

/* -------------------------------------------------------------------------- */
/* LIST LEAVE POLICIES                                                        */
/* GET /api/leaves/policies                                                   */
/* -------------------------------------------------------------------------- */

export const getLeavePolicies = async (req, res) => {
  try {
    const year = Number.parseInt(req.query.year, 10);
    const filters = {};

    if (Number.isInteger(year)) filters.year = year;

    if (req.query.domain && mongoose.isValidObjectId(req.query.domain)) {
      filters.domain = req.query.domain;
    }

    if (req.query.active !== "all") {
      filters.isActive = true;
    }

    if (req.user?.role?.scope !== "global") {
      const employee = await getEmployeeForUser(req.user._id);

      if (!employee) {
        return sendError(
          res,
          403,
          "No employee profile is linked to your account.",
        );
      }

      const [headedDomains, managedDepartments] = await Promise.all([
        Domain.find({ head: employee._id }).distinct("_id"),
        Department.find({ manager: employee._id }).distinct("domain"),
      ]);

      const domainIds = [
        employee.domain,
        ...headedDomains,
        ...managedDepartments,
      ];

      filters.domain = { $in: [...new Set(domainIds.map(String))] };

      if (
        req.query.domain &&
        !domainIds.some((id) => String(id) === req.query.domain)
      ) {
        return sendError(res, 403, "You cannot view policies for this domain.");
      }
    }

    const policies = await LeavePolicy.find(filters)
      .populate("domain", "name code")
      .populate("createdBy", "fullName email")
      .populate("updatedBy", "fullName email")
      .sort({ year: -1, createdAt: -1 });

    return sendSuccess(res, "Leave policies retrieved successfully.", {
      policies,
    });
  } catch (error) {
    console.error("Get leave policies error:", error);
    return sendError(res, 500, "Unable to retrieve leave policies.");
  }
};

/* -------------------------------------------------------------------------- */
/* CREATE LEAVE POLICY                                                        */
/* POST /api/leaves/policies                                                  */
/* -------------------------------------------------------------------------- */

export const createLeavePolicy = async (req, res) => {
  try {
    const {
      domain,
      year,
      leaveEntitlements,
      workingDays,
      holidays,
      allowUnpaidLeave,
      allowHalfDayLeave,
    } = req.body;

    if (!mongoose.isValidObjectId(domain)) {
      return sendError(res, 400, "A valid domain is required.");
    }

    const policyYear = Number(year);

    if (
      !Number.isInteger(policyYear) ||
      policyYear < 2000 ||
      policyYear > 2100
    ) {
      return sendError(res, 400, "Please provide a valid policy year.");
    }

    const domainExists = await Domain.findById(domain).select("_id");

    if (!domainExists) {
      return sendError(res, 404, "Domain not found.");
    }

    if (!(await canManageDomain(req.user, domain))) {
      return sendError(
        res,
        403,
        "You cannot manage the leave policy for this domain.",
      );
    }

    if (
      workingDays !== undefined &&
      (!Array.isArray(workingDays) ||
        workingDays.length === 0 ||
        workingDays.some(
          (day) => !Number.isInteger(day) || day < 0 || day > 6,
        ) ||
        new Set(workingDays).size !== workingDays.length)
    ) {
      return sendError(
        res,
        400,
        "workingDays must contain unique weekday numbers from 0 (Sunday) to 6 (Saturday).",
      );
    }

    if (leaveEntitlements !== undefined) {
      for (const type of LEAVE_TYPES) {
        if (
          leaveEntitlements[type] !== undefined &&
          (!Number.isFinite(Number(leaveEntitlements[type])) ||
            Number(leaveEntitlements[type]) < 0)
        ) {
          return sendError(
            res,
            400,
            `The ${type} entitlement must be a non-negative number.`,
          );
        }
      }
    }

    const policy = await LeavePolicy.create({
      domain,
      year: policyYear,
      leaveEntitlements: {
        casual: 12,
        sick: 12,
        earned: 15,
        unpaid: 0,
        ...(leaveEntitlements || {}),
      },
      workingDays: workingDays || [1, 2, 3, 4, 5, 6],
      holidays: holidays || [],
      allowUnpaidLeave: allowUnpaidLeave ?? true,
      allowHalfDayLeave: allowHalfDayLeave ?? true,
      isActive: true,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    const populatedPolicy = await LeavePolicy.findById(policy._id)
      .populate("domain", "name code")
      .populate("createdBy", "fullName email");

    return sendSuccess(
      res,
      "Leave policy created successfully.",
      { policy: populatedPolicy },
      201,
    );
  } catch (error) {
    console.error("Create leave policy error:", error);

    if (error.code === 11000) {
      return sendError(
        res,
        409,
        "A leave policy already exists for this domain and year.",
      );
    }

    if (error.name === "ValidationError") {
      return sendError(res, 400, error.message);
    }

    return sendError(res, 500, "Unable to create leave policy.");
  }
};

/* -------------------------------------------------------------------------- */
/* UPDATE LEAVE POLICY                                                        */
/* PATCH /api/leaves/policies/:id                                             */
/* -------------------------------------------------------------------------- */

export const updateLeavePolicy = async (req, res) => {
  try {
    const policy = await LeavePolicy.findById(req.params.id);

    if (!policy) {
      return sendError(res, 404, "Leave policy not found.");
    }

    if (!(await canManageDomain(req.user, policy.domain))) {
      return sendError(res, 403, "You cannot update this leave policy.");
    }

    const allowedFields = [
      "leaveEntitlements",
      "workingDays",
      "holidays",
      "allowUnpaidLeave",
      "allowHalfDayLeave",
      "isActive",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (updates.workingDays !== undefined) {
      const days = updates.workingDays;

      if (
        !Array.isArray(days) ||
        days.length === 0 ||
        days.some((day) => !Number.isInteger(day) || day < 0 || day > 6) ||
        new Set(days).size !== days.length
      ) {
        return sendError(
          res,
          400,
          "workingDays must contain unique weekday numbers from 0 (Sunday) to 6 (Saturday).",
        );
      }
    }

    if (updates.leaveEntitlements !== undefined) {
      for (const type of LEAVE_TYPES) {
        const value = updates.leaveEntitlements[type];

        if (
          value !== undefined &&
          (!Number.isFinite(Number(value)) || Number(value) < 0)
        ) {
          return sendError(
            res,
            400,
            `The ${type} entitlement must be a non-negative number.`,
          );
        }
      }
    }

    updates.updatedBy = req.user._id;

    const updatedPolicy = await LeavePolicy.findByIdAndUpdate(
      policy._id,
      { $set: updates },
      {
        new: true,
        runValidators: true,
      },
    )
      .populate("domain", "name code")
      .populate("createdBy", "fullName email")
      .populate("updatedBy", "fullName email");

    return sendSuccess(res, "Leave policy updated successfully.", {
      policy: updatedPolicy,
    });
  } catch (error) {
    console.error("Update leave policy error:", error);

    if (error.name === "ValidationError") {
      return sendError(res, 400, error.message);
    }

    return sendError(res, 500, "Unable to update leave policy.");
  }
};

/* -------------------------------------------------------------------------- */
/* ADJUST EMPLOYEE LEAVE BALANCE                                              */
/* POST /api/leaves/balances/:id/adjust                                       */
/* -------------------------------------------------------------------------- */

export const adjustLeaveBalance = async (req, res) => {
  const { id } = req.params;
  const { amount, reason } = req.body || {};

  if (!mongoose.isValidObjectId(id)) {
    return sendError(res, 400, "A valid leave balance ID is required.");
  }

  const adjustmentAmount = Number(amount);
  if (
    amount === undefined ||
    amount === null ||
    amount === "" ||
    !Number.isFinite(adjustmentAmount) ||
    adjustmentAmount === 0
  ) {
    return sendError(res, 400, "Adjustment amount must be a non-zero number.");
  }
  if (Math.abs(adjustmentAmount) > 365) {
    return sendError(res, 400, "Adjustment amount cannot exceed 365 days.");
  }
  if (roundBalance(adjustmentAmount * 2) % 1 !== 0) {
    return sendError(
      res,
      400,
      "Adjustment amount must use whole or half-day increments.",
    );
  }
  if (typeof reason !== "string" || reason.trim().length < 5) {
    return sendError(
      res,
      400,
      "Please provide an adjustment reason of at least 5 characters.",
    );
  }
  if (reason.trim().length > 500) {
    return sendError(
      res,
      400,
      "Adjustment reason cannot exceed 500 characters.",
    );
  }

  const session = await mongoose.startSession();
  try {
    let updatedBalanceId = null;
    await session.withTransaction(async () => {
      const balance = await LeaveBalance.findById(id).session(session);
      if (!balance || !balance.isActive) {
        const error = new Error("Active leave balance not found.");
        error.statusCode = 404;
        throw error;
      }
      if (balance.leaveType === "unpaid") {
        const error = new Error(
          "Unpaid leave does not have an adjustable leave balance.",
        );
        error.statusCode = 400;
        throw error;
      }
      if (!(await canManageBalance(req.user, balance))) {
        const error = new Error(
          "You do not have access to adjust this employee's leave balance.",
        );
        error.statusCode = 403;
        throw error;
      }

      const previousAdjustment = roundBalance(Number(balance.adjustment || 0));
      const previousTotalEntitlement = roundBalance(
        Number(balance.annualEntitlement || 0) +
          Number(balance.carriedForward || 0) +
          previousAdjustment,
      );
      const previousRemaining = roundBalance(
        previousTotalEntitlement - Number(balance.used || 0),
      );
      const newAdjustment = roundBalance(previousAdjustment + adjustmentAmount);
      const newTotalEntitlement = roundBalance(
        Number(balance.annualEntitlement || 0) +
          Number(balance.carriedForward || 0) +
          newAdjustment,
      );
      const newRemaining = roundBalance(
        newTotalEntitlement - Number(balance.used || 0),
      );

      if (newTotalEntitlement < Number(balance.used || 0)) {
        const error = new Error(
          "This adjustment would make the remaining leave balance negative.",
        );
        error.statusCode = 400;
        throw error;
      }
      if (!Array.isArray(balance.adjustmentHistory))
        balance.adjustmentHistory = [];
      balance.adjustment = newAdjustment;
      balance.updatedBy = req.user._id;
      balance.adjustmentHistory.push({
        amount: adjustmentAmount,
        previousAdjustment,
        newAdjustment,
        previousTotalEntitlement,
        newTotalEntitlement,
        previousRemaining,
        newRemaining,
        reason: reason.trim(),
        adjustedBy: req.user._id,
        adjustedAt: new Date(),
      });
      await balance.save({ session });
      updatedBalanceId = balance._id;
    });

    const updatedBalance = await LeaveBalance.findById(updatedBalanceId)
      .populate("employee", "employeeCode fullName designation")
      .populate("domain", "name code")
      .populate("department", "name code")
      .populate("adjustmentHistory.adjustedBy", "fullName email");
    return sendSuccess(
      res,
      "Leave balance adjusted successfully. The change has been recorded in the adjustment history.",
      { balance: updatedBalance },
    );
  } catch (error) {
    console.error("Adjust leave balance error:", error);
    return sendError(
      res,
      error.statusCode || 500,
      error.statusCode ? error.message : "Unable to adjust the leave balance.",
    );
  } finally {
    await session.endSession();
  }
};
