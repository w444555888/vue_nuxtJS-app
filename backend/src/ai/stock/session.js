const STOCK_SESSION_TTL_MS = 15 * 60 * 1000;
const STOCK_SESSION_HISTORY_LIMIT = 4;
const STOCK_SESSION_TURN_MAX_LENGTH = 600;
const roomStockSessions = new Map();

const getRoomSessionKey = (roomId) => String(roomId);
const compactText = (value) => String(value || "").replace(/\s+/g, " ").trim().slice(0, STOCK_SESSION_TURN_MAX_LENGTH);

export const clearRoomStockSession = (roomId) => {
  roomStockSessions.delete(getRoomSessionKey(roomId));
};

export const getRoomStockSession = (roomId) => {
  const session = roomStockSessions.get(getRoomSessionKey(roomId)) || null;
  if (!session) return null;

  const updatedAtMs = Date.parse(session.updatedAt || "");
  if (!Number.isFinite(updatedAtMs) || Date.now() - updatedAtMs > STOCK_SESSION_TTL_MS) {
    clearRoomStockSession(roomId);
    return null;
  }
  return session;
};

export const setRoomStockSession = (roomId, trackedSymbol, turn = null) => {
  const previousSession = getRoomStockSession(roomId);
  const isSameSymbol = previousSession?.trackedSymbol === trackedSymbol;
  const history = isSameSymbol && Array.isArray(previousSession?.history)
    ? previousSession.history.slice(-STOCK_SESSION_HISTORY_LIMIT)
    : [];

  const question = compactText(turn?.question);
  const reply = compactText(turn?.reply);
  if (question && reply) history.push({ question, reply });

  roomStockSessions.set(getRoomSessionKey(roomId), {
    trackedSymbol: trackedSymbol || null,
    updatedAt: new Date().toISOString(),
    history: history.slice(-STOCK_SESSION_HISTORY_LIMIT),
  });
};
