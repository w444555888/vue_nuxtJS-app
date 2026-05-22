import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { successResponse, errorResponse } from "../utils/responseHandler.js";
import {
  getUserRooms,
  createRoom,
  deleteRoom,
  updateRoom,
  inviteFriendsToRoom,
  sendRoomMessage,
  getRoomMessages,
  updateRoomMessage,
  deleteRoomMessage,
  getPrivateConversations,
  getPrivateMessages,
  sendPrivateMessage,
  markPrivateMessagesRead,
} from "../services/chat.js";

const router = express.Router();

router.get("/rooms", verifyToken, async (req, res) => {
  try {
    const rooms = await getUserRooms(req.user.id);
    return successResponse(res, rooms, "獲取聊天室列表成功", 200);
  } catch (error) {
    console.error("獲取聊天室失敗:", error);
    return errorResponse(res, error, error.status || 500);
  }
});

router.post("/rooms", verifyToken, async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    return errorResponse(res, "聘天室名稱不能為空", 400);
  }

  try {
    const room = await createRoom(req.user.id, name, description);
    return successResponse(res, room, "聊天室創建成功", 201);
  } catch (error) {
    console.error("創建聊天室失敗:", error);
    return errorResponse(res, error, error.status || 500);
  }
});

router.delete("/rooms/:roomId", verifyToken, async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId, 10);
    const deletedRoom = await deleteRoom(req.user.id, roomId);
    return successResponse(res, deletedRoom, "聊天室已刪除", 200);
  } catch (error) {
    console.error("刪除聊天室失敗:", error);
    return errorResponse(res, error, error.status || 500);
  }
});

router.patch("/rooms/:roomId", verifyToken, async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId, 10);
    const { name, description } = req.body;
    const updatedRoom = await updateRoom(req.user.id, roomId, name, description);
    return successResponse(res, updatedRoom, "聊天室已更新", 200);
  } catch (error) {
    console.error("編輯聊天室失敗:", error);
    return errorResponse(res, error, error.status || 500);
  }
});

router.post("/rooms/:roomId/invite", verifyToken, async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId, 10);
    const { friendIds } = req.body;

    if (!friendIds || !Array.isArray(friendIds) || friendIds.length === 0) {
      return errorResponse(res, "請提供至少一個好友 ID", 400);
    }

    const invitedMembers = await inviteFriendsToRoom(roomId, friendIds);

    return successResponse(
      res,
      invitedMembers,
      `已邀請 ${invitedMembers.length} 個好友加入聊天室`,
      200
    );
  } catch (error) {
    console.error("邀請好友失敗:", error);
    return errorResponse(res, error, error.status || 500);
  }
});

router.post("/rooms/:roomId/messages", verifyToken, async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId, 10);
    const { content } = req.body;
    const message = await sendRoomMessage(req.user.id, roomId, content);
    return successResponse(res, message, "消息已發送", 201);
  } catch (error) {
    console.error("發送消息失敗:", error);
    return errorResponse(res, error, error.status || 500);
  }
});

router.get("/rooms/:roomId/messages", verifyToken, async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId, 10);
    const messages = await getRoomMessages(roomId);
    return successResponse(res, messages, "獲取消息成功", 200);
  } catch (error) {
    console.error("獲取消息失敗:", error);
    return errorResponse(res, error, error.status || 500);
  }
});

router.patch("/rooms/:roomId/messages/:messageId", verifyToken, async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId, 10);
    const messageId = parseInt(req.params.messageId, 10);
    const { content } = req.body;
    const updatedMessage = await updateRoomMessage(req.user.id, roomId, messageId, content);
    return successResponse(res, updatedMessage, "消息已更新", 200);
  } catch (error) {
    console.error("編輯消息失敗:", error);
    return errorResponse(res, error, error.status || 500);
  }
});

router.delete("/rooms/:roomId/messages/:messageId", verifyToken, async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId, 10);
    const messageId = parseInt(req.params.messageId, 10);
    const deletedMessage = await deleteRoomMessage(req.user.id, roomId, messageId);
    return successResponse(res, deletedMessage, "消息已刪除", 200);
  } catch (error) {
    console.error("刪除消息失敗:", error);
    return errorResponse(res, error, error.status || 500);
  }
});

router.get("/private-conversations", verifyToken, async (req, res) => {
  try {
    const conversations = await getPrivateConversations(req.user.id);
    return successResponse(res, conversations, "獲取私聊對話列表成功", 200);
  } catch (error) {
    console.error("獲取私聊對話失敗:", error);
    return errorResponse(res, error, error.status || 500);
  }
});

router.get("/private/:friendId", verifyToken, async (req, res) => {
  try {
    const friendId = parseInt(req.params.friendId, 10);
    const data = await getPrivateMessages(req.user.id, friendId);
    return successResponse(res, data, "獲取私聊消息成功", 200);
  } catch (error) {
    console.error("獲取私聊消息失敗:", error);
    return errorResponse(res, error, error.status || 500);
  }
});

router.post("/private/:friendId/messages", verifyToken, async (req, res) => {
  try {
    const friendId = parseInt(req.params.friendId, 10);
    const { content } = req.body;
    const message = await sendPrivateMessage(req.user.id, friendId, content);
    return successResponse(res, message, "消息已發送", 201);
  } catch (error) {
    console.error("發送私聊失敗:", error);
    return errorResponse(res, error, error.status || 500);
  }
});

router.patch("/private/:friendId/mark-read", verifyToken, async (req, res) => {
  try {
    const friendId = parseInt(req.params.friendId, 10);
    const result = await markPrivateMessagesRead(req.user.id, friendId);
    return successResponse(res, result, "消息已標記為已讀", 200);
  } catch (error) {
    console.error("標記已讀失敗:", error);
    return errorResponse(res, error, error.status || 500);
  }
});

export default router;
