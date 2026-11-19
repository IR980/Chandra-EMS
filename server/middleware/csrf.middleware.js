const allowedOrigins = new Set(
  (process.env.CLIENT_URL || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      try {
        return new URL(origin).origin;
      } catch {
        return origin.replace(/\/+$/, "");
      }
    }),
);

export const validateRequestOrigin = (req, res, next) => {
  // Safe HTTP methods do not change server data.
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const origin = req.get("origin");

  // Prefer the browser-provided Origin header.
  if (origin) {
    if (origin === "null" || !allowedOrigins.has(origin)) {
      return res.status(403).json({
        success: false,
        message: "Request origin is not allowed.",
      });
    }

    return next();
  }

  // Fall back to Referer when Origin is not provided.
  const referer = req.get("referer");

  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;

      if (!allowedOrigins.has(refererOrigin)) {
        return res.status(403).json({
          success: false,
          message: "Request origin is not allowed.",
        });
      }
    } catch {
      return res.status(403).json({
        success: false,
        message: "Invalid request origin.",
      });
    }
  }

  // Requests without Origin or Referer are allowed for
  // non-browser clients such as Postman and server-to-server calls.
  return next();
};
