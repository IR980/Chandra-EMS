import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Building2, LogOut, ShieldCheck, Users, Network } from "lucide-react";
import { logoutUser } from "../features/auth/authSlice";

function DashboardPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { user } = useSelector((state) => state.auth);

  const handleLogout = async () => {
    try {
      await dispatch(logoutUser()).unwrap();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <main className="min-h-screen bg-[#f3f7f4]">
      <header className="flex items-center justify-between bg-white px-6 py-5 shadow-sm sm:px-10">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[#17613b] p-3 text-white">
            <Building2 size={23} />
          </div>
          <div>
            <h1 className="font-bold text-gray-900">Chandra Enterprises</h1>
            <p className="text-xs text-gray-500">Employee Management System</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
        >
          <LogOut size={17} />
          Logout
        </button>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldCheck size={30} className="text-green-700" />
            <div>
              <p className="text-sm font-medium text-green-700">
                Authentication successful
              </p>
              <h2 className="text-2xl font-bold text-gray-900">
                Welcome, {user?.fullName}!
              </h2>
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-gray-50 p-5">
              <p className="text-sm text-gray-500">Email</p>
              <p className="mt-2 font-semibold text-gray-900">{user?.email}</p>
            </div>

            <div className="rounded-xl bg-gray-50 p-5">
              <p className="text-sm text-gray-500">Role</p>
              <p className="mt-2 font-semibold text-gray-900">
                {user?.role?.name}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-5">
              <p className="text-sm text-gray-500">Account Status</p>
              <p className="mt-2 font-semibold capitalize text-green-700">
                {user?.accountStatus}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-5">
              <p className="text-sm text-gray-500">Permissions</p>
              <p className="mt-2 font-semibold text-gray-900">
                {user?.role?.permissions?.length || 0} permissions
              </p>
            </div>
          </div>

          <p className="mt-8 text-sm text-gray-500">
            Your EMS authentication is connected. We will build the full
            department-wise management dashboard in the next phase.
          </p>

          <div className="mt-6">
            <button
              onClick={() => navigate("/employees")}
              className="flex items-center gap-2 rounded-lg bg-[#17613b] px-5 py-3 text-sm font-semibold text-white hover:bg-green-800"
            >
              <Users size={18} />
              Manage Employees
            </button>

            <button
              onClick={() => navigate("/organization")}
              className="mt-3 flex items-center gap-2 rounded-lg border border-green-700 px-5 py-3 text-sm font-semibold text-green-800 hover:bg-green-50"
            >
              <Network size={18} />
              Organization Management
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default DashboardPage;
