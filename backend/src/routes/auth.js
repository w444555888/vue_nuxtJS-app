import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { successResponse, errorResponse } from "../utils/responseHandler.js";
import {
  registerUser,
  loginUser,
  getCurrentUser,
  updateUserAvatar,
  getVerifyResult,
  refreshAccessToken,
  logoutUser,
} from "../services/auth.js";

const router = express.Router();

// 註冊
router.post("/register", async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) {
    return errorResponse(res, "缺少必填字段", 400);
  }
  try {
    const result = await registerUser({ email, username, password });
    return successResponse(res, result, "註冊成功", 201);
  } catch (error) {
    console.error("註冊失敗:", error);
    return errorResponse(res, error, error.status || 500);
  }
});

// 登入
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return errorResponse(res, "缺少必填字段", 400);
  }
  try {
    const result = await loginUser({ email, password });
    return successResponse(res, result, "登入成功", 200);
  } catch (error) {
    console.error("登入失敗:", error);
    return errorResponse(res, error, error.status || 500);
  }
});

// 獲取當前用戶信息
router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await getCurrentUser(req.user.id);
    return successResponse(res, { user }, "成功獲取使用者信息", 200);
  } catch (error) {
    console.error("獲取使用者信息失敗:", error);
    return errorResponse(res, error, error.status || 500);
  }
});
 
// 更新用戶頭像
router.post("/update-avatar", verifyToken, async (req, res) => {
  const { avatar } = req.body;
  if (!avatar) {
    return errorResponse(res, "頭像 URL 不能為空", 400);
  }
  try {
    const user = await updateUserAvatar(req.user.id, avatar);
    return successResponse(res, { user }, "頭像更新成功", 200);
  } catch (error) {
    console.error("頭像更新失敗:", error);
    return errorResponse(res, error, error.status || 500);
  }
});

// 驗證 JWT Token
router.post("/verify", verifyToken, (req, res) => {
  const result = getVerifyResult(req.user);
  res.json({
    message: "Token 有效",
    userId: result.userId,
    username: result.username,
  });
});

// 刷新 Access Token
router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return errorResponse(res, "缺少 Refresh Token", 400);
  }
  try {
    const tokens = await refreshAccessToken(refreshToken);
    return successResponse(
      res,
      tokens,
      "Token 刷新成功",
      200
    );
  } catch (error) {
    console.error("Token 刷新失敗:", error);
    return errorResponse(res, error, error.status || 500);
  }
});

// 登出
router.post("/logout", verifyToken, async (req, res) => {
  try {
    await logoutUser(req.user.id);
    return successResponse(res, {}, "登出成功", 200);
  } catch (error) {
    console.error("登出失敗:", error);
    return errorResponse(res, error, error.status || 500);
  }
});

export default router;
