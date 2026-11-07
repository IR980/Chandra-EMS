import mongoose from "mongoose";
import Attendance from "../models/attendance.model.js";
import Employee from "../models/employee.model.js";
import Domain from "../models/domain.model.js";
import Department from "../models/department.model.js";

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
      $and: [filters, scope],
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
      remarks: remarks.trim(),
      source: "admin",
      markedBy: req.user._id,
      isApproved: true,
      approvedBy: req.user._id,
      approvedAt: new Date(),
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

    if (!mongoose.isValidObjectId(id)) {
      return sendError(res, 400, "Invalid attendance ID.");
    }

    const allowedStatuses = [
      "present",
      "absent",
      "half_day",
      "holiday",
      "week_off",
    ];

    const allowedFields = ["status", "remarks"];
    const updates = {};

    for (const field of allowedFields) {
      if (Object.hasOwn(req.body, field)) {
        updates[field] = req.body[field];
      }
    }

    if (!Object.keys(updates).length) {
      return sendError(res, 400, "No valid attendance fields provided.");
    }

    if (updates.status && !allowedStatuses.includes(updates.status)) {
      return sendError(res, 400, "Invalid attendance status.");
    }

    if (
      updates.remarks !== undefined &&
      (typeof updates.remarks !== "string" ||
        updates.remarks.length > MAX_REMARKS_LENGTH)
    ) {
      return sendError(res, 400, "Invalid remarks.");
    }

    const attendance = await Attendance.findById(id);

    if (!attendance) {
      return sendError(res, 404, "Attendance record not found.");
    }

    const hasAccess = await hasAccessToAttendance(req.user, attendance);

    if (!hasAccess) {
      return sendError(res, 403, "You cannot update this attendance record.");
    }

    if (attendance.isApproved) {
      return sendError(res, 409, "Approved attendance cannot be edited.");
    }

    if (updates.status !== undefined) attendance.status = updates.status;
    if (updates.remarks !== undefined) {
      attendance.remarks = updates.remarks.trim();
    }

    attendance.source = "admin";
    attendance.markedBy = req.user._id;

    await attendance.save();

    return res.json({
      success: true,
      message: "Attendance updated successfully.",
      data: { attendance },
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

    return res.json({
      success: true,
      message: "Attendance approved successfully.",
      data: { attendance },
    });
  } catch (error) {
    next(error);
  }
};
