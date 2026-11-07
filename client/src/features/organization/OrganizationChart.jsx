import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Users,
  UserRound,
  Network,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronRight,
  UserCog,
  GitBranch,
  AlertCircle,
} from "lucide-react";
import api from "../../services/api";

/* =========================================================
   CHANDRA ENTERPRISES ORGANIZATION CONFIGURATION
========================================================= */

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

const DEPARTMENT_COLORS = [
  {
    header: "bg-emerald-800",
    soft: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-800",
    line: "border-emerald-300",
  },
  {
    header: "bg-blue-800",
    soft: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-800",
    line: "border-blue-300",
  },
  {
    header: "bg-orange-700",
    soft: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-800",
    line: "border-orange-300",
  },
  {
    header: "bg-violet-800",
    soft: "bg-violet-50",
    border: "border-violet-200",
    text: "text-violet-800",
    line: "border-violet-300",
  },
  {
    header: "bg-rose-800",
    soft: "bg-rose-50",
    border: "border-rose-200",
    text: "text-rose-800",
    line: "border-rose-300",
  },
  {
    header: "bg-cyan-800",
    soft: "bg-cyan-50",
    border: "border-cyan-200",
    text: "text-cyan-800",
    line: "border-cyan-300",
  },
  {
    header: "bg-amber-700",
    soft: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-800",
    line: "border-amber-300",
  },
  {
    header: "bg-indigo-800",
    soft: "bg-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-800",
    line: "border-indigo-300",
  },
  {
    header: "bg-teal-800",
    soft: "bg-teal-50",
    border: "border-teal-200",
    text: "text-teal-800",
    line: "border-teal-300",
  },
  {
    header: "bg-pink-800",
    soft: "bg-pink-50",
    border: "border-pink-200",
    text: "text-pink-800",
    line: "border-pink-300",
  },
  {
    header: "bg-slate-700",
    soft: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-800",
    line: "border-slate-300",
  },
];

const DEFAULT_COLOR = {
  header: "bg-emerald-800",
  soft: "bg-emerald-50",
  border: "border-emerald-200",
  text: "text-emerald-800",
  line: "border-emerald-300",
};

const ENGINEERING_CODES = ["ENG", "SWENG", "CIVIL", "ELM"];

/* =========================================================
   HELPERS
========================================================= */

const getId = (value) => {
  if (!value) return "";
  return typeof value === "object" ? value._id || value.id || "" : value;
};

const getResponseData = (response) =>
  response?.data?.data ?? response?.data ?? {};

const getEmployeeName = (employee) => {
  if (!employee) return "Not assigned";

  return (
    employee.fullName ||
    `${employee.firstName || ""} ${employee.lastName || ""}`.trim() ||
    employee.name ||
    "Employee"
  );
};

const getDepartmentColor = (department) => {
  const code = String(department?.code || "").toUpperCase();

  if (ENGINEERING_CODES.includes(code)) {
    const engineeringIndex = DEPARTMENT_ORDER.indexOf("ENG");
    return DEPARTMENT_COLORS[engineeringIndex];
  }

  const index = DEPARTMENT_ORDER.indexOf(code);

  if (index >= 0) {
    return DEPARTMENT_COLORS[index];
  }

  return DEFAULT_COLOR;
};

const sortDepartments = (a, b) => {
  const codeA = String(a.code || "").toUpperCase();
  const codeB = String(b.code || "").toUpperCase();

  const indexA = DEPARTMENT_ORDER.indexOf(codeA);
  const indexB = DEPARTMENT_ORDER.indexOf(codeB);

  const orderA = indexA === -1 ? 999 : indexA;
  const orderB = indexB === -1 ? 999 : indexB;

  return orderA - orderB || a.name.localeCompare(b.name);
};

const isActiveEmployee = (employee) => {
  if (employee.employmentStatus) {
    return employee.employmentStatus === "active";
  }

  if (employee.status) {
    return employee.status === "active";
  }

  if (typeof employee.isActive === "boolean") {
    return employee.isActive;
  }

  return true;
};

/**
 * Loads every page returned by the existing paginated API.
 * This prevents organization chart counts and teams from being
 * silently limited to the first page.
 */
const fetchAllPages = async (endpoint, extraParams = {}) => {
  const limit = 100;

  const firstResponse = await api.get(endpoint, {
    params: {
      ...extraParams,
      page: 1,
      limit,
    },
  });

  const firstData = getResponseData(firstResponse);
  const firstKey = Object.keys(firstData).find((key) =>
    Array.isArray(firstData[key]),
  );

  if (!firstKey) return [];

  const records = [...firstData[firstKey]];
  const totalPages = Number(firstData.pagination?.totalPages || 1);

  if (totalPages <= 1) return records;

  const remainingRequests = [];

  for (let page = 2; page <= totalPages; page += 1) {
    remainingRequests.push(
      api.get(endpoint, {
        params: {
          ...extraParams,
          page,
          limit,
        },
      }),
    );
  }

  const remainingResponses = await Promise.all(remainingRequests);

  remainingResponses.forEach((response) => {
    const data = getResponseData(response);
    const key = Object.keys(data).find((item) => Array.isArray(data[item]));

    if (key) {
      records.push(...data[key]);
    }
  });

  return records;
};

/* =========================================================
   EMPLOYEE CARD
========================================================= */

function EmployeeCard({ employee, color }) {
  const employeeId = getId(employee);

  return (
    <div
      className={`flex min-w-0 items-center justify-between gap-2 rounded-xl border ${color.border} bg-white p-3 shadow-sm`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${color.soft} ${color.text}`}
        >
          <UserRound size={17} />
        </div>

        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-slate-900">
            {getEmployeeName(employee)}
          </p>

          <p className="truncate text-[11px] text-slate-500">
            {employee.designation || employee.position || "Employee"}
          </p>

          {employee.employeeCode && (
            <p className="truncate text-[10px] text-slate-400">
              {employee.employeeCode}
            </p>
          )}
        </div>
      </div>

      {employeeId ? (
        <Link
          to={`/employees/${employeeId}`}
          title={`View ${getEmployeeName(employee)} profile`}
          className={`shrink-0 rounded-lg px-2 py-1.5 text-[10px] font-semibold ${color.soft} ${color.text} hover:opacity-75`}
        >
          View
        </Link>
      ) : (
        <span className="shrink-0 text-[10px] text-slate-400">
          Profile unavailable
        </span>
      )}
    </div>
  );
}

/* =========================================================
   EMPLOYEE REPORTING TREE
========================================================= */

function EmployeeTreeNode({
  employee,
  childrenByManager,
  color,
  visited = new Set(),
  depth = 0,
}) {
  const [expanded, setExpanded] = useState(true);

  const employeeId = getId(employee);
  const isCycle = visited.has(employeeId);
  const children = childrenByManager.get(employeeId) || [];

  const nextVisited = new Set(visited);
  nextVisited.add(employeeId);

  return (
    <div
      className={
        depth > 0 ? `ml-3 border-l-2 ${color.line} pl-3 sm:ml-5 sm:pl-4` : ""
      }
    >
      <EmployeeCard employee={employee} color={color} />

      {isCycle && (
        <p className="mt-2 text-xs text-amber-700">
          Circular reporting relationship detected. This branch was stopped.
        </p>
      )}

      {!isCycle && children.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className={`mb-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold ${color.soft} ${color.text}`}
          >
            <Users size={13} />
            {children.length} Direct Reports
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>

          {expanded && (
            <div className="space-y-2">
              {children.map((child) => (
                <EmployeeTreeNode
                  key={getId(child)}
                  employee={child}
                  childrenByManager={childrenByManager}
                  color={color}
                  visited={nextVisited}
                  depth={depth + 1}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   DEPARTMENT CARD
========================================================= */

function DepartmentNode({ department, employees, allDepartments, color }) {
  const [expanded, setExpanded] = useState(true);

  const childDepartments = allDepartments
    .filter((item) => getId(item.parentDepartment) === getId(department))
    .sort((a, b) => a.name.localeCompare(b.name));

  const departmentEmployees = employees.filter(
    (employee) => getId(employee.department) === getId(department),
  );

  const managerId = getId(department.manager);

  const departmentManager = departmentEmployees.find(
    (employee) => getId(employee) === managerId,
  );

  const populatedManager =
    department.manager && typeof department.manager === "object"
      ? department.manager
      : null;

  const managerToDisplay = departmentManager || populatedManager;

  const reportingData = useMemo(() => {
    const employeeIds = new Set(
      departmentEmployees.map((employee) => getId(employee)),
    );

    const childrenByManager = new Map();
    const roots = [];

    for (const employee of departmentEmployees) {
      const employeeId = getId(employee);

      // The department manager is displayed separately.
      if (employeeId === managerId) continue;

      const reportingManagerId = getId(employee.reportingManager);

      if (
        reportingManagerId &&
        reportingManagerId !== employeeId &&
        employeeIds.has(reportingManagerId)
      ) {
        const currentChildren = childrenByManager.get(reportingManagerId) || [];

        currentChildren.push(employee);
        childrenByManager.set(reportingManagerId, currentChildren);
      } else {
        roots.push(employee);
      }
    }

    const sortByName = (a, b) =>
      getEmployeeName(a).localeCompare(getEmployeeName(b));

    roots.sort(sortByName);

    for (const children of childrenByManager.values()) {
      children.sort(sortByName);
    }

    return {
      roots,
      childrenByManager,
    };
  }, [departmentEmployees, managerId]);

  /*
   * Detect employees not reachable from the manager or normal roots.
   * These may have circular reporting assignments.
   */
  const disconnectedEmployees = useMemo(() => {
    const visited = new Set();

    const visit = (employee) => {
      const id = getId(employee);

      if (!id || visited.has(id)) return;

      visited.add(id);

      const children = reportingData.childrenByManager.get(id) || [];

      children.forEach(visit);
    };

    if (managerToDisplay) {
      visit(managerToDisplay);
    }

    reportingData.roots.forEach(visit);

    return departmentEmployees.filter(
      (employee) => !visited.has(getId(employee)),
    );
  }, [departmentEmployees, managerToDisplay, reportingData]);

  return (
    <section
      className={`flex min-w-67.5 max-w-85 flex-1 flex-col overflow-hidden rounded-2xl border ${color.border} bg-white shadow-sm`}
    >
      {/* Department heading */}
      <div
        className={`${color.header} flex items-center justify-between gap-2 px-4 py-3 text-white`}
      >
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold">{department.name}</h3>

          <p className="mt-0.5 text-[10px] text-white/80">
            {department.code || "Department"}
          </p>
        </div>

        <span className="shrink-0 rounded-full bg-white/20 px-2 py-1 text-[10px] font-semibold">
          {departmentEmployees.length}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3">
        {/* Department manager */}
        <div className={`rounded-xl border ${color.border} ${color.soft} p-3`}>
          <div className="mb-2 flex items-center gap-2">
            <UserCog size={15} className={color.text} />
            <p
              className={`text-[11px] font-bold uppercase tracking-wide ${color.text}`}
            >
              Department Manager
            </p>
          </div>

          {managerToDisplay ? (
            <EmployeeCard employee={managerToDisplay} color={color} />
          ) : (
            <p className="text-xs text-slate-500">Manager not assigned</p>
          )}
        </div>

        {/* Team structure */}
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <span className="inline-flex items-center gap-2">
            <Users size={14} />
            Team structure ({departmentEmployees.length})
          </span>

          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>

        {expanded && (
          <div className="space-y-3">
            {managerToDisplay &&
              (reportingData.childrenByManager.get(managerId) || []).length >
                0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Reporting to department manager
                  </p>

                  {(reportingData.childrenByManager.get(managerId) || []).map(
                    (employee) => (
                      <EmployeeTreeNode
                        key={getId(employee)}
                        employee={employee}
                        childrenByManager={reportingData.childrenByManager}
                        color={color}
                        depth={1}
                      />
                    ),
                  )}
                </div>
              )}

            {reportingData.roots.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Other reporting groups
                </p>

                {reportingData.roots.map((employee) => (
                  <EmployeeTreeNode
                    key={getId(employee)}
                    employee={employee}
                    childrenByManager={reportingData.childrenByManager}
                    color={color}
                  />
                ))}
              </div>
            )}

            {disconnectedEmployees.length > 0 && (
              <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                  <AlertCircle size={12} />
                  Unlinked reporting records
                </p>

                <p className="text-[10px] text-amber-700">
                  These employees may have missing or circular reporting
                  assignments. Review their reporting manager details.
                </p>

                {disconnectedEmployees.map((employee) => (
                  <EmployeeCard
                    key={getId(employee)}
                    employee={employee}
                    color={color}
                  />
                ))}
              </div>
            )}

            {departmentEmployees.length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
                No active employees assigned to this department.
              </p>
            )}
          </div>
        )}

        {/* Engineering sub-departments */}
        {childDepartments.length > 0 && (
          <div className="border-t border-slate-100 pt-3">
            <p className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <GitBranch size={12} />
              Sub-departments
            </p>

            <div className="space-y-3">
              {childDepartments.map((child) => (
                <DepartmentNode
                  key={getId(child)}
                  department={child}
                  employees={employees}
                  allDepartments={allDepartments}
                  color={color}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* =========================================================
   DOMAIN SECTION
========================================================= */

function DomainSection({ domain, departments, employees }) {
  const [expanded, setExpanded] = useState(true);

  const domainDepartments = departments
    .filter((department) => getId(department.domain) === getId(domain))
    .filter((department) => !getId(department.parentDepartment))
    .sort(sortDepartments);

  const domainEmployees = employees.filter(
    (employee) => getId(employee.domain) === getId(domain),
  );

  const engineeringDepartment = domainDepartments.find(
    (department) => String(department.code).toUpperCase() === "ENG",
  );

  const subDepartmentCount = departments.filter(
    (department) =>
      getId(department.domain) === getId(domain) &&
      Boolean(getId(department.parentDepartment)),
  ).length;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Domain heading */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 px-5 py-4 text-white">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-white/10 p-2.5">
            <Building2 size={21} />
          </div>

          <div>
            <h2 className="font-bold">{domain.name}</h2>

            <p className="text-[11px] text-slate-300">
              Domain code: {domain.code || "—"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs">
            {domainDepartments.length} Main Departments
          </span>

          <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs">
            {domainEmployees.length} Employees
          </span>

          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="rounded-lg bg-white/10 p-2 hover:bg-white/20"
            title={expanded ? "Collapse domain" : "Expand domain"}
          >
            {expanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
          </button>
        </div>
      </div>

      {/* Domain head */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Domain Head
          </p>

          {domain.head?._id || domain.head?.id ? (
            <Link
              to={`/employees/${getId(domain.head)}`}
              className="mt-1 inline-block text-sm font-semibold text-slate-800 hover:text-green-700"
            >
              {getEmployeeName(domain.head)}
            </Link>
          ) : (
            <p className="mt-1 text-sm font-medium text-slate-600">
              Domain head not assigned
            </p>
          )}
        </div>

        <Network size={20} className="text-slate-300" />
      </div>

      {expanded && (
        <div className="p-4 md:p-5">
          {domainDepartments.length > 0 ? (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Department-wise Structure
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    Main departments and their employee reporting structures.
                  </p>
                </div>

                <span className="rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800">
                  {subDepartmentCount} Sub-departments
                </span>
              </div>

              <div className="overflow-x-auto pb-3">
                <div className="flex min-w-max items-start gap-4">
                  {domainDepartments.map((department) => (
                    <DepartmentNode
                      key={getId(department)}
                      department={department}
                      employees={employees}
                      allDepartments={departments}
                      color={getDepartmentColor(department)}
                    />
                  ))}
                </div>
              </div>

              {engineeringDepartment && (
                <p className="mt-2 text-[11px] text-slate-500">
                  Engineering includes Software Engineering, Civil Engineering,
                  and Electrical & Maintenance.
                </p>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
              <Users size={28} className="mx-auto mb-2 text-slate-300" />

              <p className="text-sm font-medium text-slate-700">
                No main departments in this domain.
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Add departments in Organization Management to display them here.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* =========================================================
   ORGANIZATION CHART PAGE
========================================================= */

export default function OrganizationChart() {
  const [domains, setDomains] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOrganization = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [domainRecords, departmentRecords, employeeRecords] =
        await Promise.all([
          fetchAllPages("/domains", { status: "active" }),
          fetchAllPages("/departments", { status: "active" }),
          fetchAllPages("/employees", {
            employmentStatus: "active",
          }),
        ]);

      const activeEmployees = employeeRecords.filter(isActiveEmployee);

      setDomains(domainRecords);
      setDepartments(departmentRecords);
      setEmployees(activeEmployees);
    } catch (err) {
      console.error("Organization chart loading error:", err);

      setError(
        err.response?.data?.message ||
          "Unable to load organization chart. Check your permissions and API connection.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrganization();
  }, [loadOrganization]);

  const unassignedEmployees = useMemo(() => {
    const departmentIds = new Set(
      departments.map((department) => getId(department)),
    );

    return employees.filter(
      (employee) =>
        !getId(employee.department) ||
        !departmentIds.has(getId(employee.department)),
    );
  }, [departments, employees]);

  const assignedEmployeeCount = employees.length - unassignedEmployees.length;

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-7">
      <div className="mx-auto max-w-[1800px] space-y-6">
        {/* Page header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              to="/organization"
              className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-green-700"
            >
              <ArrowLeft size={16} />
              Organization
            </Link>

            <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-700">
              Chandra Enterprises
            </p>

            <h1 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">
              Organization Chart
            </h1>

            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Banana Trading & Ripening — domain, department managers,
              sub-departments, and employee reporting relationships.
            </p>
          </div>

          <button
            type="button"
            onClick={loadOrganization}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh Chart
          </button>
        </header>

        {/* Error message */}
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Organization statistics */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Active Domains</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {domains.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">
              Main Departments
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {
                departments.filter(
                  (department) => !getId(department.parentDepartment),
                ).length
              }
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">
              Sub-departments
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {
                departments.filter((department) =>
                  Boolean(getId(department.parentDepartment)),
                ).length
              }
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">
              Active Employees
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {employees.length}
            </p>
            <p className="mt-1 text-[10px] text-slate-400">
              {assignedEmployeeCount} assigned to a department
            </p>
          </div>
        </section>

        {/* Loading state */}
        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">
            <Loader2 size={24} className="animate-spin text-green-700" />
            Loading organization structure...
          </div>
        ) : domains.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <Building2 size={40} className="mx-auto mb-3 text-slate-300" />

            <h2 className="font-semibold text-slate-800">
              No active business domains
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Create an active domain before adding departments and employees.
            </p>

            <Link
              to="/organization/domains"
              className="mt-4 inline-flex rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white hover:bg-green-900"
            >
              Manage Domains
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-900">
                    Company Department Structure
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Scroll horizontally to view all departments. Expand a team
                    to view its reporting tree.
                  </p>
                </div>

                <span className="rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800">
                  Live organization data
                </span>
              </div>
            </div>

            {domains.map((domain) => (
              <DomainSection
                key={getId(domain)}
                domain={domain}
                departments={departments}
                employees={employees}
              />
            ))}

            {/* Employees without valid department assignment */}
            {unassignedEmployees.length > 0 && (
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <h3 className="font-semibold text-amber-900">
                  Employees without a valid department assignment
                </h3>

                <p className="mt-1 text-xs text-amber-800">
                  These active employees are not included in a department
                  column. Review their department assignments.
                </p>

                <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {unassignedEmployees.map((employee) => (
                    <EmployeeCard
                      key={getId(employee)}
                      employee={employee}
                      color={{
                        border: "border-amber-200",
                        soft: "bg-white",
                        text: "text-amber-800",
                        line: "border-amber-300",
                        header: "bg-amber-700",
                      }}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
