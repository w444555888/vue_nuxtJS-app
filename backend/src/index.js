require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server: SocketIO } = require("socket.io");

// 导入路由和 Socket.io
const socketHandler = require("./socket");
const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chat");

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

// Socket.io 事件处理
socketHandler(io);

// 基础路由
app.get("/", (req, res) => {
  res.json({ message: "聊天服务器运行中..." });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error("错误:", err);
  res.status(500).json({ error: "服务器错误" });
});

// 启动服务器
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n聊天服务器已启动`);
  console.log(`地址: http://localhost:${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}\n`);
});
