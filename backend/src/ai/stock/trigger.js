import { containsFuzzyStockIntent, containsStockSymbol } from "./intent.js";
import { getRoomStockSession } from "./session.js";

const STOCK_SESSION_END_REGEX = /^(結束|結束對話|結束股票對話|停止|停止股票對話|先這樣|不用了|bye|end|stop|quit)$/i;
const STOCK_SESSION_RESET_REGEX = /^(重置|重置對話|重置股票對話|清除股票對話|reset)$/i;

export const isStockSessionEndMessage = (content) => STOCK_SESSION_END_REGEX.test(String(content || "").trim());
export const isStockSessionResetMessage = (content) => STOCK_SESSION_RESET_REGEX.test(String(content || "").trim());

export const shouldTriggerStockAi = (content, roomId) => {
  const text = String(content || "").trim();
  if (!text) return false;

  const hasActiveSession = Boolean(getRoomStockSession(roomId));
  if (isStockSessionEndMessage(text) || isStockSessionResetMessage(text)) {
    return hasActiveSession;
  }
  if (hasActiveSession) return true;

  return containsStockSymbol(text) || containsFuzzyStockIntent(text);
};
