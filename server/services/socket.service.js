import { Server } from "socket.io";
import User from "../models/user.model.js";
import { verifyAccessToken } from "../utils/token.util.js";

let io;

export const initializeSocket = (httpServer, allowedOrigins) => {
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  // Authenticate every socket connection.
  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie || "";

      const accessCookie = cookieHeader
        .split(";")
        .map((cookie) => cookie.trim())
        .find((cookie) => cookie.startsWith("ems_access="));

      const cookieToken = accessCookie
        ? decodeURIComponent(accessCookie.slice("ems_access=".length))
        : null;

      const bearerHeader = socket.handshake.headers.authorization;

      const bearerToken = bearerHeader?.startsWith("Bearer ")
        ? bearerHeader.slice(7)
        : null;

      const accessToken =
        socket.handshake.auth?.token || cookieToken || bearerToken;

      if (!accessToken) {
        return next(new Error("Authentication required."));
      }

      const payload = verifyAccessToken(accessToken);

      const user = await User.findOne({
        _id: payload.sub,
        isDeleted: false,
        accountStatus: "active",
      }).populate("role");

      if (!user || !user.role?.isActive) {
        return next(new Error("User account is inactive."));
      }

      if ((payload.ver ?? 0) !== (user.tokenVersion ?? 0)) {
        return next(new Error("Session has been invalidated."));
      }

      socket.userId = user._id.toString();
      next();
    } catch (error) {
      next(new Error("Invalid or expired authentication token."));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.userId}`);

    console.log(`[Socket.IO] User connected: ${socket.userId}`);

    socket.on("disconnect", () => {
      console.log(`[Socket.IO] User disconnected: ${socket.userId}`);
    });
  });

  console.log("[Socket.IO] Initialized successfully.");

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO has not been initialized.");
  }

  return io;
};

export const emitToUser = (userId, event, data) => {
  if (!io) return;

  io.to(`user:${userId}`).emit(event, data);
};
