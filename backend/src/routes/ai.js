import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { successResponse, errorResponse } from "../utils/responseHandler.js";
import { getAiChatResponse } from "../services/ai.js";

const router = express.Router();

// AI 客服聊天 API
router.post("/chat", verifyToken, async (req, res) => {
  try {
    const { message, chatType } = req.body;
    const response = await getAiChatResponse(message, {
      chatType,
      userId: req.user?.id,
    });
    return successResponse(res, response, "回應成功");
  } catch (error) {
    console.error("AI 客服錯誤:", error);
    return errorResponse(res, error, error.status || 500);
  }
});

export default router;
