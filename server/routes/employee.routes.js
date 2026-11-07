import express from "express";

import {
  createEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  deactivateEmployee,
  createEmployeeAccount,
  getEmployeeReports,
} from "../controllers/employee.controller.js";

import {
  authenticate,
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

// Employee login account
router.post(
  "/:id/account",
  requirePermission("users.create"),
  createEmployeeAccount,
);

// Employee directory
router.get("/", requirePermission("employees.view"), getEmployees);

// Employee creation
router.post("/", requirePermission("employees.create"), createEmployee);

// Direct reporting employees
router.get(
  "/:id/reports",
  requirePermission("employees.view"),
  getEmployeeReports,
);

// Employee profile
router.get("/:id", requirePermission("employees.view"), getEmployeeById);

// Update employee, including reporting manager
router.patch("/:id", requirePermission("employees.update"), updateEmployee);

// Deactivate employee
router.patch(
  "/:id/deactivate",
  requirePermission("employees.archive"),
  deactivateEmployee,
);

export default router;
