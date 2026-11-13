import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Filter,
  LoaderCircle,
  RefreshCw,
  Search,
  X,
  XCircle,
} from "lucide-react";
import api from "../../services/api";

const PAGE_SIZE = 10;

const statusStyles = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-slate-100 text-slate-700",
};

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getErrorMessage = (error) =>
  error.response?.data?.message ||
  error.response?.data?.error ||
  error.message ||
  "Something went wrong. Please try again.";

const getEmployeeName = (leave) =>
  leave.employee?.fullName || leave.employee?.name || "Employee";

const getEmployeeCode = (leave) => leave.employee?.employeeCode || "—";

function LeaveManagementPage() {
  const [leaves, setLeaves] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 0,
  });

  const [statusFilter, setStatusFilter] = useState("pending");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [selectedLeave, setSelectedLeave] = useState(null);
  const [dialogAction, setDialogAction] = useState("");
  const [remarks, setRemarks] = useState("");

  const loadLeaves = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError("");

      try {
        const params = {
          page,
          limit: PAGE_SIZE,
        };

        if (statusFilter) params.status = statusFilter;
        if (typeFilter) params.leaveType = typeFilter;

        const response = await api.get("/leaves", { params });
        const data = response.data?.data || {};

        setLeaves(Array.isArray(data.leaves) ? data.leaves : []);
        setPagination(
          data.pagination || {
            page,
            total: 0,
            totalPages: 0,
          },
        );
      } catch (err) {
        setError(getErrorMessage(err));
        setLeaves([]);
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, typeFilter],
  );

  useEffect(() => {
    loadLeaves(1);
  }, [loadLeaves]);

  const filteredLeaves = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return leaves;

    return leaves.filter((leave) => {
      const searchable = [
        getEmployeeName(leave),
        getEmployeeCode(leave),
        leave.employee?.designation,
        leave.department?.name,
        leave.domain?.name,
        leave.leaveType,
        leave.reason,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(term);
    });
  }, [leaves, search]);

  const openDialog = (leave, action) => {
    setSelectedLeave(leave);
    setDialogAction(action);
    setRemarks("");
    setNotice("");
  };

  const closeDialog = () => {
    if (actionLoading) return;

    setSelectedLeave(null);
    setDialogAction("");
    setRemarks("");
  };

  const handleAction = async () => {
    if (!selectedLeave?._id) return;

    if (dialogAction === "reject" && remarks.trim().length < 3) {
      setError("Please enter a rejection reason of at least 3 characters.");
      return;
    }

    setActionLoading(selectedLeave._id);
    setError("");

    try {
      if (dialogAction === "approve") {
        await api.patch(`/leaves/${selectedLeave._id}/approve`, {
          remarks: remarks.trim(),
        });
      } else {
        await api.patch(`/leaves/${selectedLeave._id}/reject`, {
          reason: remarks.trim(),
        });
      }

      setNotice(
        dialogAction === "approve"
          ? "Leave application approved successfully."
          : "Leave application rejected successfully.",
      );

      setSelectedLeave(null);
      setDialogAction("");
      setRemarks("");

      await loadLeaves(pagination.page);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading("");
    }
  };

  const changePage = (nextPage) => {
    if (
      nextPage < 1 ||
      (pagination.totalPages > 0 && nextPage > pagination.totalPages)
    ) {
      return;
    }

    loadLeaves(nextPage);
  };

  const pendingCount = leaves.filter(
    (leave) => leave.status === "pending",
  ).length;

  return (
    <main className="min-h-screen bg-[#f3f7f4]">
      {/* Header */}
      <header className="border-b border-slate-100 bg-white px-4 py-4 shadow-sm sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#17613b] p-3 text-white">
              <CalendarDays size={23} />
            </div>

            <div>
              <h1 className="font-bold text-slate-900">Chandra Enterprises</h1>
              <p className="text-xs text-slate-500">Leave Management</p>
            </div>
          </div>

          <Link
            to="/dashboard"
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            Dashboard
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        {/* Page heading */}
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Employee Leave Requests
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Review and manage leave applications within your authorized
              organizational scope.
            </p>
          </div>

          <button
            onClick={() => loadLeaves(pagination.page)}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-green-200 bg-white px-4 py-2.5 text-sm font-semibold text-green-800 hover:bg-green-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Summary */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Matching Requests</p>
              <FileText className="text-blue-600" size={21} />
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {pagination.total}
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Pending on This Page</p>
              <Clock className="text-amber-600" size={21} />
            </div>
            <p className="mt-3 text-3xl font-bold text-amber-700">
              {pendingCount}
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Current Page</p>
              <CalendarDays className="text-green-700" size={21} />
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {pagination.page || 1}
              <span className="text-base font-medium text-slate-400">
                {" "}
                / {pagination.totalPages || 1}
              </span>
            </p>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p>{error}</p>
            <button onClick={() => setError("")} aria-label="Close error">
              <X size={17} />
            </button>
          </div>
        )}

        {notice && (
          <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <p>{notice}</p>
            <button onClick={() => setNotice("")} aria-label="Close notice">
              <X size={17} />
            </button>
          </div>
        )}

        {/* Filters */}
        <section className="mb-6 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Filter size={18} className="text-green-700" />
            <h3 className="font-semibold text-slate-900">
              Filter Leave Requests
            </h3>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Application Status
              </label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-600"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Leave Type
              </label>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-600"
              >
                <option value="">All Leave Types</option>
                <option value="casual">Casual Leave</option>
                <option value="sick">Sick Leave</option>
                <option value="earned">Earned Leave</option>
                <option value="unpaid">Unpaid Leave</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Search Current Page
              </label>
              <div className="relative">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Employee name or code..."
                  className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-green-600"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Leave requests */}
        <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
            <div>
              <h3 className="font-bold text-slate-900">Leave Applications</h3>
              <p className="mt-1 text-xs text-slate-500">
                {pagination.total} matching application(s)
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-slate-500">
              <LoaderCircle size={22} className="animate-spin text-green-700" />
              Loading leave applications...
            </div>
          ) : filteredLeaves.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
              <CalendarDays size={42} className="mb-3 text-slate-300" />
              <h4 className="font-semibold text-slate-800">
                No leave applications found
              </h4>
              <p className="mt-1 text-sm text-slate-500">
                Try changing the filters or check again later.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredLeaves.map((leave) => (
                <article
                  key={leave._id}
                  className="p-5 transition hover:bg-slate-50/70"
                >
                  <div className="flex flex-col justify-between gap-4 lg:flex-row">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-slate-900">
                          {getEmployeeName(leave)}
                        </h4>

                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
                          {getEmployeeCode(leave)}
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                            statusStyles[leave.status] ||
                            "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {leave.status}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                        <div>
                          <p className="text-xs text-slate-400">Leave Type</p>
                          <p className="mt-1 font-semibold capitalize text-slate-800">
                            {leave.leaveType?.replace("_", " ")} Leave
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-400">Department</p>
                          <p className="mt-1 font-medium text-slate-800">
                            {leave.department?.name || "—"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-400">Designation</p>
                          <p className="mt-1 font-medium text-slate-800">
                            {leave.employee?.designation || "—"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-400">Start Date</p>
                          <p className="mt-1 font-medium text-slate-800">
                            {formatDate(leave.startDate)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-400">End Date</p>
                          <p className="mt-1 font-medium text-slate-800">
                            {formatDate(leave.endDate)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-400">
                            Requested Days
                          </p>
                          <p className="mt-1 font-semibold text-slate-800">
                            {leave.requestedDays ?? "—"}
                            {leave.isHalfDay && (
                              <span className="ml-2 text-xs font-normal text-slate-500">
                                ({leave.halfDayPeriod?.replace("_", " ")})
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-lg bg-slate-50 p-3">
                        <p className="text-xs font-semibold text-slate-500">
                          Employee Reason
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                          {leave.reason || "No reason provided."}
                        </p>
                      </div>

                      {leave.status === "rejected" && leave.rejectionReason && (
                        <p className="mt-3 text-sm text-red-700">
                          <strong>Rejection reason:</strong>{" "}
                          {leave.rejectionReason}
                        </p>
                      )}
                    </div>

                    {leave.status === "pending" && (
                      <div className="flex shrink-0 flex-row items-start gap-2 lg:flex-col">
                        <button
                          onClick={() => openDialog(leave, "approve")}
                          disabled={Boolean(actionLoading)}
                          className="flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50"
                        >
                          <Check size={16} />
                          Approve
                        </button>

                        <button
                          onClick={() => openDialog(leave, "reject")}
                          disabled={Boolean(actionLoading)}
                          className="flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          <XCircle size={16} />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4">
            <p className="text-sm text-slate-500">
              Page {pagination.page || 1} of {pagination.totalPages || 1}
              {" · "}
              {pagination.total || 0} total requests
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => changePage(pagination.page - 1)}
                disabled={loading || pagination.page <= 1}
                className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft size={18} />
              </button>

              <button
                onClick={() => changePage(pagination.page + 1)}
                disabled={
                  loading ||
                  !pagination.totalPages ||
                  pagination.page >= pagination.totalPages
                }
                className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </section>
      </section>

      {/* Approve / Reject dialog */}
      {selectedLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {dialogAction === "approve"
                    ? "Approve Leave Application"
                    : "Reject Leave Application"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {getEmployeeName(selectedLeave)} ·{" "}
                  {selectedLeave.requestedDays} day(s)
                </p>
              </div>

              <button
                onClick={closeDialog}
                disabled={Boolean(actionLoading)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                aria-label="Close dialog"
              >
                <X size={19} />
              </button>
            </div>

            <div
              className={`mb-4 rounded-lg p-3 text-sm ${
                dialogAction === "approve"
                  ? "bg-green-50 text-green-800"
                  : "bg-red-50 text-red-800"
              }`}
            >
              {dialogAction === "approve"
                ? "Approval will update the employee's leave balance where applicable."
                : "A rejection reason is required and will be saved in the application history."}
            </div>

            <label className="mb-2 block text-sm font-semibold text-slate-700">
              {dialogAction === "approve"
                ? "Remarks (optional)"
                : "Rejection Reason"}
            </label>

            <textarea
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              rows={4}
              maxLength={1000}
              placeholder={
                dialogAction === "approve"
                  ? "Add an approval remark..."
                  : "Explain why this leave application is being rejected..."
              }
              className="w-full resize-y rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-green-600"
            />

            <p className="mt-1 text-right text-xs text-slate-400">
              {remarks.length}/1000 characters
            </p>

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={closeDialog}
                disabled={Boolean(actionLoading)}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={handleAction}
                disabled={
                  Boolean(actionLoading) ||
                  (dialogAction === "reject" && remarks.trim().length < 3)
                }
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                  dialogAction === "approve"
                    ? "bg-green-700 hover:bg-green-800"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {actionLoading ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : dialogAction === "approve" ? (
                  <Check size={16} />
                ) : (
                  <XCircle size={16} />
                )}

                {actionLoading
                  ? "Processing..."
                  : dialogAction === "approve"
                    ? "Confirm Approval"
                    : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default LeaveManagementPage;
