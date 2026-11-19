// import mongoose from "mongoose";

// import Payroll from "../models/payroll.model.js";
// import SalaryStructure from "../models/salaryStructure.model.js";
// import Employee from "../models/employee.model.js";
// import Attendance from "../models/attendance.model.js";
// import Leave from "../models/leave.model.js";
// import LeavePolicy from "../models/leavePolicy.model.js";
// import Domain from "../models/domain.model.js";
// import Department from "../models/department.model.js";

// const sendError = (res, status, message) =>
//   res.status(status).json({ success: false, message });

// const roundMoney = (value) =>
//   Math.round((Number(value) + Number.EPSILON) * 100) / 100;

// const validMonthYear = (month, year) =>
//   Number.isInteger(month) &&
//   month >= 1 &&
//   month <= 12 &&
//   Number.isInteger(year) &&
//   year >= 2000 &&
//   year <= 2100;

// const getMonthRange = (year, month) => ({
//   start: new Date(Date.UTC(year, month - 1, 1)),
//   end: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
//   days: new Date(Date.UTC(year, month, 0)).getUTCDate(),
// });

// const dateKey = (year, month, day) =>
//   `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

// const getDateKey = (value) => {
//   const parts = new Intl.DateTimeFormat("en-CA", {
//     timeZone: "Asia/Kolkata",
//     year: "numeric",
//     month: "2-digit",
//     day: "2-digit",
//   }).formatToParts(new Date(value));

//   const values = Object.fromEntries(
//     parts.map((part) => [part.type, part.value]),
//   );

//   return `${values.year}-${values.month}-${values.day}`;
// };

// // ----------------------------------------------------
// // PAYROLL ACCESS SCOPE
// // ----------------------------------------------------

// const getPayrollScope = async (user) => {
//   const scope = user.role?.scope || "self";

//   if (scope === "global") return {};

//   const employee = await Employee.findOne({
//     user: user._id,
//   }).select("_id");

//   if (!employee) {
//     return { employee: new mongoose.Types.ObjectId() };
//   }

//   if (scope === "self") {
//     return { employee: employee._id };
//   }

//   const [domains, departments] = await Promise.all([
//     Domain.find({ head: employee._id }).select("_id"),
//     Department.find({ manager: employee._id }).select("_id"),
//   ]);

//   const conditions = [{ employee: employee._id }];

//   if (domains.length) {
//     conditions.push({
//       domain: { $in: domains.map((item) => item._id) },
//     });
//   }

//   if (departments.length) {
//     conditions.push({
//       department: { $in: departments.map((item) => item._id) },
//     });
//   }

//   return { $or: conditions };
// };

// const employeeScopeFromPayrollScope = (scope) => {
//   if (scope.$or) {
//     return {
//       $or: scope.$or.map((condition) => {
//         if (condition.employee) {
//           return { _id: condition.employee };
//         }

//         return condition;
//       }),
//     };
//   }

//   if (scope.employee) {
//     return { _id: scope.employee };
//   }

//   return {};
// };

// // ----------------------------------------------------
// // WORKING DAYS AND HOLIDAYS
// // ----------------------------------------------------

// const getWorkingCalendar = (year, month, policy) => {
//   const workingDays = policy?.workingDays || [1, 2, 3, 4, 5, 6];

//   const holidaysSet = new Set(
//     (policy?.holidays || [])
//       .filter((holiday) => holiday.isActive !== false)
//       .map((holiday) => String(holiday.date).slice(0, 10)),
//   );

//   const { days } = getMonthRange(year, month);

//   const workingDateKeys = [];
//   let holidays = 0;
//   let weekOffs = 0;

//   for (let day = 1; day <= days; day++) {
//     const key = dateKey(year, month, day);

//     const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

//     if (holidaysSet.has(key)) {
//       holidays++;
//     } else if (!workingDays.includes(weekday)) {
//       weekOffs++;
//     } else {
//       workingDateKeys.push(key);
//     }
//   }

//   return {
//     workingDateKeys,
//     holidays,
//     weekOffs,
//   };
// };

// // ----------------------------------------------------
// // APPROVED LEAVE CALCULATION
// // ----------------------------------------------------

// const getApprovedLeaveMap = (leaves, year, month) => {
//   const leaveMap = new Map();

//   for (const leave of leaves) {
//     const start = new Date(`${getDateKey(leave.startDate)}T00:00:00Z`);
//     const end = new Date(`${getDateKey(leave.endDate)}T00:00:00Z`);

//     for (
//       let cursor = new Date(start);
//       cursor <= end;
//       cursor.setUTCDate(cursor.getUTCDate() + 1)
//     ) {
//       const key = cursor.toISOString().slice(0, 10);
//       const [leaveYear, leaveMonth] = key.split("-").map(Number);

//       if (leaveYear !== year || leaveMonth !== month) continue;

//       leaveMap.set(key, {
//         leaveType: leave.leaveType,
//         days: leave.isHalfDay ? 0.5 : 1,
//       });
//     }
//   }

//   return leaveMap;
// };

// // ----------------------------------------------------
// // SALARY CALCULATION HELPERS
// // ----------------------------------------------------

// const getSalaryDetails = (salary) => {
//   const earnings = salary.earnings || {};
//   const deductions = salary.deductions || {};

//   const componentGross = [
//     "basic",
//     "hra",
//     "da",
//     "travelAllowance",
//     "specialAllowance",
//     "otherAllowances",
//   ].reduce((total, key) => total + (Number(earnings[key]) || 0), 0);

//   const grossMonthly =
//     salary.salaryMode === "gross"
//       ? Number(salary.grossMonthly) || 0
//       : componentGross;

//   const totalMonthlyDeductions = [
//     "pf",
//     "esi",
//     "professionalTax",
//     "tds",
//     "otherDeductions",
//   ].reduce((total, key) => total + (Number(deductions[key]) || 0), 0);

//   return {
//     grossMonthly,
//     totalMonthlyDeductions,

//     earningsSnapshot: {
//       basic: Number(earnings.basic) || 0,
//       hra: Number(earnings.hra) || 0,
//       da: Number(earnings.da) || 0,
//       travelAllowance: Number(earnings.travelAllowance) || 0,
//       specialAllowance: Number(earnings.specialAllowance) || 0,
//       otherAllowances: Number(earnings.otherAllowances) || 0,
//       grossMonthly,
//     },

//     deductionsSnapshot: {
//       pf: Number(deductions.pf) || 0,
//       esi: Number(deductions.esi) || 0,
//       professionalTax: Number(deductions.professionalTax) || 0,
//       tds: Number(deductions.tds) || 0,
//       otherDeductions: Number(deductions.otherDeductions) || 0,
//     },
//   };
// };

// // ----------------------------------------------------
// // GENERATE PAYROLL FOR ONE EMPLOYEE
// // ----------------------------------------------------

// const calculateEmployeePayroll = async (employee, year, month, actorId) => {
//   const { start, end } = getMonthRange(year, month);

//   const salary = await SalaryStructure.findOne({
//     employee: employee._id,
//     isActive: true,
//     effectiveFrom: { $lte: end },
//     $or: [{ effectiveTo: null }, { effectiveTo: { $gte: start } }],
//   }).sort({ effectiveFrom: -1 });

//   if (!salary) {
//     return {
//       skipped: true,
//       reason: "No active salary structure found for this month.",
//     };
//   }

//   const policy = await LeavePolicy.findOne({
//     domain: employee.domain,
//     year,
//     isActive: true,
//   }).lean();

//   if (!policy) {
//     return {
//       skipped: true,
//       reason: "No active leave policy found for this domain and year.",
//     };
//   }

//   const { workingDateKeys, holidays, weekOffs } = getWorkingCalendar(
//     year,
//     month,
//     policy,
//   );

//   const fromDate = dateKey(year, month, 1);
//   const toDate = dateKey(year, month, getMonthRange(year, month).days);

//   // Only approved and non-deleted attendance is counted.
//   const attendanceRecords = await Attendance.find({
//     employee: employee._id,
//     attendanceDate: {
//       $gte: fromDate,
//       $lte: toDate,
//     },
//     isApproved: true,
//     deletedAt: null,
//   }).lean();

//   const attendanceMap = new Map(
//     attendanceRecords.map((record) => [record.attendanceDate, record]),
//   );

//   // Only approved leave applications are counted.
//   const approvedLeaves = await Leave.find({
//     employee: employee._id,
//     status: "approved",
//     startDate: { $lte: end },
//     endDate: { $gte: start },
//   }).lean();

//   const leaveMap = getApprovedLeaveMap(approvedLeaves, year, month);

//   let presentDays = 0;
//   let absentDays = 0;
//   let halfDays = 0;
//   let paidLeaveDays = 0;
//   let unpaidLeaveDays = 0;

//   for (const key of workingDateKeys) {
//     const attendance = attendanceMap.get(key);
//     const leave = leaveMap.get(key);

//     // Approved leave is authoritative.
//     if (leave) {
//       if (leave.leaveType === "unpaid") {
//         unpaidLeaveDays += leave.days;
//       } else {
//         paidLeaveDays += leave.days;
//       }

//       continue;
//     }

//     if (!attendance) {
//       absentDays++;
//       continue;
//     }

//     switch (attendance.status) {
//       case "present":
//         presentDays++;
//         break;

//       case "half_day":
//         halfDays++;
//         break;

//       case "absent":
//         absentDays++;
//         break;

//       case "leave":
//         // Unapproved leave attendance is unpaid.
//         unpaidLeaveDays++;
//         break;

//       default:
//         break;
//     }
//   }

//   const workingDays = workingDateKeys.length;

//   const payableDays = Math.max(0, presentDays + halfDays * 0.5 + paidLeaveDays);

//   const {
//     grossMonthly,
//     totalMonthlyDeductions,
//     earningsSnapshot,
//     deductionsSnapshot,
//   } = getSalaryDetails(salary);

//   const dailyRate = workingDays > 0 ? grossMonthly / workingDays : 0;

//   const dailyDeductionRate =
//     workingDays > 0 ? totalMonthlyDeductions / workingDays : 0;

//   const grossPay = roundMoney(dailyRate * payableDays);

//   const totalDeductions = roundMoney(dailyDeductionRate * payableDays);

//   const netPay = roundMoney(Math.max(0, grossPay - totalDeductions));

//   const payroll = await Payroll.create({
//     employee: employee._id,
//     domain: employee.domain,
//     department: employee.department,
//     salaryStructure: salary._id,

//     payrollMonth: month,
//     payrollYear: year,

//     periodStart: start,
//     periodEnd: end,

//     salarySnapshot: {
//       salaryMode: salary.salaryMode,
//       currency: salary.currency || "INR",
//       payFrequency: salary.payFrequency || "monthly",
//       earnings: earningsSnapshot,
//       deductions: deductionsSnapshot,
//       effectiveFrom: salary.effectiveFrom,
//       effectiveTo: salary.effectiveTo || null,
//     },

//     attendanceSummary: {
//       workingDays,
//       presentDays,
//       absentDays,
//       halfDays,
//       paidLeaveDays,
//       unpaidLeaveDays,
//       holidays,
//       weekOffs,
//       payableDays,
//     },

//     grossPay,
//     totalDeductions,
//     netPay,

//     status: "draft",
//     createdBy: actorId,

//     history: [
//       {
//         action: "created",
//         actionBy: actorId,
//         remarks: `Payroll generated for ${month}/${year}.`,
//         previousStatus: null,
//         newStatus: "draft",
//       },
//     ],
//   });

//   return {
//     skipped: false,
//     payroll,
//   };
// };

// // ----------------------------------------------------
// // 1. GENERATE MONTHLY PAYROLL
// // POST /api/payroll/runs
// // ----------------------------------------------------

// export const generatePayroll = async (req, res, next) => {
//   try {
//     const month = Number(req.body.payrollMonth);
//     const year = Number(req.body.payrollYear);

//     if (!validMonthYear(month, year)) {
//       return sendError(
//         res,
//         400,
//         "Provide a valid payrollMonth and payrollYear.",
//       );
//     }

//     const scope = await getPayrollScope(req.user);

//     const employeeFilter = {
//       ...employeeScopeFromPayrollScope(scope),
//       employmentStatus: {
//         $in: ["active", "on_leave"],
//       },
//     };

//     if (req.body.domain) {
//       if (!mongoose.isValidObjectId(req.body.domain)) {
//         return sendError(res, 400, "Invalid domain ID.");
//       }

//       employeeFilter.domain = req.body.domain;
//     }

//     if (req.body.department) {
//       if (!mongoose.isValidObjectId(req.body.department)) {
//         return sendError(res, 400, "Invalid department ID.");
//       }

//       employeeFilter.department = req.body.department;
//     }

//     const employees = await Employee.find(employeeFilter)
//       .select("_id employeeCode fullName domain department employmentStatus")
//       .lean();

//     const generated = [];
//     const skipped = [];

//     for (const employee of employees) {
//       const existing = await Payroll.findOne({
//         employee: employee._id,
//         payrollMonth: month,
//         payrollYear: year,
//       }).select("_id status");

//       if (existing) {
//         skipped.push({
//           employee: employee._id,
//           employeeCode: employee.employeeCode,
//           fullName: employee.fullName,
//           reason: `Payroll already exists with status ${existing.status}.`,
//         });

//         continue;
//       }

//       try {
//         const result = await calculateEmployeePayroll(
//           employee,
//           year,
//           month,
//           req.user._id,
//         );

//         if (result.skipped) {
//           skipped.push({
//             employee: employee._id,
//             employeeCode: employee.employeeCode,
//             fullName: employee.fullName,
//             reason: result.reason,
//           });
//         } else {
//           generated.push(result.payroll);
//         }
//       } catch (error) {
//         if (error.code === 11000) {
//           skipped.push({
//             employee: employee._id,
//             employeeCode: employee.employeeCode,
//             fullName: employee.fullName,
//             reason: "Payroll already created by another request.",
//           });
//         } else {
//           throw error;
//         }
//       }
//     }

//     return res.status(201).json({
//       success: true,
//       message: "Monthly payroll generation completed.",
//       data: {
//         generated,
//         skipped,
//         totalEmployees: employees.length,
//       },
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// // ----------------------------------------------------
// // 2. GET PAYROLL RECORDS
// // GET /api/payroll/records
// // ----------------------------------------------------

// export const getPayrolls = async (req, res, next) => {
//   try {
//     const scope = await getPayrollScope(req.user);
//     const filter = { ...scope };

//     if (req.query.payrollMonth) {
//       const month = Number(req.query.payrollMonth);

//       if (!Number.isInteger(month) || month < 1 || month > 12) {
//         return sendError(res, 400, "Invalid payroll month.");
//       }

//       filter.payrollMonth = month;
//     }

//     if (req.query.payrollYear) {
//       const year = Number(req.query.payrollYear);

//       if (!Number.isInteger(year) || year < 2000 || year > 2100) {
//         return sendError(res, 400, "Invalid payroll year.");
//       }

//       filter.payrollYear = year;
//     }

//     for (const field of ["employee", "domain", "department"]) {
//       if (req.query[field]) {
//         if (!mongoose.isValidObjectId(req.query[field])) {
//           return sendError(res, 400, `Invalid ${field} ID.`);
//         }

//         filter[field] = req.query[field];
//       }
//     }

//     if (req.query.status) {
//       const statuses = ["draft", "verified", "approved", "paid"];

//       if (!statuses.includes(req.query.status)) {
//         return sendError(res, 400, "Invalid payroll status.");
//       }

//       filter.status = req.query.status;
//     }

//     const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);

//     const limit = Math.min(
//       100,
//       Math.max(1, Number.parseInt(req.query.limit, 10) || 20),
//     );

//     const [payrolls, total] = await Promise.all([
//       Payroll.find(filter)
//         .populate("employee", "employeeCode fullName designation")
//         .populate("domain", "name code")
//         .populate("department", "name code")
//         .populate("salaryStructure")
//         .populate("verifiedBy", "fullName email")
//         .populate("approvedBy", "fullName email")
//         .populate("paidBy", "fullName email")
//         .sort({
//           payrollYear: -1,
//           payrollMonth: -1,
//           createdAt: -1,
//         })
//         .skip((page - 1) * limit)
//         .limit(limit),

//       Payroll.countDocuments(filter),
//     ]);

//     return res.json({
//       success: true,
//       data: {
//         payrolls,
//         pagination: {
//           total,
//           page,
//           limit,
//           totalPages: Math.ceil(total / limit),
//         },
//       },
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// // ----------------------------------------------------
// // 3. GET SINGLE PAYROLL
// // GET /api/payroll/records/:id
// // ----------------------------------------------------

// export const getPayrollById = async (req, res, next) => {
//   try {
//     if (!mongoose.isValidObjectId(req.params.id)) {
//       return sendError(res, 400, "Invalid payroll ID.");
//     }

//     const scope = await getPayrollScope(req.user);

//     const payroll = await Payroll.findOne({
//       _id: req.params.id,
//       ...scope,
//     })
//       .populate("employee", "employeeCode fullName designation employmentType")
//       .populate("domain", "name code")
//       .populate("department", "name code")
//       .populate("salaryStructure")
//       .populate("verifiedBy", "fullName email")
//       .populate("approvedBy", "fullName email")
//       .populate("paidBy", "fullName email")
//       .populate("history.actionBy", "fullName email");

//     if (!payroll) {
//       return sendError(res, 404, "Payroll record not found.");
//     }

//     return res.json({
//       success: true,
//       data: { payroll },
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// // ----------------------------------------------------
// // COMMON PAYROLL ACTION HELPER
// // ----------------------------------------------------

// const getPayrollForAction = async (req, res) => {
//   if (!mongoose.isValidObjectId(req.params.id)) {
//     sendError(res, 400, "Invalid payroll ID.");
//     return null;
//   }

//   const scope = await getPayrollScope(req.user);

//   const payroll = await Payroll.findOne({
//     _id: req.params.id,
//     ...scope,
//   });

//   if (!payroll) {
//     sendError(res, 404, "Payroll record not found in your authorized scope.");

//     return null;
//   }

//   return payroll;
// };

// // ----------------------------------------------------
// // 4. VERIFY PAYROLL
// // PATCH /api/payroll/records/:id/verify
// // ----------------------------------------------------

// export const verifyPayroll = async (req, res, next) => {
//   try {
//     const payroll = await getPayrollForAction(req, res);

//     if (!payroll) return;

//     if (payroll.status !== "draft") {
//       return sendError(res, 409, "Only draft payroll can be verified.");
//     }

//     const remarks =
//       typeof req.body.remarks === "string" ? req.body.remarks.trim() : "";

//     if (remarks.length > 1000) {
//       return sendError(res, 400, "Remarks cannot exceed 1000 characters.");
//     }

//     const previousStatus = payroll.status;

//     payroll.status = "verified";
//     payroll.verifiedBy = req.user._id;
//     payroll.verifiedAt = new Date();
//     payroll.verificationRemarks = remarks;
//     payroll.updatedBy = req.user._id;

//     payroll.history.push({
//       action: "verified",
//       actionBy: req.user._id,
//       remarks,
//       previousStatus,
//       newStatus: "verified",
//     });

//     await payroll.save();

//     return res.json({
//       success: true,
//       message: "Payroll verified successfully.",
//       data: { payroll },
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// // ----------------------------------------------------
// // 5. APPROVE PAYROLL
// // PATCH /api/payroll/records/:id/approve
// // ----------------------------------------------------

// export const approvePayroll = async (req, res, next) => {
//   try {
//     const payroll = await getPayrollForAction(req, res);

//     if (!payroll) return;

//     if (payroll.status !== "verified") {
//       return sendError(res, 409, "Only verified payroll can be approved.");
//     }

//     const remarks =
//       typeof req.body.remarks === "string" ? req.body.remarks.trim() : "";

//     if (remarks.length > 1000) {
//       return sendError(res, 400, "Remarks cannot exceed 1000 characters.");
//     }

//     const previousStatus = payroll.status;

//     payroll.status = "approved";
//     payroll.approvedBy = req.user._id;
//     payroll.approvedAt = new Date();
//     payroll.approvalRemarks = remarks;
//     payroll.updatedBy = req.user._id;

//     payroll.history.push({
//       action: "approved",
//       actionBy: req.user._id,
//       remarks,
//       previousStatus,
//       newStatus: "approved",
//     });

//     await payroll.save();

//     return res.json({
//       success: true,
//       message: "Payroll approved successfully.",
//       data: { payroll },
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// // ----------------------------------------------------
// // 6. MARK PAYROLL AS PAID
// // PATCH /api/payroll/records/:id/pay
// // ----------------------------------------------------

// export const markPayrollPaid = async (req, res, next) => {
//   try {
//     const payroll = await getPayrollForAction(req, res);

//     if (!payroll) return;

//     if (payroll.status !== "approved") {
//       return sendError(
//         res,
//         409,
//         "Only approved payroll can be marked as paid.",
//       );
//     }

//     const allowedMethods = ["bank_transfer", "upi", "cash", "cheque", "other"];

//     const paymentMethod = req.body.paymentMethod;

//     const paymentReference =
//       typeof req.body.paymentReference === "string"
//         ? req.body.paymentReference.trim()
//         : "";

//     if (!allowedMethods.includes(paymentMethod)) {
//       return sendError(res, 400, "Select a valid payment method.");
//     }

//     if (paymentReference.length > 150) {
//       return sendError(
//         res,
//         400,
//         "Payment reference cannot exceed 150 characters.",
//       );
//     }

//     const previousStatus = payroll.status;

//     payroll.status = "paid";
//     payroll.paidBy = req.user._id;
//     payroll.paidAt = new Date();
//     payroll.paymentMethod = paymentMethod;
//     payroll.paymentReference = paymentReference;
//     payroll.updatedBy = req.user._id;

//     payroll.history.push({
//       action: "paid",
//       actionBy: req.user._id,
//       remarks: paymentReference ? `Payment reference: ${paymentReference}` : "",
//       previousStatus,
//       newStatus: "paid",
//     });

//     await payroll.save();

//     return res.json({
//       success: true,
//       message: "Payroll marked as paid successfully.",
//       data: { payroll },
//     });
//   } catch (error) {
//     next(error);
//   }
// };

import mongoose from "mongoose";

import Payroll from "../models/payroll.model.js";
import Employee from "../models/employee.model.js";
import Domain from "../models/domain.model.js";
import Department from "../models/department.model.js";

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
