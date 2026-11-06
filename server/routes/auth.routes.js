import express from "express";

import {
  login,
  register,
  refresh,
  logout,
  me,
} from "../controllers/auth.controller.js";

import {
  authenticate,
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = express.Router();

// Public login endpoint
router.post("/login", login);

// Only users with users.create permission can register accounts.
router.post(
  "/register",
  authenticate,
  requirePermission("users.create"),
  register,
);

// Refresh-token cookie is used to renew the session.
router.post("/refresh", refresh);

// Logout revokes the refresh session and clears cookies.
router.post("/logout", logout);

// Current authenticated user's profile.
router.get("/me", authenticate, me);

export default router;
