import mongoose from "mongoose";
import Notification from "../models/notification.model.js";
import { emitToUser } from "./socket.service.js";
const notificationError = (message, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });

const CATEGORIES = [
  "attendance",
  "leave",
  "payroll",
  "employee",
  "document",
  "system",
];

const PRIORITIES = ["low", "medium", "high", "urgent"];

const validateNotificationData = (data) => {
  const recipient = String(data.recipient || "").trim();
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const message = typeof data.message === "string" ? data.message.trim() : "";
  const category = data.category;
  const priority = data.priority || "medium";

  if (!mongoose.isValidObjectId(recipient)) {
    throw notificationError("A valid recipient ID is required.");
  }

  if (!title || title.length > 120) {
    throw notificationError(
      "Title is required and must not exceed 120 characters.",
    );
  }

  if (!message || message.length > 1000) {
    throw notificationError(
      "Message is required and must not exceed 1000 characters.",
    );
  }

  if (!CATEGORIES.includes(category)) {
    throw notificationError("Invalid notification category.");
  }

  if (!PRIORITIES.includes(priority)) {
    throw notificationError("Invalid notification priority.");
  }

  let actionUrl = null;

  if (data.actionUrl !== undefined && data.actionUrl !== null) {
    if (typeof data.actionUrl !== "string" || data.actionUrl.length > 500) {
      throw notificationError("Invalid notification action URL.");
    }

    const normalizedUrl = data.actionUrl.trim();

    if (
      normalizedUrl &&
      (!normalizedUrl.startsWith("/") ||
        normalizedUrl.startsWith("//") ||
        normalizedUrl.includes("\\"))
    ) {
      throw notificationError(
        "Action URL must be an internal application path.",
      );
    }

    actionUrl = normalizedUrl || null;
  }

  let relatedEntity = null;

  if (data.relatedEntity) {
    const { type, id } = data.relatedEntity;

    const allowedTypes = [
      "Employee",
      "Attendance",
      "Leave",
      "Payroll",
      "Document",
      "Domain",
      "Department",
    ];

    if (
      !allowedTypes.includes(type) ||
      !mongoose.isValidObjectId(String(id || ""))
    ) {
      throw notificationError("Invalid related entity information.");
    }

    relatedEntity = {
      type,
      id,
    };
  }

  return {
    recipient,
    actor: data.actor || null,
    category,
    priority,
    title,
    message,
    actionUrl,
    relatedEntity,
    expiresAt: data.expiresAt || null,
  };
};

export const createNotification = async (data) => {
  const notificationData = validateNotificationData(data);

  const notification = await Notification.create(notificationData);

  // Emit only after the notification is successfully saved.
  try {
    emitToUser(notificationData.recipient, "notification:new", {
      notification,
    });
  } catch (error) {
    console.error("[Socket.IO] Notification emit failed:", error.message);
  }

  return notification;
};

export const createBulkNotifications = async (recipients, data) => {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw notificationError("At least one recipient is required.");
  }

  const uniqueRecipients = [
    ...new Set(recipients.map((id) => String(id).trim())),
  ];

  if (uniqueRecipients.some((id) => !mongoose.isValidObjectId(id))) {
    throw notificationError("One or more recipient IDs are invalid.");
  }

  const baseData = validateNotificationData({
    ...data,
    recipient: uniqueRecipients[0],
  });

  const documents = uniqueRecipients.map((recipient) => ({
    ...baseData,
    recipient,
  }));

  const notifications = await Notification.insertMany(documents);

  // Emit each saved notification to its respective recipient.
  try {
    for (const notification of notifications) {
      emitToUser(notification.recipient.toString(), "notification:new", {
        notification,
      });
    }
  } catch (error) {
    console.error("[Socket.IO] Bulk notification emit failed:", error.message);
  }

  return notifications;
};
