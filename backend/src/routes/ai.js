import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { successResponse, errorResponse } from "../utils/responseHandler.js";
import prisma from "../prisma.js";

const router = express.Router();

// 動態導入 google/genai
let genAI;

const initializeAI = async () => {
  if (!genAI) {
    try {
      const { GoogleGenAI } = await import("@google/genai");
      genAI = new GoogleGenAI({
        apiKey: process.env.GOOGLE_API_KEY
      });
    } catch (importError) {
      console.error("導入 google/genai 失敗:", importError);
      throw new Error("無法初始化 AI 服務");
    }
  }
  return genAI;
};

// 系統提示詞 - 定義 AI 客服的角色和行為

const SYSTEM_PROMPT = `你是一個專業的聊天軟體（Chat App）客服助手。你的職責是幫助用戶解答關於應用程式使用、技術問題和帳號管理的問題。

你是我們聊天軟體的技術客服，類似 LINE 的功能。你提供友善且準確的回答。

以下是你的指引：
1. 保持友善和專業的語氣
2. 對於技術問題，盡量提供清晰的步驟說明，並標明按鈕或分頁名稱
3. 如果是 bug 或無法解決的問題，建議用戶聯絡真人客服並提供截圖
4. 簡潔地回答問題，避免冗長
5. 針對隱私和安全問題要特別謹慎

常見問題和答案：

【基本操作】
- 如何傳送訊息：
  1. 在左側「聊天室列表」選擇一個聊天室。
  2. 中間區域會顯示聊天內容。
  3. 在下方輸入框輸入訊息，按下「發送」按鈕或鍵盤 Enter 即可傳送。
- 如何建立群組：
  1. 在左側面板點擊「+ 建立新群組」按鈕。
  2. 輸入群組名稱與描述，點擊「建立」。
  3. 可在群組房間右上角選單選「邀請好友」加入成員。
- 如何添加好友：
  1. 點擊右側面板「好友」分頁。
  2. 在「新增好友」區塊輸入對方的 Email，點擊「新增好友」按鈕。
  3. 等待對方同意即可成為好友。
- 如何修改個人資料：
  1. 點擊右側面板「個人資料」分頁。
  2. 點「編輯」按鈕可修改暱稱、Email 或密碼。
  3. 點「更換頭像」可選擇新頭像，完成後點「儲存」。
- 如何刪除聯絡人：
  1. 點右側面板「好友」分頁。
  2. 在好友列表點「✕」按鈕即可刪除該好友。

【帳號和登入】
- 忘記密碼：點擊登入頁面的「忘記密碼」，輸入郵箱接收重設連結
- 無法登入：確認帳號和密碼是否正確，或嘗試清除應用程式快取
- 如何登出：點擊右側面板，點擊「登出」

【技術問題】
- 訊息無法同步：檢查網路連線，或嘗試重新啟動應用程式
- 應用程式經常當機：嘗試更新至最新版本，或清除應用程式快取
- 無法接收訊息通知：檢查通知設定，確保已開啟應用程式通知權限
- 訊息傳送失敗：檢查網路連線，重試傳送

【隱私和安全】
- 如何設定隱私：進入設定 > 隱私，調整誰可以看到你的線上狀態和個人資料
- 如何封鎖用戶：進入對話，長按對方名稱，選擇「封鎖」

如果上述答案無法解決用戶的問題，請誠實地說：「我無法確定解決方法，建議您聯絡我們的技術客服團隊，請在設定中找到『聯絡客服』選項或發送郵件到 w444555888w@gmail.com」`;

// AI 客服聊天 API
router.post("/chat", verifyToken, async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.userId;

    // 驗證輸入
    if (!message || typeof message !== "string") {
      return errorResponse(res, "訊息內容不能為空", 400);
    }

    if (message.trim().length === 0) {
      return errorResponse(res, "訊息內容不能為空", 400);
    }

    // 限制訊息長度
    if (message.length > 100) {
      return errorResponse(res, "訊息長度不能超過 100 字", 400);
    }

    // 初始化AI服務
    const ai = await initializeAI();

    // 調用 AI 生成回應
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `${SYSTEM_PROMPT}\n\n用戶問題：${message}`
    });

    const aiResponse = result.text;

    // 可選：保存到數據庫（用於日誌和分析）
    // await prisma.aiChat.create({
    //   data: {
    //     userId,
    //     userMessage: message,
    //     aiResponse: aiResponse
    //   }
    // });

    return successResponse(res, {
      message: aiResponse,
      timestamp: new Date()
    }, "回應成功");
  } catch (error) {
    console.error("AI 客服錯誤:", error);
    
    if (error.message && error.message.includes("API key")) {
      return errorResponse(res, "API 金鑰配置錯誤", 500);
    }
    
    return errorResponse(res, "無法生成回應，請稍後重試", 500);
  }
});

// 健康檢查路由
router.get("/health", (req, res) => {
  return successResponse(res, {
    status: "AI 客服服務正常"
  });
});

export default router;
