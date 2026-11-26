import express from "express";

import {
  authenticate,
  requirePermission,
} from "../middleware/auth.middleware.js";

import documentUpload from "../middleware/documentUpload.middleware.js";
import validateDocumentFile from "../middleware/documentFileSignature.middleware.js";

import {
  uploadEmployeeDocument,
  getEmployeeDocuments,
  getEmployeeDocumentFile,
  getDocumentsForVerification,
  reviewEmployeeDocument,
} from "../controllers/document.controller.js";

const router = express.Router();

router.use(authenticate);

// HR document verification dashboard
router.get(
  "/verification",
  requirePermission("documents.verify"),
  getDocumentsForVerification,
);

// HR verify or reject document
router.patch(
  "/:documentId/review",
  requirePermission("documents.verify"),
  reviewEmployeeDocument,
);

// List documents for an authorized employee
router.get(
  "/employee/:employeeId",
  requirePermission("documents.view"),
  getEmployeeDocuments,
);

// Generate a temporary preview or download link
router.get(
  "/:documentId/file",
  requirePermission("documents.view"),
  getEmployeeDocumentFile,
);

router.post(
  "/:employeeId/upload",
  requirePermission("documents.upload"),
  documentUpload.single("document"),
  validateDocumentFile,
  uploadEmployeeDocument,
);

export default router;
