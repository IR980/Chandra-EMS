import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  LogOut,
  ShieldCheck,
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
} from "lucide-react";
import { logoutUser } from "../features/auth/authSlice";

function DashboardPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { user } = useSelector((state) => state.auth);
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
  const canViewLeaveBalances = hasPermission("leave.view");

  // Payroll permissions
  const canViewPayroll = hasPermission("payroll.view");
  const canManagePayroll = hasPermission("payroll.manage");
  const canVerifyPayroll = hasPermission("payroll.verify");
  const canApprovePayroll = hasPermission("payroll.approve");

  const canAccessPayroll =
    canViewPayroll || canManagePayroll || canVerifyPayroll || canApprovePayroll;

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
  ];

  const visibleModules = modules.filter((module) => module.visible);

  return (
    <main className="min-h-screen bg-[#f3f7f4]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white px-4 py-4 shadow-sm sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#17613b] p-3 text-white">
              <Building2 size={23} />
            </div>

            <div>
              <h1 className="font-bold text-gray-900">Chandra Enterprises</h1>
              <p className="text-xs text-gray-500">
                Employee Management System
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut size={17} />
            {loggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
        {/* Welcome Section */}
        <div className="mb-8 overflow-hidden rounded-2xl bg-linear-to-r from-[#17613b] to-[#238451] p-6 text-white shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                <ShieldCheck size={15} />
                Authentication successful
              </div>

              <h2 className="text-2xl font-bold sm:text-3xl">
                Welcome, {user?.fullName || user?.email || "User"}!
              </h2>

              <p className="mt-2 max-w-xl text-sm text-green-50">
                Welcome to the Chandra Enterprises Employee Management System.
                Manage your work activities from one place.
              </p>
            </div>

            <div className="hidden rounded-2xl bg-white/15 p-5 sm:block">
              <Building2 size={48} />
            </div>
          </div>
        </div>

        {/* User Information */}
        <section className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <UserCircle size={21} className="text-green-700" />
            <h3 className="text-lg font-bold text-slate-900">
              Account Information
            </h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Full Name</p>
              <p className="mt-2 font-semibold text-slate-900">
                {user?.fullName || "Not available"}
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Email</p>
              <p className="mt-2 break-all font-semibold text-slate-900">
                {user?.email || "Not available"}
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Role</p>
              <p className="mt-2 font-semibold text-slate-900">
                {user?.role?.name || "Not assigned"}
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Account Status</p>
              <p className="mt-2 font-semibold capitalize text-green-700">
                {user?.accountStatus || "Active"}
              </p>
            </div>
          </div>
        </section>

        {/* Management Modules */}
        <section>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                Management Modules
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Access the modules available to your account.
              </p>
            </div>

            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
              {visibleModules.length} Available Modules
            </span>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {visibleModules.map((module) => {
              const Icon = module.icon;

              return (
                <button
                  key={module.path}
                  onClick={() => navigate(module.path)}
                  className="group flex w-full flex-col rounded-2xl border border-slate-100 bg-white p-6 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-green-200 hover:shadow-md"
                >
                  <div className="flex w-full items-start justify-between">
                    <div className={`rounded-xl p-3 ${module.color}`}>
                      <Icon size={25} />
                    </div>

                    <ArrowRight
                      size={19}
                      className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-green-700"
                    />
                  </div>

                  <h4 className="mt-5 text-lg font-bold text-slate-900">
                    {module.title}
                  </h4>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {module.description}
                  </p>

                  <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-green-800">
                    Open Module
                    <ArrowRight size={15} />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Access Information */}
        <section className="mt-8 rounded-xl border border-green-100 bg-green-50 p-5">
          <div className="flex items-start gap-3">
            <BriefcaseBusiness size={21} className="mt-0.5 text-green-800" />

            <div>
              <h4 className="font-semibold text-green-900">
                Your Account Access
              </h4>

              <p className="mt-1 text-sm text-green-800">
                Your account currently has{" "}
                <strong>
                  {permissions.includes("*") ? "All" : permissions.length}
                </strong>{" "}
                assigned permissions. Available modules are displayed according
                to your account permissions.
              </p>
            </div>
          </div>
        </section>

        <footer className="mt-10 border-t border-slate-200 py-5 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Chandra Enterprises Agro. Employee
          Management System.
        </footer>
      </section>
    </main>
  );
}

export default DashboardPage;
