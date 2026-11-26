import mongoose from "mongoose";
import Attendance from "../models/attendance.model.js";
import Employee from "../models/employee.model.js";
import Domain from "../models/domain.model.js";
import Department from "../models/department.model.js";
import User from "../models/user.model.js";
import {
  createNotification,
  createBulkNotifications,
} from "../services/notification.service.js";
import Role from "../models/role.model.js";
const TIME_ZONE = "Asia/Kolkata";
const MAX_REMARKS_LENGTH = 500;

const getCompanyDate = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
};

const isValidDateKey = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
};

const getOwnEmployee = async (userId) => {
  return Employee.findOne({
    user: userId,
    employmentStatus: { $in: ["active", "on_leave"] },
  });
};

const getEmployeeOrRespond = async (req, res) => {
  const employee = await getOwnEmployee(req.user._id);

  if (!employee) {
    res.status(403).json({
      success: false,
      message: "No active employee profile is linked to your account.",
    });
    return null;
  }

  if (employee.employmentStatus !== "active") {
    res.status(403).json({
      success: false,
      message: "Only active employees can mark attendance.",
    });
    return null;
  }

  return employee;
};

// Global users can access all records.
// Self users can access only their own records.
// Assigned users can access their own records, their department,
// and domains/departments they officially manage.
const getAttendanceScope = async (user) => {
  const scope = user.role?.scope || "self";

  if (scope === "global") {
    return {};
  }

  const ownEmployee = await Employee.findOne({
    user: user._id,
  }).select("_id domain department");

  if (!ownEmployee) {
    return { employee: new mongoose.Types.ObjectId() };
  }

  if (scope === "self") {
    return { employee: ownEmployee._id };
  }

  const [headedDomains, managedDepartments] = await Promise.all([
    Domain.find({ head: ownEmployee._id }).select("_id"),
    Department.find({ manager: ownEmployee._id }).select("_id"),
  ]);

  const conditions = [{ employee: ownEmployee._id }];

  if (headedDomains.length) {
    conditions.push({
      domain: { $in: headedDomains.map((item) => item._id) },
    });
  }

  if (managedDepartments.length) {
    conditions.push({
      department: {
        $in: managedDepartments.map((item) => item._id),
      },
    });
  }

  return { $or: conditions };
};

const hasAccessToAttendance = async (user, attendance) => {
  const scope = await getAttendanceScope(user);

  return Attendance.exists({
    _id: attendance._id,
    ...scope,
  });
};

const getPagination = (query) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(query.limit, 10) || 20),
  );

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

const buildAttendanceFilters = (query) => {
  const filters = {};

  if (query.date) {
    if (!isValidDateKey(query.date)) {
      throw new Error("Invalid date. Use YYYY-MM-DD format.");
    }

    filters.attendanceDate = query.date;
  } else {
    if (query.from || query.to) {
      if (
        (query.from && !isValidDateKey(query.from)) ||
        (query.to && !isValidDateKey(query.to))
      ) {
        throw new Error("Invalid date range. Use YYYY-MM-DD format.");
      }

      if (query.from && query.to && query.from > query.to) {
        throw new Error("Start date cannot be after end date.");
      }

      filters.attendanceDate = {};

      if (query.from) filters.attendanceDate.$gte = query.from;
      if (query.to) filters.attendanceDate.$lte = query.to;
    }
  }

  if (query.employee) {
    if (!mongoose.isValidObjectId(query.employee)) {
      throw new Error("Invalid employee ID.");
    }

    filters.employee = query.employee;
  }

  if (query.domain) {
    if (!mongoose.isValidObjectId(query.domain)) {
      throw new Error("Invalid domain ID.");
    }

    filters.domain = query.domain;
  }

  if (query.department) {
    if (!mongoose.isValidObjectId(query.department)) {
      throw new Error("Invalid department ID.");
    }

    filters.department = query.department;
  }

  const allowedStatuses = [
    "present",
    "absent",
    "half_day",
    "leave",
    "holiday",
    "week_off",
  ];

  if (query.status) {
    if (!allowedStatuses.includes(query.status)) {
      throw new Error("Invalid attendance status.");
    }

    filters.status = query.status;
  }

  return filters;
};

const sendError = (res, status, message) => {
  return res.status(status).json({
    success: false,
    message,
  });
};

// Interpret administrator-entered times as India Standard Time (UTC+05:30).
const parseCompanyTime = (attendanceDate, time) => {
  if (time === null || time === undefined || time === "") return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return undefined;
  const parsed = new Date(`${attendanceDate}T${time}:00+05:30`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const getWorkedMinutes = (checkInAt, checkOutAt) => {
  if (!checkInAt || !checkOutAt) return 0;
  return Math.max(
    0,
    Math.round((checkOutAt.getTime() - checkInAt.getTime()) / 60000),
  );
};

const notifyAttendanceEmployee = async ({
  employeeId,
  actorId,
  title,
  message,
  priority = "medium",
  attendanceId,
}) => {
  try {
    const employee = await Employee.findOne({
      _id: employeeId,
      employmentStatus: { $in: ["active", "on_leave"] },
    }).select("user");

    if (!employee?.user || employee.user.toString() === actorId.toString()) {
      return;
    }

    const activeUser = await User.findOne({
      _id: employee.user,
      accountStatus: "active",
      isDeleted: false,
    }).select("_id");

    if (!activeUser) return;

    await createNotification({
      recipient: activeUser._id,
      actor: actorId,
      category: "attendance",
      priority,
      title,
      message,
      actionUrl: "/attendance",
      relatedEntity: {
        type: "Attendance",
        id: attendanceId,
      },
    });
  } catch (notificationError) {
    console.error(
      "[Attendance Notification] Delivery failed:",
      notificationError.message,
    );
  }
};

const notifyAttendanceSuperAdmins = async ({
  actorId,
  title,
  message,
  priority = "medium",
  attendanceId,
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
        category: "attendance",
        priority,
        title,
        message,
        actionUrl: "/attendance",
        relatedEntity: {
          type: "Attendance",
          id: attendanceId,
        },
      },
    );
  } catch (notificationError) {
    console.error(
      "[Attendance Super Admin Notification] Delivery failed:",
      notificationError.message,
    );
  }
};

const getAttendanceSnapshot = (attendance) => ({
  status: attendance.status,
  checkInAt: attendance.checkInAt,
  checkOutAt: attendance.checkOutAt,
  workedMinutes: attendance.workedMinutes,
  remarks: attendance.remarks,
});

// POST /api/attendance/check-in
export const checkIn = async (req, res, next) => {
  try {
    const employee = await getEmployeeOrRespond(req, res);
    if (!employee) return;

    const today = getCompanyDate();
    const now = new Date();

    const existing = await Attendance.findOne({
      employee: employee._id,
      attendanceDate: today,
    });

    if (existing) {
      return sendError(
        res,
        409,
        existing.checkInAt
          ? "You have already checked in today."
          : "An attendance record already exists for today. Contact HR.",
      );
    }

    const attendance = await Attendance.create({
      employee: employee._id,
      domain: employee.domain,
      department: employee.department,
      attendanceDate: today,
      status: "present",
      checkInAt: now,
      source: "self",
      markedBy: req.user._id,
    });

    await notifyAttendanceSuperAdmins({
      actorId: req.user._id,
      title: "Employee Checked In",
      message: `An employee checked in on ${today}.`,
      attendanceId: attendance._id,
    });

    return res.status(201).json({
      success: true,
      message: "Check-in recorded successfully.",
      data: { attendance },
    });
  } catch (error) {
    if (error.code === 11000) {
      return sendError(res, 409, "Attendance has already been recorded today.");
    }

    next(error);
  }
};

// PATCH /api/attendance/check-out
export const checkOut = async (req, res, next) => {
  try {
    const employee = await getEmployeeOrRespond(req, res);
    if (!employee) return;

    const today = getCompanyDate();

    const attendance = await Attendance.findOne({
      employee: employee._id,
      attendanceDate: today,
    });

    if (!attendance) {
      return sendError(
        res,
        404,
        "No check-in record found for today. Please check in first.",
      );
    }

    if (!attendance.checkInAt) {
      return sendError(
        res,
        400,
        "This attendance record does not contain a valid check-in.",
      );
    }

    if (attendance.checkOutAt) {
      return sendError(res, 409, "You have already checked out today.");
    }

    const now = new Date();

    if (now <= attendance.checkInAt) {
      return sendError(res, 400, "Check-out time must be after check-in time.");
    }

    attendance.checkOutAt = now;
    attendance.workedMinutes = Math.floor(
      (now.getTime() - attendance.checkInAt.getTime()) / 60000,
    );

    await attendance.save();
    await notifyAttendanceSuperAdmins({
      actorId: req.user._id,
      title: "Employee Checked Out",
      message: `An employee checked out on ${today}.`,
      attendanceId: attendance._id,
    });

    return res.json({
      success: true,
      message: "Check-out recorded successfully.",
      data: { attendance },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/attendance/me
export const getMyAttendance = async (req, res, next) => {
  try {
    const employee = await getOwnEmployee(req.user._id);

    if (!employee) {
      return sendError(
        res,
        403,
        "No employee profile is linked to your account.",
      );
    }

    const { page, limit, skip } = getPagination(req.query);
    const filters = buildAttendanceFilters(req.query);

    filters.employee = employee._id;

    const [records, total] = await Promise.all([
      Attendance.find(filters)
        .sort({ attendanceDate: -1 })
        .skip(skip)
        .limit(limit)
        .populate("domain", "name code")
        .populate("department", "name code")
        .lean(),

      Attendance.countDocuments(filters),
    ]);

    return res.json({
      success: true,
      data: {
        attendance: records,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    if (error.message.startsWith("Invalid")) {
      return sendError(res, 400, error.message);
    }

    next(error);
  }
};

// GET /api/attendance
export const getAttendance = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filters = buildAttendanceFilters(req.query);
    const scope = await getAttendanceScope(req.user);

    const mongoFilter = {
      $and: [{ deletedAt: null }, filters, scope],
    };

    const [records, total] = await Promise.all([
      Attendance.find(mongoFilter)
        .sort({ attendanceDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("employee", "employeeCode fullName designation")
        .populate("domain", "name code")
        .populate("department", "name code")
        .populate("markedBy", "fullName email")
        .populate("approvedBy", "fullName email")
        .lean(),

      Attendance.countDocuments(mongoFilter),
    ]);

    return res.json({
      success: true,
      data: {
        attendance: records,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    if (error.message.startsWith("Invalid")) {
      return sendError(res, 400, error.message);
    }

    next(error);
  }
};

// POST /api/attendance/manual
export const createManualAttendance = async (req, res, next) => {
  try {
    const {
      employee: employeeId,
      attendanceDate,
      status,
      remarks = "",
      checkInTime = "",
      checkOutTime = "",
    } = req.body;

    if (!mongoose.isValidObjectId(employeeId)) {
      return sendError(res, 400, "A valid employee ID is required.");
    }

    if (!isValidDateKey(attendanceDate)) {
      return sendError(res, 400, "Invalid attendance date.");
    }

    const allowedStatuses = [
      "present",
      "absent",
      "half_day",
      "holiday",
      "week_off",
    ];

    if (!allowedStatuses.includes(status)) {
      return sendError(res, 400, "Invalid manual attendance status.");
    }

    if (typeof remarks !== "string" || remarks.length > MAX_REMARKS_LENGTH) {
      return sendError(res, 400, "Remarks must be 500 characters or fewer.");
    }

    const checkInAt = parseCompanyTime(attendanceDate, checkInTime);
    const checkOutAt = parseCompanyTime(attendanceDate, checkOutTime);

    if (checkInAt === undefined || checkOutAt === undefined) {
      return sendError(
        res,
        400,
        "Enter valid check-in and check-out times in HH:mm format.",
      );
    }
    if (checkOutAt && !checkInAt) {
      return sendError(
        res,
        400,
        "Check-in time is required when check-out time is provided.",
      );
    }
    if (checkInAt && checkOutAt && checkOutAt <= checkInAt) {
      return sendError(
        res,
        400,
        "Check-out time must be later than check-in time.",
      );
    }
    if (
      ["absent", "holiday", "week_off"].includes(status) &&
      (checkInAt || checkOutAt)
    ) {
      return sendError(
        res,
        400,
        "Check-in/check-out times are not allowed for this attendance status.",
      );
    }

    const employee = await Employee.findOne({
      _id: employeeId,
      employmentStatus: "active",
    }).select("_id domain department");

    if (!employee) {
      return sendError(res, 404, "Active employee not found.");
    }

    const scope = await getAttendanceScope(req.user);

    let employeeScope = scope;

    if (scope.$or) {
      employeeScope = {
        $or: scope.$or.map((condition) => {
          if (condition.employee) {
            return { _id: condition.employee };
          }

          return condition;
        }),
      };
    } else if (scope.employee) {
      employeeScope = {
        _id: scope.employee,
      };
    }

    const employeeAccess = await Employee.exists({
      _id: employee._id,
      ...employeeScope,
    });

    if (!employeeAccess) {
      return sendError(
        res,
        403,
        "You are not authorized to manage this employee's attendance.",
      );
    }

    const attendance = await Attendance.create({
      employee: employee._id,
      domain: employee.domain,
      department: employee.department,
      attendanceDate,
      status,
      checkInAt,
      checkOutAt,
      workedMinutes: getWorkedMinutes(checkInAt, checkOutAt),
      remarks: remarks.trim(),
      source: "admin",
      markedBy: req.user._id,
      isApproved: true,
      approvedBy: req.user._id,
      approvedAt: new Date(),
    });

    await notifyAttendanceEmployee({
      employeeId: employee._id,
      actorId: req.user._id,
      title: "Attendance Recorded",
      message: `Your attendance for ${attendanceDate} has been recorded as ${status.replace("_", " ")}.`,
      attendanceId: attendance._id,
    });

    await notifyAttendanceSuperAdmins({
      actorId: req.user._id,
      title: "Manual Attendance Recorded",
      message: `Attendance for an employee on ${attendanceDate} was recorded as ${status.replace("_", " ")}.`,
      attendanceId: attendance._id,
    });

    return res.status(201).json({
      success: true,
      message: "Manual attendance recorded successfully.",
      data: { attendance },
    });
  } catch (error) {
    if (error.code === 11000) {
      return sendError(
        res,
        409,
        "Attendance already exists for this employee on this date.",
      );
    }

    next(error);
  }
};

// PATCH /api/attendance/:id
export const updateAttendance = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
      return sendError(res, 400, "Invalid attendance ID.");

    const attendance = await Attendance.findById(id);
    if (!attendance) return sendError(res, 404, "Attendance record not found.");

    const hasAccess = await hasAccessToAttendance(req.user, attendance);
    if (!hasAccess)
      return sendError(res, 403, "You cannot update this attendance record.");
    if (attendance.deletedAt)
      return sendError(res, 404, "Attendance record not found.");

    const allowedStatuses = [
      "present",
      "absent",
      "half_day",
      "holiday",
      "week_off",
    ];
    const fields = [
      "status",
      "remarks",
      "checkInTime",
      "checkOutTime",
      "reason",
    ];
    if (!fields.some((field) => Object.hasOwn(req.body, field))) {
      return sendError(res, 400, "No valid attendance fields provided.");
    }

    const nextStatus = Object.hasOwn(req.body, "status")
      ? req.body.status
      : attendance.status;
    if (!allowedStatuses.includes(nextStatus))
      return sendError(res, 400, "Invalid attendance status.");

    if (
      Object.hasOwn(req.body, "remarks") &&
      (typeof req.body.remarks !== "string" ||
        req.body.remarks.length > MAX_REMARKS_LENGTH)
    ) {
      return sendError(res, 400, "Remarks must be 500 characters or fewer.");
    }

    const reason = req.body.reason ?? "";
    if (attendance.isApproved && (!reason || !String(reason).trim())) {
      return sendError(
        res,
        400,
        "A correction reason is required for approved attendance.",
      );
    }
    if (typeof reason !== "string" || reason.length > MAX_REMARKS_LENGTH) {
      return sendError(
        res,
        400,
        "Correction reason must be 500 characters or fewer.",
      );
    }

    const hasTimeInput =
      Object.hasOwn(req.body, "checkInTime") ||
      Object.hasOwn(req.body, "checkOutTime");
    const nextCheckIn = Object.hasOwn(req.body, "checkInTime")
      ? parseCompanyTime(attendance.attendanceDate, req.body.checkInTime)
      : attendance.checkInAt;
    const nextCheckOut = Object.hasOwn(req.body, "checkOutTime")
      ? parseCompanyTime(attendance.attendanceDate, req.body.checkOutTime)
      : attendance.checkOutAt;

    if (nextCheckIn === undefined || nextCheckOut === undefined) {
      return sendError(
        res,
        400,
        "Enter valid check-in and check-out times in HH:mm format.",
      );
    }
    if (nextCheckOut && !nextCheckIn) {
      return sendError(
        res,
        400,
        "Check-in time is required when check-out time is provided.",
      );
    }
    if (nextCheckIn && nextCheckOut && nextCheckOut <= nextCheckIn) {
      return sendError(
        res,
        400,
        "Check-out time must be later than check-in time.",
      );
    }
    if (
      ["absent", "holiday", "week_off"].includes(nextStatus) &&
      (nextCheckIn || nextCheckOut)
    ) {
      return sendError(
        res,
        400,
        "Clear check-in and check-out times before using this status.",
      );
    }

    const snapshot = () => ({
      status: attendance.status,
      checkInAt: attendance.checkInAt,
      checkOutAt: attendance.checkOutAt,
      workedMinutes: attendance.workedMinutes,
      remarks: attendance.remarks,
    });
    const before = snapshot();

    attendance.status = nextStatus;
    if (Object.hasOwn(req.body, "remarks"))
      attendance.remarks = req.body.remarks.trim();
    if (hasTimeInput) {
      attendance.checkInAt = nextCheckIn;
      attendance.checkOutAt = nextCheckOut;
      attendance.workedMinutes = getWorkedMinutes(nextCheckIn, nextCheckOut);
    }

    attendance.corrections.push({
      changedBy: req.user._id,
      changedAt: new Date(),
      reason: reason.trim(),
      before,
      after: snapshot(),
    });
    attendance.source = "admin";
    attendance.markedBy = req.user._id;

    await attendance.save();

    await notifyAttendanceEmployee({
      employeeId: attendance.employee,
      actorId: req.user._id,
      title: "Attendance Updated",
      message: `Your attendance record for ${attendance.attendanceDate} has been corrected.`,
      priority: "high",
      attendanceId: attendance._id,
    });
    await notifyAttendanceSuperAdmins({
      actorId: req.user._id,
      title: "Attendance Record Updated",
      message: `An employee's attendance record for ${attendance.attendanceDate} was updated.`,
      priority: "high",
      attendanceId: attendance._id,
    });
    return res.json({
      success: true,
      message: "Attendance corrected successfully.",
      data: { attendance },
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/attendance/:id
// Soft-delete only: the record remains in MongoDB for audit/recovery.
export const deleteAttendance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const reason =
      typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

    if (!mongoose.isValidObjectId(id)) {
      return sendError(res, 400, "Invalid attendance ID.");
    }
    if (!reason || reason.length > MAX_REMARKS_LENGTH) {
      return sendError(
        res,
        400,
        "A deletion reason (maximum 500 characters) is required.",
      );
    }

    const attendance = await Attendance.findOne({ _id: id, deletedAt: null });
    if (!attendance) {
      return sendError(res, 404, "Attendance record not found.");
    }

    const hasAccess = await hasAccessToAttendance(req.user, attendance);
    if (!hasAccess) {
      return sendError(res, 403, "You cannot delete this attendance record.");
    }

    attendance.deletedAt = new Date();
    attendance.deletedBy = req.user._id;
    attendance.deletionReason = reason;
    await attendance.save();

    return res.json({
      success: true,
      message: "Attendance record moved to deleted records successfully.",
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/attendance/:id/approve
export const approveAttendance = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return sendError(res, 400, "Invalid attendance ID.");
    }

    const attendance = await Attendance.findById(id);

    if (!attendance) {
      return sendError(res, 404, "Attendance record not found.");
    }

    const hasAccess = await hasAccessToAttendance(req.user, attendance);

    if (!hasAccess) {
      return sendError(res, 403, "You cannot approve this attendance record.");
    }

    if (attendance.isApproved) {
      return sendError(res, 409, "Attendance is already approved.");
    }

    attendance.isApproved = true;
    attendance.approvedBy = req.user._id;
    attendance.approvedAt = new Date();

    await attendance.save();

    await notifyAttendanceEmployee({
      employeeId: attendance.employee,
      actorId: req.user._id,
      title: "Attendance Approved",
      message: `Your attendance for ${attendance.attendanceDate} has been approved.`,
      attendanceId: attendance._id,
    });

    await notifyAttendanceSuperAdmins({
      actorId: req.user._id,
      title: "Attendance Approved",
      message: `Attendance for an employee on ${attendance.attendanceDate} has been approved.`,
      attendanceId: attendance._id,
    });
    return res.json({
      success: true,
      message: "Attendance approved successfully.",
      data: { attendance },
    });
  } catch (error) {
    next(error);
  }
};
