// Socket.io 事件处理
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const pg = require("pg");

// Prisma v7 PostgreSQL 连接
const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// 存储在线用户
const onlineUsers = new Map();

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log(`✅ 用户连接: ${socket.id}`);

    // 用户加入聊天室
    socket.on("join_room", async (data) => {
      const { userId, roomId } = data;
      socket.join(`room_${roomId}`);

      // 记录在线用户
      onlineUsers.set(socket.id, { userId, roomId });

      // 广播用户进入
      io.to(`room_${roomId}`).emit("user_joined", {
        userId,
        message: `用户 ${userId} 进入了聊天室`,
      });

      console.log(`👤 用户 ${userId} 加入聊天室 ${roomId}`);
    });

    // 接收消息
    socket.on("send_message", async (data) => {
      const { userId, roomId, content } = data;

      try {
        // 保存到数据库
        const message = await prisma.message.create({
          data: {
            content,
            userId,
            roomId,
          },
          include: {
            user: true,
          },
        });

        // 广播到聊天室
        io.to(`room_${roomId}`).emit("receive_message", {
          id: message.id,
          content: message.content,
          userId: message.user.username,
          avatar: message.user.avatar,
          timestamp: message.createdAt,
        });

        console.log(`💬 新消息 [房间 ${roomId}]: ${content}`);
      } catch (error) {
        console.error("消息保存失败:", error);
        socket.emit("error", { message: "消息发送失败" });
      }
    });

    // 用户离开
    socket.on("disconnect", () => {
      const user = onlineUsers.get(socket.id);
      if (user) {
        io.to(`room_${user.roomId}`).emit("user_left", {
          userId: user.userId,
          message: `用户 ${user.userId} 离开了聊天室`,
        });
        onlineUsers.delete(socket.id);
      }
      console.log(`❌ 用户断开连接: ${socket.id}`);
    });
  });
};
