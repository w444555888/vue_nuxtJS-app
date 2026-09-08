import crypto from "crypto";
import bcrypt from "bcryptjs";
import prisma from "../prisma.js";
import logger from "../utils/logger.js";
import { generateAiText } from "./ai.js";
import { mcpTools } from "./mcpTools.js";
 
const BOT_EMAIL = process.env.STOCK_BOT_EMAIL || "stock-bot@chat.local";
const BOT_USERNAME_BASE = process.env.STOCK_BOT_USERNAME || "StockBot";

const STOCK_KEYWORD_REGEX =
  /(股票|股價|台股|上市|上櫃|興櫃|大盤|指數|加權|櫃買|漲跌|收盤|開盤|成交|量價|k線|技術線圖|均線|籌碼|法人|主力|外資|投信|自營商|買賣超|三大法人|融資|融券|借券|券資比|資券|當沖|零股|除權息|配息|殖利率|股利|eps|本益比|股價淨值比|營收|月增|年增|mom|yoy|財報|現金流|自由現金流|產業鏈|供應鏈|八大行庫|官股|新聞|公告|消息面|\bstock\b|\bquote\b|\bshares\b|\btaiex\b|\bpe\b|\bpb\b|\byield\b)/i;
const QUOTE_INTENT_REGEX =
  /(多少|幾塊|價格|報價|最新|目前|現價|昨收|今開|最高|最低|漲|跌|漲幅|跌幅|收盤|開盤|走勢|趨勢|狀態|行情|盤勢|量能|成交量|成交值|委買|委賣|內盤|外盤|\bprice\b|\bquote\b|\bup\b|\bdown\b|\btrend\b|\bvolume\b)/i;
const STOCK_FOLLOWUP_REGEX =
  /(目標價|合理價|估值|高估|低估|買點|賣點|進場|出場|停利|停損|支撐|壓力|突破|回檔|區間|本益比|殖利率|股價淨值比|配息|股利|財報|營收|毛利率|營益率|淨利率|eps|現金流|自由現金流|月增|年增|mom|yoy|新聞|公告|題材|產業鏈|供應鏈|八大行庫|官股|法人買賣超|外資買賣超|投信買賣超|自營商買賣超|三大法人|籌碼|融資融券|風險|建議|分析|評估|可以買|要不要買|值不值得|可不可以進場)/i;
const STOCK_FUZZY_CONTEXT_REGEX =
  /(法人|三大法人|買超|賣超|外資|投信|自營商|主力|籌碼|融資|融券|借券|券資比|當沖|量縮|量增|爆量|套牢|解套|停利|停損|支撐|壓力|突破|回測|回檔|填息|除息|除權|配股|配息|股息|殖利率|本益比|股價淨值比|營收|月增|年增|mom|yoy|財報|eps|現金流|自由現金流|新聞|公告|產業鏈|供應鏈|八大行庫|官股|taiex|加權指數|櫃買指數|盤勢|技術面|基本面|消息面)/i;
const STOCK_SESSION_END_REGEX =
  /^(結束|結束對話|結束股票對話|停止|停止股票對話|先這樣|不用了|bye|end|stop|quit)$/i;
const STOCK_SESSION_RESET_REGEX =
  /^(重置|重置對話|重置股票對話|清除股票對話|reset)$/i;

const SYMBOL_REGEX = /(?:^|\D)(\d{4})(?:\D|$)/; // 提取 4 碼股票代號，確保前後不是數字，避免誤抓其他數字串。
const STOCK_SESSION_TTL_MS = 15 * 60 * 1000; // 股票對話狀態的有效期限，15 分鐘內有互動則持續有效，超過則自動失效。
const STOCK_SESSION_HISTORY_LIMIT = 4;
const STOCK_SESSION_TURN_MAX_LENGTH = 600;

const roomStockSessions = new Map(); // roomId -> { trackedSymbol, updatedAt, history }

/** 將聊天室 ID 轉為 Session Map 的 key。 */
const getRoomSessionKey = (roomId) => String(roomId);

/** 取得尚未過期的房間股票對話狀態。 */
const getRoomStockSession = (roomId) => {
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

/** 壓縮並限制儲存於對話歷史的文字長度。 */
const compactStockSessionText = (value) => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.slice(0, STOCK_SESSION_TURN_MAX_LENGTH);
};

/** 更新房間追蹤股票與最近問答歷史。 */
const setRoomStockSession = (roomId, trackedSymbol, turn = null) => {
  const previousSession = getRoomStockSession(roomId);
  const isSameSymbol = previousSession?.trackedSymbol === trackedSymbol;
  const history = isSameSymbol && Array.isArray(previousSession?.history)
    ? previousSession.history.slice(-STOCK_SESSION_HISTORY_LIMIT)
    : [];

  const question = compactStockSessionText(turn?.question);
  const reply = compactStockSessionText(turn?.reply);
  if (question && reply) {
    history.push({ question, reply });
  }

  roomStockSessions.set(getRoomSessionKey(roomId), {
    trackedSymbol: trackedSymbol || null,
    updatedAt: new Date().toISOString(),
    history: history.slice(-STOCK_SESSION_HISTORY_LIMIT),
  });
};

/** 將近期問答歷史格式化為 Gemini Prompt 文字。 */
const formatStockSessionHistory = (history = []) => {
  if (!Array.isArray(history) || history.length === 0) {
    return "無（這是本輪股票對話的第一個問題）";
  }

  return history
    .map((turn, index) => `第 ${index + 1} 輪問題：${turn.question}\n第 ${index + 1} 輪回答摘要：${turn.reply}`)
    .join("\n");
};

/** 清除房間的股票對話狀態。 */
const clearRoomStockSession = (roomId) => {
  roomStockSessions.delete(getRoomSessionKey(roomId));
};

/** 判斷是否為結束股票對話的指令。 */
const isStockSessionEndMessage = (content) => {
  return STOCK_SESSION_END_REGEX.test(String(content || "").trim());
};

/** 判斷是否為重置股票對話的指令。 */
const isStockSessionResetMessage = (content) => {
  return STOCK_SESSION_RESET_REGEX.test(String(content || "").trim());
};

/** 依股票關鍵字判斷文字是否具有股票查詢意圖。 */
const containsFuzzyStockIntent = (text) => {
  const normalized = String(text || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();

  if (!normalized) {
    return false;
  }

  if (
    STOCK_KEYWORD_REGEX.test(normalized) ||
    QUOTE_INTENT_REGEX.test(normalized) ||
    STOCK_FOLLOWUP_REGEX.test(normalized) ||
    STOCK_FUZZY_CONTEXT_REGEX.test(normalized)
  ) {
    return true;
  }

  const fuzzyPairs = [
    ["法人", "買賣超"],
    ["外資", "買超"],
    ["投信", "買超"],
    ["自營商", "買超"],
    ["融資", "增加"],
    ["融券", "增加"],
    ["台股", "趨勢"],
    ["股票", "分析"],
  ];

  return fuzzyPairs.some(
    ([left, right]) => normalized.includes(left) && normalized.includes(right)
  );
};

/** 判斷群組訊息是否需要觸發股票 AI。 */
const shouldTriggerStockAi = (content, roomId) => {
  const text = String(content || "").trim();
  if (!text) {
    return false;
  }

  const hasActiveSession = Boolean(getRoomStockSession(roomId));
  if (isStockSessionEndMessage(text)) {
    return hasActiveSession;
  }

  if (isStockSessionResetMessage(text)) {
    return hasActiveSession;
  }

  const hasSymbol = SYMBOL_REGEX.test(text);
  if (hasSymbol) {
    return true;
  }

  if (containsFuzzyStockIntent(text)) {
    return true;
  }

  // 沒有股票相關關鍵字時，不觸發 Bot，避免打擾一般群聊。
  return false;
};

/** 從使用者訊息提取四碼台股代號。 */
const extractSymbol = (content) => {
  const text = String(content || "");
  const match = text.match(SYMBOL_REGEX);
  return match?.[1] || null;
};

/** 建構含股票代號與對話脈絡的 Gemini MCP Prompt。 */
const buildStockFollowupPrompt = (content, trackedSymbol, history = []) => {
  return [
    "你是台股分析助手，請使用繁體中文回覆。",
    "你可使用 FinMind 官方 MCP 工具取得即時與歷史資料。涉及行情、法人、財報、營收、股利、新聞、產業、期貨、指數或比較時，必須先查工具資料再回答。",
    "若下方已解析股票代號，查詢該個股時直接使用該代號；每次呼叫 query_dataset 都必須帶入相同的 data_id，且股價等歷史資料須帶入合理的 start_date。不可省略 data_id。",
    "回答規則：簡潔、不要杜撰數字、提及資料來源 FinMind 與查詢資料日期。",
    "請延續下方近期對話；本次工具結果優先於先前回答。",
    "最後一行固定加上：以上資訊僅供參考，非投資建議。",
    `目前追蹤股票代號：${trackedSymbol || "未知"}`,
    `本輪個股查詢 data_id：${trackedSymbol || "尚未提供"}`,
    `近期股票對話：${formatStockSessionHistory(history)}`,
    `使用者問題：${String(content || "").trim()}`,
  ].join("\n");
};

/** 取得或建立用於發送股票回覆的 Bot 帳號。 */
const ensureBotUser = async () => {
  const existingByEmail = await prisma.user.findUnique({
    where: { email: BOT_EMAIL },
  });

  if (existingByEmail) {
    return existingByEmail;
  }

  const passwordHash = await bcrypt.hash(crypto.randomUUID(), 10);

  for (let i = 0; i < 5; i += 1) {
    const candidateUsername = i === 0 ? BOT_USERNAME_BASE : `${BOT_USERNAME_BASE}${i}`;

    try {
      return await prisma.user.create({
        data: {
          email: BOT_EMAIL,
          username: candidateUsername,
          password: passwordHash,
          avatar: null,
        },
      });
    } catch (error) {
      if (error?.code === "P2002") {
        continue;
      }
      throw error;
    }
  }

  throw new Error("無法建立 AI Bot 帳號");
};

/** 確保股票 Bot 已加入指定聊天室。 */
const ensureBotRoomMembership = async (botUserId, roomId) => {
  await prisma.chatRoomMember.upsert({
    where: {
      userId_roomId: {
        userId: botUserId,
        roomId,
      },
    },
    update: {},
    create: {
      userId: botUserId,
      roomId,
    },
  });
};

/** 將股票 Bot 回覆儲存為聊天室訊息。 */
const saveBotMessage = async (botUserId, roomId, content) => {
  return prisma.message.create({
    data: {
      content,
      imageUrl: null,
      userId: botUserId,
      roomId,
    },
    include: {
      user: {
        select: { id: true, username: true, avatar: true },
      },
    },
  });
};

/** 透過 Socket.IO 將 Bot 訊息即時推送至聊天室。 */
const emitBotMessage = (io, roomId, botMessage) => {
  io.to(`room_${roomId}`).emit("receive_message", {
    id: botMessage.id,
    seq: botMessage.id,
    roomId,
    content: botMessage.content,
    imageUrl: botMessage.imageUrl,
    userId: botMessage.user.id,
    username: botMessage.user.username,
    avatar: botMessage.user.avatar,
    createdAt: botMessage.createdAt,
    eventType: "message_created",
  });
};

/** 處理群組股票訊息並建立、儲存及推送 Bot 回覆。 */
export const triggerGroupStockAiReply = async ({ roomId, content, io }) => {
  try {
    if (!shouldTriggerStockAi(content, roomId)) {
      return;
    }

    const activeSession = getRoomStockSession(roomId);
    const hasActiveSession = Boolean(activeSession);
    const isEndMessage = isStockSessionEndMessage(content);
    const symbol = extractSymbol(content);
    const effectiveSymbol = symbol || activeSession?.trackedSymbol || null;
    const relevantHistory = activeSession?.trackedSymbol === effectiveSymbol
      ? activeSession.history
      : [];

    const botUser = await ensureBotUser();
    await ensureBotRoomMembership(botUser.id, roomId);

    // 處理重置命令
    if (isStockSessionResetMessage(content)) {
      clearRoomStockSession(roomId);
      const resetMessage = await saveBotMessage(
        botUser.id,
        roomId,
        "已重置股票對話狀態。若要重新查詢，請輸入台股代號（例如 2330）。"
      );
      emitBotMessage(io, roomId, resetMessage);
      return;
    }

    // 處理結束命令 - 只在有活躍會話時觸發
    if (isEndMessage && hasActiveSession) {
      clearRoomStockSession(roomId);
      const endMessage = await saveBotMessage(
        botUser.id,
        roomId,
        `已結束 ${activeSession?.trackedSymbol || "股票"} 的查詢對話。若有其他查詢需求，請直接輸入股票代號。`
      );
      emitBotMessage(io, roomId, endMessage);
      return;
    }

    // 如果沒有 symbol 也沒有活躍會話，提示輸入
    if (!symbol && !hasActiveSession && !isEndMessage) {
      const guidanceMessage = await saveBotMessage(
        botUser.id,
        roomId,
        "看起來你想查股票資訊，請提供 4 碼台股代號，例如：2330、0050、2317。"
      );
      emitBotMessage(io, roomId, guidanceMessage);
      return;
    }

    let aiText = "";
    let replyPath = "gemini-finmind-mcp";

    try {
      const finMindMcpTool = await mcpTools.getGeminiTool();
      aiText = await generateAiText(
        buildStockFollowupPrompt(content, effectiveSymbol, relevantHistory),
        { tools: [finMindMcpTool] }
      );
    } catch (aiError) {
      logger.error(
        `群組股票 MCP AI 回覆失敗：${aiError?.message || String(aiError)}`
      );
      replyPath = "fallback";
      aiText = "目前無法透過 FinMind MCP 取得股票資料，請稍後重試。";
    }

    if (!aiText) {
      replyPath = "fallback";
      aiText = "目前無法透過 FinMind MCP 取得股票資料，請稍後重試。";
    }

    setRoomStockSession(roomId, effectiveSymbol, {
      question: content,
      reply: aiText,
    });

    logger.info("GROUP_STOCK_AI 回覆路徑", {
      roomId,
      symbol: effectiveSymbol,
      replyPath,
    });

    const botMessage = await saveBotMessage(botUser.id, roomId, aiText);
    emitBotMessage(io, roomId, botMessage);
  } catch (error) {
    logger.error("群組股票 AI 自動回覆失敗", {
      error: error?.message,
      stack: error?.stack,
    });
  }
};
