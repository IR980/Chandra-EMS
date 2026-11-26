import mongoose from "mongoose";

import Employee from "../models/employee.model.js";
import Document from "../models/document.model.js";
import User from "../models/user.model.js";
import Role from "../models/role.model.js";
import {
  createNotification,
  createBulkNotifications,
} from "../services/notification.service.js";
import getEmployeeAccessScope from "../utils/employeeAccessScope.js";

import uploadDocumentFile, {
  deleteDocumentFile,
  generateDocumentAccessUrl,
} from "../services/documentStorage.service.js";

const ALLOWED_DOCUMENT_TYPES = [
  "aadhaar",
  "pan",
  "voter_id",
  "passport",
  "driving_license",
  "bank_proof",
  "education_certificate",
  "experience_letter",
  "address_proof",
  "other",
];

// document notification system: when a document is uploaded, send notification to all users with "document.verify" permission
const notifyDocumentEmployee = async ({
  employeeId,
  actorId,
  documentId,
  title,
  message,
  priority = "medium",
}) => {
  try {
    const employee = await Employee.findById(employeeId).select("user").lean();

    if (!employee?.user) return;

    // Do not notify the same user who performed the action.
    if (String(employee.user) === String(actorId)) return;

    const activeUser = await User.findOne({
      _id: employee.user,
      accountStatus: "active",
      isDeleted: false,
    }).select("_id");

    if (!activeUser) return;

    await createNotification({
      recipient: activeUser._id,
      actor: actorId,
      category: "document",
      priority,
      title,
      message,
      actionUrl: "/documents",
      relatedEntity: {
        type: "Document",
        id: documentId,
      },
    });
  } catch (notificationError) {
    console.error("[Document Notification] Failed:", notificationError.message);
  }
};
// admin notification system: when a document is uploaded, send notification to all users with "document.verify" permission
const notifyDocumentSuperAdmins = async ({
  actorId,
  documentId,
  title,
  message,
  priority = "medium",
}) => {
  try {
    const superAdminRole = await Role.findOne({
      slug: "super-admin",
      isActive: true,
    }).select("_id");

    if (!superAdminRole) return;

    const superAdmins = await User.find({
      role: superAdminRole._id,
      accountStatus: "active",
      isDeleted: false,
    }).select("_id");

    if (!superAdmins.length) return;

    await createBulkNotifications(
      superAdmins.map((admin) => admin._id),
      {
        actor: actorId,
        category: "document",
        priority,
        title,
        message,
        actionUrl: "/documents/verification",
        relatedEntity: {
          type: "Document",
          id: documentId,
        },
      },
    );
  } catch (notificationError) {
    console.error(
      "[Document Super Admin Notification] Failed:",
      notificationError.message,
    );
  }
};
const validateMaskedNumber = (documentType, value) => {
  if (!value) return true;

  if (typeof value !== "string" || value.length > 32) {
    return false;
  }

  const normalized = value.trim().toUpperCase();

  if (documentType === "aadhaar") {
    return /^(X{4}[- ]?){2}\d{4}$/.test(normalized);
  }

  if (documentType === "pan") {
    return /^[X*]{5}\d{4}[A-Z]$/.test(normalized);
  }

  return true;
};

export const uploadEmployeeDocument = async (req, res, next) => {
  let uploadedFile = null;
  let documentSaved = false;

  try {
    const { employeeId } = req.params;

    const {
      documentType,
      documentName,
      documentNumberMasked,
      issueDate,
      expiryDate,
    } = req.body;

    if (!mongoose.isValidObjectId(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select a document file.",
      });
    }

    if (
      !ALLOWED_DOCUMENT_TYPES.includes(documentType) ||
      typeof documentName !== "string" ||
      !documentName.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid document type and document name are required.",
      });
    }

    if (
      documentNumberMasked &&
      !validateMaskedNumber(documentType, documentNumberMasked)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide a masked Aadhaar or PAN number. Full numbers are not accepted.",
      });
    }

    const accessScope = await getEmployeeAccessScope(req.user);

    const employee = await Employee.findOne({
      $and: [{ _id: employeeId }, accessScope],
    }).select("_id");

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found or access denied.",
      });
    }

    const parsedIssueDate = issueDate ? new Date(issueDate) : null;
    const parsedExpiryDate = expiryDate ? new Date(expiryDate) : null;

    if (
      (issueDate && Number.isNaN(parsedIssueDate.getTime())) ||
      (expiryDate && Number.isNaN(parsedExpiryDate.getTime()))
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid issue and expiry dates.",
      });
    }

    if (
      parsedIssueDate &&
      parsedExpiryDate &&
      parsedExpiryDate < parsedIssueDate
    ) {
      return res.status(400).json({
        success: false,
        message: "Expiry date cannot be earlier than issue date.",
      });
    }

    uploadedFile = await uploadDocumentFile(req.file);

    const document = new Document({
      employee: employee._id,
      documentType,
      documentName: documentName.trim(),
      documentNumberMasked: documentNumberMasked?.trim() || null,

      file: {
        storageProvider: "cloudinary",
        deliveryType: "authenticated",
        publicId: uploadedFile.publicId,
        resourceType: uploadedFile.resourceType,
        format: uploadedFile.format,
        originalName: uploadedFile.originalName,
        size: uploadedFile.size,
        mimeType: uploadedFile.mimeType,
      },

      issueDate: parsedIssueDate,
      expiryDate: parsedExpiryDate,

      verificationStatus: "pending",
      uploadedBy: req.user._id,

      verificationHistory: [
        {
          action: "submitted",
          status: "pending",
          remarks: "Document uploaded and submitted for verification.",
          performedBy: req.user._id,
        },
      ],
    });

    await document.save();
    // Send notification to the employee about the new document upload.
    await notifyDocumentEmployee({
      employeeId: employee._id,
      actorId: req.user._id,
      documentId: document._id,
      title: "Document Submitted for Verification",
      message: `Your ${documentName.trim()} document has been uploaded and is pending verification.`,
      priority: "medium",
    });
    // Notify Super Admins about the new document submission.
    await notifyDocumentSuperAdmins({
      actorId: req.user._id,
      documentId: document._id,
      title: "New Employee Document Submitted",
      message: `${employee.fullName} submitted ${documentName.trim()} for verification.`,
      priority: "medium",
    });
    documentSaved = true;

    // Never expose Cloudinary storage identifiers in the API response.
    const safeDocument = document.toObject();
    if (safeDocument.file) {
      delete safeDocument.file.publicId;
    }

    return res.status(201).json({
      success: true,
      message: "Document uploaded successfully and submitted for verification.",
      data: {
        document: safeDocument,
      },
    });
  } catch (error) {
    // Clean up only if the database record was not saved.
    if (
      !documentSaved &&
      uploadedFile?.publicId &&
      uploadedFile?.resourceType
    ) {
      try {
        await deleteDocumentFile(
          uploadedFile.publicId,
          uploadedFile.resourceType,
        );
      } catch (cleanupError) {
        console.error("Document upload cleanup failed:", cleanupError.message);
      }
    }

    next(error);
  }
};

export const getEmployeeDocuments = async (req, res, next) => {
  try {
    const { employeeId } = req.params;

    if (!mongoose.isValidObjectId(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID.",
      });
    }

    const accessScope = await getEmployeeAccessScope(req.user);

    const employee = await Employee.findOne({
      $and: [{ _id: employeeId }, accessScope],
    }).select("_id");

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found or access denied.",
      });
    }

    const documents = await Document.find({
      employee: employee._id,
      isActive: true,
    })
      .select("-file.publicId")
      .populate("uploadedBy", "fullName email")
      .populate("verifiedBy", "fullName email")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: documents.length,
      data: {
        documents,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getEmployeeDocumentFile = async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const download = req.query.download === "true";

    if (!mongoose.isValidObjectId(documentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document ID.",
      });
    }

    if (
      req.query.download !== undefined &&
      !["true", "false"].includes(req.query.download)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid download parameter.",
      });
    }

    const document = await Document.findOne({
      _id: documentId,
      isActive: true,
    }).select("+file.publicId");

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found.",
      });
    }

    const accessScope = await getEmployeeAccessScope(req.user);

    const employee = await Employee.findOne({
      $and: [{ _id: document.employee }, accessScope],
    }).select("_id");

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Document not found or access denied.",
      });
    }

    if (
      document.file.storageProvider !== "cloudinary" ||
      document.file.deliveryType !== "authenticated" ||
      !document.file.publicId ||
      !["image"].includes(document.file.resourceType)
    ) {
      return res.status(400).json({
        success: false,
        message: "Document file storage configuration is invalid.",
      });
    }

    const access = generateDocumentAccessUrl(
      document.file.publicId,
      document.file.format,
      document.file.resourceType,
      download,
    );

    return res.status(200).json({
      success: true,
      message: download
        ? "Secure download link generated."
        : "Secure preview link generated.",
      data: {
        url: access.url,
        expiresAt: access.expiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getDocumentsForVerification = async (req, res, next) => {
  try {
    const allowedStatuses = ["pending", "verified", "rejected"];
    const status = req.query.status || "pending";

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification status.",
      });
    }

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 20),
    );

    const skip = (page - 1) * limit;

    // Resolve employees accessible to the current user.
    const accessScope = await getEmployeeAccessScope(req.user);

    const accessibleEmployees = await Employee.find(accessScope)
      .select("_id")
      .lean();

    const employeeIds = accessibleEmployees.map((employee) => employee._id);

    if (employeeIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          documents: [],
          pagination: {
            total: 0,
            page,
            limit,
            pages: 0,
          },
        },
      });
    }

    const filter = {
      employee: { $in: employeeIds },
      isActive: true,
      verificationStatus: status,
    };

    const [documents, total] = await Promise.all([
      Document.find(filter)
        .select("-file.publicId")
        .populate(
          "employee",
          "employeeCode firstName lastName fullName designation domain department",
        )
        .populate("uploadedBy", "fullName email")
        .populate("verifiedBy", "fullName email")
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Document.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: documents.length,
      data: {
        documents,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const reviewEmployeeDocument = async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const { action, remarks } = req.body;

    if (!mongoose.isValidObjectId(documentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document ID.",
      });
    }

    if (!["verify", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action must be verify or reject.",
      });
    }

    if (
      remarks !== undefined &&
      remarks !== null &&
      typeof remarks !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Remarks must be valid text.",
      });
    }

    const cleanRemarks = typeof remarks === "string" ? remarks.trim() : "";

    if (action === "reject" && !cleanRemarks) {
      return res.status(400).json({
        success: false,
        message: "Rejection remarks are required.",
      });
    }

    if (cleanRemarks.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Remarks cannot exceed 1000 characters.",
      });
    }

    if (action === "reject" && !remarks?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Rejection remarks are required.",
      });
    }

    if (remarks && remarks.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Remarks cannot exceed 1000 characters.",
      });
    }

    const accessScope = await getEmployeeAccessScope(req.user);

    const document = await Document.findOne({
      _id: documentId,
      isActive: true,
    }).select("_id employee verificationStatus");

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found.",
      });
    }

    const employee = await Employee.findOne({
      $and: [{ _id: document.employee }, accessScope],
    }).select("_id");

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Document not found or access denied.",
      });
    }

    const newStatus = action === "verify" ? "verified" : "rejected";

    const updatedDocument = await Document.findOneAndUpdate(
      {
        _id: document._id,
        employee: employee._id,
        isActive: true,
        verificationStatus: "pending",
      },
      {
        $set: {
          verificationStatus: newStatus,
          verificationRemarks: cleanRemarks,
          verifiedBy: req.user._id,
          verifiedAt: new Date(),
        },
        $push: {
          verificationHistory: {
            action: newStatus,
            status: newStatus,
            remarks: cleanRemarks,
            performedBy: req.user._id,
            performedAt: new Date(),
          },
        },
      },
      {
        new: true,
        runValidators: true,
      },
    )
      .select("-file.publicId")
      .populate("employee", "employeeCode firstName lastName fullName")
      .populate("verifiedBy", "fullName email")
      .lean();

    if (!updatedDocument) {
      return res.status(409).json({
        success: false,
        message:
          "This document has already been reviewed. Refresh and try again.",
      });
    }

    // Send notification to the employee about the document review outcome.
    await notifyDocumentEmployee({
      employeeId: updatedDocument.employee._id,
      actorId: req.user._id,
      documentId: updatedDocument._id,
      title: action === "verify" ? "Document Verified" : "Document Rejected",
      message:
        action === "verify"
          ? `Your ${updatedDocument.documentName} document has been verified successfully.`
          : `Your ${updatedDocument.documentName} document was rejected. Reason: ${remarks}`,
      priority: action === "reject" ? "high" : "medium",
    });

    // Notify Super Admins about the document review outcome.
    await notifyDocumentSuperAdmins({
      actorId: req.user._id,
      documentId: updatedDocument._id,
      title:
        action === "verify"
          ? "Employee Document Verified"
          : "Employee Document Rejected",
      message:
        action === "verify"
          ? `An employee's ${updatedDocument.documentName} document has been verified.`
          : `An employee's ${updatedDocument.documentName} document was rejected. Reason: ${cleanRemarks}`,
      priority: action === "reject" ? "high" : "medium",
    });
    return res.status(200).json({
      success: true,
      message:
        action === "verify"
          ? "Document verified successfully."
          : "Document rejected successfully.",
      data: {
        document: updatedDocument,
      },
    });
  } catch (error) {
    next(error);
  }
};
