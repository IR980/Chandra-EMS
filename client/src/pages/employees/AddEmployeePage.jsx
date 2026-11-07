import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  UserPlus,
  Save,
  Building2,
  BriefcaseBusiness,
  UserRound,
  Users,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import api from "../../services/api";

const initialForm = {
  firstName: "",
  lastName: "",
  gender: "",
  phone: "",
  alternatePhone: "",
  personalEmail: "",
  workEmail: "",
  address: "",
  designation: "",
  employmentType: "full_time",
  joiningDate: "",
  domain: "",
  department: "",
  reportingManager: "",
};

const inputClass =
  "mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-green-700 focus:ring-4 focus:ring-green-100 disabled:cursor-not-allowed disabled:bg-slate-100";

const labelClass = "block text-sm font-semibold text-slate-700";

const getId = (value) => {
  if (!value) return "";
  return typeof value === "object" ? value._id || "" : value;
};

const getErrorMessage = (error, fallback) =>
  error.response?.data?.message || error.message || fallback;

// Loads every page supported by the API.
const fetchAllPages = async (endpoint, collectionKey, params = {}) => {
  const firstResponse = await api.get(endpoint, {
    params: { ...params, page: 1, limit: 100 },
  });

  const firstData = firstResponse.data?.data || {};
  const records = firstData[collectionKey] || [];
  const totalPages = Math.max(1, Number(firstData.pagination?.totalPages) || 1);

  if (totalPages === 1) return records;

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

function FormSection({ icon: Icon, title, description, children }) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7">
      <div className="mb-6 flex items-start gap-3">
        <div className="rounded-xl bg-green-50 p-3 text-green-800">
          <Icon size={21} />
        </div>

        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
        </div>
      </div>

      {children}
    </section>
  );
}

function AddEmployeePage() {
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);

  const [domains, setDomains] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [managerCandidates, setManagerCandidates] = useState([]);

  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingManagers, setLoadingManagers] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Load all active domains and departments.
  useEffect(() => {
    let cancelled = false;

    const loadOrganization = async () => {
      setLoadingOptions(true);
      setError("");

      try {
        const [domainRecords, departmentRecords] = await Promise.all([
          fetchAllPages("/domains", "domains", { status: "active" }),
          fetchAllPages("/departments", "departments", {
            status: "active",
          }),
        ]);

        if (cancelled) return;

        setDomains(domainRecords.filter((item) => item.status === "active"));

        setDepartments(
          departmentRecords.filter((item) => item.status === "active"),
        );
      } catch (err) {
        if (!cancelled) {
          setError(
            getErrorMessage(err, "Unable to load organization information."),
          );
        }
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    };

    loadOrganization();

    return () => {
      cancelled = true;
    };
  }, []);

  // Only show departments belonging to the selected domain.
  const availableDepartments = useMemo(
    () => departments.filter((item) => getId(item.domain) === form.domain),
    [departments, form.domain],
  );

  const selectedDomain = domains.find((item) => item._id === form.domain);

  const selectedDepartment = departments.find(
    (item) => item._id === form.department,
  );

  // Load active employees who can be reporting managers
  // in the selected domain and department.
  useEffect(() => {
    let cancelled = false;

    const loadManagers = async () => {
      setManagerCandidates([]);
      setForm((previous) => ({
        ...previous,
        reportingManager: "",
      }));

      if (!form.domain || !form.department) {
        setLoadingManagers(false);
        return;
      }

      setLoadingManagers(true);

      try {
        const employees = await fetchAllPages("/employees", "employees", {
          domain: form.domain,
          department: form.department,
          employmentStatus: "active",
        });

        if (!cancelled) {
          setManagerCandidates(
            employees.filter(
              (employee) => employee.employmentStatus === "active",
            ),
          );
        }
      } catch (err) {
        if (!cancelled) {
          setManagerCandidates([]);
          setError(
            getErrorMessage(err, "Unable to load reporting-manager options."),
          );
        }
      } finally {
        if (!cancelled) setLoadingManagers(false);
      }
    };

    loadManagers();

    return () => {
      cancelled = true;
    };
  }, [form.domain, form.department]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setError("");
    setSuccess("");

    setForm((previous) => ({
      ...previous,
      [name]: value,
      ...(name === "domain" ? { department: "", reportingManager: "" } : {}),
      ...(name === "department" ? { reportingManager: "" } : {}),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (
      !form.firstName.trim() ||
      !form.lastName.trim() ||
      !form.phone.trim() ||
      !form.designation.trim() ||
      !form.joiningDate ||
      !form.domain ||
      !form.department
    ) {
      setError("Please complete all required fields.");
      return;
    }

    if (!/^[0-9+\-\s]{10,15}$/.test(form.phone.trim())) {
      setError("Please enter a valid phone number.");
      return;
    }

    if (
      form.alternatePhone.trim() &&
      !/^[0-9+\-\s]{10,15}$/.test(form.alternatePhone.trim())
    ) {
      setError("Please enter a valid alternate phone number.");
      return;
    }

    const validDepartment = departments.some(
      (item) =>
        item._id === form.department &&
        getId(item.domain) === form.domain &&
        item.status === "active",
    );

    const validDomain = domains.some(
      (item) => item._id === form.domain && item.status === "active",
    );

    if (!validDomain || !validDepartment) {
      setError(
        "The selected domain or department is no longer active. Refresh the page and select again.",
      );
      return;
    }

    if (
      form.reportingManager &&
      !managerCandidates.some((item) => item._id === form.reportingManager)
    ) {
      setError(
        "Please select a valid active reporting manager from the selected department.",
      );
      return;
    }

    const payload = {
      ...form,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim(),
      alternatePhone: form.alternatePhone.trim() || undefined,
      personalEmail: form.personalEmail.trim() || undefined,
      workEmail: form.workEmail.trim() || undefined,
      designation: form.designation.trim(),
      address: form.address.trim()
        ? { street: form.address.trim() }
        : undefined,
      reportingManager: form.reportingManager || null,
    };

    try {
      setSaving(true);

      const response = await api.post("/employees", payload);

      if (response.data?.success) {
        setSuccess("Employee created successfully.");

        navigate("/employees", {
          replace: true,
          state: {
            successMessage: "Employee created successfully.",
          },
        });
      } else {
        setError(response.data?.message || "Unable to create employee.");
      }
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Unable to create employee. Please check the entered information.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  if (loadingOptions) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 rounded-2xl bg-white px-6 py-5 shadow-sm">
          <RefreshCw size={20} className="animate-spin text-green-700" />
          <span className="text-sm font-medium text-slate-600">
            Loading organization information...
          </span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f3f7f4]">
      {/* Page header */}
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-green-800 p-3 text-white">
              <Building2 size={22} />
            </div>

            <div>
              <h1 className="font-bold text-slate-900">Chandra Enterprises</h1>
              <p className="text-xs text-slate-500">
                Employee Management System
              </p>
            </div>
          </div>

          <Link
            to="/employees"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            Employee Directory
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        {/* Page title */}
        <div className="mb-7">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-green-800">
            <span>Human Resources</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-500">Employee Registration</span>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Add New Employee
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Create an employee record and assign the employee to the correct
                company domain and department.
              </p>
            </div>

            <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800">
              New employee record
            </span>
          </div>
        </div>

        {/* Error and success messages */}
        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle size={19} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mb-5 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
          >
            <CheckCircle2 size={19} />
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Personal information */}
          <FormSection
            icon={UserRound}
            title="Personal Information"
            description="Enter the employee's basic contact and personal details."
          >
            <div className="grid gap-5 md:grid-cols-2">
              <label className={labelClass}>
                First Name <span className="text-red-500">*</span>
                <input
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  required
                  maxLength={60}
                  autoComplete="given-name"
                  placeholder="Enter first name"
                  className={inputClass}
                />
              </label>

              <label className={labelClass}>
                Last Name <span className="text-red-500">*</span>
                <input
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                  required
                  maxLength={60}
                  autoComplete="family-name"
                  placeholder="Enter last name"
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
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label className={labelClass}>
                Phone Number <span className="text-red-500">*</span>
                <input
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  required
                  maxLength={15}
                  autoComplete="tel"
                  placeholder="Enter phone number"
                  className={inputClass}
                />
              </label>

              <label className={labelClass}>
                Alternate Phone
                <input
                  name="alternatePhone"
                  type="tel"
                  value={form.alternatePhone}
                  onChange={handleChange}
                  maxLength={15}
                  placeholder="Optional alternate number"
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
                  autoComplete="email"
                  placeholder="personal@example.com"
                  className={inputClass}
                />
              </label>

              <label className={`${labelClass} md:col-span-2`}>
                Residential Address
                <textarea
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  rows={3}
                  maxLength={500}
                  placeholder="Enter house number, street, area, city and PIN code"
                  className={`${inputClass} resize-y`}
                />
              </label>
            </div>
          </FormSection>

          {/* Employment information */}
          <FormSection
            icon={BriefcaseBusiness}
            title="Employment Information"
            description="Enter official employment details and joining information."
          >
            <div className="grid gap-5 md:grid-cols-2">
              <label className={labelClass}>
                Official Work Email
                <input
                  name="workEmail"
                  type="email"
                  value={form.workEmail}
                  onChange={handleChange}
                  autoComplete="work email"
                  placeholder="employee@chandraenterprises.com"
                  className={inputClass}
                />
                <span className="mt-1 block text-xs font-normal text-slate-400">
                  Required before creating a login account.
                </span>
              </label>

              <label className={labelClass}>
                Designation <span className="text-red-500">*</span>
                <input
                  name="designation"
                  value={form.designation}
                  onChange={handleChange}
                  required
                  maxLength={100}
                  placeholder="e.g. Sales Executive"
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
                Joining Date <span className="text-red-500">*</span>
                <input
                  name="joiningDate"
                  type="date"
                  value={form.joiningDate}
                  onChange={handleChange}
                  required
                  className={inputClass}
                />
              </label>
            </div>
          </FormSection>

          {/* Organization assignment */}
          <FormSection
            icon={Building2}
            title="Organization Assignment"
            description="Select the business domain and department where this employee will work."
          >
            <div className="grid gap-5 md:grid-cols-2">
              <label className={labelClass}>
                Business Domain <span className="text-red-500">*</span>
                <select
                  name="domain"
                  value={form.domain}
                  onChange={handleChange}
                  required
                  className={inputClass}
                >
                  <option value="">Select business domain</option>
                  {domains.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.name} {item.code ? `(${item.code})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className={labelClass}>
                Department <span className="text-red-500">*</span>
                <select
                  name="department"
                  value={form.department}
                  onChange={handleChange}
                  required
                  disabled={!form.domain}
                  className={inputClass}
                >
                  <option value="">
                    {form.domain ? "Select department" : "Select domain first"}
                  </option>
                  {availableDepartments.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.name} {item.code ? `(${item.code})` : ""}
                    </option>
                  ))}
                </select>
                {form.domain && availableDepartments.length === 0 && (
                  <span className="mt-1 block text-xs font-normal text-amber-700">
                    No active departments are available in this domain.
                  </span>
                )}
              </label>
            </div>

            {selectedDomain && selectedDepartment && (
              <div className="mt-5 rounded-xl border border-green-100 bg-green-50/70 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-green-800">
                  Assignment Summary
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-slate-500">Business Domain</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {selectedDomain.name}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">Department</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {selectedDepartment.name}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 border-t border-slate-100 pt-5">
              <label className={labelClass}>
                <span className="flex items-center gap-2">
                  <Users size={16} className="text-green-700" />
                  Reporting Manager
                </span>

                <select
                  name="reportingManager"
                  value={form.reportingManager}
                  onChange={handleChange}
                  disabled={
                    !form.department ||
                    loadingManagers ||
                    managerCandidates.length === 0
                  }
                  className={inputClass}
                >
                  <option value="">
                    {!form.department
                      ? "Select domain and department first"
                      : loadingManagers
                        ? "Loading employees..."
                        : managerCandidates.length === 0
                          ? "No eligible manager available"
                          : "No reporting manager"}
                  </option>

                  {managerCandidates.map((employee) => (
                    <option key={employee._id} value={employee._id}>
                      {employee.fullName ||
                        `${employee.firstName || ""} ${employee.lastName || ""}`.trim()}
                      {employee.employeeCode
                        ? ` — ${employee.employeeCode}`
                        : ""}
                      {employee.designation ? ` (${employee.designation})` : ""}
                    </option>
                  ))}
                </select>

                <span className="mt-2 block text-xs font-normal leading-5 text-slate-500">
                  Only active employees from the selected domain and department
                  are eligible. You can leave this blank and assign a manager
                  later.
                </span>
              </label>
            </div>
          </FormSection>

          {/* Form actions */}
          <div className="flex flex-col-reverse justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:px-7">
            <p className="text-xs text-slate-500">
              Fields marked <span className="text-red-500">*</span> are
              required.
            </p>

            <div className="flex flex-wrap justify-end gap-3">
              <Link
                to="/employees"
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={
                  saving ||
                  loadingOptions ||
                  !domains.length ||
                  !departments.length
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-800 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <RefreshCw size={17} className="animate-spin" />
                ) : (
                  <Save size={17} />
                )}
                {saving ? "Creating Employee..." : "Create Employee"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}

export default AddEmployeePage;
