import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { successResponse, errorResponse } from "../utils/responseHandler.js";
import logger from "../utils/logger.js";
import upload from "../middleware/upload.js";
import {
  getUserRooms,
  createRoom,
  deleteRoom,
  updateRoom,
  inviteFriendsToRoom,
  getPendingRoomInvites,
  acceptRoomInvite,
  rejectRoomInvite,
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
  handleMediaUpload,
} from "../services/chat.js";

const router = express.Router();

router.get("/rooms", verifyToken, async (req, res) => {
  try {
    const rooms = await getUserRooms(req.user.id);
    return successResponse(res, rooms, "獲取聊天室列表成功", 200);
  } catch (error) {
    logger.error("獲取聊天室失敗", { error: error.message, stack: error.stack });
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
    logger.error("創建聊天室失敗", { error: error.message, stack: error.stack });
    return errorResponse(res, error, error.status || 500);
  }
});

router.delete("/rooms/:roomId", verifyToken, async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId, 10);
    const deletedRoom = await deleteRoom(req.user.id, roomId);
    return successResponse(res, deletedRoom, "聊天室已刪除", 200);
  } catch (error) {
    logger.error("刪除聊天室失敗", { error: error.message, stack: error.stack });
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
    logger.error("編輯聊天室失敗", { error: error.message, stack: error.stack });
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

    const invites = await inviteFriendsToRoom(req.user.id, roomId, friendIds);

    const io = req.app.get("io");
    if (io && invites.length > 0) {
      invites.forEach((invite) => {
        io.to(`user_${invite.inviteeId}`).emit("room_invite_received", {
          inviteId: invite.id,
          roomId: invite.roomId,
          roomName: invite.room?.name,
          inviter: invite.inviter,
          timestamp: Date.now(),
        });
      });
    }

    return successResponse(
      res,
      invites,
      `已發送 ${invites.length} 個群組邀請`,
      200
    );
  } catch (error) {
    logger.error("邀請好友失敗", { error: error.message, stack: error.stack });
    return errorResponse(res, error, error.status || 500);
  }
});

router.get("/rooms/invites/pending", verifyToken, async (req, res) => {
  try {
    const invites = await getPendingRoomInvites(req.user.id);
    return successResponse(res, invites, "獲取待處理群組邀請成功", 200);
  } catch (error) {
    logger.error("獲取群組邀請失敗", { error: error.message, stack: error.stack });
    return errorResponse(res, error, error.status || 500);
  }
});

router.post("/rooms/invites/:inviteId/accept", verifyToken, async (req, res) => {
  try {
    const inviteId = parseInt(req.params.inviteId, 10);
    const invite = await acceptRoomInvite(req.user.id, inviteId);

    const io = req.app.get("io");
    if (io) {
      io.to(`user_${req.user.id}`).emit("room_membership_changed", {
        roomId: invite.roomId,
        reason: "room_invite_accepted",
        invitedBy: invite.inviterId,
        timestamp: Date.now(),
      });

      io.to(`room_${invite.roomId}`).emit("room_membership_changed", {
        roomId: invite.roomId,
        reason: "room_member_joined",
        joinedUserId: req.user.id,
        timestamp: Date.now(),
      });

      io.to(`user_${invite.inviterId}`).emit("room_invite_status_changed", {
        inviteId: invite.id,
        roomId: invite.roomId,
        inviteeId: req.user.id,
        status: "accepted",
        timestamp: Date.now(),
      });
    }

    return successResponse(res, invite, "已同意群組邀請並加入群組", 200);
  } catch (error) {
    logger.error("同意群組邀請失敗", { error: error.message, stack: error.stack });
    return errorResponse(res, error, error.status || 500);
  }
});

router.post("/rooms/invites/:inviteId/reject", verifyToken, async (req, res) => {
  try {
    const inviteId = parseInt(req.params.inviteId, 10);
    const invite = await rejectRoomInvite(req.user.id, inviteId);

    const io = req.app.get("io");
    if (io) {
      io.to(`user_${invite.inviterId}`).emit("room_invite_status_changed", {
        inviteId: invite.id,
        roomId: invite.roomId,
        inviteeId: req.user.id,
        status: "rejected",
        timestamp: Date.now(),
      });
    }

    return successResponse(res, invite, "已拒絕群組邀請", 200);
  } catch (error) {
    logger.error("拒絕群組邀請失敗", { error: error.message, stack: error.stack });
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
    logger.error("發送消息失敗", { error: error.message, stack: error.stack });
    return errorResponse(res, error, error.status || 500);
  }
});

router.get("/rooms/:roomId/messages", verifyToken, async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId, 10);
    const messages = await getRoomMessages(roomId);
    return successResponse(res, messages, "獲取消息成功", 200);
  } catch (error) {
    logger.error("獲取消息失敗", { error: error.message, stack: error.stack });
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
    logger.error("編輯消息失敗", { error: error.message, stack: error.stack });
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
    logger.error("刪除消息失敗", { error: error.message, stack: error.stack });
    return errorResponse(res, error, error.status || 500);
  }
});

router.get("/private-conversations", verifyToken, async (req, res) => {
  try {
    const conversations = await getPrivateConversations(req.user.id);
    return successResponse(res, conversations, "獲取私聊對話列表成功", 200);
  } catch (error) {
    logger.error("獲取私聊對話失敗", { error: error.message, stack: error.stack });
    return errorResponse(res, error, error.status || 500);
  }
});

router.get("/private/:friendId", verifyToken, async (req, res) => {
  try {
    const friendId = parseInt(req.params.friendId, 10);
    const data = await getPrivateMessages(req.user.id, friendId);
    return successResponse(res, data, "獲取私聊消息成功", 200);
  } catch (error) {
    logger.error("獲取私聊消息失敗", { error: error.message, stack: error.stack });
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
    logger.error("發送私聊失敗", { error: error.message, stack: error.stack });
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
    logger.error("編輯私聊消息失敗", { error: error.message, stack: error.stack });
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
    logger.error("刪除私聊消息失敗", { error: error.message, stack: error.stack });
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
    logger.error("標記已讀失敗", { error: error.message, stack: error.stack });
    return errorResponse(res, error, error.status || 500);
  }
});


// 圖片統一上傳接口 - 支持直傳和分片上傳
router.post("/upload", verifyToken, upload.single("file"), async (req, res) => {
  try {
    const { uploadId, chunkIndex, totalChunks, fileName } = req.body;

    const result = await handleMediaUpload(
      req.user.id,
      { uploadId, chunkIndex, totalChunks, fileName },
      req.file?.buffer
    );

    return successResponse(res, result.data, result.message, 200);
  } catch (error) {
    logger.error("上傳失敗", { error: error.message, stack: error.stack });
    return errorResponse(res, error.message || "媒體上傳失敗", error.status || 500);
  }
});

export default router;
