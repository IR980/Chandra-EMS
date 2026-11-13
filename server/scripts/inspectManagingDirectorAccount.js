
import "dotenv/config";
import mongoose from "mongoose";
import dns from "dns";
import connectDB from "../config/db.js";
import User from "../models/user.model.js";
import Employee from "../models/employee.model.js";
import Role from "../models/role.model.js";
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const run = async () => {
  try {
    await connectDB();

    const employee = await Employee.findOne({
      employeeCode: "CE-EMP-0003",
    }).lean();

    if (!employee) {
      console.log("Managing Director employee not found.");
      return;
    }

    const linkedUser = await User.findById(employee.user)
      .select("fullName email role employee accountStatus")
      .populate("role", "name slug level")
      .lean();

    console.log("\nMANAGING DIRECTOR EMPLOYEE:");
    console.log({
      employeeId: employee._id.toString(),
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      designation: employee.designation,
      userId: employee.user?.toString() || null,
    });

    console.log("\nLINKED LOGIN ACCOUNT:");
    console.log(linkedUser);

    console.log("\nALL ACTIVE SUPER ADMIN ACCOUNTS:");

    const superAdminRole = await Role.findOne({
      slug: "super-admin",
    });

    const admins = await User.find({
      role: superAdminRole?._id,
      isDeleted: false,
    })
      .select("fullName email employee accountStatus")
      .lean();

    console.log(admins);

    console.log("\nINSPECTION COMPLETE.");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
