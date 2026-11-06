import User from "../models/user.model.js";
import Role from "../models/role.model.js";
import RefreshSession from "../models/refreshSession.model.js";
const authError = (message, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });
import {
  hashPassword,
  comparePassword,
  validatePassword,
} from "../utils/password.util.js";

import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/token.util.js";

const REFRESH_TOKEN_DAYS = 7;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

const createSession = async (user, metadata = {}) => {
  const { token, tokenId } = generateRefreshToken(user);

  const session = await RefreshSession.create({
    tokenId,
    user: user._id,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000),
    userAgent: metadata.userAgent || null,
    ipAddress: metadata.ipAddress || null,
  });

  return {
    accessToken: generateAccessToken(user),
    refreshToken: token,
    sessionId: session._id,
  };
};

export const sanitizeUser = (user) => ({
  id: user._id,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  profilePhoto: user.profilePhoto,
  accountStatus: user.accountStatus,
  role: user.role
    ? {
        id: user.role._id,
        name: user.role.name,
        slug: user.role.slug,
        level: user.role.level,
        scope: user.role.scope,
        permissions: user.role.permissions,
      }
    : null,
  employee: user.employee || null,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
});

export const loginUser = async (email, password, metadata = {}) => {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await User.findOne({
    email: normalizedEmail,
    isDeleted: false,
  })
    .select("+password")
    .populate("role");

  // Keep the response generic so the endpoint does not reveal
  // whether an email address is registered.
  if (!user) {
    throw new Error("Invalid email or password.");
  }

  if (user.lockUntil && user.lockUntil > new Date()) {
    throw new Error("Account temporarily locked. Try again later.");
  }

  if (user.lockUntil && user.lockUntil <= new Date()) {
    user.lockUntil = null;
    user.failedLoginAttempts = 0;
  }

  if (user.accountStatus !== "active" || !user.role?.isActive) {
    throw new Error("Your account is not active. Contact an administrator.");
  }

  const passwordMatches = await comparePassword(password, user.password);

  if (!passwordMatches) {
    user.failedLoginAttempts += 1;

    if (user.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
      user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
    }

    await user.save();

    throw new Error("Invalid email or password.");
  }

  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  user.lastLoginAt = new Date();

  await user.save();

  const tokens = await createSession(user, metadata);

  return {
    user: sanitizeUser(user),
    ...tokens,
  };
};

export const registerUser = async (data, actor, metadata = {}) => {
  const fullName = data.fullName?.trim();
  const email = data.email?.toLowerCase().trim();
  const password = data.password;
  const roleId = data.roleId;

  if (!fullName || !email || !password || !roleId) {
    throw new Error("Full name, email, password and role are required.");
  }

  if (fullName.length < 2 || fullName.length > 100) {
    throw new Error("Full name must contain 2 to 100 characters.");
  }

  const passwordCheck = validatePassword(password);

  if (!passwordCheck.valid) {
    throw new Error(passwordCheck.message);
  }

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new Error("An account with this email already exists.");
  }

  const requestedRole = await Role.findOne({
    _id: roleId,
    isActive: true,
  });

  if (!requestedRole) {
    throw new Error("Selected role does not exist or is inactive.");
  }

  const actorIsSuperAdmin = actor.role?.permissions?.includes("*");

  // A user cannot create an account at their own level or above,
  // unless they are a Super Admin.
  if (!actorIsSuperAdmin && requestedRole.level >= actor.role.level) {
    throw new Error("You cannot assign this role.");
  }

  const hashedPassword = await hashPassword(password);

  const user = await User.create({
    fullName,
    email,
    password: hashedPassword,
    role: requestedRole._id,
    phone: data.phone || null,
    accountStatus: "active",
    createdBy: actor._id,
  });

  const populatedUser = await User.findById(user._id).populate("role");

  return {
    user: sanitizeUser(populatedUser),
  };
};

export const refreshUserSession = async (refreshToken, metadata = {}) => {
  if (!refreshToken) {
    throw new Error("Refresh token is required.");
  }

  let payload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new Error("Invalid or expired refresh token.");
  }

  const session = await RefreshSession.findOne({
    tokenId: payload.jti,
    user: payload.sub,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!session) {
    throw new Error("Session expired or revoked. Please log in again.");
  }

  const user = await User.findOne({
    _id: payload.sub,
    isDeleted: false,
    accountStatus: "active",
  }).populate("role");

  if (!user || !user.role?.isActive) {
    session.revokedAt = new Date();
    await session.save();
    throw new Error("User account is not active.");
  }

  // Revoke the old session before issuing a replacement.
  const revokeResult = await RefreshSession.updateOne(
    { _id: session._id, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );

  if (revokeResult.modifiedCount !== 1) {
    throw new Error("Session has already been used. Please log in again.");
  }

  const tokens = await createSession(user, metadata);

  return {
    user: sanitizeUser(user),
    ...tokens,
  };
};

export const logoutUser = async (refreshToken) => {
  if (!refreshToken) {
    return;
  }

  try {
    const payload = verifyRefreshToken(refreshToken);

    await RefreshSession.updateOne(
      {
        tokenId: payload.jti,
        user: payload.sub,
        revokedAt: null,
      },
      {
        $set: { revokedAt: new Date() },
      },
    );
  } catch {
    // Logout should still succeed if the token is already expired
    // or invalid. The controller will clear the browser cookies.
  }
};

export const getAuthenticatedUser = async (userId) => {
  const user = await User.findOne({
    _id: userId,
    isDeleted: false,
  }).populate("role");

  if (!user || user.accountStatus !== "active" || !user.role?.isActive) {
    throw new Error("User account is not active.");
  }

  return sanitizeUser(user);
};
