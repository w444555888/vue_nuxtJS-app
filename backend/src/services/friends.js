import prisma from "../prisma.js";

const createError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

export const getFriendList = async (userId) => {
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

  return friends.map((friend) => {
    const friendData = friend.userId1 === userId ? friend.user2 : friend.user1;
    return {
      id: friendData.id,
      username: friendData.username,
      email: friendData.email,
      avatar: friendData.avatar,
    };
  });
};

export const sendFriendRequest = async (senderId, receiverEmail) => {
  const receiver = await prisma.user.findUnique({
    where: { email: receiverEmail },
  });

  if (!receiver) {
    throw createError("用戶不存在", 404);
  }

  if (receiver.id === senderId) {
    throw createError("不能添加自己為好友", 400);
  }

  const existingFriend = await prisma.friend.findFirst({
    where: {
      OR: [
        { userId1: senderId, userId2: receiver.id },
        { userId1: receiver.id, userId2: senderId },
      ],
    },
  });

  if (existingFriend) {
    throw createError("已經是好友", 400);
  }

  const existingRequest = await prisma.friendRequest.findFirst({
    where: {
      senderId,
      receiverId: receiver.id,
      status: "pending",
    },
  });

  if (existingRequest) {
    throw createError("好友請求已發送，請勿重複發送", 400);
  }

  return prisma.friendRequest.create({
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
};

export const getPendingRequests = async (userId) => {
  return prisma.friendRequest.findMany({
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
};

export const acceptFriendRequest = async (userId, requestId) => {
  const friendRequest = await prisma.friendRequest.findUnique({
    where: { id: requestId },
  });

  if (!friendRequest) {
    throw createError("請求不存在", 404);
  }

  if (friendRequest.receiverId !== userId) {
    throw createError("無權限操作此請求", 403);
  }

  await prisma.friendRequest.update({
    where: { id: requestId },
    data: { status: "accepted" },
  });

  const userId1 = Math.min(friendRequest.senderId, userId);
  const userId2 = Math.max(friendRequest.senderId, userId);

  return prisma.friend.create({
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
};

export const rejectFriendRequest = async (userId, requestId) => {
  const friendRequest = await prisma.friendRequest.findUnique({
    where: { id: requestId },
  });

  if (!friendRequest) {
    throw createError("請求不存在", 404);
  }

  if (friendRequest.receiverId !== userId) {
    throw createError("無權限操作此請求", 403);
  }

  return prisma.friendRequest.update({
    where: { id: requestId },
    data: { status: "rejected" },
  });
};

export const removeFriend = async (userId, friendId) => {
  const friend = await prisma.friend.findFirst({
    where: {
      OR: [
        { userId1: userId, userId2: friendId },
        { userId1: friendId, userId2: userId },
      ],
    },
  });

  if (!friend) {
    throw createError("好友關係不存在", 404);
  }

  return prisma.friend.delete({
    where: { id: friend.id },
  });
};
