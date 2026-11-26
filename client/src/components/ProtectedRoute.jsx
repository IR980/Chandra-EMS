import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";

function ProtectedRoute({ permission, permissions = [] }) {
  const { isAuthenticated, initialized, user } = useSelector(
    (state) => state.auth,
  );

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-green-700 border-t-transparent" />
          <p className="mt-4 text-sm text-gray-500">Checking your session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const userPermissions = user?.role?.permissions || [];

  const hasPermission = (requiredPermission) =>
    userPermissions.includes("*") ||
    userPermissions.includes(requiredPermission);

  const allowed =
    (!permission || hasPermission(permission)) &&
    permissions.every(hasPermission);

  if (!allowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
