import express from "express";
import prisma from "../prisma.js";
import { verifyToken } from "../middleware/auth.js";
import { successResponse, errorResponse } from "../utils/responseHandler.js";

const router = express.Router();

// 獲取所有聊天室（只返回當前用戶參與的）
router.get("/rooms", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id; // 取得當前用戶ID

    // 只查詢當前用戶是成員的聊天室
    const rooms = await prisma.chatRoom.findMany({
      where: {
        members: {
          some: {
            userId: userId, // 關鍵：只返回當前用戶在的房間
          },
        },
      },
      include: {
        creator: {
          select: { id: true, username: true, avatar: true },
        },
        _count: {
          select: { messages: true, members: true },
        },
        members: {
          select: {
            user: {
              select: { id: true, username: true, avatar: true },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc", // 按創建時間倒序
      },
    });

    // 格式化返回的聊天室列表
    const formattedRooms = rooms.map((room) => ({
      id: room.id,
      name: room.name,
      description: room.description,
      creatorId: room.creatorId,
      creator: room.creator,
      memberCount: room._count.members,
      messageCount: room._count.messages,
      members: room.members.map((m) => m.user),
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    }));

    return successResponse(res, formattedRooms, "獲取聊天室列表成功", 200);
  } catch (error) {
    console.error("獲取聊天室失敗:", error);
    return errorResponse(res, error, 500);
  }
});

// 創建聊天室
router.post("/rooms", verifyToken, async (req, res) => {
  const { name, description } = req.body;
  const userId = req.user.id; // 取得當前用戶ID

  if (!name) {
    return errorResponse(res, "聘天室名稱不能為空", 400);
  }

  try {
    // 創建聊天室並同時加入創建者為成員
    const room = await prisma.chatRoom.create({
      data: {
        name,
        description,
        creatorId: userId, // 保存房主ID
        members: {
          create: {
            userId: userId, // 創建者自動加入
          },
        },
      },
      include: {
        creator: {
          select: { id: true, username: true, avatar: true },
        },
        members: {
          select: {
            user: {
              select: { id: true, username: true, avatar: true },
            },
          },
        },
      },
    });

    return successResponse(res, room, "聊天室創建成功", 201);
  } catch (error) {
    console.error("創建聊天室失敗:", error);
    return errorResponse(res, error, 500);
  }
});

// 刪除聊天室
router.delete("/rooms/:roomId", verifyToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    // 驗證聊天室是否存在
    const room = await prisma.chatRoom.findUnique({
      where: { id: parseInt(roomId) },
    });

    if (!room) {
      return errorResponse(res, "聘天室不存在", 404);
    }

    // 檢查是否為房主
    if (room.creatorId !== userId) {
      return errorResponse(res, "只有房主才能刪除群組", 403);
    }

    // 刪除聊天室（級聯刪除相關的成員和消息）
    const deletedRoom = await prisma.chatRoom.delete({
      where: { id: parseInt(roomId) },
    });

    return successResponse(res, deletedRoom, "聊天室已刪除", 200);
  } catch (error) {
    console.error("刪除聊天室失敗:", error);
    return errorResponse(res, error, 500);
  }
});

// 編輯聊天室
router.patch("/rooms/:roomId", verifyToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;
    const { name, description } = req.body;

    // 驗證聊天室是否存在
    const room = await prisma.chatRoom.findUnique({
      where: { id: parseInt(roomId) },
    });

    if (!room) {
      return errorResponse(res, "聘天室不存在", 404);
    }

    // 檢查是否為房主
    if (room.creatorId !== userId) {
      return errorResponse(res, "只有房主才能編輯群組", 403);
    }

    // 更新聊天室
    const updatedRoom = await prisma.chatRoom.update({
      where: { id: parseInt(roomId) },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
      },
      include: {
        creator: {
          select: { id: true, username: true, avatar: true },
        },
        members: {
          select: {
            user: {
              select: { id: true, username: true, avatar: true },
            },
          },
        },
      },
    });

    return successResponse(res, updatedRoom, "聊天室已更新", 200);
  } catch (error) {
    console.error("編輯聊天室失敗:", error);
    return errorResponse(res, error, 500);
  }
});;

// 邀請好友加入聊天室
router.post("/rooms/:roomId/invite", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { roomId } = req.params;
    const { friendIds } = req.body; // 陣列類型：[1, 2, 3]

    if (!friendIds || !Array.isArray(friendIds) || friendIds.length === 0) {
      return errorResponse(res, "請提供至少一個好友 ID", 400);
    }

    // 驗證聊天室是否存在
    const room = await prisma.chatRoom.findUnique({
      where: { id: parseInt(roomId) },
    });

    if (!room) {
      return errorResponse(res, "聘天室不存在", 404);
    }

    // 驗證所有好友是否存在
    const friends = await prisma.user.findMany({
      where: {
        id: { in: friendIds.map((id) => parseInt(id)) },
      },
    });

    if (friends.length !== friendIds.length) {
      return errorResponse(res, "部分好友不存在", 404);
    }

    // 添加好友到聊天室（忽略已存在的成員）
    const invitedMembers = [];

    for (const friendId of friendIds) {
      try {
        const member = await prisma.chatRoomMember.create({
          data: {
            roomId: parseInt(roomId),
            userId: parseInt(friendId),
          },
          include: {
            user: {
              select: { id: true, username: true, avatar: true },
            },
          },
        });
        invitedMembers.push(member);
      } catch (error) {
        // 如果成員已存在，捕捉唯一約束錯誤並繼續
        if (error.code !== "P2002") {
          throw error;
        }
      }
    }

    return successResponse(
      res,
      invitedMembers,
      `已邀請 ${invitedMembers.length} 個好友加入聊天室`,
      200
    );
  } catch (error) {
    console.error("邀請好友失敗:", error);
    return errorResponse(res, error, 500);
  }
});

// 發送聊天消息
router.post("/rooms/:roomId/messages", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { roomId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return errorResponse(res, "消息內容不能為空", 400);
    }

    // 驗證用戶是否在聊天室
    const member = await prisma.chatRoomMember.findUnique({
      where: {
        userId_roomId: {
          userId: userId,
          roomId: parseInt(roomId),
        },
      },
    });

    if (!member) {
      return errorResponse(res, "你不是此聊天室的成員", 403);
    }

    const message = await prisma.message.create({
      data: {
        content: content.trim(),
        userId: userId,
        roomId: parseInt(roomId),
      },
      include: {
        user: {
          select: { id: true, username: true, avatar: true },
        },
      },
    });

    return successResponse(res, message, "消息已發送", 201);
  } catch (error) {
    console.error("發送消息失敗:", error);
    return errorResponse(res, error, 500);
  }
});

// 獲取聊天室的消息
router.get("/rooms/:roomId/messages", verifyToken, async (req, res) => {
  const { roomId } = req.params;

  try {
    const messages = await prisma.message.findMany({
      where: { roomId: parseInt(roomId) },
      include: {
        user: {
          select: { id: true, username: true, avatar: true },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 50, // 獲取最近50條消息
    });

    return successResponse(res, messages, "獲取消息成功", 200);
  } catch (error) {
    console.error("獲取消息失敗:", error);
    return errorResponse(res, error, 500);
  }
});

// 編輯聊天室消息
router.patch("/rooms/:roomId/messages/:messageId", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { roomId, messageId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return errorResponse(res, "消息內容不能為空", 400);
    }

    // 驗證消息是否存在且屬於當前用戶
    const message = await prisma.message.findUnique({
      where: { id: parseInt(messageId) },
    });

    if (!message) {
      return errorResponse(res, "消息不存在", 404);
    }

    if (message.userId !== userId) {
      return errorResponse(res, "只能編輯自己的消息", 403);
    }

    if (message.roomId !== parseInt(roomId)) {
      return errorResponse(res, "消息不在此聊天室", 400);
    }

    // 更新消息
    const updatedMessage = await prisma.message.update({
      where: { id: parseInt(messageId) },
      data: {
        content: content.trim(),
      },
      include: {
        user: {
          select: { id: true, username: true, avatar: true },
        },
      },
    });

    return successResponse(res, updatedMessage, "消息已更新", 200);
  } catch (error) {
    console.error("編輯消息失敗:", error);
    return errorResponse(res, error, 500);
  }
});

// 刪除聊天室消息
router.delete("/rooms/:roomId/messages/:messageId", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { roomId, messageId } = req.params;

    // 驗證消息是否存在且屬於當前用戶
    const message = await prisma.message.findUnique({
      where: { id: parseInt(messageId) },
    });

    if (!message) {
      return errorResponse(res, "消息不存在", 404);
    }

    if (message.userId !== userId) {
      return errorResponse(res, "只能刪除自己的消息", 403);
    }

    if (message.roomId !== parseInt(roomId)) {
      return errorResponse(res, "消息不在此聊天室", 400);
    }

    // 刪除消息
    const deletedMessage = await prisma.message.delete({
      where: { id: parseInt(messageId) },
    });

    return successResponse(res, deletedMessage, "消息已刪除", 200);
  } catch (error) {
    console.error("刪除消息失敗:", error);
    return errorResponse(res, error, 500);
  }
});

// ==================== 私聊功能 ====================

// 獲取所有私聊對話列表
router.get("/private-conversations", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // 獲取所有與該用戶的私聊消息（發送的和接收的）
    const conversations = await prisma.privateMessage.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      include: {
        sender: {
          select: { id: true, username: true, avatar: true, email: true },
        },
        receiver: {
          select: { id: true, username: true, avatar: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // 合併對話，獲得唯一的好友列表和最新消息
    const conversationMap = new Map();

    conversations.forEach((msg) => {
      const friendId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      const friend = msg.senderId === userId ? msg.receiver : msg.sender;
      const key = `conv_${Math.min(userId, friendId)}_${Math.max(userId, friendId)}`;

      if (!conversationMap.has(key)) {
        conversationMap.set(key, {
          friendId,
          friend,
          lastMessage: msg.content,
          lastMessageTime: msg.createdAt,
          unreadCount: msg.senderId !== userId && !msg.isRead ? 1 : 0,
        });
      } else {
        // 累計未讀消息
        const conv = conversationMap.get(key);
        if (msg.senderId !== userId && !msg.isRead) {
          conv.unreadCount += 1;
        }
      }
    });

    const formattedConversations = Array.from(conversationMap.values());

    return successResponse(
      res,
      formattedConversations,
      "獲取私聊對話列表成功",
      200
    );
  } catch (error) {
    console.error("獲取私聊對話失敗:", error);
    return errorResponse(res, error, 500);
  }
});

// 獲取與特定好友的私聊消息記錄
router.get("/private/:friendId", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.params;
    const friendIdInt = parseInt(friendId);

    // 驗證好友是否存在
    const friend = await prisma.user.findUnique({
      where: { id: friendIdInt },
      select: { id: true, username: true, avatar: true, email: true },
    });

    if (!friend) {
      return errorResponse(res, "好友不存在", 404);
    }

    // 獲取與該好友的所有私聊消息
    const messages = await prisma.privateMessage.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: friendIdInt },
          { senderId: friendIdInt, receiverId: userId },
        ],
      },
      include: {
        sender: {
          select: { id: true, username: true, avatar: true },
        },
        receiver: {
          select: { id: true, username: true, avatar: true },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 100, // 獲取最近100條消息
    });

    // 標記所有接收的消息為已讀
    await prisma.privateMessage.updateMany({
      where: {
        senderId: friendIdInt,
        receiverId: userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return successResponse(
      res,
      { friend, messages },
      "獲取私聊消息成功",
      200
    );
  } catch (error) {
    console.error("獲取私聊消息失敗:", error);
    return errorResponse(res, error, 500);
  }
});

// 發送私聊消息
router.post("/private/:friendId/messages", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.params;
    const { content } = req.body;
    const friendIdInt = parseInt(friendId);

    if (!content || !content.trim()) {
      return errorResponse(res, "消息內容不能為空", 400);
    }

    // 驗證好友是否存在且是好友關係
    const isFriend = await prisma.friend.findFirst({
      where: {
        OR: [
          { userId1: userId, userId2: friendIdInt },
          { userId1: friendIdInt, userId2: userId },
        ],
      },
    });

    if (!isFriend) {
      return errorResponse(res, "該用戶不是你的好友", 403);
    }

    // 創建私聊消息
    const message = await prisma.privateMessage.create({
      data: {
        content: content.trim(),
        senderId: userId,
        receiverId: friendIdInt,
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

    return successResponse(res, message, "消息已發送", 201);
  } catch (error) {
    console.error("發送私聊失敗:", error);
    return errorResponse(res, error, 500);
  }
});

// 標記私聊消息為已讀
router.patch("/private/:friendId/mark-read", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.params;
    const friendIdInt = parseInt(friendId);

    // 標記所有來自該好友的未讀消息為已讀
    const result = await prisma.privateMessage.updateMany({
      where: {
        senderId: friendIdInt,
        receiverId: userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return successResponse(
      res,
      result,
      "消息已標記為已讀",
      200
    );
  } catch (error) {
    console.error("標記已讀失敗:", error);
    return errorResponse(res, error, 500);
  }
});

export default router;
