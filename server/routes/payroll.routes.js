import express from "express";

import {
  createSalaryStructure,
  getSalaryStructures,
  getEmployeeSalaryHistory,
  updateSalaryStructure,
} from "../controllers/salaryStructure.controller.js";

import {
  generatePayroll,
  getPayrolls,
  getPayrollById,
  verifyPayroll,
  approvePayroll,
  markPayrollPaid,
  recalculatePayroll,
} from "../controllers/payroll.controller.js";

import { getPayrollAutomationStatus } from "../controllers/payrollAutomation.controller.js";

import {
  authenticate,
  requirePermission,
} from "../middleware/auth.middleware.js";

import { PERMISSIONS as P } from "../config/permissions.js";

const router = express.Router();

router.use(authenticate);

// Salary structure management
router.get(
  "/structures",
  requirePermission(P.PAYROLL_VIEW),
  getSalaryStructures,
);

router.get(
  "/employees/:employeeId/salary",
  requirePermission(P.PAYROLL_VIEW),
  getEmployeeSalaryHistory,
);

router.post(
  "/structures",
  requirePermission(P.PAYROLL_MANAGE),
  createSalaryStructure,
);

router.patch(
  "/structures/:id",
  requirePermission(P.PAYROLL_MANAGE),
  updateSalaryStructure,
);

// Payroll generation and listing
router.post(
  "/generate",
  requirePermission(P.PAYROLL_GENERATE),
  generatePayroll,
);

router.get("/", requirePermission(P.PAYROLL_VIEW), getPayrolls);

// Payroll automation status
router.get(
  "/automation/status",
  requirePermission(P.PAYROLL_VIEW),
  getPayrollAutomationStatus,
);

// Payroll workflow actions
router.patch(
  "/:id/recalculate",
  requirePermission(P.PAYROLL_RECALCULATE),
  recalculatePayroll,
);

router.patch("/:id/verify", requirePermission(P.PAYROLL_VERIFY), verifyPayroll);

router.patch(
  "/:id/approve",
  requirePermission(P.PAYROLL_APPROVE),
  approvePayroll,
);

router.patch("/:id/pay", requirePermission(P.PAYROLL_PAY), markPayrollPaid);

// Keep the dynamic ID route last
router.get("/:id", requirePermission(P.PAYROLL_VIEW), getPayrollById);

export default router;
