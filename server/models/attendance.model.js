import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },

    domain: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Domain",
      required: true,
      index: true,
    },

    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
      index: true,
    },

    // Company attendance date in YYYY-MM-DD format (Asia/Kolkata).
    attendanceDate: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "Invalid attendance date."],
    },

    status: {
      type: String,
      enum: ["present", "absent", "half_day", "leave", "holiday", "week_off"],
      default: "present",
      required: true,
    },

    checkInAt: {
      type: Date,
      default: null,
    },

    checkOutAt: {
      type: Date,
      default: null,
    },

    workedMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },

    remarks: {
      type: String,
      default: "",
      maxlength: 500,
      trim: true,
    },

    source: {
      type: String,
      enum: ["self", "admin", "manager"],
      default: "self",
    },

    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    isApproved: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// One employee can have only one attendance record per day.
attendanceSchema.index({ employee: 1, attendanceDate: 1 }, { unique: true });

// Useful indexes for HR attendance reports.
attendanceSchema.index({
  attendanceDate: -1,
  status: 1,
});

attendanceSchema.index({
  domain: 1,
  attendanceDate: -1,
});

attendanceSchema.index({
  department: 1,
  attendanceDate: -1,
});

const Attendance = mongoose.model("Attendance", attendanceSchema);

export default Attendance;
