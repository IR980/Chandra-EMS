import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Users,
  CalendarCheck,
  CalendarDays,
  Wallet,
  Download,
  RefreshCw,
  Search,
  FileBarChart,
  Clock,
  CheckCircle2,
  XCircle,
  LoaderCircle,
  Filter,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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

const CHART_COLORS = [
  "#15803d",
  "#2563eb",
  "#d97706",
  "#9333ea",
  "#0891b2",
  "#dc2626",
];

const getIndiaDateParts = () => {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
};

const indiaDate = getIndiaDateParts();

const getToday = () =>
  `${indiaDate.year}-${String(indiaDate.month).padStart(2, "0")}-${String(
    indiaDate.day,
  ).padStart(2, "0")}`;

const getFirstDayOfMonth = () =>
  `${indiaDate.year}-${String(indiaDate.month).padStart(2, "0")}-01`;

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(date);
};

const formatMinutes = (minutes) => {
  const total = Number(minutes) || 0;
  const hours = Math.floor(total / 60);
  const remainingMinutes = total % 60;

  return `${hours}h ${remainingMinutes}m`;
};

const getErrorMessage = (error) =>
  error.response?.data?.message ||
  error.message ||
  "Unable to load report data.";

const getEmployeeName = (employee) =>
  employee?.fullName ||
  [employee?.firstName, employee?.lastName].filter(Boolean).join(" ") ||
  "Employee";

const getStatusLabel = (status) =>
  String(status || "unknown").replaceAll("_", " ");

const getStatusClass = (status) => {
  const styles = {
    active: "bg-green-100 text-green-800",
    present: "bg-green-100 text-green-800",
    approved: "bg-green-100 text-green-800",
    paid: "bg-green-100 text-green-800",
    verified: "bg-blue-100 text-blue-800",
    pending: "bg-amber-100 text-amber-800",
    draft: "bg-slate-100 text-slate-700",
    absent: "bg-red-100 text-red-800",
    rejected: "bg-red-100 text-red-800",
    terminated: "bg-red-100 text-red-800",
    inactive: "bg-slate-100 text-slate-700",
    cancelled: "bg-slate-100 text-slate-700",
    on_leave: "bg-purple-100 text-purple-800",
    half_day: "bg-orange-100 text-orange-800",
  };

  return styles[status] || "bg-slate-100 text-slate-700";
};

function StatCard({ title, value, subtitle, icon: Icon, color }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
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
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${getStatusClass(
        status,
      )}`}
    >
      {getStatusLabel(status)}
    </span>
  );
}

function EmptyState({ message }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center">
      <FileBarChart className="mx-auto text-slate-400" size={34} />
      <p className="mt-3 text-sm font-medium text-slate-700">{message}</p>
    </div>
  );
}

function ReportsDashboardPage() {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  const permissions = Array.isArray(user?.role?.permissions)
    ? user.role.permissions
    : [];

  const hasPermission = (permission) =>
    permissions.includes("*") || permissions.includes(permission);

  const canViewReports = hasPermission("reports.view");
  const canExportReports = hasPermission("reports.export");

  const [activeTab, setActiveTab] = useState("overview");

  const [from, setFrom] = useState(getFirstDayOfMonth());
  const [to, setTo] = useState(getToday());

  const [month, setMonth] = useState(indiaDate.month);
  const [year, setYear] = useState(indiaDate.year);

  const [domain, setDomain] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [leaveType, setLeaveType] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState("");
  const [search, setSearch] = useState("");

  const [domains, setDomains] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [summary, setSummary] = useState(null);
  const [records, setRecords] = useState([]);
  const [reportSummary, setReportSummary] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [pagination, setPagination] = useState(null);

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const tabs = [
    { id: "overview", label: "Overview", icon: TrendingUp },
    { id: "employees", label: "Employees", icon: Users },
    { id: "attendance", label: "Attendance", icon: CalendarCheck },
    { id: "leaves", label: "Leaves", icon: CalendarDays },
    { id: "payroll", label: "Payroll", icon: Wallet },
  ];

  const reportParams = useMemo(() => {
    const params = {
      page: 1,
      limit: 100,
    };

    if (domain) params.domain = domain;
    if (department) params.department = department;

    if (activeTab === "overview") {
      params.from = from;
      params.to = to;
      params.month = month;
      params.year = year;
    }

    if (activeTab === "employees") {
      if (employmentStatus) {
        params.employmentStatus = employmentStatus;
      }

      if (search.trim()) {
        params.search = search.trim();
      }
    }

    if (activeTab === "attendance" || activeTab === "leaves") {
      params.from = from;
      params.to = to;
    }

    if (activeTab === "attendance" && status) {
      params.status = status;
    }

    if (activeTab === "leaves") {
      params.year = year;

      if (status) params.status = status;
      if (leaveType) params.leaveType = leaveType;
    }

    if (activeTab === "payroll") {
      params.month = month;
      params.year = year;

      if (status) params.status = status;
    }

    return params;
  }, [
    activeTab,
    from,
    to,
    month,
    year,
    domain,
    department,
    status,
    leaveType,
    employmentStatus,
    search,
  ]);

  // Load domain and department options.
  // These optional requests do not prevent reports from working
  // if the user's role cannot access organization management.
  useEffect(() => {
    let mounted = true;

    const loadOrganizationOptions = async () => {
      try {
        const [domainResponse, departmentResponse] = await Promise.all([
          api.get("/domains"),
          api.get("/departments"),
        ]);

        if (!mounted) return;

        const domainData = domainResponse.data?.data || {};
        const departmentData = departmentResponse.data?.data || {};

        const domainList = Array.isArray(domainData)
          ? domainData
          : domainData.domains || domainData.records || [];

        const departmentList = Array.isArray(departmentData)
          ? departmentData
          : departmentData.departments || departmentData.records || [];

        setDomains(Array.isArray(domainList) ? domainList : []);
        setDepartments(Array.isArray(departmentList) ? departmentList : []);
      } catch {
        // Organization filters are optional.
      }
    };

    loadOrganizationOptions();

    return () => {
      mounted = false;
    };
  }, []);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/reports/summary", {
        params: {
          from,
          to,
          month,
          year,
          ...(domain ? { domain } : {}),
          ...(department ? { department } : {}),
        },
      });

      const data = response.data?.data || {};
      setSummary(data);
    } catch (err) {
      setError(getErrorMessage(err));
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, month, year, domain, department]);

  const loadReport = useCallback(async () => {
    if (activeTab === "overview") {
      await loadSummary();
      return;
    }

    const endpoints = {
      employees: "/reports/employees",
      attendance: "/reports/attendance",
      leaves: "/reports/leaves",
      payroll: "/reports/payroll",
    };

    const endpoint = endpoints[activeTab];

    if (!endpoint) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await api.get(endpoint, {
        params: reportParams,
      });

      const data = response.data?.data || {};

      if (activeTab === "employees") {
        setRecords(data.employees || []);
        setPagination(data.pagination || null);
        setReportSummary([]);
        setLeaveBalances([]);
      } else {
        setRecords(data.records || []);
        setPagination(data.pagination || null);
        setReportSummary(data.summary || []);
        setLeaveBalances(data.balances || []);
      }
    } catch (err) {
      setError(getErrorMessage(err));
      setRecords([]);
      setPagination(null);
      setReportSummary([]);
      setLeaveBalances([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, reportParams, loadSummary]);

  useEffect(() => {
    if (canViewReports) {
      Promise.resolve().then(() => {
        void loadReport();
      });
    }
  }, [canViewReports, loadReport]);

  const handleExport = async () => {
    if (!canExportReports) {
      setError("Your account does not have permission to export reports.");
      return;
    }

    const exportType = activeTab === "overview" ? "employees" : activeTab;

    setExporting(true);
    setError("");
    setSuccess("");

    try {
      const params = {
        ...(domain ? { domain } : {}),
        ...(department ? { department } : {}),
      };

      if (exportType === "attendance" || exportType === "leaves") {
        params.from = from;
        params.to = to;
      }

      if (exportType === "leaves") {
        params.year = year;
        if (status) params.status = status;
        if (leaveType) params.leaveType = leaveType;
      }

      if (exportType === "attendance" && status) {
        params.status = status;
      }

      if (exportType === "employees") {
        if (employmentStatus) {
          params.employmentStatus = employmentStatus;
        }

        if (search.trim()) params.search = search.trim();
      }

      if (exportType === "payroll") {
        params.month = month;
        params.year = year;
        if (status) params.status = status;
      }

      const response = await api.get(`/reports/export/${exportType}`, {
        params,
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: "text/csv;charset=utf-8;",
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `${exportType}-report.csv`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);

      setSuccess("CSV report downloaded successfully.");
    } catch (err) {
      const message =
        err.response?.data?.message ||
        "Unable to export report. Check your export permission.";

      setError(message);
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setFrom(getFirstDayOfMonth());
    setTo(getToday());
    setDomain("");
    setDepartment("");
    setStatus("");
    setLeaveType("");
    setEmploymentStatus("");
    setSearch("");
    setMonth(indiaDate.month);
    setYear(indiaDate.year);
  };

  const employeeChartData = useMemo(
    () =>
      (summary?.employees?.byDepartment || []).map((item) => ({
        name: item.departmentName || "Unassigned",
        employees: Number(item.employees) || 0,
      })),
    [summary],
  );

  const attendanceChartData = useMemo(
    () =>
      Object.entries(summary?.attendance?.byStatus || {}).map(
        ([name, value]) => ({
          name: getStatusLabel(name),
          value: Number(value) || 0,
        }),
      ),
    [summary],
  );

  const leaveChartData = useMemo(
    () =>
      Object.entries(summary?.leaves?.byStatus || {}).map(([name, value]) => ({
        name: getStatusLabel(name),
        value: Number(value) || 0,
      })),
    [summary],
  );

  const payrollChartData = useMemo(
    () =>
      Object.entries(summary?.payroll?.byStatus || {}).map(([name, value]) => ({
        name: getStatusLabel(name),
        employees: Number(value.employees) || 0,
        netPay: Number(value.netPay) || 0,
      })),
    [summary],
  );

  const renderEmployeeTable = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {[
              "Employee",
              "Employee Code",
              "Designation",
              "Department",
              "Employment Type",
              "Status",
              "Joining Date",
            ].map((heading) => (
              <th
                key={heading}
                className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 bg-white">
          {records.map((employee) => (
            <tr key={employee._id} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                {getEmployeeName(employee)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                {employee.employeeCode || "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                {employee.designation || "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                {employee.department?.name || "Unassigned"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 capitalize text-slate-600">
                {getStatusLabel(employee.employmentType)}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <StatusBadge status={employee.employmentStatus} />
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                {formatDate(employee.joiningDate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderAttendanceTable = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {[
              "Date",
              "Employee",
              "Department",
              "Status",
              "Worked Time",
              "Approval",
            ].map((heading) => (
              <th
                key={heading}
                className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 bg-white">
          {records.map((record) => (
            <tr key={record._id} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                {record.attendanceDate || "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <p className="font-semibold text-slate-900">
                  {getEmployeeName(record.employee)}
                </p>
                <p className="text-xs text-slate-500">
                  {record.employee?.employeeCode || "—"}
                </p>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                {record.department?.name || "Unassigned"}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <StatusBadge status={record.status} />
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                {formatMinutes(record.workedMinutes)}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <StatusBadge
                  status={record.isApproved ? "approved" : "pending"}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderLeaveTable = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {[
              "Employee",
              "Department",
              "Leave Type",
              "Start Date",
              "End Date",
              "Days",
              "Status",
            ].map((heading) => (
              <th
                key={heading}
                className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 bg-white">
          {records.map((record) => (
            <tr key={record._id} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-4 py-3">
                <p className="font-semibold text-slate-900">
                  {getEmployeeName(record.employee)}
                </p>
                <p className="text-xs text-slate-500">
                  {record.employee?.employeeCode || "—"}
                </p>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                {record.department?.name || "Unassigned"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 capitalize text-slate-600">
                {getStatusLabel(record.leaveType)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                {formatDate(record.startDate)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                {formatDate(record.endDate)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                {record.requestedDays ?? "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <StatusBadge status={record.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderPayrollTable = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {[
              "Employee",
              "Department",
              "Gross Pay",
              "Deductions",
              "Net Pay",
              "Status",
              "Source",
            ].map((heading) => (
              <th
                key={heading}
                className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 bg-white">
          {records.map((record) => (
            <tr key={record._id} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-4 py-3">
                <p className="font-semibold text-slate-900">
                  {getEmployeeName(record.employee)}
                </p>
                <p className="text-xs text-slate-500">
                  {record.employee?.employeeCode || "—"}
                </p>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                {record.department?.name || "Unassigned"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                {formatCurrency(record.grossPay)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                {formatCurrency(record.totalDeductions)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-semibold text-green-700">
                {formatCurrency(record.netPay)}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <StatusBadge status={record.status} />
              </td>
              <td className="whitespace-nowrap px-4 py-3 capitalize text-slate-600">
                {record.generationSource || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderOverview = () => (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Employees"
          value={summary?.employees?.total ?? "—"}
          subtitle={`${summary?.employees?.byStatus?.active || 0} active employees`}
          icon={Users}
          color="bg-blue-50 text-blue-700"
        />

        <StatCard
          title="Attendance Records"
          value={summary?.attendance?.total ?? "—"}
          subtitle={`${formatMinutes(summary?.attendance?.workedMinutes)} recorded`}
          icon={CalendarCheck}
          color="bg-green-50 text-green-700"
        />

        <StatCard
          title="Leave Applications"
          value={summary?.leaves?.total ?? "—"}
          subtitle={`${summary?.leaves?.byStatus?.pending || 0} pending requests`}
          icon={CalendarDays}
          color="bg-amber-50 text-amber-700"
        />

        <StatCard
          title="Net Payroll"
          value={formatCurrency(summary?.payroll?.netPay)}
          subtitle={`${summary?.payroll?.employees || 0} payroll records`}
          icon={Wallet}
          color="bg-purple-50 text-purple-700"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h3 className="font-bold text-slate-900">
              Employees by Department
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Employee distribution across departments
            </p>
          </div>

          {employeeChartData.length ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={employeeChartData}
                  margin={{ top: 10, right: 10, left: -15, bottom: 45 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="name"
                    angle={-25}
                    textAnchor="end"
                    interval={0}
                    height={65}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar
                    dataKey="employees"
                    name="Employees"
                    fill="#15803d"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="No department employee data available." />
          )}
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h3 className="font-bold text-slate-900">
              Attendance Distribution
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Attendance records within the selected date range
            </p>
          </div>

          {attendanceChartData.length ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={attendanceChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    outerRadius={105}
                    label
                  >
                    {attendanceChartData.map((item, index) => (
                      <Cell
                        key={item.name}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="No attendance data available." />
          )}
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h3 className="font-bold text-slate-900">
              Leave Application Status
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Leave requests by approval status
            </p>
          </div>

          {leaveChartData.length ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leaveChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar
                    dataKey="value"
                    name="Applications"
                    fill="#d97706"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="No leave data available." />
          )}
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h3 className="font-bold text-slate-900">Payroll by Status</h3>
            <p className="mt-1 text-xs text-slate-500">
              Payroll amounts for the selected month
            </p>
          </div>

          {payrollChartData.length ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={payrollChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Bar
                    dataKey="netPay"
                    name="Net Pay"
                    fill="#7c3aed"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="No payroll data available for this month." />
          )}
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-slate-900">Payroll Financial Summary</h3>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Gross Pay</p>
            <p className="mt-2 text-xl font-bold text-slate-900">
              {formatCurrency(summary?.payroll?.grossPay)}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Total Deductions</p>
            <p className="mt-2 text-xl font-bold text-red-600">
              {formatCurrency(summary?.payroll?.deductions)}
            </p>
          </div>

          <div className="rounded-xl bg-green-50 p-4">
            <p className="text-sm text-green-700">Net Pay</p>
            <p className="mt-2 text-xl font-bold text-green-800">
              {formatCurrency(summary?.payroll?.netPay)}
            </p>
          </div>
        </div>
      </section>
    </>
  );

  const renderReportContent = () => {
    if (activeTab === "employees") return renderEmployeeTable();
    if (activeTab === "attendance") return renderAttendanceTable();
    if (activeTab === "leaves") return renderLeaveTable();
    if (activeTab === "payroll") return renderPayrollTable();

    return null;
  };

  if (!canViewReports) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
        <div className="max-w-md rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
          <XCircle className="mx-auto text-red-600" size={42} />
          <h2 className="mt-4 text-xl font-bold text-slate-900">
            Access Denied
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Your account does not have permission to view Reports & Analytics.
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="mt-6 rounded-lg bg-green-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-900"
          >
            Return to Dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f3f7f4]">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white px-4 py-4 shadow-sm sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
              title="Back to dashboard"
            >
              <ArrowLeft size={19} />
            </button>

            <div className="rounded-xl bg-[#17613b] p-3 text-white">
              <FileBarChart size={22} />
            </div>

            <div>
              <h1 className="font-bold text-slate-900">Reports & Analytics</h1>
              <p className="text-xs text-slate-500">Chandra Enterprises Agro</p>
            </div>
          </div>

          <button
            onClick={loadReport}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-8">
        <section className="mb-7 overflow-hidden rounded-2xl bg-linear-to-r from-[#17613b] to-[#238451] p-6 text-white shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                <CheckCircle2 size={14} />
                Authorized reporting
              </div>

              <h2 className="text-2xl font-bold sm:text-3xl">
                Business Reports & Analytics
              </h2>

              <p className="mt-2 max-w-2xl text-sm text-green-50">
                Monitor employee strength, attendance, leave activity and
                payroll performance from one centralized dashboard.
              </p>
            </div>

            <div className="hidden rounded-2xl bg-white/15 p-5 sm:block">
              <TrendingUp size={43} />
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-green-800" />
              <h3 className="font-bold text-slate-900">Report Filters</h3>
            </div>

            <button
              onClick={clearFilters}
              className="text-sm font-semibold text-green-800 hover:text-green-950"
            >
              Clear filters
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(activeTab === "overview" ||
              activeTab === "attendance" ||
              activeTab === "leaves") && (
              <>
                <label className="text-sm font-medium text-slate-600">
                  From Date
                  <input
                    type="date"
                    value={from}
                    max={to}
                    onChange={(event) => setFrom(event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-green-600"
                  />
                </label>

                <label className="text-sm font-medium text-slate-600">
                  To Date
                  <input
                    type="date"
                    value={to}
                    min={from}
                    max={getToday()}
                    onChange={(event) => setTo(event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-green-600"
                  />
                </label>
              </>
            )}

            {(activeTab === "overview" || activeTab === "payroll") && (
              <>
                <label className="text-sm font-medium text-slate-600">
                  Payroll Month
                  <select
                    value={month}
                    onChange={(event) => setMonth(Number(event.target.value))}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-600"
                  >
                    {MONTHS.map((name, index) => (
                      <option key={name} value={index + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-medium text-slate-600">
                  Payroll Year
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    value={year}
                    onChange={(event) => setYear(Number(event.target.value))}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-green-600"
                  />
                </label>
              </>
            )}

            {domains.length > 0 && (
              <label className="text-sm font-medium text-slate-600">
                Domain
                <select
                  value={domain}
                  onChange={(event) => setDomain(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-600"
                >
                  <option value="">All accessible domains</option>
                  {domains.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {departments.length > 0 && (
              <label className="text-sm font-medium text-slate-600">
                Department
                <select
                  value={department}
                  onChange={(event) => setDepartment(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-600"
                >
                  <option value="">All accessible departments</option>
                  {departments
                    .filter(
                      (item) =>
                        !domain ||
                        String(item.domain?._id || item.domain) ===
                          String(domain),
                    )
                    .map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
            )}

            {activeTab === "employees" && (
              <>
                <label className="text-sm font-medium text-slate-600">
                  Employment Status
                  <select
                    value={employmentStatus}
                    onChange={(event) =>
                      setEmploymentStatus(event.target.value)
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-600"
                  >
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="on_leave">On Leave</option>
                    <option value="inactive">Inactive</option>
                    <option value="terminated">Terminated</option>
                  </select>
                </label>

                <label className="text-sm font-medium text-slate-600">
                  Search Employee
                  <div className="relative mt-1.5">
                    <Search
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Name, code or designation"
                      className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-green-600"
                    />
                  </div>
                </label>
              </>
            )}

            {(activeTab === "attendance" ||
              activeTab === "leaves" ||
              activeTab === "payroll") && (
              <label className="text-sm font-medium text-slate-600">
                Status
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-600"
                >
                  <option value="">All statuses</option>

                  {activeTab === "attendance" && (
                    <>
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="half_day">Half Day</option>
                      <option value="leave">Leave</option>
                      <option value="holiday">Holiday</option>
                      <option value="week_off">Week Off</option>
                    </>
                  )}

                  {activeTab === "leaves" && (
                    <>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="cancelled">Cancelled</option>
                    </>
                  )}

                  {activeTab === "payroll" && (
                    <>
                      <option value="draft">Draft</option>
                      <option value="verified">Verified</option>
                      <option value="approved">Approved</option>
                      <option value="paid">Paid</option>
                    </>
                  )}
                </select>
              </label>
            )}

            {activeTab === "leaves" && (
              <label className="text-sm font-medium text-slate-600">
                Leave Type
                <select
                  value={leaveType}
                  onChange={(event) => setLeaveType(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-green-600"
                >
                  <option value="">All leave types</option>
                  <option value="casual">Casual</option>
                  <option value="sick">Sick</option>
                  <option value="earned">Earned</option>
                  <option value="unpaid">Unpaid</option>
                </select>
              </label>
            )}
          </div>
        </section>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const selected = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setStatus("");
                  }}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                    selected
                      ? "bg-green-800 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {canExportReports && (
            <button
              onClick={handleExport}
              disabled={exporting || loading}
              className="inline-flex items-center gap-2 rounded-lg bg-[#17613b] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? (
                <LoaderCircle size={17} className="animate-spin" />
              ) : (
                <Download size={17} />
              )}
              {exporting ? "Exporting..." : "Export CSV"}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <XCircle size={19} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
            <p>{success}</p>
          </div>
        )}

        {loading ? (
          <div className="flex min-h-72 items-center justify-center rounded-2xl border border-slate-100 bg-white">
            <div className="text-center">
              <LoaderCircle
                size={34}
                className="mx-auto animate-spin text-green-700"
              />
              <p className="mt-3 text-sm text-slate-500">
                Loading report data...
              </p>
            </div>
          </div>
        ) : activeTab === "overview" ? (
          summary ? (
            renderOverview()
          ) : (
            <EmptyState message="No summary data is available." />
          )
        ) : (
          <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
              <div>
                <h3 className="font-bold capitalize text-slate-900">
                  {activeTab} Report
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {pagination?.total ?? records.length} records found
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock size={15} />
                Maximum 100 records displayed per request
              </div>
            </div>

            {reportSummary.length > 0 && activeTab !== "employees" && (
              <div className="grid gap-4 border-b border-slate-100 bg-slate-50/70 p-5 sm:grid-cols-2 xl:grid-cols-3">
                {activeTab === "attendance" &&
                  reportSummary.map((item) => (
                    <div
                      key={item.status}
                      className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold capitalize text-slate-700">
                          {getStatusLabel(item.status)}
                        </p>
                        <StatusBadge status={item.status} />
                      </div>
                      <p className="mt-3 text-2xl font-bold text-slate-900">
                        {Number(item.count) || 0}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Attendance records
                      </p>
                      <div className="mt-3 border-t border-slate-100 pt-3">
                        <p className="text-xs text-slate-500">
                          Total worked time
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">
                          {formatMinutes(item.workedMinutes)}
                        </p>
                      </div>
                    </div>
                  ))}

                {activeTab === "leaves" &&
                  reportSummary.map((item) => (
                    <div
                      key={`${item.status}-${item.leaveType}`}
                      className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold capitalize text-slate-700">
                          {getStatusLabel(item.leaveType)} Leave
                        </p>
                        <StatusBadge status={item.status} />
                      </div>
                      <p className="mt-3 text-2xl font-bold text-slate-900">
                        {Number(item.requests) || 0}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Leave applications
                      </p>
                      <div className="mt-3 border-t border-slate-100 pt-3">
                        <p className="text-xs text-slate-500">Requested days</p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">
                          {Number(item.requestedDays) || 0}
                        </p>
                      </div>
                    </div>
                  ))}

                {activeTab === "payroll" &&
                  reportSummary.map((item) => (
                    <div
                      key={item._id}
                      className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold capitalize text-slate-700">
                          {getStatusLabel(item._id)} Payroll
                        </p>
                        <StatusBadge status={item._id} />
                      </div>
                      <p className="mt-3 text-2xl font-bold text-slate-900">
                        {Number(item.employees) || 0}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Payroll records
                      </p>
                      <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Gross pay</span>
                          <span className="font-semibold text-slate-700">
                            {formatCurrency(item.grossPay)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Deductions</span>
                          <span className="font-semibold text-red-600">
                            {formatCurrency(item.totalDeductions)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Net pay</span>
                          <span className="font-semibold text-green-700">
                            {formatCurrency(item.netPay)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {records.length ? (
              renderReportContent()
            ) : (
              <div className="p-5">
                <EmptyState message="No records found for the selected filters." />
              </div>
            )}

            {pagination && pagination.totalPages > 1 && (
              <div className="border-t border-slate-100 px-5 py-4 text-sm text-slate-500">
                Showing page {pagination.page} of {pagination.totalPages}.
                Detailed pagination controls can be added in the next
                refinement.
              </div>
            )}
          </section>
        )}

        {activeTab === "leaves" && !loading && leaveBalances.length > 0 && (
          <section className="mt-6 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <h3 className="font-bold text-slate-900">
                Leave Balance Summary — {year}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Aggregated entitlement and utilization by leave type
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {[
                      "Leave Type",
                      "Employees",
                      "Annual Entitlement",
                      "Carried Forward",
                      "Adjustment",
                      "Used",
                      "Remaining",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {leaveBalances.map((item) => (
                    <tr key={item._id}>
                      <td className="px-4 py-3 font-semibold capitalize text-slate-900">
                        {item._id}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {item.employees}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {item.annualEntitlement}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {item.carriedForward}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {item.adjustment}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.used}</td>
                      <td className="px-4 py-3 font-semibold text-green-700">
                        {item.remaining}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <footer className="mt-8 border-t border-slate-200 py-5 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Chandra Enterprises Agro. Reports &
          Analytics.
        </footer>
      </div>
    </main>
  );
}

export default ReportsDashboardPage;
