
export const PERMISSIONS = {
  // Dashboard
  DASHBOARD_VIEW: 'dashboard.view',

  // Organization
  ORGANIZATION_VIEW: 'organization.view',
  ORGANIZATION_MANAGE: 'organization.manage',

  // Domains and departments
  DOMAINS_VIEW: 'domains.view',
  DOMAINS_MANAGE: 'domains.manage',
  DEPARTMENTS_VIEW: 'departments.view',
  DEPARTMENTS_MANAGE: 'departments.manage',

  // Employees
  EMPLOYEES_VIEW: 'employees.view',
  EMPLOYEES_CREATE: 'employees.create',
  EMPLOYEES_UPDATE: 'employees.update',
  EMPLOYEES_ARCHIVE: 'employees.archive',

  // Attendance
  ATTENDANCE_VIEW: 'attendance.view',
  ATTENDANCE_MARK: 'attendance.mark',
  ATTENDANCE_MANAGE: 'attendance.manage',
  ATTENDANCE_APPROVE: 'attendance.approve',

  // Leave
  LEAVE_VIEW: 'leave.view',
  LEAVE_APPLY: 'leave.apply',
  LEAVE_APPROVE: 'leave.approve',
  LEAVE_MANAGE: 'leave.manage',

  // Payroll
  PAYROLL_VIEW: 'payroll.view',
  PAYROLL_MANAGE: 'payroll.manage',
  PAYROLL_VERIFY: 'payroll.verify',
  PAYROLL_APPROVE: 'payroll.approve',

  // Performance and tasks
  PERFORMANCE_VIEW: 'performance.view',
  PERFORMANCE_MANAGE: 'performance.manage',
  TASKS_VIEW: 'tasks.view',
  TASKS_MANAGE: 'tasks.manage',

  // Reports
  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',

  // User management
  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_MANAGE_ROLES: 'users.manage_roles',

  // Documents and notifications
  DOCUMENTS_VIEW: 'documents.view',
  DOCUMENTS_MANAGE: 'documents.manage',
  NOTIFICATIONS_VIEW: 'notifications.view',
  NOTIFICATIONS_MANAGE: 'notifications.manage',

  // Audit and settings
  AUDIT_LOGS_VIEW: 'audit_logs.view',
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_MANAGE: 'settings.manage',
};

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);
