import { io } from "socket.io-client";

const DEFAULT_BACKEND_URL = import.meta.env.DEV
  ? "http://localhost:3000"
  : "https://kingdom-backend-zmdh.onrender.com";

const URL = import.meta.env.VITE_BACKEND_URL || DEFAULT_BACKEND_URL;
export const socket = io(URL, {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 10000,
});
