const errorHandler = (err, req, res, next) => {
  console.error("API Error:", err);

  if (res.headersSent) {
    return next(err);
  }

  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error.";

  if (err.code === 11000) {
    statusCode = 409;
    message = "A record with this information already exists.";
  } else if (err.name === "ValidationError" || err.name === "CastError") {
    statusCode = 400;
    message = err.message;
  }

  return res.status(statusCode).json({
    success: false,
    message:
      statusCode === 500 && process.env.NODE_ENV === "production"
        ? "Internal server error."
        : message,
  });
};

export default errorHandler;
