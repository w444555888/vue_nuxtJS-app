require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server: SocketIO } = require("socket.io");

// 導入路由和 Socket.io
const socketHandler = require("./socket");
const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chat");
const friendsRoutes = require("./routes/friends");
const profileRoutes = require("./routes/profile");

// 初始化应用
const app = express();
const server = http.createServer(app);
const io = new SocketIO(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// 中间件
app.use(express.json());
app.use(cors());

// 路由
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/friends", friendsRoutes);
app.use("/api/profile", profileRoutes);

// Socket.io 事件处理
socketHandler(io);

// 基础路由
app.get("/", (req, res) => {
  res.json({ message: "聊天伺勑器執行中..." });
});

// 錯誤處理
app.use((err, req, res, next) => {
  console.error("錯誤:", err);
  res.status(500).json({ error: "伺服器錯誤" });
});

// 启动服务器
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n聊天服務器已啟動`);
  console.log(`地址: http://localhost:${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}\n`);
});
