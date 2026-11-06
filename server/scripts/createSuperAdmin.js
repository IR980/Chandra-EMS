import "dotenv/config";
import mongoose from "mongoose";

import connectDB from "../config/db.js";
import User from "../models/user.model.js";
import Role from "../models/role.model.js";
import { hashPassword } from "../utils/password.util.js";
import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const createSuperAdmin = async () => {
  try {
    const fullName = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
    const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase().trim();
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

    if (!fullName || !email || !password) {
      throw new Error(
        "Set BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD in .env"
      );
    }

    await connectDB();

    const superAdminRole = await Role.findOne({
      slug: "super-admin",
      isActive: true,
    });

    if (!superAdminRole) {
      throw new Error(
        'Super Admin role not found. Run "npm run seed:roles" first.'
      );
    }

    const existingAdmin = await User.findOne({
      role: superAdminRole._id,
      isDeleted: false,
    });

    if (existingAdmin) {
      throw new Error(
        "A Super Admin account already exists. Bootstrap cancelled."
      );
    }

    const existingEmail = await User.findOne({ email });

    if (existingEmail) {
      throw new Error("This email is already registered.");
    }

    const hashedPassword = await hashPassword(password);

    const admin = await User.create({
      fullName,
      email,
      password: hashedPassword,
      role: superAdminRole._id,
      accountStatus: "active",
      isEmailVerified: true,
    });

    console.log("\nSuper Admin created successfully!");
    console.log("Name:", admin.fullName);
    console.log("Email:", admin.email);
    console.log("Role:", superAdminRole.name);
    console.log("User ID:", admin._id.toString());
    console.log("\nYou can now log in through the EMS login API.");
  } catch (error) {
    console.error("\nSuper Admin creation failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

createSuperAdmin();