import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  LoaderCircle,
  Plus,
  RefreshCw,
  Wallet,
  XCircle,
  Users,
  Search,
} from "lucide-react";
import api from "../../services/api";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const getIndiaDateParts = () => {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
  };
};

const todayIndia = getIndiaDateParts();

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);

const getErrorMessage = (error) =>
  error.response?.data?.message ||
  error.message ||
  "Something went wrong. Please try again.";

const getEmployeeName = (employee) =>
  employee?.fullName ||
  [employee?.firstName, employee?.lastName].filter(Boolean).join(" ") ||
  "Employee";

const isMonthCompleted = (month, year) =>
  year < todayIndia.year ||
  (year === todayIndia.year && month < todayIndia.month);

function StatCard({ title, value, subtitle, icon: Icon, color }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <div className={`rounded-xl p-3 ${color}`}>
          <Icon size={21} />
        </div>
      </div>
      <h3 className="mt-4 text-2xl font-bold text-slate-900">{value}</h3>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    draft: "bg-slate-100 text-slate-700",
    verified: "bg-blue-100 text-blue-700",
    approved: "bg-green-100 text-green-700",
    paid: "bg-emerald-100 text-emerald-800",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${
        styles[status] || "bg-slate-100 text-slate-700"
      }`}
    >
      {(status || "Unknown").replaceAll("_", " ")}
    </span>
  );
}

export default function PayrollDashboardPage() {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  const permissions = user?.role?.permissions || [];
  const hasAllPermissions = permissions.includes("*");

  const canViewPayroll =
    hasAllPermissions || permissions.includes("payroll.view");
  const canManagePayroll =
    hasAllPermissions || permissions.includes("payroll.manage");

  const [month, setMonth] = useState(todayIndia.month);
  const [year, setYear] = useState(todayIndia.year);
  const [status, setStatus] = useState("");

  const [payrolls, setPayrolls] = useState([]);
  const [pagination, setPagination] = useState(null);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const completedMonth = isMonthCompleted(month, year);

  const loadPayrolls = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = {
        payrollMonth: Number(month),
        payrollYear: Number(year),
        page: 1,
        limit: 100,
      };

      if (status) params.status = status;

      const response = await api.get("/payroll", { params });
      const data = response.data?.data || {};
      const records = data.payrolls || data.records || [];

      setPayrolls(Array.isArray(records) ? records : []);
      setPagination(data.pagination || null);
    } catch (err) {
      setPayrolls([]);
      setPagination(null);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [month, year, status]);

  useEffect(() => {
    loadPayrolls();
  }, [loadPayrolls]);

  const summary = useMemo(
    () =>
      payrolls.reduce(
        (result, payroll) => {
          result.gross += Number(payroll.grossPay || 0);
          result.deductions += Number(payroll.totalDeductions || 0);
          result.net += Number(payroll.netPay || 0);
          result.total += 1;

          if (Object.prototype.hasOwnProperty.call(result, payroll.status)) {
            result[payroll.status] += 1;
          }

          return result;
        },
        {
          gross: 0,
          deductions: 0,
          net: 0,
          total: 0,
          draft: 0,
          verified: 0,
          approved: 0,
          paid: 0,
        },
      ),
    [payrolls],
  );

  const handleGenerate = async () => {
    if (!canManagePayroll) {
      setError("You do not have permission to generate payroll.");
      return;
    }

    if (!completedMonth) {
      setError(
        "Payroll can only be generated for a completed month. Current and future months are not allowed.",
      );
      return;
    }

    const confirmed = window.confirm(
      `Generate payroll for ${MONTHS[month - 1]} ${year}?\n\nPlease ensure employee salary structures, attendance and approved leaves are correct.\n\nNew payroll records will be created as Draft.`,
    );

    if (!confirmed) return;

    setGenerating(true);
    setError("");
    setSuccess("");

    try {
      const response = await api.post("/payroll/generate", {
        payrollMonth: Number(month),
        payrollYear: Number(year),
      });

      const result = response.data?.data || {};
      const generated = result.generated || [];
      const skipped = result.skipped || [];

      setSuccess(
        `Payroll generation completed. ${generated.length} employee records generated and ${skipped.length} skipped.`,
      );

      await loadPayrolls();

      if (skipped.length > 0) {
        const skippedDetails = skipped
          .map(
            (item) =>
              `${item.fullName || item.employeeCode || "Employee"}: ${
                item.reason || "Not generated"
              }`,
          )
          .join("\n");

        window.alert(`Some employees were skipped:\n\n${skippedDetails}`);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  };

  const exportCSV = () => {
    if (!payrolls.length) {
      setError("There are no payroll records to export.");
      return;
    }

    const headers = [
      "Employee Code",
      "Employee Name",
      "Department",
      "Month",
      "Year",
      "Gross Pay",
      "Deductions",
      "Net Pay",
      "Status",
    ];

    const rows = payrolls.map((item) => [
      item.employee?.employeeCode || "",
      getEmployeeName(item.employee),
      item.department?.name || "",
      item.payrollMonth || month,
      item.payrollYear || year,
      item.grossPay || 0,
      item.totalDeductions || 0,
      item.netPay || 0,
      item.status || "",
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `payroll-${year}-${String(month).padStart(2, "0")}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  };

  const years = [
    todayIndia.year - 2,
    todayIndia.year - 1,
    todayIndia.year,
    todayIndia.year + 1,
  ];

  if (!canViewPayroll && !canManagePayroll) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
          <XCircle className="mx-auto text-red-500" size={42} />
          <h2 className="mt-4 text-xl font-bold text-slate-900">
            Access Denied
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            You do not have permission to access payroll management.
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="mt-5 rounded-lg bg-green-800 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Back to Dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f3f7f4]">
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white px-4 py-4 shadow-sm sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              title="Back to dashboard"
            >
              <ArrowLeft size={21} />
            </button>

            <div className="rounded-xl bg-green-800 p-3 text-white">
              <Wallet size={22} />
            </div>

            <div>
              <h1 className="font-bold text-slate-900">Payroll Management</h1>
              <p className="text-xs text-slate-500">Chandra Enterprises Agro</p>
            </div>
          </div>

          <button
            onClick={loadPayrolls}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Payroll Dashboard
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Manage monthly salaries, review calculations and track payments.
            </p>
          </div>

          {canManagePayroll && (
            <button
              onClick={handleGenerate}
              disabled={generating || loading || !completedMonth}
              title={
                !completedMonth
                  ? "Payroll generation is available after the month is completed."
                  : "Generate monthly payroll"
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-800 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? (
                <LoaderCircle size={18} className="animate-spin" />
              ) : (
                <Plus size={18} />
              )}
              {generating ? "Generating..." : "Generate Monthly Payroll"}
            </button>
          )}
        </div>

        {/* Automatic payroll schedule */}
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <CalendarDays className="mt-0.5 shrink-0 text-blue-700" size={21} />
          <div>
            <p className="text-sm font-semibold text-blue-900">
              Automatic Monthly Payroll Schedule
            </p>
            <p className="mt-1 text-sm text-blue-800">
              The previous month's payroll is scheduled for automatic generation
              on the 1st of every month at 2:00 AM (Asia/Kolkata). Automatically
              generated records are created as Draft and still require the
              normal verification and approval process.
            </p>
          </div>
        </div>

        {!completedMonth && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <strong>Generation unavailable:</strong> {MONTHS[month - 1]} {year}{" "}
            is not yet completed. You can review existing records, but payroll
            generation is only allowed after the selected month ends.
          </div>
        )}

        {error && (
          <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <XCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-end gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-500">
              Payroll Month
            </label>
            <select
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
              className="min-w-40 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-700"
            >
              {MONTHS.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-500">
              Payroll Year
            </label>
            <select
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              className="min-w-28 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-700"
            >
              {years.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-500">
              Payroll Status
            </label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="min-w-40 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-700"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="verified">Verified</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
            </select>
          </div>

          <div className="flex items-center gap-2 pb-2 text-xs text-slate-500">
            <CalendarDays size={16} />
            Showing {MONTHS[month - 1]} {year}
          </div>
        </div>

        {/* Summary cards */}
        <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Gross Payroll"
            value={formatCurrency(summary.gross)}
            subtitle="Total gross amount in loaded records"
            icon={Banknote}
            color="bg-blue-50 text-blue-700"
          />

          <StatCard
            title="Total Deductions"
            value={formatCurrency(summary.deductions)}
            subtitle="Combined employee deductions"
            icon={Wallet}
            color="bg-red-50 text-red-700"
          />

          <StatCard
            title="Net Payroll"
            value={formatCurrency(summary.net)}
            subtitle="Net salary payable"
            icon={Banknote}
            color="bg-green-50 text-green-700"
          />

          <StatCard
            title="Employees"
            value={summary.total}
            subtitle="Payroll records loaded"
            icon={Users}
            color="bg-purple-50 text-purple-700"
          />
        </div>

        {/* Status summary */}
        <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Draft"
            value={summary.draft}
            subtitle="Awaiting verification"
            icon={Clock}
            color="bg-amber-50 text-amber-700"
          />
          <StatCard
            title="Verified"
            value={summary.verified}
            subtitle="Verification completed"
            icon={CheckCircle2}
            color="bg-blue-50 text-blue-700"
          />
          <StatCard
            title="Approved"
            value={summary.approved}
            subtitle="Awaiting payment"
            icon={CheckCircle2}
            color="bg-green-50 text-green-700"
          />
          <StatCard
            title="Paid"
            value={summary.paid}
            subtitle="Payment marked completed"
            icon={CheckCircle2}
            color="bg-emerald-50 text-emerald-700"
          />
        </div>

        {/* Payroll table */}
        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
            <div>
              <h3 className="font-bold text-slate-900">Payroll Records</h3>
              <p className="mt-1 text-xs text-slate-500">
                Employee-wise monthly salary details
              </p>
            </div>

            <button
              onClick={exportCSV}
              disabled={!payrolls.length}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <Download size={16} />
              Export CSV
            </button>
          </div>

          {loading ? (
            <div className="flex min-h-52 items-center justify-center gap-3 text-sm text-slate-500">
              <LoaderCircle size={22} className="animate-spin" />
              Loading payroll records...
            </div>
          ) : payrolls.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <FileText className="mx-auto text-slate-300" size={42} />
              <h4 className="mt-4 font-semibold text-slate-800">
                No payroll records found
              </h4>
              <p className="mt-2 text-sm text-slate-500">
                No payroll records were found for {MONTHS[month - 1]} {year}
                {status ? ` with status ${status}` : ""}.
              </p>

              {canManagePayroll && completedMonth && (
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="mt-5 rounded-lg bg-green-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-900 disabled:opacity-50"
                >
                  Generate Payroll
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-225 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Employee</th>
                    <th className="px-5 py-4">Department</th>
                    <th className="px-5 py-4">Gross Pay</th>
                    <th className="px-5 py-4">Deductions</th>
                    <th className="px-5 py-4">Net Pay</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {payrolls.map((payroll) => (
                    <tr key={payroll._id} className="hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">
                          {getEmployeeName(payroll.employee)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {payroll.employee?.employeeCode || "—"}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {payroll.department?.name || "—"}
                      </td>

                      <td className="px-5 py-4 font-medium text-slate-700">
                        {formatCurrency(payroll.grossPay)}
                      </td>

                      <td className="px-5 py-4 text-red-600">
                        {formatCurrency(payroll.totalDeductions)}
                      </td>

                      <td className="px-5 py-4 font-bold text-green-800">
                        {formatCurrency(payroll.netPay)}
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge status={payroll.status} />
                      </td>

                      <td className="px-5 py-4">
                        <button
                          onClick={() => navigate(`/payroll/${payroll._id}`)}
                          className="font-semibold text-green-800 hover:underline"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && payrolls.length > 0 && (
            <div className="border-t border-slate-100 px-5 py-4 text-xs text-slate-500">
              Showing {payrolls.length} loaded records
              {pagination?.total != null
                ? ` out of ${pagination.total} total records`
                : ""}
              . Summary values are calculated from the loaded records.
            </div>
          )}
        </section>

        <footer className="mt-8 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Chandra Enterprises Agro · Payroll
          Management System
        </footer>
      </section>
    </main>
  );
}
