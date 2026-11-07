import express from "express";

import {
  checkIn,
  checkOut,
  getMyAttendance,
  getAttendance,
  createManualAttendance,
  updateAttendance,
  approveAttendance,
} from "../controllers/attendance.controller.js";

import {
  authenticate,
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = express.Router();

// All attendance routes require authentication.
router.use(authenticate);

// Employee self-service
router.post("/check-in", requirePermission("attendance.mark"), checkIn);

router.patch("/check-out", requirePermission("attendance.mark"), checkOut);

router.get("/me", requirePermission("attendance.view"), getMyAttendance);

// HR and authorized managers
router.get("/", requirePermission("attendance.view"), getAttendance);

router.post(
  "/manual",
  requirePermission("attendance.manage"),
  createManualAttendance,
);

router.patch(
  "/:id/approve",
  requirePermission("attendance.approve"),
  approveAttendance,
);

router.patch("/:id", requirePermission("attendance.manage"), updateAttendance);

export default router;
