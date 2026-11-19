import mongoose from "mongoose";

import Employee from "../models/employee.model.js";
import Attendance from "../models/attendance.model.js";
import Leave from "../models/leave.model.js";
import LeaveBalance from "../models/leaveBalance.model.js";
import Payroll from "../models/payroll.model.js";
import Domain from "../models/domain.model.js";
import Department from "../models/department.model.js";

const MAX_PAGE_SIZE = 100;
const MAX_EXPORT_ROWS = 10000;
const TIME_ZONE = "Asia/Kolkata";

const sendSuccess = (res, message, data = {}) =>
  res.status(200).json({
    success: true,
    message,
    data,
  });

const sendError = (res, status, message) =>
  res.status(status).json({
    success: false,
    message,
  });

const getCompanyDate = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
};

const isValidDateKey = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
};

const getDefaultDateRange = () => {
  const today = getCompanyDate();
  const [year, month] = today.split("-");

  return {
    from: `${year}-${month}-01`,
    to: today,
  };
};

const getDateRange = (query) => {
  const defaults = getDefaultDateRange();
  const from = query.from || defaults.from;
  const to = query.to || defaults.to;

  if (!isValidDateKey(from) || !isValidDateKey(to)) {
    throw new Error("Invalid date range. Use YYYY-MM-DD format.");
  }

  if (from > to) {
    throw new Error("Start date cannot be after end date.");
  }

  return { from, to };
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

const validObjectId = (value, label) => {
  if (!mongoose.isValidObjectId(value)) {
    throw new Error(`Invalid ${label} ID.`);
  }

  return value;
};

// Global users see company-wide data.
// Self users see only their own employee records.
// Assigned users see their own records, headed domains,
// and departments they officially manage.
const getReportScope = async (user) => {
  const scope = user?.role?.scope || "self";

  if (scope === "global") {
    return {
      employeeFilter: {},
      recordFilter: {},
      employee: null,
    };
  }

  const employee = await Employee.findOne({
    user: user._id,
  }).select("_id domain department");

  if (!employee) {
    const impossibleId = new mongoose.Types.ObjectId();

    return {
      employeeFilter: { _id: impossibleId },
      recordFilter: { employee: impossibleId },
      employee: null,
    };
  }

  if (scope === "self") {
    return {
      employeeFilter: { _id: employee._id },
      recordFilter: { employee: employee._id },
      employee,
    };
  }

  const [headedDomains, managedDepartments] = await Promise.all([
    Domain.find({ head: employee._id }).distinct("_id"),
    Department.find({ manager: employee._id }).distinct("_id"),
  ]);

  const employeeConditions = [{ _id: employee._id }];
  const recordConditions = [{ employee: employee._id }];

  if (headedDomains.length) {
    employeeConditions.push({ domain: { $in: headedDomains } });
    recordConditions.push({ domain: { $in: headedDomains } });
  }

  if (managedDepartments.length) {
    employeeConditions.push({ department: { $in: managedDepartments } });
    recordConditions.push({ department: { $in: managedDepartments } });
  }

  return {
    employeeFilter: { $or: employeeConditions },
    recordFilter: { $or: recordConditions },
    employee,
  };
};

const combineFilters = (...filters) => ({
  $and: filters.filter((filter) => filter && Object.keys(filter).length > 0),
});

const addOrganizationFilters = (query, filters) => {
  if (query.domain) {
    filters.domain = validObjectId(query.domain, "domain");
  }

  if (query.department) {
    filters.department = validObjectId(query.department, "department");
  }

  if (query.employee) {
    filters.employee = validObjectId(query.employee, "employee");
  }

  return filters;
};

const getPayrollPeriod = (query) => {
  const today = getCompanyDate();
  const [currentYear, currentMonth] = today.split("-").map(Number);

  const month = query.month ? Number.parseInt(query.month, 10) : currentMonth;

  const year = query.year ? Number.parseInt(query.year, 10) : currentYear;

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Month must be between 1 and 12.");
  }

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("Year must be between 2000 and 2100.");
  }

  return { month, year };
};

const getEmployeeReportFilters = (query) => {
  const filters = {};

  if (query.domain) {
    filters.domain = validObjectId(query.domain, "domain");
  }

  if (query.department) {
    filters.department = validObjectId(query.department, "department");
  }

  if (query.employee) {
    filters._id = validObjectId(query.employee, "employee");
  }

  if (query.employmentStatus) {
    const allowed = ["active", "on_leave", "inactive", "terminated"];

    if (!allowed.includes(query.employmentStatus)) {
      throw new Error("Invalid employment status.");
    }

    filters.employmentStatus = query.employmentStatus;
  }

  if (query.employmentType) {
    const allowed = ["full_time", "part_time", "contract", "intern"];

    if (!allowed.includes(query.employmentType)) {
      throw new Error("Invalid employment type.");
    }

    filters.employmentType = query.employmentType;
  }

  if (query.search) {
    const search = String(query.search).trim().slice(0, 100);

    if (search) {
      filters.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { employeeCode: { $regex: search, $options: "i" } },
        { designation: { $regex: search, $options: "i" } },
      ];
    }
  }

  return filters;
};

const getAttendanceReportFilters = (query, range) => {
  const filters = {
    deletedAt: null,
    attendanceDate: {
      $gte: range.from,
      $lte: range.to,
    },
  };

  addOrganizationFilters(query, filters);

  const allowed = [
    "present",
    "absent",
    "half_day",
    "leave",
    "holiday",
    "week_off",
  ];

  if (query.status) {
    if (!allowed.includes(query.status)) {
      throw new Error("Invalid attendance status.");
    }

    filters.status = query.status;
  }

  return filters;
};

const getLeaveReportFilters = (query, range) => {
  const filters = {
    startDate: { $lte: new Date(`${range.to}T23:59:59.999Z`) },
    endDate: { $gte: new Date(`${range.from}T00:00:00.000Z`) },
  };

  addOrganizationFilters(query, filters);

  const allowedTypes = ["casual", "sick", "earned", "unpaid"];
  const allowedStatuses = ["pending", "approved", "rejected", "cancelled"];

  if (query.leaveType) {
    if (!allowedTypes.includes(query.leaveType)) {
      throw new Error("Invalid leave type.");
    }

    filters.leaveType = query.leaveType;
  }

  if (query.status) {
    if (!allowedStatuses.includes(query.status)) {
      throw new Error("Invalid leave status.");
    }

    filters.status = query.status;
  }

  return filters;
};

const getPayrollReportFilters = (query, period) => {
  const filters = {
    payrollMonth: period.month,
    payrollYear: period.year,
  };

  addOrganizationFilters(query, filters);

  const allowedStatuses = ["draft", "verified", "approved", "paid"];

  if (query.status) {
    if (!allowedStatuses.includes(query.status)) {
      throw new Error("Invalid payroll status.");
    }

    filters.status = query.status;
  }

  return filters;
};

const employeePopulate = [
  { path: "domain", select: "name code" },
  { path: "department", select: "name code" },
];

const recordPopulate = [
  {
    path: "employee",
    select: "employeeCode fullName designation",
  },
  { path: "domain", select: "name code" },
  { path: "department", select: "name code" },
];

// GET /api/reports/summary
export const getReportSummary = async (req, res, next) => {
  try {
    const scope = await getReportScope(req.user);
    const range = getDateRange(req.query);
    const period = getPayrollPeriod(req.query);

    const attendanceMatch = combineFilters(scope.recordFilter, {
      deletedAt: null,
      attendanceDate: { $gte: range.from, $lte: range.to },
    });

    const leaveMatch = combineFilters(scope.recordFilter, {
      startDate: {
        $lte: new Date(`${range.to}T23:59:59.999Z`),
      },
      endDate: {
        $gte: new Date(`${range.from}T00:00:00.000Z`),
      },
    });

    const payrollMatch = combineFilters(scope.recordFilter, {
      payrollMonth: period.month,
      payrollYear: period.year,
    });

    const [
      employeeCounts,
      attendanceCounts,
      leaveCounts,
      payrollSummary,
      departmentCounts,
    ] = await Promise.all([
      Employee.aggregate([
        { $match: scope.employeeFilter },
        {
          $group: {
            _id: "$employmentStatus",
            count: { $sum: 1 },
          },
        },
      ]),

      Attendance.aggregate([
        { $match: attendanceMatch },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            workedMinutes: { $sum: "$workedMinutes" },
          },
        },
      ]),

      Leave.aggregate([
        { $match: leaveMatch },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            requestedDays: { $sum: "$requestedDays" },
          },
        },
      ]),

      Payroll.aggregate([
        { $match: payrollMatch },
        {
          $group: {
            _id: "$status",
            employees: { $sum: 1 },
            grossPay: { $sum: "$grossPay" },
            deductions: { $sum: "$totalDeductions" },
            netPay: { $sum: "$netPay" },
          },
        },
      ]),

      Employee.aggregate([
        { $match: scope.employeeFilter },
        {
          $group: {
            _id: "$department",
            employees: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: "departments",
            localField: "_id",
            foreignField: "_id",
            as: "department",
          },
        },
        { $unwind: { path: "$department", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            departmentId: "$department._id",
            departmentName: "$department.name",
            departmentCode: "$department.code",
            employees: 1,
          },
        },
        { $sort: { employees: -1 } },
      ]),
    ]);

    const toCountMap = (items) =>
      Object.fromEntries(items.map((item) => [item._id, item.count]));

    const toPayrollMap = (items) =>
      Object.fromEntries(items.map((item) => [item._id, item]));

    const payrollByStatus = toPayrollMap(payrollSummary);

    const totalPayroll = payrollSummary.reduce(
      (result, item) => ({
        employees: result.employees + item.employees,
        grossPay: result.grossPay + item.grossPay,
        deductions: result.deductions + item.deductions,
        netPay: result.netPay + item.netPay,
      }),
      { employees: 0, grossPay: 0, deductions: 0, netPay: 0 },
    );

    return sendSuccess(res, "Reports summary retrieved successfully.", {
      dateRange: range,
      payrollPeriod: period,
      employees: {
        total: employeeCounts.reduce((sum, item) => sum + item.count, 0),
        byStatus: toCountMap(employeeCounts),
        byDepartment: departmentCounts,
      },
      attendance: {
        total: attendanceCounts.reduce((sum, item) => sum + item.count, 0),
        byStatus: toCountMap(attendanceCounts),
        workedMinutes: attendanceCounts.reduce(
          (sum, item) => sum + item.workedMinutes,
          0,
        ),
      },
      leaves: {
        total: leaveCounts.reduce((sum, item) => sum + item.count, 0),
        byStatus: toCountMap(leaveCounts),
        requestedDays: leaveCounts.reduce(
          (sum, item) => sum + item.requestedDays,
          0,
        ),
      },
      payroll: {
        ...totalPayroll,
        byStatus: payrollByStatus,
      },
    });
  } catch (error) {
    if (
      error.message.startsWith("Invalid") ||
      error.message.includes("cannot be after")
    ) {
      return sendError(res, 400, error.message);
    }

    next(error);
  }
};

// GET /api/reports/employees
export const getEmployeeReport = async (req, res, next) => {
  try {
    const scope = await getReportScope(req.user);
    const pagination = getPagination(req.query);
    const filters = getEmployeeReportFilters(req.query);
    const query = combineFilters(scope.employeeFilter, filters);

    const [employees, total] = await Promise.all([
      Employee.find(query)
        .populate(employeePopulate)
        .select(
          "employeeCode fullName designation employmentType employmentStatus joiningDate domain department",
        )
        .sort({ joiningDate: -1, fullName: 1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),

      Employee.countDocuments(query),
    ]);

    return sendSuccess(res, "Employee report retrieved successfully.", {
      employees,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    });
  } catch (error) {
    if (error.message.startsWith("Invalid")) {
      return sendError(res, 400, error.message);
    }

    next(error);
  }
};

// GET /api/reports/attendance
export const getAttendanceReport = async (req, res, next) => {
  try {
    const scope = await getReportScope(req.user);
    const range = getDateRange(req.query);
    const pagination = getPagination(req.query);
    const filters = getAttendanceReportFilters(req.query, range);
    const query = combineFilters(scope.recordFilter, filters);

    const [records, total, summary] = await Promise.all([
      Attendance.find(query)
        .populate(recordPopulate)
        .sort({ attendanceDate: -1, createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),

      Attendance.countDocuments(query),

      Attendance.aggregate([
        { $match: query },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            workedMinutes: { $sum: "$workedMinutes" },
          },
        },
      ]),
    ]);

    return sendSuccess(res, "Attendance report retrieved successfully.", {
      dateRange: range,
      records,
      summary: summary.map((item) => ({
        status: item._id,
        count: item.count,
        workedMinutes: item.workedMinutes,
      })),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    });
  } catch (error) {
    if (
      error.message.startsWith("Invalid") ||
      error.message.includes("cannot be after")
    ) {
      return sendError(res, 400, error.message);
    }

    next(error);
  }
};

// GET /api/reports/leaves
export const getLeaveReport = async (req, res, next) => {
  try {
    const scope = await getReportScope(req.user);
    const range = getDateRange(req.query);
    const pagination = getPagination(req.query);
    const filters = getLeaveReportFilters(req.query, range);
    const query = combineFilters(scope.recordFilter, filters);

    const [records, total, summary, balances] = await Promise.all([
      Leave.find(query)
        .populate(recordPopulate)
        .populate("approvedBy", "name email")
        .populate("rejectedBy", "name email")
        .sort({ appliedAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),

      Leave.countDocuments(query),

      Leave.aggregate([
        { $match: query },
        {
          $group: {
            _id: {
              status: "$status",
              leaveType: "$leaveType",
            },
            requests: { $sum: 1 },
            requestedDays: { $sum: "$requestedDays" },
          },
        },
      ]),

      LeaveBalance.aggregate([
        {
          $match: combineFilters(scope.recordFilter, {
            year:
              Number.parseInt(req.query.year, 10) ||
              Number(getCompanyDate().slice(0, 4)),
            isActive: true,
          }),
        },
        {
          $group: {
            _id: "$leaveType",
            employees: { $sum: 1 },
            annualEntitlement: { $sum: "$annualEntitlement" },
            carriedForward: { $sum: "$carriedForward" },
            adjustment: { $sum: "$adjustment" },
            used: { $sum: "$used" },
          },
        },
        {
          $project: {
            _id: 1,
            employees: 1,
            annualEntitlement: 1,
            carriedForward: 1,
            adjustment: 1,
            used: 1,
            totalEntitlement: {
              $add: ["$annualEntitlement", "$carriedForward", "$adjustment"],
            },
            remaining: {
              $max: [
                0,
                {
                  $subtract: [
                    {
                      $add: [
                        "$annualEntitlement",
                        "$carriedForward",
                        "$adjustment",
                      ],
                    },
                    "$used",
                  ],
                },
              ],
            },
          },
        },
      ]),
    ]);

    return sendSuccess(res, "Leave report retrieved successfully.", {
      dateRange: range,
      records,
      summary: summary.map((item) => ({
        status: item._id.status,
        leaveType: item._id.leaveType,
        requests: item.requests,
        requestedDays: item.requestedDays,
      })),
      balances,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    });
  } catch (error) {
    if (
      error.message.startsWith("Invalid") ||
      error.message.includes("cannot be after")
    ) {
      return sendError(res, 400, error.message);
    }

    next(error);
  }
};

// GET /api/reports/payroll
export const getPayrollReport = async (req, res, next) => {
  try {
    const scope = await getReportScope(req.user);
    const period = getPayrollPeriod(req.query);
    const pagination = getPagination(req.query);
    const filters = getPayrollReportFilters(req.query, period);
    const query = combineFilters(scope.recordFilter, filters);

    const [records, total, summary] = await Promise.all([
      Payroll.find(query)
        .populate(recordPopulate)
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),

      Payroll.countDocuments(query),

      Payroll.aggregate([
        { $match: query },
        {
          $group: {
            _id: "$status",
            employees: { $sum: 1 },
            grossPay: { $sum: "$grossPay" },
            totalDeductions: { $sum: "$totalDeductions" },
            netPay: { $sum: "$netPay" },
          },
        },
      ]),
    ]);

    return sendSuccess(res, "Payroll report retrieved successfully.", {
      period,
      records,
      summary,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    });
  } catch (error) {
    if (error.message.startsWith("Invalid")) {
      return sendError(res, 400, error.message);
    }

    next(error);
  }
};

const csvEscape = (value) => {
  if (value === null || value === undefined) return "";

  const text = String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const sendCsv = (res, filename, headers, rows) => {
  const csv = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ].join("\r\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  return res.status(200).send(`\uFEFF${csv}`);
};

// GET /api/reports/export/:type
// Supported types: employees, attendance, leaves, payroll
export const exportReportCsv = async (req, res, next) => {
  try {
    const scope = await getReportScope(req.user);
    const type = req.params.type;
    let rows = [];
    let headers = [];
    let filename = "";

    if (type === "employees") {
      const filters = getEmployeeReportFilters(req.query);
      const query = combineFilters(scope.employeeFilter, filters);

      const employees = await Employee.find(query)
        .populate(employeePopulate)
        .select(
          "employeeCode fullName designation employmentType employmentStatus joiningDate domain department",
        )
        .sort({ fullName: 1 })
        .limit(MAX_EXPORT_ROWS)
        .lean();

      headers = [
        "Employee Code",
        "Employee Name",
        "Designation",
        "Employment Type",
        "Employment Status",
        "Joining Date",
        "Domain",
        "Department",
      ];

      rows = employees.map((item) => [
        item.employeeCode,
        item.fullName,
        item.designation,
        item.employmentType,
        item.employmentStatus,
        item.joiningDate
          ? new Date(item.joiningDate).toISOString().slice(0, 10)
          : "",
        item.domain?.name,
        item.department?.name,
      ]);

      filename = "employee-report.csv";
    } else if (type === "attendance") {
      const range = getDateRange(req.query);
      const filters = getAttendanceReportFilters(req.query, range);
      const query = combineFilters(scope.recordFilter, filters);

      const records = await Attendance.find(query)
        .populate(recordPopulate)
        .sort({ attendanceDate: -1 })
        .limit(MAX_EXPORT_ROWS)
        .lean();

      headers = [
        "Attendance Date",
        "Employee Code",
        "Employee Name",
        "Domain",
        "Department",
        "Status",
        "Worked Minutes",
        "Approved",
      ];

      rows = records.map((item) => [
        item.attendanceDate,
        item.employee?.employeeCode,
        item.employee?.fullName,
        item.domain?.name,
        item.department?.name,
        item.status,
        item.workedMinutes,
        item.isApproved ? "Yes" : "No",
      ]);

      filename = "attendance-report.csv";
    } else if (type === "leaves") {
      const range = getDateRange(req.query);
      const filters = getLeaveReportFilters(req.query, range);
      const query = combineFilters(scope.recordFilter, filters);

      const records = await Leave.find(query)
        .populate(recordPopulate)
        .sort({ appliedAt: -1 })
        .limit(MAX_EXPORT_ROWS)
        .lean();

      headers = [
        "Employee Code",
        "Employee Name",
        "Domain",
        "Department",
        "Leave Type",
        "Start Date",
        "End Date",
        "Requested Days",
        "Status",
        "Applied At",
      ];

      rows = records.map((item) => [
        item.employee?.employeeCode,
        item.employee?.fullName,
        item.domain?.name,
        item.department?.name,
        item.leaveType,
        item.startDate
          ? new Date(item.startDate).toISOString().slice(0, 10)
          : "",
        item.endDate ? new Date(item.endDate).toISOString().slice(0, 10) : "",
        item.requestedDays,
        item.status,
        item.appliedAt ? new Date(item.appliedAt).toISOString() : "",
      ]);

      filename = "leave-report.csv";
    } else if (type === "payroll") {
      const period = getPayrollPeriod(req.query);
      const filters = getPayrollReportFilters(req.query, period);
      const query = combineFilters(scope.recordFilter, filters);

      const records = await Payroll.find(query)
        .populate(recordPopulate)
        .sort({ createdAt: -1 })
        .limit(MAX_EXPORT_ROWS)
        .lean();

      headers = [
        "Payroll Month",
        "Payroll Year",
        "Employee Code",
        "Employee Name",
        "Domain",
        "Department",
        "Gross Pay",
        "Deductions",
        "Net Pay",
        "Status",
        "Generation Source",
      ];

      rows = records.map((item) => [
        item.payrollMonth,
        item.payrollYear,
        item.employee?.employeeCode,
        item.employee?.fullName,
        item.domain?.name,
        item.department?.name,
        item.grossPay,
        item.totalDeductions,
        item.netPay,
        item.status,
        item.generationSource,
      ]);

      filename = `payroll-report-${period.year}-${String(period.month).padStart(2, "0")}.csv`;
    } else {
      return sendError(
        res,
        400,
        "Invalid report type. Use employees, attendance, leaves or payroll.",
      );
    }

    return sendCsv(res, filename, headers, rows);
  } catch (error) {
    if (
      error.message.startsWith("Invalid") ||
      error.message.includes("cannot be after")
    ) {
      return sendError(res, 400, error.message);
    }

    next(error);
  }
};
