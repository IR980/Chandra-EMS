import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  RefreshCw,
  Search,
  Wallet,
  Users,
  CalendarDays,
  Building2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Filter,
  Download,
  Pencil,
  X,
  History,
  Clock3,
} from "lucide-react";
import api from "../../services/api";

const CURRENT_YEAR = new Date().getFullYear();
const PAGE_SIZE = 20;

const LEAVE_TYPES = [
  { value: "", label: "All Leave Types" },
  { value: "casual", label: "Casual Leave" },
  { value: "sick", label: "Sick Leave" },
  { value: "earned", label: "Earned Leave" },
  { value: "unpaid", label: "Unpaid Leave" },
];

const number = (value) => Number(value) || 0;

const formatDays = (value) =>
  `${number(value).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })} days`;

const getId = (value) =>
  typeof value === "object" && value !== null ? value._id : value;

const getLeaveLabel = (value) =>
  LEAVE_TYPES.find((item) => item.value === value)?.label || value || "Unknown";

const leaveBadge = (type) =>
  ({
    casual: "bg-blue-100 text-blue-800",
    sick: "bg-rose-100 text-rose-800",
    earned: "bg-purple-100 text-purple-800",
    unpaid: "bg-amber-100 text-amber-800",
  })[type] || "bg-slate-100 text-slate-700";

function LeaveBalanceManagementPage() {
  const [balances, setBalances] = useState([]);
  const [domains, setDomains] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: PAGE_SIZE,
    totalPages: 1,
  });

  const [filters, setFilters] = useState({
    year: CURRENT_YEAR,
    domain: "",
    department: "",
    leaveType: "",
    search: "",
  });

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedBalance, setSelectedBalance] = useState(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [adjustmentSubmitting, setAdjustmentSubmitting] = useState(false);

  const loadOptions = useCallback(async () => {
    setOptionsLoading(true);

    try {
      const [domainResponse, departmentResponse] = await Promise.all([
        api.get("/domains", {
          params: { page: 1, limit: 100, status: "active" },
        }),
        api.get("/departments", {
          params: { page: 1, limit: 200, status: "active" },
        }),
      ]);

      setDomains(domainResponse.data?.data?.domains || []);
      setDepartments(departmentResponse.data?.data?.departments || []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load domain and department filters.",
      );
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  const loadBalances = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const params = {
        year: filters.year,
        page,
        limit: PAGE_SIZE,
      };

      if (filters.domain) params.domain = filters.domain;
      if (filters.department) params.department = filters.department;
      if (filters.leaveType) params.leaveType = filters.leaveType;

      const response = await api.get("/leaves/balances", { params });
      const data = response.data?.data || {};

      setBalances(data.balances || []);
      setPagination(
        data.pagination || {
          total: 0,
          page,
          limit: PAGE_SIZE,
          totalPages: 1,
        },
      );
    } catch (err) {
      setBalances([]);
      setPagination({
        total: 0,
        page: 1,
        limit: PAGE_SIZE,
        totalPages: 1,
      });
      setError(
        err.response?.data?.message ||
          "Unable to load employee leave balances.",
      );
    } finally {
      setLoading(false);
    }
  }, [
    filters.year,
    filters.domain,
    filters.department,
    filters.leaveType,
    page,
  ]);

  useEffect(() => {
    Promise.resolve().then(() => {
      void loadOptions();
    });
  }, [loadOptions]);

  useEffect(() => {
    Promise.resolve().then(() => {
      void loadBalances();
    });
  }, [loadBalances]);

  const availableDepartments = useMemo(
    () =>
      departments.filter((department) => {
        if (!filters.domain) return true;

        return String(getId(department.domain)) === String(filters.domain);
      }),
    [departments, filters.domain],
  );

  const filteredBalances = useMemo(() => {
    const term = filters.search.trim().toLowerCase();

    if (!term) return balances;

    return balances.filter((balance) => {
      const employee = balance.employee || {};

      return [
        employee.fullName,
        employee.employeeCode,
        employee.designation,
        balance.department?.name,
        balance.domain?.name,
        balance.leaveType,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [balances, filters.search]);

  const summary = useMemo(() => {
    const employeeIds = new Set();
    let totalEntitlement = 0;
    let totalUsed = 0;
    let totalRemaining = 0;

    balances.forEach((balance) => {
      const employeeId = getId(balance.employee);
      if (employeeId) employeeIds.add(String(employeeId));

      totalEntitlement += number(
        balance.totalEntitlement ??
          number(balance.annualEntitlement) +
            number(balance.carriedForward) +
            number(balance.adjustment),
      );

      totalUsed += number(balance.used);

      totalRemaining += number(
        balance.remaining ??
          Math.max(
            0,
            number(balance.annualEntitlement) +
              number(balance.carriedForward) +
              number(balance.adjustment) -
              number(balance.used),
          ),
      );
    });

    return {
      employees: employeeIds.size,
      totalEntitlement,
      totalUsed,
      totalRemaining,
    };
  }, [balances]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "domain" ? { department: "" } : {}),
    }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({
      year: CURRENT_YEAR,
      domain: "",
      department: "",
      leaveType: "",
      search: "",
    });
    setPage(1);
  };

  const exportCsv = () => {
    if (filteredBalances.length === 0) {
      setNotice("There are no displayed records to export.");
      return;
    }

    const headers = [
      "Employee Code",
      "Employee Name",
      "Designation",
      "Domain",
      "Department",
      "Leave Type",
      "Year",
      "Annual Entitlement",
      "Carried Forward",
      "Adjustment",
      "Total Entitlement",
      "Used",
      "Remaining",
    ];

    const rows = filteredBalances.map((balance) => {
      const totalEntitlement =
        balance.totalEntitlement ??
        number(balance.annualEntitlement) +
          number(balance.carriedForward) +
          number(balance.adjustment);

      const remaining =
        balance.remaining ??
        Math.max(0, number(totalEntitlement) - number(balance.used));

      return [
        balance.employee?.employeeCode,
        balance.employee?.fullName,
        balance.employee?.designation,
        balance.domain?.name,
        balance.department?.name,
        balance.leaveType,
        balance.year,
        balance.annualEntitlement,
        balance.carriedForward,
        balance.adjustment,
        totalEntitlement,
        balance.used,
        remaining,
      ];
    });

    const escapeCsv = (value) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `leave-balances-${filters.year}-page-${page}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    setNotice(`Exported ${filteredBalances.length} displayed balance records.`);
  };

  const openAdjustment = (balance) => {
    setSelectedBalance(balance);
    setAdjustmentAmount("");
    setAdjustmentReason("");
    setError("");
    setNotice("");
  };

  const closeAdjustment = () => {
    if (adjustmentSubmitting) return;
    setSelectedBalance(null);
    setAdjustmentAmount("");
    setAdjustmentReason("");
  };

  const submitAdjustment = async (event) => {
    event.preventDefault();
    if (!selectedBalance) return;

    const amount = Number(adjustmentAmount);
    const reason = adjustmentReason.trim();

    if (!Number.isFinite(amount) || amount === 0) {
      setError("Enter a non-zero adjustment amount.");
      return;
    }
    if (Math.abs(amount) > 365 || !Number.isInteger(amount * 2)) {
      setError(
        "Adjustment must be between -365 and 365 days in 0.5-day increments.",
      );
      return;
    }
    if (reason.length < 5 || reason.length > 500) {
      setError("The reason must contain between 5 and 500 characters.");
      return;
    }

    setAdjustmentSubmitting(true);
    setError("");
    setNotice("");

    try {
      await api.post(`/leaves/balances/${selectedBalance._id}/adjust`, {
        amount,
        reason,
      });

      setSelectedBalance(null);
      setAdjustmentAmount("");
      setAdjustmentReason("");
      await loadBalances();
      setNotice(
        `${amount > 0 ? "Added" : "Deducted"} ${formatDays(Math.abs(amount))} ${getLeaveLabel(
          selectedBalance.leaveType,
        )} for ${selectedBalance.employee?.fullName || "the selected employee"}.`,
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to adjust this leave balance. Please try again.",
      );
    } finally {
      setAdjustmentSubmitting(false);
    }
  };

  const totalPages = Math.max(1, pagination.totalPages || 1);

  return (
    <main className="min-h-screen bg-[#f3f7f4] px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              to="/dashboard"
              className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-green-700"
            >
              <ArrowLeft size={16} />
              Dashboard
            </Link>

            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-green-100 p-3 text-green-800">
                <Wallet size={25} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                  Leave Balance Management
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Monitor employee leave entitlements and usage by domain and
                  department.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportCsv}
              disabled={loading || filteredBalances.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Download size={16} />
              Export CSV
            </button>

            <button
              type="button"
              onClick={loadBalances}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </header>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {notice && (
          <div className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            {notice}
          </div>
        )}

        {/* Summary cards */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Employees on This Page",
              value: summary.employees,
              icon: Users,
              color: "bg-blue-50 text-blue-700",
            },
            {
              label: "Total Entitlement",
              value: formatDays(summary.totalEntitlement),
              icon: CalendarDays,
              color: "bg-purple-50 text-purple-700",
            },
            {
              label: "Leave Used",
              value: formatDays(summary.totalUsed),
              icon: Wallet,
              color: "bg-amber-50 text-amber-700",
            },
            {
              label: "Leave Remaining",
              value: formatDays(summary.totalRemaining),
              icon: CheckCircle2,
              color: "bg-green-50 text-green-700",
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <article
                key={item.label}
                className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-500">{item.label}</p>
                  <span className={`rounded-lg p-2 ${item.color}`}>
                    <Icon size={19} />
                  </span>
                </div>
                <p className="mt-3 text-2xl font-bold text-slate-900">
                  {item.value}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Current page results
                </p>
              </article>
            );
          })}
        </section>

        {/* Filters */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Filter size={18} className="text-green-700" />
            <h2 className="font-bold text-slate-900">Filter Leave Balances</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <label className="text-xs font-semibold text-slate-600">
              Policy Year
              <input
                type="number"
                min="2000"
                max="2100"
                value={filters.year}
                onChange={(event) =>
                  updateFilter(
                    "year",
                    Number(event.target.value) || CURRENT_YEAR,
                  )
                }
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-green-600"
              />
            </label>

            <label className="text-xs font-semibold text-slate-600">
              Domain
              <select
                value={filters.domain}
                onChange={(event) => updateFilter("domain", event.target.value)}
                disabled={optionsLoading}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-600"
              >
                <option value="">All accessible domains</option>
                {domains.map((domain) => (
                  <option key={domain._id} value={domain._id}>
                    {domain.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold text-slate-600">
              Department
              <select
                value={filters.department}
                onChange={(event) =>
                  updateFilter("department", event.target.value)
                }
                disabled={optionsLoading}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-600"
              >
                <option value="">All departments</option>
                {availableDepartments.map((department) => (
                  <option key={department._id} value={department._id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold text-slate-600">
              Leave Type
              <select
                value={filters.leaveType}
                onChange={(event) =>
                  updateFilter("leaveType", event.target.value)
                }
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-600"
              >
                {LEAVE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold text-slate-600">
              Search Current Page
              <div className="relative mt-1.5">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="search"
                  value={filters.search}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      search: event.target.value,
                    }))
                  }
                  placeholder="Employee or department"
                  className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-green-600"
                />
              </div>
            </label>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-semibold text-slate-500 hover:text-green-700"
            >
              Clear filters
            </button>
          </div>
        </section>

        {/* Balance records */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
            <div>
              <h2 className="font-bold text-slate-900">
                Employee Leave Balances
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {pagination.total} balance records found for {filters.year}.
              </p>
            </div>

            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-800">
              Page {pagination.page} of {totalPages}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500">
              <Loader2 size={18} className="animate-spin" />
              Loading leave balances...
            </div>
          ) : filteredBalances.length === 0 ? (
            <div className="p-12 text-center">
              <Wallet size={34} className="mx-auto mb-3 text-slate-300" />
              <h3 className="font-semibold text-slate-700">
                No leave balances found
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Try changing the filters or check whether employees have
                initialized leave balances.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-262.5 text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-4">Employee</th>
                      <th className="px-5 py-4">Department</th>
                      <th className="px-5 py-4">Leave Type</th>
                      <th className="px-5 py-4">Annual</th>
                      <th className="px-5 py-4">Carried Forward</th>
                      <th className="px-5 py-4">Adjustment</th>
                      <th className="px-5 py-4">Total</th>
                      <th className="px-5 py-4">Used</th>
                      <th className="px-5 py-4">Remaining</th>
                      <th className="px-5 py-4">Action</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredBalances.map((balance) => {
                      const totalEntitlement =
                        balance.totalEntitlement ??
                        number(balance.annualEntitlement) +
                          number(balance.carriedForward) +
                          number(balance.adjustment);

                      const remaining =
                        balance.remaining ??
                        Math.max(
                          0,
                          number(totalEntitlement) - number(balance.used),
                        );

                      const usedPercentage =
                        number(totalEntitlement) > 0
                          ? Math.min(
                              100,
                              (number(balance.used) /
                                number(totalEntitlement)) *
                                100,
                            )
                          : 0;

                      return (
                        <tr
                          key={balance._id}
                          className="transition hover:bg-slate-50"
                        >
                          <td className="px-5 py-4">
                            <p className="font-semibold text-slate-900">
                              {balance.employee?.fullName ||
                                "Employee unavailable"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {balance.employee?.employeeCode ||
                                "No employee code"}
                            </p>
                            {balance.employee?.designation && (
                              <p className="mt-1 text-xs text-slate-400">
                                {balance.employee.designation}
                              </p>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <p className="font-medium text-slate-800">
                              {balance.department?.name || "—"}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              {balance.domain?.name || "—"}
                            </p>
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${leaveBadge(balance.leaveType)}`}
                            >
                              {getLeaveLabel(balance.leaveType)}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-slate-700">
                            {formatDays(balance.annualEntitlement)}
                          </td>

                          <td className="px-5 py-4 text-slate-700">
                            {formatDays(balance.carriedForward)}
                          </td>

                          <td className="px-5 py-4 text-slate-700">
                            {formatDays(balance.adjustment)}
                          </td>

                          <td className="px-5 py-4 font-semibold text-slate-900">
                            {formatDays(totalEntitlement)}
                          </td>

                          <td className="px-5 py-4">
                            <p className="font-semibold text-amber-700">
                              {formatDays(balance.used)}
                            </p>
                            <div className="mt-2 h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-amber-500"
                                style={{ width: `${usedPercentage}%` }}
                              />
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`font-bold ${
                                number(remaining) > 0
                                  ? "text-green-700"
                                  : "text-red-600"
                              }`}
                            >
                              {formatDays(remaining)}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            {balance.leaveType === "unpaid" ? (
                              <span className="text-xs text-slate-400">
                                Not adjustable
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openAdjustment(balance)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-800 hover:bg-green-100"
                              >
                                <Pencil size={14} />
                                Adjust
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4">
                <p className="text-xs text-slate-500">
                  Showing {filteredBalances.length} records on this page. Search
                  applies to the current page only.
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1 || loading}
                    onClick={() =>
                      setPage((current) => Math.max(1, current - 1))
                    }
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={18} />
                  </button>

                  <span className="px-2 text-sm font-medium text-slate-700">
                    {page} / {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={page >= totalPages || loading}
                    onClick={() =>
                      setPage((current) => Math.min(totalPages, current + 1))
                    }
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Next page"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
          <Building2 size={18} className="mt-0.5 shrink-0" />
          <p>
            Balances are initialized from the employee's active domain leave
            policy. Paid leave usage is deducted when an application is
            approved. Authorized HR users can adjust casual, sick, and earned
            leave balances. Unpaid leave balances cannot be adjusted.
          </p>
        </div>
      </div>

      {selectedBalance && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeAdjustment();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-adjustment-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
              <div>
                <div className="flex items-center gap-2 text-green-700">
                  <Wallet size={19} />
                  <span className="text-xs font-bold uppercase tracking-wide">
                    HR balance control
                  </span>
                </div>
                <h2
                  id="leave-adjustment-title"
                  className="mt-1 text-xl font-bold text-slate-900"
                >
                  Adjust Leave Balance
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedBalance.employee?.fullName || "Employee"} ·{" "}
                  {getLeaveLabel(selectedBalance.leaveType)} ·{" "}
                  {selectedBalance.year}
                </p>
              </div>
              <button
                type="button"
                onClick={closeAdjustment}
                disabled={adjustmentSubmitting}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                aria-label="Close adjustment dialog"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-3 border-b border-slate-100 bg-slate-50 p-5 sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-500">Current adjustment</p>
                <p className="mt-1 font-bold text-slate-900">
                  {formatDays(selectedBalance.adjustment)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Total entitlement</p>
                <p className="mt-1 font-bold text-slate-900">
                  {formatDays(
                    selectedBalance.totalEntitlement ??
                      number(selectedBalance.annualEntitlement) +
                        number(selectedBalance.carriedForward) +
                        number(selectedBalance.adjustment),
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Remaining</p>
                <p className="mt-1 font-bold text-green-700">
                  {formatDays(
                    selectedBalance.remaining ??
                      Math.max(
                        0,
                        number(selectedBalance.annualEntitlement) +
                          number(selectedBalance.carriedForward) +
                          number(selectedBalance.adjustment) -
                          number(selectedBalance.used),
                      ),
                  )}
                </p>
              </div>
            </div>

            {error && (
              <div className="mx-5 mt-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle size={17} className="mt-0.5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={submitAdjustment} className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">
                  Adjustment amount (days)
                  <input
                    type="number"
                    step="0.5"
                    min="-365"
                    max="365"
                    required
                    value={adjustmentAmount}
                    onChange={(event) =>
                      setAdjustmentAmount(event.target.value)
                    }
                    placeholder="Example: 1.5 or -0.5"
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-green-600"
                  />
                  <span className="mt-1 block text-xs font-normal text-slate-500">
                    Positive adds days; negative deducts days. Use 0.5-day
                    increments.
                  </span>
                </label>

                <label className="text-sm font-semibold text-slate-700">
                  Reason (required)
                  <textarea
                    required
                    minLength={5}
                    maxLength={500}
                    rows={3}
                    value={adjustmentReason}
                    onChange={(event) =>
                      setAdjustmentReason(event.target.value)
                    }
                    placeholder="Explain why this correction is required..."
                    className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-green-600"
                  />
                  <span className="mt-1 block text-right text-xs font-normal text-slate-400">
                    {adjustmentReason.length}/500
                  </span>
                </label>
              </div>

              {adjustmentAmount && Number(adjustmentAmount) !== 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  This will {Number(adjustmentAmount) > 0 ? "add" : "deduct"}{" "}
                  <strong>
                    {formatDays(Math.abs(Number(adjustmentAmount)))}
                  </strong>{" "}
                  {getLeaveLabel(selectedBalance.leaveType).toLowerCase()}.
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={closeAdjustment}
                  disabled={adjustmentSubmitting}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    adjustmentSubmitting ||
                    !adjustmentAmount ||
                    Number(adjustmentAmount) === 0 ||
                    adjustmentReason.trim().length < 5
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {adjustmentSubmitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  {adjustmentSubmitting ? "Saving..." : "Save Adjustment"}
                </button>
              </div>
            </form>

            <div className="border-t border-slate-100 p-5">
              <div className="mb-3 flex items-center gap-2">
                <History size={18} className="text-slate-500" />
                <h3 className="font-bold text-slate-900">Adjustment History</h3>
              </div>
              {Array.isArray(selectedBalance.adjustmentHistory) &&
              selectedBalance.adjustmentHistory.length > 0 ? (
                <div className="space-y-3">
                  {[...selectedBalance.adjustmentHistory]
                    .reverse()
                    .map((entry, index) => (
                      <article
                        key={entry._id || `${entry.adjustedAt}-${index}`}
                        className="rounded-xl border border-slate-200 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={`font-bold ${
                              number(entry.amount) >= 0
                                ? "text-green-700"
                                : "text-red-700"
                            }`}
                          >
                            {number(entry.amount) > 0 ? "+" : ""}
                            {formatDays(entry.amount)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                            <Clock3 size={13} />
                            {entry.adjustedAt
                              ? new Date(entry.adjustedAt).toLocaleString(
                                  "en-IN",
                                )
                              : "Date unavailable"}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-700">
                          {entry.reason || "No reason recorded"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Adjusted by:{" "}
                          {entry.adjustedBy?.fullName ||
                            entry.adjustedBy?.name ||
                            "User information unavailable"}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Adjustment: {formatDays(entry.previousAdjustment)} →{" "}
                          {formatDays(entry.newAdjustment)}
                        </p>
                      </article>
                    ))}
                </div>
              ) : (
                <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                  No adjustment history is available for this balance.
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default LeaveBalanceManagementPage;
