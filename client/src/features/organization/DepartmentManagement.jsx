import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  ArrowLeft,
  Plus,
  Search,
  Pencil,
  Power,
  RefreshCw,
  X,
  Loader2,
  Network,
  UserCheck,
  Users,
} from "lucide-react";
import api from "../../services/api";

const emptyForm = {
  name: "",
  code: "",
  description: "",
  domainId: "",
  parentDepartmentId: "",
  managerId: "",
};

const getId = (value) => {
  if (!value) return "";
  return typeof value === "object" ? value._id || "" : value;
};

const fetchAllPages = async (endpoint, params, collectionKey) => {
  const firstResponse = await api.get(endpoint, {
    params: { ...params, page: 1, limit: 100 },
  });

  const firstData = firstResponse.data?.data || {};
  const records = firstData[collectionKey] || [];
  const totalPages = firstData.pagination?.totalPages || 1;

  if (totalPages <= 1) return records;

  const remainingRequests = [];

  for (let page = 2; page <= totalPages; page += 1) {
    remainingRequests.push(
      api.get(endpoint, {
        params: { ...params, page, limit: 100 },
      }),
    );
  }

  const remainingResponses = await Promise.all(remainingRequests);

  return [
    ...records,
    ...remainingResponses.flatMap(
      (response) => response.data?.data?.[collectionKey] || [],
    ),
  ];
};

export default function DepartmentManagement() {
  const user = useSelector((state) => state.auth.user);
  const permissions = user?.role?.permissions || [];

  const canManage =
    permissions.includes("*") || permissions.includes("departments.manage");

  const [departments, setDepartments] = useState([]);
  const [domains, setDomains] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [totalDepartments, setTotalDepartments] = useState(0);

  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [form, setForm] = useState(emptyForm);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [originalManagerId, setOriginalManagerId] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const employeeCounts = useMemo(() => {
    return employees.reduce((counts, employee) => {
      const departmentId = getId(employee.department);

      if (departmentId) {
        counts[departmentId] = (counts[departmentId] || 0) + 1;
      }

      return counts;
    }, {});
  }, [employees]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [departmentResponse, loadedDomains, loadedEmployees] =
        await Promise.all([
          api.get("/departments", {
            params: {
              search: search.trim() || undefined,
              domainId: domainFilter || undefined,
              status: statusFilter,
              page: 1,
              limit: 100,
            },
          }),
          fetchAllPages("/domains", { status: "active" }, "domains"),
          fetchAllPages(
            "/employees",
            { employmentStatus: "active" },
            "employees",
          ),
        ]);

      const departmentData = departmentResponse.data?.data || {};

      setDepartments(departmentData.departments || []);
      setTotalDepartments(departmentData.pagination?.total || 0);
      setDomains(loadedDomains);
      setEmployees(
        loadedEmployees.filter(
          (employee) => employee.employmentStatus === "active",
        ),
      );
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to load department information.",
      );
    } finally {
      setLoading(false);
    }
  }, [search, domainFilter, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const availableParents = useMemo(
    () =>
      departments.filter(
        (department) =>
          department._id !== editingDepartment?._id &&
          getId(department.domain) === form.domainId &&
          department.status === "active",
      ),
    [departments, editingDepartment, form.domainId],
  );

  const availableManagers = useMemo(
    () =>
      employees.filter(
        (employee) =>
          getId(employee.department) === editingDepartment?._id &&
          getId(employee.domain) === form.domainId &&
          employee.employmentStatus === "active",
      ),
    [employees, editingDepartment, form.domainId],
  );

  const editingEmployeeCount = editingDepartment
    ? employeeCounts[editingDepartment._id] || 0
    : 0;

  const openCreateForm = () => {
    setEditingDepartment(null);
    setOriginalManagerId("");
    setForm(emptyForm);
    setError("");
    setMessage("");
    setShowForm(true);
  };

  const openEditForm = (department) => {
    const managerId = getId(department.manager);

    setEditingDepartment(department);
    setOriginalManagerId(managerId);
    setForm({
      name: department.name || "",
      code: department.code || "",
      description: department.description || "",
      domainId: getId(department.domain),
      parentDepartmentId: getId(department.parentDepartment),
      managerId,
    });
    setError("");
    setMessage("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingDepartment(null);
    setOriginalManagerId("");
    setForm(emptyForm);
    setError("");
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleDomainChange = (event) => {
    const domainId = event.target.value;

    setForm((previous) => ({
      ...previous,
      domainId,
      parentDepartmentId: "",
      managerId: "",
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.name.trim() || !form.code.trim() || !form.domainId) {
      setError("Department name, code and domain are required.");
      return;
    }

    if (
      editingDepartment &&
      editingEmployeeCount > 0 &&
      form.domainId !== getId(editingDepartment.domain)
    ) {
      setError(
        "You cannot move a department to another domain while employees are assigned to it.",
      );
      return;
    }

    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      description: form.description.trim(),
      parentDepartment: form.parentDepartmentId || null,
    };

    if (!editingDepartment) {
      payload.domainId = form.domainId;
    } else {
      payload.domain = form.domainId;

      // Preserve the existing manager unless the user changes the selection.
      if (form.managerId !== originalManagerId) {
        payload.manager = form.managerId || null;
      }
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      if (editingDepartment) {
        await api.patch(`/departments/${editingDepartment._id}`, payload);
        setMessage("Department updated successfully.");
      } else {
        await api.post("/departments", payload);
        setMessage("Department created successfully.");
      }

      setShowForm(false);
      setEditingDepartment(null);
      setOriginalManagerId("");
      setForm(emptyForm);

      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save department.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (department) => {
    const confirmed = window.confirm(
      `Are you sure you want to deactivate "${department.name}"?`,
    );

    if (!confirmed) return;

    try {
      setDeactivatingId(department._id);
      setError("");
      setMessage("");

      await api.patch(`/departments/${department._id}/deactivate`);

      setMessage(`${department.name} has been deactivated.`);
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to deactivate this department.",
      );
    } finally {
      setDeactivatingId("");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              to="/organization"
              className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-green-700"
            >
              <ArrowLeft size={16} />
              Organization
            </Link>

            <h1 className="text-2xl font-bold text-slate-900">
              Department Management
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage departments, hierarchy, managers and employee assignments.
            </p>
          </div>

          {canManage && (
            <button
              onClick={openCreateForm}
              className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800"
            >
              <Plus size={18} />
              Add Department
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {message}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Departments found</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {totalDepartments}
                </p>
              </div>
              <Network className="text-green-700" size={25} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  Active employees loaded
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {employees.length}
                </p>
              </div>
              <Users className="text-green-700" size={25} />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search department name or code..."
              className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-green-600"
            />
          </div>

          <select
            value={domainFilter}
            onChange={(event) => setDomainFilter(event.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
          >
            <option value="">All Domains</option>
            {domains.map((domain) => (
              <option key={domain._id} value={domain._id}>
                {domain.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Departments</h2>
            <p className="mt-1 text-xs text-slate-500">
              {departments.length} displayed of {totalDepartments} matching
              department(s)
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-16 text-green-700">
              <Loader2 className="animate-spin" />
            </div>
          ) : departments.length === 0 ? (
            <div className="py-16 text-center">
              <Network size={36} className="mx-auto mb-3 text-slate-300" />
              <p className="font-medium text-slate-700">No departments found</p>
              <p className="mt-1 text-sm text-slate-500">
                Add a department or adjust your filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Department</th>
                    <th className="px-5 py-3">Code</th>
                    <th className="px-5 py-3">Business Domain</th>
                    <th className="px-5 py-3">Parent Department</th>
                    <th className="px-5 py-3">Employees</th>
                    <th className="px-5 py-3">Manager</th>
                    <th className="px-5 py-3">Status</th>
                    {canManage && <th className="px-5 py-3">Actions</th>}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {departments.map((department) => (
                    <tr key={department._id} className="hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-800">
                          {department.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {department.description || "No description"}
                        </p>
                      </td>

                      <td className="px-5 py-4 font-mono text-slate-600">
                        {department.code}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {department.domain?.name || "—"}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {department.parentDepartment?.name || "Main Department"}
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-2 text-slate-700">
                          <Users size={15} className="text-slate-400" />
                          {employeeCounts[department._id] || 0}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <UserCheck size={16} className="text-green-700" />
                          <span className="text-slate-700">
                            {department.manager?.fullName || "Not assigned"}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            department.status === "active"
                              ? "bg-green-100 text-green-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {department.status}
                        </span>
                      </td>

                      {canManage && (
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEditForm(department)}
                              title="Edit department and manager"
                              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"
                            >
                              <Pencil size={16} />
                            </button>

                            {department.status === "active" && (
                              <button
                                onClick={() => handleDeactivate(department)}
                                disabled={deactivatingId === department._id}
                                title="Deactivate department"
                                className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                {deactivatingId === department._id ? (
                                  <Loader2 size={16} className="animate-spin" />
                                ) : (
                                  <Power size={16} />
                                )}
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
        </div>

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
            <div className="my-8 w-full max-w-xl rounded-2xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 p-5">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {editingDepartment ? "Edit Department" : "Add Department"}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Configure department details, hierarchy and manager.
                  </p>
                </div>

                <button
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 p-5">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Business Domain *
                  </label>
                  <select
                    name="domainId"
                    value={form.domainId}
                    onChange={handleDomainChange}
                    required
                    disabled={
                      Boolean(editingDepartment) && editingEmployeeCount > 0
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-100"
                  >
                    <option value="">Select Business Domain</option>
                    {domains.map((domain) => (
                      <option key={domain._id} value={domain._id}>
                        {domain.name} ({domain.code})
                      </option>
                    ))}
                  </select>

                  {editingDepartment && editingEmployeeCount > 0 && (
                    <p className="mt-1 text-xs text-amber-700">
                      Domain cannot be changed while employees are assigned to
                      this department.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Department Name *
                  </label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    required
                    maxLength={100}
                    placeholder="e.g. Accounts & Finance"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Department Code *
                  </label>
                  <input
                    name="code"
                    value={form.code}
                    onChange={handleChange}
                    required
                    maxLength={20}
                    placeholder="e.g. ACC"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm uppercase"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Parent Department
                  </label>
                  <select
                    name="parentDepartmentId"
                    value={form.parentDepartmentId}
                    onChange={handleChange}
                    disabled={!form.domainId}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-100"
                  >
                    <option value="">No Parent Department</option>
                    {availableParents.map((department) => (
                      <option key={department._id} value={department._id}>
                        {department.name} ({department.code})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">
                    Use this for sub-departments such as SWENG, CIVIL and ELM
                    under Engineering.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Department Manager
                  </label>
                  <select
                    name="managerId"
                    value={form.managerId}
                    onChange={handleChange}
                    disabled={!editingDepartment}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-100"
                  >
                    <option value="">No Manager Assigned</option>
                    {availableManagers.map((employee) => (
                      <option key={employee._id} value={employee._id}>
                        {employee.fullName} — {employee.employeeCode}
                      </option>
                    ))}
                  </select>

                  {!editingDepartment ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Create the department and assign employees first. Then
                      edit it to select a manager.
                    </p>
                  ) : availableManagers.length === 0 ? (
                    <p className="mt-1 text-xs text-amber-700">
                      No active employees are assigned to this department.
                      Assign an employee before selecting a manager.
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500">
                      Only active employees already assigned to this exact
                      department are listed.
                    </p>
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
                    placeholder="Department responsibilities..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeForm}
                    disabled={saving}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-5 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60"
                  >
                    {saving && <Loader2 size={16} className="animate-spin" />}
                    {editingDepartment ? "Save Changes" : "Create Department"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
