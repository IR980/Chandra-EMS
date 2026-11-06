import dotenv from "dotenv";
import mongoose from "mongoose";
import dns from 'node:dns';

// Configure DNS resolvers before MongoDB connection
dns.setServers(['8.8.8.8', '8.8.4.4']);
import connectDB from "../config/db.js";
import Role from "../models/role.model.js";
import { ALL_PERMISSIONS, PERMISSIONS } from "../config/permissions.js";

dotenv.config();

const P = PERMISSIONS;

const roleDefinitions = [
  {
    name: "Super Admin",
    slug: "super-admin",
    description: "Complete system administration access.",
    level: 100,
    scope: "global",
    permissions: ["*"],
  },
  {
    name: "Managing Director",
    slug: "managing-director",
    description: "Company-wide visibility and final approvals.",
    level: 90,
    scope: "global",
    permissions: [
      P.DASHBOARD_VIEW,
      P.ORGANIZATION_VIEW,
      P.DOMAINS_VIEW,
      P.DEPARTMENTS_VIEW,
      P.EMPLOYEES_VIEW,
      P.ATTENDANCE_VIEW,
      P.LEAVE_VIEW,
      P.LEAVE_APPROVE,
      P.PAYROLL_VIEW,
      P.PAYROLL_APPROVE,
      P.PERFORMANCE_VIEW,
      P.REPORTS_VIEW,
      P.REPORTS_EXPORT,
      P.USERS_VIEW,
      P.AUDIT_LOGS_VIEW,
      P.SETTINGS_VIEW,
    ],
  },
  {
    name: "Director",
    slug: "director",
    description: "Supervises assigned business domains and departments.",
    level: 80,
    scope: "assigned",
    permissions: [
      P.DASHBOARD_VIEW,
      P.ORGANIZATION_VIEW,
      P.DOMAINS_VIEW,
      P.DEPARTMENTS_VIEW,
      P.EMPLOYEES_VIEW,
      P.ATTENDANCE_VIEW,
      P.LEAVE_VIEW,
      P.LEAVE_APPROVE,
      P.PAYROLL_VIEW,
      P.PERFORMANCE_VIEW,
      P.PERFORMANCE_MANAGE,
      P.REPORTS_VIEW,
      P.REPORTS_EXPORT,
      P.TASKS_VIEW,
      P.TASKS_MANAGE,
    ],
  },
  {
    name: "HR Admin",
    slug: "hr-admin",
    description: "Centralized human resource administration.",
    level: 70,
    scope: "global",
    permissions: [
      P.DASHBOARD_VIEW,
      P.ORGANIZATION_VIEW,
      P.ORGANIZATION_MANAGE,
      P.DOMAINS_VIEW,
      P.DOMAINS_MANAGE,
      P.DEPARTMENTS_VIEW,
      P.DEPARTMENTS_MANAGE,
      P.EMPLOYEES_VIEW,
      P.EMPLOYEES_CREATE,
      P.EMPLOYEES_UPDATE,
      P.EMPLOYEES_ARCHIVE,
      P.ATTENDANCE_VIEW,
      P.ATTENDANCE_MANAGE,
      P.ATTENDANCE_APPROVE,
      P.LEAVE_VIEW,
      P.LEAVE_APPROVE,
      P.LEAVE_MANAGE,
      P.PERFORMANCE_VIEW,
      P.PERFORMANCE_MANAGE,
      P.TASKS_VIEW,
      P.REPORTS_VIEW,
      P.REPORTS_EXPORT,
      P.USERS_VIEW,
      P.USERS_CREATE,
      P.USERS_UPDATE,
      P.DOCUMENTS_VIEW,
      P.DOCUMENTS_MANAGE,
      P.NOTIFICATIONS_VIEW,
      P.NOTIFICATIONS_MANAGE,
    ],
  },
  {
    name: "HR Manager",
    slug: "hr-manager",
    description: "Manages employee records, attendance and leave.",
    level: 65,
    scope: "global",
    permissions: [
      P.DASHBOARD_VIEW,
      P.EMPLOYEES_VIEW,
      P.EMPLOYEES_CREATE,
      P.EMPLOYEES_UPDATE,
      P.ATTENDANCE_VIEW,
      P.ATTENDANCE_MANAGE,
      P.ATTENDANCE_APPROVE,
      P.LEAVE_VIEW,
      P.LEAVE_APPROVE,
      P.LEAVE_MANAGE,
      P.PERFORMANCE_VIEW,
      P.TASKS_VIEW,
      P.REPORTS_VIEW,
      P.REPORTS_EXPORT,
      P.DOCUMENTS_VIEW,
      P.DOCUMENTS_MANAGE,
      P.NOTIFICATIONS_VIEW,
    ],
  },
  {
    name: "Department Manager",
    slug: "department-manager",
    description: "Manages employees and operations in assigned departments.",
    level: 60,
    scope: "assigned",
    permissions: [
      P.DASHBOARD_VIEW,
      P.EMPLOYEES_VIEW,
      P.EMPLOYEES_UPDATE,
      P.ATTENDANCE_VIEW,
      P.ATTENDANCE_MANAGE,
      P.ATTENDANCE_APPROVE,
      P.LEAVE_VIEW,
      P.LEAVE_APPROVE,
      P.PERFORMANCE_VIEW,
      P.PERFORMANCE_MANAGE,
      P.TASKS_VIEW,
      P.TASKS_MANAGE,
      P.REPORTS_VIEW,
      P.DOCUMENTS_VIEW,
      P.NOTIFICATIONS_VIEW,
    ],
  },
  {
    name: "Department Coordinator",
    slug: "department-coordinator",
    description: "Coordinates assigned department teams and daily operations.",
    level: 50,
    scope: "assigned",
    permissions: [
      P.DASHBOARD_VIEW,
      P.EMPLOYEES_VIEW,
      P.ATTENDANCE_VIEW,
      P.ATTENDANCE_MANAGE,
      P.LEAVE_VIEW,
      P.LEAVE_APPROVE,
      P.TASKS_VIEW,
      P.TASKS_MANAGE,
      P.PERFORMANCE_VIEW,
      P.REPORTS_VIEW,
      P.NOTIFICATIONS_VIEW,
    ],
  },
  {
    name: "Supervisor",
    slug: "supervisor",
    description: "Supervises attendance and activities of assigned employees.",
    level: 40,
    scope: "assigned",
    permissions: [
      P.DASHBOARD_VIEW,
      P.EMPLOYEES_VIEW,
      P.ATTENDANCE_VIEW,
      P.ATTENDANCE_MANAGE,
      P.LEAVE_VIEW,
      P.TASKS_VIEW,
      P.TASKS_MANAGE,
      P.NOTIFICATIONS_VIEW,
    ],
  },
  {
    name: "Accounts Manager",
    slug: "accounts-manager",
    description: "Manages salary structures, payroll and salary reports.",
    level: 60,
    scope: "global",
    permissions: [
      P.DASHBOARD_VIEW,
      P.PAYROLL_VIEW,
      P.PAYROLL_MANAGE,
      P.PAYROLL_VERIFY,
      P.REPORTS_VIEW,
      P.REPORTS_EXPORT,
      P.EMPLOYEES_VIEW,
      P.NOTIFICATIONS_VIEW,
    ],
  },
  {
    name: "Employee",
    slug: "employee",
    description: "Access to personal employee information and services.",
    level: 10,
    scope: "self",
    permissions: [
      P.DASHBOARD_VIEW,
      P.ATTENDANCE_VIEW,
      P.ATTENDANCE_MARK,
      P.LEAVE_VIEW,
      P.LEAVE_APPLY,
      P.PERFORMANCE_VIEW,
      P.TASKS_VIEW,
      P.DOCUMENTS_VIEW,
      P.NOTIFICATIONS_VIEW,
    ],
  },
];

async function seedRoles() {
  try {
    await connectDB();

    console.log("\nStarting Chandra Enterprises EMS role seeding...\n");

    for (const roleData of roleDefinitions) {
      // Validate permission names before writing
      if (
        roleData.permissions.includes("*") === false &&
        roleData.permissions.some(
          (permission) => !ALL_PERMISSIONS.includes(permission),
        )
      ) {
        throw new Error(`Invalid permission found for ${roleData.name}`);
      }

      await Role.updateOne(
        { slug: roleData.slug },
        {
          $set: {
            name: roleData.name,
            description: roleData.description,
            level: roleData.level,
            scope: roleData.scope,
            permissions: roleData.permissions,
            isSystemRole: true,
            isActive: true,
          },
          $setOnInsert: {
            slug: roleData.slug,
          },
        },
        { upsert: true, runValidators: true },
      );

      console.log(`Role created/updated: ${roleData.name}`);
    }

    console.log("\nAll default roles seeded successfully!");
    console.log(`Total roles configured: ${roleDefinitions.length}`);
  } catch (error) {
    console.error("\nRole seeding failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedRoles();
