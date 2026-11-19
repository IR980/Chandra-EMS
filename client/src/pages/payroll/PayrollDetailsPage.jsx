import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Wallet,
  XCircle,
  User,
  Building2,
  History,
  CreditCard,
} from "lucide-react";
import api from "../../services/api";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

const formatDate = (date) => {
  if (!date) return "—";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (date) => {
  if (!date) return "—";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const getErrorMessage = (error) =>
  error.response?.data?.message ||
  error.message ||
  "Something went wrong. Please try again.";

const getEmployeeName = (employee) =>
  employee?.fullName ||
  [employee?.firstName, employee?.lastName].filter(Boolean).join(" ") ||
  "Employee";

const STATUS_STYLES = {
  draft: "bg-amber-100 text-amber-800",
  verified: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  paid: "bg-emerald-100 text-emerald-800",
};

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold capitalize ${
        STATUS_STYLES[status] || "bg-slate-100 text-slate-700"
      }`}
    >
      {(status || "Unknown").replaceAll("_", " ")}
    </span>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <div className="rounded-lg bg-green-50 p-2 text-green-800">
          <Icon size={19} />
        </div>
        <h3 className="font-bold text-slate-900">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function DetailItem({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 wrap-break-word text-sm font-semibold text-slate-800">
        {value ?? "—"}
      </p>
    </div>
  );
}

function MoneyRow({ label, value, highlight = false, negative = false }) {
  return (
    <div
      className={`flex items-center justify-between gap-4 py-3 ${
        highlight ? "border-t border-slate-200" : "border-b border-slate-100"
      }`}
    >
      <span
        className={`text-sm ${
          highlight ? "font-bold text-slate-900" : "text-slate-600"
        }`}
      >
        {label}
      </span>
      <span
        className={`text-sm font-semibold ${
          highlight
            ? "text-green-800"
            : negative
              ? "text-red-600"
              : "text-slate-800"
        }`}
      >
        {negative ? "- " : ""}
        {formatCurrency(value)}
      </span>
    </div>
  );
}

function ActionButton({ children, onClick, disabled, variant = "primary" }) {
  const styles = {
    primary: "bg-green-800 text-white hover:bg-green-900",
    blue: "bg-blue-700 text-white hover:bg-blue-800",
    danger: "bg-red-600 text-white hover:bg-red-700",
    outline:
      "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]}`}
    >
      {children}
    </button>
  );
}

export default function PayrollDetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useSelector((state) => state.auth);

  // Role-based permissions
  const permissions = user?.role?.permissions || [];
  const hasAllPermissions = permissions.includes("*");

  const hasPermission = (permission) =>
    hasAllPermissions || permissions.includes(permission);

  const canView = hasPermission("payroll.view");
  const canRecalculate = hasPermission("payroll.recalculate");
  const canVerify = hasPermission("payroll.verify");
  const canApprove = hasPermission("payroll.approve");
  const canPay = hasPermission("payroll.pay");

  const [payroll, setPayroll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadPayroll = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get(`/payroll/${id}`);
      const data = response.data?.data || {};

      setPayroll(data.payroll || data);
    } catch (err) {
      setError(getErrorMessage(err));
      setPayroll(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    Promise.resolve().then(() => {
      void loadPayroll();
    });
  }, [loadPayroll]);

  const runAction = async (action, payload = {}, successMessage) => {
    setProcessing(true);
    setError("");
    setSuccess("");

    try {
      await api.patch(`/payroll/${id}/${action}`, payload);

      setSuccess(successMessage);
      await loadPayroll();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setProcessing(false);
    }
  };

  const handleRecalculate = async () => {
    if (!canRecalculate || payroll?.status !== "draft") return;

    const confirmed = window.confirm(
      "Recalculate this draft payroll using the latest salary, approved leave and attendance records?\n\nVerified, approved and paid records cannot be recalculated.",
    );

    if (!confirmed) return;

    await runAction(
      "recalculate",
      {},
      "Draft payroll recalculated successfully.",
    );
  };

  const handleVerify = async () => {
    if (!canVerify || payroll?.status !== "draft") return;

    const remarks = window.prompt(
      "Enter verification remarks (optional):",
      "Salary and attendance details reviewed.",
    );

    if (remarks === null) return;

    await runAction(
      "verify",
      { remarks: remarks.trim() },
      "Payroll verified successfully.",
    );
  };

  const handleApprove = async () => {
    if (!canApprove || payroll?.status !== "verified") return;

    const remarks = window.prompt(
      "Enter approval remarks (optional):",
      "Payroll approved.",
    );

    if (remarks === null) return;

    await runAction(
      "approve",
      { remarks: remarks.trim() },
      "Payroll approved successfully.",
    );
  };

  const handleMarkPaid = async () => {
    if (!canPay || payroll?.status !== "approved") return;

    const paymentMethod = window.prompt(
      "Enter payment method:\n\nbank_transfer, upi, cash, cheque, other",
      "bank_transfer",
    );

    if (paymentMethod === null) return;

    const allowedMethods = ["bank_transfer", "upi", "cash", "cheque", "other"];

    const normalizedMethod = paymentMethod.trim().toLowerCase();

    if (!allowedMethods.includes(normalizedMethod)) {
      setError("Please enter a valid payment method.");
      return;
    }

    const paymentReference = window.prompt(
      "Enter payment reference or transaction ID (optional):",
      "",
    );

    if (paymentReference === null) return;

    const confirmed = window.confirm(
      `Mark this payroll as PAID?\n\nPayment method: ${normalizedMethod}\nReference: ${paymentReference || "Not provided"}`,
    );

    if (!confirmed) return;

    await runAction(
      "pay",
      {
        paymentMethod: normalizedMethod,
        paymentReference: paymentReference.trim(),
      },
      "Payroll payment recorded successfully.",
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 bg-slate-50 text-slate-600">
        <LoaderCircle className="animate-spin" size={24} />
        Loading payroll details...
      </div>
    );
  }

  if (!canView && !hasAllPermissions) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
          <ShieldCheck className="mx-auto text-amber-500" size={42} />
          <h2 className="mt-4 text-xl font-bold text-slate-900">
            Access Restricted
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            You do not have permission to view payroll records.
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="mt-5 rounded-lg bg-green-800 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Back to Dashboard
          </button>
        </div>
      </main>
    );
  }

  if (!payroll) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
          <XCircle className="mx-auto text-red-500" size={42} />
          <h2 className="mt-4 text-xl font-bold text-slate-900">
            Payroll Not Found
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {error || "The requested payroll record could not be found."}
          </p>
          <button
            onClick={() => navigate("/payroll")}
            className="mt-5 rounded-lg bg-green-800 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Back to Payroll
          </button>
        </div>
      </main>
    );
  }

  const employee = payroll.employee || {};
  const salary = payroll.salarySnapshot || {};
  const earnings = salary.earnings || {};
  const deductions = salary.deductions || {};
  const attendance = payroll.attendanceSummary || {};

  const earningsRows = [
    ["Basic Salary", earnings.basic],
    ["HRA", earnings.hra],
    ["DA", earnings.da],
    ["Travel Allowance", earnings.travelAllowance],
    ["Special Allowance", earnings.specialAllowance],
    ["Other Allowances", earnings.otherAllowances],
  ];

  const deductionRows = [
    ["PF", deductions.pf],
    ["ESI", deductions.esi],
    ["Professional Tax", deductions.professionalTax],
    ["TDS", deductions.tds],
    ["Other Deductions", deductions.otherDeductions],
  ];

  const history = [...(payroll.history || [])].reverse();

  const payrollMonth = payroll.payrollMonth
    ? new Date(
        Number(payroll.payrollYear),
        Number(payroll.payrollMonth) - 1,
      ).toLocaleString("en-IN", { month: "long" })
    : "—";

  return (
    <main className="min-h-screen bg-[#f3f7f4]">
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white px-4 py-4 shadow-sm sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/payroll")}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              title="Back to payroll"
            >
              <ArrowLeft size={21} />
            </button>

            <div>
              <h1 className="font-bold text-slate-900">Payroll Details</h1>
              <p className="text-xs text-slate-500">Chandra Enterprises Agro</p>
            </div>
          </div>

          <ActionButton
            variant="outline"
            onClick={loadPayroll}
            disabled={loading || processing}
          >
            <RefreshCw size={16} />
            Refresh
          </ActionButton>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        {error && (
          <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <XCircle size={18} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            {success}
          </div>
        )}

        {/* Employee and payroll header */}
        <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-green-50 p-4 text-green-800">
                <User size={30} />
              </div>

              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {getEmployeeName(employee)}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {employee.employeeCode || "No employee code"} ·{" "}
                  {employee.designation || "Employee"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {payroll.domain?.name || "Domain"} /{" "}
                  {payroll.department?.name || "Department"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={payroll.status} />
              <div className="rounded-xl bg-green-50 px-4 py-3">
                <p className="text-xs text-green-700">Net Salary</p>
                <p className="text-xl font-bold text-green-900">
                  {formatCurrency(payroll.netPay)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-4">
            <DetailItem
              label="Payroll Period"
              value={`${formatDate(payroll.periodStart)} - ${formatDate(payroll.periodEnd)}`}
            />
            <DetailItem
              label="Payroll Month"
              value={`${payrollMonth} ${payroll.payrollYear || ""}`}
            />
            <DetailItem
              label="Salary Mode"
              value={(salary.salaryMode || "—").replaceAll("_", " ")}
            />
            <DetailItem
              label="Generation Source"
              value={payroll.generationSource || "manual"}
            />
          </div>
        </div>

        {/* Workflow actions */}
        <Section title="Payroll Workflow" icon={ShieldCheck}>
          <div className="flex flex-wrap gap-3">
            {payroll.status === "draft" && canRecalculate && (
              <ActionButton
                onClick={handleRecalculate}
                disabled={processing}
                variant="outline"
              >
                <RefreshCw size={16} />
                Recalculate Draft
              </ActionButton>
            )}

            {payroll.status === "draft" && canVerify && (
              <ActionButton onClick={handleVerify} disabled={processing}>
                <ShieldCheck size={16} />
                Verify Payroll
              </ActionButton>
            )}

            {payroll.status === "verified" && canApprove && (
              <ActionButton
                onClick={handleApprove}
                disabled={processing}
                variant="blue"
              >
                <CheckCircle2 size={16} />
                Approve Payroll
              </ActionButton>
            )}

            {payroll.status === "approved" && canPay && (
              <ActionButton onClick={handleMarkPaid} disabled={processing}>
                <CreditCard size={16} />
                Mark as Paid
              </ActionButton>
            )}

            {processing && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <LoaderCircle size={17} className="animate-spin" />
                Processing...
              </div>
            )}

            {payroll.status === "paid" && (
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                <CheckCircle2 size={18} />
                Payment completed
              </div>
            )}

            {!canRecalculate && !canVerify && !canApprove && !canPay && (
              <p className="text-sm text-slate-500">
                You have read-only access to this payroll record.
              </p>
            )}
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Payroll follows the sequence Draft → Verified → Approved → Paid.
            Only draft records can be recalculated.
          </p>
        </Section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Attendance summary */}
          <Section title="Attendance Summary" icon={CalendarDays}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <DetailItem
                label="Working Days"
                value={attendance.workingDays ?? 0}
              />
              <DetailItem
                label="Present Days"
                value={attendance.presentDays ?? 0}
              />
              <DetailItem
                label="Absent Days"
                value={attendance.absentDays ?? 0}
              />
              <DetailItem label="Half Days" value={attendance.halfDays ?? 0} />
              <DetailItem
                label="Paid Leave"
                value={attendance.paidLeaveDays ?? 0}
              />
              <DetailItem
                label="Unpaid Leave"
                value={attendance.unpaidLeaveDays ?? 0}
              />
              <DetailItem label="Holidays" value={attendance.holidays ?? 0} />
              <DetailItem label="Week Offs" value={attendance.weekOffs ?? 0} />
              <DetailItem
                label="Payable Days"
                value={attendance.payableDays ?? 0}
              />
            </div>
          </Section>

          {/* Salary snapshot */}
          <Section title="Salary Structure Snapshot" icon={Building2}>
            <div className="space-y-4">
              <DetailItem
                label="Salary Mode"
                value={salary.salaryMode || "—"}
              />
              <DetailItem label="Currency" value={salary.currency || "INR"} />
              <DetailItem
                label="Pay Frequency"
                value={salary.payFrequency || "monthly"}
              />
              {salary.salaryMode === "gross" ? (
                <DetailItem
                  label="Gross Monthly Salary"
                  value={formatCurrency(salary.grossMonthly)}
                />
              ) : (
                <DetailItem
                  label="Effective From"
                  value={formatDate(salary.effectiveFrom)}
                />
              )}
              {salary.effectiveTo && (
                <DetailItem
                  label="Effective To"
                  value={formatDate(salary.effectiveTo)}
                />
              )}
            </div>
          </Section>
        </div>

        {/* Earnings and deductions */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Section title="Earnings Breakdown" icon={Banknote}>
            {salary.salaryMode === "gross" ? (
              <MoneyRow
                label="Gross Monthly Salary"
                value={salary.grossMonthly}
              />
            ) : (
              earningsRows.map(([label, value]) => (
                <MoneyRow key={label} label={label} value={value} />
              ))
            )}

            <MoneyRow
              label="Total Gross Pay"
              value={payroll.grossPay}
              highlight
            />
          </Section>

          <Section title="Deductions Breakdown" icon={Wallet}>
            {deductionRows.map(([label, value]) => (
              <MoneyRow key={label} label={label} value={value} negative />
            ))}

            <MoneyRow
              label="Total Deductions"
              value={payroll.totalDeductions}
              highlight
              negative
            />
          </Section>
        </div>

        {/* Final calculation */}
        <div className="mt-6 rounded-2xl border border-green-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-green-100 p-3 text-green-800">
              <Banknote size={23} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">
                Final Salary Calculation
              </h3>
              <p className="text-xs text-slate-500">Monthly payroll summary</p>
            </div>
          </div>

          <MoneyRow label="Gross Pay" value={payroll.grossPay} />
          <MoneyRow
            label="Total Deductions"
            value={payroll.totalDeductions}
            negative
          />

          <div className="mt-4 flex flex-col justify-between gap-2 rounded-xl bg-green-50 p-5 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-semibold text-green-800">
                Net Salary Payable
              </p>
              <p className="mt-1 text-xs text-green-700">
                Gross pay minus total deductions
              </p>
            </div>
            <p className="text-2xl font-bold text-green-900">
              {formatCurrency(payroll.netPay)}
            </p>
          </div>
        </div>

        {/* Verification and payment details */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Section title="Verification & Approval" icon={ShieldCheck}>
            <div className="space-y-4">
              <DetailItem
                label="Verified By"
                value={payroll.verifiedBy?.fullName || "Not verified"}
              />
              <DetailItem
                label="Verified At"
                value={formatDateTime(payroll.verifiedAt)}
              />
              <DetailItem
                label="Verification Remarks"
                value={payroll.verificationRemarks || "—"}
              />

              <div className="border-t border-slate-100 pt-4">
                <DetailItem
                  label="Approved By"
                  value={payroll.approvedBy?.fullName || "Not approved"}
                />
                <div className="mt-4">
                  <DetailItem
                    label="Approved At"
                    value={formatDateTime(payroll.approvedAt)}
                  />
                </div>
                <div className="mt-4">
                  <DetailItem
                    label="Approval Remarks"
                    value={payroll.approvalRemarks || "—"}
                  />
                </div>
              </div>
            </div>
          </Section>

          <Section title="Payment Information" icon={CreditCard}>
            <div className="space-y-4">
              <DetailItem
                label="Payment Status"
                value={payroll.status === "paid" ? "Paid" : "Not paid"}
              />
              <DetailItem
                label="Paid By"
                value={payroll.paidBy?.fullName || "—"}
              />
              <DetailItem
                label="Payment Date"
                value={formatDateTime(payroll.paidAt)}
              />
              <DetailItem
                label="Payment Method"
                value={(payroll.paymentMethod || "—").replaceAll("_", " ")}
              />
              <DetailItem
                label="Payment Reference"
                value={payroll.paymentReference || "—"}
              />
            </div>
          </Section>
        </div>

        {/* Activity history */}
        <div className="mt-6">
          <Section title="Payroll Activity History" icon={History}>
            {history.length === 0 ? (
              <p className="text-sm text-slate-500">
                No activity history available.
              </p>
            ) : (
              <div className="space-y-5">
                {history.map((item, index) => (
                  <div
                    key={item._id || `${item.action}-${index}`}
                    className="flex gap-3"
                  >
                    <div className="mt-1 rounded-full bg-green-100 p-2 text-green-800">
                      <Clock size={15} />
                    </div>

                    <div className="min-w-0 flex-1 border-b border-slate-100 pb-4 last:border-0">
                      <p className="text-sm font-semibold capitalize text-slate-900">
                        {(item.action || "Activity").replaceAll("_", " ")}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {item.actorType === "system"
                          ? "System"
                          : item.actionBy?.fullName || "System / User"}
                        {" · "}
                        {formatDateTime(item.actionAt)}
                      </p>

                      {item.previousStatus && item.newStatus && (
                        <p className="mt-1 text-xs text-slate-600">
                          {item.previousStatus} → {item.newStatus}
                        </p>
                      )}

                      {item.remarks && (
                        <p className="mt-2 text-sm text-slate-600">
                          {item.remarks}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        <footer className="mt-8 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Chandra Enterprises Agro · Payroll
          Management System
        </footer>
      </section>
    </main>
  );
}
