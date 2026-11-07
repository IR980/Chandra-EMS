
import dotenv from "dotenv";
import mongoose from "mongoose";

import connectDB from "../config/db.js";
import Domain from "../models/domain.model.js";
import Department from "../models/department.model.js";
import Employee from "../models/employee.model.js";
import dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config();

const inspectOrganization = async () => {
  try {
    await connectDB();

    console.log("\n========== EXISTING DOMAINS ==========\n");

    const domains = await Domain.find()
      .select("name code slug status head")
      .populate("head", "fullName employeeCode")
      .sort({ name: 1 })
      .lean();

    console.table(
      domains.map((domain) => ({
        name: domain.name,
        code: domain.code,
        slug: domain.slug,
        status: domain.status,
        head: domain.head?.fullName || "Not assigned",
      }))
    );

    console.log("\n========== EXISTING DEPARTMENTS ==========\n");

    const departments = await Department.find()
      .select("name code slug status domain manager parentDepartment")
      .populate("domain", "name code")
      .populate("manager", "fullName employeeCode")
      .populate("parentDepartment", "name code")
      .sort({ name: 1 })
      .lean();

    console.table(
      departments.map((department) => ({
        name: department.name,
        code: department.code,
        domain: department.domain?.name || "Unknown",
        parent: department.parentDepartment?.name || "None",
        manager: department.manager?.fullName || "Not assigned",
        status: department.status,
      }))
    );

    console.log("\n========== EMPLOYEE SUMMARY ==========\n");

    const totalEmployees = await Employee.countDocuments();

    const activeEmployees = await Employee.countDocuments({
      employmentStatus: "active",
    });

    console.log("Total Employees:", totalEmployees);
    console.log("Active Employees:", activeEmployees);

    console.log("\n========== ORGANIZATION SUMMARY ==========\n");

    console.log("Total Domains:", domains.length);
    console.log("Active Domains:", domains.filter((d) => d.status === "active").length);
    console.log("Total Departments:", departments.length);
    console.log("Active Departments:", departments.filter((d) => d.status === "active").length);

    console.log("\nOrganization inspection completed successfully.");
  } catch (error) {
    console.error("Organization inspection failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

inspectOrganization();

