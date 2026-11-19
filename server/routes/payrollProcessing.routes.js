import express from "express";

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

const router = express.Router();

router.use(authenticate);

// Generate monthly payroll
router.post("/generate", requirePermission("payroll.manage"), generatePayroll);

// Get payroll records
router.get("/", requirePermission("payroll.view"), getPayrolls);

// Get a specific payroll record
router.get("/:id", requirePermission("payroll.view"), getPayrollById);

// Get payroll automation status
router.get(
  "/automation/status",
  requirePermission("payroll.view"),
  getPayrollAutomationStatus,
);

// Verify payroll
router.patch("/:id/verify", requirePermission("payroll.verify"), verifyPayroll);

// Approve verified payroll
router.patch(
  "/:id/approve",
  requirePermission("payroll.approve"),
  approvePayroll,
);
router.patch(
  "/:id/recalculate",
  requirePermission("payroll.manage"),
  recalculatePayroll,
);

// Mark approved payroll as paid
router.patch("/:id/pay", requirePermission("payroll.manage"), markPayrollPaid);

export default router;
