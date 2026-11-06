import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

const getSecrets = () => {
  const accessSecret = process.env.ACCESS_TOKEN_SECRET;
  const refreshSecret = process.env.REFRESH_TOKEN_SECRET;

  if (!accessSecret || !refreshSecret) {
    throw new Error(
      "ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be configured.",
    );
  }

  if (accessSecret.length < 32 || refreshSecret.length < 32) {
    throw new Error("JWT secrets must each contain at least 32 characters.");
  }

  if (accessSecret === refreshSecret) {
    throw new Error("Access and refresh token secrets must be different.");
  }

  return { accessSecret, refreshSecret };
};

/**
 * Generate short-lived access token.
 */
export const generateAccessToken = (user) => {
  const { accessSecret } = getSecrets();

  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role.toString(),
      type: "access",
    },
    accessSecret,
    {
      expiresIn: ACCESS_TOKEN_EXPIRY,
      issuer: "chandra-ems",
      audience: "chandra-ems-api",
    },
  );
};

/**
 * Generate refresh token.
 */
export const generateRefreshToken = (user) => {
  const { refreshSecret } = getSecrets();

  const tokenId = randomUUID();

  const token = jwt.sign(
    {
      sub: user._id.toString(),
      jti: tokenId,
      type: "refresh",
    },
    refreshSecret,
    {
      expiresIn: REFRESH_TOKEN_EXPIRY,
      issuer: "chandra-ems",
      audience: "chandra-ems-api",
    },
  );

  return {
    token,
    tokenId,
  };
};

/**
 * Verify access token.
 */
export const verifyAccessToken = (token) => {
  const { accessSecret } = getSecrets();

  const payload = jwt.verify(token, accessSecret, {
    issuer: "chandra-ems",
    audience: "chandra-ems-api",
    algorithms: ["HS256"],
  });

  if (payload.type !== "access") {
    throw new Error("Invalid access token type.");
  }

  return payload;
};

/**
 * Verify refresh token.
 */
export const verifyRefreshToken = (token) => {
  const { refreshSecret } = getSecrets();

  const payload = jwt.verify(token, refreshSecret, {
    issuer: "chandra-ems",
    audience: "chandra-ems-api",
    algorithms: ["HS256"],
  });

  if (payload.type !== "refresh" || !payload.jti) {
    throw new Error("Invalid refresh token.");
  }

  return payload;
};
