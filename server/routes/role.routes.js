import { Router } from "express";
import { getAssignableRoles } from "../controllers/role.controller.js";
import {
  authenticate,
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = Router();

router.get(
  "/assignable",
  authenticate,
  requirePermission("users.create"),
  getAssignableRoles,
);

export default router;
