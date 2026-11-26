const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  console.error("API Error:", err);

  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error.";

  // Multer upload errors
  if (err.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      statusCode = 413;
      message = "File size cannot exceed 10 MB.";
    } else if (
      err.code === "LIMIT_FILE_COUNT" ||
      err.code === "LIMIT_UNEXPECTED_FILE"
    ) {
      statusCode = 400;
      message = "Only one document file is allowed.";
    } else {
      statusCode = 400;
      message = "Invalid document upload.";
    }
  }

  // Unsupported document file type
  else if (err.code === "UNSUPPORTED_DOCUMENT_TYPE") {
    statusCode = 415;
    message = "Only PDF, JPG, JPEG, PNG and WEBP files are allowed.";
  }

  // Invalid file signature
  else if (err.code === "INVALID_DOCUMENT_SIGNATURE") {
    statusCode = 400;
    message = "The uploaded file content does not match its file type.";
  }

  // MongoDB errors
  else if (err.code === 11000) {
    statusCode = 409;
    message = "A record with this information already exists.";
  } else if (err.name === "ValidationError" || err.name === "CastError") {
    statusCode = 400;
    message = "Invalid data provided.";
  }

  // Never expose internal server errors in production
  if (statusCode >= 500 && process.env.NODE_ENV === "production") {
    message = "Internal server error.";
  }

  return res.status(statusCode).json({
    success: false,
    message,
  });
};

export default errorHandler;
