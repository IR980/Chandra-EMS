import mongoose from "mongoose";

import Employee from "../models/employee.model.js";
import Domain from "../models/domain.model.js";
import Department from "../models/department.model.js";
import User from "../models/user.model.js";
import Role from "../models/role.model.js";
import { hashPassword } from "../utils/password.util.js";
import getEmployeeAccessScope from "../utils/employeeAccessScope.js";
import { createBulkNotifications } from "../services/notification.service.js";
const allowedFields = [
  "firstName",
  "lastName",
  "profilePhoto",
  "dateOfBirth",
  "gender",
  "workEmail",
  "personalEmail",
  "phone",
  "alternatePhone",
  "address",
  "designation",
  "employmentType",
  "joiningDate",
  "confirmationDate",
  "employmentStatus",
  "exitDate",
  "domain",
  "department",
  "reportingManager",
  "emergencyContact",
  "notes",
];

const validateOrganization = async (domainId, departmentId) => {
  if (
    !mongoose.isValidObjectId(domainId) ||
    !mongoose.isValidObjectId(departmentId)
  ) {
    return "A valid domain and department are required.";
  }

  const [domain, department] = await Promise.all([
    Domain.findOne({ _id: domainId, status: "active" }),
    Department.findOne({
      _id: departmentId,
      domain: domainId,
      status: "active",
    }),
  ]);

  if (!domain) return "Selected domain does not exist or is inactive.";

  if (!department) {
    return "Selected department is not active or does not belong to this domain.";
  }

  return null;
};

const validateReportingManager = async (
  managerId,
  domainId,
  departmentId,
  currentEmployeeId = null,
) => {
  if (!managerId) return null;

  if (!mongoose.isValidObjectId(managerId)) {
    return "Invalid reporting manager ID.";
  }

  if (
    currentEmployeeId &&
    managerId.toString() === currentEmployeeId.toString()
  ) {
    return "An employee cannot report to themselves.";
  }

  // The manager must be active and belong to the same domain
  // and department.
  const manager = await Employee.findOne({
    _id: managerId,
    employmentStatus: "active",
    domain: domainId,
    department: departmentId,
  }).select("_id reportingManager");

  if (!manager) {
    return (
      "Reporting manager must be an active employee " +
      "in the same domain and department."
    );
  }

  // Walk up the proposed manager's reporting chain.
  // If the current employee is found, assigning this manager
  // would create a circular reporting relationship.
  if (currentEmployeeId) {
    const visited = new Set();
    let currentManager = manager;

    while (currentManager) {
      const currentId = currentManager._id.toString();

      if (currentId === currentEmployeeId.toString()) {
        return "This reporting assignment would create a circular hierarchy.";
      }

      if (visited.has(currentId)) {
        return "The existing reporting hierarchy contains a circular relationship.";
      }

      visited.add(currentId);

      if (!currentManager.reportingManager) {
        break;
      }

      currentManager = await Employee.findById(
        currentManager.reportingManager,
      ).select("_id reportingManager");
    }
  }

  return null;
};

// CREATE EMPLOYEE
export const createEmployee = async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      phone,
      designation,
      joiningDate,
      domain,
      department,
      reportingManager,
    } = req.body;

    if (
      !firstName?.trim() ||
      !lastName?.trim() ||
      !phone?.trim() ||
      !designation?.trim() ||
      !joiningDate ||
      !domain ||
      !department
    ) {
      return res.status(400).json({
        success: false,
        message:
          "First name, last name, phone, designation, joining date, domain and department are required.",
      });
    }

    const organizationError = await validateOrganization(domain, department);

    if (organizationError) {
      return res.status(400).json({
        success: false,
        message: organizationError,
      });
    }

    const managerError = await validateReportingManager(
      reportingManager,
      domain,
      department,
    );

    if (managerError) {
      return res.status(400).json({
        success: false,
        message: managerError,
      });
    }

    const employeeData = {};

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        employeeData[field] = req.body[field];
      }
    }

    const employee = await Employee.create({
      ...employeeData,
      firstName,
      lastName,
      phone,
      designation,
      joiningDate,
      domain,
      department,
      reportingManager: reportingManager || null,
      createdBy: req.user._id,
    });

    const populatedEmployee = await Employee.findById(employee._id)
      .populate("domain", "name code")
      .populate("department", "name code")
      .populate("reportingManager", "employeeCode fullName designation");

    // Notification failures must never interrupt employee registration.
    // Send best-effort notifications to Super Admin and organizational managers.
    try {
      const [departmentRecord, domainRecord, superAdminRole] =
        await Promise.all([
          Department.findById(department).select("manager"),
          Domain.findById(domain).select("head"),
          Role.findOne({
            slug: "super-admin",
            isActive: true,
          }).select("_id"),
        ]);

      // Collect organizational manager employee IDs.
      const managerEmployeeIds = [
        reportingManager,
        departmentRecord?.manager,
        domainRecord?.head,
      ].filter(Boolean);

      const uniqueManagerIds = [
        ...new Set(managerEmployeeIds.map((id) => id.toString())),
      ];

      // Find manager user accounts.
      const managerEmployees = uniqueManagerIds.length
        ? await Employee.find({
            _id: { $in: uniqueManagerIds },
            employmentStatus: "active",
            user: { $exists: true, $ne: null },
          }).select("user")
        : [];

      const managerUserIds = managerEmployees
        .map((manager) => manager.user?.toString())
        .filter(Boolean);

      // Find active Super Admin accounts independently.
      const superAdminUsers = superAdminRole
        ? await User.find({
            role: superAdminRole._id,
            accountStatus: "active",
            isDeleted: false,
          }).select("_id")
        : [];

      const superAdminUserIds = superAdminUsers.map((user) =>
        user._id.toString(),
      );

      // Combine recipients and prevent duplicate/self notifications.
      const actorId = req.user._id.toString();

      const recipientIds = [
        ...new Set([...managerUserIds, ...superAdminUserIds]),]

      if (recipientIds.length > 0) {
        await createBulkNotifications(recipientIds, {
          actor: req.user._id,
          category: "employee",
          priority: "medium",
          title: "New Employee Registered",
          message: `${populatedEmployee.fullName} has been added to ${populatedEmployee.department?.name || "the department"} in ${populatedEmployee.domain?.name || "the domain"}.`,
          actionUrl: "/employees",
          relatedEntity: {
            type: "Employee",
            id: employee._id,
          },
        });
      }
    } catch (notificationError) {
      console.error(
        "[Employee Notification] Delivery failed:",
        notificationError.message,
      );
    }

    return res.status(201).json({
      success: true,
      message: "Employee created successfully.",
      data: { employee: populatedEmployee },
    });
  } catch (error) {
    next(error);
  }
};

// LIST EMPLOYEES WITH SEARCH AND FILTERS

// LIST EMPLOYEES WITH SEARCH, FILTERS AND ACCESS SCOPE
export const getEmployees = async (req, res, next) => {
  try {
    const {
      search,
      domain,
      department,
      employmentStatus = "all",
      employmentType,
      designation,
      page = 1,
      limit = 20,
    } = req.query;

    // Apply the logged-in user's employee access scope.
    const accessScope = await getEmployeeAccessScope(req.user);

    const conditions = [accessScope];

    // Apply requested filters.
    if (domain) {
      if (!mongoose.isValidObjectId(domain)) {
        return res.status(400).json({
          success: false,
          message: "Invalid domain ID.",
        });
      }

      conditions.push({ domain });
    }

    if (department) {
      if (!mongoose.isValidObjectId(department)) {
        return res.status(400).json({
          success: false,
          message: "Invalid department ID.",
        });
      }

      conditions.push({ department });
    }

    if (employmentStatus !== "all" && employmentStatus) {
      conditions.push({ employmentStatus });
    }

    if (employmentType) {
      conditions.push({ employmentType });
    }

    // Escape special regex characters in user input.
    const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    if (designation?.trim()) {
      conditions.push({
        designation: {
          $regex: escapeRegex(designation.trim()),
          $options: "i",
        },
      });
    }

    if (search?.trim()) {
      const searchTerm = escapeRegex(search.trim());

      conditions.push({
        $or: [
          { employeeCode: { $regex: searchTerm, $options: "i" } },
          { fullName: { $regex: searchTerm, $options: "i" } },
          { firstName: { $regex: searchTerm, $options: "i" } },
          { lastName: { $regex: searchTerm, $options: "i" } },
          { phone: { $regex: searchTerm, $options: "i" } },
          { workEmail: { $regex: searchTerm, $options: "i" } },
          { designation: { $regex: searchTerm, $options: "i" } },
        ],
      });
    }

    const filter = { $and: conditions };

    const pageNumber = Math.max(
      1,
      Math.min(100000, Number.parseInt(page, 10) || 1),
    );

    const pageSize = Math.min(
      100,
      Math.max(1, Number.parseInt(limit, 10) || 20),
    );

    const [employees, total] = await Promise.all([
      Employee.find(filter)
        .populate("domain", "name code")
        .populate("department", "name code")
        .populate("reportingManager", "employeeCode fullName designation")
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize),

      Employee.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        employees,
        pagination: {
          total,
          page: pageNumber,
          limit: pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET EMPLOYEE BY ID

// GET EMPLOYEE BY ID — ENFORCE ACCESS SCOPE
export const getEmployeeById = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID.",
      });
    }

    const accessScope = await getEmployeeAccessScope(req.user);

    const employee = await Employee.findOne({
      $and: [{ _id: req.params.id }, accessScope],
    })
      .populate("domain", "name code")
      .populate("department", "name code")
      .populate("reportingManager", "employeeCode fullName designation")
      .populate("user", "fullName email accountStatus");

    // Return the same response for missing and inaccessible records.
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: { employee },
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE EMPLOYEE

// UPDATE EMPLOYEE — ENFORCE ACCESS SCOPE
export const updateEmployee = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID.",
      });
    }

    const accessScope = await getEmployeeAccessScope(req.user);

    const employee = await Employee.findOne({
      $and: [{ _id: req.params.id }, accessScope],
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found.",
      });
    }

    const updates = Object.keys(req.body);

    if (
      !updates.length ||
      updates.some((field) => !allowedFields.includes(field))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid or empty employee update.",
      });
    }

    const nextDomain = req.body.domain || employee.domain.toString();
    const nextDepartment =
      req.body.department || employee.department.toString();

    const organizationError = await validateOrganization(
      nextDomain,
      nextDepartment,
    );

    if (organizationError) {
      return res.status(400).json({
        success: false,
        message: organizationError,
      });
    }

    // Prevent assigned-scope users from transferring employees
    // outside their own access scope.
    const targetOrganizationScope = await Employee.findOne({
      $and: [
        {
          domain: nextDomain,
          department: nextDepartment,
        },
        accessScope,
      ],
    }).select("_id");

    if (!targetOrganizationScope) {
      return res.status(403).json({
        success: false,
        message: "You cannot move an employee outside your assigned scope.",
      });
    }

    const nextManager = Object.prototype.hasOwnProperty.call(
      req.body,
      "reportingManager",
    )
      ? req.body.reportingManager
      : employee.reportingManager;

    const managerError = await validateReportingManager(
      nextManager,
      nextDomain,
      nextDepartment,
      employee._id,
    );

    if (managerError) {
      return res.status(400).json({
        success: false,
        message: managerError,
      });
    }

    for (const field of updates) {
      employee[field] = req.body[field];
    }

    employee.updatedBy = req.user._id;

    await employee.save();

    const updatedEmployee = await Employee.findById(employee._id)
      .populate("domain", "name code")
      .populate("department", "name code")
      .populate("reportingManager", "employeeCode fullName designation");

    return res.status(200).json({
      success: true,
      message: "Employee updated successfully.",
      data: { employee: updatedEmployee },
    });
  } catch (error) {
    next(error);
  }
};

// DEACTIVATE EMPLOYEE

// DEACTIVATE EMPLOYEE — ENFORCE ACCESS SCOPE
export const deactivateEmployee = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID.",
      });
    }

    const accessScope = await getEmployeeAccessScope(req.user);

    const employee = await Employee.findOne({
      $and: [{ _id: req.params.id }, accessScope],
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found.",
      });
    }

    if (employee.employmentStatus === "inactive") {
      return res.status(400).json({
        success: false,
        message: "Employee is already inactive.",
      });
    }

    employee.employmentStatus = "inactive";
    employee.updatedBy = req.user._id;

    await employee.save();

    return res.status(200).json({
      success: true,
      message: "Employee deactivated successfully.",
      data: { employee },
    });
  } catch (error) {
    next(error);
  }
};

// CREATE LOGIN ACCOUNT FOR AN EXISTING EMPLOYEE
export const createEmployeeAccount = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const { roleId, password } = req.body;
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(roleId)) {
      return res.status(400).json({
        success: false,
        message: "Valid employee ID and role ID are required.",
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "An initial password is required.",
      });
    }

    const accessScope = await getEmployeeAccessScope(req.user);

    const employee = await Employee.findOne({
      $and: [{ _id: id }, accessScope],
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found.",
      });
    }

    if (employee.employmentStatus !== "active") {
      return res.status(400).json({
        success: false,
        message: "Only active employees can receive login accounts.",
      });
    }

    if (!employee.workEmail) {
      return res.status(400).json({
        success: false,
        message:
          "Add a work email to this employee before creating an account.",
      });
    }

    if (employee.user) {
      return res.status(409).json({
        success: false,
        message: "This employee already has a login account.",
      });
    }

    const role = await Role.findOne({
      _id: roleId,
      isActive: true,
    });

    if (!role) {
      return res.status(400).json({
        success: false,
        message: "Selected role does not exist or is inactive.",
      });
    }

    const isSuperAdmin = req.user.role?.permissions?.includes("*");

    if (!isSuperAdmin && role.level >= req.user.role.level) {
      return res.status(403).json({
        success: false,
        message: "You cannot assign this role.",
      });
    }

    const existingUser = await User.findOne({
      email: employee.workEmail.toLowerCase().trim(),
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this work email already exists.",
      });
    }

    const hashedPassword = await hashPassword(password);

    let createdUser;

    await session.withTransaction(async () => {
      [createdUser] = await User.create(
        [
          {
            fullName: employee.fullName,
            email: employee.workEmail,
            password: hashedPassword,
            phone: employee.phone,
            role: role._id,
            employee: employee._id,
            accountStatus: "active",
            isEmailVerified: false,
            createdBy: req.user._id,
          },
        ],
        { session },
      );

      const updateResult = await Employee.updateOne(
        {
          _id: employee._id,
          user: { $exists: false },
        },
        {
          $set: {
            user: createdUser._id,
            updatedBy: req.user._id,
          },
        },
        { session },
      );

      if (updateResult.modifiedCount !== 1) {
        throw new Error(
          "Employee account link could not be saved. Please retry.",
        );
      }
    });

    return res.status(201).json({
      success: true,
      message: "Employee login account created successfully.",
      data: {
        account: {
          id: createdUser._id,
          fullName: createdUser.fullName,
          email: createdUser.email,
          role: role.name,
          accountStatus: createdUser.accountStatus,
          employeeId: employee._id,
        },
      },
    });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
};

// GET DIRECT REPORTS OF AN EMPLOYEE
export const getEmployeeReports = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID.",
      });
    }

    const manager = await Employee.findById(id).select(
      "_id fullName employeeCode",
    );

    if (!manager) {
      return res.status(404).json({
        success: false,
        message: "Manager employee not found.",
      });
    }

    const reports = await Employee.find({
      reportingManager: id,
    })
      .populate("domain", "name code")
      .populate("department", "name code")
      .populate("reportingManager", "fullName employeeCode designation")
      .sort({ fullName: 1 });

    return res.status(200).json({
      success: true,
      data: {
        manager,
        reports,
        totalReports: reports.length,
      },
    });
  } catch (error) {
    next(error);
  }
};
