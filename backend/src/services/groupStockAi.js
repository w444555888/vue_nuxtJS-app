import crypto from "crypto";
import bcrypt from "bcryptjs";
import prisma from "../prisma.js";
import { generateAiText } from "./ai.js";
import { mcpTools } from "./mcpTools.js";
 
const BOT_EMAIL = process.env.STOCK_BOT_EMAIL || "stock-bot@chat.local";
const BOT_USERNAME_BASE = process.env.STOCK_BOT_USERNAME || "StockBot";

const STOCK_KEYWORD_REGEX =
  /(股票|股價|台股|上市|上櫃|興櫃|大盤|指數|加權|櫃買|漲跌|收盤|開盤|成交|量價|k線|技術線圖|均線|籌碼|法人|主力|外資|投信|自營商|買賣超|三大法人|融資|融券|借券|券資比|資券|當沖|零股|除權息|配息|殖利率|股利|eps|本益比|股價淨值比|營收|財報|基本面|技術面|消息面|\bstock\b|\bquote\b|\bshares\b|\btaiex\b|\bpe\b|\bpb\b|\byield\b)/i;
const QUOTE_INTENT_REGEX =
  /(多少|幾塊|價格|報價|最新|目前|現價|昨收|今開|最高|最低|漲|跌|漲幅|跌幅|收盤|開盤|走勢|趨勢|狀態|行情|盤勢|量能|成交量|成交值|委買|委賣|內盤|外盤|\bprice\b|\bquote\b|\bup\b|\bdown\b|\btrend\b|\bvolume\b)/i;
const STOCK_FOLLOWUP_REGEX =
  /(目標價|合理價|估值|高估|低估|買點|賣點|進場|出場|停利|停損|支撐|壓力|突破|回檔|區間|本益比|殖利率|股價淨值比|配息|股利|財報|營收|毛利率|營益率|淨利率|eps|法人買賣超|外資買賣超|投信買賣超|自營商買賣超|三大法人|籌碼|融資融券|風險|建議|分析|評估|可以買|要不要買|值不值得|可不可以進場)/i;
const STOCK_FUZZY_CONTEXT_REGEX =
  /(法人|三大法人|買超|賣超|外資|投信|自營商|主力|籌碼|融資|融券|借券|券資比|當沖|量縮|量增|爆量|套牢|解套|停利|停損|支撐|壓力|突破|回測|回檔|填息|除息|除權|配股|配息|股息|殖利率|本益比|股價淨值比|營收|財報|eps|taiex|加權指數|櫃買指數|盤勢|技術面|基本面|消息面)/i;
const STOCK_SESSION_END_REGEX =
  /^(結束|結束對話|結束股票對話|停止|停止股票對話|先這樣|不用了|bye|end|stop|quit)$/i;
const STOCK_SESSION_RESET_REGEX =
  /^(重置|重置對話|重置股票對話|清除股票對話|reset)$/i;

const SYMBOL_REGEX = /(?:^|\D)(\d{4})(?:\D|$)/; // 提取 4 碼股票代號，確保前後不是數字，避免誤抓其他數字串。
const STOCK_SESSION_TTL_MS = 15 * 60 * 1000; // 股票對話狀態的有效期限，15 分鐘內有互動則持續有效，超過則自動失效。

const roomStockSessions = new Map(); // roomId -> { trackedSymbol, updatedAt }

const getRoomSessionKey = (roomId) => String(roomId);

// 取得房間的股票對話狀態，包含目前追蹤的股票代號與最後更新時間。若狀態不存在或已過期，則回傳 null。
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

/**
 * 判斷是否應該觸發股票 AI 回覆
 * @param {*} content 使用者輸入的訊息內容
 * @param {*} roomId 房間 ID
 * @returns {boolean} 是否應該觸發股票 AI 回覆
 *  結束/重置命令：只在有活躍會話時觸發
 *  包含 4 碼股票代號：直接觸發
 *  股票相關關鍵字：觸發（股價、漲跌、買點等）
 *  價格查詢意圖：觸發（多少、幾塊、現價等）
 *  無相關內容時不觸發（避免干擾一般群聊）
 */
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

// 從使用者訊息中提取 4 碼股票代號
const extractSymbol = (content) => {
  const text = String(content || "");
  const match = text.match(SYMBOL_REGEX);
  return match?.[1] || null;
};

// 呼叫智能 API 選擇器：根據用戶查詢內容動態決定要取得哪些資料
const executeStockTool = async (symbol, userQuery) => {
  try {
    return await mcpTools.execute("get_stock_context", {
      symbol,
      userQuery,
    });
  } catch (error) {
    console.error(`股票工具執行失敗 (${symbol}):`, error?.message);
    return null;
  }
};

// 建構給 AI 的提示語，包含使用者問題、工具回覆的股票資訊。
const buildStockFollowupPrompt = (content, quoteData, trackedSymbol) => {
  // 支援舊格式（單個quote）和新格式（多API結果）
  const quote = quoteData?.base || quoteData;
  const availableSections = [
    "base",
    "margin",
    "borrowable",
    "monthly",
    "yearly",
    "volatility",
    "index",
    "topVolume20",
    "crossMarket",
    "legalEntityTop",
    "dividendInfo",
  ].filter((key) => {
    const value = quoteData?.[key];
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    return Boolean(value);
  });
  
  return [
    "你已收到台股工具查詢結果，請用繁體中文回覆。",
    "回答規則：簡潔、不要杜撰數字、務必提到資料來源與資料時間。",
    "若工具資料含有本益比、殖利率、股價淨值比、開高低收與成交資訊，請優先引用這些欄位再進行說明。",
    "若有籌碼、波動、月/年區間或大盤欄位，請至少引用 1-2 個與問題最相關的數字。",
    "若使用者問目標價、買賣點或投資建議，請明確說明無法保證預測，改提供風險觀點與可觀察指標。",
    "最後一行固定加上：以上資訊僅供參考，非投資建議。",
    `目前追蹤股票代號：${trackedSymbol || quote?.symbol || "未知"}`,
    `可用資料區塊：${availableSections.length ? availableSections.join(", ") : "base"}`,
    `使用者問題：${String(content || "").trim()}`,
    `工具資料：${JSON.stringify(quoteData)}`,
  ].join("\n");
};

/**
 * 確保 AI Bot 的使用者帳號存在，若不存在則嘗試建立。
 * 由於 Bot 帳號具有特殊性（固定 email、可能的 username 衝突），因此採取以下策略：
 * 1. 嘗試以固定 email 查找使用者，若存在則直接回傳。
 * 2. 若 email 不存在，嘗試建立新使用者，username 從固定基底開始，若有衝突則加數字後綴（例如 StockBot、StockBot1、StockBot2...），最多嘗試 5 次。
 * 3. 若嘗試建立使用者時發生非唯一約束錯誤，則繼續嘗試下一個 username；若發生其他錯誤，則拋出。
 * 4. 若所有嘗試都失敗，則拋出無法建立 AI Bot 帳號的錯誤。
 * 這樣的策略可以確保在大多數情況下都能成功取得或建立 AI Bot 帳號，並且避免因為 username 衝突導致的問題。
 * @returns {Promise<Object>} AI Bot 使用者資料
 */
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

// 確保 AI Bot 是房間成員，若不是則加入房間。這樣可以確保 Bot 有權限在房間內發送訊息。
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

// 儲存 Bot 的回覆訊息到資料庫，並包含使用者資料以便後續發送給前端。
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

// 將 Bot 的回覆訊息透過 Socket.IO 發送給房間內的使用者，包含訊息內容與使用者資料。
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

/**
 * 當 AI 回覆無法取得或產生時，根據目前可用的股票資訊建構一個 fallback 的回覆內容。
 * 這個回覆會包含股票的基本行情資訊（價格、漲跌、資料來源與時間），並且根據使用者的問題類型（例如目標價、買賣點）提供一些保守的參考框架或風險控管建議。
 * 這樣可以確保即使 AI 分析服務暫時無法使用，使用者仍然能夠獲得一些有用的資訊，而不是完全沒有回覆。
 */
const buildFallbackQuoteText = (quote) => {
  const priceText = formatMaybeNumber(quote?.price);
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
  const peText = Number.isFinite(quote?.peRatio) ? quote.peRatio.toFixed(2) : "N/A";
  const dividendYieldText = Number.isFinite(quote?.dividendYield)
    ? `${quote.dividendYield.toFixed(2)}%`
    : "N/A";
  const pbText = Number.isFinite(quote?.pbRatio) ? quote.pbRatio.toFixed(2) : "N/A";
  const dayOpenText = Number.isFinite(quote?.dayOpen) ? quote.dayOpen.toFixed(2) : "N/A";
  const dayHighText = Number.isFinite(quote?.dayHigh) ? quote.dayHigh.toFixed(2) : "N/A";
  const dayLowText = Number.isFinite(quote?.dayLow) ? quote.dayLow.toFixed(2) : "N/A";
  const dayCloseText = Number.isFinite(quote?.dayClose) ? quote.dayClose.toFixed(2) : "N/A";
  const tradeValueText = Number.isFinite(quote?.tradeValueDay)
    ? Math.round(quote.tradeValueDay).toLocaleString("zh-TW")
    : "N/A";
  const transactionCountText = Number.isFinite(quote?.transactionCount)
    ? Math.round(quote.transactionCount).toLocaleString("zh-TW")
    : "N/A";

  return [
    `${quote?.name || quote?.symbol || "台股"} (${quote?.symbol || "N/A"}) 目前價格為 ${priceText}。`,
    `漲跌：${change} (${changePercent})。`,
    `估值參考：本益比 ${peText}、殖利率 ${dividendYieldText}、股價淨值比 ${pbText}。`,
    `日線摘要：開 ${dayOpenText} / 高 ${dayHighText} / 低 ${dayLowText} / 收 ${dayCloseText}。`,
    `成交概況：成交金額 ${tradeValueText}、成交筆數 ${transactionCountText}。`,
    `資料來源：${source}，時間：${asOf}。`,
    "以上資訊僅供參考，非投資建議。",
  ].join("\n");
};

const formatMaybeNumber = (value, digits = 2) => {
  if (!Number.isFinite(value)) {
    return "N/A";
  }
  return Number(value).toFixed(digits);
};

const formatMaybeInteger = (value) => {
  if (!Number.isFinite(value)) {
    return "N/A";
  }
  return Math.round(value).toLocaleString("zh-TW");
};

const buildExtendedContextLines = (quoteData) => {
  const lines = [];

  if (quoteData?.margin || quoteData?.borrowable) {
    const marginBuy = formatMaybeInteger(quoteData?.margin?.marginBuyBalance);
    const marginSell = formatMaybeInteger(quoteData?.margin?.marginSellBalance);
    const shortSell = formatMaybeInteger(quoteData?.margin?.shortSellBalance);
    const borrowedShares = formatMaybeInteger(quoteData?.borrowable?.borrowedShares);
    lines.push(
      `籌碼概況：融資餘額 ${marginBuy}、融券餘額 ${marginSell}、借券賣出 ${shortSell}、借券餘額 ${borrowedShares}。`
    );
  }

  if (quoteData?.volatility) {
    const volatilityChange = formatMaybeNumber(quoteData.volatility.priceChange);
    const volatilityPct = Number.isFinite(quoteData?.volatility?.priceChangePercent)
      ? `${Number(quoteData.volatility.priceChangePercent).toFixed(2)}%`
      : "N/A";
    lines.push(`波動參考：波動值 ${volatilityChange}、波動率 ${volatilityPct}。`);
  }

  if (quoteData?.monthly || quoteData?.yearly) {
    const monthlyHigh = formatMaybeNumber(quoteData?.monthly?.monthlyHigh);
    const monthlyLow = formatMaybeNumber(quoteData?.monthly?.monthlyLow);
    const yearlyHigh = formatMaybeNumber(quoteData?.yearly?.yearlyHigh);
    const yearlyLow = formatMaybeNumber(quoteData?.yearly?.yearlyLow);
    lines.push(`區間參考：月高低 ${monthlyHigh}/${monthlyLow}，年高低 ${yearlyHigh}/${yearlyLow}。`);
  }

  if (quoteData?.index || quoteData?.crossMarket) {
    const indexName = quoteData?.index?.IndexName || quoteData?.index?.指數名稱 || "加權指數";
    const indexClose =
      quoteData?.index?.ClosingIndex || quoteData?.index?.收盤指數 || quoteData?.index?.IndexValue;
    const tpexClose = quoteData?.crossMarket?.OTCIndex || quoteData?.crossMarket?.櫃買指數;
    lines.push(
      `大盤概況：${indexName} ${formatMaybeNumber(Number(indexClose))}，櫃買指數 ${formatMaybeNumber(Number(tpexClose))}。`
    );
  }

  return lines;
};

// 根據目前價格計算一個參考的價格區間（以現價 ±8% 為例），並格式化為文字。若價格無效則回傳 "N/A"。
const toPriceRangeText = (price) => {
  const numericPrice = Number(price || 0);
  if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
    return "N/A";
  }

  const lower = (numericPrice * 0.92).toFixed(2);
  const upper = (numericPrice * 1.08).toFixed(2);
  return `${lower} - ${upper}`;
};

// 呼叫 MCP 工具取得股票報價，並在失敗時回傳 null。這樣可以讓呼叫者根據是否有工具資料來決定後續的回覆內容。
const buildFallbackFollowupText = (content, quoteData) => {
  const quote = quoteData?.base || quoteData;
  const text = String(content || "").trim();
  const symbolText = `${quote?.name || quote?.symbol || "台股"} (${quote?.symbol || "N/A"})`;
  const priceText = formatMaybeNumber(quote?.price);
  const source = quote?.source || "TWSE MIS";
  const asOf = quote?.asOf || "N/A";
  const extendedContextLines = buildExtendedContextLines(quoteData);

  if (/目標價|合理價/.test(text)) {
    const lines = [
      `${symbolText} 現價約 ${priceText}。`,
      "目前 LLM 分析服務忙碌中，先提供保守參考框架：",
      `參考區間（以現價 ±8%）：${toPriceRangeText(quote?.price)}。`,
      "你可搭配近 4 季營收成長、毛利率與本益比區間再調整目標價。",
    ];

    lines.push(...extendedContextLines);
    lines.push(`資料來源：${source}，時間：${asOf}。`);
    lines.push("以上資訊僅供參考，非投資建議。");
    return lines.join("\n");
  }

  if (/買點|賣點|進場|出場|停利|停損/.test(text)) {
    const stopLoss = Number.isFinite(Number(quote?.price))
      ? (Number(quote.price) * 0.95).toFixed(2)
      : "N/A";
    const takeProfit = Number.isFinite(Number(quote?.price))
      ? (Number(quote.price) * 1.1).toFixed(2)
      : "N/A";

    const lines = [
      `${symbolText} 現價約 ${priceText}。`,
      "目前 LLM 分析服務忙碌中，先提供風險控管模板：",
      `可觀察停損參考：${stopLoss}，停利參考：${takeProfit}。`,
      "請搭配你的持有週期與可承受回撤調整，不建議單一點位重押。",
    ];

    lines.push(...extendedContextLines);
    lines.push(`資料來源：${source}，時間：${asOf}。`);
    lines.push("以上資訊僅供參考，非投資建議。");
    return lines.join("\n");
  }

  const baseLines = buildFallbackQuoteText(quote).split("\n");
  if (extendedContextLines.length > 0) {
    baseLines.splice(baseLines.length - 2, 0, ...extendedContextLines);
  }
  return baseLines.join("\n");
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
    let replyPath = "gemini";
    let toolQuote = null;

    try {
      toolQuote = await executeStockTool(effectiveSymbol, content);
      aiText = await generateAiText(buildStockFollowupPrompt(content, toolQuote, effectiveSymbol));
      setRoomStockSession(roomId, effectiveSymbol);
    } catch (aiError) {
      console.error("群組股票 AI 回覆失敗，改用 fallback:", aiError?.message || aiError);
      replyPath = "fallback";
      if (toolQuote?.base) {
        aiText = buildFallbackFollowupText(content, toolQuote);
        setRoomStockSession(roomId, effectiveSymbol);
      } else {
        aiText = "目前無法取得即時股票行情，請稍後重試，或再次提供股票代號（例如 2330）。";
      }
    }

    if (!aiText) {
      replyPath = "fallback";
      if (toolQuote?.base) {
        aiText = buildFallbackFollowupText(content, toolQuote);
        setRoomStockSession(roomId, effectiveSymbol);
      } else {
        aiText = "目前無法取得即時股票行情，請稍後重試，或再次提供股票代號（例如 2330）。";
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
