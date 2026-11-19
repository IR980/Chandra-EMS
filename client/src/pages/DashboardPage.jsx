import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  ShieldCheck,
  KeyRound,
  Users,
  Network,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  ArrowRight,
  UserCircle,
  BriefcaseBusiness,
  Settings2,
  Wallet,
  Banknote,
  FileBarChart,
  Building2,
} from "lucide-react";

function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

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
  const canViewLeaveBalances = hasPermission("leave.view");

  // Payroll permissions
  const canViewPayroll = hasPermission("payroll.view");
  const canManagePayroll = hasPermission("payroll.manage");
  const canVerifyPayroll = hasPermission("payroll.verify");
  const canApprovePayroll = hasPermission("payroll.approve");

  // Reports permissions
  const canViewReports = hasPermission("reports.view");

  const canAccessPayroll =
    canViewPayroll || canManagePayroll || canVerifyPayroll || canApprovePayroll;

  const modules = [
    {
      title: "Employee Management",
      description:
        "Add employees, manage profiles and view the employee directory.",
      icon: Users,
      color: "bg-blue-50 text-blue-700",
      path: "/employees",
      visible: true,
    },
    {
      title: "Organization Management",
      description:
        "Manage domains, departments, managers and organizational hierarchy.",
      icon: Network,
      color: "bg-purple-50 text-purple-700",
      path: "/organization",
      visible: true,
    },
    {
      title: "My Attendance",
      description:
        "Mark your daily attendance and view your attendance history.",
      icon: CalendarCheck,
      color: "bg-green-50 text-green-700",
      path: "/attendance/me",
      visible: canViewAttendance && canMarkAttendance,
    },
    {
      title: "Attendance Management",
      description:
        "Review employee attendance and create or manage attendance records.",
      icon: ClipboardList,
      color: "bg-amber-50 text-amber-700",
      path: "/attendance",
      visible: canManageAttendance,
    },
    {
      title: "My Leaves",
      description:
        "Apply for leave, check your available leave balance and track application status.",
      icon: CalendarDays,
      color: "bg-teal-50 text-teal-700",
      path: "/leaves/me",
      visible: canViewLeaves && canApplyLeave,
    },
    {
      title: "Leave Management",
      description:
        "Review employee leave applications and approve or reject requests.",
      icon: ClipboardList,
      color: "bg-amber-50 text-amber-700",
      path: "/leaves/management",
      visible: canViewLeaves && canApproveLeaves,
    },
    {
      title: "Leave Policy Management",
      description:
        "Configure annual leave entitlements, working days, holidays and leave rules.",
      icon: Settings2,
      color: "bg-indigo-50 text-indigo-700",
      path: "/leaves/policies",
      visible: canManageLeavePolicy,
    },
    {
      title: "Leave Balance Management",
      description:
        "Monitor employee leave entitlements, used leave and remaining balances.",
      icon: Wallet,
      color: "bg-green-50 text-green-700",
      path: "/leaves/balances",
      visible: canViewLeaveBalances && canApproveLeaves,
    },
    {
      title: "Payroll Management",
      description:
        "Generate monthly payroll, review salaries, verify payments and monitor employee payroll records.",
      icon: Banknote,
      color: "bg-emerald-50 text-emerald-700",
      path: "/payroll",
      visible: canAccessPayroll,
    },
    {
      title: "Reports & Analytics",
      description:
        "View employee, attendance, leave and payroll reports with analytics and CSV exports.",
      icon: FileBarChart,
      color: "bg-emerald-50 text-emerald-700",
      path: "/reports",
      visible: canViewReports,
    },
    {
      title: "Change Password",
      description:
        "Update your account password and manage your login security.",
      icon: KeyRound,
      color: "bg-rose-50 text-rose-700",
      path: "/change-password",
      visible: true,
    },
  ];

  const visibleModules = modules.filter((module) => module.visible);

  return (
    <main className="min-h-[calc(100vh-76px)] bg-[#f4f7f5]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Page introduction */}
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
              Overview
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Welcome to your Chandra Enterprises Employee Management System.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Account {user?.accountStatus || "Active"}
          </div>
        </div>

        {/* Welcome banner */}
        <section className="relative mb-8 overflow-hidden rounded-2xl bg-linear-to-r from-[#123d2b] via-[#17613b] to-[#238451] p-6 text-white shadow-sm sm:p-8">
          <div className="pointer-events-none absolute -right-12 -top-24 h-64 w-64 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -bottom-36 right-36 h-64 w-64 rounded-full border border-white/10" />

          <div className="relative flex flex-wrap items-center justify-between gap-5">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-emerald-50">
                <ShieldCheck size={15} />
                Authentication successful
              </div>

              <h2 className="text-2xl font-bold sm:text-3xl">
                Welcome, {user?.fullName || user?.email || "User"}!
              </h2>

              <p className="mt-2 max-w-xl text-sm leading-6 text-green-50/90">
                Manage your workforce, daily operations, attendance, leave and
                business activities from one centralized platform.
              </p>
            </div>

            <div className="hidden rounded-2xl border border-white/15 bg-white/10 p-5 sm:block">
              <Building2 size={46} />
            </div>
          </div>
        </section>

        {/* Account information */}
        <section className="mb-9">
          <div className="mb-4 flex items-center gap-2">
            <UserCircle size={21} className="text-emerald-700" />
            <h2 className="text-lg font-bold text-slate-900">
              Account Information
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Full Name
              </p>
              <p className="mt-2 wrap-break-word text-sm font-semibold text-slate-900">
                {user?.fullName || "Not available"}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Email Address
              </p>
              <p className="mt-2 break-all text-sm font-semibold text-slate-900">
                {user?.email || "Not available"}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Role
              </p>
              <p className="mt-2 wrap-break-word text-sm font-semibold text-slate-900">
                {user?.role?.name || "Not assigned"}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Account Status
              </p>
              <p className="mt-2 text-sm font-semibold capitalize text-emerald-700">
                {user?.accountStatus || "Active"}
              </p>
            </div>
          </div>
        </section>

        {/* Management modules */}
        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Management Modules
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Access the modules available to your account.
              </p>
            </div>

            <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
              {visibleModules.length} Available Modules
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleModules.map((module) => {
              const Icon = module.icon;

              return (
                <button
                  key={module.path}
                  type="button"
                  onClick={() => navigate(module.path)}
                  className="group flex min-h-52.5 w-full flex-col rounded-2xl border border-slate-200/80 bg-white p-5 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-emerald-100 sm:p-6"
                >
                  <div className="flex w-full items-start justify-between">
                    <div className={`rounded-xl p-3 ${module.color}`}>
                      <Icon size={24} />
                    </div>

                    <ArrowRight
                      size={19}
                      className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-emerald-700"
                    />
                  </div>

                  <h3 className="mt-5 text-base font-bold text-slate-900">
                    {module.title}
                  </h3>

                  <p className="mt-2 flex-1 text-sm leading-6 text-slate-500">
                    {module.description}
                  </p>

                  <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-emerald-800">
                    Open Module
                    <ArrowRight
                      size={15}
                      className="transition group-hover:translate-x-1"
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Account access information */}
        <section className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50/80 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <BriefcaseBusiness
              size={21}
              className="mt-0.5 shrink-0 text-emerald-800"
            />

            <div>
              <h2 className="font-semibold text-emerald-950">
                Your Account Access
              </h2>

              <p className="mt-1 text-sm leading-6 text-emerald-900">
                Your account currently has{" "}
                <strong>
                  {permissions.includes("*") ? "All" : permissions.length}
                </strong>{" "}
                assigned permissions. Available management modules are displayed
                according to your account permissions.
              </p>
            </div>
          </div>
        </section>

        <footer className="mt-9 border-t border-slate-200 py-5 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Chandra Enterprises Agro. Employee
          Management System.
        </footer>
      </div>
    </main>
  );
}

export default DashboardPage;
