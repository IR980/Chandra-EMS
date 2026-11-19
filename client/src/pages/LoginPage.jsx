import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Building2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

import { loginUser, clearAuthError } from "../features/auth/authSlice";

function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const { loading, error } = useSelector((state) => state.auth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState("");

  // Success message passed from ChangePasswordPage.
  const successMessage = location.state?.message || "";

  const handleSubmit = async (event) => {
    event.preventDefault();

    setValidationError("");
    dispatch(clearAuthError());

    if (!email.trim() || !password) {
      setValidationError("Please enter your email and password.");
      return;
    }

    try {
      await dispatch(
        loginUser({
          email: email.trim(),
          password,
        }),
      ).unwrap();

      navigate("/dashboard", { replace: true });
    } catch {
      // The Redux slice stores the API error.
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f7f4] p-4 sm:p-8">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-xl lg:grid-cols-2">
        {/* Left branding section */}
        <section className="relative hidden flex-col justify-between overflow-hidden bg-[#123d2b] p-12 text-white lg:flex">
          <div className="absolute -right-28 -top-28 h-96 w-96 rounded-full border border-white/10" />
          <div className="absolute -bottom-40 -left-24 h-96 w-96 rounded-full border border-white/10" />

          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#123d2b]">
                <Building2 size={27} />
              </div>

              <div>
                <h1 className="text-xl font-bold">Chandra Enterprises</h1>
                <p className="text-xs text-green-200">Business Management</p>
              </div>
            </div>

            <div className="mt-28">
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-green-300">
                People. Performance. Progress.
              </p>

              <h2 className="max-w-md text-5xl font-bold leading-tight">
                Manage your workforce with confidence.
              </h2>

              <p className="mt-6 max-w-md leading-7 text-green-100/80">
                A centralized employee management platform for departments,
                attendance, payroll, and business operations.
              </p>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-3 border-t border-white/15 pt-6">
            <ShieldCheck className="text-green-300" size={23} />
            <p className="text-sm text-green-100">
              Secure access for authorized employees
            </p>
          </div>
        </section>

        {/* Login form */}
        <section className="flex items-center justify-center px-6 py-12 sm:px-12 lg:px-16">
          <div className="w-full max-w-md">
            {/* Mobile branding */}
            <div className="mb-10 lg:hidden">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#123d2b] text-white">
                  <Building2 size={26} />
                </div>

                <div>
                  <h1 className="font-bold text-[#123d2b]">
                    Chandra Enterprises
                  </h1>
                  <p className="text-xs text-gray-500">Employee Management</p>
                </div>
              </div>
            </div>

            {/* Heading */}
            <div>
              <span className="text-sm font-semibold text-[#27804f]">
                WELCOME BACK
              </span>

              <h2 className="mt-3 text-3xl font-bold text-gray-900">
                Sign in to your account
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Enter your credentials to access the EMS portal.
              </p>
            </div>

            {/* Password change success notification */}
            {successMessage && (
              <div className="mt-6 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                <CheckCircle2
                  size={20}
                  className="mt-0.5 shrink-0 text-green-600"
                />

                <div>
                  <p className="font-semibold">Password updated successfully</p>

                  <p className="mt-1 leading-5">{successMessage}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-9 space-y-6">
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold text-gray-700"
                >
                  Email address
                </label>

                <div className="relative">
                  <Mail
                    size={19}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3.5 pl-12 pr-4 text-sm outline-none transition focus:border-[#27804f] focus:bg-white focus:ring-4 focus:ring-green-100"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="text-sm font-semibold text-gray-700"
                  >
                    Password
                  </label>
                </div>

                <div className="relative">
                  <LockKeyhole
                    size={19}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3.5 pl-12 pr-12 text-sm outline-none transition focus:border-[#27804f] focus:bg-white focus:ring-4 focus:ring-green-100"
                    required
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((previous) => !previous)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </div>

              {/* Errors */}
              {(validationError || error) && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {validationError || error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#17613b] py-3.5 font-semibold text-white transition hover:bg-[#10492c] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign In"}

                {!loading && <ArrowRight size={19} />}
              </button>
            </form>

            {/* Footer */}
            <div className="mt-8 flex items-center justify-center gap-2 text-xs text-gray-400">
              <LockKeyhole size={14} />
              Secure Employee Management Portal
            </div>

            <p className="mt-8 text-center text-xs text-gray-400">
              © {new Date().getFullYear()} Chandra Enterprises. All rights
              reserved.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default LoginPage;
