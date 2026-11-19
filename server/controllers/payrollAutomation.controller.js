
import PayrollAutomationRun from "../models/payrollAutomationRun.model.js";

const TIME_ZONE = "Asia/Kolkata";

const getIndiaDateParts = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  return Object.fromEntries(
    parts.map((part) => [part.type, Number(part.value)])
  );
};

const getNextScheduledRun = () => {
  const { year, month, day, hour } = getIndiaDateParts();

  let nextYear = year;
  let nextMonth = month;

  // If the 1st at 2 AM IST has already passed, use next month.
  if (day > 1 || (day === 1 && hour >= 2)) {
    if (nextMonth === 12) {
      nextMonth = 1;
      nextYear += 1;
    } else {
      nextMonth += 1;
    }
  }

  // 2:00 AM IST is 8:30 PM UTC on the previous date.
  return new Date(
    Date.UTC(nextYear, nextMonth - 1, 1, 2, 0) - 330 * 60 * 1000
  );
};

export const getPayrollAutomationStatus = async (req, res, next) => {
  try {
    const latestRun = await PayrollAutomationRun.findOne()
      .sort({ lastAttemptAt: -1 })
      .lean();

    const enabled = process.env.PAYROLL_SCHEDULER_ENABLED === "true";

    return res.status(200).json({
      success: true,
      message: "Payroll automation status retrieved successfully.",
      data: {
        enabled,
        schedule: "0 2 1 * *",
        scheduleDescription: "1st day of every month at 2:00 AM IST",
        timeZone: TIME_ZONE,
        nextRunAt: enabled ? getNextScheduledRun() : null,
        latestRun: latestRun || null,
      },
    });
  } catch (error) {
    next(error);
  }
};
