
import "dotenv/config";
import mongoose from "mongoose";

import connectDB from "../config/db.js";
import User from "../models/user.model.js";
import Role from "../models/role.model.js";
import Employee from "../models/employee.model.js";
import Domain from "../models/domain.model.js";
import Department from "../models/department.model.js";
import dns from "dns";
dns.setServers(["8.8.8.8","8.8.4.4"]);
const inspectAdminEmployeeLink = async () => {
  try {
    await connectDB();

    console.log("\n========== SUPER ADMIN ACCOUNT ==========\n");

    const role = await Role.findOne({ slug: "super-admin" });

    if (!role) {
      console.log("Super Admin role was not found.");
      return;
    }

    const admins = await User.find({
      role: role._id,
      isDeleted: false,
    })
      .select("fullName email role employee accountStatus")
      .populate("employee", "employeeCode fullName designation workEmail");

    console.log(JSON.stringify(admins, null, 2));

    console.log("\n========== EXISTING EMPLOYEES ==========\n");

    const employees = await Employee.find({})
      .select(
        "employeeCode firstName lastName fullName workEmail phone designation employmentStatus domain department reportingManager user",
      )
      .populate("domain", "name code")
      .populate("department", "name code")
      .populate("user", "fullName email accountStatus")
      .sort({ fullName: 1 });

    console.log(
      JSON.stringify(
        employees.map((employee) => ({
          id: employee._id.toString(),
          employeeCode: employee.employeeCode,
          fullName: employee.fullName,
          workEmail: employee.workEmail,
          phone: employee.phone,
          designation: employee.designation,
          employmentStatus: employee.employmentStatus,
          domain: employee.domain?.name,
          department: employee.department?.name,
          linkedUser: employee.user
            ? {
                id: employee.user._id.toString(),
                email: employee.user.email,
                roleStatus: employee.user.accountStatus,
              }
            : null,
        })),
        null,
        2,
      ),
    );

    console.log("\n========== INSPECTION COMPLETE ==========\n");
  } catch (error) {
    console.error("Inspection failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

inspectAdminEmployeeLink();
