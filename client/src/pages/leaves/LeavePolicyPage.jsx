import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Plus,
  Save,
  Trash2,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Power,
} from "lucide-react";
import api from "../../services/api";

const CURRENT_YEAR = new Date().getFullYear();

const WEEKDAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const EMPTY_FORM = {
  domain: "",
  year: CURRENT_YEAR,
  leaveEntitlements: {
    casual: 12,
    sick: 12,
    earned: 15,
    unpaid: 0,
  },
  workingDays: [1, 2, 3, 4, 5, 6],
  holidays: [],
  allowUnpaidLeave: true,
  allowHalfDayLeave: true,
  isActive: true,
};

const inputClass =
  "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100";

const getId = (value) => {
  if (!value) return "";
  return typeof value === "object" ? value._id || "" : value;
};

const toDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const createFormFromPolicy = (policy) => ({
  domain: getId(policy.domain),
  year: policy.year,
  leaveEntitlements: {
    casual: policy.leaveEntitlements?.casual ?? 12,
    sick: policy.leaveEntitlements?.sick ?? 12,
    earned: policy.leaveEntitlements?.earned ?? 15,
    unpaid: policy.leaveEntitlements?.unpaid ?? 0,
  },
  workingDays: policy.workingDays || [1, 2, 3, 4, 5, 6],
  holidays: (policy.holidays || []).map((holiday) => ({
    _id: holiday._id,
    date: toDateInput(holiday.date),
    name: holiday.name || "",
    isActive: holiday.isActive !== false,
  })),
  allowUnpaidLeave: policy.allowUnpaidLeave !== false,
  allowHalfDayLeave: policy.allowHalfDayLeave !== false,
  isActive: policy.isActive !== false,
});

function LeavePolicyPage() {
  const [domains, setDomains] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState("");

  const [filterYear, setFilterYear] = useState(CURRENT_YEAR);
  const [filterDomain, setFilterDomain] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadDomains = useCallback(async () => {
    const response = await api.get("/domains", {
      params: { status: "active", page: 1, limit: 100 },
    });

    setDomains(response.data?.data?.domains || []);
  }, []);

  const loadPolicies = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = { year: filterYear };

      if (filterDomain) params.domain = filterDomain;

      const response = await api.get("/leaves/policies", { params });
      setPolicies(response.data?.data?.policies || []);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load leave policies.");
    } finally {
      setLoading(false);
    }
  }, [filterYear, filterDomain]);

  useEffect(() => {
    const initialize = async () => {
      try {
        await loadDomains();
      } catch (err) {
        setError(
          err.response?.data?.message || "Unable to load domain information.",
        );
        setLoading(false);
      }
    };

    initialize();
  }, [loadDomains]);

  useEffect(() => {
    Promise.resolve().then(() => {
      void loadPolicies();
    });
  }, [loadPolicies]);

  const availableDomains = useMemo(
    () => domains.filter((domain) => domain.status !== "inactive"),
    [domains],
  );

  const updateEntitlement = (type, value) => {
    setForm((current) => ({
      ...current,
      leaveEntitlements: {
        ...current.leaveEntitlements,
        [type]: value,
      },
    }));
  };

  const toggleWorkingDay = (day) => {
    setForm((current) => {
      const selected = current.workingDays.includes(day);

      return {
        ...current,
        workingDays: selected
          ? current.workingDays.filter((item) => item !== day)
          : [...current.workingDays, day].sort((a, b) => a - b),
      };
    });
  };

  const addHoliday = () => {
    setForm((current) => ({
      ...current,
      holidays: [...current.holidays, { date: "", name: "", isActive: true }],
    }));
  };

  const updateHoliday = (index, field, value) => {
    setForm((current) => ({
      ...current,
      holidays: current.holidays.map((holiday, holidayIndex) =>
        holidayIndex === index ? { ...holiday, [field]: value } : holiday,
      ),
    }));
  };

  const removeHoliday = (index) => {
    setForm((current) => ({
      ...current,
      holidays: current.holidays.filter(
        (_, holidayIndex) => holidayIndex !== index,
      ),
    }));
  };

  const resetForm = () => {
    setEditingId("");
    setForm({
      ...EMPTY_FORM,
      domain: "",
      year: filterYear || CURRENT_YEAR,
      leaveEntitlements: { ...EMPTY_FORM.leaveEntitlements },
      workingDays: [...EMPTY_FORM.workingDays],
      holidays: [],
    });
    setError("");
    setNotice("");
  };

  const startEditing = (policy) => {
    setEditingId(policy._id);
    setForm(createFormFromPolicy(policy));
    setError("");
    setNotice("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!editingId && !form.domain) {
      setError("Please select a domain.");
      return;
    }

    if (
      !Number.isInteger(Number(form.year)) ||
      Number(form.year) < 2000 ||
      Number(form.year) > 2100
    ) {
      setError("Enter a valid policy year between 2000 and 2100.");
      return;
    }

    if (form.workingDays.length === 0) {
      setError("Select at least one working day.");
      return;
    }

    for (const [type, value] of Object.entries(form.leaveEntitlements)) {
      if (!Number.isFinite(Number(value)) || Number(value) < 0) {
        setError(`Enter a valid non-negative ${type} leave entitlement.`);
        return;
      }
    }

    for (let index = 0; index < form.holidays.length; index += 1) {
      const holiday = form.holidays[index];

      if (!holiday.date || !holiday.name.trim()) {
        setError(`Complete the date and name for holiday ${index + 1}.`);
        return;
      }
    }

    const holidayDates = form.holidays.map((holiday) => holiday.date);
    if (new Set(holidayDates).size !== holidayDates.length) {
      setError("Duplicate holiday dates are not allowed.");
      return;
    }

    const payload = {
      leaveEntitlements: {
        casual: Number(form.leaveEntitlements.casual),
        sick: Number(form.leaveEntitlements.sick),
        earned: Number(form.leaveEntitlements.earned),
        unpaid: Number(form.leaveEntitlements.unpaid),
      },
      workingDays: [...form.workingDays].sort((a, b) => a - b),
      holidays: form.holidays.map((holiday) => ({
        ...(holiday._id ? { _id: holiday._id } : {}),
        date: holiday.date,
        name: holiday.name.trim(),
        isActive: holiday.isActive !== false,
      })),
      allowUnpaidLeave: form.allowUnpaidLeave,
      allowHalfDayLeave: form.allowHalfDayLeave,
      isActive: form.isActive,
    };

    if (!editingId) {
      payload.domain = form.domain;
      payload.year = Number(form.year);
    }

    setSaving(true);

    try {
      const response = editingId
        ? await api.patch(`/leaves/policies/${editingId}`, payload)
        : await api.post("/leaves/policies", payload);

      setNotice(
        response.data?.message ||
          (editingId
            ? "Leave policy updated successfully."
            : "Leave policy created successfully."),
      );

      resetForm();
      await loadPolicies();
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to save the leave policy.",
      );
    } finally {
      setSaving(false);
    }
  };

  const inputNumber = (value) =>
    value === "" ? "" : Math.max(0, Number(value));

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-7">
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
              <div className="rounded-xl bg-indigo-100 p-3 text-indigo-700">
                <Settings2 size={25} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Leave Policy Management
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Configure annual leave rules and company holidays by domain.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              resetForm();
              loadPolicies();
            }}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
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

        {/* Policy form */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="font-bold text-slate-900">
                {editingId ? "Update Leave Policy" : "Create Leave Policy"}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Set leave entitlements, working schedule and holiday calendar.
              </p>
            </div>

            {editingId && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                Editing existing policy
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-7 p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                Domain
                <select
                  className={inputClass}
                  value={form.domain}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      domain: event.target.value,
                    }))
                  }
                  disabled={Boolean(editingId)}
                  required
                >
                  <option value="">Select domain</option>
                  {availableDomains.map((domain) => (
                    <option key={domain._id} value={domain._id}>
                      {domain.name} ({domain.code})
                    </option>
                  ))}
                </select>
                {editingId && (
                  <span className="mt-1 block text-xs font-normal text-slate-400">
                    Domain cannot be changed after policy creation.
                  </span>
                )}
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Policy Year
                <input
                  className={inputClass}
                  type="number"
                  min="2000"
                  max="2100"
                  value={form.year}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      year: event.target.value,
                    }))
                  }
                  disabled={Boolean(editingId)}
                  required
                />
                {editingId && (
                  <span className="mt-1 block text-xs font-normal text-slate-400">
                    Year cannot be changed after policy creation.
                  </span>
                )}
              </label>
            </div>

            <div>
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
                <CalendarDays size={18} className="text-green-700" />
                Annual Leave Entitlements
              </h3>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["casual", "Casual Leave"],
                  ["sick", "Sick Leave"],
                  ["earned", "Earned Leave"],
                  ["unpaid", "Unpaid Leave"],
                ].map(([type, label]) => (
                  <label
                    key={type}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <span className="text-sm font-semibold text-slate-700">
                      {label}
                    </span>
                    <input
                      className={inputClass}
                      type="number"
                      min="0"
                      step="0.5"
                      value={form.leaveEntitlements[type]}
                      onChange={(event) =>
                        updateEntitlement(type, inputNumber(event.target.value))
                      }
                      required
                    />
                    <span className="mt-1 block text-xs text-slate-400">
                      Days per year
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-3 font-semibold text-slate-900">
                Weekly Working Days
              </h3>
              <p className="mb-3 text-xs text-slate-500">
                Select the days counted as working days for leave calculations.
              </p>

              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((day) => {
                  const selected = form.workingDays.includes(day.value);

                  return (
                    <label
                      key={day.value}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                        selected
                          ? "border-green-600 bg-green-50 text-green-800"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleWorkingDay(day.value)}
                        className="accent-green-700"
                      />
                      {day.label}
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">
                    Company Holidays
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Active holidays are excluded from working-day leave
                    calculations.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addHoliday}
                  className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-800 hover:bg-green-100"
                >
                  <Plus size={16} />
                  Add Holiday
                </button>
              </div>

              {form.holidays.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  No holidays added to this policy.
                </div>
              ) : (
                <div className="space-y-3">
                  {form.holidays.map((holiday, index) => (
                    <div
                      key={holiday._id || `holiday-${index}`}
                      className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_1.5fr_auto_auto]"
                    >
                      <label className="text-xs font-semibold text-slate-600">
                        Holiday Date
                        <input
                          type="date"
                          className={inputClass}
                          value={holiday.date}
                          onChange={(event) =>
                            updateHoliday(index, "date", event.target.value)
                          }
                          required
                        />
                      </label>

                      <label className="text-xs font-semibold text-slate-600">
                        Holiday Name
                        <input
                          type="text"
                          className={inputClass}
                          placeholder="e.g. Republic Day"
                          maxLength={150}
                          value={holiday.name}
                          onChange={(event) =>
                            updateHoliday(index, "name", event.target.value)
                          }
                          required
                        />
                      </label>

                      <label className="flex items-center gap-2 self-end pb-2 text-xs font-medium text-slate-600">
                        <input
                          type="checkbox"
                          checked={holiday.isActive !== false}
                          onChange={(event) =>
                            updateHoliday(
                              index,
                              "isActive",
                              event.target.checked,
                            )
                          }
                          className="accent-green-700"
                        />
                        Active
                      </label>

                      <button
                        type="button"
                        onClick={() => removeHoliday(index)}
                        className="self-end rounded-lg p-2 text-red-600 hover:bg-red-50"
                        title="Remove holiday"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="mb-3 font-semibold text-slate-900">Leave Rules</h3>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
                  <input
                    type="checkbox"
                    checked={form.allowUnpaidLeave}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        allowUnpaidLeave: event.target.checked,
                      }))
                    }
                    className="mt-1 accent-green-700"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">
                      Allow Unpaid Leave
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      Employees may apply for unpaid leave.
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
                  <input
                    type="checkbox"
                    checked={form.allowHalfDayLeave}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        allowHalfDayLeave: event.target.checked,
                      }))
                    }
                    className="mt-1 accent-green-700"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">
                      Allow Half-Day Leave
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      Employees may apply for first-half or second-half leave.
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        isActive: event.target.checked,
                      }))
                    }
                    className="mt-1 accent-green-700"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">
                      Policy Active
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      Inactive policies are not used for new leave applications.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel Editing
                </button>
              )}

              <button
                type="submit"
                disabled={saving || availableDomains.length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <Save size={17} />
                )}
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Policy"
                    : "Create Policy"}
              </button>
            </div>
          </form>
        </section>

        {/* Existing policies */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 p-5">
            <div>
              <h2 className="font-bold text-slate-900">Existing Policies</h2>
              <p className="mt-1 text-xs text-slate-500">
                View and update the configured leave policies.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <label className="text-xs font-semibold text-slate-600">
                Year
                <input
                  type="number"
                  min="2000"
                  max="2100"
                  className="mt-1 block w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={filterYear}
                  onChange={(event) =>
                    setFilterYear(Number(event.target.value) || CURRENT_YEAR)
                  }
                />
              </label>

              <label className="text-xs font-semibold text-slate-600">
                Domain
                <select
                  className="mt-1 block min-w-40 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={filterDomain}
                  onChange={(event) => setFilterDomain(event.target.value)}
                >
                  <option value="">All accessible domains</option>
                  {availableDomains.map((domain) => (
                    <option key={domain._id} value={domain._id}>
                      {domain.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500">
              <Loader2 size={18} className="animate-spin" />
              Loading leave policies...
            </div>
          ) : policies.length === 0 ? (
            <div className="p-10 text-center">
              <ShieldCheck size={32} className="mx-auto mb-3 text-slate-300" />
              <p className="font-semibold text-slate-700">
                No leave policies found
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Select another year or domain, or create a new policy above.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {policies.map((policy) => (
                <article
                  key={policy._id}
                  className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-slate-900">
                        {policy.domain?.name || "Domain"}
                      </h3>

                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {policy.year}
                      </span>

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          policy.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {policy.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                      {[
                        ["Casual", policy.leaveEntitlements?.casual],
                        ["Sick", policy.leaveEntitlements?.sick],
                        ["Earned", policy.leaveEntitlements?.earned],
                        ["Unpaid", policy.leaveEntitlements?.unpaid],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="rounded-lg bg-slate-50 px-3 py-2"
                        >
                          <p className="text-xs text-slate-500">{label}</p>
                          <p className="mt-0.5 font-semibold text-slate-800">
                            {value ?? 0} days
                          </p>
                        </div>
                      ))}
                    </div>

                    <p className="mt-3 text-xs text-slate-500">
                      Working days:{" "}
                      {(policy.workingDays || [])
                        .map(
                          (value) =>
                            WEEKDAYS.find((day) => day.value === value)?.label,
                        )
                        .filter(Boolean)
                        .join(", ") || "Not configured"}
                      {" · "}
                      Holidays:{" "}
                      {
                        (policy.holidays || []).filter(
                          (holiday) => holiday.isActive !== false,
                        ).length
                      }
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => startEditing(policy)}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-800 hover:bg-green-100"
                  >
                    <Settings2 size={16} />
                    Edit Policy
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
          <Power size={18} className="mt-0.5 shrink-0" />
          <p>
            Leave policies apply to new leave calculations. Changing an
            entitlement does not automatically rewrite previously used leave
            balances. Review employee balances separately when policy changes
            require adjustments.
          </p>
        </div>
      </div>
    </main>
  );
}

export default LeavePolicyPage;
