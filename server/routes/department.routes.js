import express from "express";

import {
  createDepartment,
  getDepartments,
  getDepartmentById,
  updateDepartment,
  deactivateDepartment,
} from "../controllers/department.controller.js";

import {
  authenticate,
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

router.get("/", requirePermission("departments.view"), getDepartments);
router.post("/", requirePermission("departments.manage"), createDepartment);
router.get("/:id", requirePermission("departments.view"), getDepartmentById);
router.patch("/:id", requirePermission("departments.manage"), updateDepartment);
router.patch(
  "/:id/deactivate",
  requirePermission("departments.manage"),
  deactivateDepartment,
);

export default router;
