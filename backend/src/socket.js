import prisma from "./prisma.js";

const onlineUsers = new Map(); // socketId -> { userId, roomId }
const userConnections = new Map(); // userId -> socketId

export default (io) => {
  io.on("connection", (socket) => {
    const authenticatedUserId = socket.user?.id;

    if (!authenticatedUserId) {
      socket.disconnect(true);
      return;
    }

    userConnections.set(authenticatedUserId, socket.id);
    console.log(`使用者連接: ${socket.id}, userId=${authenticatedUserId}`);

    // 使用者連接時記錄用戶ID
    socket.on("set_user_id", (userId) => {
      if (userId !== authenticatedUserId) {
        socket.emit("error", { message: "身份驗證失敗，userId 不一致" });
        return;
      }

      userConnections.set(authenticatedUserId, socket.id);
      console.log(`用戶 ${authenticatedUserId} 的 Socket ID: ${socket.id}`);
    });

    // 使用者加入聊天室
    socket.on("join_room", async (data) => {
      const { roomId } = data;
      socket.join(`room_${roomId}`);

      // 記錄線上使用者
      onlineUsers.set(socket.id, { userId: authenticatedUserId, roomId });

      // 廣播使用者進入
      io.to(`room_${roomId}`).emit("user_joined", {
        userId: authenticatedUserId,
        message: `使用者 ${authenticatedUserId} 進入了聊天室`,
      });

      console.log(`使用者 ${authenticatedUserId} 加入聊天室 ${roomId}`);
    });

    // 接收消息
    socket.on("send_message", async (data) => {
      const { roomId, content } = data;

      if (!content || !String(content).trim()) {
        socket.emit("error", { message: "訊息內容不能為空" });
        return;
      }

      try {
        // 保存到資料庫
        const message = await prisma.message.create({
          data: {
            content: String(content).trim(),
            userId: authenticatedUserId,
            roomId,
          },
          include: {
            user: true,
          },
        });

        // 廣播到聊天室
        io.to(`room_${roomId}`).emit("receive_message", {
          id: message.id,
          content: message.content,
          userId: message.user.id,
          username: message.user.username,
          avatar: message.user.avatar,
          createdAt: message.createdAt,
        });

        console.log(`新消息 [房間 ${roomId}]: ${content}`);
      } catch (error) {
        console.error("訊息保存失敗:", error);
        socket.emit("error", { message: "訊息發送失敗" });
      }
    });

    // ==================== 私聊功能 ====================

    // 加入私聊對話
    socket.on("join_private_chat", (data) => {
      const { friendId } = data;
      const conversationId = `private_${Math.min(authenticatedUserId, friendId)}_${Math.max(authenticatedUserId, friendId)}`;
      socket.join(conversationId);
      console.log(`用戶 ${authenticatedUserId} 加入與用戶 ${friendId} 的私聊`);
    });

    // 發送私聊消息
    socket.on("send_private_message", async (data) => {
      const { friendId, content } = data;

      if (!content || !String(content).trim()) {
        socket.emit("error", { message: "消息內容不能為空" });
        return;
      }

      try {
        // 驗證好友關係
        const isFriend = await prisma.friend.findFirst({
          where: {
            OR: [
              { userId1: authenticatedUserId, userId2: friendId },
              { userId1: friendId, userId2: authenticatedUserId },
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
            content: String(content).trim(),
            senderId: authenticatedUserId,
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
  const conversationId = `private_${Math.min(authenticatedUserId, friendId)}_${Math.max(authenticatedUserId, friendId)}`;

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
              senderId: authenticatedUserId,
              senderName: message.sender.username,
              senderAvatar: message.sender.avatar,
              content: String(content).substring(0, 50), // 預覽
              messageId: message.id,
            });
          }
        }

        console.log(`新私聊消息 [${authenticatedUserId} -> ${friendId}]: ${content}`);
      } catch (error) {
        console.error("私聊保存失敗:", error);
        socket.emit("error", { message: "訊息發送失敗" });
      }
    });

    // 標記私聊為已讀
    socket.on("mark_private_as_read", async (data) => {
      const { friendId } = data;

      try {
        await prisma.privateMessage.updateMany({
          where: {
            senderId: friendId,
            receiverId: authenticatedUserId,
            isRead: false,
          },
          data: { isRead: true },
        });

        const conversationId = `private_${Math.min(authenticatedUserId, friendId)}_${Math.max(authenticatedUserId, friendId)}`;
        io.to(conversationId).emit("private_messages_read", {
          userId: friendId,
        });

        console.log(`用戶 ${authenticatedUserId} 標記來自 ${friendId} 的消息為已讀`);
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
