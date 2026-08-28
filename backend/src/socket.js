import prisma from "./prisma.js";
import logger from "./utils/logger.js";
import { triggerGroupStockAiReply } from "./services/groupStockAi.js";

/**
 * Socket.IO 事件處理器
 * - 負責處理 WebSocket 連線、消息傳遞、聊天室管理等功能。
 * - 使用 Map 來追蹤線上使用者和他們所在的聊天室，以便在需要時進行廣播。
 * - 提供斷線補償機制，讓客戶端在重連後能夠獲取斷線期間的漏訊。
 * - 支援私聊功能，使用專用的對話ID來管理兩人之間的消息流。
 * - 事件格式統一，方便前端處理和展示。
 * - 錯誤處理和權限驗證，確保只有合法用戶能夠執行相應的操作。
 * - 透過 ack 機制提供操作結果反饋，讓客戶端能夠即時獲知操作是否成功。
 */

// onlineUsers 以 socketId 為鍵，記錄這條連線對應的 userId 和 roomId
const onlineUsers = new Map(); // socketId -> { userId, roomId }
// userConnections：以 user 為主鍵，記錄這個使用者目前對應哪條 socket
const userConnections = new Map(); // userId -> socketId
const REPLAY_CHUNK_SIZE = 200; // 最多補 200 筆，避免一次補太多資料造成尖峰負載

const buildPrivateConversationId = (userIdA, userIdB) => {
  return `private_${Math.min(userIdA, userIdB)}_${Math.max(userIdA, userIdB)}`;
};

const buildRoomReplyPreview = (replyMessage) => {
  if (!replyMessage) {
    return null;
  }

  return {
    id: replyMessage.id,
    content: replyMessage.content || "",
    imageUrl: replyMessage.imageUrl || null,
    senderId: replyMessage.user?.id,
    senderName: replyMessage.user?.username || "未知使用者",
  };
};

const buildPrivateReplyPreview = (replyMessage) => {
  if (!replyMessage) {
    return null;
  }

  return {
    id: replyMessage.id,
    content: replyMessage.content || "",
    imageUrl: replyMessage.imageUrl || null,
    senderId: replyMessage.sender?.id,
    senderName: replyMessage.sender?.username || "未知使用者",
  };
};

const formatRoomMessageEvent = (message) => ({
  id: message.id,
  seq: message.id,
  roomId: message.roomId,
  content: message.content,
  imageUrl: message.imageUrl,
  userId: message.user.id,
  username: message.user.username,
  avatar: message.user.avatar,
  replyToMessageId: message.replyToMessageId || null,
  replyPreview: buildRoomReplyPreview(message.replyToMessage),
  createdAt: message.createdAt,
  eventType: "message_created",
});

const formatPrivateMessageEvent = (message) => ({
  id: message.id,
  seq: message.id,
  content: message.content,
  imageUrl: message.imageUrl,
  senderId: message.sender.id,
  senderName: message.sender.username,
  senderAvatar: message.sender.avatar,
  receiverId: message.receiver.id,
  replyToMessageId: message.replyToMessageId || null,
  replyPreview: buildPrivateReplyPreview(message.replyToMessage),
  isRead: message.isRead,
  createdAt: message.createdAt,
  eventType: "private_message_created",
});

export default (io) => {
  io.on("connection", (socket) => {
    const authenticatedUserId = socket.data?.userId || socket.user?.id;

    if (!authenticatedUserId) {
      socket.disconnect(true);
      return;
    }

    userConnections.set(authenticatedUserId, socket.id);
    socket.join(`user_${authenticatedUserId}`);
    logger.info(`使用者連接`, {
      socketId: socket.id,
      userId: authenticatedUserId,
      recovered: socket.recovered,
    });

    if (socket.recovered) {
      logger.info("WS 連線狀態恢復成功", {
        socketId: socket.id,
        userId: authenticatedUserId,
      });
    }

    // 連線後先送一個事件，讓客戶端初始化 recovery offset。
    socket.emit("ws_ready", {
      recovered: socket.recovered,
      at: Date.now(),
    });

    // 使用者連接時記錄用戶ID
    socket.on("set_user_id", (userId) => {
      if (userId !== authenticatedUserId) {
        socket.emit("error", { message: "身份驗證失敗，userId 不一致" });
        return;
      }

      userConnections.set(authenticatedUserId, socket.id);
      logger.info(`用戶的 Socket ID 已設置`, { userId: authenticatedUserId, socketId: socket.id });
    });

    // 使用者加入聊天室
    socket.on("join_room", async (data) => {
      const { roomId, lastSeq } = data || {};
      if (!roomId) {
        socket.emit("error", { message: "roomId 不可為空" });
        return;
      }

      const member = await prisma.chatRoomMember.findUnique({
        where: {
          userId_roomId: {
            userId: authenticatedUserId,
            roomId,
          },
        },
      });

      if (!member) {
        socket.emit("error", { message: "你不是此聊天室的成員" });
        return;
      }

      socket.join(`room_${roomId}`);

      // 記錄線上使用者
      onlineUsers.set(socket.id, { userId: authenticatedUserId, roomId });

      // 斷線補償流程：
      // 1) 客戶端帶 lastSeq（最後收到的序號）進來
      // 2) 後端查出 id > lastSeq 的漏訊一次補回
      // 3) 補完後，後續新訊息走一般 WS 即時推送
      const parsedLastSeq = Number(lastSeq);
      if (Number.isInteger(parsedLastSeq) && parsedLastSeq > 0) {
        let replayCursor = parsedLastSeq;
        let replayBatchCount = 0;

        while (true) {
          const missedMessages = await prisma.message.findMany({
            where: {
              roomId,
              id: { gt: replayCursor },
            },
            include: {
              user: {
                select: { id: true, username: true, avatar: true },
              },
              replyToMessage: {
                select: {
                  id: true,
                  content: true,
                  imageUrl: true,
                  user: {
                    select: { id: true, username: true },
                  },
                },
              },
            },
            orderBy: { id: "asc" },
            take: REPLAY_CHUNK_SIZE,
          });

          if (missedMessages.length === 0) {
            break;
          }

          socket.emit(
            "room_missed_messages",
            missedMessages.map((message) => formatRoomMessageEvent(message))
          );

          replayBatchCount += 1;
          replayCursor = missedMessages[missedMessages.length - 1].id;

          if (missedMessages.length < REPLAY_CHUNK_SIZE) {
            break;
          }
        }

        if (replayBatchCount > 1) {
          logger.info("聊天室補漏分批完成", {
            userId: authenticatedUserId,
            roomId,
            lastSeq: parsedLastSeq,
            batches: replayBatchCount,
            chunkSize: REPLAY_CHUNK_SIZE,
          });
        }
      }

      // 廣播給房間內的所有人：有新用戶加入
      io.to(`room_${roomId}`).emit("user_joined", {
        userId: authenticatedUserId,
        roomId,
        message: `使用者 ${authenticatedUserId} 進入了聊天室`,
      });

      logger.info(`使用者加入聊天室`, { userId: authenticatedUserId, roomId });
    });

    socket.on("leave_room", (data) => {
      const { roomId } = data || {};
      if (!roomId) return;
      socket.leave(`room_${roomId}`);
    });

    // 接收消息
    socket.on("send_message", async (data, ack) => {
      const { roomId, content, imageUrl, replyToMessageId } = data || {};

      if ((!content || !String(content).trim()) && !imageUrl) {
        if (ack) {
          ack({ success: false, message: "訊息內容和圖片不能同時為空" });
        } else {
          socket.emit("error", { message: "訊息內容和圖片不能同時為空" });
        }
        return;
      }

      try {
        let parsedReplyToMessageId = null;
        if (replyToMessageId !== undefined && replyToMessageId !== null && replyToMessageId !== "") {
          parsedReplyToMessageId = Number(replyToMessageId);
          if (!Number.isInteger(parsedReplyToMessageId) || parsedReplyToMessageId <= 0) {
            ack?.({ success: false, message: "回覆目標無效 ws parsedReplyToMessageId" });
            return;
          }
        }

        const member = await prisma.chatRoomMember.findUnique({
          where: {
            userId_roomId: {
              userId: authenticatedUserId,
              roomId,
            },
          },
        });

        if (!member) {
          if (ack) {
            ack({ success: false, message: "你不是此聊天室的成員" });
          } else {
            socket.emit("error", { message: "你不是此聊天室的成員" });
          }
          return;
        }

        if (parsedReplyToMessageId) {
          const repliedMessage = await prisma.message.findUnique({
            where: { id: parsedReplyToMessageId },
            select: { id: true, roomId: true },
          });

          if (!repliedMessage || repliedMessage.roomId !== roomId) {
            ack?.({ success: false, message: "被回覆消息不存在或不在此聊天室" });
            return;
          }
        }

        // 保存到資料庫
        const message = await prisma.message.create({
          data: {
            content: content ? String(content).trim() : "",
            imageUrl: imageUrl || null,
            userId: authenticatedUserId,
            roomId,
            replyToMessageId: parsedReplyToMessageId,
          },
          include: {
            user: {
              select: { id: true, username: true, avatar: true },
            },
            replyToMessage: {
              select: {
                id: true,
                content: true,
                imageUrl: true,
                user: {
                  select: { id: true, username: true },
                },
              },
            },
          },
        });

        const event = formatRoomMessageEvent(message);

        // 廣播到聊天室
        io.to(`room_${roomId}`).emit("receive_message", event);

        // 群組聊天主流程走 WebSocket，股票 AI 自動回覆也需掛在這裡。
        triggerGroupStockAiReply({
          roomId,
          content: message.content,
          io,
        });

        if (ack) {
          ack({ success: true, event });
        }

        logger.info(`新聊天室消息`, { roomId, userId: authenticatedUserId, content: content?.substring(0, 100) });
      } catch (error) {
        logger.error("聊天室訊息保存失敗", { error: error.message, roomId, userId: authenticatedUserId });
        if (ack) {
          ack({ success: false, message: "訊息發送失敗" });
        } else {
          socket.emit("error", { message: "訊息發送失敗" });
        }
      }
    });

    socket.on("update_message", async (data, ack) => {
      const { roomId, messageId, content } = data || {};

      if (!roomId || !messageId) {
        ack?.({ success: false, message: "缺少必要參數" });
        return;
      }

      if (!content || !String(content).trim()) {
        ack?.({ success: false, message: "消息內容不能為空" });
        return;
      }

      try {
        const existingMessage = await prisma.message.findUnique({
          where: { id: messageId },
        });

        if (!existingMessage || existingMessage.roomId !== roomId) {
          ack?.({ success: false, message: "消息不存在" });
          return;
        }

        if (existingMessage.userId !== authenticatedUserId) {
          ack?.({ success: false, message: "只能編輯自己的消息" });
          return;
        }

        const updatedMessage = await prisma.message.update({
          where: { id: messageId },
          data: { content: String(content).trim() },
          include: {
            user: {
              select: { id: true, username: true, avatar: true },
            },
          },
        });

        const event = {
          id: updatedMessage.id,
          seq: updatedMessage.id,
          roomId,
          content: updatedMessage.content,
          userId: updatedMessage.user.id,
          username: updatedMessage.user.username,
          avatar: updatedMessage.user.avatar,
          createdAt: updatedMessage.createdAt,
          eventType: "message_updated",
        };

        io.to(`room_${roomId}`).emit("message_updated", event);
        ack?.({ success: true, event });
      } catch (error) {
        logger.error("消息編輯失敗", { error: error.message, roomId, messageId });
        ack?.({ success: false, message: "消息編輯失敗" });
      }
    });

    socket.on("delete_message", async (data, ack) => {
      const { roomId, messageId } = data || {};

      if (!roomId || !messageId) {
        ack?.({ success: false, message: "缺少必要參數" });
        return;
      }

      try {
        const existingMessage = await prisma.message.findUnique({
          where: { id: messageId },
        });

        if (!existingMessage || existingMessage.roomId !== roomId) {
          ack?.({ success: false, message: "消息不存在" });
          return;
        }

        if (existingMessage.userId !== authenticatedUserId) {
          ack?.({ success: false, message: "只能刪除自己的消息" });
          return;
        }

        await prisma.message.delete({
          where: { id: messageId },
        });

        const event = {
          id: messageId,
          seq: messageId,
          roomId,
          deletedBy: authenticatedUserId,
          eventType: "message_deleted",
        };

        io.to(`room_${roomId}`).emit("message_deleted", event);
        ack?.({ success: true, event });
      } catch (error) {
        logger.error("消息刪除失敗", { error: error.message, roomId, messageId });
        ack?.({ success: false, message: "消息刪除失敗" });
      }
    });

    // ==================== 私聊功能 ====================

    // 加入私聊對話
    socket.on("join_private_chat", async (data) => {
      const { friendId, lastSeq } = data || {};
      const friendIdNum = Number(friendId);
      if (!Number.isInteger(friendIdNum) || friendIdNum <= 0) {
        socket.emit("error", { message: "friendId 不可為空或格式錯誤" });
        return;
      }

      const isFriend = await prisma.friend.findFirst({
        where: {
          OR: [
            { userId1: authenticatedUserId, userId2: friendIdNum },
            { userId1: friendIdNum, userId2: authenticatedUserId },
          ],
        },
      });

      if (!isFriend) {
        socket.emit("error", { message: "該用戶不是你的好友" });
        return;
      }

      const conversationId = buildPrivateConversationId(authenticatedUserId, friendIdNum);
      socket.join(conversationId);

      // 私聊採用同樣機制：用 lastSeq 補漏，再接回即時事件流。
      const parsedLastSeq = Number(lastSeq);
      if (Number.isInteger(parsedLastSeq) && parsedLastSeq > 0) {
        let replayCursor = parsedLastSeq;
        let replayBatchCount = 0;

        while (true) {
          const missedMessages = await prisma.privateMessage.findMany({
            where: {
              OR: [
                {
                  senderId: authenticatedUserId,
                  receiverId: friendIdNum,
                },
                {
                  senderId: friendIdNum,
                  receiverId: authenticatedUserId,
                },
              ],
              id: { gt: replayCursor },
            },
            include: {
              sender: {
                select: { id: true, username: true, avatar: true },
              },
              receiver: {
                select: { id: true, username: true, avatar: true },
              },
              replyToMessage: {
                select: {
                  id: true,
                  content: true,
                  imageUrl: true,
                  sender: {
                    select: { id: true, username: true },
                  },
                },
              },
            },
            orderBy: { id: "asc" },
            take: REPLAY_CHUNK_SIZE,
          });

          if (missedMessages.length === 0) {
            break;
          }

          socket.emit(
            "private_missed_messages",
            missedMessages.map((message) => formatPrivateMessageEvent(message))
          );

          replayBatchCount += 1;
          replayCursor = missedMessages[missedMessages.length - 1].id;

          if (missedMessages.length < REPLAY_CHUNK_SIZE) {
            break;
          }
        }

        if (replayBatchCount > 1) {
          logger.info("私聊補漏分批完成", {
            userId: authenticatedUserId,
            friendId: friendIdNum,
            lastSeq: parsedLastSeq,
            batches: replayBatchCount,
            chunkSize: REPLAY_CHUNK_SIZE,
          });
        }
      }

      logger.info(`用戶加入私聊`, { userId: authenticatedUserId, friendId: friendIdNum });
    });

    socket.on("leave_private_chat", (data) => {
      const { friendId } = data || {};
      if (!friendId) return;
      const conversationId = buildPrivateConversationId(authenticatedUserId, friendId);
      socket.leave(conversationId);
    });

    // 發送私聊消息
    socket.on("send_private_message", async (data, ack) => {
      const { friendId, content, imageUrl, replyToMessageId } = data || {};

      if ((!content || !String(content).trim()) && !imageUrl) {
        if (ack) {
          ack({ success: false, message: "消息內容和圖片不能同時為空" });
        } else {
          socket.emit("error", { message: "消息內容和圖片不能同時為空" });
        }
        return;
      }

      try {
        let parsedReplyToMessageId = null;
        if (replyToMessageId !== undefined && replyToMessageId !== null && replyToMessageId !== "") {
          parsedReplyToMessageId = Number(replyToMessageId);
          if (!Number.isInteger(parsedReplyToMessageId) || parsedReplyToMessageId <= 0) {
            ack?.({ success: false, message: "回覆目標無效" });
            return;
          }
        }

        // 驗證好友關係
        const friendIdNum = Number(friendId);
        const isFriend = await prisma.friend.findFirst({
          where: {
            OR: [
              { userId1: authenticatedUserId, userId2: friendIdNum },
              { userId1: friendIdNum, userId2: authenticatedUserId },
            ],
          },
        });

        if (!isFriend) {
          if (ack) {
            ack({ success: false, message: "該用戶不是你的好友" });
          } else {
            socket.emit("error", { message: "該用戶不是你的好友" });
          }
          return;
        }

        if (parsedReplyToMessageId) {
          const repliedMessage = await prisma.privateMessage.findUnique({
            where: { id: parsedReplyToMessageId },
            select: { id: true, senderId: true, receiverId: true },
          });

          const isSameConversation = repliedMessage && (
            (repliedMessage.senderId === authenticatedUserId && repliedMessage.receiverId === friendIdNum) ||
            (repliedMessage.senderId === friendIdNum && repliedMessage.receiverId === authenticatedUserId)
          );

          if (!isSameConversation) {
            ack?.({ success: false, message: "被回覆消息不屬於此對話" });
            return;
          }
        }

        // 保存到資料庫
        const message = await prisma.privateMessage.create({
          data: {
            content: content ? String(content).trim() : "",
            imageUrl: imageUrl || null,
            senderId: authenticatedUserId,
            receiverId: friendIdNum,
            isRead: false,
            replyToMessageId: parsedReplyToMessageId,
          },
          include: {
            sender: {
              select: { id: true, username: true, avatar: true },
            },
            receiver: {
              select: { id: true, username: true, avatar: true },
            },
            replyToMessage: {
              select: {
                id: true,
                content: true,
                imageUrl: true,
                sender: {
                  select: { id: true, username: true },
                },
              },
            },
          },
        });

        // 構建對話ID
        const conversationId = buildPrivateConversationId(authenticatedUserId, friendIdNum);

        const event = formatPrivateMessageEvent(message);

        // 廣播到該對話的所有客戶端
        io.to(conversationId).emit("receive_private_message", event);

        if (ack) {
          ack({ success: true, event });
        }

        // 如果接收者線上，標記為已讀
        const receiverSocketId = userConnections.get(friendIdNum);
        if (receiverSocketId) {
          const receiverSocket = io.sockets.sockets.get(receiverSocketId);
          if (receiverSocket) {
            // 發送通知給接收者（私聊列表更新）
            receiverSocket.emit("private_message_received", {
              senderId: authenticatedUserId,
              senderName: message.sender.username,
              senderAvatar: message.sender.avatar,
              content: content ? String(content).substring(0, 50) : "", // 預覽
              messageId: message.id,
            });
          }
        }

        logger.info(`新私聊消息`, { senderId: authenticatedUserId, receiverId: friendId, content: content?.substring(0, 100) });
      } catch (error) {
        logger.error("私聊保存失敗", { error: error.message, senderId: authenticatedUserId, receiverId: friendId });
        if (ack) {
          ack({ success: false, message: "訊息發送失敗" });
        } else {
          socket.emit("error", { message: "訊息發送失敗" });
        }
      }
    });

    socket.on("update_private_message", async (data, ack) => {
      const { friendId, messageId, content } = data || {};

      if (!friendId || !messageId) {
        ack?.({ success: false, message: "缺少必要參數" });
        return;
      }

      if (!content || !String(content).trim()) {
        ack?.({ success: false, message: "消息內容不能為空" });
        return;
      }

      try {
        const existingMessage = await prisma.privateMessage.findUnique({
          where: { id: messageId },
        });

        if (!existingMessage) {
          ack?.({ success: false, message: "消息不存在" });
          return;
        }

        const friendIdNum = Number(friendId);
        const isSameConversation =
          (existingMessage.senderId === authenticatedUserId &&
            existingMessage.receiverId === friendIdNum) ||
          (existingMessage.senderId === friendIdNum &&
            existingMessage.receiverId === authenticatedUserId);

        if (!isSameConversation) {
          ack?.({ success: false, message: "消息不屬於此對話" });
          return;
        }

        if (existingMessage.senderId !== authenticatedUserId) {
          ack?.({ success: false, message: "只能編輯自己發送的消息" });
          return;
        }

        const updatedMessage = await prisma.privateMessage.update({
          where: { id: messageId },
          data: { content: String(content).trim() },
          include: {
            sender: {
              select: { id: true, username: true, avatar: true },
            },
            receiver: {
              select: { id: true, username: true, avatar: true },
            },
          },
        });

        const conversationId = buildPrivateConversationId(authenticatedUserId, friendIdNum);
        const event = {
          id: updatedMessage.id,
          seq: updatedMessage.id,
          content: updatedMessage.content,
          senderId: updatedMessage.sender.id,
          senderName: updatedMessage.sender.username,
          senderAvatar: updatedMessage.sender.avatar,
          receiverId: updatedMessage.receiver.id,
          isRead: updatedMessage.isRead,
          createdAt: updatedMessage.createdAt,
          eventType: "private_message_updated",
        };

        io.to(conversationId).emit("private_message_updated", event);
        ack?.({ success: true, event });
      } catch (error) {
        logger.error("私聊消息編輯失敗", { error: error.message, messageId });
        ack?.({ success: false, message: "私聊消息編輯失敗" });
      }
    });

    socket.on("delete_private_message", async (data, ack) => {
      const { friendId, messageId } = data || {};

      if (!friendId || !messageId) {
        ack?.({ success: false, message: "缺少必要參數" });
        return;
      }

      try {
        const existingMessage = await prisma.privateMessage.findUnique({
          where: { id: messageId },
        });

        if (!existingMessage) {
          ack?.({ success: false, message: "消息不存在" });
          return;
        }

        const friendIdNum = Number(friendId);
        const isSameConversation =
          (existingMessage.senderId === authenticatedUserId &&
            existingMessage.receiverId === friendIdNum) ||
          (existingMessage.senderId === friendIdNum &&
            existingMessage.receiverId === authenticatedUserId);

        if (!isSameConversation) {
          ack?.({ success: false, message: "消息不屬於此對話" });
          return;
        }

        if (existingMessage.senderId !== authenticatedUserId) {
          ack?.({ success: false, message: "只能刪除自己發送的消息" });
          return;
        }

        await prisma.privateMessage.delete({
          where: { id: messageId },
        });

        const conversationId = buildPrivateConversationId(authenticatedUserId, friendIdNum);
        const event = {
          id: messageId,
          seq: messageId,
          senderId: existingMessage.senderId,
          receiverId: existingMessage.receiverId,
          deletedBy: authenticatedUserId,
          eventType: "private_message_deleted",
        };

        io.to(conversationId).emit("private_message_deleted", event);
        ack?.({ success: true, event });
      } catch (error) {
        logger.error("私聊消息刪除失敗", { error: error.message, messageId });
        ack?.({ success: false, message: "私聊消息刪除失敗" });
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
          logger.info(`用戶連接已移除`, { userId });
          break;
        }
      }

      logger.info(`使用者斷開連接`, { socketId: socket.id });
    });
  });
};
