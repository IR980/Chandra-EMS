import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  ArrowLeft,
  UserRound,
  Mail,
  Phone,
  Building2,
  BriefcaseBusiness,
  CalendarDays,
  Save,
  Pencil,
  X,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  LockKeyhole,
  Eye,
  EyeOff,
  CheckCircle2,
  KeyRound,
  Users,
  GitBranch,
} from "lucide-react";

import api from "../../services/api";

const emptyForm = {
  firstName: "",
  lastName: "",
  workEmail: "",
  personalEmail: "",
  phone: "",
  alternatePhone: "",
  gender: "",
  designation: "",
  employmentType: "full_time",
  joiningDate: "",
  confirmationDate: "",
  employmentStatus: "active",
  notes: "",
};

const formatDateForInput = (value) => {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
};

const formatDate = (value) => {
  if (!value) return "Not provided";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

function EmployeeProfilePage() {
  const { id } = useParams();
  const { user } = useSelector((state) => state.auth);

  const permissions = user?.role?.permissions || [];

  const canUpdate =
    permissions.includes("*") || permissions.includes("employees.update");

  const canCreateAccount =
    permissions.includes("*") || permissions.includes("users.create");

  const [employee, setEmployee] = useState(null);
  const [roles, setRoles] = useState([]);

  // Reporting hierarchy state
  const [managerCandidates, setManagerCandidates] = useState([]);
  const [directReports, setDirectReports] = useState([]);
  const [selectedManager, setSelectedManager] = useState("");
  const [reportingLoading, setReportingLoading] = useState(false);
  const [savingManager, setSavingManager] = useState(false);
  const [reportingError, setReportingError] = useState("");
  const [reportingSuccess, setReportingSuccess] = useState("");

  const [form, setForm] = useState(emptyForm);

  const [accountForm, setAccountForm] = useState({
    roleId: "",
    password: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);

  const [editing, setEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [accountError, setAccountError] = useState("");
  const [accountSuccess, setAccountSuccess] = useState("");

  // Load manager options and employees who report directly to this employee.
  const loadReportingData = async (record) => {
    if (!record?._id) return;

    setReportingLoading(true);
    setReportingError("");

    const currentManagerId =
      record.reportingManager && typeof record.reportingManager === "object"
        ? record.reportingManager._id
        : record.reportingManager || "";

    setSelectedManager(currentManagerId);

    const domainId =
      record.domain && typeof record.domain === "object"
        ? record.domain._id
        : record.domain;

    const departmentId =
      record.department && typeof record.department === "object"
        ? record.department._id
        : record.department;

    try {
      if (domainId && departmentId) {
        const employeeResponse = await api.get("/employees", {
          params: {
            domainId,
            departmentId,
            employmentStatus: "active",
            page: 1,
            limit: 100,
          },
        });

        const candidates = employeeResponse.data.data?.employees || [];
        setManagerCandidates(
          candidates.filter((candidate) => candidate._id !== record._id),
        );
      } else {
        setManagerCandidates([]);
      }
    } catch (err) {
      setManagerCandidates([]);
      setReportingError(
        err.response?.data?.message ||
          "Unable to load possible reporting managers.",
      );
    }

    try {
      const reportsResponse = await api.get(`/employees/${record._id}/reports`);
      setDirectReports(reportsResponse.data.data?.reports || []);
    } catch (err) {
      setDirectReports([]);
      setReportingError(
        (previous) =>
          previous ||
          err.response?.data?.message ||
          "Unable to load direct reports. Check that the employee reports API is enabled.",
      );
    } finally {
      setReportingLoading(false);
    }
  };

  // Fetch employee profile
  const loadEmployee = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);

      setError("");

      const response = await api.get(`/employees/${id}`);

      const record = response.data.data?.employee || response.data.data;

      if (!record?._id) {
        throw new Error("Employee record not found.");
      }

      setEmployee(record);
      await loadReportingData(record);

      setForm({
        firstName: record.firstName || "",
        lastName: record.lastName || "",
        workEmail: record.workEmail || "",
        personalEmail: record.personalEmail || "",
        phone: record.phone || "",
        alternatePhone: record.alternatePhone || "",
        gender: record.gender || "",
        designation: record.designation || "",
        employmentType: record.employmentType || "full_time",
        joiningDate: formatDateForInput(record.joiningDate),
        confirmationDate: formatDateForInput(record.confirmationDate),
        employmentStatus: record.employmentStatus || "active",
        notes: record.notes || "",
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to load employee profile.",
      );
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  // Fetch roles available for account assignment
  const loadRoles = async () => {
    if (!canCreateAccount) return;

    try {
      setRolesLoading(true);

      const response = await api.get("/roles/assignable");

      const availableRoles = response.data.data?.roles || [];

      setRoles(availableRoles);
    } catch (err) {
      setAccountError(
        err.response?.data?.message ||
          "Unable to load available employee roles.",
      );
    } finally {
      setRolesLoading(false);
    }
  };

  useEffect(() => {
    loadEmployee();
  }, [id]);

  useEffect(() => {
    loadRoles();
  }, [canCreateAccount]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleAccountChange = (event) => {
    const { name, value } = event.target;

    setAccountForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  // Update employee information
  const handleUpdate = async (event) => {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await api.patch(`/employees/${id}`, form);

      setEditing(false);
      setSuccess("Employee information updated successfully.");

      await loadEmployee(false);
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to update employee information.",
      );
    } finally {
      setSaving(false);
    }
  };

  // Update the employee's reporting manager.
  const handleManagerUpdate = async (event) => {
    event.preventDefault();
    setSavingManager(true);
    setReportingError("");
    setReportingSuccess("");

    try {
      await api.patch(`/employees/${id}`, {
        reportingManager: selectedManager || null,
      });

      setReportingSuccess("Reporting manager updated successfully.");
      await loadEmployee(false);
    } catch (err) {
      setReportingError(
        err.response?.data?.message || "Unable to update reporting manager.",
      );
    } finally {
      setSavingManager(false);
    }
  };

  // Create employee login account
  const handleCreateAccount = async (event) => {
    event.preventDefault();

    setAccountError("");
    setAccountSuccess("");

    if (!employee?.workEmail) {
      setAccountError(
        "An official work email is required before creating a login account.",
      );
      return;
    }

    if (!accountForm.roleId) {
      setAccountError("Please select an employee role.");
      return;
    }

    if (accountForm.password !== accountForm.confirmPassword) {
      setAccountError("Passwords do not match.");
      return;
    }

    if (accountForm.password.length < 8) {
      setAccountError("Password must contain at least 8 characters.");
      return;
    }

    const passwordPattern =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/;

    if (!passwordPattern.test(accountForm.password)) {
      setAccountError(
        "Password must include uppercase, lowercase, number and special character.",
      );
      return;
    }

    try {
      setCreatingAccount(true);

      const response = await api.post(`/employees/${id}/account`, {
        roleId: accountForm.roleId,
        password: accountForm.password,
      });

      setAccountSuccess(
        response.data.message || "Employee login account created successfully.",
      );

      setAccountForm({
        roleId: "",
        password: "",
        confirmPassword: "",
      });

      await loadEmployee(false);
    } catch (err) {
      setAccountError(
        err.response?.data?.message ||
          "Unable to create employee login account.",
      );
    } finally {
      setCreatingAccount(false);
    }
  };

  const statusClass = {
    active: "bg-green-100 text-green-700",
    on_leave: "bg-yellow-100 text-yellow-700",
    inactive: "bg-gray-100 text-gray-600",
    terminated: "bg-red-100 text-red-700",
  };

  const inputClass =
    "mt-2 w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100";

  const labelClass = "text-sm font-semibold text-gray-700";

  // Support both populated user objects and unpopulated IDs
  const linkedAccount =
    employee?.user && typeof employee.user === "object" ? employee.user : null;

  const hasAccount = Boolean(employee?.user);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 text-gray-600">
        <RefreshCw className="animate-spin" size={20} />
        Loading employee profile...
      </div>
    );
  }

  if (!employee) {
    return (
      <main className="min-h-screen bg-[#f3f7f4] p-8">
        <div className="mx-auto max-w-3xl rounded-xl bg-white p-8">
          <p className="text-red-600">{error || "Employee not found."}</p>

          <Link
            to="/employees"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-green-700"
          >
            <ArrowLeft size={16} />
            Back to employees
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f3f7f4]">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b bg-white px-6 py-5 sm:px-10">
        <div>
          <h1 className="font-bold text-gray-900">Chandra Enterprises</h1>

          <p className="text-xs text-gray-500">Employee Management System</p>
        </div>

        <Link
          to="/employees"
          className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft size={16} />
          Employee Directory
        </Link>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        {/* Page title */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-green-700">
              Human Resources / Employee Profile
            </p>

            <h2 className="mt-1 text-2xl font-bold text-gray-900">
              Employee Details
            </h2>
          </div>

          {canUpdate && !editing && (
            <button
              type="button"
              onClick={() => {
                setError("");
                setSuccess("");
                setEditing(true);
              }}
              className="flex items-center gap-2 rounded-lg bg-[#17613b] px-5 py-3 text-sm font-semibold text-white hover:bg-green-800"
            >
              <Pencil size={16} />
              Edit Employee
            </button>
          )}
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            {success}
          </div>
        )}

        {/* Employee summary */}
        <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-5">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-green-100 text-green-800">
              <UserRound size={38} />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-bold text-gray-900">
                {employee.fullName ||
                  `${employee.firstName || ""} ${employee.lastName || ""}`}
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                {employee.designation || "Designation not provided"}
              </p>

              <p className="mt-1 text-sm font-medium text-green-700">
                {employee.employeeCode}
              </p>
            </div>

            <span
              className={`rounded-full px-4 py-2 text-xs font-semibold capitalize ${
                statusClass[employee.employmentStatus] ||
                "bg-gray-100 text-gray-600"
              }`}
            >
              {employee.employmentStatus?.replaceAll("_", " ")}
            </span>
          </div>
        </div>

        {/* Employee edit form */}
        {editing ? (
          <form
            onSubmit={handleUpdate}
            className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8"
          >
            <h3 className="mb-6 font-semibold text-gray-900">
              Edit Employee Information
            </h3>

            <div className="grid gap-5 md:grid-cols-2">
              <label className={labelClass}>
                First Name *
                <input
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  required
                  className={inputClass}
                />
              </label>

              <label className={labelClass}>
                Last Name *
                <input
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                  required
                  className={inputClass}
                />
              </label>

              <label className={labelClass}>
                Work Email
                <input
                  name="workEmail"
                  type="email"
                  value={form.workEmail}
                  onChange={handleChange}
                  className={inputClass}
                />
              </label>

              <label className={labelClass}>
                Personal Email
                <input
                  name="personalEmail"
                  type="email"
                  value={form.personalEmail}
                  onChange={handleChange}
                  className={inputClass}
                />
              </label>

              <label className={labelClass}>
                Phone
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  className={inputClass}
                />
              </label>

              <label className={labelClass}>
                Alternate Phone
                <input
                  name="alternatePhone"
                  value={form.alternatePhone}
                  onChange={handleChange}
                  className={inputClass}
                />
              </label>

              <label className={labelClass}>
                Gender
                <select
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="">Not specified</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label className={labelClass}>
                Designation
                <input
                  name="designation"
                  value={form.designation}
                  onChange={handleChange}
                  className={inputClass}
                />
              </label>

              <label className={labelClass}>
                Employment Type
                <select
                  name="employmentType"
                  value={form.employmentType}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="full_time">Full Time</option>
                  <option value="part_time">Part Time</option>
                  <option value="contract">Contract</option>
                  <option value="intern">Intern</option>
                </select>
              </label>

              <label className={labelClass}>
                Employment Status
                <select
                  name="employmentStatus"
                  value={form.employmentStatus}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="active">Active</option>
                  <option value="on_leave">On Leave</option>
                  <option value="inactive">Inactive</option>
                  <option value="terminated">Terminated</option>
                </select>
              </label>

              <label className={labelClass}>
                Joining Date
                <input
                  name="joiningDate"
                  type="date"
                  value={form.joiningDate}
                  onChange={handleChange}
                  className={inputClass}
                />
              </label>

              <label className={labelClass}>
                Confirmation Date
                <input
                  name="confirmationDate"
                  type="date"
                  value={form.confirmationDate}
                  onChange={handleChange}
                  className={inputClass}
                />
              </label>

              <label className={`${labelClass} md:col-span-2`}>
                Notes
                <textarea
                  name="notes"
                  rows={3}
                  value={form.notes}
                  onChange={handleChange}
                  className={inputClass}
                />
              </label>
            </div>

            <div className="mt-7 flex flex-wrap justify-end gap-3 border-t pt-6">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="flex items-center gap-2 rounded-lg border px-5 py-3 text-sm font-semibold text-gray-700"
              >
                <X size={16} />
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-[#17613b] px-6 py-3 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60"
              >
                <Save size={16} />
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* Employee information */}
            <div className="mb-6 grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <h3 className="mb-5 font-semibold text-gray-900">
                  Personal Information
                </h3>

                <div className="space-y-5">
                  <Info
                    icon={<Mail size={18} />}
                    label="Work Email"
                    value={employee.workEmail}
                  />
                  <Info
                    icon={<Mail size={18} />}
                    label="Personal Email"
                    value={employee.personalEmail}
                  />
                  <Info
                    icon={<Phone size={18} />}
                    label="Phone"
                    value={employee.phone}
                  />
                  <Info
                    icon={<Phone size={18} />}
                    label="Alternate Phone"
                    value={employee.alternatePhone}
                  />
                  <Info label="Gender" value={employee.gender} />
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <h3 className="mb-5 font-semibold text-gray-900">
                  Employment Information
                </h3>

                <div className="space-y-5">
                  <Info
                    icon={<Building2 size={18} />}
                    label="Business Domain"
                    value={employee.domain?.name}
                  />

                  <Info
                    icon={<Building2 size={18} />}
                    label="Department"
                    value={employee.department?.name}
                  />

                  <Info
                    icon={<BriefcaseBusiness size={18} />}
                    label="Designation"
                    value={employee.designation}
                  />

                  <Info
                    label="Employment Type"
                    value={employee.employmentType?.replaceAll("_", " ")}
                  />

                  <Info
                    icon={<CalendarDays size={18} />}
                    label="Joining Date"
                    value={formatDate(employee.joiningDate)}
                  />

                  <Info
                    label="Confirmation Date"
                    value={formatDate(employee.confirmationDate)}
                  />
                </div>
              </div>
            </div>

            {/* Reporting hierarchy */}
            <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-xl bg-green-100 p-3 text-green-800">
                  <GitBranch size={23} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    Reporting Hierarchy
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    View and manage this employee's reporting relationships.
                  </p>
                </div>
              </div>

              {reportingError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {reportingError}
                </div>
              )}

              {reportingSuccess && (
                <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                  {reportingSuccess}
                </div>
              )}

              <div className="mb-6 rounded-xl border border-gray-100 bg-gray-50 p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Current Reporting Manager
                </p>

                {employee.reportingManager &&
                typeof employee.reportingManager === "object" ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-green-100 p-3 text-green-800">
                        <UserRound size={22} />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {employee.reportingManager.fullName || "Manager"}
                        </p>
                        <p className="text-sm text-gray-500">
                          {employee.reportingManager.employeeCode || ""}
                          {employee.reportingManager.designation
                            ? ` • ${employee.reportingManager.designation}`
                            : ""}
                        </p>
                      </div>
                    </div>
                    {employee.reportingManager._id && (
                      <Link
                        to={`/employees/${employee.reportingManager._id}`}
                        className="text-sm font-semibold text-green-700 hover:underline"
                      >
                        View Manager
                      </Link>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    No reporting manager assigned.
                  </p>
                )}
              </div>

              {canUpdate && (
                <form
                  onSubmit={handleManagerUpdate}
                  className="mb-7 border-b border-gray-100 pb-7"
                >
                  <label className={labelClass}>
                    Assign Reporting Manager
                    <select
                      value={selectedManager}
                      onChange={(event) =>
                        setSelectedManager(event.target.value)
                      }
                      disabled={reportingLoading || savingManager}
                      className={inputClass}
                    >
                      <option value="">No Reporting Manager</option>
                      {managerCandidates.map((candidate) => (
                        <option key={candidate._id} value={candidate._id}>
                          {candidate.fullName ||
                            `${candidate.firstName || ""} ${candidate.lastName || ""}`}
                          {candidate.employeeCode
                            ? ` — ${candidate.employeeCode}`
                            : ""}
                          {candidate.designation
                            ? ` (${candidate.designation})`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="mt-2 text-xs text-gray-500">
                    Only active employees from the same domain and department
                    are listed. The server must validate the reporting
                    relationship before saving.
                  </p>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="submit"
                      disabled={reportingLoading || savingManager}
                      className="rounded-lg bg-[#17613b] px-5 py-3 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingManager
                        ? "Updating..."
                        : "Update Reporting Manager"}
                    </button>
                  </div>
                </form>
              )}

              <div>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Users size={20} className="text-green-700" />
                    <h4 className="font-semibold text-gray-900">
                      Direct Reports
                    </h4>
                  </div>
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                    {directReports.length} Employees
                  </span>
                </div>

                {reportingLoading ? (
                  <p className="py-5 text-sm text-gray-500">
                    Loading reporting information...
                  </p>
                ) : directReports.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center">
                    <Users size={28} className="mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-500">
                      No employees currently report to this employee.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {directReports.map((report) => (
                      <div
                        key={report._id}
                        className="flex flex-wrap items-center justify-between gap-3 py-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="rounded-full bg-gray-100 p-3 text-gray-600">
                            <UserRound size={20} />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {report.fullName ||
                                `${report.firstName || ""} ${report.lastName || ""}`}
                            </p>
                            <p className="text-xs text-gray-500">
                              {report.employeeCode || ""}
                              {report.designation
                                ? ` • ${report.designation}`
                                : ""}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              {report.department?.name || "No department"}
                            </p>
                          </div>
                        </div>
                        <Link
                          to={`/employees/${report._id}`}
                          className="text-sm font-semibold text-green-700 hover:underline"
                        >
                          View Profile
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Account management */}
            <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-xl bg-green-100 p-3 text-green-800">
                  <ShieldCheck size={23} />
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900">
                    Login Account Management
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Manage this employee's EMS login access.
                  </p>
                </div>
              </div>

              {hasAccount ? (
                <div className="rounded-xl border border-green-200 bg-green-50 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={21} className="text-green-700" />

                      <p className="font-semibold text-green-800">
                        Login account linked
                      </p>
                    </div>

                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold capitalize text-green-800">
                      {linkedAccount?.accountStatus || "Account linked"}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Info
                      icon={<Mail size={18} />}
                      label="Login Email"
                      value={linkedAccount?.email || employee.workEmail}
                    />

                    <Info
                      icon={<UserRound size={18} />}
                      label="Account Name"
                      value={linkedAccount?.fullName || employee.fullName}
                    />

                    <Info
                      icon={<ShieldCheck size={18} />}
                      label="Assigned Role"
                      value={linkedAccount?.role?.name || "Linked account"}
                    />

                    <Info
                      label="Account Status"
                      value={linkedAccount?.accountStatus || "Linked"}
                    />
                  </div>

                  <p className="mt-5 text-xs text-green-800">
                    This employee already has a linked login account. Creating
                    another account is disabled.
                  </p>
                </div>
              ) : !canCreateAccount ? (
                <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-5 text-sm text-yellow-800">
                  You do not have permission to create login accounts. Contact
                  your administrator.
                </div>
              ) : employee.employmentStatus !== "active" ? (
                <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-5 text-sm text-yellow-800">
                  Only active employees can receive login accounts.
                </div>
              ) : !employee.workEmail ? (
                <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-5 text-sm text-yellow-800">
                  Add an official work email to the employee profile before
                  creating a login account.
                </div>
              ) : (
                <form onSubmit={handleCreateAccount}>
                  <div className="mb-5 rounded-lg bg-gray-50 p-4">
                    <p className="text-xs font-medium text-gray-500">
                      Employee login email
                    </p>

                    <p className="mt-1 font-semibold text-gray-900">
                      {employee.workEmail}
                    </p>
                  </div>

                  {accountError && (
                    <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      {accountError}
                    </div>
                  )}

                  {accountSuccess && (
                    <div className="mb-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                      {accountSuccess}
                    </div>
                  )}

                  <div className="grid gap-5 md:grid-cols-2">
                    <label className={`${labelClass} md:col-span-2`}>
                      Assign System Role *
                      <select
                        name="roleId"
                        value={accountForm.roleId}
                        onChange={handleAccountChange}
                        required
                        disabled={rolesLoading}
                        className={inputClass}
                      >
                        <option value="">
                          {rolesLoading
                            ? "Loading roles..."
                            : "Select employee role"}
                        </option>

                        {roles.map((role) => (
                          <option key={role._id} value={role._id}>
                            {role.name} (Level {role.level})
                          </option>
                        ))}
                      </select>
                      <span className="mt-2 block text-xs font-normal text-gray-500">
                        Only roles assignable by your account are displayed.
                      </span>
                    </label>

                    <label className={labelClass}>
                      Initial Password *
                      <div className="relative">
                        <input
                          name="password"
                          type={showPassword ? "text" : "password"}
                          value={accountForm.password}
                          onChange={handleAccountChange}
                          required
                          minLength={8}
                          maxLength={128}
                          autoComplete="new-password"
                          className={`${inputClass} pr-12`}
                          placeholder="Enter initial password"
                        />

                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                          aria-label="Toggle password visibility"
                        >
                          {showPassword ? (
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )}
                        </button>
                      </div>
                    </label>

                    <label className={labelClass}>
                      Confirm Password *
                      <div className="relative">
                        <input
                          name="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          value={accountForm.confirmPassword}
                          onChange={handleAccountChange}
                          required
                          autoComplete="new-password"
                          className={`${inputClass} pr-12`}
                          placeholder="Confirm initial password"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setShowConfirmPassword(!showConfirmPassword)
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                          aria-label="Toggle confirmation password visibility"
                        >
                          {showConfirmPassword ? (
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )}
                        </button>
                      </div>
                    </label>
                  </div>

                  <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-4">
                    <div className="flex items-start gap-2">
                      <LockKeyhole size={18} className="mt-0.5 text-blue-700" />

                      <div>
                        <p className="text-sm font-semibold text-blue-900">
                          Password requirements
                        </p>

                        <p className="mt-1 text-xs leading-5 text-blue-800">
                          Minimum 8 characters, including uppercase, lowercase,
                          a number and a special character.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      type="submit"
                      disabled={
                        creatingAccount || rolesLoading || roles.length === 0
                      }
                      className="flex items-center gap-2 rounded-lg bg-[#17613b] px-6 py-3 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {creatingAccount ? (
                        <RefreshCw size={17} className="animate-spin" />
                      ) : (
                        <UserPlus size={17} />
                      )}

                      {creatingAccount
                        ? "Creating Account..."
                        : "Create Login Account"}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Additional notes */}
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <h3 className="mb-3 font-semibold text-gray-900">
                Additional Notes
              </h3>

              <p className="whitespace-pre-wrap text-sm text-gray-600">
                {employee.notes || "No additional notes."}
              </p>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function Info({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      {icon && <span className="mt-0.5 text-green-700">{icon}</span>}

      <div>
        <p className="text-xs text-gray-500">{label}</p>

        <p className="mt-1 wrap-break-word text-sm font-medium capitalize text-gray-900">
          {value || "Not provided"}
        </p>
      </div>
    </div>
  );
}

export default EmployeeProfilePage;
