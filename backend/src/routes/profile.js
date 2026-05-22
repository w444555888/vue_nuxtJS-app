import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { successResponse, errorResponse } from "../utils/responseHandler.js";
import { getMyProfile, updateMyProfile } from "../services/profile.js";

const router = express.Router();

// 獲取當前用戶的個人資料
router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await getMyProfile(req.user.id);

    return successResponse(res, user, "獲取個人資料成功", 200);
  } catch (error) {
    console.error("獲取個人資料失敗:", error);
    return errorResponse(res, error, error.status || 500);
  }
});

// 更新個人資料
router.patch("/update", verifyToken, async (req, res) => {
  try {
    const updatedUser = await updateMyProfile(req.user.id, req.body);

    return successResponse(
      res,
      updatedUser,
      "個人資料更新成功",
      200
    );
  } catch (error) {
    console.error("更新個人資料失敗:", error);
    return errorResponse(res, error, error.status || 500);
  }
});

export default router;
