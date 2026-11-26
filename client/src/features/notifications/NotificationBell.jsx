import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Check,
  CheckCheck,
  Archive,
  RefreshCw,
  X,
  CalendarDays,
  Wallet,
  Users,
  FileText,
  ClipboardCheck,
  Settings,
} from "lucide-react";
import socket from "../../services/socket";
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  archiveNotification,
} from "./notificationService";

const categoryIcons = {
  attendance: CalendarDays,
  leave: ClipboardCheck,
  payroll: Wallet,
  employee: Users,
  document: FileText,
  system: Settings,
};

const priorityStyles = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700",
};

const formatTime = (date) => {
  if (!date) return "";

  const value = new Date(date);

  if (Number.isNaN(value.getTime())) return "";

  return value.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function NotificationBell() {
  const navigate = useNavigate();
  const panelRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadUnreadCount = useCallback(async () => {
    try {
      const count = await getUnreadNotificationCount();
      setUnreadCount(count);
    } catch (err) {
      console.error("Unable to load unread notification count:", err);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await getNotifications({ page: 1, limit: 8 });

      setNotifications(result.notifications || []);
      setUnreadCount(result.unreadCount || 0);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUnreadCount();

    const interval = setInterval(loadUnreadCount, 30000);

    return () => clearInterval(interval);
  }, [loadUnreadCount]);

  useEffect(() => {
    if (!open) return;

    loadNotifications();
  }, [open, loadNotifications]);

  // Real-time notifications using Socket.IO
  useEffect(() => {
    const handleNewNotification = ({ notification }) => {
      if (!notification?._id) return;

      setNotifications((previous) => {
        const exists = previous.some((item) => item._id === notification._id);

        if (exists) return previous;

        return [notification, ...previous].slice(0, 8);
      });

      if (!notification.readAt) {
        setUnreadCount((previous) => previous + 1);
      }
    };

    socket.on("notification:new", handleNewNotification);

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off("notification:new", handleNewNotification);
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const handleMarkRead = async (notificationId) => {
    try {
      await markNotificationAsRead(notificationId);

      setNotifications((previous) =>
        previous.map((item) =>
          item._id === notificationId
            ? { ...item, readAt: new Date().toISOString() }
            : item,
        ),
      );

      setUnreadCount((previous) => Math.max(0, previous - 1));
    } catch (err) {
      setError(err.response?.data?.message || "Unable to mark as read.");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();

      const now = new Date().toISOString();

      setNotifications((previous) =>
        previous.map((item) => ({
          ...item,
          readAt: item.readAt || now,
        })),
      );

      setUnreadCount(0);
    } catch (err) {
      setError("Unable to mark notifications as read.");
    }
  };

  const handleArchive = async (notificationId) => {
    try {
      await archiveNotification(notificationId);

      setNotifications((previous) =>
        previous.filter((item) => item._id !== notificationId),
      );

      const item = notifications.find(
        (notification) => notification._id === notificationId,
      );

      if (item && !item.readAt) {
        setUnreadCount((previous) => Math.max(0, previous - 1));
      }
    } catch (err) {
      setError("Unable to archive notification.");
    }
  };

  const handleNotificationClick = async (item) => {
  if (!item) return;

  if (!item.readAt) {
    await handleMarkRead(item._id);
  }

  setOpen(false);

  let destination = item.actionUrl;

  // Support older leave notifications saved with the old URL.
  if (item.category === "leave" && destination === "/leaves") {
    destination = "/leaves/management";
  }

  // Redirect old document notifications to Document Verification.
if (item.category === "document" && destination === "/documents") {
  destination = "/documents/verification";
}
  if (
    typeof destination === "string" &&
    destination.startsWith("/") &&
    !destination.startsWith("//") &&
    !destination.includes("\\")
  ) {
    navigate(destination);
  }
};

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-expanded={open}
      >
        <Bell size={20} />

        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-13 z-50 w-[min(92vw,400px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
            <div>
              <h3 className="font-bold text-slate-900">Notifications</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {unreadCount} unread notifications
              </p>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={loadNotifications}
                disabled={loading}
                title="Refresh"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <RefreshCw
                  size={16}
                  className={loading ? "animate-spin" : ""}
                />
              </button>

              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Close"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {unreadCount > 0 && (
            <div className="flex justify-end border-b border-slate-100 px-4 py-2">
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900"
              >
                <CheckCheck size={14} />
                Mark all as read
              </button>
            </div>
          )}

          {error && (
            <div className="m-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="max-h-105 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell size={30} className="mx-auto text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-700">
                  You're all caught up!
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  New notifications will appear here.
                </p>
              </div>
            ) : (
              notifications.map((item) => {
                const Icon = categoryIcons[item.category] || Bell;

                return (
                  <div
                    key={item._id}
                    className={`group flex gap-3 border-b border-slate-100 px-4 py-4 transition hover:bg-slate-50 ${
                      !item.readAt ? "bg-emerald-50/40" : ""
                    }`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                      <Icon size={18} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => handleNotificationClick(item)}
                        className="block w-full text-left"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-800">
                            {item.title}
                          </p>

                          {!item.readAt && (
                            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                          )}
                        </div>

                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
                          {item.message}
                        </p>
                      </button>

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400">
                            {formatTime(item.createdAt)}
                          </span>

                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                              priorityStyles[item.priority] ||
                              priorityStyles.medium
                            }`}
                          >
                            {item.priority}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                          {!item.readAt && (
                            <button
                              type="button"
                              onClick={() => handleMarkRead(item._id)}
                              title="Mark as read"
                              className="rounded-md p-1.5 text-emerald-700 hover:bg-emerald-100"
                            >
                              <Check size={14} />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleArchive(item._id)}
                            title="Archive"
                            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-200"
                          >
                            <Archive size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-slate-100 p-3">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate("/notifications");
              }}
              className="w-full rounded-xl bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
