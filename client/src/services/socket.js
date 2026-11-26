import { io } from "socket.io-client";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const SOCKET_URL = new URL(API_BASE_URL).origin;

const socket = io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,
  transports: ["polling"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

export default socket;
