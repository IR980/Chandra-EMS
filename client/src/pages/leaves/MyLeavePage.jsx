import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  FileText,
  RefreshCw,
  XCircle,
  AlertCircle,
  Wallet,
  ChevronLeft,
  ChevronRight,
  BriefcaseBusiness,
} from "lucide-react";

import api from "../../services/api";

const LEAVE_TYPES = [
  { value: "casual", label: "Casual Leave" },
  { value: "sick", label: "Sick Leave" },
  { value: "earned", label: "Earned Leave" },
  { value: "unpaid", label: "Unpaid Leave" },
];

const INITIAL_FORM = {
  leaveType: "casual",
  startDate: "",
  endDate: "",
  isHalfDay: false,
  halfDayPeriod: "first_half",
  reason: "",
};

const COMPANY_TIME_ZONE = "Asia/Kolkata";

const getCompanyDate = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: COMPANY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
};

const getCurrentYear = () => Number(getCompanyDate().slice(0, 4));

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const formatDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) return "—";

  if (
    new Date(startDate).toISOString().slice(0, 10) ===
    new Date(endDate).toISOString().slice(0, 10)
  ) {
    return formatDate(startDate);
  }

  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
};

const statusStyles = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  approved: "bg-green-50 text-green-700 ring-green-200",
  rejected: "bg-red-50 text-red-700 ring-red-200",
  cancelled: "bg-slate-100 text-slate-600 ring-slate-200",
};

const statusLabels = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const leaveTypeLabel = (type) =>
  LEAVE_TYPES.find((item) => item.value === type)?.label || type || "—";

const getErrorMessage = (error, fallback) =>
  error.response?.data?.message || error.message || fallback;

function MyLeavePage() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [balances, setBalances] = useState([]);
  const [leaveRecords, setLeaveRecords] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });

  const [page, setPage] = useState(1);
  const [year, setYear] = useState(getCurrentYear());
  const [policyOptions, setPolicyOptions] = useState({
    unpaidLeaveAllowed: true,
    halfDayLeaveAllowed: true,
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [balanceError, setBalanceError] = useState("");

  const today = getCompanyDate();

  const loadBalances = useCallback(async () => {
    setBalanceError("");

    try {
      const response = await api.get("/leaves/balances/me", {
        params: { year },
      });

      const data = response.data?.data || {};

      setBalances(data.balances || []);
      setPolicyOptions({
        unpaidLeaveAllowed: data.unpaidLeaveAllowed !== false,
        halfDayLeaveAllowed: data.halfDayLeaveAllowed !== false,
      });
    } catch (err) {
      setBalances([]);
      setBalanceError(getErrorMessage(err, "Unable to load leave balances."));
    }
  }, [year]);

  const loadLeaveHistory = useCallback(async () => {
    const response = await api.get("/leaves/me", {
      params: {
        page,
        limit: 10,
      },
    });

    const data = response.data?.data || {};

    setLeaveRecords(data.leaves || []);
    setPagination(
      data.pagination || {
        total: 0,
        page,
        limit: 10,
        totalPages: 1,
      },
    );
  }, [page]);

  const loadPageData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const results = await Promise.allSettled([
        loadBalances(),
        loadLeaveHistory(),
      ]);

      const historyResult = results[1];

      if (historyResult.status === "rejected") {
        throw historyResult.reason;
      }
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load your leave information."));
    } finally {
      setLoading(false);
    }
  }, [loadBalances, loadLeaveHistory]);

  useEffect(() => {
    Promise.resolve().then(() => {
      void loadPageData();
    });
  }, [loadPageData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPageData();
    setRefreshing(false);
  };

  const updateForm = (field, value) => {
    setForm((current) => {
      const updated = { ...current, [field]: value };

      if (field === "isHalfDay" && value) {
        updated.endDate = updated.startDate;
      }

      if (field === "startDate" && current.isHalfDay) {
        updated.endDate = value;
      }

      return updated;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!form.startDate || !form.endDate) {
      setError("Please select both leave start and end dates.");
      return;
    }

    if (form.startDate < today) {
      setError("Leave start date cannot be in the past.");
      return;
    }

    if (form.endDate < form.startDate) {
      setError("End date cannot be earlier than start date.");
      return;
    }

    if (form.startDate.slice(0, 4) !== form.endDate.slice(0, 4)) {
      setError(
        "Please submit separate applications for different calendar years.",
      );
      return;
    }

    if (form.isHalfDay && form.startDate !== form.endDate) {
      setError("Half-day leave must be for a single date.");
      return;
    }

    if (form.reason.trim().length < 5) {
      setError("Please enter a reason of at least 5 characters.");
      return;
    }

    if (form.leaveType === "unpaid" && !policyOptions.unpaidLeaveAllowed) {
      setError("Unpaid leave is currently disabled by your company policy.");
      return;
    }

    if (form.isHalfDay && !policyOptions.halfDayLeaveAllowed) {
      setError("Half-day leave is currently disabled by your company policy.");
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        leaveType: form.leaveType,
        startDate: form.startDate,
        endDate: form.endDate,
        isHalfDay: form.isHalfDay,
        halfDayPeriod: form.isHalfDay ? form.halfDayPeriod : null,
        reason: form.reason.trim(),
      };

      await api.post("/leaves", payload);

      setNotice("Your leave application has been submitted successfully.");
      setForm(INITIAL_FORM);
      setPage(1);

      await Promise.all([loadBalances(), loadLeaveHistory()]);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to submit leave application."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (leave) => {
    const confirmed = window.confirm(
      `Are you sure you want to cancel this ${leaveTypeLabel(leave.leaveType)} application?`,
    );

    if (!confirmed) return;

    setCancellingId(leave._id);
    setError("");
    setNotice("");

    try {
      await api.patch(`/leaves/${leave._id}/cancel`, {
        reason: "Cancelled by employee",
      });

      setNotice("Leave application cancelled successfully.");

      await Promise.all([loadBalances(), loadLeaveHistory()]);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to cancel leave application."));
    } finally {
      setCancellingId("");
    }
  };

  const getBalance = (type) =>
    balances.find((balance) => balance.leaveType === type);

  const getRemaining = (balance) => {
    if (!balance) return "—";

    const total =
      Number(balance.annualEntitlement || 0) +
      Number(balance.carriedForward || 0) +
      Number(balance.adjustment || 0);

    return Math.max(0, total - Number(balance.used || 0));
  };

  const getEntitlement = (balance) => {
    if (!balance) return "—";

    return (
      Number(balance.annualEntitlement || 0) +
      Number(balance.carriedForward || 0) +
      Number(balance.adjustment || 0)
    );
  };

  const summaryCards = [
    {
      type: "casual",
      title: "Casual Leave",
      icon: CalendarDays,
      color: "bg-blue-50 text-blue-700",
    },
    {
      type: "sick",
      title: "Sick Leave",
      icon: BriefcaseBusiness,
      color: "bg-rose-50 text-rose-700",
    },
    {
      type: "earned",
      title: "Earned Leave",
      icon: Wallet,
      color: "bg-purple-50 text-purple-700",
    },
  ];

  return (
    <main className="min-h-screen bg-[#f3f7f4]">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white px-4 py-4 shadow-sm sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#17613b] p-3 text-white">
              <CalendarDays size={22} />
            </div>
            <div>
              <h1 className="font-bold text-gray-900">Chandra Enterprises</h1>
              <p className="text-xs text-gray-500">
                Employee Management System
              </p>
            </div>
          </div>

          <Link
            to="/dashboard"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-green-700">
              Employee Self Service
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
              My Leave
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Apply for leave, check your available balance, and track requests.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={year}
              onChange={(event) => {
                setYear(Number(event.target.value));
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
            >
              {[
                getCurrentYear() - 1,
                getCurrentYear(),
                getCurrentYear() + 1,
              ].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={refreshing ? "animate-spin" : ""}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={19} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {notice && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
            <p>{notice}</p>
          </div>
        )}

        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Leave Balance
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Your available paid leave for {year}.
              </p>
            </div>
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
              {year}
            </span>
          </div>

          {balanceError && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              {balanceError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {summaryCards.map((card) => {
              const Icon = card.icon;
              const balance = getBalance(card.type);
              const remaining = getRemaining(balance);
              const entitlement = getEntitlement(balance);
              const used = Number(balance?.used || 0);

              return (
                <div
                  key={card.type}
                  className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className={`rounded-xl p-3 ${card.color}`}>
                      <Icon size={22} />
                    </div>
                    <span className="text-xs font-medium text-slate-400">
                      {year}
                    </span>
                  </div>

                  <p className="mt-4 text-sm font-medium text-slate-500">
                    {card.title}
                  </p>

                  <div className="mt-1 flex items-end gap-2">
                    <span className="text-3xl font-bold text-slate-900">
                      {loading ? "—" : remaining}
                    </span>
                    <span className="mb-1 text-sm text-slate-500">
                      days remaining
                    </span>
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-green-600 transition-all"
                      style={{
                        width: `${
                          Number(entitlement) > 0
                            ? Math.min(100, (used / Number(entitlement)) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>

                  <div className="mt-2 flex justify-between text-xs text-slate-500">
                    <span>Used: {loading ? "—" : used}</span>
                    <span>Total: {loading ? "—" : entitlement}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <Wallet size={19} className="mt-0.5 text-slate-500" />
              <div>
                <p className="font-semibold text-slate-800">Unpaid Leave</p>
                <p className="mt-1 text-sm text-slate-500">
                  {policyOptions.unpaidLeaveAllowed
                    ? "Unpaid leave is available according to company policy. It does not consume your paid leave balance."
                    : "Unpaid leave is currently disabled by company policy."}
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-green-50 p-3 text-green-700">
                <CalendarPlus size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Apply for Leave
                </h3>
                <p className="text-sm text-slate-500">
                  Submit a new leave request.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Leave Type
                </label>
                <select
                  value={form.leaveType}
                  onChange={(event) =>
                    updateForm("leaveType", event.target.value)
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                  required
                >
                  {LEAVE_TYPES.filter(
                    (item) =>
                      item.value !== "unpaid" ||
                      policyOptions.unpaidLeaveAllowed,
                  ).map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={form.startDate}
                    min={today}
                    onChange={(event) =>
                      updateForm("startDate", event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={form.endDate}
                    min={form.startDate || today}
                    disabled={form.isHalfDay}
                    onChange={(event) =>
                      updateForm("endDate", event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 disabled:bg-slate-100"
                    required
                  />
                </div>
              </div>

              {policyOptions.halfDayLeaveAllowed && (
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3">
                  <input
                    type="checkbox"
                    checked={form.isHalfDay}
                    onChange={(event) =>
                      updateForm("isHalfDay", event.target.checked)
                    }
                    className="h-4 w-4 rounded border-slate-300 text-green-700 focus:ring-green-600"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">
                      Half-day leave
                    </span>
                    <span className="block text-xs text-slate-500">
                      Apply for half a working day.
                    </span>
                  </span>
                </label>
              )}

              {form.isHalfDay && (
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Half-day period
                  </label>
                  <select
                    value={form.halfDayPeriod}
                    onChange={(event) =>
                      updateForm("halfDayPeriod", event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                  >
                    <option value="first_half">First half</option>
                    <option value="second_half">Second half</option>
                  </select>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Reason for Leave
                </label>
                <textarea
                  value={form.reason}
                  onChange={(event) => updateForm("reason", event.target.value)}
                  rows={4}
                  maxLength={1000}
                  placeholder="Explain why you need leave..."
                  className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                  required
                />
                <p className="mt-1 text-right text-xs text-slate-400">
                  {form.reason.length}/1000
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                Leave duration is calculated by the server using your domain's
                working days and active company holidays. Submission does not
                mean the leave is approved.
              </div>

              <button
                type="submit"
                disabled={submitting || loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#17613b] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#124d30] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <RefreshCw size={17} className="animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CalendarPlus size={17} />
                    Submit Leave Application
                  </>
                )}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Leave History
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Track your submitted leave applications.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {pagination.total} Applications
              </span>
            </div>

            {loading ? (
              <div className="flex min-h-48 items-center justify-center">
                <RefreshCw size={24} className="animate-spin text-green-700" />
              </div>
            ) : leaveRecords.length === 0 ? (
              <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-5 text-center">
                <div className="rounded-full bg-green-50 p-4 text-green-700">
                  <FileText size={27} />
                </div>
                <h4 className="mt-4 font-semibold text-slate-800">
                  No leave applications yet
                </h4>
                <p className="mt-1 max-w-xs text-sm text-slate-500">
                  Your submitted leave requests will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {leaveRecords.map((leave) => (
                  <article
                    key={leave._id}
                    className="rounded-xl border border-slate-200 p-4 transition hover:border-green-200"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-slate-900">
                          {leaveTypeLabel(leave.leaveType)}
                        </h4>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatDateRange(leave.startDate, leave.endDate)}
                        </p>
                      </div>

                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
                          statusStyles[leave.status] ||
                          "bg-slate-100 text-slate-600 ring-slate-200"
                        }`}
                      >
                        {statusLabels[leave.status] || leave.status}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 size={14} />
                        {Number(leave.requestedDays || 0)} day(s)
                      </span>

                      {leave.isHalfDay && (
                        <span className="rounded-md bg-purple-50 px-2 py-1 font-medium text-purple-700">
                          {leave.halfDayPeriod === "second_half"
                            ? "Second half"
                            : "First half"}
                        </span>
                      )}

                      <span>Applied: {formatDate(leave.appliedAt)}</span>
                    </div>

                    <p className="mt-3 text-sm leading-5 text-slate-600">
                      {leave.reason}
                    </p>

                    {leave.status === "rejected" && leave.rejectionReason && (
                      <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">
                        <strong>Rejection reason:</strong>{" "}
                        {leave.rejectionReason}
                      </div>
                    )}

                    {leave.status === "approved" && leave.approvedAt && (
                      <p className="mt-3 text-xs text-green-700">
                        Approved on {formatDate(leave.approvedAt)}
                      </p>
                    )}

                    {["pending", "approved"].includes(leave.status) && (
                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleCancel(leave)}
                          disabled={cancellingId === leave._id}
                          className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          <XCircle size={15} />
                          {cancellingId === leave._id
                            ? "Cancelling..."
                            : "Cancel Application"}
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}

            {pagination.totalPages > 1 && (
              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-500">
                  Page {pagination.page} of {pagination.totalPages}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setPage((current) => Math.max(1, current - 1))
                    }
                    disabled={page <= 1}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={17} />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setPage((current) =>
                        Math.min(pagination.totalPages, current + 1),
                      )
                    }
                    disabled={page >= pagination.totalPages}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    aria-label="Next page"
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        <footer className="mt-10 border-t border-slate-200 py-5 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Chandra Enterprises Agro. Employee
          Management System.
        </footer>
      </section>
    </main>
  );
}

export default MyLeavePage;
