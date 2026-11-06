import User from "../models/user.model.js";
import { verifyAccessToken } from "../utils/token.util.js";

export const authenticate = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization;

    const bearerToken = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;

    const accessToken = req.cookies?.ems_access || bearerToken;

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const payload = verifyAccessToken(accessToken);

    const user = await User.findOne({
      _id: payload.sub,
      isDeleted: false,
      accountStatus: "active",
    }).populate("role");

    if (!user || !user.role?.isActive) {
      return res.status(401).json({
        success: false,
        message: "User account is inactive or unavailable.",
      });
    }

    req.user = user;
    req.auth = payload;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired access token.",
    });
  }
};

export const requirePermission = (permission) => {
  return (req, res, next) => {
    const permissions = req.user?.role?.permissions || [];

    if (permissions.includes("*") || permissions.includes(permission)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: "You do not have permission to perform this action.",
    });
  };
};
