const signatures = {
  "application/pdf": (buffer) =>
    buffer.subarray(0, 5).toString("ascii") === "%PDF-",

  "image/jpeg": (buffer) =>
    buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,

  "image/png": (buffer) =>
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),

  "image/webp": (buffer) =>
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP",
};

const validateDocumentFile = (req, res, next) => {
  if (!req.file?.buffer) {
    const error = new Error("Please upload a document file.");
    error.statusCode = 400;
    return next(error);
  }

  const validator = signatures[req.file.mimetype];

  if (!validator || !validator(req.file.buffer)) {
    const error = new Error(
      "File content does not match its declared file type.",
    );

    error.code = "INVALID_DOCUMENT_SIGNATURE";
    return next(error);
  }

  next();
};

export default validateDocumentFile;
