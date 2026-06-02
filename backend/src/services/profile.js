import bcrypt from "bcryptjs";
import prisma from "../prisma.js";

const createError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

export const getMyProfile = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      avatar: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw createError("用戶不存在", 404);
  }

  return user;
};

export const updateMyProfile = async (userId, payload) => {
  const { username, email, avatar, password, newPassword } = payload;

  if (username !== undefined) {
    throw createError("使用者名不可修改", 400);
  }

  if (!email && !avatar && !newPassword) {
    throw createError("至少需要更新一個字段", 400);
  }

  const updateData = {};
  let existingEmail = null;

  if (email) {
    existingEmail = await prisma.user.findUnique({ 
      where: { email },
      select: { id: true }
    });
  }

  if (existingEmail && existingEmail.id !== userId) {
    throw createError("郵箱已被使用", 400);
  }

  if (email) updateData.email = email;
  if (avatar) updateData.avatar = avatar;

  if (newPassword) {
    if (!password) {
      throw createError("更新密碼需要提供舊密碼", 400);
    }

    const user = await prisma.user.findUnique({ 
      where: { id: userId },
      select: { password: true }
    });
    
    if (!user) {
      throw createError("用戶不存在", 404);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw createError("舊密碼不正確", 401);
    }

    if (newPassword.length < 6) {
      throw createError("新密碼至少需要 6 位", 400);
    }

    updateData.password = await bcrypt.hash(newPassword, 10);
  }

  return prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      username: true,
      email: true,
      avatar: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};
