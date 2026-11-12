// 房間股票對話 Session：暫存追蹤代號與最近問答，讓使用者可自然追問。
const STOCK_SESSION_TTL_MS = 15 * 60 * 1000;
const STOCK_SESSION_HISTORY_LIMIT = 4;
const STOCK_SESSION_TURN_MAX_LENGTH = 600;
const roomStockSessions = new Map();

const getRoomSessionKey = (roomId) => String(roomId);

const compactText = (value) => String(value || "").replace(/\s+/g, " ").trim().slice(0, STOCK_SESSION_TURN_MAX_LENGTH);

/** 清除指定聊天室的股票對話 Session。 */
export const clearRoomStockSession = (roomId) => {
  roomStockSessions.delete(getRoomSessionKey(roomId));
};

/** 取得未逾時的股票對話 Session；逾時資料會自動清除。 */
export const getRoomStockSession = (roomId) => {
  const session = roomStockSessions.get(getRoomSessionKey(roomId)) || null;
  if (!session) {
    return null;
  }

  const updatedAtMs = Date.parse(session.updatedAt || "");
  if (!Number.isFinite(updatedAtMs) || Date.now() - updatedAtMs > STOCK_SESSION_TTL_MS) {
    clearRoomStockSession(roomId);
    return null;
  }

  return session;
};

/** 更新房間的追蹤股票與近期問答摘要。 */
export const setRoomStockSession = (roomId, trackedSymbol, turn = null) => {
  const previousSession = getRoomStockSession(roomId);
  const isSameSymbol = previousSession?.trackedSymbol === trackedSymbol;
  const history = isSameSymbol && Array.isArray(previousSession?.history)
    ? previousSession.history.slice(-STOCK_SESSION_HISTORY_LIMIT)
    : [];

  const question = compactText(turn?.question);
  const reply = compactText(turn?.reply);
  if (question && reply) {
    history.push({ question, reply });
  }

  roomStockSessions.set(getRoomSessionKey(roomId), {
    trackedSymbol: trackedSymbol || null,
    updatedAt: new Date().toISOString(),
    history: history.slice(-STOCK_SESSION_HISTORY_LIMIT),
  });
};
