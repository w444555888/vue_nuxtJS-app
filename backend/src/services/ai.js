let genAI;
import { mcpTools } from "./mcpTools.js";

const createError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const isGeminiPermissionDeniedError = (error) => {
  const message = String(error?.message || "");
  const status = Number(error?.status || 0);

  return (
    status === 403 ||
    message.includes("PERMISSION_DENIED") ||
    message.includes("API key was reported as leaked")
  );
};

const buildGeneralFallbackReply = () => {
  return [
    "AI 客服目前暫時無法連線（模型金鑰需要更新），請稍後再試。",
    "若問題緊急，建議先聯絡技術客服：w444555888w@gmail.com",
  ].join("\n");
};

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

const TOOL_AWARE_PROMPT = `${SYSTEM_PROMPT}

你現在也支援台股查詢工具：
1. 若使用者在問台股價格、漲跌、最新狀態，請優先呼叫 get_stock_quote。
2. 不要自行捏造股價，請以工具結果為準。
3. 回答時必須附上資料來源與資料時間。
4. 回答結尾請加上：「以上資訊僅供參考，非投資建議。」`;

const normalizeChatType = (chatType) => {
  if (chatType === "group" || chatType === "private") {
    return chatType;
  }
  return "general";
};

const MODEL_NAME = "gemini-2.5-flash";
const STOCK_KEYWORD_REGEX =
  /(股票|股價|台股|上市|上櫃|大盤|漲跌|收盤|開盤|成交|\bstock\b|\bquote\b|\bshares\b)/i;
const QUOTE_INTENT_REGEX =
  /(多少|幾塊|價格|報價|最新|目前|現價|漲|跌|收盤|開盤|走勢|狀態|\bprice\b|\bquote\b|\bup\b|\bdown\b)/i;
const STOCK_FOLLOWUP_REGEX =
  /(目標價|合理價|買點|賣點|進場|出場|停利|停損|支撐|壓力|本益比|殖利率|風險|建議|分析|評估)/i;
const STOCK_SESSION_END_REGEX =
  /^(結束|結束對話|結束股票對話|停止|停止股票對話|先這樣|不用了|bye|end|stop|quit)$/i;

const stockConversationState = new Map();

const STOCK_TOOLS = [
  {
    functionDeclarations: mcpTools.definitions,
  },
];

const extractResponseText = (response) => {
  if (typeof response?.text === "string" && response.text.trim()) {
    return response.text.trim();
  }

  const parts = response?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return "";
  }

  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("\n")
    .trim();
};

const extractFunctionCalls = (response) => {
  if (Array.isArray(response?.functionCalls) && response.functionCalls.length > 0) {
    return response.functionCalls;
  }

  const parts = response?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return [];
  }

  return parts
    .map((part) => part?.functionCall)
    .filter((functionCall) => functionCall?.name);
};

const executeToolCall = async (functionCall) => {
  const { name, args } = functionCall || {};

  try {
    // 透過 MCP 工具層執行
    console.error(`[AI Service] MCP 呼叫: ${name}(symbol=${args?.symbol})`);
    const result = await mcpTools.execute(name, args);
    console.error(`[AI Service] MCP 成功: ${name} 取得 ${result?.symbol} $${result?.price}`);
    return {
      ok: true,
      data: result,
    };
  } catch (error) {
    console.error(`[AI Service] MCP 失敗:`, error.message);
    return {
      ok: false,
      error: error.message || "工具執行失敗",
      status: error.status || 500,
    };
  }
};

const hasStockKeyword = (message) => STOCK_KEYWORD_REGEX.test(message);
const hasQuoteIntent = (message) => QUOTE_INTENT_REGEX.test(message);
const hasStockFollowupIntent = (message) => STOCK_FOLLOWUP_REGEX.test(message);
const isStockSessionEndMessage = (message) => STOCK_SESSION_END_REGEX.test(String(message || "").trim());

const extractTwStockSymbol = (message) => {
  const match = String(message || "").match(/(?:^|\D)(\d{4})(?:\D|$)/);
  return match?.[1] || null;
};

const getStockSessionKey = (options = {}) => {
  const explicitSessionId = String(options?.sessionId || "").trim();
  if (explicitSessionId) {
    return `session:${explicitSessionId}`;
  }

  const userId = options?.userId ? String(options.userId) : "anonymous";
  const chatType = normalizeChatType(options?.chatType);
  return `${chatType}:${userId}`;
};

const getStockSession = (options = {}) => {
  return stockConversationState.get(getStockSessionKey(options)) || null;
};

const setStockSession = (options = {}, symbol, quote) => {
  stockConversationState.set(getStockSessionKey(options), {
    symbol,
    lastQuote: quote || null,
    updatedAt: new Date().toISOString(),
  });
};

const clearStockSession = (options = {}) => {
  stockConversationState.delete(getStockSessionKey(options));
};

const buildStockFollowupText = (quote, originalQuestion, context = {}) => {
  const safeQuestion = String(originalQuestion || "").trim();
  const trackedSymbol = context?.trackedSymbol || quote?.symbol || "未知";
  return [
    "你已收到台股工具查詢結果，請用繁體中文回覆。",
    "回答規則：簡潔、不要杜撰數字、務必提到資料來源與資料時間。",
    "若使用者問目標價、買賣點或投資建議，請明確說明無法保證預測，改提供風險觀點與可觀察指標。",
    "最後一行固定加上：以上資訊僅供參考，非投資建議。",
    `目前追蹤股票代號：${trackedSymbol}`,
    `使用者問題：${safeQuestion}`,
    `工具資料：${JSON.stringify(quote)}`,
  ].join("\n");
};

const generateStockReplyFromQuote = async (ai, userMessage, quote, context = {}) => {
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: buildStockFollowupText(quote, userMessage, context),
  });

  return extractResponseText(response);
};

const generateGeneralReply = async (ai, userMessage) => {
  try {
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `${SYSTEM_PROMPT}\n\n用戶問題：${userMessage}`,
    });

    return {
      text: extractResponseText(result),
      latestToolData: null,
    };
  } catch (error) {
    if (isGeminiPermissionDeniedError(error)) {
      return {
        text: buildGeneralFallbackReply(),
        latestToolData: null,
      };
    }

    throw error;
  }
};

const generateWithFunctionCalling = async (ai, userMessage) => {
  const contents = [
    {
      role: "user",
      parts: [{ text: `${TOOL_AWARE_PROMPT}\n\n用戶問題：${userMessage}` }],
    },
  ];

  let latestToolData = null;

  for (let i = 0; i < 3; i += 1) {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents,
      config: {
        tools: STOCK_TOOLS,
      },
    });

    const functionCalls = extractFunctionCalls(response);
    if (functionCalls.length === 0) {
      return {
        text: extractResponseText(response),
        latestToolData,
      };
    }

    contents.push({
      role: "model",
      parts: functionCalls.map((functionCall) => ({ functionCall })),
    });

    for (const functionCall of functionCalls) {
      const toolResult = await executeToolCall(functionCall);
      if (toolResult.ok && toolResult.data) {
        latestToolData = toolResult.data;
      }

      contents.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              name: functionCall.name,
              response: toolResult,
            },
          },
        ],
      });
    }
  }

  throw createError("工具呼叫次數超過上限，請稍後再試", 500);
};

const initializeAI = async () => {
  if (!genAI) {
    try {
      const { GoogleGenAI } = await import("@google/genai");
      genAI = new GoogleGenAI({
        apiKey: process.env.GOOGLE_API_KEY,
      });
    } catch (importError) {
      console.error("導入 google/genai 失敗:", importError);
      throw createError("無法初始化 AI 服務", 500);
    }
  }
  return genAI;
};

export const getAiChatResponse = async (message, options = {}) => {
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    throw createError("訊息內容不能為空", 400);
  }

  if (message.length > 100) {
    throw createError("訊息長度不能超過 100 字", 400);
  }

  const ai = await initializeAI();
  const chatType = normalizeChatType(options?.chatType);

  // 私聊與一般客服不觸發股票工具，維持純客服回覆。
  if (chatType !== "group") {
    const generalResult = await generateGeneralReply(ai, message);
    return {
      message: generalResult.text,
      stockData: null,
      timestamp: new Date(),
    };
  }

  // 若訊息包含股票關鍵字且可提取台股代號，先硬觸發工具，避免模型漏調用。
  const activeStockSession = getStockSession(options);
  if (activeStockSession && isStockSessionEndMessage(message)) {
    clearStockSession(options);
    return {
      message: "已結束本次股票對話。若要重新查詢，請再輸入台股代號（例如 2330）。",
      stockData: null,
      stockSessionActive: false,
      trackedSymbol: null,
      timestamp: new Date(),
    };
  }

  const keywordMatched = hasStockKeyword(message);
  const quoteIntentMatched = hasQuoteIntent(message);
  const followupMatched = hasStockFollowupIntent(message);
  const symbol = extractTwStockSymbol(message);
  const hasActiveSession = Boolean(activeStockSession?.symbol);
  const shouldContinueStockSession =
    hasActiveSession && (followupMatched || quoteIntentMatched || keywordMatched || !symbol);
  const targetSymbol = symbol || (shouldContinueStockSession ? activeStockSession?.symbol : null);

  if ((keywordMatched || followupMatched || quoteIntentMatched) && !targetSymbol) {
    return {
      message:
        "看起來你想查股票資訊，請提供 4 碼台股代號，例如：2330、0050、2317。",
      stockData: null,
      stockSessionActive: false,
      trackedSymbol: null,
      timestamp: new Date(),
    };
  }

  if (targetSymbol) {
    const toolResult = await executeToolCall({
      name: "get_stock_quote",
      args: { symbol: targetSymbol },
    });

    if (toolResult.ok && toolResult.data) {
      setStockSession(options, targetSymbol, toolResult.data);
      const stockReply = await generateStockReplyFromQuote(ai, message, toolResult.data, {
        trackedSymbol: targetSymbol,
      });
      return {
        message: stockReply,
        stockData: toolResult.data,
        stockSessionActive: true,
        trackedSymbol: targetSymbol,
        timestamp: new Date(),
      };
    }
  }

  const result = await generateWithFunctionCalling(ai, message);

  return {
    message: result.text,
    stockData: result.latestToolData,
    stockSessionActive: hasActiveSession,
    trackedSymbol: hasActiveSession ? activeStockSession.symbol : null,
    timestamp: new Date(),
  };
};

export const getAiHealth = () => ({
  status: "AI 客服服務正常",
});
