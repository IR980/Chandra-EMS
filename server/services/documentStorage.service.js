import { randomUUID } from "crypto";
import cloudinary from "../config/cloudinary.js";

const uploadDocumentFile = (file) =>
  new Promise((resolve, reject) => {
    const publicId = `ems/employee-documents/${randomUUID()}`;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: "image",
        type: "authenticated",
        overwrite: false,
        unique_filename: false,
        use_filename: false,
        context: {
          category: "employee_document",
        },
      },
      (error, result) => {
        if (error) return reject(error);

        resolve({
          publicId: result.public_id,
          resourceType: result.resource_type,
          format: result.format,
          size: result.bytes,
          mimeType: file.mimetype,
          originalName: file.originalname,
        });
      },
    );

    uploadStream.end(file.buffer);
  });

export const deleteDocumentFile = async (publicId, resourceType) => {
  return cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    type: "authenticated",
    invalidate: true,
  });
};

export const generateDocumentAccessUrl = (
  publicId,
  format,
  resourceType = "image",
  download = false,
) => {
  const expiresAt = Math.floor(Date.now() / 1000) + 5 * 60;

  const url = cloudinary.utils.private_download_url(publicId, format, {
    resource_type: resourceType,
    type: "authenticated",
    expires_at: expiresAt,
    attachment: download,
  });

  return {
    url,
    expiresAt: new Date(expiresAt * 1000),
  };
};

export default uploadDocumentFile;
