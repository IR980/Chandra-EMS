import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import {
  Building2,
  LayoutDashboard,
  Users,
  Network,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  Bell,
  Wallet,
  Banknote,
  FileBarChart,
  FileCheck,
  KeyRound,
  Settings,
  LogOut,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
} from "lucide-react";

import { logoutUser } from "../../features/auth/authSlice";
import NotificationBell from "../../features/notifications/NotificationBell";

function SidebarLink({ item, collapsed, onNavigate }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.path}
      end={item.path === "/dashboard"}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        `group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
          isActive
            ? "bg-emerald-500/20 text-white shadow-sm ring-1 ring-emerald-400/20"
            : "text-emerald-100/75 hover:bg-white/10 hover:text-white"
        } ${collapsed ? "justify-center" : ""}`
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={19}
            className={`shrink-0 ${
              isActive ? "text-emerald-300" : "text-emerald-100/70"
            }`}
          />

          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>

              {isActive && (
                <ChevronRight size={15} className="shrink-0 text-emerald-300" />
              )}
            </>
          )}
        </>
      )}
    </NavLink>
  );
}

function AppLayout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const { user } = useSelector((state) => state.auth);

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const permissions = Array.isArray(user?.role?.permissions)
    ? user.role.permissions
    : [];

  const hasPermission = (permission) =>
    permissions.includes("*") || permissions.includes(permission);

  // Attendance permissions
  const canViewAttendance = hasPermission("attendance.view");
  const canMarkAttendance = hasPermission("attendance.mark");

  const canManageAttendance =
    canViewAttendance && ["global", "assigned"].includes(user?.role?.scope);

  // Leave permissions
  const canViewLeaves = hasPermission("leave.view");
  const canApplyLeave = hasPermission("leave.apply");
  const canApproveLeaves = hasPermission("leave.approve");
  const canManageLeavePolicy = hasPermission("leave.manage");

  // Payroll permissions
  const canAccessPayroll =
    hasPermission("payroll.view") ||
    hasPermission("payroll.manage") ||
    hasPermission("payroll.verify") ||
    hasPermission("payroll.approve");

  // Other permissions
  const canViewReports = hasPermission("reports.view");
  const canViewNotifications = hasPermission("notifications.view");
  const canVerifyDocuments = hasPermission("documents.verify");

  // Sidebar navigation
  const navigationGroups = [
    {
      title: "OVERVIEW",
      items: [
        {
          label: "Dashboard",
          path: "/dashboard",
          icon: LayoutDashboard,
          visible: true,
        },
      ],
    },
    {
      title: "WORKFORCE MANAGEMENT",
      items: [
        {
          label: "Employees",
          path: "/employees",
          icon: Users,
          visible: true,
        },
        {
          label: "My Attendance",
          path: "/attendance/me",
          icon: CalendarCheck,
          visible: canViewAttendance && canMarkAttendance,
        },
        {
          label: "Attendance Management",
          path: "/attendance",
          icon: ClipboardList,
          visible: canManageAttendance,
        },
        {
          label: "My Leaves",
          path: "/leaves/me",
          icon: CalendarDays,
          visible: canViewLeaves && canApplyLeave,
        },
        {
          label: "Leave Management",
          path: "/leaves/management",
          icon: ClipboardList,
          visible: canViewLeaves && canApproveLeaves,
        },
        {
          label: "Leave Balances",
          path: "/leaves/balances",
          icon: Wallet,
          visible: canViewLeaves && canApproveLeaves,
        },
        {
          label: "Leave Policies",
          path: "/leaves/policies",
          icon: Settings,
          visible: canManageLeavePolicy,
        },
        {
          label: "Document Verification",
          path: "/documents/verification",
          icon: FileCheck,
          visible: canVerifyDocuments,
        },
      ],
    },
    {
      title: "ORGANIZATION",
      items: [
        {
          label: "Organization",
          path: "/organization",
          icon: Network,
          visible: true,
        },
      ],
    },
    {
      title: "FINANCE",
      items: [
        {
          label: "Payroll Management",
          path: "/payroll",
          icon: Banknote,
          visible: canAccessPayroll,
        },
      ],
    },
    {
      title: "ANALYTICS",
      items: [
        {
          label: "Reports & Analytics",
          path: "/reports",
          icon: FileBarChart,
          visible: canViewReports,
        },
      ],
    },
    {
      title: "COMMUNICATION",
      items: [
        {
          label: "Notifications",
          path: "/notifications",
          icon: Bell,
          visible: canViewNotifications,
        },
      ],
    },
    {
      title: "ACCOUNT",
      items: [
        {
          label: "Change Password",
          path: "/change-password",
          icon: KeyRound,
          visible: true,
        },
      ],
    },
  ];

  // Page titles
  const pageTitles = {
    "/dashboard": "Dashboard",
    "/employees": "Employee Management",
    "/employees/new": "Add Employee",
    "/attendance": "Attendance Management",
    "/attendance/me": "My Attendance",
    "/organization": "Organization Management",
    "/leaves/me": "My Leaves",
    "/leaves/management": "Leave Management",
    "/leaves/balances": "Leave Balance Management",
    "/leaves/policies": "Leave Policy Management",
    "/payroll": "Payroll Management",
    "/reports": "Reports & Analytics",
    "/notifications": "Notifications",
    "/change-password": "Change Password",
    "/documents/verification": "Document Verification",
  };

  const currentTitle =
    pageTitles[location.pathname] ||
    (location.pathname.startsWith("/employees/")
      ? "Employee Profile"
      : location.pathname.startsWith("/payroll/")
        ? "Payroll Details"
        : "Employee Management System");

  // Logout
  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await dispatch(logoutUser()).unwrap();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
      setLoggingOut(false);
    }
  };

  // Filter visible navigation items
  const visibleGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.visible),
    }))
    .filter((group) => group.items.length > 0);

  const sidebarWidth = collapsed ? "lg:w-[88px]" : "lg:w-[280px]";
  const contentOffset = collapsed ? "lg:ml-[88px]" : "lg:ml-[280px]";

  return (
    <div className="min-h-screen bg-[#f4f7f5]">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-[2px] lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-70 flex-col border-r border-white/10 bg-[#102f23] text-white shadow-2xl transition-all duration-300 ${sidebarWidth} ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand */}
        <div className="flex h-19 shrink-0 items-center justify-between border-b border-white/10 px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#123d2b] shadow-lg">
              <Building2 size={23} />
            </div>

            {!collapsed && (
              <div className="min-w-0">
                <h1 className="truncate text-sm font-bold tracking-wide">
                  CHANDRA ENTERPRISES
                </h1>
                <p className="mt-0.5 text-[10px] tracking-wide text-emerald-200/70">
                  EMPLOYEE MANAGEMENT SYSTEM
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-2 text-emerald-100 hover:bg-white/10 lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>
        </div>

        {/* Collapse control */}
        <div className="hidden justify-end px-4 pt-4 lg:flex">
          <button
            type="button"
            onClick={() => setCollapsed((previous) => !previous)}
            className="rounded-lg p-2 text-emerald-100/70 transition hover:bg-white/10 hover:text-white"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {visibleGroups.map((group) => (
            <div key={group.title}>
              {!collapsed && (
                <p className="mb-2 px-3 text-[10px] font-bold tracking-[0.16em] text-emerald-200/50">
                  {group.title}
                </p>
              )}

              <div className="space-y-1">
                {group.items.map((item) => (
                  <SidebarLink
                    key={item.path}
                    item={item}
                    collapsed={collapsed}
                    onNavigate={() => setMobileOpen(false)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div className="shrink-0 border-t border-white/10 p-4">
          {!collapsed ? (
            <div className="flex items-center gap-3 rounded-xl bg-white/6 p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-bold text-emerald-200">
                {(user?.fullName || user?.email || "U").charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {user?.fullName || "EMS User"}
                </p>
                <p className="truncate text-xs text-emerald-100/60">
                  {user?.role?.name || "Employee"}
                </p>
              </div>
            </div>
          ) : (
            <div
              className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-bold text-emerald-200"
              title={user?.fullName || "EMS User"}
            >
              {(user?.fullName || user?.email || "U").charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div
        className={`min-h-screen transition-all duration-300 ${contentOffset}`}
      >
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-19 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 shadow-sm backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-xl border border-slate-200 p-2.5 text-slate-600 transition hover:bg-slate-50 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>

            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                CHANDRA ENTERPRISES / EMS
              </p>
              <h2 className="truncate text-lg font-bold text-slate-900 sm:text-xl">
                {currentTitle}
              </h2>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {canViewNotifications && <NotificationBell />}

            <div className="hidden text-right sm:block">
              <p className="max-w-45 truncate text-sm font-semibold text-slate-800">
                {user?.fullName || "EMS User"}
              </p>
              <p className="text-xs text-slate-500">
                {user?.role?.name || "Employee"}
              </p>
            </div>

            <div className="hidden h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800 sm:flex">
              {(user?.fullName || user?.email || "U").charAt(0).toUpperCase()}
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut size={17} />
              <span className="hidden sm:inline">
                {loggingOut ? "Logging out..." : "Logout"}
              </span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default AppLayout;
