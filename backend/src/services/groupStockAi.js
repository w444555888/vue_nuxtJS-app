import crypto from "crypto";
import bcrypt from "bcryptjs";
import prisma from "../prisma.js";
import { generateAiText } from "./ai.js";
import { mcpTools } from "./mcpTools.js";
import { getTwStockQuote } from "./market/twStock.js";

const BOT_EMAIL = process.env.STOCK_BOT_EMAIL || "stock-bot@chat.local";
const BOT_USERNAME_BASE = process.env.STOCK_BOT_USERNAME || "StockBot";

const STOCK_KEYWORD_REGEX =
  /(股票|股價|台股|上市|上櫃|大盤|漲跌|收盤|開盤|成交|\bstock\b|\bquote\b|\bshares\b)/i;
const QUOTE_INTENT_REGEX =
  /(多少|幾塊|價格|報價|最新|目前|現價|漲|跌|收盤|開盤|走勢|狀態|\bprice\b|\bquote\b|\bup\b|\bdown\b)/i;
const STOCK_FOLLOWUP_REGEX =
  /(目標價|合理價|買點|賣點|進場|出場|停利|停損|支撐|壓力|本益比|殖利率|風險|建議|分析|評估|可以買|要不要買)/i;
const STOCK_SESSION_END_REGEX =
  /^(結束|結束對話|結束股票對話|停止|停止股票對話|先這樣|不用了|bye|end|stop|quit)$/i;
const STOCK_SESSION_RESET_REGEX =
  /^(重置|重置對話|重置股票對話|清除股票對話|reset)$/i;
const SYMBOL_REGEX = /(?:^|\D)(\d{4})(?:\D|$)/;
const STOCK_SESSION_TTL_MS = 15 * 60 * 1000;

const roomStockSessions = new Map(); // roomId -> { trackedSymbol, updatedAt }

const getRoomSessionKey = (roomId) => String(roomId);

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

const setRoomStockSession = (roomId, trackedSymbol) => {
  roomStockSessions.set(getRoomSessionKey(roomId), {
    trackedSymbol: trackedSymbol || null,
    updatedAt: new Date().toISOString(),
  });
};

const clearRoomStockSession = (roomId) => {
  roomStockSessions.delete(getRoomSessionKey(roomId));
};

const isStockSessionEndMessage = (content) => {
  return STOCK_SESSION_END_REGEX.test(String(content || "").trim());
};

const isStockSessionResetMessage = (content) => {
  return STOCK_SESSION_RESET_REGEX.test(String(content || "").trim());
};

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

  if (STOCK_KEYWORD_REGEX.test(text) || QUOTE_INTENT_REGEX.test(text) || STOCK_FOLLOWUP_REGEX.test(text)) {
    return true;
  }

  // 沒有股票相關關鍵字時，不觸發 Bot，避免打擾一般群聊。
  return false;
};

const extractSymbol = (content) => {
  const text = String(content || "");
  const match = text.match(SYMBOL_REGEX);
  return match?.[1] || null;
};

const executeStockTool = async (symbol) => {
  return mcpTools.execute("get_stock_quote", { symbol });
};

const buildStockFollowupPrompt = (content, quote, trackedSymbol) => {
  return [
    "你已收到台股工具查詢結果，請用繁體中文回覆。",
    "回答規則：簡潔、不要杜撰數字、務必提到資料來源與資料時間。",
    "若使用者問目標價、買賣點或投資建議，請明確說明無法保證預測，改提供風險觀點與可觀察指標。",
    "最後一行固定加上：以上資訊僅供參考，非投資建議。",
    `目前追蹤股票代號：${trackedSymbol || quote?.symbol || "未知"}`,
    `使用者問題：${String(content || "").trim()}`,
    `工具資料：${JSON.stringify(quote)}`,
  ].join("\n");
};

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

const buildFallbackQuoteText = (quote) => {
  const change = Number.isFinite(quote?.change)
    ? (quote.change > 0 ? `+${quote.change.toFixed(2)}` : quote.change.toFixed(2))
    : "N/A";
  const changePercent = Number.isFinite(quote?.changePercent)
    ? (quote.changePercent > 0
        ? `+${quote.changePercent.toFixed(2)}%`
        : `${quote.changePercent.toFixed(2)}%`)
    : "N/A";
  const asOf = quote?.asOf || "N/A";
  const source = quote?.source || "TWSE/TPEx";

  return [
    `${quote?.name || quote?.symbol || "台股"} (${quote?.symbol || "N/A"}) 目前價格為 ${Number(quote?.price || 0).toFixed(2)}。`,
    `漲跌：${change} (${changePercent})。`,
    `資料來源：${source}，時間：${asOf}。`,
    "以上資訊僅供參考，非投資建議。",
  ].join("\n");
};

const toPriceRangeText = (price) => {
  const numericPrice = Number(price || 0);
  if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
    return "N/A";
  }

  const lower = (numericPrice * 0.92).toFixed(2);
  const upper = (numericPrice * 1.08).toFixed(2);
  return `${lower} - ${upper}`;
};

const buildFallbackFollowupText = (content, quote) => {
  const text = String(content || "").trim();
  const symbolText = `${quote?.name || quote?.symbol || "台股"} (${quote?.symbol || "N/A"})`;
  const priceText = Number(quote?.price || 0).toFixed(2);
  const source = quote?.source || "TWSE MIS";
  const asOf = quote?.asOf || "N/A";

  if (/目標價|合理價/.test(text)) {
    return [
      `${symbolText} 現價約 ${priceText}。`,
      "目前 LLM 分析服務忙碌中，先提供保守參考框架：",
      `參考區間（以現價 ±8%）：${toPriceRangeText(quote?.price)}。`,
      "你可搭配近 4 季營收成長、毛利率與本益比區間再調整目標價。",
      `資料來源：${source}，時間：${asOf}。`,
      "以上資訊僅供參考，非投資建議。",
    ].join("\n");
  }

  if (/買點|賣點|進場|出場|停利|停損/.test(text)) {
    const stopLoss = Number.isFinite(Number(quote?.price))
      ? (Number(quote.price) * 0.95).toFixed(2)
      : "N/A";
    const takeProfit = Number.isFinite(Number(quote?.price))
      ? (Number(quote.price) * 1.1).toFixed(2)
      : "N/A";

    return [
      `${symbolText} 現價約 ${priceText}。`,
      "目前 LLM 分析服務忙碌中，先提供風險控管模板：",
      `可觀察停損參考：${stopLoss}，停利參考：${takeProfit}。`,
      "請搭配你的持有週期與可承受回撤調整，不建議單一點位重押。",
      `資料來源：${source}，時間：${asOf}。`,
      "以上資訊僅供參考，非投資建議。",
    ].join("\n");
  }

  return buildFallbackQuoteText(quote);
};

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

    const botUser = await ensureBotUser();
    await ensureBotRoomMembership(botUser.id, roomId);

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
    let replyPath = "gemini";
    try {
      const toolQuote = await executeStockTool(effectiveSymbol);
      aiText = await generateAiText(buildStockFollowupPrompt(content, toolQuote, effectiveSymbol));
      setRoomStockSession(roomId, effectiveSymbol);
    } catch (aiError) {
      console.error("群組股票 AI 回覆失敗，改用 fallback:", aiError?.message || aiError);
      replyPath = "fallback";
      if (effectiveSymbol) {
        const quote = await getTwStockQuote(effectiveSymbol);
        aiText = buildFallbackFollowupText(content, quote);
        setRoomStockSession(roomId, effectiveSymbol);
      } else {
        aiText = "目前無法取得即時股票回覆，請稍後重試，或直接再提供股票代號（例如 2330）。";
      }
    }

    if (!aiText) {
      replyPath = "fallback";
      if (effectiveSymbol) {
        const quote = await getTwStockQuote(effectiveSymbol);
        aiText = buildFallbackFollowupText(content, quote);
        setRoomStockSession(roomId, effectiveSymbol);
      } else {
        aiText = "目前無法取得即時股票回覆，請稍後重試，或直接再提供股票代號（例如 2330）。";
      }
    }

    console.log(
      `[GROUP_STOCK_AI] room=${roomId} symbol=${effectiveSymbol} REPLY_PATH=${replyPath}`
    );

    const botMessage = await saveBotMessage(botUser.id, roomId, aiText);
    emitBotMessage(io, roomId, botMessage);
  } catch (error) {
    console.error("群組股票 AI 自動回覆失敗:", error);
  }
};
