import Payroll from "../models/payroll.model.js";
import SalaryStructure from "../models/salaryStructure.model.js";
import Attendance from "../models/attendance.model.js";
import Leave from "../models/leave.model.js";
import LeavePolicy from "../models/leavePolicy.model.js";

const roundMoney = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const dateKey = (year, month, day) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const getMonthRange = (year, month) => ({
  start: new Date(Date.UTC(year, month - 1, 1)),
  end: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
  days: new Date(Date.UTC(year, month, 0)).getUTCDate(),
});

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

const getDateKey = (value) => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date found in payroll data.");
  }

  // Leave startDate and endDate are calendar dates stored as MongoDB Dates.
  // Use UTC components to preserve their stored calendar date.
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
};

const validateCompletedMonth = (year, month) => {
  if (
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isInteger(year) ||
    year < 2000 ||
    year > 2100
  ) {
    throw new Error("Provide a valid payroll month and year.");
  }

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const selectedMonthEndKey = dateKey(year, month, lastDay);
  const todayKey = getIndiaDateKey();

  if (selectedMonthEndKey >= todayKey) {
    throw new Error(
      "Payroll can only be generated after the selected month has ended in India.",
    );
  }
};

const getSalaryDetails = (salary) => {
  const earnings = salary.earnings || {};
  const deductions = salary.deductions || {};

  const componentGross = [
    "basic",
    "hra",
    "da",
    "travelAllowance",
    "specialAllowance",
    "otherAllowances",
  ].reduce((total, key) => total + (Number(earnings[key]) || 0), 0);

  const grossMonthly =
    salary.salaryMode === "gross"
      ? Number(salary.grossMonthly) || 0
      : componentGross;

  const totalMonthlyDeductions = [
    "pf",
    "esi",
    "professionalTax",
    "tds",
    "otherDeductions",
  ].reduce((total, key) => total + (Number(deductions[key]) || 0), 0);

  return {
    grossMonthly,
    totalMonthlyDeductions,
    earningsSnapshot: {
      basic: Number(earnings.basic) || 0,
      hra: Number(earnings.hra) || 0,
      da: Number(earnings.da) || 0,
      travelAllowance: Number(earnings.travelAllowance) || 0,
      specialAllowance: Number(earnings.specialAllowance) || 0,
      otherAllowances: Number(earnings.otherAllowances) || 0,
      grossMonthly,
    },
    deductionsSnapshot: {
      pf: Number(deductions.pf) || 0,
      esi: Number(deductions.esi) || 0,
      professionalTax: Number(deductions.professionalTax) || 0,
      tds: Number(deductions.tds) || 0,
      otherDeductions: Number(deductions.otherDeductions) || 0,
    },
  };
};

const getWorkingCalendar = (year, month, policy) => {
  const workingDays = policy.workingDays || [1, 2, 3, 4, 5, 6];

  const holidaysSet = new Set(
    (policy.holidays || [])
      .filter((holiday) => holiday.isActive !== false)
      .map((holiday) => String(holiday.date).slice(0, 10)),
  );

  const { days } = getMonthRange(year, month);

  const workingDateKeys = [];
  let holidays = 0;
  let weekOffs = 0;

  for (let day = 1; day <= days; day++) {
    const key = dateKey(year, month, day);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

    if (holidaysSet.has(key)) {
      holidays++;
    } else if (!workingDays.includes(weekday)) {
      weekOffs++;
    } else {
      workingDateKeys.push(key);
    }
  }

  return { workingDateKeys, holidays, weekOffs };
};

const getApprovedLeaveMap = (leaves, year, month) => {
  const leaveMap = new Map();

  for (const leave of leaves) {
    const start = new Date(`${getDateKey(leave.startDate)}T00:00:00.000Z`);
    const end = new Date(`${getDateKey(leave.endDate)}T00:00:00.000Z`);

    for (
      let cursor = new Date(start);
      cursor <= end;
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    ) {
      const key = cursor.toISOString().slice(0, 10);
      const [leaveYear, leaveMonth] = key.split("-").map(Number);

      if (leaveYear !== year || leaveMonth !== month) continue;

      leaveMap.set(key, {
        leaveType: leave.leaveType,
        days: leave.isHalfDay ? 0.5 : 1,
      });
    }
  }

  return leaveMap;
};

const getSalaryForDate = (salaryStructures, key) => {
  const date = new Date(`${key}T12:00:00.000Z`);

  return (
    salaryStructures
      .filter((salary) => {
        const from = new Date(salary.effectiveFrom);
        const to = salary.effectiveTo ? new Date(salary.effectiveTo) : null;

        return from <= date && (!to || to >= date);
      })
      .sort(
        (a, b) =>
          new Date(b.effectiveFrom).getTime() -
          new Date(a.effectiveFrom).getTime(),
      )[0] || null
  );
};

// Builds the calculation data without changing a payroll record.
const calculatePayrollData = async (employee, year, month) => {
  if (!employee?._id || !employee.domain || !employee.department) {
    throw new Error("Employee domain or department information is missing.");
  }

  const { start, end, days } = getMonthRange(year, month);

  const salaryStructures = await SalaryStructure.find({
    employee: employee._id,
    effectiveFrom: { $lte: end },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: start } }],
  })
    .sort({ effectiveFrom: 1 })
    .lean();

  if (!salaryStructures.length) {
    throw new Error("No salary structure covers the selected payroll month.");
  }

  const policy = await LeavePolicy.findOne({
    domain: employee.domain,
    year,
    isActive: true,
  }).lean();

  if (!policy) {
    throw new Error("No active leave policy found for this domain and year.");
  }

  const { workingDateKeys, holidays, weekOffs } = getWorkingCalendar(
    year,
    month,
    policy,
  );

  const workingDays = workingDateKeys.length;

  if (!workingDays) {
    throw new Error("The selected month has no configured working days.");
  }

  const dailySalaryMap = new Map();

  for (const key of workingDateKeys) {
    const salary = getSalaryForDate(salaryStructures, key);

    if (!salary) {
      throw new Error(
        `No effective salary structure covers working date ${key}.`,
      );
    }

    dailySalaryMap.set(key, {
      salary,
      details: getSalaryDetails(salary),
    });
  }

  const fromDate = dateKey(year, month, 1);
  const toDate = dateKey(year, month, days);

  const [attendanceRecords, approvedLeaves] = await Promise.all([
    Attendance.find({
      employee: employee._id,
      attendanceDate: { $gte: fromDate, $lte: toDate },
      isApproved: true,
      deletedAt: null,
    }).lean(),

    Leave.find({
      employee: employee._id,
      status: "approved",
      startDate: { $lte: end },
      endDate: { $gte: start },
    }).lean(),
  ]);

  const attendanceMap = new Map(
    attendanceRecords.map((record) => [record.attendanceDate, record]),
  );

  const leaveMap = getApprovedLeaveMap(approvedLeaves, year, month);

  let presentDays = 0;
  let absentDays = 0;
  let halfDays = 0;
  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  let payableDays = 0;
  let grossPay = 0;
  let totalDeductions = 0;

  for (const key of workingDateKeys) {
    const attendance = attendanceMap.get(key);
    const leave = leaveMap.get(key);

    let payableForDate = 0;

    if (leave) {
      if (leave.leaveType === "unpaid") {
        unpaidLeaveDays += leave.days;
      } else {
        paidLeaveDays += leave.days;
        payableForDate = leave.days;
      }
    } else if (!attendance) {
      absentDays++;
    } else {
      switch (attendance.status) {
        case "present":
          presentDays++;
          payableForDate = 1;
          break;
        case "half_day":
          halfDays++;
          payableForDate = 0.5;
          break;
        case "absent":
          absentDays++;
          break;
        case "leave":
          unpaidLeaveDays++;
          break;
        default:
          break;
      }
    }

    payableDays += payableForDate;

    const { grossMonthly, totalMonthlyDeductions } =
      dailySalaryMap.get(key).details;

    grossPay += (grossMonthly / workingDays) * payableForDate;
    totalDeductions += (totalMonthlyDeductions / workingDays) * payableForDate;
  }

  const lastWorkingSalary = getSalaryForDate(
    salaryStructures,
    workingDateKeys[workingDateKeys.length - 1],
  );

  const snapshot = getSalaryDetails(lastWorkingSalary);

  return {
    employee: employee._id,
    domain: employee.domain,
    department: employee.department,
    salaryStructure: lastWorkingSalary._id,
    payrollMonth: month,
    payrollYear: year,
    periodStart: start,
    periodEnd: end,

    salarySnapshot: {
      salaryMode: lastWorkingSalary.salaryMode,
      currency: lastWorkingSalary.currency || "INR",
      payFrequency: lastWorkingSalary.payFrequency || "monthly",
      earnings: snapshot.earningsSnapshot,
      deductions: snapshot.deductionsSnapshot,
      effectiveFrom: lastWorkingSalary.effectiveFrom,
      effectiveTo: lastWorkingSalary.effectiveTo || null,
    },

    attendanceSummary: {
      workingDays,
      presentDays,
      absentDays,
      halfDays,
      paidLeaveDays,
      unpaidLeaveDays,
      holidays,
      weekOffs,
      payableDays: roundMoney(payableDays),
    },

    grossPay: roundMoney(grossPay),
    totalDeductions: roundMoney(totalDeductions),
    netPay: roundMoney(Math.max(0, grossPay - totalDeductions)),
  };
};

/**
 * Generate payroll for one employee.
 * New records are always created as drafts.
 */
export const generateEmployeePayroll = async ({
  employee,
  year,
  month,
  actorId = null,
  actorType = "user",
  generationSource = "manual",
}) => {
  validateCompletedMonth(year, month);

  const existing = await Payroll.findOne({
    employee: employee._id,
    payrollMonth: month,
    payrollYear: year,
  }).select("_id status");

  if (existing) {
    return {
      skipped: true,
      reason: `Payroll already exists with status ${existing.status}.`,
    };
  }

  const calculation = await calculatePayrollData(employee, year, month);

  try {
    const payroll = await Payroll.create({
      ...calculation,
      status: "draft",
      generationSource,
      createdBy: actorId || null,
      createdByType: actorType,
      history: [
        {
          action: "created",
          actionBy: actorId || null,
          actorType,
          remarks: `${generationSource === "automatic" ? "Automatic" : "Manual"} payroll generated for ${month}/${year}.`,
          previousStatus: null,
          newStatus: "draft",
        },
      ],
    });

    return { skipped: false, payroll };
  } catch (error) {
    if (error.code === 11000) {
      return {
        skipped: true,
        reason: "Payroll was created by another request.",
      };
    }

    throw error;
  }
};

/**
 * Recalculate an existing draft payroll.
 * The existing record ID and original creation information are retained.
 */
export const recalculateDraftPayroll = async ({
  payrollId,
  actorId,
  scopeFilter,
}) => {
  if (
    !payrollId ||
    !actorId ||
    !scopeFilter ||
    typeof scopeFilter !== "object" ||
    Array.isArray(scopeFilter)
  ) {
    throw new Error(
      "Payroll ID, acting user and authorization scope are required.",
    );
  }

  const payroll = await Payroll.findOne({
  $and: [
    { _id: payrollId },
    scopeFilter,
  ],
});

  if (!payroll) {
    throw new Error("Payroll record not found.");
  }

  if (payroll.status !== "draft") {
    throw new Error(
      "Only draft payroll can be recalculated. Verified, approved and paid payrolls are protected.",
    );
  }

  const employee = await import("../models/employee.model.js").then(
    ({ default: Employee }) =>
      Employee.findById(payroll.employee)
        .select("_id employeeCode fullName domain department employmentStatus")
        .lean(),
  );

  if (!employee) {
    throw new Error("The employee linked to this payroll no longer exists.");
  }

  validateCompletedMonth(payroll.payrollYear, payroll.payrollMonth);

  const calculation = await calculatePayrollData(
    employee,
    payroll.payrollYear,
    payroll.payrollMonth,
  );

  // Conditional update prevents overwriting a record that was verified
  // by another user while the calculation was running.
  const updated = await Payroll.findOneAndUpdate(
    {
      $and: [
        {
          _id: payroll._id,
          status: "draft",
        },
        scopeFilter,
      ],
    },
    {
      $set: {
        salaryStructure: calculation.salaryStructure,
        salarySnapshot: calculation.salarySnapshot,
        attendanceSummary: calculation.attendanceSummary,
        grossPay: calculation.grossPay,
        totalDeductions: calculation.totalDeductions,
        netPay: calculation.netPay,
        updatedBy: actorId,
      },
      $push: {
        history: {
          action: "updated",
          actionBy: actorId,
          actorType: "user",
          remarks:
            "Draft payroll recalculated using current salary and approved attendance/leave records.",
          previousStatus: "draft",
          newStatus: "draft",
          actionAt: new Date(),
        },
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!updated) {
    throw new Error(
      "Payroll status changed during recalculation. Refresh and try again.",
    );
  }

  return updated;
};

/**
 * Generate payroll for a group of employees.
 */
export const generateMonthlyPayroll = async ({
  employees,
  year,
  month,
  actorId = null,
  actorType = "user",
  generationSource = "manual",
}) => {
  validateCompletedMonth(year, month);

  if (!Array.isArray(employees)) {
    throw new Error("Employees must be provided as an array.");
  }

  const generated = [];
  const skipped = [];

  for (const employee of employees) {
    try {
      const result = await generateEmployeePayroll({
        employee,
        year,
        month,
        actorId,
        actorType,
        generationSource,
      });

      if (result.skipped) {
        skipped.push({
          employee: employee._id,
          employeeCode: employee.employeeCode,
          fullName: employee.fullName,
          reason: result.reason,
        });
      } else {
        generated.push(result.payroll);
      }
    } catch (error) {
      skipped.push({
        employee: employee._id,
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
        reason: error.message || "Payroll generation failed.",
      });
    }
  }

  return {
    generated,
    skipped,
    totalEmployees: employees.length,
  };
};
