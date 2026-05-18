import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server as SocketIO } from "socket.io";
import socketHandler from "./socket.js";
import authRoutes from "./routes/auth.js";
import chatRoutes from "./routes/chat.js";
import friendsRoutes from "./routes/friends.js";
import profileRoutes from "./routes/profile.js";
import aiRoutes from "./routes/ai.js";

const app = express();
const server = http.createServer(app);
const io = new SocketIO(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

app.use(express.json());
app.use(cors());

app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/friends", friendsRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/ai", aiRoutes);

socketHandler(io);

app.get("/", (req, res) => {
  res.json({ message: "聊天伺服器執行中..." });
});

app.use((err, req, res, next) => {
  console.error("錯誤:", err);
  res.status(500).json({ error: "伺服器錯誤" });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n聊天服務器已啟動`);
  console.log(`地址: http://localhost:${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}\n`);
});
