import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { successResponse, errorResponse } from "../utils/responseHandler.js";
import { getAiChatResponse, getAiHealth } from "../services/ai.js";

const router = express.Router();

// AI 客服聊天 API
router.post("/chat", verifyToken, async (req, res) => {
  try {
    const { message } = req.body;
    const response = await getAiChatResponse(message);
    return successResponse(res, response, "回應成功");
  } catch (error) {
    console.error("AI 客服錯誤:", error);
    return errorResponse(res, error, error.status || 500);
  }
});

// 健康檢查路由
router.get("/health", (req, res) => {
  return successResponse(res, getAiHealth());
});

export default router;
