import mongoose from "mongoose";

import Employee from "../models/employee.model.js";
import Domain from "../models/domain.model.js";
import Department from "../models/department.model.js";

const getEmployeeAccessScope = async (user) => {
  const scope = user?.role?.scope || "self";

  if (scope === "global") {
    return {};
  }

  const ownEmployee = await Employee.findOne({
    user: user._id,
  }).select("_id");

  if (!ownEmployee) {
    return {
      _id: new mongoose.Types.ObjectId(),
    };
  }

  if (scope === "self") {
    return {
      _id: ownEmployee._id,
    };
  }

  const [headedDomains, managedDepartments] = await Promise.all([
    Domain.find({
      head: ownEmployee._id,
      status: "active",
    }).select("_id"),

    Department.find({
      manager: ownEmployee._id,
      status: "active",
    }).select("_id"),
  ]);

  const descendantIds = [];
  const visitedIds = new Set([ownEmployee._id.toString()]);
  let managerIds = [ownEmployee._id];

  while (managerIds.length > 0) {
    const reports = await Employee.find({
      reportingManager: { $in: managerIds },
    }).select("_id");

    const nextManagerIds = [];

    for (const report of reports) {
      const reportId = report._id.toString();

      if (!visitedIds.has(reportId)) {
        visitedIds.add(reportId);
        descendantIds.push(report._id);
        nextManagerIds.push(report._id);
      }
    }

    managerIds = nextManagerIds;
  }

  const accessConditions = [{ _id: ownEmployee._id }];

  if (descendantIds.length > 0) {
    accessConditions.push({
      _id: { $in: descendantIds },
    });
  }

  if (headedDomains.length > 0) {
    accessConditions.push({
      domain: {
        $in: headedDomains.map((item) => item._id),
      },
    });
  }

  if (managedDepartments.length > 0) {
    accessConditions.push({
      department: {
        $in: managedDepartments.map((item) => item._id),
      },
    });
  }

  return {
    $or: accessConditions,
  };
};

export default getEmployeeAccessScope;
