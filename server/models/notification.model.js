import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    category: {
      type: String,
      enum: [
        "attendance",
        "leave",
        "payroll",
        "employee",
        "document",
        "system",
      ],
      required: true,
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    actionUrl: {
      type: String,
      default: null,
      maxlength: 500,
    },

    relatedEntity: {
      type: {
        type: String,
        enum: [
          "Employee",
          "Attendance",
          "Leave",
          "Payroll",
          "Document",
          "Domain",
          "Department",
        ],
        default: null,
      },

      id: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
      },
    },

    readAt: {
      type: Date,
      default: null,
    },

    archivedAt: {
      type: Date,
      default: null,
    },

    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Efficient recipient notification queries.
notificationSchema.index({
  recipient: 1,
  createdAt: -1,
});

notificationSchema.index({
  recipient: 1,
  readAt: 1,
  createdAt: -1,
});

notificationSchema.index({
  recipient: 1,
  archivedAt: 1,
  createdAt: -1,
});

// Automatically remove notifications after their expiry date.
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
