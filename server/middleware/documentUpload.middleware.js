import multer from "multer";

const allowedMimeTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const storage = multer.memoryStorage();

const fileFilter = (req, file, callback) => {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    const error = new Error(
      "Only PDF, JPG, JPEG, PNG and WEBP files are allowed.",
    );

    error.code = "UNSUPPORTED_DOCUMENT_TYPE";
    return callback(error);
  }

  callback(null, true);
};

const documentUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
});

export default documentUpload;
