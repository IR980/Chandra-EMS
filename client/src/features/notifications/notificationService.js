import api from "../../services/api";

// Fetch notifications with optional filters and pagination.
export const getNotifications = async (params = {}) => {
  const response = await api.get("/notifications", { params });
  return response.data.data;
};

// Fetch unread notification count.
export const getUnreadNotificationCount = async () => {
  const response = await api.get("/notifications/unread-count");
  return response.data.data.unreadCount;
};

// Mark one notification as read.
export const markNotificationAsRead = async (notificationId) => {
  const response = await api.patch(`/notifications/${notificationId}/read`);
  return response.data.data.notification;
};

// Mark all notifications as read.
export const markAllNotificationsAsRead = async () => {
  const response = await api.patch("/notifications/read-all");
  return response.data.data;
};

// Archive one notification.
export const archiveNotification = async (notificationId) => {
  const response = await api.patch(`/notifications/${notificationId}/archive`);
  return response.data.data.notification;
};
