import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Building2,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Layers3,
  Network,
  RefreshCw,
  ShieldCheck,
  Users,
  UserRound,
  UserCog,
  Workflow,
  Zap,
} from "lucide-react";
import api from "../../services/api";

const PAGE_LIMIT = 100;

const DEPARTMENT_ORDER = [
  "LEG",
  "MKT",
  "SALES",
  "OPS",
  "ACC",
  "TRN",
  "HR",
  "SEC",
  "ENG",
  "HK",
  "TRD",
];

const getId = (value) => {
  if (!value) return "";
  if (typeof value === "object") return String(value._id || value.id || "");
  return String(value);
};

const getName = (value) => {
  if (!value) return "Not assigned";
  if (typeof value === "string") return value;
  return (
    value.fullName ||
    value.name ||
    value.employeeName ||
    value.title ||
    "Not assigned"
  );
};

const isActive = (item) => item?.status === "active";

const formatNumber = (value) =>
  new Intl.NumberFormat("en-IN").format(value || 0);

const getDepartmentOrder = (department) => {
  const code = department?.code?.toUpperCase();
  const index = DEPARTMENT_ORDER.indexOf(code);
  return index === -1 ? 999 : index;
};

const fetchAllPages = async (endpoint, params = {}, collectionKey) => {
  const firstResponse = await api.get(endpoint, {
    params: { ...params, page: 1, limit: PAGE_LIMIT },
  });

  const firstData = firstResponse.data?.data || {};
  const firstItems = firstData[collectionKey] || [];
  const totalPages = Math.max(1, Number(firstData.pagination?.totalPages || 1));

  if (totalPages <= 1) return firstItems;

  const remainingRequests = Array.from({ length: totalPages - 1 }, (_, index) =>
    api.get(endpoint, {
      params: {
        ...params,
        page: index + 2,
        limit: PAGE_LIMIT,
      },
    }),
  );

  const remainingResponses = await Promise.all(remainingRequests);

  return [
    ...firstItems,
    ...remainingResponses.flatMap(
      (response) => response.data?.data?.[collectionKey] || [],
    ),
  ];
};

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = "green",
  loading,
  trend,
}) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    violet: "bg-violet-50 text-violet-700 ring-violet-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div className="absolute -right-7 -top-7 h-24 w-24 rounded-full bg-slate-50 transition group-hover:scale-125" />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            {loading ? "—" : formatNumber(value)}
          </p>
          <p className="mt-2 text-xs text-slate-500">{subtitle}</p>
        </div>

        <div className={`rounded-xl p-3 ring-1 ${tones[tone] || tones.green}`}>
          <Icon size={22} />
        </div>
      </div>

      {trend && (
        <div className="relative mt-4 flex items-center gap-1 text-xs font-semibold text-emerald-700">
          <ArrowUpRight size={14} />
          {trend}
        </div>
      )}
    </div>
  );
}

function ProgressBar({ value, total, color = "bg-emerald-500" }) {
  const percentage = total > 0 ? Math.min((value / total) * 100, 100) : 0;

  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

function OrganizationDashboard() {
  const { user } = useSelector((state) => state.auth);
  const permissions = user?.role?.permissions || [];

  const hasPermission = (permission) =>
    permissions.includes("*") || permissions.includes(permission);

  const canViewDomains = hasPermission("domains.view");
  const canViewDepartments = hasPermission("departments.view");
  const canViewEmployees = hasPermission("employees.view");

  const [domains, setDomains] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOrganization = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const requests = [];

      if (canViewDomains) {
        requests.push(fetchAllPages("/domains", { status: "all" }, "domains"));
      }

      if (canViewDepartments) {
        requests.push(
          fetchAllPages("/departments", { status: "all" }, "departments"),
        );
      }

      if (canViewEmployees) {
        requests.push(fetchAllPages("/employees", {}, "employees"));
      }

      const results = await Promise.all(requests);
      let index = 0;

      setDomains(canViewDomains ? results[index++] : []);
      setDepartments(canViewDepartments ? results[index++] : []);
      setEmployees(canViewEmployees ? results[index++] : []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load organization information. Please refresh and try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [canViewDomains, canViewDepartments, canViewEmployees]);

  useEffect(() => {
    loadOrganization();
  }, [loadOrganization]);

  const activeDomains = useMemo(() => domains.filter(isActive), [domains]);

  const inactiveDomains = domains.length - activeDomains.length;

  const activeDepartments = useMemo(
    () => departments.filter(isActive),
    [departments],
  );

  const inactiveDepartments = departments.length - activeDepartments.length;

  const mainDepartments = useMemo(
    () => departments.filter((item) => !item.parentDepartment),
    [departments],
  );

  const subDepartments = useMemo(
    () => departments.filter((item) => Boolean(item.parentDepartment)),
    [departments],
  );

  const activeEmployees = useMemo(
    () =>
      employees.filter(
        (employee) =>
          employee.employmentStatus === "active" ||
          employee.status === "active",
      ),
    [employees],
  );

  const inactiveEmployees = employees.length - activeEmployees.length;

  const departmentStats = useMemo(() => {
    return departments
      .map((department) => {
        const assignedEmployees = employees.filter(
          (employee) => getId(employee.department) === getId(department),
        );

        const activeAssignedEmployees = assignedEmployees.filter(
          (employee) =>
            employee.employmentStatus === "active" ||
            employee.status === "active",
        );

        return {
          ...department,
          employeeCount: assignedEmployees.length,
          activeEmployeeCount: activeAssignedEmployees.length,
          managerName: getName(department.manager),
        };
      })
      .sort((a, b) => {
        const orderDifference = getDepartmentOrder(a) - getDepartmentOrder(b);

        if (orderDifference !== 0) return orderDifference;
        return a.name.localeCompare(b.name);
      });
  }, [departments, employees]);

  const domainDepartmentCounts = useMemo(() => {
    return domains.map((domain) => ({
      ...domain,
      departmentCount: departments.filter(
        (department) => getId(department.domain) === getId(domain),
      ).length,
      activeDepartmentCount: departments.filter(
        (department) =>
          getId(department.domain) === getId(domain) && isActive(department),
      ).length,
    }));
  }, [domains, departments]);

  const assignedEmployees = employees.filter((employee) =>
    Boolean(getId(employee.department)),
  ).length;

  const unassignedEmployees = Math.max(employees.length - assignedEmployees, 0);

  const totalDepartmentEmployees = departmentStats.reduce(
    (total, department) => total + department.employeeCount,
    0,
  );

  const modules = [
    {
      title: "Business Domains",
      description:
        "Manage company business units, domain details and domain heads.",
      path: "/organization/domains",
      icon: Building2,
      permission: canViewDomains,
      tone: "emerald",
      tag: `${domains.length} domains`,
    },
    {
      title: "Department Management",
      description:
        "Create departments, configure reporting structures and assign managers.",
      path: "/organization/departments",
      icon: Layers3,
      permission: canViewDepartments,
      tone: "blue",
      tag: `${departments.length} departments`,
    },
    {
      title: "Employee Directory",
      description: "Explore employee records and department-wise assignments.",
      path: "/employees",
      icon: Users,
      permission: canViewEmployees,
      tone: "violet",
      tag: `${employees.length} employees`,
    },
    {
      title: "Organization Chart",
      description:
        "Explore the company hierarchy, managers, teams and sub-departments.",
      path: "/organization/chart",
      icon: Network,
      permission: canViewDomains || canViewDepartments || canViewEmployees,
      tone: "amber",
      tag: "Hierarchy view",
    },
  ];

  const toneStyles = {
    emerald: {
      icon: "bg-emerald-50 text-emerald-700",
      hover: "group-hover:border-emerald-300",
      link: "text-emerald-700",
    },
    blue: {
      icon: "bg-blue-50 text-blue-700",
      hover: "group-hover:border-blue-300",
      link: "text-blue-700",
    },
    violet: {
      icon: "bg-violet-50 text-violet-700",
      hover: "group-hover:border-violet-300",
      link: "text-violet-700",
    },
    amber: {
      icon: "bg-amber-50 text-amber-700",
      hover: "group-hover:border-amber-300",
      link: "text-amber-700",
    },
  };

  return (
    <main className="min-h-screen bg-[#f5f8f6]">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#17613b] text-white shadow-sm">
              <BriefcaseBusiness size={23} />
            </div>

            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-900">
                Chandra Enterprises
              </h1>
              <p className="text-xs text-slate-500">
                Employee Management System
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Organization Workspace
            </div>

            <Link
              to="/dashboard"
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
            >
              Main Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] space-y-8 px-5 py-7 sm:px-8 lg:py-9">
        {/* Page heading */}
        <section className="relative overflow-hidden rounded-3xl bg-linear-to-r from-[#10472f] via-[#17613b] to-[#218451] p-6 text-white shadow-lg sm:p-9">
          <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full border-35 border-white/5" />
          <div className="pointer-events-none absolute -bottom-28 right-48 h-64 w-64 rounded-full border-30 border-white/5" />

          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-emerald-50">
                <Activity size={14} />
                COMPANY ADMINISTRATION
              </div>

              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                Organization Overview
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50/90 sm:text-base">
                A centralized view of Chandra Enterprises&apos; business domain,
                department hierarchy, workforce and organizational structure.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  to="/organization/chart"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#17613b] shadow-sm transition hover:bg-emerald-50"
                >
                  <Network size={17} />
                  View Organization Chart
                  <ArrowRight size={16} />
                </Link>

                <span className="inline-flex items-center gap-2 text-xs font-medium text-emerald-50/90">
                  <ShieldCheck size={15} />
                  Role-based access enabled
                </span>
              </div>
            </div>

            <div className="relative hidden min-w-52 rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm md:block">
              <p className="text-xs font-medium text-emerald-50/80">
                Organization structure
              </p>
              <p className="mt-2 text-4xl font-bold">11 + 3</p>
              <p className="mt-1 text-xs text-emerald-50/80">
                Main and sub-departments
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-emerald-50">
                <CheckCircle2 size={15} />
                Department framework configured
              </div>
            </div>
          </div>
        </section>

        {/* Error message */}
        {error && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="flex items-center gap-2">
              <CircleAlert size={18} />
              {error}
            </div>
            <button
              onClick={loadOrganization}
              className="font-semibold underline underline-offset-4"
            >
              Try again
            </button>
          </div>
        )}

        {/* Statistics */}
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
                Organization at a glance
              </p>
              <h3 className="mt-1 text-xl font-bold text-slate-900">
                Workforce & Structure
              </h3>
            </div>

            <button
              onClick={loadOrganization}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              Refresh data
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Business Domains"
              value={domains.length}
              subtitle={`${activeDomains.length} active · ${inactiveDomains} inactive`}
              icon={Building2}
              tone="green"
              loading={loading}
            />

            <StatCard
              title="Total Departments"
              value={departments.length}
              subtitle={`${mainDepartments.length} main · ${subDepartments.length} sub-departments`}
              icon={Network}
              tone="blue"
              loading={loading}
            />

            <StatCard
              title="Total Employees"
              value={employees.length}
              subtitle={`${activeEmployees.length} active · ${inactiveEmployees} inactive`}
              icon={Users}
              tone="violet"
              loading={loading}
            />

            <StatCard
              title="Active Departments"
              value={activeDepartments.length}
              subtitle={`${inactiveDepartments} inactive departments`}
              icon={ShieldCheck}
              tone="amber"
              loading={loading}
            />
          </div>
        </section>

        {/* Organization health */}
        <section className="grid gap-5 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Workforce overview
                </p>
                <h3 className="mt-1 text-lg font-bold text-slate-900">
                  Employee distribution
                </h3>
              </div>
              <Users size={21} className="text-slate-400" />
            </div>

            {canViewEmployees ? (
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <div>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-3xl font-bold text-slate-900">
                        {loading ? "—" : formatNumber(activeEmployees.length)}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Active employees
                      </p>
                    </div>
                    <span className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700">
                      {employees.length
                        ? `${Math.round((activeEmployees.length / employees.length) * 100)}%`
                        : "0%"}
                    </span>
                  </div>
                  <div className="mt-4">
                    <ProgressBar
                      value={activeEmployees.length}
                      total={employees.length}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-3xl font-bold text-slate-900">
                        {loading ? "—" : formatNumber(unassignedEmployees)}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Unassigned employees
                      </p>
                    </div>
                    <span className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-700">
                      {employees.length
                        ? `${Math.round((unassignedEmployees / employees.length) * 100)}%`
                        : "0%"}
                    </span>
                  </div>
                  <div className="mt-4">
                    <ProgressBar
                      value={unassignedEmployees}
                      total={employees.length}
                      color="bg-amber-500"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-5 text-sm text-slate-500">
                You do not have permission to view employee statistics.
              </p>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3 border-t border-slate-100 pt-5">
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-slate-500">
                  <UserRound size={16} />
                  <span className="text-xs font-medium">
                    Assigned employees
                  </span>
                </div>
                <p className="mt-2 text-xl font-bold text-slate-900">
                  {loading ? "—" : formatNumber(assignedEmployees)}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-slate-500">
                  <Clock3 size={16} />
                  <span className="text-xs font-medium">
                    Inactive employees
                  </span>
                </div>
                <p className="mt-2 text-xl font-bold text-slate-900">
                  {loading ? "—" : formatNumber(inactiveEmployees)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Structure health
                </p>
                <h3 className="mt-1 text-lg font-bold text-slate-900">
                  Department status
                </h3>
              </div>
              <Activity size={21} className="text-slate-400" />
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium text-slate-600">
                    Active departments
                  </span>
                  <span className="font-bold text-emerald-700">
                    {loading ? "—" : activeDepartments.length}
                  </span>
                </div>
                <ProgressBar
                  value={activeDepartments.length}
                  total={departments.length}
                />
              </div>

              <div>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium text-slate-600">
                    Inactive departments
                  </span>
                  <span className="font-bold text-amber-700">
                    {loading ? "—" : inactiveDepartments}
                  </span>
                </div>
                <ProgressBar
                  value={inactiveDepartments}
                  total={departments.length}
                  color="bg-amber-500"
                />
              </div>

              <div>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium text-slate-600">
                    Main departments
                  </span>
                  <span className="font-bold text-blue-700">
                    {loading ? "—" : mainDepartments.length}
                  </span>
                </div>
                <ProgressBar
                  value={mainDepartments.length}
                  total={departments.length}
                  color="bg-blue-500"
                />
              </div>

              <div>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium text-slate-600">
                    Sub-departments
                  </span>
                  <span className="font-bold text-violet-700">
                    {loading ? "—" : subDepartments.length}
                  </span>
                </div>
                <ProgressBar
                  value={subDepartments.length}
                  total={departments.length}
                  color="bg-violet-500"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Domain overview */}
        {canViewDomains && (
          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Business structure
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">
                  Domain overview
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Business domains and their department coverage.
                </p>
              </div>

              <Link
                to="/organization/domains"
                className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-900"
              >
                Manage domains <ChevronRight size={16} />
              </Link>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                Loading domain information...
              </div>
            ) : domainDepartmentCounts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                No business domains found.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {domainDepartmentCounts.map((domain) => (
                  <div
                    key={getId(domain)}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                        <Building2 size={22} />
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          isActive(domain)
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {domain.status || "Unknown"}
                      </span>
                    </div>

                    <h4 className="mt-4 font-bold text-slate-900">
                      {domain.name}
                    </h4>
                    <p className="mt-1 text-xs font-semibold tracking-wider text-slate-400">
                      {domain.code || "NO CODE"}
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">Departments</p>
                        <p className="mt-1 text-xl font-bold text-slate-900">
                          {domain.departmentCount}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">Active</p>
                        <p className="mt-1 text-xl font-bold text-emerald-700">
                          {domain.activeDepartmentCount}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
                      <UserCog size={15} />
                      <span>Domain head: {getName(domain.head)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Department-wise employee distribution */}
        {canViewDepartments && (
          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  People by department
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">
                  Department-wise workforce
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Employee strength and manager assignment across departments.
                </p>
              </div>

              <Link
                to="/organization/departments"
                className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-900"
              >
                Manage departments <ChevronRight size={16} />
              </Link>
            </div>

            {!canViewEmployees ? (
              <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
                Employee permission is required to view department-wise
                workforce counts.
              </div>
            ) : loading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                Loading department workforce...
              </div>
            ) : departmentStats.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                No departments found.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-190 text-left">
                    <thead className="bg-slate-50">
                      <tr className="text-xs uppercase tracking-wider text-slate-500">
                        <th className="px-5 py-4 font-semibold">Department</th>
                        <th className="px-5 py-4 font-semibold">Manager</th>
                        <th className="px-5 py-4 font-semibold">Employees</th>
                        <th className="px-5 py-4 font-semibold">
                          Active staff
                        </th>
                        <th className="px-5 py-4 font-semibold">Status</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {departmentStats.map((department) => (
                        <tr
                          key={getId(department)}
                          className="transition hover:bg-slate-50/80"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                                {department.parentDepartment ? (
                                  <Layers3 size={17} />
                                ) : (
                                  <Building2 size={17} />
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-900">
                                  {department.name}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-400">
                                  {department.code}
                                  {department.parentDepartment
                                    ? " · Sub-department"
                                    : " · Main department"}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <UserRound size={15} className="text-slate-400" />
                              {department.managerName}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <span className="font-bold text-slate-900">
                              {department.employeeCount}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <span className="w-6 text-sm font-semibold text-emerald-700">
                                {department.activeEmployeeCount}
                              </span>
                              <div className="w-20">
                                <ProgressBar
                                  value={department.activeEmployeeCount}
                                  total={department.employeeCount}
                                />
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                isActive(department)
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {department.status || "Unknown"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3 text-xs text-slate-500">
                  <span>
                    {departmentStats.length} departments ·{" "}
                    {totalDepartmentEmployees} department assignments
                  </span>
                  <span>
                    Counts are based on loaded employee department assignments.
                  </span>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Quick access modules */}
        <section>
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Workspace navigation
            </p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">
              Organization modules
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Open a module to manage your company structure.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {modules
              .filter((module) => module.permission)
              .map((module) => {
                const Icon = module.icon;
                const tone = toneStyles[module.tone];

                return (
                  <Link
                    key={module.title}
                    to={module.path}
                    className={`group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg ${tone.hover}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className={`rounded-xl p-3 ${tone.icon}`}>
                        <Icon size={23} />
                      </div>
                      <ArrowUpRight
                        size={19}
                        className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-emerald-700"
                      />
                    </div>

                    <h4 className="mt-5 font-bold text-slate-900">
                      {module.title}
                    </h4>

                    <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">
                      {module.description}
                    </p>

                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
                      <span className="text-xs font-medium text-slate-400">
                        {module.tag}
                      </span>
                      <span className={`text-xs font-bold ${tone.link}`}>
                        Open module{" "}
                        <ArrowRight className="ml-1 inline" size={14} />
                      </span>
                    </div>
                  </Link>
                );
              })}
          </div>
        </section>

        {/* Access control footer */}
        <section className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white p-2.5 text-emerald-700 shadow-sm">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h4 className="font-bold text-emerald-950">
                Organization access control
              </h4>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-emerald-800">
                Organization modules use role-based permissions. Users can
                access only the modules authorized for their assigned roles.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-emerald-800">
            <Zap size={14} />
            Secure workspace
          </div>
        </section>
      </div>
    </main>
  );
}

export default OrganizationDashboard;
