// 觸發規則：決定群組訊息是否應交給股票 AI，並解析 Session 控制指令。
import { containsFuzzyStockIntent, containsStockSymbol } from "./intent.js";
import { getRoomStockSession } from "./session.js";

const STOCK_SESSION_END_REGEX =
  /^(結束|結束對話|結束股票對話|停止|停止股票對話|先這樣|不用了|bye|end|stop|quit)$/i;
const STOCK_SESSION_RESET_REGEX =
  /^(重置|重置對話|重置股票對話|清除股票對話|reset)$/i;

export const isStockSessionEndMessage = (content) => {
  return STOCK_SESSION_END_REGEX.test(String(content || "").trim());
};

export const isStockSessionResetMessage = (content) => {
  return STOCK_SESSION_RESET_REGEX.test(String(content || "").trim());
};

/** 判斷群組訊息是否需要觸發股票 AI。 */
export const shouldTriggerStockAi = (content, roomId) => {
  const text = String(content || "").trim();
  if (!text) {
    return false;
  }

  const hasActiveSession = Boolean(getRoomStockSession(roomId));
  if (isStockSessionEndMessage(text) || isStockSessionResetMessage(text)) {
    return hasActiveSession;
  }

  // 有有效 Session 時，使用者可直接追問，不必重複輸入股票關鍵字或代號。
  if (hasActiveSession) {
    return true;
  }

  return containsStockSymbol(text) || containsFuzzyStockIntent(text);
};
