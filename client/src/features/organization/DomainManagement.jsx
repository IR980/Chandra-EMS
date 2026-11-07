import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  ArrowLeft,
  Plus,
  Search,
  Pencil,
  Power,
  Building2,
  RefreshCw,
  X,
  Loader2,
  UserRound,
  UserCheck,
} from "lucide-react";
import api from "../../services/api";

const emptyForm = {
  name: "",
  code: "",
  description: "",
  head: "",
};

const getId = (value) => {
  if (!value) return "";
  return typeof value === "object" ? value._id || "" : value;
};

const getEmployeeName = (employee) =>
  employee.fullName ||
  `${employee.firstName || ""} ${employee.lastName || ""}`.trim() ||
  "Employee";

export default function DomainManagement() {
  const user = useSelector((state) => state.auth.user);
  const permissions = user?.role?.permissions || [];

  const canManage =
    permissions.includes("*") || permissions.includes("domains.manage");

  const canViewEmployees =
    permissions.includes("*") || permissions.includes("employees.view");

  const [domains, setDomains] = useState([]);
  const [domainTotal, setDomainTotal] = useState(0);

  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeeLoadError, setEmployeeLoadError] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [originalHeadId, setOriginalHeadId] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadDomains = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/domains", {
        params: {
          search: search.trim(),
          status,
          page: 1,
          limit: 100,
        },
      });

      const data = response.data.data || {};

      setDomains(data.domains || []);
      setDomainTotal(data.pagination?.total ?? data.domains?.length ?? 0);
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to load business domains.",
      );
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    loadDomains();
  }, [loadDomains]);

  // Load all active employees so the domain-head dropdown
  // does not silently omit employees after the first page.
  const loadEligibleEmployees = async (domainId) => {
    if (!canViewEmployees) {
      setEmployees([]);
      setEmployeeLoadError(
        "You need employees.view permission to select a domain head.",
      );
      return;
    }

    try {
      setEmployeesLoading(true);
      setEmployeeLoadError("");

      const firstResponse = await api.get("/employees", {
        params: {
          employmentStatus: "active",
          page: 1,
          limit: 100,
        },
      });

      const firstData = firstResponse.data.data || {};
      const allEmployees = firstData.employees || [];
      const totalPages = Math.max(
        1,
        Number(firstData.pagination?.totalPages) || 1,
      );

      if (totalPages > 1) {
        const remainingResponses = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, index) =>
            api.get("/employees", {
              params: {
                employmentStatus: "active",
                page: index + 2,
                limit: 100,
              },
            }),
          ),
        );

        remainingResponses.forEach((response) => {
          allEmployees.push(...(response.data.data?.employees || []));
        });
      }

      const eligibleEmployees = allEmployees.filter(
        (employee) =>
          employee.employmentStatus === "active" &&
          getId(employee.domain) === domainId,
      );

      setEmployees(eligibleEmployees);
    } catch (err) {
      setEmployees([]);
      setEmployeeLoadError(
        err.response?.data?.message ||
          "Unable to load active employees for this domain.",
      );
    } finally {
      setEmployeesLoading(false);
    }
  };

  const openCreateForm = () => {
    setEditingId(null);
    setOriginalHeadId("");
    setForm(emptyForm);
    setEmployees([]);
    setEmployeeLoadError("");
    setError("");
    setMessage("");
    setShowForm(true);
  };

  const openEditForm = async (domain) => {
    const currentHeadId = getId(domain.head);

    setEditingId(domain._id);
    setOriginalHeadId(currentHeadId);

    setForm({
      name: domain.name || "",
      code: domain.code || "",
      description: domain.description || "",
      head: currentHeadId,
    });

    setEmployees([]);
    setEmployeeLoadError("");
    setError("");
    setMessage("");
    setShowForm(true);

    await loadEligibleEmployees(domain._id);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setForm(emptyForm);
    setEditingId(null);
    setOriginalHeadId("");
    setEmployees([]);
    setEmployeeLoadError("");
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!canManage) {
      setError("You do not have permission to manage domains.");
      return;
    }

    if (!form.name.trim() || !form.code.trim()) {
      setError("Domain name and domain code are required.");
      return;
    }

    if (form.name.trim().length > 100) {
      setError("Domain name cannot exceed 100 characters.");
      return;
    }

    if (form.code.trim().length > 20) {
      setError("Domain code cannot exceed 20 characters.");
      return;
    }

    if (form.description.length > 500) {
      setError("Description cannot exceed 500 characters.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const payload = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        description: form.description.trim(),
      };

      if (editingId) {
        // Only send head when the user actually changes it.
        // This avoids accidentally revalidating an existing
        // head when only the domain name or description changes.
        if (form.head !== originalHeadId) {
          payload.head = form.head || null;
        }

        await api.patch(`/domains/${editingId}`, payload);
        setMessage("Business domain updated successfully.");
      } else {
        // New domains are created without a head.
        await api.post("/domains", payload);
        setMessage("Business domain created successfully.");
      }

      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      setOriginalHeadId("");
      setEmployees([]);

      await loadDomains();
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to save business domain.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (domain) => {
    const confirmed = window.confirm(
      `Are you sure you want to deactivate "${domain.name}"?`,
    );

    if (!confirmed) return;

    try {
      setError("");
      setMessage("");

      await api.patch(`/domains/${domain._id}/deactivate`);

      setMessage(`${domain.name} has been deactivated.`);
      await loadDomains();
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to deactivate this domain.",
      );
    }
  };

  const activeEmployees = employees;

  return (
    <main className="min-h-screen bg-[#f3f7f4] p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              to="/organization"
              className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-green-700"
            >
              <ArrowLeft size={16} />
              Organization
            </Link>

            <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-700">
              Chandra Enterprises
            </p>

            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              Business Domain Management
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage business domains and assign domain leadership.
            </p>
          </div>

          {canManage && (
            <button
              type="button"
              onClick={openCreateForm}
              className="inline-flex items-center gap-2 rounded-xl bg-green-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-900"
            >
              <Plus size={18} />
              Add Domain
            </button>
          )}
        </header>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {message && (
          <div
            role="status"
            className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
          >
            {message}
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-3 text-green-800">
                <Building2 size={21} />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Domains</p>
                <p className="text-2xl font-bold text-slate-900">
                  {domainTotal}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-100 p-3 text-emerald-800">
                <UserCheck size={21} />
              </div>
              <div>
                <p className="text-sm text-slate-500">Active Domains</p>
                <p className="text-2xl font-bold text-slate-900">
                  {domains.filter((item) => item.status === "active").length}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-3 text-blue-800">
                <UserRound size={21} />
              </div>
              <div>
                <p className="text-sm text-slate-500">Domains with Heads</p>
                <p className="text-2xl font-bold text-slate-900">
                  {domains.filter((item) => item.head).length}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search domain name or code..."
              className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
            />
          </div>

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-green-600"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <button
            type="button"
            onClick={loadDomains}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Business Domains</h2>
            <p className="mt-1 text-xs text-slate-500">
              Showing {domains.length} of {domainTotal} domain(s)
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-16 text-green-700">
              <Loader2 size={28} className="animate-spin" />
            </div>
          ) : domains.length === 0 ? (
            <div className="py-16 text-center">
              <Building2 className="mx-auto mb-3 text-slate-300" size={36} />
              <p className="font-medium text-slate-700">No domains found</p>
              <p className="mt-1 text-sm text-slate-500">
                Add a domain or change your search filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Domain</th>
                    <th className="px-5 py-3">Code</th>
                    <th className="px-5 py-3">Domain Head</th>
                    <th className="px-5 py-3">Status</th>
                    {canManage && <th className="px-5 py-3">Actions</th>}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {domains.map((domain) => (
                    <tr
                      key={domain._id}
                      className="transition hover:bg-green-50/40"
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-800">
                          {domain.name}
                        </p>
                        <p className="mt-1 max-w-sm text-xs text-slate-500">
                          {domain.description || "No description"}
                        </p>
                      </td>

                      <td className="px-5 py-4 font-mono text-slate-600">
                        {domain.code}
                      </td>

                      <td className="px-5 py-4">
                        {domain.head ? (
                          <div>
                            <p className="font-medium text-slate-800">
                              {getEmployeeName(domain.head)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {domain.head.employeeCode || ""}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-amber-700">
                            Not assigned
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            domain.status === "active"
                              ? "bg-green-100 text-green-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {domain.status}
                        </span>
                      </td>

                      {canManage && (
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditForm(domain)}
                              title="Edit domain"
                              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"
                            >
                              <Pencil size={16} />
                            </button>

                            {domain.status === "active" && (
                              <button
                                type="button"
                                onClick={() => handleDeactivate(domain)}
                                title="Deactivate domain"
                                className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                              >
                                <Power size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm">
            <div className="my-auto w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 p-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-green-700">
                    Organization Settings
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">
                    {editingId ? "Edit Business Domain" : "Add Business Domain"}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                  aria-label="Close form"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 p-5">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Domain Name *
                  </label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    required
                    maxLength={100}
                    placeholder="e.g. Banana Trading & Ripening"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Domain Code *
                  </label>
                  <input
                    name="code"
                    value={form.code}
                    onChange={handleChange}
                    required
                    maxLength={20}
                    placeholder="e.g. BTR"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm uppercase outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Domain Head
                  </label>

                  {editingId ? (
                    <>
                      <select
                        name="head"
                        value={form.head}
                        onChange={handleChange}
                        disabled={
                          !canViewEmployees || employeesLoading || saving
                        }
                        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-green-600 disabled:bg-slate-100"
                      >
                        <option value="">No Domain Head Assigned</option>

                        {originalHeadId &&
                          form.head === originalHeadId &&
                          !activeEmployees.some(
                            (employee) => employee._id === originalHeadId,
                          ) && (
                            <option value={originalHeadId}>
                              {domainHeadLabel(
                                domains.find((item) => item._id === editingId),
                              )}
                            </option>
                          )}

                        {activeEmployees.map((employee) => (
                          <option key={employee._id} value={employee._id}>
                            {getEmployeeName(employee)}
                            {employee.employeeCode
                              ? ` — ${employee.employeeCode}`
                              : ""}
                          </option>
                        ))}
                      </select>

                      {employeesLoading && (
                        <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                          <Loader2 size={13} className="animate-spin" />
                          Loading active employees...
                        </p>
                      )}

                      {!employeesLoading && employeeLoadError && (
                        <p className="mt-1 text-xs text-red-600">
                          {employeeLoadError}
                        </p>
                      )}

                      {!employeesLoading &&
                        !employeeLoadError &&
                        activeEmployees.length === 0 && (
                          <p className="mt-1 text-xs text-amber-700">
                            No active employees are assigned to this domain.
                            Assign an employee before selecting a domain head.
                          </p>
                        )}

                      {!employeeLoadError && canViewEmployees && (
                        <p className="mt-1 text-xs text-slate-500">
                          Only active employees belonging to this domain are
                          available.
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                      Create the domain and assign employees to it first. You
                      can then edit the domain to select an active domain head.
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    rows={3}
                    maxLength={500}
                    placeholder="Describe this business domain..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                  />
                  <p className="mt-1 text-right text-xs text-slate-400">
                    {form.description.length}/500
                  </p>
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={closeForm}
                    disabled={saving}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving || employeesLoading}
                    className="inline-flex items-center gap-2 rounded-lg bg-green-800 px-5 py-2 text-sm font-semibold text-white hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving && <Loader2 size={16} className="animate-spin" />}
                    {editingId ? "Save Changes" : "Create Domain"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function domainHeadLabel(domain) {
  if (!domain?.head) return "Previously assigned domain head";

  return getEmployeeName(domain.head);
}
