import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CalendarCheck,
  CalendarDays,
  Wallet,
  Users,
  FileText,
  Settings,
  Check,
  CheckCheck,
  Archive,
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Clock,
  Inbox,
  LoaderCircle,
} from "lucide-react";

import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  archiveNotification,
} from "../../features/notifications/notificationService";

const CATEGORIES = [
  { value: "", label: "All Categories" },
  { value: "attendance", label: "Attendance" },
  { value: "leave", label: "Leave" },
  { value: "payroll", label: "Payroll" },
  { value: "employee", label: "Employee" },
  { value: "document", label: "Document" },
  { value: "system", label: "System" },
];

const PRIORITIES = [
  { value: "", label: "All Priorities" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const CATEGORY_CONFIG = {
  attendance: {
    label: "Attendance",
    icon: CalendarCheck,
    style: "bg-blue-100 text-blue-700",
  },
  leave: {
    label: "Leave",
    icon: CalendarDays,
    style: "bg-purple-100 text-purple-700",
  },
  payroll: {
    label: "Payroll",
    icon: Wallet,
    style: "bg-emerald-100 text-emerald-700",
  },
  employee: {
    label: "Employee",
    icon: Users,
    style: "bg-orange-100 text-orange-700",
  },
  document: {
    label: "Document",
    icon: FileText,
    style: "bg-indigo-100 text-indigo-700",
  },
  system: {
    label: "System",
    icon: Settings,
    style: "bg-slate-100 text-slate-700",
  },
};

const PRIORITY_STYLES = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700",
};

const PAGE_SIZE = 10;

const formatDate = (value) => {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
};

const formatRelativeTime = (value) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const difference = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(difference / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;

  return formatDate(value);
};

const getErrorMessage = (error) =>
  error.response?.data?.message ||
  error.message ||
  "Unable to load notifications.";

function StatCard({ title, value, icon: Icon, color }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <div className={`rounded-xl p-3 ${color}`}>
          <Icon size={21} />
        </div>
      </div>

      <h3 className="mt-4 text-2xl font-bold text-slate-900">{value}</h3>
    </div>
  );
}

function EmptyState({ unreadOnly }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-16 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
        <Inbox size={30} className="text-slate-400" />
      </div>

      <h3 className="mt-4 text-lg font-semibold text-slate-800">
        {unreadOnly ? "You're all caught up!" : "No notifications yet"}
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        {unreadOnly
          ? "You don't have any unread notifications."
          : "Notifications about attendance, leaves, payroll, employees and documents will appear here."}
      </p>
    </div>
  );
}

function NotificationCard({ notification, busy, onRead, onArchive, onOpen }) {
  const category =
    CATEGORY_CONFIG[notification.category] || CATEGORY_CONFIG.system;

  const CategoryIcon = category.icon;

  const priority = String(notification.priority || "medium").toLowerCase();

  const isUnread = !notification.readAt;

  return (
    <div
      className={`rounded-2xl border p-4 transition sm:p-5 ${
        isUnread
          ? "border-emerald-200 bg-emerald-50/40"
          : "border-slate-100 bg-white"
      }`}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${category.style}`}
        >
          <CategoryIcon size={21} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">
              {notification.title}
            </h3>

            {isUnread && (
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            )}
          </div>

          <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-slate-600">
            {notification.message}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${category.style}`}
            >
              {category.label}
            </span>

            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                PRIORITY_STYLES[priority] || PRIORITY_STYLES.medium
              }`}
            >
              {priority}
            </span>

            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Clock size={13} />
              {formatRelativeTime(notification.createdAt)}
            </span>
          </div>

          <p className="mt-2 text-xs text-slate-400">
            {formatDate(notification.createdAt)}
            {notification.actor?.fullName
              ? ` · By ${notification.actor.fullName}`
              : ""}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {notification.actionUrl && (
              <button
                type="button"
                onClick={() => onOpen(notification)}
                disabled={busy}
                className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
              >
                View Details
              </button>
            )}

            {isUnread && (
              <button
                type="button"
                onClick={() => onRead(notification._id)}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <Check size={14} />
                Mark as read
              </button>
            )}

            <button
              type="button"
              onClick={() => onArchive(notification._id)}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <Archive size={14} />
              Archive
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationCenterPage() {
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });

  const [activeTab, setActiveTab] = useState("all");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [markingAll, setMarkingAll] = useState(false);

  const unreadOnly = activeTab === "unread";

  const loadNotifications = useCallback(
    async ({ showLoader = true } = {}) => {
      if (showLoader) setLoading(true);

      setError("");

      try {
        const result = await getNotifications({
          page: pagination.page,
          limit: PAGE_SIZE,
          unreadOnly: unreadOnly ? "true" : undefined,
          category: category || undefined,
          priority: priority || undefined,
        });

        setNotifications(result.notifications || []);
        setPagination(
          result.pagination || {
            page: 1,
            limit: PAGE_SIZE,
            total: 0,
            totalPages: 1,
          },
        );
        setUnreadCount(Number(result.unreadCount) || 0);
      } catch (requestError) {
        setError(getErrorMessage(requestError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [pagination.page, unreadOnly, category, priority],
  );

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadNotifications({ showLoader: false });
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setPagination((current) => ({ ...current, page: 1 }));
  };

  const handleCategoryChange = (value) => {
    setCategory(value);
    setPagination((current) => ({ ...current, page: 1 }));
  };

  const handlePriorityChange = (value) => {
    setPriority(value);
    setPagination((current) => ({ ...current, page: 1 }));
  };

  const handleMarkRead = async (notificationId) => {
    setBusyId(notificationId);

    try {
      await markNotificationAsRead(notificationId);
      await loadNotifications({ showLoader: false });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusyId("");
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;

    setMarkingAll(true);

    try {
      await markAllNotificationsAsRead();
      await loadNotifications({ showLoader: false });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setMarkingAll(false);
    }
  };

  const handleArchive = async (notificationId) => {
    setBusyId(notificationId);

    try {
      await archiveNotification(notificationId);
      await loadNotifications({ showLoader: false });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusyId("");
    }
  };

  const handleOpenNotification = async (notification) => {
    if (busyId) return;

    let destination = notification.actionUrl;

    // Redirect old and new leave notification URLs to Leave Management.
    if (
      notification.category === "leave" &&
      (destination === "/leaves" || destination === "/leaves/me")
    ) {
      destination = "/leaves/management";
    }

    // Redirect old document notification URLs to Document Verification.
    if (notification.category === "document" && destination === "/documents") {
      destination = "/documents/verification";
    }

    if (
      typeof destination !== "string" ||
      !destination.startsWith("/") ||
      destination.startsWith("//") ||
      destination.includes("\\")
    ) {
      setError("This notification contains an invalid destination.");
      return;
    }

    if (!notification.readAt) {
      setBusyId(notification._id);

      try {
        await markNotificationAsRead(notification._id);
      } catch (requestError) {
        setError(getErrorMessage(requestError));
        setBusyId("");
        return;
      }
    }

    // setOpen?.(false);
    navigate(destination);
  };

  const totalPages = Math.max(1, Number(pagination.totalPages) || 1);
  const totalNotifications = Number(pagination.total) || 0;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Page heading */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="text-emerald-700" size={25} />
            <h1 className="text-2xl font-bold text-slate-900">
              Notification Center
            </h1>
          </div>

          <p className="mt-1 text-sm text-slate-500">
            Stay updated with important activities across Chandra Enterprises.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={markingAll || unreadCount === 0}
            className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {markingAll ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <CheckCheck size={16} />
            )}
            Mark all as read
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          title="Total Notifications"
          value={totalNotifications}
          icon={Bell}
          color="bg-blue-100 text-blue-700"
        />

        <StatCard
          title="Unread Notifications"
          value={unreadCount}
          icon={AlertCircle}
          color="bg-emerald-100 text-emerald-700"
        />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => handleTabChange("all")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            activeTab === "all"
              ? "bg-emerald-700 text-white"
              : "bg-white text-slate-600 hover:bg-slate-100"
          }`}
        >
          All Notifications
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("unread")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            activeTab === "unread"
              ? "bg-emerald-700 text-white"
              : "bg-white text-slate-600 hover:bg-slate-100"
          }`}
        >
          Unread
          {unreadCount > 0 && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                activeTab === "unread"
                  ? "bg-white/20 text-white"
                  : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Filter size={17} className="text-emerald-700" />
          Filter Notifications
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <select
            value={category}
            onChange={(event) => handleCategoryChange(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            {CATEGORIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <select
            value={priority}
            onChange={(event) => handlePriorityChange(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            {PRIORITIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={19} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">{error}</div>
          <button
            type="button"
            onClick={() => setError("")}
            className="text-xs font-semibold underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Notification list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">
            {unreadOnly ? "Unread Notifications" : "Recent Notifications"}
          </h2>

          <span className="text-xs text-slate-500">
            {totalNotifications} notification(s)
          </span>
        </div>

        {loading ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white">
            <LoaderCircle size={32} className="animate-spin text-emerald-700" />
            <p className="mt-3 text-sm text-slate-500">
              Loading notifications...
            </p>
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState unreadOnly={unreadOnly} />
        ) : (
          notifications.map((notification) => (
            <NotificationCard
              key={notification._id}
              notification={notification}
              busy={busyId === notification._id}
              onRead={handleMarkRead}
              onArchive={handleArchive}
              onOpen={handleOpenNotification}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {!loading && totalNotifications > 0 && (
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
          <p className="text-sm text-slate-500">
            Page {pagination.page || 1} of {totalPages}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setPagination((current) => ({
                  ...current,
                  page: Math.max(1, current.page - 1),
                }))
              }
              disabled={(pagination.page || 1) <= 1 || loading}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={16} />
              Previous
            </button>

            <button
              type="button"
              onClick={() =>
                setPagination((current) => ({
                  ...current,
                  page: Math.min(totalPages, current.page + 1),
                }))
              }
              disabled={(pagination.page || 1) >= totalPages || loading}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationCenterPage;
