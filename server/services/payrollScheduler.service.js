import cron from "node-cron";
import Employee from "../models/employee.model.js";
import PayrollAutomationRun from "../models/payrollAutomationRun.model.js";
import { generateMonthlyPayroll } from "./payrollCalculation.service.js";

const TIME_ZONE = "Asia/Kolkata";
const CRON_EXPRESSION = "0 2 1 * *";
const LOCK_DURATION_MS = 60 * 60 * 1000;

let payrollJob = null;

const getIndiaDateParts = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
  };
};

const getPreviousMonth = () => {
  const { year, month } = getIndiaDateParts();

  if (month === 1) {
    return { year: year - 1, month: 12 };
  }

  return { year, month: month - 1 };
};

const claimAutomationRun = async (year, month) => {
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + LOCK_DURATION_MS);

  // Retry a failed run or recover an expired running lock.
  const existingRun = await PayrollAutomationRun.findOneAndUpdate(
    {
      payrollYear: year,
      payrollMonth: month,
      $or: [
        { status: "failed" },
        { status: "running", lockedUntil: { $lte: now } },
      ],
    },
    {
      $set: {
        status: "running",
        startedAt: now,
        lastAttemptAt: now,
        lockedUntil,
        errorMessage: "",
      },
      $inc: { attempts: 1 },
    },
    { new: true },
  );

  if (existingRun) {
    return existingRun;
  }

  // Create the first run. The unique month/year index prevents duplicates.
  try {
    return await PayrollAutomationRun.create({
      payrollYear: year,
      payrollMonth: month,
      status: "running",
      startedAt: now,
      lastAttemptAt: now,
      lockedUntil,
      attempts: 1,
    });
  } catch (error) {
    if (error.code === 11000) {
      return null;
    }

    throw error;
  }
};

export const runAutomaticPayroll = async (year, month) => {
  let automationRun = null;

  try {
    console.log(
      `[Payroll Scheduler] Starting ${month}/${year} automatic payroll generation.`,
    );

    automationRun = await claimAutomationRun(year, month);

    if (!automationRun) {
      console.log(
        `[Payroll Scheduler] ${month}/${year} already completed or currently running. Skipping.`,
      );

      return { skipped: true };
    }

    const employees = await Employee.find({
      employmentStatus: { $in: ["active", "on_leave"] },
    }).select("_id");

    const result = await generateMonthlyPayroll({
      employees,
      year,
      month,
      actorId: null,
      actorType: "system",
      generationSource: "automatic",
    });

    await PayrollAutomationRun.findByIdAndUpdate(automationRun._id, {
      $set: {
        status: "completed",
        completedAt: new Date(),
        lockedUntil: null,
        generatedCount: result.generated?.length || 0,
        skippedCount: result.skipped?.length || 0,
        errorMessage: "",
      },
    });

    console.log(
      `[Payroll Scheduler] Completed ${month}/${year}. Generated: ${result.generated?.length || 0}, skipped: ${result.skipped?.length || 0}.`,
    );

    return {
      skipped: false,
      generated: result.generated?.length || 0,
      skippedCount: result.skipped?.length || 0,
    };
  } catch (error) {
    console.error("[Payroll Scheduler] Automatic payroll failed:", error);

    if (automationRun?._id) {
      await PayrollAutomationRun.findByIdAndUpdate(automationRun._id, {
        $set: {
          status: "failed",
          lockedUntil: null,
          errorMessage: String(error.message || error).slice(0, 2000),
        },
      });
    }

    throw error;
  }
};

export const startPayrollScheduler = async () => {
  if (process.env.PAYROLL_SCHEDULER_ENABLED !== "true") {
    console.log(
      "[Payroll Scheduler] Disabled. Set PAYROLL_SCHEDULER_ENABLED=true to enable.",
    );
    return;
  }

  if (payrollJob) {
    console.log("[Payroll Scheduler] Already started.");
    return;
  }

  // Ensure the unique database index exists before scheduling jobs.
  await PayrollAutomationRun.init();

  payrollJob = cron.schedule(
    CRON_EXPRESSION,
    async () => {
      const { year, month } = getPreviousMonth();

      try {
        await runAutomaticPayroll(year, month);
      } catch (error) {
        console.error("[Payroll Scheduler] Scheduled execution error:", error);
      }
    },
    { timezone: TIME_ZONE },
  );

  console.log(
    "[Payroll Scheduler] Enabled. Runs at 2:00 AM IST on the 1st of every month.",
  );

  // Recover a missed run if the server starts after 2:00 AM on the 1st,
  // or on any later day of the month.
  const { day, hour } = getIndiaDateParts();
  const missedScheduledTime = day > 1 || (day === 1 && hour >= 2);

  if (missedScheduledTime) {
    const previousMonth = getPreviousMonth();

    try {
      console.log(
        `[Payroll Scheduler] Checking missed run for ${previousMonth.month}/${previousMonth.year}.`,
      );

      await runAutomaticPayroll(previousMonth.year, previousMonth.month);
    } catch (error) {
      console.error("[Payroll Scheduler] Startup recovery failed:", error);
    }
  }
};