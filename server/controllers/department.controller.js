import Department from "../models/department.model.js";
import Domain from "../models/domain.model.js";
import Employee from "../models/employee.model.js";

const sendError = (res, status, message) =>
  res.status(status).json({ success: false, message });

const validateManager = async (managerId, domainId, departmentId = null) => {
  if (!managerId) return { valid: true, manager: null };

  const manager = await Employee.findOne({
    _id: managerId,
    employmentStatus: "active",
    domain: domainId,
    ...(departmentId ? { department: departmentId } : {}),
  });

  if (!manager) {
    return {
      valid: false,
      message:
        "Manager must be an active employee in the selected domain and department.",
    };
  }

  return { valid: true, manager };
};

// Prevent a department from being placed beneath one of its descendants.
const validateParentHierarchy = async (parentId, departmentId, domainId) => {
  if (!parentId) return { valid: true };

  if (departmentId && parentId.toString() === departmentId.toString()) {
    return {
      valid: false,
      message: "A department cannot be its own parent.",
    };
  }

  const parent = await Department.findOne({
    _id: parentId,
    domain: domainId,
    status: "active",
  }).select("_id parentDepartment");

  if (!parent) {
    return {
      valid: false,
      message: "Parent department must be active and in the same domain.",
    };
  }

  const visited = new Set();
  let current = parent;

  while (current?.parentDepartment) {
    const ancestorId = current.parentDepartment.toString();

    if (departmentId && ancestorId === departmentId.toString()) {
      return {
        valid: false,
        message: "This parent would create a circular department hierarchy.",
      };
    }

    if (visited.has(ancestorId)) {
      return {
        valid: false,
        message: "The selected parent hierarchy already contains a cycle.",
      };
    }

    visited.add(ancestorId);

    current = await Department.findById(ancestorId).select(
      "_id parentDepartment",
    );
  }

  return { valid: true };
};

const checkDepartmentDependencies = async (departmentId) => {
  const [activeEmployees, activeChildren] = await Promise.all([
    Employee.countDocuments({
      department: departmentId,
      employmentStatus: "active",
    }),
    Department.countDocuments({
      parentDepartment: departmentId,
      status: "active",
    }),
  ]);

  return { activeEmployees, activeChildren };
};

export const createDepartment = async (req, res, next) => {
  try {
    const {
      name,
      code,
      description,
      domainId,
      parentDepartment,
      parentDepartmentId,
      manager,
      managerId,
    } = req.body;

    if (!name?.trim() || !code?.trim() || !domainId) {
      return sendError(
        res,
        400,
        "Department name, code and domain are required.",
      );
    }

    const domain = await Domain.findOne({
      _id: domainId,
      status: "active",
    });

    if (!domain) {
      return sendError(
        res,
        400,
        "Selected domain does not exist or is inactive.",
      );
    }

    const selectedParent = parentDepartmentId || parentDepartment || null;

    const parentCheck = await validateParentHierarchy(
      selectedParent,
      null,
      domainId,
    );

    if (!parentCheck.valid) {
      return sendError(res, 400, parentCheck.message);
    }

    const selectedManager = managerId || manager || null;

    if (selectedManager) {
      const managerCheck = await validateManager(selectedManager, domainId);

      if (!managerCheck.valid) {
        return sendError(res, 400, managerCheck.message);
      }

      // The employee must belong to this department to be its manager.
      // On creation, a manager cannot already belong to a department
      // that does not yet exist. Assign the manager after creation.
      return sendError(
        res,
        400,
        "Create the department first, then assign a manager who belongs to it.",
      );
    }

    const department = await Department.create({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description,
      domain: domainId,
      parentDepartment: selectedParent,
      createdBy: req.user._id,
    });

    const populatedDepartment = await Department.findById(department._id)
      .populate("domain", "name code")
      .populate("parentDepartment", "name code")
      .populate("manager", "fullName employeeCode");

    return res.status(201).json({
      success: true,
      message: "Department created successfully.",
      data: { department: populatedDepartment },
    });
  } catch (error) {
    next(error);
  }
};

export const getDepartments = async (req, res, next) => {
  try {
    const {
      search,
      domainId,
      status = "all",
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    if (domainId) filter.domain = domainId;
    if (status !== "all") filter.status = status;

    if (search?.trim()) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: "i" } },
        { code: { $regex: search.trim(), $options: "i" } },
      ];
    }

    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));

    const [departments, total] = await Promise.all([
      Department.find(filter)
        .populate("domain", "name code")
        .populate("manager", "fullName employeeCode")
        .populate("parentDepartment", "name code")
        .sort({ name: 1 })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize),
      Department.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        departments,
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

export const getDepartmentById = async (req, res, next) => {
  try {
    const department = await Department.findById(req.params.id)
      .populate("domain", "name code")
      .populate("manager", "fullName employeeCode")
      .populate("parentDepartment", "name code");

    if (!department) {
      return sendError(res, 404, "Department not found.");
    }

    return res.status(200).json({
      success: true,
      data: { department },
    });
  } catch (error) {
    next(error);
  }
};

export const updateDepartment = async (req, res, next) => {
  try {
    const allowedFields = [
      "name",
      "code",
      "description",
      "domain",
      "parentDepartment",
      "manager",
      "status",
    ];

    const updates = Object.keys(req.body);

    if (
      !updates.length ||
      updates.some((field) => !allowedFields.includes(field))
    ) {
      return sendError(res, 400, "Invalid or empty department update.");
    }

    const department = await Department.findById(req.params.id);

    if (!department) {
      return sendError(res, 404, "Department not found.");
    }

    if (req.body.status === "inactive" && department.status === "active") {
      const dependencies = await checkDepartmentDependencies(department._id);

      if (dependencies.activeEmployees || dependencies.activeChildren) {
        return res.status(409).json({
          success: false,
          message:
            "Cannot deactivate this department while it has active employees or active child departments.",
          data: dependencies,
        });
      }
    }

    const nextDomainId = req.body.domain || department.domain;

    if (req.body.status !== "inactive") {
      const domain = await Domain.findOne({
        _id: nextDomainId,
        status: "active",
      });

      if (!domain) {
        return sendError(
          res,
          400,
          "Selected domain does not exist or is inactive.",
        );
      }
    }

    const nextParentId = Object.prototype.hasOwnProperty.call(
      req.body,
      "parentDepartment",
    )
      ? req.body.parentDepartment
      : department.parentDepartment;

    if (nextParentId) {
      const parentCheck = await validateParentHierarchy(
        nextParentId,
        department._id,
        nextDomainId,
      );

      if (!parentCheck.valid) {
        return sendError(res, 400, parentCheck.message);
      }
    }

    const domainChanged =
      nextDomainId.toString() !== department.domain.toString();

    if (domainChanged) {
      const [activeEmployees, activeChildren] = await Promise.all([
        Employee.countDocuments({
          department: department._id,
          employmentStatus: "active",
        }),
        Department.countDocuments({
          parentDepartment: department._id,
          status: "active",
        }),
      ]);

      if (activeEmployees || activeChildren) {
        return res.status(409).json({
          success: false,
          message:
            "Move active employees and child departments before changing this department's domain.",
          data: { activeEmployees, activeChildren },
        });
      }
    }

    const nextManagerId = Object.prototype.hasOwnProperty.call(
      req.body,
      "manager",
    )
      ? req.body.manager
      : department.manager;

    if (nextManagerId) {
      const managerCheck = await validateManager(
        nextManagerId,
        nextDomainId,
        department._id,
      );

      if (!managerCheck.valid) {
        return sendError(res, 400, managerCheck.message);
      }
    }

    if (req.body.name !== undefined) {
      department.name = req.body.name.trim();
    }

    if (req.body.code !== undefined) {
      department.code = req.body.code.trim().toUpperCase();
    }

    if (req.body.description !== undefined) {
      department.description = req.body.description;
    }

    department.domain = nextDomainId;
    department.parentDepartment = nextParentId || null;

    if (Object.prototype.hasOwnProperty.call(req.body, "manager")) {
      department.manager = req.body.manager || null;
    }

    if (req.body.status !== undefined) {
      department.status = req.body.status;
    }

    department.updatedBy = req.user._id;

    await department.save();

    const updatedDepartment = await Department.findById(department._id)
      .populate("domain", "name code")
      .populate("manager", "fullName employeeCode")
      .populate("parentDepartment", "name code");

    return res.status(200).json({
      success: true,
      message: "Department updated successfully.",
      data: { department: updatedDepartment },
    });
  } catch (error) {
    next(error);
  }
};

export const deactivateDepartment = async (req, res, next) => {
  try {
    const department = await Department.findById(req.params.id);

    if (!department) {
      return sendError(res, 404, "Department not found.");
    }

    const dependencies = await checkDepartmentDependencies(department._id);

    if (dependencies.activeEmployees || dependencies.activeChildren) {
      return res.status(409).json({
        success: false,
        message:
          "Cannot deactivate this department while it has active employees or active child departments.",
        data: dependencies,
      });
    }

    department.status = "inactive";
    department.updatedBy = req.user._id;

    await department.save();

    return res.status(200).json({
      success: true,
      message: "Department deactivated successfully.",
      data: { department },
    });
  } catch (error) {
    next(error);
  }
};
