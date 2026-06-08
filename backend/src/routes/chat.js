import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { successResponse, errorResponse } from "../utils/responseHandler.js";
import { uploadImageBuffer } from "../utils/cloudinary.js";
import upload from "../middleware/upload.js";
import { saveChunk, mergeChunks, cleanupChunks } from "../utils/chunkUpload.js";
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
  updatePrivateMessage,
  deletePrivateMessage,
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
    const { content, imageUrl } = req.body;
    const message = await sendRoomMessage(req.user.id, roomId, content, imageUrl);

    const io = req.app.get("io");
    io.to(`room_${roomId}`).emit("receive_message", {
      id: message.id,
      seq: message.id,
      roomId,
      content: message.content,
      imageUrl: message.imageUrl,
      userId: message.user.id,
      username: message.user.username,
      avatar: message.user.avatar,
      createdAt: message.createdAt,
      eventType: "message_created",
    });

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

    const io = req.app.get("io");
    io.to(`room_${roomId}`).emit("message_updated", {
      id: updatedMessage.id,
      seq: updatedMessage.id,
      roomId,
      content: updatedMessage.content,
      userId: updatedMessage.user.id,
      username: updatedMessage.user.username,
      avatar: updatedMessage.user.avatar,
      createdAt: updatedMessage.createdAt,
      eventType: "message_updated",
    });

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

    const io = req.app.get("io");
    io.to(`room_${roomId}`).emit("message_deleted", {
      id: messageId,
      seq: messageId,
      roomId,
      deletedBy: req.user.id,
      eventType: "message_deleted",
    });

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
    const { content, imageUrl } = req.body;
    const message = await sendPrivateMessage(req.user.id, friendId, content, imageUrl);

    const io = req.app.get("io");
    const conversationId = `private_${Math.min(req.user.id, friendId)}_${Math.max(req.user.id, friendId)}`;

    io.to(conversationId).emit("receive_private_message", {
      id: message.id,
      seq: message.id,
      content: message.content,
      imageUrl: message.imageUrl,
      senderId: message.sender.id,
      senderName: message.sender.username,
      senderAvatar: message.sender.avatar,
      receiverId: message.receiver.id,
      isRead: message.isRead,
      createdAt: message.createdAt,
      eventType: "private_message_created",
    });

    return successResponse(res, message, "消息已發送", 201);
  } catch (error) {
    console.error("發送私聊失敗:", error);
    return errorResponse(res, error, error.status || 500);
  }
});

router.patch("/private/:friendId/messages/:messageId", verifyToken, async (req, res) => {
  try {
    const friendId = parseInt(req.params.friendId, 10);
    const messageId = parseInt(req.params.messageId, 10);
    const { content } = req.body;
    const updatedMessage = await updatePrivateMessage(req.user.id, friendId, messageId, content);

    const io = req.app.get("io");
    const conversationId = `private_${Math.min(req.user.id, friendId)}_${Math.max(req.user.id, friendId)}`;
    io.to(conversationId).emit("private_message_updated", {
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
    });

    return successResponse(res, updatedMessage, "私聊消息已更新", 200);
  } catch (error) {
    console.error("編輯私聊消息失敗:", error);
    return errorResponse(res, error, error.status || 500);
  }
});

router.delete("/private/:friendId/messages/:messageId", verifyToken, async (req, res) => {
  try {
    const friendId = parseInt(req.params.friendId, 10);
    const messageId = parseInt(req.params.messageId, 10);
    const deletedMessage = await deletePrivateMessage(req.user.id, friendId, messageId);

    const io = req.app.get("io");
    const conversationId = `private_${Math.min(req.user.id, friendId)}_${Math.max(req.user.id, friendId)}`;
    io.to(conversationId).emit("private_message_deleted", {
      id: messageId,
      seq: messageId,
      senderId: deletedMessage.senderId,
      receiverId: deletedMessage.receiverId,
      deletedBy: req.user.id,
      eventType: "private_message_deleted",
    });

    return successResponse(res, deletedMessage, "私聊消息已刪除", 200);
  } catch (error) {
    console.error("刪除私聊消息失敗:", error);
    return errorResponse(res, error, error.status || 500);
  }
});

router.patch("/private/:friendId/mark-read", verifyToken, async (req, res) => {
  try {
    const friendId = parseInt(req.params.friendId, 10);
    const result = await markPrivateMessagesRead(req.user.id, friendId);

    const io = req.app.get("io");
    const conversationId = `private_${Math.min(req.user.id, friendId)}_${Math.max(req.user.id, friendId)}`;
    io.to(conversationId).emit("private_messages_read", {
      userId: friendId,
      friendId: req.user.id,
    });

    return successResponse(res, result, "消息已標記為已讀", 200);
  } catch (error) {
    console.error("標記已讀失敗:", error);
    return errorResponse(res, error, error.status || 500);
  }
});

// 圖片上傳接口
router.post("/upload", verifyToken, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return errorResponse(res, "未選擇媒體文件", 400);
    }

    const uploadResult = await uploadImageBuffer(req.file.buffer, {
      public_id: `chat_${req.user.id}_${Date.now()}`,
      overwrite: false,
    });

    const imageUrl = uploadResult.secure_url;
    return successResponse(res, { imageUrl }, "媒體上傳成功", 200);
  } catch (error) {
    console.error("上傳圖片失敗:", error);
    return errorResponse(res, error.message || "上傳媒體失敗", 500);
  }
});

// 分片上傳接口
router.post("/upload-chunk", verifyToken, upload.single("chunk"), async (req, res) => {
  try {
    const { uploadId, chunkIndex, totalChunks } = req.body;

    if (!uploadId || chunkIndex === undefined || !totalChunks) {
      return errorResponse(res, "缺少必要參數", 400);
    }

    if (!req.file) {
      return errorResponse(res, "未選擇分片文件", 400);
    }

    saveChunk(uploadId, parseInt(chunkIndex, 10), req.file.buffer);

    return successResponse(
      res,
      { uploadId, chunkIndex: parseInt(chunkIndex, 10) },
      "分片上傳成功",
      200
    );
  } catch (error) {
    console.error("分片上傳失敗:", error);
    return errorResponse(res, error.message || "分片上傳失敗", 500);
  }
});

// 合併分片並上傳到 Cloudinary
router.post("/upload-merge", verifyToken, async (req, res) => {
  try {
    const { uploadId, totalChunks, fileName } = req.body;

    if (!uploadId || !totalChunks || !fileName) {
      return errorResponse(res, "缺少必要參數", 400);
    }

    const mergedBuffer = mergeChunks(uploadId, parseInt(totalChunks, 10));

    const uploadResult = await uploadImageBuffer(mergedBuffer, {
      public_id: `chat_${req.user.id}_${uploadId}`,
      overwrite: false,
    });

    // 上傳成功後清理分片
    cleanupChunks(uploadId);

    const mediaUrl = uploadResult.secure_url;
    return successResponse(res, { mediaUrl }, "媒體上傳成功", 200);
  } catch (error) {
    console.error("合併上傳失敗:", error);
    // 清理分片（失敗時也要清）
    try {
      const { uploadId } = req.body || {};
      if (uploadId) cleanupChunks(uploadId);
    } catch (cleanupError) {
      console.error("清理分片失敗:", cleanupError);
    }
    return errorResponse(res, error.message || "媒體合併失敗", 500);
  }
});

export default router;
