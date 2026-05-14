const express = require("express");
const bcrypt = require("bcryptjs");
const prisma = require("../prisma");
const { verifyToken } = require("../middleware/auth");
const { successResponse, errorResponse } = require("../utils/responseHandler");

const router = express.Router();

// 獲取當前用戶的個人資料
router.get("/me", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

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
      return errorResponse(res, "用戶不存在", 404);
    }

    return successResponse(res, user, "獲取個人資料成功", 200);
  } catch (error) {
    console.error("獲取個人資料失敗:", error);
    return errorResponse(res, error, 500);
  }
});

// 更新個人資料
router.patch("/update", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, email, avatar, password, newPassword } = req.body;

    // 驗證必填字段
    if (!username && !email && !avatar && !newPassword) {
      return errorResponse(res, "至少需要更新一個字段", 400);
    }

    // 準備更新數據
    const updateData = {};

    if (username) {
      // 檢查用戶名是否已被使用
      const existingUser = await prisma.user.findUnique({
        where: { username },
      });
      if (existingUser && existingUser.id !== userId) {
        return errorResponse(res, "用戶名已被使用", 400);
      }
      updateData.username = username;
    }

    if (email) {
      // 檢查郵箱是否已被使用
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });
      if (existingUser && existingUser.id !== userId) {
        return errorResponse(res, "郵箱已被使用", 400);
      }
      updateData.email = email;
    }

    if (avatar) {
      updateData.avatar = avatar;
    }

    // 如果要更新密碼，需要驗證舊密碼
    if (newPassword) {
      if (!password) {
        return errorResponse(res, "更新密碼需要提供舊密碼", 400);
      }

      // 獲取當前用戶
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      // 驗證舊密碼
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return errorResponse(res, "舊密碼不正確", 401);
      }

      if (newPassword.length < 6) {
        return errorResponse(res, "新密碼至少需要 6 位", 400);
      }

      // 加密新密碼
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      updateData.password = hashedPassword;
    }

    // 更新用戶
    const updatedUser = await prisma.user.update({
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

    return successResponse(
      res,
      updatedUser,
      "個人資料更新成功",
      200
    );
  } catch (error) {
    console.error("更新個人資料失敗:", error);
    return errorResponse(res, error, 500);
  }
});

module.exports = router;
