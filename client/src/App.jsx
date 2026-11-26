import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { useDispatch, useSelector } from "react-redux";
import { refreshSession } from "./features/auth/authSlice";

// authentication
import LoginPage from "./pages/LoginPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
// dashboard
import DashboardPage from "./pages/DashboardPage";

// protected route wrapper
import ProtectedRoute from "./components/ProtectedRoute";

// employee management
import EmployeeDirectoryPage from "./pages/employees/EmployeeDirectoryPage";
import AddEmployeePage from "./pages/employees/AddEmployeePage";
import EmployeeProfilePage from "./pages/employees/EmployeeProfilePage";

// attendance management
import MyAttendancePage from "./pages/attendance/MyAttendancePage";
import AttendanceManagementPage from "./pages/attendance/AttendanceManagementPage";
// organization amd department management
import OrganizationDashboard from "./features/organization/OrganizationDashboard";
import DomainManagement from "./features/organization/DomainManagement";
import DepartmentManagement from "./features/organization/DepartmentManagement";
import OrganizationChart from "./features/organization/OrganizationChart";

// Leave management
import MyLeavePage from "./pages/leaves/MyLeavePage";
import LeaveManagementPage from "./pages/leaves/LeaveManagementPage";
import LeavePolicyPage from "./pages/leaves/LeavePolicyPage";
import LeaveBalanceManagementPage from "./pages/leaves/LeaveBalanceManagementPage";

// payroll management
import PayrollDashboardPage from "./pages/payroll/PayrollDashboardPage";
import PayrollDetailsPage from "./pages/payroll/PayrollDetailsPage";

// reports management
import ReportsDashboardPage from "./pages/reports/ReportsDashboardPage";

// layout
import AppLayout from "./components/layout/AppLayout";

// documentation
import DocumentVerificationPage from "./pages/documents/DocumentVerificationPage";
import NotificationCenterPage from "./pages/notifications/NotificationCenterPage";
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
        <Route element={<AppLayout />}>
          {/* Dashboard */}
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* Account security */}
          <Route path="/change-password" element={<ChangePasswordPage />} />

          {/* Employee management */}
          <Route path="/employees" element={<EmployeeDirectoryPage />} />
          <Route path="/employees/new" element={<AddEmployeePage />} />
          <Route path="/employees/:id" element={<EmployeeProfilePage />} />

          {/* Attendance management */}
          <Route path="/attendance/me" element={<MyAttendancePage />} />
          <Route path="/attendance" element={<AttendanceManagementPage />} />

          {/* Organization management */}
          <Route path="/organization" element={<OrganizationDashboard />} />
          <Route path="/organization/domains" element={<DomainManagement />} />
          <Route
            path="/organization/departments"
            element={<DepartmentManagement />}
          />
          <Route path="/organization/chart" element={<OrganizationChart />} />

          {/* Leave management */}
          <Route path="/leaves/me" element={<MyLeavePage />} />
          <Route path="/leaves/management" element={<LeaveManagementPage />} />
          <Route path="/leaves/policies" element={<LeavePolicyPage />} />
          <Route
            path="/leaves/balances"
            element={<LeaveBalanceManagementPage />}
          />

          {/* Payroll management */}
          <Route path="/payroll" element={<PayrollDashboardPage />} />
          <Route path="/payroll/:id" element={<PayrollDetailsPage />} />

          {/* Reports */}
          <Route path="/reports" element={<ReportsDashboardPage />} />

          {/* Document verification */}
          <Route
            path="/documents/verification"
            element={<DocumentVerificationPage />}
          />

          {/* Notification Center */}
          {/* Notification Center */}
          <Route path="/notifications" element={<NotificationCenterPage />} />
        </Route>
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
