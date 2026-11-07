import express from "express";

import {
  createDomain,
  getDomains,
  getDomainById,
  updateDomain,
  deactivateDomain,
} from "../controllers/domain.controller.js";

import {
  authenticate,
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

router.get("/", requirePermission("domains.view"), getDomains);
router.post("/", requirePermission("domains.manage"), createDomain);
router.get("/:id", requirePermission("domains.view"), getDomainById);
router.patch("/:id", requirePermission("domains.manage"), updateDomain);
router.patch(
  "/:id/deactivate",
  requirePermission("domains.manage"),
  deactivateDomain,
);

export default router;
