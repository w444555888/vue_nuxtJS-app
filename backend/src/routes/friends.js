const express = require("express");
const prisma = require("../prisma");
const { verifyToken } = require("../middleware/auth");
const { successResponse, errorResponse } = require("../utils/responseHandler");

const router = express.Router();

// 獲取當前用戶的好友列表
router.get("/list", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const friends = await prisma.friend.findMany({
      where: {
        OR: [{ userId1: userId }, { userId2: userId }],
      },
      include: {
        user1: {
          select: { id: true, username: true, email: true, avatar: true },
        },
        user2: {
          select: { id: true, username: true, email: true, avatar: true },
        },
      },
    });

    // 格式化返回的好友列表
    const friendList = friends.map((f) => {
      const friendData = f.userId1 === userId ? f.user2 : f.user1;
      return {
        id: friendData.id,
        username: friendData.username,
        email: friendData.email,
        avatar: friendData.avatar,
      };
    });

    return successResponse(res, friendList, "獲取好友列表成功", 200);
  } catch (error) {
    console.error("❌ 獲取好友列表失敗:", error);
    return errorResponse(res, error, 500);
  }
});

// 發送好友請求
router.post("/request/send", verifyToken, async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiverEmail } = req.body;

    if (!receiverEmail) {
      return errorResponse(res, "收件人郵箱不能為空", 400);
    }

    // 查找接收者
    const receiver = await prisma.user.findUnique({
      where: { email: receiverEmail },
    });

    if (!receiver) {
      return errorResponse(res, "用戶不存在", 404);
    }

    if (receiver.id === senderId) {
      return errorResponse(res, "不能添加自己為好友", 400);
    }

    // 檢查是否已經是好友
    const existingFriend = await prisma.friend.findFirst({
      where: {
        OR: [
          { userId1: senderId, userId2: receiver.id },
          { userId1: receiver.id, userId2: senderId },
        ],
      },
    });

    if (existingFriend) {
      return errorResponse(res, "已經是好友", 400);
    }

    // 檢查是否已有待處理的請求
    const existingRequest = await prisma.friendRequest.findFirst({
      where: {
        senderId: senderId,
        receiverId: receiver.id,
        status: "pending",
      },
    });

    if (existingRequest) {
      return errorResponse(res, "好友請求已發送，請勿重複發送", 400);
    }

    // 創建好友請求
    const friendRequest = await prisma.friendRequest.create({
      data: {
        senderId,
        receiverId: receiver.id,
        status: "pending",
      },
      include: {
        sender: {
          select: { id: true, username: true, email: true, avatar: true },
        },
      },
    });

    return successResponse(
      res,
      friendRequest,
      "好友請求已發送",
      200
    );
  } catch (error) {
    console.error("❌ 發送好友請求失敗:", error);
    return errorResponse(res, error, 500);
  }
});

// 獲取待處理的好友請求
router.get("/requests/pending", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const requests = await prisma.friendRequest.findMany({
      where: {
        receiverId: userId,
        status: "pending",
      },
      include: {
        sender: {
          select: { id: true, username: true, email: true, avatar: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return successResponse(res, requests, "獲取待處理請求成功", 200);
  } catch (error) {
    console.error("❌ 獲取待處理請求失敗:", error);
    return errorResponse(res, error, 500);
  }
});

// 接受好友請求
router.post("/request/accept/:requestId", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { requestId } = req.params;

    // 查找請求
    const friendRequest = await prisma.friendRequest.findUnique({
      where: { id: parseInt(requestId) },
    });

    if (!friendRequest) {
      return errorResponse(res, "請求不存在", 404);
    }

    if (friendRequest.receiverId !== userId) {
      return errorResponse(res, "無權限操作此請求", 403);
    }

    // 更新請求狀態
    await prisma.friendRequest.update({
      where: { id: parseInt(requestId) },
      data: { status: "accepted" },
    });

    // 創建好友關係 (確保 userId1 < userId2 保持一致性)
    const userId1 = Math.min(friendRequest.senderId, userId);
    const userId2 = Math.max(friendRequest.senderId, userId);

    const friend = await prisma.friend.create({
      data: {
        userId1,
        userId2,
      },
      include: {
        user1: {
          select: { id: true, username: true, email: true, avatar: true },
        },
        user2: {
          select: { id: true, username: true, email: true, avatar: true },
        },
      },
    });

    return successResponse(res, friend, "好友請求已接受", 200);
  } catch (error) {
    console.error("❌ 接受好友請求失敗:", error);
    return errorResponse(res, error, 500);
  }
});

// 拒絕好友請求
router.post("/request/reject/:requestId", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { requestId } = req.params;

    // 查找請求
    const friendRequest = await prisma.friendRequest.findUnique({
      where: { id: parseInt(requestId) },
    });

    if (!friendRequest) {
      return errorResponse(res, "請求不存在", 404);
    }

    if (friendRequest.receiverId !== userId) {
      return errorResponse(res, "無權限操作此請求", 403);
    }

    // 更新請求狀態
    const updated = await prisma.friendRequest.update({
      where: { id: parseInt(requestId) },
      data: { status: "rejected" },
    });

    return successResponse(res, updated, "好友請求已拒絕", 200);
  } catch (error) {
    console.error("❌ 拒絕好友請求失敗:", error);
    return errorResponse(res, error, 500);
  }
});

// 刪除好友
router.delete("/:friendId", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.params;

    // 查找好友關係
    const friend = await prisma.friend.findFirst({
      where: {
        OR: [
          { userId1: userId, userId2: parseInt(friendId) },
          { userId1: parseInt(friendId), userId2: userId },
        ],
      },
    });

    if (!friend) {
      return errorResponse(res, "好友關係不存在", 404);
    }

    // 刪除好友關係
    const deleted = await prisma.friend.delete({
      where: { id: friend.id },
    });

    return successResponse(res, deleted, "已刪除好友", 200);
  } catch (error) {
    console.error("❌ 刪除好友失敗:", error);
    return errorResponse(res, error, 500);
  }
});

module.exports = router;
