import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  Users,
  RefreshCw,
  UserPlus,
  Building2,
  UserCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  Eye,
} from "lucide-react";
import api from "../../services/api";

const PAGE_SIZE = 10;

const getId = (value) => {
  if (!value) return "";
  return typeof value === "object" ? value._id || "" : value;
};

const getStatusStyle = (status) => {
  const styles = {
    active: "bg-green-100 text-green-700",
    on_leave: "bg-amber-100 text-amber-700",
    inactive: "bg-gray-100 text-gray-600",
    terminated: "bg-red-100 text-red-700",
  };

  return styles[status] || "bg-gray-100 text-gray-600";
};

const formatStatus = (status) => {
  if (!status) return "Unknown";

  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

async function fetchAllPages(endpoint, collectionKey, params = {}) {
  const firstResponse = await api.get(endpoint, {
    params: { ...params, page: 1, limit: 100 },
  });

  const firstData = firstResponse.data?.data;
  const firstItems = firstData?.[collectionKey] || [];
  const totalPages = Number(firstData?.pagination?.totalPages || 1);

  if (totalPages <= 1) return firstItems;

  const remainingResponses = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      api.get(endpoint, {
        params: {
          ...params,
          page: index + 2,
          limit: 100,
        },
      }),
    ),
  );

  return [
    ...firstItems,
    ...remainingResponses.flatMap(
      (response) => response.data?.data?.[collectionKey] || [],
    ),
  ];
}

function EmployeeDirectoryPage() {
  const [employees, setEmployees] = useState([]);
  const [domains, setDomains] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [error, setError] = useState("");

  const loadFilters = useCallback(async () => {
    try {
      setFiltersLoading(true);

      const [domainItems, departmentItems] = await Promise.all([
        fetchAllPages("/domains", "domains", { status: "active" }),
        fetchAllPages("/departments", "departments", { status: "active" }),
      ]);

      setDomains(domainItems.filter((item) => item.status === "active"));
      setDepartments(
        departmentItems.filter((item) => item.status === "active"),
      );
    } catch (err) {
      console.error("Filter loading failed:", err);
      setError(
        err.response?.data?.message || "Unable to load organization filters.",
      );
    } finally {
      setFiltersLoading(false);
    }
  }, []);

  const loadEmployees = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const result = await fetchAllPages("/employees", "employees", {
        search: search || undefined,
        domain: domain || undefined,
        department: department || undefined,
        employmentStatus: status || undefined,
      });

      setEmployees(result);
      setPage(1);
    } catch (err) {
      setEmployees([]);
      setError(err.response?.data?.message || "Unable to load employees.");
    } finally {
      setLoading(false);
    }
  }, [search, domain, department, status]);

  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  // Debounce search so the API is not called on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 400);

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const filteredDepartments = useMemo(() => {
    if (!domain) return departments;

    return departments.filter((item) => getId(item.domain) === domain);
  }, [departments, domain]);

  const activeCount = employees.filter(
    (item) => item.employmentStatus === "active",
  ).length;

  const onLeaveCount = employees.filter(
    (item) => item.employmentStatus === "on_leave",
  ).length;

  const totalPages = Math.max(1, Math.ceil(employees.length / PAGE_SIZE));

  const visibleEmployees = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return employees.slice(startIndex, startIndex + PAGE_SIZE);
  }, [employees, page]);

  const startRecord = employees.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;

  const endRecord = Math.min(page * PAGE_SIZE, employees.length);

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setDomain("");
    setDepartment("");
    setStatus("");
    setPage(1);
  };

  const hasFilters = Boolean(searchInput || domain || department || status);

  const refreshDirectory = () => {
    loadFilters();
    loadEmployees();
  };

  return (
    <main className="min-h-screen bg-[#f3f7f4]">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 bg-white px-5 py-5 sm:px-10">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[#17613b] p-3 text-white">
            <Building2 size={23} />
          </div>

          <div>
            <h1 className="font-bold text-gray-900">Chandra Enterprises</h1>
            <p className="text-xs text-gray-500">Employee Management System</p>
          </div>
        </div>

        <Link
          to="/dashboard"
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft size={16} />
          Dashboard
        </Link>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-green-700">
              Human Resources
            </p>

            <h2 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">
              Employee Directory
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Search and manage employees across company departments.
            </p>
          </div>

          <Link
            to="/employees/new"
            className="flex items-center gap-2 rounded-lg bg-[#17613b] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-800"
          >
            <UserPlus size={17} />
            Add Employee
          </Link>
        </div>

        {error && (
          <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Close error"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {/* Employee statistics */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Total Employees</p>
              <Users className="text-green-700" size={22} />
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">
              {loading ? "—" : employees.length}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Matching current filters
            </p>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Active Employees</p>
              <UserCheck className="text-green-700" size={22} />
            </div>
            <p className="mt-3 text-3xl font-bold text-green-700">
              {loading ? "—" : activeCount}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Active in current results
            </p>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">On Leave</p>
              <CalendarDays className="text-amber-600" size={22} />
            </div>
            <p className="mt-3 text-3xl font-bold text-amber-600">
              {loading ? "—" : onLeaveCount}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Employees currently on leave
            </p>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Departments</p>
              <Building2 className="text-blue-700" size={22} />
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">
              {filtersLoading ? "—" : departments.length}
            </p>
            <p className="mt-1 text-xs text-gray-400">Active departments</p>
          </div>
        </div>

        {/* Directory */}
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-5">
            <div>
              <h3 className="font-bold text-gray-900">All Employees</h3>
              <p className="mt-1 text-xs text-gray-500">
                Employee records and organization assignments
              </p>
            </div>

            <button
              type="button"
              onClick={refreshDirectory}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          {/* Filters */}
          <div className="border-b border-gray-100 bg-gray-50/70 p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Filter size={16} />
              Search and filters
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="relative">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search name, email or code"
                  className="w-full rounded-lg border border-gray-200 bg-white py-3 pl-10 pr-3 text-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100"
                />
              </div>

              <select
                value={domain}
                onChange={(event) => {
                  setDomain(event.target.value);
                  setDepartment("");
                  setPage(1);
                }}
                className="rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-green-700"
              >
                <option value="">All Domains</option>
                {domains.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.name}
                  </option>
                ))}
              </select>

              <select
                value={department}
                onChange={(event) => {
                  setDepartment(event.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-green-700"
              >
                <option value="">All Departments</option>
                {filteredDepartments.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.name}
                    {item.code ? ` (${item.code})` : ""}
                  </option>
                ))}
              </select>

              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-green-700"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="on_leave">On Leave</option>
                <option value="inactive">Inactive</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>

            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-green-800 hover:underline"
              >
                <X size={13} />
                Clear all filters
              </button>
            )}
          </div>

          {/* Employee table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-262.5 text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-5 py-4">Employee</th>
                  <th className="px-4 py-4">Employee Code</th>
                  <th className="px-4 py-4">Domain</th>
                  <th className="px-4 py-4">Department</th>
                  <th className="px-4 py-4">Designation</th>
                  <th className="px-4 py-4">Contact</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4 text-right">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td
                      colSpan="8"
                      className="px-5 py-14 text-center text-gray-500"
                    >
                      <RefreshCw
                        size={22}
                        className="mx-auto mb-3 animate-spin text-green-700"
                      />
                      Loading employee records...
                    </td>
                  </tr>
                ) : visibleEmployees.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-5 py-14 text-center">
                      <Users size={30} className="mx-auto mb-3 text-gray-300" />
                      <p className="font-semibold text-gray-700">
                        No employees found
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Try changing your search or filters.
                      </p>
                    </td>
                  </tr>
                ) : (
                  visibleEmployees.map((employee) => (
                    <tr
                      key={employee._id}
                      className="transition hover:bg-green-50/40"
                    >
                      <td className="px-5 py-4">
                        <Link
                          to={`/employees/${employee._id}`}
                          className="font-semibold text-green-800 hover:underline"
                        >
                          {employee.fullName ||
                            `${employee.firstName || ""} ${employee.lastName || ""}`.trim()}
                        </Link>
                        <p className="mt-1 text-xs text-gray-500">
                          {employee.gender || "Gender not provided"}
                        </p>
                      </td>

                      <td className="px-4 py-4 font-medium text-gray-700">
                        {employee.employeeCode || "—"}
                      </td>

                      <td className="px-4 py-4 text-gray-600">
                        {employee.domain?.name || "—"}
                      </td>

                      <td className="px-4 py-4 text-gray-600">
                        {employee.department?.name || "—"}
                      </td>

                      <td className="px-4 py-4 text-gray-600">
                        {employee.designation || "—"}
                      </td>

                      <td className="px-4 py-4">
                        <p className="text-gray-700">{employee.phone || "—"}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {employee.workEmail || employee.personalEmail || ""}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(employee.employmentStatus)}`}
                        >
                          {formatStatus(employee.employmentStatus)}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-right">
                        <Link
                          to={`/employees/${employee._id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-green-200 px-3 py-2 text-xs font-semibold text-green-800 hover:bg-green-50"
                        >
                          <Eye size={14} />
                          View
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-4">
            <p className="text-xs text-gray-500">
              Showing <strong>{startRecord}</strong>–
              <strong>{endRecord}</strong> of{" "}
              <strong>{employees.length}</strong> employees
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft size={17} />
              </button>

              <span className="min-w-20 text-center text-xs font-medium text-gray-600">
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default EmployeeDirectoryPage;
