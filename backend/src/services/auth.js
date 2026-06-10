import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../prisma.js";

const createError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

// 生成 Access Token (15分鐘)
const generateAccessToken = (userId, username) => {
  return jwt.sign(
    { id: userId, username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "15m" }
  );
};

// 生成 Refresh Token (7天) 並存入數據庫
const generateRefreshToken = async (userId) => {
  const refreshToken = jwt.sign(
    { id: userId },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d" }
  );

  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  );

  // 存入數據庫
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId,
      expiresAt,
    },
  });

  return refreshToken;
};

export const registerUser = async ({ email, username, password }) => {
  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });

  if (existingUser) {
    throw createError("用戶已存在", 400);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      username,
      password: hashedPassword,
      avatar: `https://api.dicebear.com/9.x/pixel-art-neutral/svg?scale=50&seed=${username}`,
    },
  });

  const accessToken = generateAccessToken(user.id, user.username);
  const refreshToken = await generateRefreshToken(user.id);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      avatar: user.avatar,
    },
  };
};

export const loginUser = async ({ email, password }) => {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw createError("郵箱或密碼錯誤", 400);
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw createError("郵箱或密碼錯誤", 400);
  }

  const accessToken = generateAccessToken(user.id, user.username);
  const refreshToken = await generateRefreshToken(user.id);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      avatar: user.avatar,
    },
  };
};

export const getCurrentUser = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      avatar: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw createError("使用者不存在", 404);
  }

  return user;
};

export const updateUserAvatar = async (userId, avatar) => {
  return prisma.user.update({
    where: { id: userId },
    data: { avatar },
    select: {
      id: true,
      email: true,
      username: true,
      avatar: true,
      createdAt: true,
    },
  });
};

export const getVerifyResult = (user) => ({
  userId: user.id,
  username: user.username,
});

// 使用 Refresh Token 生成新的 Access Token
export const refreshAccessToken = async (refreshTokenFromClient) => {
  // 驗證 refresh token 簽名和有效性
  let decoded;
  try {
    decoded = jwt.verify(
      refreshTokenFromClient,
      process.env.REFRESH_TOKEN_SECRET
    );
  } catch (error) {
    throw createError("Refresh Token 無效或已過期", 401);
  }

  // 檢查 refresh token 是否在數據庫中存在且未過期
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: refreshTokenFromClient },
  });

  if (!storedToken || storedToken.expiresAt < new Date()) {
    throw createError("Refresh Token 已過期或不存在", 401);
  }

  // 取得用戶信息
  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
  });

  if (!user) {
    throw createError("使用者不存在", 404);
  }

  // 刪除舊的 refresh token (輪換)
  await prisma.refreshToken.delete({
    where: { token: refreshTokenFromClient },
  });

  // 生成新的 access token
  const newAccessToken = generateAccessToken(user.id, user.username);

  // 生成新的 refresh token (7天，輪換機制)
  const newRefreshToken = await generateRefreshToken(user.id);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

// 登出 - 刪除 refresh token
export const logoutUser = async (userId) => {
  // 刪除該用戶的所有 refresh token (強制所有裝置登出)
  await prisma.refreshToken.deleteMany({
    where: { userId },
  });

  return { message: "登出成功" };
};
