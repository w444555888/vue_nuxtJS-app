import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { successResponse, errorResponse } from "../utils/responseHandler.js";
import logger from "../utils/logger.js";
import {
  getFriendList,
  sendFriendRequest,
  getPendingRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
} from "../services/friends.js";

const router = express.Router();

const emitFriendDataChanged = (req, userIds = [], reason = "friend_data_changed") => {
  const io = req.app.get("io");
  if (!io) return;

  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  uniqueUserIds.forEach((userId) => {
    io.to(`user_${userId}`).emit("friend_data_changed", {
      reason,
      userId,
      timestamp: Date.now(),
    });
  });
};

// 獲取當前用戶的好友列表
router.get("/list", verifyToken, async (req, res) => {
  try {
    const friendList = await getFriendList(req.user.id);

    return successResponse(res, friendList, "獲取好友列表成功", 200);
  } catch (error) {
    logger.error("獲取好友列表失敗", { error: error.message, stack: error.stack });
    return errorResponse(res, error, error.status || 500);
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
    const friendRequest = await sendFriendRequest(senderId, receiverEmail);

    emitFriendDataChanged(req, [senderId, friendRequest.receiverId], "friend_request_sent");

    return successResponse(
      res,
      friendRequest,
      "好友請求已發送",
      200
    );
  } catch (error) {
    logger.error("發送好友請求失敗", { error: error.message, stack: error.stack });
    return errorResponse(res, error, error.status || 500);
  }
});

// 獲取待處理的好友請求
router.get("/requests/pending", verifyToken, async (req, res) => {
  try {
    const requests = await getPendingRequests(req.user.id);

    return successResponse(res, requests, "獲取待處理請求成功", 200);
  } catch (error) {
    logger.error("獲取待處理請求失敗", { error: error.message, stack: error.stack });
    return errorResponse(res, error, error.status || 500);
  }
});

// 接受好友請求
router.post("/request/accept/:requestId", verifyToken, async (req, res) => {
  try {
    const { requestId } = req.params;

    const friend = await acceptFriendRequest(req.user.id, parseInt(requestId, 10));
    emitFriendDataChanged(req, [friend.user1?.id, friend.user2?.id], "friend_request_accepted");

    return successResponse(res, friend, "好友請求已接受", 200);
  } catch (error) {
    logger.error("接受好友請求失敗", { error: error.message, stack: error.stack });
    return errorResponse(res, error, error.status || 500);
  }
});

// 拒絕好友請求
router.post("/request/reject/:requestId", verifyToken, async (req, res) => {
  try {
    const { requestId } = req.params;

    const updated = await rejectFriendRequest(req.user.id, parseInt(requestId, 10));
    emitFriendDataChanged(req, [updated.senderId, updated.receiverId], "friend_request_rejected");

    return successResponse(res, updated, "好友請求已拒絕", 200);
  } catch (error) {
    logger.error("拒絕好友請求失敗", { error: error.message, stack: error.stack });
    return errorResponse(res, error, error.status || 500);
  }
});

// 刪除好友
router.delete("/:friendId", verifyToken, async (req, res) => {
  try {
    const { friendId } = req.params;

    const targetFriendId = parseInt(friendId, 10);
    const deleted = await removeFriend(req.user.id, targetFriendId);
    emitFriendDataChanged(req, [req.user.id, targetFriendId], "friend_removed");

    return successResponse(res, deleted, "已刪除好友", 200);
  } catch (error) {
    logger.error("刪除好友失敗", { error: error.message, stack: error.stack });
    return errorResponse(res, error, error.status || 500);
  }
});

export default router;
