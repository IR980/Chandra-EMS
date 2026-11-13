import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  Clock3,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import api from "../../services/api";

const getCompanyDate = () => {
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

const formatTime = (value) => {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
};

const formatMinutes = (minutes = 0) => {
  const value = Math.max(0, Number(minutes) || 0);
  return `${Math.floor(value / 60)}h ${value % 60}m`;
};

const statusClass = (status) =>
  ({
    present: "bg-green-100 text-green-800",
    absent: "bg-red-100 text-red-700",
    half_day: "bg-amber-100 text-amber-800",
    leave: "bg-blue-100 text-blue-800",
    holiday: "bg-purple-100 text-purple-800",
    week_off: "bg-slate-100 text-slate-700",
  })[status] || "bg-gray-100 text-gray-700";

function MyAttendancePage() {
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  });

  const [page, setPage] = useState(1);
  const [month, setMonth] = useState(getCompanyDate().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [noEmployeeProfile, setNoEmployeeProfile] = useState(false);

  const today = getCompanyDate();

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    setError("");
    setNoEmployeeProfile(false);

    try {
      const year = Number(month.slice(0, 4));
      const monthNumber = Number(month.slice(5, 7));
      const lastDay = new Date(year, monthNumber, 0).getDate();

      const from = `${month}-01`;
      const to = `${month}-${String(lastDay).padStart(2, "0")}`;

      const response = await api.get("/attendance/me", {
        params: { from, to, page, limit: 20 },
      });

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
      const message =
        err.response?.data?.message || "Unable to load your attendance.";

      // A Super Admin or another non-employee account can manage company
      // attendance, but cannot use the personal attendance endpoint.
      if (
        err.response?.status === 403 &&
        /no employee profile is linked to your account/i.test(message)
      ) {
        setNoEmployeeProfile(true);
        setRecords([]);
        setPagination({
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 1,
        });
        setError("");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [month, page]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const todayRecord = useMemo(
    () => records.find((item) => item.attendanceDate === today),
    [records, today],
  );

  const stats = useMemo(
    () => ({
      present: records.filter((item) => item.status === "present").length,
      absent: records.filter((item) => item.status === "absent").length,
      halfDay: records.filter((item) => item.status === "half_day").length,
      minutes: records.reduce(
        (sum, item) => sum + (Number(item.workedMinutes) || 0),
        0,
      ),
    }),
    [records],
  );

  const runAction = async (action) => {
    setActionLoading(action);
    setError("");
    setNotice("");

    try {
      const response =
        action === "check-in"
          ? await api.post("/attendance/check-in")
          : await api.patch("/attendance/check-out");

      setNotice(response.data?.message || "Attendance updated.");
      await loadAttendance();
    } catch (err) {
      setError(err.response?.data?.message || "Attendance action failed.");
    } finally {
      setActionLoading("");
    }
  };

  const checkedIn = Boolean(todayRecord?.checkInAt);
  const checkedOut = Boolean(todayRecord?.checkOutAt);

  return (
    <main className="min-h-screen bg-[#f3f7f4] px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-green-700">
              Employee self-service
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
              My Attendance
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Record your daily check-in and check-out.
            </p>
          </div>

          <button
            type="button"
            onClick={loadAttendance}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
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

        {noEmployeeProfile ? (
          <section className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mx-auto max-w-2xl text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                <ShieldCheck size={28} />
              </div>

              <h2 className="mt-4 text-xl font-bold text-slate-900">
                Company administrator account
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Your Super Admin account is not linked to an employee profile.
                Personal check-in and check-out are available only to accounts
                linked to an employee record. Your existing Super Admin access
                is not affected.
              </p>

              <div className="mt-6 rounded-xl bg-slate-50 p-4 text-left">
                <p className="text-sm font-semibold text-slate-800">
                  What you can do
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Open Attendance Management to view employee attendance, record
                  attendance, and manage approvals using your administrator
                  permissions.
                </p>
              </div>

              <Link
                to="/attendance"
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-green-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-800"
              >
                <CalendarDays size={17} />
                Open Attendance Management
              </Link>
            </div>
          </section>
        ) : (
          <>
            <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Present", stats.present, "text-green-700"],
                ["Absent", stats.absent, "text-red-600"],
                ["Half days", stats.halfDay, "text-amber-600"],
                [
                  "Recorded work time",
                  formatMinutes(stats.minutes),
                  "text-slate-900",
                ],
              ].map(([label, value, color]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
                >
                  <p className="text-sm text-slate-500">{label}</p>
                  <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </section>

            <section className="mb-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Today's attendance
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {today} · India Standard Time
                  </p>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClass(todayRecord?.status)}`}
                >
                  {todayRecord?.status?.replace("_", " ") || "Not checked in"}
                </span>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">Check-in</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {formatTime(todayRecord?.checkInAt)}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">Check-out</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {formatTime(todayRecord?.checkOutAt)}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">Worked time</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {formatMinutes(todayRecord?.workedMinutes)}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={Boolean(actionLoading) || checkedIn || loading}
                  onClick={() => runAction("check-in")}
                  className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-5 py-3 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <LogIn size={17} />
                  {actionLoading === "check-in" ? "Checking in..." : "Check in"}
                </button>

                <button
                  type="button"
                  disabled={
                    Boolean(actionLoading) ||
                    !checkedIn ||
                    checkedOut ||
                    loading
                  }
                  onClick={() => runAction("check-out")}
                  className="inline-flex items-center gap-2 rounded-lg border border-green-700 px-5 py-3 text-sm font-semibold text-green-800 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <LogOut size={17} />
                  {actionLoading === "check-out"
                    ? "Checking out..."
                    : "Check out"}
                </button>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                You can check out only after checking in. The server records the
                official time.
              </p>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
                <div>
                  <h2 className="font-bold text-slate-900">
                    Attendance history
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Your records for the selected month.
                  </p>
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <CalendarDays size={16} />
                  <input
                    type="month"
                    value={month}
                    onChange={(event) => {
                      setMonth(event.target.value);
                      setPage(1);
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              {loading ? (
                <p className="p-8 text-center text-sm text-slate-500">
                  Loading attendance...
                </p>
              ) : records.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-500">
                  No attendance records found for this month.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-180 text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Date</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Check-in</th>
                        <th className="px-5 py-3">Check-out</th>
                        <th className="px-5 py-3">Worked</th>
                        <th className="px-5 py-3">Approval</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {records.map((item) => (
                        <tr key={item._id} className="hover:bg-slate-50">
                          <td className="px-5 py-4 font-medium text-slate-800">
                            {item.attendanceDate}
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(item.status)}`}
                            >
                              {item.status.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            {formatTime(item.checkInAt)}
                          </td>
                          <td className="px-5 py-4">
                            {formatTime(item.checkOutAt)}
                          </td>
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center gap-1">
                              <Clock3 size={14} />
                              {formatMinutes(item.workedMinutes)}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            {item.isApproved ? (
                              <span className="font-semibold text-green-700">
                                Approved
                              </span>
                            ) : (
                              <span className="text-amber-700">Pending</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-sm">
                <span className="text-slate-500">
                  {pagination.total || 0} record(s)
                </span>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((value) => value - 1)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40"
                  >
                    Previous
                  </button>

                  <span className="px-2 py-1.5 text-slate-600">
                    {pagination.page || page} /{" "}
                    {Math.max(1, pagination.totalPages || 1)}
                  </span>

                  <button
                    type="button"
                    disabled={page >= (pagination.totalPages || 1) || loading}
                    onClick={() => setPage((value) => value + 1)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

export default MyAttendancePage;
