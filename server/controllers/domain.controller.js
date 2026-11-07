import mongoose from "mongoose";
import Domain from "../models/domain.model.js";
import Department from "../models/department.model.js";
import Employee from "../models/employee.model.js";

const sendError = (res, status, message, data = undefined) =>
  res.status(status).json({
    success: false,
    message,
    ...(data ? { data } : {}),
  });

const checkDomainDependencies = async (domainId) => {
  const [activeDepartments, activeEmployees] = await Promise.all([
    Department.countDocuments({
      domain: domainId,
      status: "active",
    }),
    Employee.countDocuments({
      domain: domainId,
      employmentStatus: "active",
    }),
  ]);

  return { activeDepartments, activeEmployees };
};

// A domain head must be an active employee of that exact domain.
const validateDomainHead = async (headId, domainId) => {
  if (!headId) return { valid: true, employee: null };

  if (!mongoose.isValidObjectId(headId)) {
    return {
      valid: false,
      message: "Invalid domain head employee ID.",
    };
  }

  const employee = await Employee.findOne({
    _id: headId,
    domain: domainId,
    employmentStatus: "active",
  }).select("_id fullName employeeCode domain employmentStatus");

  if (!employee) {
    return {
      valid: false,
      message:
        "Domain head must be an active employee assigned to this domain.",
    };
  }

  return { valid: true, employee };
};

export const createDomain = async (req, res, next) => {
  try {
    const { name, code, description = "", head = null } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof code !== "string" ||
      !code.trim()
    ) {
      return sendError(res, 400, "Domain name and code are required.");
    }

    if (typeof description !== "string" || description.length > 500) {
      return sendError(
        res,
        400,
        "Description must be a string of maximum 500 characters.",
      );
    }

    // A newly created domain cannot already have an employee assigned to it.
    if (head) {
      return sendError(
        res,
        400,
        "Create the domain first, assign an active employee to it, and then assign the domain head.",
      );
    }

    const domain = await Domain.create({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description.trim(),
      head: null,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Domain created successfully.",
      data: { domain },
    });
  } catch (error) {
    next(error);
  }
};

export const getDomains = async (req, res, next) => {
  try {
    const { search, status = "all", page = 1, limit = 20 } = req.query;

    if (!["all", "active", "inactive"].includes(status)) {
      return sendError(res, 400, "Invalid domain status filter.");
    }

    const filter = {};

    if (status !== "all") {
      filter.status = status;
    }

    if (search?.trim()) {
      const escapedSearch = search
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      filter.$or = [
        { name: { $regex: escapedSearch, $options: "i" } },
        { code: { $regex: escapedSearch, $options: "i" } },
      ];
    }

    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));

    const [domains, total] = await Promise.all([
      Domain.find(filter)
        .populate("head", "fullName employeeCode")
        .sort({ name: 1 })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize),
      Domain.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        domains,
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

export const getDomainById = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return sendError(res, 400, "Invalid domain ID.");
    }

    const domain = await Domain.findById(req.params.id).populate(
      "head",
      "fullName employeeCode",
    );

    if (!domain) {
      return sendError(res, 404, "Domain not found.");
    }

    return res.status(200).json({
      success: true,
      data: { domain },
    });
  } catch (error) {
    next(error);
  }
};

export const updateDomain = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return sendError(res, 400, "Invalid domain ID.");
    }

    const allowedFields = ["name", "code", "description", "head", "status"];

    const updates = Object.keys(req.body);

    if (
      !updates.length ||
      updates.some((field) => !allowedFields.includes(field))
    ) {
      return sendError(res, 400, "Invalid or empty domain update.");
    }

    const domain = await Domain.findById(req.params.id);

    if (!domain) {
      return sendError(res, 404, "Domain not found.");
    }

    if (
      req.body.status !== undefined &&
      !["active", "inactive"].includes(req.body.status)
    ) {
      return sendError(res, 400, "Invalid domain status.");
    }

    if (
      req.body.name !== undefined &&
      (typeof req.body.name !== "string" || !req.body.name.trim())
    ) {
      return sendError(res, 400, "Domain name cannot be empty.");
    }

    if (
      req.body.code !== undefined &&
      (typeof req.body.code !== "string" || !req.body.code.trim())
    ) {
      return sendError(res, 400, "Domain code cannot be empty.");
    }

    if (
      req.body.description !== undefined &&
      (typeof req.body.description !== "string" ||
        req.body.description.length > 500)
    ) {
      return sendError(
        res,
        400,
        "Description must be a string of maximum 500 characters.",
      );
    }

    // Protect against bypassing the dedicated deactivation endpoint.
    if (req.body.status === "inactive" && domain.status === "active") {
      const dependencies = await checkDomainDependencies(domain._id);

      if (dependencies.activeDepartments || dependencies.activeEmployees) {
        return sendError(
          res,
          409,
          "Cannot deactivate this domain while it has active departments or active employees.",
          dependencies,
        );
      }
    }

    // Validate a newly assigned domain head before saving.
    if (req.body.head !== undefined) {
      const headId = req.body.head || null;

      const validation = await validateDomainHead(headId, domain._id);

      if (!validation.valid) {
        return sendError(res, 400, validation.message);
      }

      domain.head = validation.employee?._id || null;
    }

    if (req.body.name !== undefined) {
      domain.name = req.body.name.trim();
    }

    if (req.body.code !== undefined) {
      domain.code = req.body.code.trim().toUpperCase();
    }

    if (req.body.description !== undefined) {
      domain.description = req.body.description.trim();
    }

    if (req.body.status !== undefined) {
      domain.status = req.body.status;
    }

    domain.updatedBy = req.user._id;

    await domain.save();

    const updatedDomain = await Domain.findById(domain._id).populate(
      "head",
      "fullName employeeCode",
    );

    return res.status(200).json({
      success: true,
      message: "Domain updated successfully.",
      data: { domain: updatedDomain },
    });
  } catch (error) {
    next(error);
  }
};

export const deactivateDomain = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return sendError(res, 400, "Invalid domain ID.");
    }

    const domain = await Domain.findById(req.params.id);

    if (!domain) {
      return sendError(res, 404, "Domain not found.");
    }

    const dependencies = await checkDomainDependencies(domain._id);

    if (dependencies.activeDepartments || dependencies.activeEmployees) {
      return sendError(
        res,
        409,
        "Cannot deactivate this domain while it has active departments or active employees.",
        dependencies,
      );
    }

    domain.status = "inactive";
    domain.updatedBy = req.user._id;

    await domain.save();

    return res.status(200).json({
      success: true,
      message: "Domain deactivated successfully.",
      data: { domain },
    });
  } catch (error) {
    next(error);
  }
};
