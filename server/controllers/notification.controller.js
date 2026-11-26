import mongoose from "mongoose";
import Notification from "../models/notification.model.js";

const ALLOWED_CATEGORIES = [
  "attendance",
  "leave",
  "payroll",
  "employee",
  "document",
  "system",
];

const ALLOWED_PRIORITIES = ["low", "medium", "high", "urgent"];

const getPagination = (query) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(query.limit, 10) || 20),
  );

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

const sendError = (res, status, message) =>
  res.status(status).json({
    success: false,
    message,
  });

// GET /api/notifications
export const getNotifications = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);

    const filters = {
      recipient: req.user._id,
      archivedAt: null,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    };

    if (req.query.unreadOnly === "true") {
      filters.readAt = null;
    }

    if (req.query.category) {
      if (!ALLOWED_CATEGORIES.includes(req.query.category)) {
        return sendError(res, 400, "Invalid notification category.");
      }

      filters.category = req.query.category;
    }

    if (req.query.priority) {
      if (!ALLOWED_PRIORITIES.includes(req.query.priority)) {
        return sendError(res, 400, "Invalid notification priority.");
      }

      filters.priority = req.query.priority;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filters)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("actor", "fullName")
        .lean(),

      Notification.countDocuments(filters),

      Notification.countDocuments({
        recipient: req.user._id,
        archivedAt: null,
        readAt: null,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Notifications retrieved successfully.",
      data: {
        notifications,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        unreadCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/notifications/unread-count
export const getUnreadNotificationCount = async (req, res, next) => {
  try {
    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      readAt: null,
      archivedAt: null,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    });

    return res.status(200).json({
      success: true,
      message: "Unread notification count retrieved successfully.",
      data: { unreadCount },
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/notifications/:notificationId/read
export const markNotificationAsRead = async (req, res, next) => {
  try {
    const { notificationId } = req.params;

    if (!mongoose.isValidObjectId(notificationId)) {
      return sendError(res, 400, "Invalid notification ID.");
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        recipient: req.user._id,
        archivedAt: null,
      },
      {
        $set: { readAt: new Date() },
      },
      {
        new: true,
        runValidators: true,
      },
    )
      .populate("actor", "fullName")
      .lean();

    if (!notification) {
      return sendError(res, 404, "Notification not found.");
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read.",
      data: { notification },
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/notifications/read-all
export const markAllNotificationsAsRead = async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      {
        recipient: req.user._id,
        readAt: null,
        archivedAt: null,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      },
      {
        $set: { readAt: new Date() },
      },
    );

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read.",
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/notifications/:notificationId/archive
export const archiveNotification = async (req, res, next) => {
  try {
    const { notificationId } = req.params;

    if (!mongoose.isValidObjectId(notificationId)) {
      return sendError(res, 400, "Invalid notification ID.");
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        recipient: req.user._id,
        archivedAt: null,
      },
      {
        $set: { archivedAt: new Date() },
      },
      {
        new: true,
        runValidators: true,
      },
    ).lean();

    if (!notification) {
      return sendError(res, 404, "Notification not found.");
    }

    return res.status(200).json({
      success: true,
      message: "Notification archived successfully.",
      data: { notification },
    });
  } catch (error) {
    next(error);
  }
};
