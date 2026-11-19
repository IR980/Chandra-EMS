import { useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  LockKeyhole,
} from "lucide-react";

import api from "../services/api";
import { clearAuthSession } from "../features/auth/authSlice";

const initialForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

// Password field is declared outside the page component.
// This prevents unnecessary remounting and loss of input focus.
function PasswordField({
  label,
  name,
  placeholder,
  autoComplete,
  form,
  visible,
  loading,
  onChange,
  onToggle,
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-2 block text-sm font-semibold text-slate-700"
      >
        {label}
      </label>

      <div className="relative">
        <input
          id={name}
          name={name}
          type={visible[name] ? "text" : "password"}
          value={form[name]}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          maxLength={128}
          required
          disabled={loading}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-green-600 focus:ring-4 focus:ring-green-100 disabled:bg-slate-100"
        />

        <button
          type="button"
          onClick={() => onToggle(name)}
          disabled={loading}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-green-800"
          aria-label={visible[name] ? "Hide password" : "Show password"}
        >
          {visible[name] ? <EyeOff size={19} /> : <Eye size={19} />}
        </button>
      </div>
    </div>
  );
}

export default function ChangePasswordPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);

  const [visible, setVisible] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const passwordChecks = [
    {
      label: "At least 8 characters",
      valid: form.newPassword.length >= 8,
    },
    {
      label: "At least one uppercase letter",
      valid: /[A-Z]/.test(form.newPassword),
    },
    {
      label: "At least one lowercase letter",
      valid: /[a-z]/.test(form.newPassword),
    },
    {
      label: "At least one number",
      valid: /\d/.test(form.newPassword),
    },
    {
      label: "At least one special character",
      valid: /[^A-Za-z0-9]/.test(form.newPassword),
    },
    {
      label: "Maximum 128 characters",
      valid: form.newPassword.length <= 128,
    },
  ];

  const allPasswordChecksPassed = passwordChecks.every((check) => check.valid);

  const toggleVisibility = (field) => {
    setVisible((previous) => ({
      ...previous,
      [field]: !previous[field],
    }));
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  };

  const validateForm = () => {
    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      return "Please fill in all password fields.";
    }

    if (form.newPassword.length < 8 || form.newPassword.length > 128) {
      return "New password must contain between 8 and 128 characters.";
    }

    if (!allPasswordChecksPassed) {
      return "Please satisfy all the new password requirements.";
    }

    if (form.currentPassword === form.newPassword) {
      return "New password must be different from your current password.";
    }

    if (form.newPassword !== form.confirmPassword) {
      return "New password and confirm password do not match.";
    }

    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const response = await api.patch("/auth/change-password", {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });

      const successMessage =
        response.data?.message ||
        "Password changed successfully. Please log in again.";

      setSuccess(successMessage);

      // Clear local authentication because the backend
      // invalidates existing sessions after password change.
      dispatch(clearAuthSession());

      // Send the user to login with a success message.
      navigate("/login", {
        replace: true,
        state: {
          message:
            "Your password was changed successfully. Please log in using your new password.",
        },
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to change password. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f3f7f4] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <header className="mb-8 flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="rounded-xl border border-slate-200 bg-white p-3 text-slate-600 shadow-sm transition hover:bg-slate-50"
            aria-label="Back to dashboard"
          >
            <ArrowLeft size={20} />
          </button>

          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Change Password
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Chandra Enterprises Agro — Account Security
            </p>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Password form */}
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-8">
            <div className="mb-7 flex items-center gap-4">
              <div className="rounded-2xl bg-green-50 p-4 text-green-800">
                <KeyRound size={27} />
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Update your password
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Enter your current password and choose a new one.
                </p>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <AlertCircle size={19} className="mt-0.5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {/* Success message */}
            {success && (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
                <p>{success}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <PasswordField
                label="Current Password"
                name="currentPassword"
                placeholder="Enter your current password"
                autoComplete="current-password"
                form={form}
                visible={visible}
                loading={loading}
                onChange={handleChange}
                onToggle={toggleVisibility}
              />

              <div className="border-t border-slate-100 pt-5">
                <PasswordField
                  label="New Password"
                  name="newPassword"
                  placeholder="Enter your new password"
                  autoComplete="new-password"
                  form={form}
                  visible={visible}
                  loading={loading}
                  onChange={handleChange}
                  onToggle={toggleVisibility}
                />
              </div>

              {/* Password requirements */}
              {form.newPassword && (
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="mb-3 text-sm font-semibold text-slate-700">
                    Password requirements
                  </p>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {passwordChecks.map((check) => (
                      <div
                        key={check.label}
                        className={`flex items-center gap-2 text-xs ${
                          check.valid ? "text-green-700" : "text-slate-500"
                        }`}
                      >
                        <CheckCircle2
                          size={15}
                          className={
                            check.valid ? "text-green-600" : "text-slate-300"
                          }
                        />

                        {check.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <PasswordField
                label="Confirm New Password"
                name="confirmPassword"
                placeholder="Re-enter your new password"
                autoComplete="new-password"
                form={form}
                visible={visible}
                loading={loading}
                onChange={handleChange}
                onToggle={toggleVisibility}
              />

              {/* Password match indicator */}
              {form.confirmPassword && (
                <p
                  className={`text-xs font-medium ${
                    form.newPassword === form.confirmPassword
                      ? "text-green-700"
                      : "text-red-600"
                  }`}
                >
                  {form.newPassword === form.confirmPassword
                    ? "Passwords match."
                    : "Passwords do not match."}
                </p>
              )}

              {/* Submit button */}
              <div className="border-t border-slate-100 pt-5">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#17613b] px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <LoaderCircle size={18} className="animate-spin" />
                      Updating Password...
                    </>
                  ) : (
                    <>
                      <LockKeyhole size={18} />
                      Change Password
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>

          {/* Security information */}
          <aside className="space-y-5">
            <div className="rounded-2xl bg-[#17613b] p-6 text-white shadow-sm">
              <ShieldCheck size={34} />

              <h3 className="mt-4 text-lg font-bold">
                Keep your account secure
              </h3>

              <p className="mt-2 text-sm leading-6 text-green-50">
                Use a strong, unique password. Never share your password with
                anyone.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h3 className="font-bold text-slate-900">
                Important information
              </h3>

              <ul className="mt-3 space-y-3 text-sm leading-5 text-slate-600">
                <li>• Your current password is required.</li>
                <li>• Your new password must be different.</li>
                <li>• All existing sessions will be invalidated.</li>
                <li>• You must log in again using your new password.</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
