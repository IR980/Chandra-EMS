import express from "express";

import {
  createSalaryStructure,
  getSalaryStructures,
  getEmployeeSalaryHistory,
  updateSalaryStructure,
} from "../controllers/salaryStructure.controller.js";

import {
  authenticate,
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = express.Router();

// All payroll routes require authentication.
router.use(authenticate);

// Get salary structures with filters and pagination.
router.get(
  "/structures",
  requirePermission("payroll.view"),
  getSalaryStructures,
);

// Get an employee's current salary and salary history.
router.get(
  "/employees/:employeeId/salary",
  requirePermission("payroll.view"),
  getEmployeeSalaryHistory,
);

// Create a salary structure.
router.post(
  "/structures",
  requirePermission("payroll.manage"),
  createSalaryStructure,
);

// Update salary structure by creating a new salary version.
router.patch(
  "/structures/:id",
  requirePermission("payroll.manage"),
  updateSalaryStructure,
);

export default router;
