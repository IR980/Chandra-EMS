import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { useDispatch, useSelector } from "react-redux";
import { refreshSession } from "./features/auth/authSlice";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ProtectedRoute from "./components/ProtectedRoute";
import EmployeeDirectoryPage from "./pages/employees/EmployeeDirectoryPage";
import AddEmployeePage from "./pages/employees/AddEmployeePage";
import EmployeeProfilePage from "./pages/employees/EmployeeProfilePage";

// organization amd department management
import OrganizationDashboard from "./features/organization/OrganizationDashboard";
import DomainManagement from "./features/organization/DomainManagement";
import DepartmentManagement from "./features/organization/DepartmentManagement";
import OrganizationChart from "./features/organization/OrganizationChart";
function App() {
  const dispatch = useDispatch();

  const { initialized, isAuthenticated } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(refreshSession());
  }, [dispatch]);

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-700 border-t-transparent" />
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
        }
      />

      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
        }
      />

      <Route element={<ProtectedRoute />}>
        <Route path="/employees" element={<EmployeeDirectoryPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/employees/new" element={<AddEmployeePage />} />
        <Route path="/employees/:id" element={<EmployeeProfilePage />} />
        <Route path="/organization" element={<OrganizationDashboard />} />
        <Route path="/organization/domains" element={<DomainManagement />} />
        <Route path="/organization/departments" element={<DepartmentManagement />} />
        <Route path="/organization/chart" element={<OrganizationChart />} />
      </Route>

      <Route
        path="*"
        element={
          <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
        }
      />
    </Routes>
  );
}

export default App;
