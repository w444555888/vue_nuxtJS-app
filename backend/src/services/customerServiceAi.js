import logger from "../utils/logger.js";
import { extractGeminiText, GEMINI_MODEL, getGeminiClient } from "./ai.js";

const createError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const SYSTEM_PROMPT = `你是一個專業聊天軟體（Chat App）的客服助手。請以繁體中文、友善且精簡的方式，協助使用者處理應用程式操作、技術問題、帳號管理、隱私與安全問題。

基本操作：使用者可在左側聊天室列表選擇聊天室，在下方輸入訊息後按發送或 Enter；可用「+ 建立新群組」建立群組並邀請好友；右側面板可管理好友、個人資料與登出。

帳號與技術：忘記密碼時請使用登入頁的「忘記密碼」；無法登入可確認帳密或清除快取；訊息同步、通知或當機問題先確認網路、更新應用程式或重新啟動。

隱私與安全：設定中可調整隱私；若需封鎖用戶，進入對話後選擇封鎖。

無法確定解法時，請誠實說明並建議聯絡技術客服：w444555888w@gmail.com。`;

const getErrorStatus = (error) => Number(error?.status || 0);
const getErrorMessage = (error) => String(error?.message || "");

const buildFallbackReply = (mainMessage, subMessage) =>
  [mainMessage, subMessage || "若問題緊急，請聯絡技術客服：w444555888w@gmail.com"].join("\n");

const getCustomerServiceFallback = (error) => {
  const status = getErrorStatus(error);
  const message = getErrorMessage(error);

  if ([401, 403].includes(status) || /UNAUTHENTICATED|PERMISSION_DENIED|leaked/i.test(message)) {
    return buildFallbackReply("AI 客服目前暫時無法連線（模型金鑰需要更新），請稍後再試。");
  }
  if (status === 429 || /RESOURCE_EXHAUSTED|Quota exceeded|rate-limits/i.test(message)) {
    return buildFallbackReply("AI 客服目前請求量已達上限，暫時無法立即回覆。", "請稍候約 1 分鐘後再試一次。");
  }
  if (status === 504 || /DEADLINE_EXCEEDED|timeout|超時/i.test(message)) {
    return buildFallbackReply("AI 客服處理時間過長，請稍後再試。", "建議嘗試以更簡潔的方式重新提問。");
  }
  if ([500, 503].includes(status)) {
    return buildFallbackReply("AI 客服服務目前維護中，暫時無法提供協助。", "請稍候片刻後再試一次。");
  }
  if (status === 400 && /INVALID_ARGUMENT|FAILED_PRECONDITION|格式錯誤|國家\/地區/i.test(message)) {
    return buildFallbackReply("AI 客服配置需要更新，服務暫時無法使用。");
  }

  return null;
};

export const getAiChatResponse = async (message, _options = {}) => {
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    throw createError("訊息內容不能為空", 400);
  }

  if (message.length > 100) {
    throw createError("訊息長度不能超過 100 字", 400);
  }

  try {
    const ai = await getGeminiClient();
    const result = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `${SYSTEM_PROMPT}\n\n用戶問題：${message}`,
    });

    return {
      message: extractGeminiText(result),
      stockData: null,
      timestamp: new Date(),
    };
  } catch (error) {
    logger.error("Gemini 客服 API 錯誤", {
      status: error?.status,
      message: error?.message,
      errorCode: error?.errorCode,
    });

    const fallback = getCustomerServiceFallback(error);
    if (fallback) {
      return { message: fallback, stockData: null, timestamp: new Date() };
    }
    throw error;
  }
};
