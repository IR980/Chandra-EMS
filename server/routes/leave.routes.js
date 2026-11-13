import express from "express";
import {
  applyLeave,
  getMyLeaves,
  getLeaves,
  approveLeave,
  rejectLeave,
  cancelLeave,
  getMyLeaveBalances,
  getLeaveBalances,
  getLeavePolicies,
  createLeavePolicy,
  updateLeavePolicy,
  adjustLeaveBalance
} from "../controllers/leave.controller.js";

import {
  authenticate,
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

// Allow cancellation by the employee who applied, or an authorized leave manager.
const allowLeaveCancellation = (req, res, next) => {
  const permissions = req.user?.role?.permissions || [];

  const allowed =
    permissions.includes("*") ||
    permissions.includes("leave.apply") ||
    permissions.includes("leave.manage");

  if (!allowed) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to cancel leave applications.",
    });
  }

  next();
};

// Leave applications
router.post("/", requirePermission("leave.apply"), applyLeave);

router.get("/me", requirePermission("leave.view"), getMyLeaves);

router.get("/", requirePermission("leave.view"), getLeaves);

// Leave balances
router.get("/balances/me", requirePermission("leave.view"), getMyLeaveBalances);

router.get("/balances", requirePermission("leave.view"), getLeaveBalances);

// Leave policies
router.get("/policies", requirePermission("leave.view"), getLeavePolicies);

router.post("/policies", requirePermission("leave.manage"), createLeavePolicy);

router.patch(
  "/policies/:id",
  requirePermission("leave.manage"),
  updateLeavePolicy,
);

router.post(
  "/balances/:id/adjust",
  requirePermission("leave.manage"),
  adjustLeaveBalance,
);


// Approval workflow
router.patch("/:id/approve", requirePermission("leave.approve"), approveLeave);

router.patch("/:id/reject", requirePermission("leave.approve"), rejectLeave);

router.patch("/:id/cancel", allowLeaveCancellation, cancelLeave);

export default router;
