import mongoose from "mongoose";

const verificationHistorySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ["submitted", "verified", "rejected", "reuploaded"],
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      required: true,
    },

    remarks: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    performedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const documentSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },

    documentType: {
      type: String,
      enum: [
        "aadhaar",
        "pan",
        "voter_id",
        "passport",
        "driving_license",
        "bank_proof",
        "education_certificate",
        "experience_letter",
        "address_proof",
        "other",
      ],
      required: true,
    },

    documentName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    documentNumberMasked: {
      type: String,
      trim: true,
      maxlength: 32,
      default: null,
    },

    file: {
      storageProvider: {
        type: String,
        enum: ["cloudinary"],
        default: "cloudinary",
      },

      deliveryType: {
        type: String,
        enum: ["authenticated"],
        default: "authenticated",
        required: true,
      },

      publicId: {
        type: String,
        required: true,
      },

      resourceType: {
        type: String,
        enum: ["image", "raw"],
        required: true,
      },

      format: {
        type: String,
        required: true,
      },

      originalName: {
        type: String,
        required: true,
      },

      size: {
        type: Number,
        required: true,
        min: 1,
      },

      mimeType: {
        type: String,
        required: true,
      },
    },

    issueDate: {
      type: Date,
      default: null,
    },

    expiryDate: {
      type: Date,
      default: null,
    },

    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
      index: true,
    },

    verificationRemarks: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    verificationHistory: {
      type: [verificationHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

// Query indexes
documentSchema.index({
  employee: 1,
  documentType: 1,
  isActive: 1,
});

documentSchema.index({
  verificationStatus: 1,
  createdAt: -1,
});

documentSchema.index({
  employee: 1,
  expiryDate: 1,
});

const Document = mongoose.model("Document", documentSchema);

export default Document;
