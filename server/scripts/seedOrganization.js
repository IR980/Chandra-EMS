import dotenv from "dotenv";
import mongoose from "mongoose";

import connectDB from "../config/db.js";
import Domain from "../models/domain.model.js";
import Department from "../models/department.model.js";
import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config();

const DOMAIN_CODE = "BTR";

const MAIN_DEPARTMENTS = [
  { name: "Legal", code: "LEG" },
  { name: "Marketing", code: "MKT" },
  { name: "Sales & Purchase", code: "SALES" },
  { name: "Operations", code: "OPS" },
  { name: "Accounts & Finance", code: "ACC" },
  { name: "Transport", code: "TRN" },
  { name: "Human Resources", code: "HR" },
  { name: "Security", code: "SEC" },
  { name: "Engineering", code: "ENG" },
  { name: "House Keeping", code: "HK" },
  {
    name: "Trainee & Research Development",
    code: "TRD",
  },
];

const ENGINEERING_SUB_DEPARTMENTS = [
  { name: "Software Engineering", code: "SWENG" },
  { name: "Civil Engineering", code: "CIVIL" },
  { name: "Electrical & Maintenance", code: "ELM" },
];

const createSlug = (name) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const findExistingDepartment = async (domainId, item) => {
  const byCode = await Department.findOne({
    domain: domainId,
    code: item.code,
  });

  const byName = await Department.findOne({
    domain: domainId,
    slug: createSlug(item.name),
  });

  if (byCode && byName && !byCode._id.equals(byName._id)) {
    throw new Error(
      `Conflict: code ${item.code} and name ${item.name} belong to different records.`,
    );
  }

  const existing = byCode || byName;

  if (existing && existing.name !== item.name) {
    throw new Error(
      `Code conflict: ${item.code} is already assigned to "${existing.name}".`,
    );
  }

  if (existing && existing.code !== item.code) {
    throw new Error(
      `Name conflict: "${item.name}" already uses code ${existing.code}, not ${item.code}.`,
    );
  }

  return existing;
};

const ensureDepartment = async ({
  domainId,
  item,
  parentDepartmentId = null,
}) => {
  let department = await findExistingDepartment(domainId, item);

  if (department) {
    if (parentDepartmentId) {
      if (
        department.parentDepartment &&
        !department.parentDepartment.equals(parentDepartmentId)
      ) {
        throw new Error(
          `"${item.name}" already has a different parent department.`,
        );
      }

      if (!department.parentDepartment) {
        department.parentDepartment = parentDepartmentId;
        await department.save();
        console.log(`UPDATED parent: ${item.name}`);
      } else {
        console.log(`EXISTS: ${item.name}`);
      }
    } else {
      console.log(`EXISTS: ${item.name}`);
    }

    return department;
  }

  department = await Department.create({
    name: item.name,
    code: item.code,
    slug: createSlug(item.name),
    description: "",
    domain: domainId,
    parentDepartment: parentDepartmentId,
    status: "active",
  });

  console.log(`CREATED: ${item.name} (${item.code})`);

  return department;
};

const seedOrganization = async () => {
  try {
    console.log("\nConnecting to MongoDB...");
    await connectDB();

    console.log("\n========== ORGANIZATION SETUP ==========\n");

    const domain = await Domain.findOne({
      code: DOMAIN_CODE,
      status: "active",
    });

    if (!domain) {
      throw new Error(
        `Active domain "${DOMAIN_CODE}" was not found. No departments were created.`,
      );
    }

    console.log(`Using existing domain: ${domain.name} (${domain.code})`);

    // Create or preserve all 11 main departments.
    const departmentMap = new Map();

    console.log("\n--- MAIN DEPARTMENTS ---\n");

    for (const item of MAIN_DEPARTMENTS) {
      const department = await ensureDepartment({
        domainId: domain._id,
        item,
      });

      departmentMap.set(item.code, department);
    }

    // Engineering must exist before its sub-departments are created.
    const engineering = departmentMap.get("ENG");

    if (!engineering) {
      throw new Error("Engineering department was not created or found.");
    }

    // Create Engineering's three child departments.
    console.log("\n--- ENGINEERING SUB-DEPARTMENTS ---\n");

    for (const item of ENGINEERING_SUB_DEPARTMENTS) {
      await ensureDepartment({
        domainId: domain._id,
        item,
        parentDepartmentId: engineering._id,
      });
    }

    // Verify the final structure from MongoDB.
    const departments = await Department.find({
      domain: domain._id,
    })
      .populate("parentDepartment", "name code")
      .sort({ name: 1 })
      .lean();

    const mainDepartments = departments.filter(
      (department) => !department.parentDepartment,
    );

    const subDepartments = departments.filter((department) =>
      Boolean(department.parentDepartment),
    );

    console.log("\n========== FINAL VERIFICATION ==========\n");

    console.table(
      departments.map((department) => ({
        name: department.name,
        code: department.code,
        parent: department.parentDepartment?.name || "Main Department",
        status: department.status,
      })),
    );

    console.log("\nTotal Departments:", departments.length);
    console.log("Main Departments:", mainDepartments.length);
    console.log("Sub-Departments:", subDepartments.length);

    if (mainDepartments.length !== 11 || subDepartments.length !== 3) {
      throw new Error(
        "Verification failed. Expected 11 main departments and 3 sub-departments.",
      );
    }

    console.log(
      "\nSUCCESS: Organization structure verified (11 + 3 departments).",
    );
  } catch (error) {
    console.error("\nORGANIZATION SETUP FAILED:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("\nMongoDB connection closed.");
  }
};

seedOrganization();
