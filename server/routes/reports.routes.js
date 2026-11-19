import express from "express";

import {
  authenticate,
  requirePermission,
} from "../middleware/auth.middleware.js";
import { PERMISSIONS } from "../config/permissions.js";

import {
  getReportSummary,
  getEmployeeReport,
  getAttendanceReport,
  getLeaveReport,
  getPayrollReport,
  exportReportCsv,
} from "../controllers/reports.controller.js";

const router = express.Router();

router.use(authenticate);

// Dashboard summary
router.get(
  "/summary",
  requirePermission(PERMISSIONS.REPORTS_VIEW),
  getReportSummary,
);

// Individual reports
router.get(
  "/employees",
  requirePermission(PERMISSIONS.REPORTS_VIEW),
  getEmployeeReport,
);

router.get(
  "/attendance",
  requirePermission(PERMISSIONS.REPORTS_VIEW),
  getAttendanceReport,
);

router.get(
  "/leaves",
  requirePermission(PERMISSIONS.REPORTS_VIEW),
  getLeaveReport,
);

router.get(
  "/payroll",
  requirePermission(PERMISSIONS.REPORTS_VIEW),
  getPayrollReport,
);

// CSV export requires a separate permission.
router.get(
  "/export/:type",
  requirePermission(PERMISSIONS.REPORTS_EXPORT),
  exportReportCsv,
);

export default router;
