const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../prisma");
const { verifyToken } = require("../middleware/auth");
const { successResponse, errorResponse } = require("../utils/responseHandler");

const router = express.Router();

// 注册
router.post("/register", async (req, res) => {
  const { email, username, password } = req.body;

  if (!email || !username || !password) {
    return errorResponse(res, "缺少必填字段", 400);
  }

  try {
    // 檢查使用者是否存在
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      return errorResponse(res, "用戶已存在", 400);
    }

    // 密码加密
    const hashedPassword = await bcrypt.hash(password, 10);

    // 創建用戶
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
      },
    });

    // 生成 JWT
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return successResponse(res, {
      token,
      user: { id: user.id, email: user.email, username: user.username }
    }, "註冊成功", 201);
  } catch (error) {
    console.error("注册失败:", error);
    return errorResponse(res, "註冊失敗", 500);
  }
});

// 登入
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return errorResponse(res, "缺少必填字段", 400);
  }

  try {
    // 查找用户
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return errorResponse(res, "郵箱或密碼錯誤", 401);
    }

    // 检查密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return errorResponse(res, "郵箱或密碼錯誤", 401);
    }

    // 生成 JWT
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return successResponse(res, {
      token,
      user: { id: user.id, email: user.email, username: user.username }
    }, "登入成功", 200);
  } catch (error) {
    console.error("登入失败:", error);
    return errorResponse(res, "登入失敗", 500);
  }
});

// 獲取當前用戶信息
router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "用户不存在" });
    }

    res.json({
      message: "成功获取用户信息",
      user,
    });
  } catch (error) {
    console.error("获取用户信息失败:", error);
    res.status(500).json({ error: "获取用户信息失败" });
  }
});

// 驗證 JWT Token
router.post("/verify", verifyToken, (req, res) => {
  res.json({
    message: "Token 有效",
    userId: req.userId,
    username: req.username,
  });
});

module.exports = router;
