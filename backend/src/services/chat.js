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
  const friends = await prisma.user.findMany({
    where: {
      id: { in: normalizedFriendIds },
    },
  });

  if (friends.length !== normalizedFriendIds.length) {
    throw createError("部分好友不存在", 404);
  }

  const invitedMembers = [];

  for (const friendId of normalizedFriendIds) {
    try {
      const member = await prisma.chatRoomMember.create({
        data: {
          roomId,
          userId: friendId,
        },
        include: {
          user: {
            select: { id: true, username: true, avatar: true },
          },
        },
      });
      invitedMembers.push(member);
    } catch (error) {
      if (error.code !== "P2002") {
        throw error;
      }
    }
  }

  return invitedMembers;
};

export const sendRoomMessage = async (userId, roomId, content) => {
  if (!content || !content.trim()) {
    throw createError("消息內容不能為空", 400);
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
      content: content.trim(),
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
      return;
    }

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

export const sendPrivateMessage = async (userId, friendId, content) => {
  if (!content || !content.trim()) {
    throw createError("消息內容不能為空", 400);
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
      content: content.trim(),
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
