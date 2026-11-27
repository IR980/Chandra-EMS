import express from "express";
import { createServer } from "http";
import { initializeSocket } from "./services/socket.service.js";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import dns from "dns";
import connectDB from "./config/db.js";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.routes.js";
import errorHandler from "./middleware/error.middleware.js";
import domainRoutes from "./routes/domain.routes.js";
import departmentRoutes from "./routes/department.routes.js";
import employeeRoutes from "./routes/employee.routes.js";
import attendanceRoutes from "./routes/attendance.routes.js";
import roleRoutes from "./routes/role.routes.js";
import leaveRoutes from "./routes/leave.routes.js";
import payrollRoutes from "./routes/payroll.routes.js";
// import payrollProcessingRoutes from "./routes/payrollProcessing.routes.js";
import { startPayrollScheduler } from "./services/payrollScheduler.service.js";
import reportsRoutes from "./routes/reports.routes.js";
import { validateRequestOrigin } from "./middleware/csrf.middleware.js";
import documentRoutes from "./routes/document.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
dns.setServers(["8.8.8.8", "8.8.4.4"]);
dotenv.config();

const app = express();
// Trust Render's reverse proxy
app.set("trust proxy", 1);
// Create HTTP server
const httpServer = createServer(app);
// Security middleware
app.use(helmet());

// CORS configuration
// CORS configuration
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// CSRF protection
app.use(validateRequestOrigin);

// Request body parsing
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Cookie parser
app.use(cookieParser());

// API rate limiter
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 200,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);

// Strict rate limit for login attempts
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "Too many login attempts. Please try again after 15 minutes.",
  },
});

// Apply the stricter limit only to login
app.use("/api/auth/login", loginRateLimiter);
// Root route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Chandra Enterprises EMS Backend",
  });
});

// Health check route
app.get("/api/health", (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;

  res.status(isConnected ? 200 : 503).json({
    success: isConnected,
    message: "EMS API is running",
    database: isConnected ? "Connected" : "Disconnected",
    server: "Running",
  });
});

// Authentication API
app.use("/api/auth", authRoutes);

// Domain API
app.use("/api/domains", domainRoutes);

// Department API
app.use("/api/departments", departmentRoutes);

// Employee API
app.use("/api/employees", employeeRoutes);

// Employee Documents API
app.use("/api/documents", documentRoutes);

// Role API
app.use("/api/roles", roleRoutes);

// Attendance API
app.use("/api/attendance", attendanceRoutes);

// Leave API
app.use("/api/leaves", leaveRoutes);

// Payroll API
app.use("/api/payroll", payrollRoutes);
// app.use("/api/payroll", payrollProcessingRoutes);

// Reports API
app.use("/api/reports", reportsRoutes);

// Notifications API
app.use("/api/notifications", notificationRoutes);
// Central error handler — must be registered after all routes.
app.use(errorHandler);

// Start server after database connection
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    await startPayrollScheduler();
    initializeSocket(httpServer, allowedOrigins); // Initialize Socket.IO with the HTTP server
    httpServer.listen(PORT, () => {
      console.log(`EMS Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Unable to start server:", error.message);
    process.exit(1);
  }
};

startServer();
