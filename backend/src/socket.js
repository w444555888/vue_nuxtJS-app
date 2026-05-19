import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const onlineUsers = new Map(); // socketId -> { userId, roomId }
const userConnections = new Map(); // userId -> socketId

export default (io) => {
  io.on("connection", (socket) => {
    console.log(`使用者連接: ${socket.id}`);

    // 使用者連接時記錄用戶ID
    socket.on("set_user_id", (userId) => {
      userConnections.set(userId, socket.id);
      console.log(`用戶 ${userId} 的 Socket ID: ${socket.id}`);
    });

    // 使用者加入聊天室
    socket.on("join_room", async (data) => {
      const { userId, roomId } = data;
      socket.join(`room_${roomId}`);

      // 記錄線上使用者
      onlineUsers.set(socket.id, { userId, roomId });

      // 廣播使用者進入
      io.to(`room_${roomId}`).emit("user_joined", {
        userId,
        message: `使用者 ${userId} 進入了聊天室`,
      });

      console.log(`使用者 ${userId} 加入聊天室 ${roomId}`);
    });

    // 接收消息
    socket.on("send_message", async (data) => {
      const { userId, roomId, content } = data;

      try {
        // 保存到資料庫
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
          userId: message.user.id,
          username: message.user.username,
          avatar: message.user.avatar,
          createdAt: message.createdAt,
        });

        console.log(`新消息 [房间 ${roomId}]: ${content}`);
      } catch (error) {
        console.error("消息保存失败:", error);
        socket.emit("error", { message: "消息发送失败" });
      }
    });

    // ==================== 私聊功能 ====================

    // 加入私聊對話
    socket.on("join_private_chat", (data) => {
      const { userId, friendId } = data;
      const conversationId = `private_${Math.min(userId, friendId)}_${Math.max(userId, friendId)}`;
      socket.join(conversationId);
      console.log(`用戶 ${userId} 加入與用戶 ${friendId} 的私聊`);
    });

    // 發送私聊消息
    socket.on("send_private_message", async (data) => {
      const { userId, friendId, content } = data;

      try {
        // 驗證好友關係
        const isFriend = await prisma.friend.findFirst({
          where: {
            OR: [
              { userId1: userId, userId2: friendId },
              { userId1: friendId, userId2: userId },
            ],
          },
        });

        if (!isFriend) {
          socket.emit("error", { message: "該用戶不是你的好友" });
          return;
        }

        // 保存到資料庫
        const message = await prisma.privateMessage.create({
          data: {
            content,
            senderId: userId,
            receiverId: friendId,
            isRead: false,
          },
          include: {
            sender: {
              select: { id: true, username: true, avatar: true },
            },
            receiver: {
              select: { id: true, username: true, avatar: true },
            },
          },
        });

        // 構建對話ID
        const conversationId = `private_${Math.min(userId, friendId)}_${Math.max(userId, friendId)}`;

        // 廣播到該對話的所有客戶端
        io.to(conversationId).emit("receive_private_message", {
          id: message.id,
          content: message.content,
          senderId: message.sender.id,
          senderName: message.sender.username,
          senderAvatar: message.sender.avatar,
          receiverId: message.receiver.id,
          isRead: message.isRead,
          createdAt: message.createdAt,
        });

        // 如果接收者線上，標記為已讀
        const receiverSocketId = userConnections.get(friendId);
        if (receiverSocketId) {
          const receiverSocket = io.sockets.sockets.get(receiverSocketId);
          if (receiverSocket) {
            // 發送通知給接收者（私聊列表更新）
            receiverSocket.emit("private_message_received", {
              senderId: userId,
              senderName: message.sender.username,
              senderAvatar: message.sender.avatar,
              content: content.substring(0, 50), // 預覽
              messageId: message.id,
            });
          }
        }

        console.log(`新私聊消息 [${userId} -> ${friendId}]: ${content}`);
      } catch (error) {
        console.error("私聊保存失败:", error);
        socket.emit("error", { message: "消息发送失败" });
      }
    });

    // 標記私聊為已讀
    socket.on("mark_private_as_read", async (data) => {
      const { userId, friendId } = data;

      try {
        await prisma.privateMessage.updateMany({
          where: {
            senderId: friendId,
            receiverId: userId,
            isRead: false,
          },
          data: { isRead: true },
        });

        const conversationId = `private_${Math.min(userId, friendId)}_${Math.max(userId, friendId)}`;
        io.to(conversationId).emit("private_messages_read", {
          userId: friendId,
        });

        console.log(`用戶 ${userId} 標記來自 ${friendId} 的消息為已讀`);
      } catch (error) {
        console.error("標記已讀失敗:", error);
        socket.emit("error", { message: "標記失敗" });
      }
    });

    // 使用者離開
    socket.on("disconnect", () => {
      const user = onlineUsers.get(socket.id);
      if (user) {
        io.to(`room_${user.roomId}`).emit("user_left", {
          userId: user.userId,
          message: `使用者 ${user.userId} 離開了聊天室`,
        });
        onlineUsers.delete(socket.id);
      }

      // 移除用戶連接記錄
      for (const [userId, socketId] of userConnections.entries()) {
        if (socketId === socket.id) {
          userConnections.delete(userId);
          console.log(`用戶 ${userId} 的連接已移除`);
          break;
        }
      }

      console.log(`使用者斷開連接: ${socket.id}`);
    });
  });
};
