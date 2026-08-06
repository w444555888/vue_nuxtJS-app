import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server as SocketIO } from "socket.io";
import jwt from "jsonwebtoken";
import morgan from "morgan";
import logger from "./utils/logger.js";
import performanceMiddleware from "./middleware/performance.js";
import socketHandler from "./socket.js";
import authRoutes from "./routes/auth.js";
import chatRoutes from "./routes/chat.js";
import friendsRoutes from "./routes/friends.js";
import profileRoutes from "./routes/profile.js";
import aiRoutes from "./routes/ai.js";

const app = express();
const server = http.createServer(app);
// Socket.IO 與 HTTP 共用同一個 server，會自動從 polling 升級到 WebSocket。
const io = new SocketIO(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

app.set("io", io);

io.engine.on("connection_error", (err) => {
  logger.error(`[WS 連線異常] ${err.message} (code: ${err.code})`, {
    url: err.req?.url,
    ip: err.req?.socket?.remoteAddress,
  });
});

// HTTP 日誌中間件（使用 morgan）
app.use(morgan(':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] - :response-time ms'));

// 性能監控中間件
app.use(performanceMiddleware);

app.use(express.json());
app.use(cors());

app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/friends", friendsRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/ai", aiRoutes);

io.use((socket, next) => {
  try {
    const authToken = socket.handshake.auth?.token;
    const headerToken = socket.handshake.headers?.authorization?.split(" ")[1];
    const token = authToken || headerToken;

    if (!token) {
      return next(new Error("未授權：ws 缺少 token"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = {
      id: decoded.id,
      username: decoded.username,
    };
    return next();
  } catch (error) {
    return next(new Error("未授權：ws token 無效或已過期"));
  }
});

socketHandler(io);

app.get("/", (req, res) => {
  res.json({ message: "聊天伺服器執行中..." });
});

app.use((err, req, res, next) => {
  logger.error("API 錯誤", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });
  res.status(500).json({ error: "伺服器錯誤" });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  logger.info("聊天服務器已啟動", {
    address: `http://localhost:${PORT}`,
    websocket: `ws://localhost:${PORT}`,
    environment: process.env.NODE_ENV || 'development'
  });
});
