import prisma from "../prisma.js";

const createError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

export const getUserRooms = async (userId) => {
  const rooms = await prisma.chatRoom.findMany({
    where: {
      members: {
        some: {
          userId,
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
      createdAt: "desc",
    },
  });

  return rooms.map((room) => ({
    id: room.id,
    name: room.name,
    description: room.description,
    creatorId: room.creatorId,
    creator: room.creator,
    memberCount: room._count.members,
    messageCount: room._count.messages,
    members: room.members.map((member) => member.user),
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  }));
};

export const createRoom = async (userId, name, description) => {
  return prisma.chatRoom.create({
    data: {
      name,
      description,
      creatorId: userId,
      members: {
        create: {
          userId,
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
};

export const deleteRoom = async (userId, roomId) => {
  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId },
  });

  if (!room) {
    throw createError("聘天室不存在", 404);
  }

  if (room.creatorId !== userId) {
    throw createError("只有房主才能刪除群組", 403);
  }

  return prisma.chatRoom.delete({
    where: { id: roomId },
  });
};

export const updateRoom = async (userId, roomId, name, description) => {
  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId },
  });

  if (!room) {
    throw createError("聘天室不存在", 404);
  }

  if (room.creatorId !== userId) {
    throw createError("只有房主才能編輯群組", 403);
  }

  return prisma.chatRoom.update({
    where: { id: roomId },
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
};

export const inviteFriendsToRoom = async (roomId, friendIds) => {
  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId },
  });

  if (!room) {
    throw createError("聘天室不存在", 404);
  }

  const normalizedFriendIds = friendIds.map((id) => parseInt(id, 10));
  
  // 驗證好友存在 (單個查詢)
  const friends = await prisma.user.findMany({
    where: {
      id: { in: normalizedFriendIds },
    },
    select: { id: true },
  });

  if (friends.length !== normalizedFriendIds.length) {
    throw createError("部分好友不存在", 404);
  }

  // 批量創建成員關係 (優化: 使用 createMany)
  try {
    await prisma.chatRoomMember.createMany({
      data: normalizedFriendIds.map((userId) => ({
        roomId,
        userId,
      })),
      skipDuplicates: true, // 跳過已存在的重複關係
    });
  } catch (error) {
    throw error;
  }

  // 獲取已創建的成員信息
  const invitedMembers = await prisma.chatRoomMember.findMany({
    where: {
      roomId,
      userId: { in: normalizedFriendIds },
    },
    include: {
      user: {
        select: { id: true, username: true, avatar: true },
      },
    },
  });

  return invitedMembers;
};

export const sendRoomMessage = async (userId, roomId, content, imageUrl) => {
  if ((!content || !content.trim()) && !imageUrl) {
    throw createError("消息內容和圖片不能同時為空", 400);
  }

  const member = await prisma.chatRoomMember.findUnique({
    where: {
      userId_roomId: {
        userId,
        roomId,
      },
    },
  });

  if (!member) {
    throw createError("你不是此聊天室的成員", 403);
  }

  return prisma.message.create({
    data: {
      content: content ? content.trim() : "",
      imageUrl: imageUrl || null,
      userId,
      roomId,
    },
    include: {
      user: {
        select: { id: true, username: true, avatar: true },
      },
    },
  });
};

export const getRoomMessages = async (roomId) => {
  return prisma.message.findMany({
    where: { roomId },
    include: {
      user: {
        select: { id: true, username: true, avatar: true },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
};

export const updateRoomMessage = async (userId, roomId, messageId, content) => {
  if (!content || !content.trim()) {
    throw createError("消息內容不能為空", 400);
  }

  const message = await prisma.message.findUnique({
    where: { id: messageId },
  });

  if (!message) {
    throw createError("消息不存在", 404);
  }

  if (message.userId !== userId) {
    throw createError("只能編輯自己的消息", 403);
  }

  if (message.roomId !== roomId) {
    throw createError("消息不在此聊天室", 400);
  }

  return prisma.message.update({
    where: { id: messageId },
    data: {
      content: content.trim(),
    },
    include: {
      user: {
        select: { id: true, username: true, avatar: true },
      },
    },
  });
};

export const deleteRoomMessage = async (userId, roomId, messageId) => {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
  });

  if (!message) {
    throw createError("消息不存在", 404);
  }

  if (message.userId !== userId) {
    throw createError("只能刪除自己的消息", 403);
  }

  if (message.roomId !== roomId) {
    throw createError("消息不在此聊天室", 400);
  }

  return prisma.message.delete({
    where: { id: messageId },
  });
};

export const getPrivateConversations = async (userId) => {
  // 獲取所有對話（按最新消息排序，只取最近一條消息作代表）
  const conversations = await prisma.privateMessage.findMany({
    where: {
      OR: [{ senderId: userId }, { receiverId: userId }],
    },
    select: {
      id: true,
      content: true,
      createdAt: true,
      isRead: true,
      senderId: true,
      receiverId: true,
      sender: {
        select: { id: true, username: true, avatar: true, email: true },
      },
      receiver: {
        select: { id: true, username: true, avatar: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

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
      return; // 只取該對話的最新消息
    }

    // 计算未讀消息數 (只在首次迭代時計算，因為已排序)
    const conv = conversationMap.get(key);
    if (msg.senderId !== userId && !msg.isRead) {
      conv.unreadCount += 1;
    }
  });

  return Array.from(conversationMap.values());
};

export const getPrivateMessages = async (userId, friendId) => {
  const friend = await prisma.user.findUnique({
    where: { id: friendId },
    select: { id: true, username: true, avatar: true, email: true },
  });

  if (!friend) {
    throw createError("好友不存在", 404);
  }

  const messages = await prisma.privateMessage.findMany({
    where: {
      OR: [
        { senderId: userId, receiverId: friendId },
        { senderId: friendId, receiverId: userId },
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
    take: 100,
  });

  await prisma.privateMessage.updateMany({
    where: {
      senderId: friendId,
      receiverId: userId,
      isRead: false,
    },
    data: { isRead: true },
  });

  return { friend, messages };
};

export const sendPrivateMessage = async (userId, friendId, content, imageUrl) => {
  if ((!content || !content.trim()) && !imageUrl) {
    throw createError("消息內容和圖片不能同時為空", 400);
  }

  const isFriend = await prisma.friend.findFirst({
    where: {
      OR: [
        { userId1: userId, userId2: friendId },
        { userId1: friendId, userId2: userId },
      ],
    },
  });

  if (!isFriend) {
    throw createError("該用戶不是你的好友", 403);
  }

  return prisma.privateMessage.create({
    data: {
      content: content ? content.trim() : "",
      imageUrl: imageUrl || null,
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
};

export const updatePrivateMessage = async (userId, friendId, messageId, content) => {
  if (!content || !content.trim()) {
    throw createError("消息內容不能為空", 400);
  }

  const message = await prisma.privateMessage.findUnique({
    where: { id: messageId },
  });

  if (!message) {
    throw createError("消息不存在", 404);
  }

  const friendIdNum = Number(friendId);
  const isSameConversation =
    (message.senderId === userId && message.receiverId === friendIdNum) ||
    (message.senderId === friendIdNum && message.receiverId === userId);

  if (!isSameConversation) {
    throw createError("消息不屬於此對話", 400);
  }

  if (message.senderId !== userId) {
    throw createError("只能編輯自己發送的消息", 403);
  }

  return prisma.privateMessage.update({
    where: { id: messageId },
    data: {
      content: content.trim(),
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
};

export const deletePrivateMessage = async (userId, friendId, messageId) => {
  const message = await prisma.privateMessage.findUnique({
    where: { id: messageId },
  });

  if (!message) {
    throw createError("消息不存在", 404);
  }

  const friendIdNum = Number(friendId);
  const isSameConversation =
    (message.senderId === userId && message.receiverId === friendIdNum) ||
    (message.senderId === friendIdNum && message.receiverId === userId);

  if (!isSameConversation) {
    throw createError("消息不屬於此對話", 400);
  }

  if (message.senderId !== userId) {
    throw createError("只能刪除自己發送的消息", 403);
  }

  return prisma.privateMessage.delete({
    where: { id: messageId },
  });
};

export const markPrivateMessagesRead = async (userId, friendId) => {
  return prisma.privateMessage.updateMany({
    where: {
      senderId: friendId,
      receiverId: userId,
      isRead: false,
    },
    data: { isRead: true },
  });
};

// ==================== 媒體上傳功能 ====================

const MEDIA_UPLOAD_LIMITS = {
  directUploadMaxBytes: 6 * 1024 * 1024,
  chunkUploadMaxBytes: 4 * 1024 * 1024,
  mergedUploadMaxBytes: 50 * 1024 * 1024,
};

/**
 * 統一的媒體上傳處理函數
 * 支持三種模式：分片上傳、合併分片、直接上傳小文件
 */
export const handleMediaUpload = async (
  userId,
  uploadData,
  fileBuffer
) => {
  const { uploadId, chunkIndex, totalChunks, fileName } = uploadData;
  const { saveChunk, mergeChunks, cleanupChunks } = await import("../utils/chunkUpload.js");
  const { uploadImageBuffer } = await import("../utils/cloudinary.js");

  try {
    // ===== 模式 1: 分片上傳 =====
    if (uploadId && chunkIndex !== undefined) {
      if (!fileBuffer) {
        throw createError("未選擇分片文件", 400);
      }

      if (fileBuffer.length > MEDIA_UPLOAD_LIMITS.chunkUploadMaxBytes) {
        throw createError("單個分片不可超過 4MB", 413);
      }

      saveChunk(uploadId, parseInt(chunkIndex, 10), fileBuffer);

      return {
        success: true,
        data: {
          uploadId,
          chunkIndex: parseInt(chunkIndex, 10),
        },
        message: "分片上傳成功",
      };
    }

    // ===== 模式 2: 合併分片 =====
    if (uploadId && totalChunks && chunkIndex === undefined && !fileBuffer) {
      const mergedBuffer = mergeChunks(uploadId, parseInt(totalChunks, 10));

      if (mergedBuffer.length > MEDIA_UPLOAD_LIMITS.mergedUploadMaxBytes) {
        throw createError("媒體檔案不可超過 50MB", 413);
      }

      const uploadResult = await uploadImageBuffer(mergedBuffer, {
        public_id: `chat_${userId}_${uploadId}`,
        overwrite: false,
      });

      // 上傳成功後清理分片
      cleanupChunks(uploadId);

      const mediaUrl = uploadResult.secure_url;
      return {
        success: true,
        data: { mediaUrl },
        message: "媒體上傳成功",
      };
    }

    // ===== 模式 3: 直接上傳小文件 =====
    if (!uploadId && chunkIndex === undefined) {
      if (!fileBuffer) {
        throw createError("未選擇媒體文件", 400);
      }

      if (fileBuffer.length > MEDIA_UPLOAD_LIMITS.directUploadMaxBytes) {
        throw createError("檔案超過 6MB，請改用分片上傳", 413);
      }

      const uploadResult = await uploadImageBuffer(fileBuffer, {
        public_id: `chat_${userId}_${Date.now()}`,
        overwrite: false,
      });

      const mediaUrl = uploadResult.secure_url;
      return {
        success: true,
        data: { mediaUrl },
        message: "媒體上傳成功",
      };
    }

    // 參數不正確
    throw createError("參數不正確", 400);
  } catch (error) {
    // 清理分片（失敗時也要清）
    try {
      if (uploadId) {
        const { cleanupChunks: cleanup } = await import("../utils/chunkUpload.js");
        cleanup(uploadId);
      }
    } catch (cleanupError) {
      console.error("清理分片失敗:", cleanupError);
    }
    throw error;
  }
};
