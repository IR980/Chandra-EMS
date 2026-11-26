import express from "express";

import {
  authenticate,
  requirePermission,
} from "../middleware/auth.middleware.js";

import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  archiveNotification,
} from "../controllers/notification.controller.js";

const router = express.Router();

// All notification routes require authentication.
router.use(authenticate);

// View notifications and unread count.
router.get(
  "/unread-count",
  requirePermission("notifications.view"),
  getUnreadNotificationCount,
);

router.get("/", requirePermission("notifications.view"), getNotifications);

// Update the authenticated user's own notifications.
router.patch(
  "/read-all",
  requirePermission("notifications.view"),
  markAllNotificationsAsRead,
);

router.patch(
  "/:notificationId/read",
  requirePermission("notifications.view"),
  markNotificationAsRead,
);

router.patch(
  "/:notificationId/archive",
  requirePermission("notifications.view"),
  archiveNotification,
);

export default router;
