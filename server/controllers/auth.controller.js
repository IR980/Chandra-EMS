import {
  loginUser,
  registerUser,
  refreshUserSession,
  logoutUser,
  getAuthenticatedUser,
} from "../services/auth.service.js";

const isProduction = process.env.NODE_ENV === "production";

const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  path: "/",
};

const ACCESS_COOKIE_MAX_AGE = 15 * 60 * 1000;
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const setAuthCookies = (res, tokens) => {
  res.cookie("ems_access", tokens.accessToken, {
    ...cookieOptions,
    maxAge: ACCESS_COOKIE_MAX_AGE,
  });

  res.cookie("ems_refresh", tokens.refreshToken, {
    ...cookieOptions,
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
};

const clearAuthCookies = (res) => {
  res.clearCookie("ems_access", cookieOptions);
  res.clearCookie("ems_refresh", cookieOptions);
};

const getMetadata = (req) => ({
  userAgent: req.get("user-agent"),
  ipAddress: req.ip,
});

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const result = await loginUser(email, password, getMetadata(req));

    setAuthCookies(res, result);

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      data: {
        user: result.user,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const register = async (req, res, next) => {
  try {
    const result = await registerUser(req.body, req.user, getMetadata(req));

    return res.status(201).json({
      success: true,
      message: "User account created successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const result = await refreshUserSession(
      req.cookies?.ems_refresh,
      getMetadata(req),
    );

    setAuthCookies(res, result);

    return res.status(200).json({
      success: true,
      message: "Session refreshed successfully.",
      data: {
        user: result.user,
      },
    });
  } catch (error) {
    clearAuthCookies(res);
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    await logoutUser(req.cookies?.ems_refresh);

    clearAuthCookies(res);

    return res.status(200).json({
      success: true,
      message: "Logout successful.",
    });
  } catch (error) {
    next(error);
  }
};

export const me = async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req.user._id);

    return res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};
