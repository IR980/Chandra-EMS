import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ClipboardList,
  RefreshCw,
  Search,
  X,
  Clock,
} from "lucide-react";
import { useSelector } from "react-redux";
import api from "../../services/api";

const STATUS_OPTIONS = [
  ["", "All statuses"],
  ["present", "Present"],
  ["absent", "Absent"],
  ["half_day", "Half day"],
  ["leave", "Leave"],
  ["holiday", "Holiday"],
  ["week_off", "Week off"],
];

const MANUAL_STATUSES = [
  ["present", "Present"],
  ["absent", "Absent"],
  ["half_day", "Half day"],
  ["holiday", "Holiday"],
  ["week_off", "Week off"],
];

const statusClass = (status) =>
  ({
    present: "bg-green-100 text-green-800",
    absent: "bg-red-100 text-red-700",
    half_day: "bg-amber-100 text-amber-800",
    leave: "bg-blue-100 text-blue-800",
    holiday: "bg-purple-100 text-purple-800",
    week_off: "bg-slate-100 text-slate-700",
  })[status] || "bg-gray-100 text-gray-700";

const displayTime = (value) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(value))
    : "—";

const minutesLabel = (value = 0) => {
  const minutes = Math.max(0, Number(value) || 0);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

const timeInputValue = (value) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(value))
    : "";

const calculateMinutes = (start, end) => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, eh * 60 + em - sh * 60 - sm);
};

const companyDate = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
};

function AttendanceManagementPage() {
  const user = useSelector((state) => state.auth.user);
  const rolePermissions = user?.role?.permissions;
  const permissions = Array.isArray(rolePermissions)
    ? rolePermissions
    : Array.isArray(user?.permissions)
      ? user.permissions
      : [];
  const isSuperAdmin =
    user?.role?.slug === "super-admin" ||
    user?.role?.name === "Super Admin" ||
    user?.role === "super-admin";
  const canManage =
    isSuperAdmin ||
    permissions.includes("*") ||
    permissions.includes("attendance.manage");
  const canApprove =
    isSuperAdmin ||
    permissions.includes("*") ||
    permissions.includes("attendance.approve");

  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [domains, setDomains] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  });

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    date: "",
    employee: "",
    domain: "",
    department: "",
    status: "",
  });

  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editForm, setEditForm] = useState({
    status: "present",
    checkInTime: "",
    checkOutTime: "",
    remarks: "",
    reason: "",
  });

  const [manual, setManual] = useState({
    employee: "",
    attendanceDate: companyDate(),
    status: "present",
    checkInTime: "",
    checkOutTime: "",
    remarks: "",
  });

  const loadOptions = useCallback(async () => {
    setOptionsLoading(true);
    try {
      const [employeeResponse, domainResponse, departmentResponse] =
        await Promise.all([
          api.get("/employees", {
            params: { page: 1, limit: 100, employmentStatus: "active" },
          }),
          api.get("/domains", {
            params: { page: 1, limit: 100, status: "active" },
          }),
          api.get("/departments", {
            params: { page: 1, limit: 100, status: "active" },
          }),
        ]);

      setEmployees(employeeResponse.data?.data?.employees || []);
      setDomains(domainResponse.data?.data?.domains || []);
      setDepartments(departmentResponse.data?.data?.departments || []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load employee and organization filters.",
      );
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = { page, limit: 20 };

      Object.entries(filters).forEach(([key, value]) => {
        if (value) params[key] = value;
      });

      const response = await api.get("/attendance", { params });
      const data = response.data?.data || {};

      setRecords(data.attendance || []);
      setPagination(
        data.pagination || {
          total: 0,
          page,
          limit: 20,
          totalPages: 1,
        },
      );
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to load attendance records.",
      );
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const departmentOptions = useMemo(
    () =>
      departments.filter((department) => {
        if (!filters.domain) return true;
        const domainId = department.domain?._id || department.domain;
        return String(domainId) === filters.domain;
      }),
    [departments, filters.domain],
  );

  const updateFilter = (key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "domain" ? { department: "" } : {}),
    }));
    setPage(1);
  };

  const submitManual = async (event) => {
    event.preventDefault();
    if (manual.checkOutTime && !manual.checkInTime) {
      setError("Enter check-in time before entering check-out time.");
      return;
    }
    if (
      manual.checkInTime &&
      manual.checkOutTime &&
      manual.checkOutTime <= manual.checkInTime
    ) {
      setError("Check-out time must be later than check-in time.");
      return;
    }
    if (
      ["absent", "holiday", "week_off"].includes(manual.status) &&
      (manual.checkInTime || manual.checkOutTime)
    ) {
      setError("Check-in/check-out times are not allowed for this status.");
      return;
    }
    setError("");
    setNotice("");
    setBusyId("manual");

    try {
      const payload = {
        employee: manual.employee,
        attendanceDate: manual.attendanceDate,
        status: manual.status,
        checkInTime: manual.checkInTime || "",
        checkOutTime: manual.checkOutTime || "",
        remarks: manual.remarks.trim(),
      };
      const response = await api.post("/attendance/manual", payload);
      setNotice(response.data?.message || "Manual attendance recorded.");
      setShowManual(false);
      setManual((current) => ({
        ...current,
        employee: "",
        checkInTime: "",
        checkOutTime: "",
        remarks: "",
      }));
      await loadRecords();
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to create manual attendance.",
      );
    } finally {
      setBusyId("");
    }
  };

  const approve = async (id) => {
    setBusyId(id);
    setError("");
    setNotice("");

    try {
      const response = await api.patch(`/attendance/${id}/approve`);
      setNotice(response.data?.message || "Attendance approved.");
      await loadRecords();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to approve attendance.");
    } finally {
      setBusyId("");
    }
  };

  const deleteRecord = async (record) => {
    const reason = window.prompt(
      `Why should this attendance record be deleted?\nEmployee: ${record.employee?.fullName || "Unknown employee"}\nDate: ${record.attendanceDate}`,
    );
    if (reason === null) return;
    if (!reason.trim()) {
      setError("A deletion reason is required.");
      return;
    }

    const confirmed = window.confirm(
      "This will hide the record from normal attendance views while retaining it in the database for audit. Continue?",
    );
    if (!confirmed) return;

    setBusyId(record._id);
    setError("");
    setNotice("");
    try {
      const response = await api.delete(`/attendance/${record._id}`, {
        data: { reason: reason.trim() },
      });
      setNotice(response.data?.message || "Attendance record deleted.");
      await loadRecords();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete attendance.");
    } finally {
      setBusyId("");
    }
  };

  const openEditRecord = (record) => {
    setError("");
    setNotice("");
    setEditingRecord(record);
    setEditForm({
      status: record.status || "present",
      checkInTime: timeInputValue(record.checkInAt),
      checkOutTime: timeInputValue(record.checkOutAt),
      remarks: record.remarks || "",
      reason: "",
    });
  };

  const saveEditRecord = async (event) => {
    event.preventDefault();
    if (!editingRecord) return;

    if (editForm.checkOutTime && !editForm.checkInTime) {
      setError("Enter check-in time before entering check-out time.");
      return;
    }
    if (
      editForm.checkInTime &&
      editForm.checkOutTime &&
      editForm.checkOutTime <= editForm.checkInTime
    ) {
      setError("Check-out time must be later than check-in time.");
      return;
    }
    if (
      ["absent", "holiday", "week_off"].includes(editForm.status) &&
      (editForm.checkInTime || editForm.checkOutTime)
    ) {
      setError(
        "Clear check-in and check-out times for this attendance status.",
      );
      return;
    }
    if (editForm.remarks.length > 500 || editForm.reason.length > 500) {
      setError(
        "Remarks and correction reason must be 500 characters or fewer.",
      );
      return;
    }

    setBusyId(editingRecord._id);
    setError("");
    setNotice("");
    try {
      const response = await api.patch(`/attendance/${editingRecord._id}`, {
        status: editForm.status,
        checkInTime: editForm.checkInTime,
        checkOutTime: editForm.checkOutTime,
        remarks: editForm.remarks,
        reason: editForm.reason,
      });
      setNotice(response.data?.message || "Attendance corrected successfully.");
      setEditingRecord(null);
      await loadRecords();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to correct attendance.");
    } finally {
      setBusyId("");
    }
  };

  const clearFilters = () => {
    setFilters({
      date: "",
      employee: "",
      domain: "",
      department: "",
      status: "",
    });
    setPage(1);
  };

  return (
    <main className="min-h-screen bg-[#f3f7f4] px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-green-700">
              HR and authorized managers
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
              Attendance Management
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Review attendance records within your authorized scope.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={loadRecords}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={16} />
              Refresh
            </button>

            {canManage && (
              <button
                onClick={() => setShowManual((value) => !value)}
                className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
              >
                <ClipboardList size={16} />
                Manual entry
              </button>
            )}
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800"
          >
            {notice}
          </div>
        )}

        {showManual && canManage && (
          <form
            onSubmit={submitManual}
            className="mb-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
          >
            <h2 className="mb-4 font-bold text-slate-900">
              Create manual attendance
            </h2>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm font-medium text-slate-700">
                Employee
                <select
                  required
                  value={manual.employee}
                  onChange={(event) =>
                    setManual({ ...manual, employee: event.target.value })
                  }
                  disabled={optionsLoading}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <option value="">Select employee</option>
                  {employees.map((employee) => (
                    <option key={employee._id} value={employee._id}>
                      {employee.fullName} ({employee.employeeCode})
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium text-slate-700">
                Attendance date
                <input
                  required
                  type="date"
                  value={manual.attendanceDate}
                  onChange={(event) =>
                    setManual({ ...manual, attendanceDate: event.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>

              <label className="text-sm font-medium text-slate-700">
                Status
                <select
                  value={manual.status}
                  onChange={(event) =>
                    setManual({ ...manual, status: event.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  {MANUAL_STATUSES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium text-slate-700">
                Check-in time (IST)
                <input
                  type="time"
                  value={manual.checkInTime}
                  disabled={["absent", "holiday", "week_off"].includes(
                    manual.status,
                  )}
                  onChange={(event) =>
                    setManual({ ...manual, checkInTime: event.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>

              <label className="text-sm font-medium text-slate-700">
                Check-out time (IST)
                <input
                  type="time"
                  value={manual.checkOutTime}
                  disabled={["absent", "holiday", "week_off"].includes(
                    manual.status,
                  )}
                  onChange={(event) =>
                    setManual({ ...manual, checkOutTime: event.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>

              <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                Remarks
                <input
                  maxLength={500}
                  value={manual.remarks}
                  onChange={(event) =>
                    setManual({ ...manual, remarks: event.target.value })
                  }
                  placeholder="Optional (max 500 characters)"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                disabled={busyId === "manual" || optionsLoading}
                className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busyId === "manual" ? "Saving..." : "Save attendance"}
              </button>

              <button
                type="button"
                onClick={() => setShowManual(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {editingRecord && canManage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
            <form
              onSubmit={saveEditRecord}
              className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
            >
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-green-700">
                    Attendance correction
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">
                    {editingRecord.employee?.fullName || "Employee attendance"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {editingRecord.attendanceDate} · India Standard Time
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Attendance status
                  <select
                    value={editForm.status}
                    onChange={(event) =>
                      setEditForm({ ...editForm, status: event.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                  >
                    {MANUAL_STATUSES.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    Calculated worked time
                  </p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {minutesLabel(
                      calculateMinutes(
                        editForm.checkInTime,
                        editForm.checkOutTime,
                      ),
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    Preview; server recalculates on save
                  </p>
                </div>
                <label className="text-sm font-medium text-slate-700">
                  Check-in time (IST)
                  <input
                    type="time"
                    value={editForm.checkInTime}
                    disabled={["absent", "holiday", "week_off"].includes(
                      editForm.status,
                    )}
                    onChange={(event) =>
                      setEditForm({
                        ...editForm,
                        checkInTime: event.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Check-out time (IST)
                  <input
                    type="time"
                    value={editForm.checkOutTime}
                    disabled={["absent", "holiday", "week_off"].includes(
                      editForm.status,
                    )}
                    onChange={(event) =>
                      setEditForm({
                        ...editForm,
                        checkOutTime: event.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                  Remarks
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={editForm.remarks}
                    onChange={(event) =>
                      setEditForm({ ...editForm, remarks: event.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                  Correction reason
                  <textarea
                    rows={2}
                    maxLength={500}
                    required
                    value={editForm.reason}
                    onChange={(event) =>
                      setEditForm({ ...editForm, reason: event.target.value })
                    }
                    placeholder="Explain why this record is being corrected"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
              </div>

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={Boolean(busyId)}
                  className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busyId === editingRecord._id
                    ? "Saving..."
                    : "Save correction"}
                </button>
              </div>
            </form>
          </div>
        )}

        <section className="mb-5 grid gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Date
            <input
              type="date"
              value={filters.date}
              onChange={(event) => updateFilter("date", event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800"
            />
          </label>

          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Employee
            <select
              value={filters.employee}
              onChange={(event) => updateFilter("employee", event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800"
            >
              <option value="">All employees</option>
              {employees.map((employee) => (
                <option key={employee._id} value={employee._id}>
                  {employee.fullName}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Domain
            <select
              value={filters.domain}
              onChange={(event) => updateFilter("domain", event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800"
            >
              <option value="">All domains</option>
              {domains.map((domain) => (
                <option key={domain._id} value={domain._id}>
                  {domain.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Department
            <select
              value={filters.department}
              onChange={(event) =>
                updateFilter("department", event.target.value)
              }
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800"
            >
              <option value="">All departments</option>
              {departmentOptions.map((department) => (
                <option key={department._id} value={department._id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Status
            <select
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800"
            >
              {STATUS_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <div className="sm:col-span-2 lg:col-span-5">
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-2 text-sm font-semibold text-green-800 hover:underline"
            >
              <Search size={15} />
              Clear filters
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-bold text-slate-900">Attendance records</h2>
            <p className="mt-1 text-sm text-slate-500">
              {pagination.total || 0} record(s) in your accessible scope
            </p>
          </div>

          {loading ? (
            <p className="p-8 text-center text-sm text-slate-500">
              Loading attendance...
            </p>
          ) : records.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              No attendance records match these filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-262.5 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Check-in</th>
                    <th className="px-4 py-3">Check-out</th>
                    <th className="px-4 py-3">Worked</th>
                    <th className="px-4 py-3">Approval</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {records.map((record) => (
                    <tr key={record._id} className="hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <p className="font-semibold text-slate-900">
                          {record.employee?.fullName || "Unknown employee"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {record.employee?.employeeCode || "—"}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        {record.attendanceDate}
                      </td>
                      <td className="px-4 py-4">
                        <p>{record.department?.name || "—"}</p>
                        <p className="text-xs text-slate-500">
                          {record.domain?.name || ""}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(record.status)}`}
                        >
                          {record.status?.replace("_", " ")}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        {displayTime(record.checkInAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        {displayTime(record.checkOutAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        {minutesLabel(record.workedMinutes)}
                      </td>
                      <td className="px-4 py-4">
                        {record.isApproved ? (
                          <span className="font-semibold text-green-700">
                            Approved
                          </span>
                        ) : (
                          <span className="font-semibold text-amber-700">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          {canManage && (
                            <>
                              <button
                                disabled={Boolean(busyId)}
                                onClick={() => openEditRecord(record)}
                                className="rounded-md border border-blue-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700 disabled:opacity-50"
                              >
                                {record.isApproved ? "Correct" : "Edit"}
                              </button>
                              <button
                                disabled={Boolean(busyId)}
                                onClick={() => deleteRecord(record)}
                                className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50"
                              >
                                Delete
                              </button>
                            </>
                          )}

                          {canApprove && !record.isApproved && (
                            <button
                              disabled={Boolean(busyId)}
                              onClick={() => approve(record._id)}
                              className="inline-flex items-center gap-1 rounded-md bg-green-700 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              <Check size={13} />
                              Approve
                            </button>
                          )}

                          {!canManage && !canApprove && (
                            <span className="text-xs text-slate-400">
                              View only
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-sm">
            <span className="text-slate-500">
              Page {pagination.page || page} of{" "}
              {Math.max(1, pagination.totalPages || 1)}
            </span>

            <div className="flex gap-2">
              <button
                disabled={page <= 1 || loading}
                onClick={() => setPage((value) => value - 1)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= (pagination.totalPages || 1) || loading}
                onClick={() => setPage((value) => value + 1)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default AttendanceManagementPage;
