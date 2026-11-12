import crypto from "crypto";
import bcrypt from "bcryptjs";
import prisma from "../prisma.js";
import logger from "../utils/logger.js";
import { GEMINI_MODEL, generateAiText, isTransientGeminiOverload } from "./ai.js";
import { mcpTools } from "./mcpTools.js";
import { extractSymbol } from "./stockAi/intent.js";
import {
  clearRoomStockSession,
  getRoomStockSession,
  setRoomStockSession,
} from "./stockAi/session.js";
import { buildStockFollowupPrompt } from "./stockAi/prompt.js";
import {
  isStockSessionEndMessage,
  isStockSessionResetMessage,
  shouldTriggerStockAi,
} from "./stockAi/trigger.js";

// 向後相容：測試或既有程式仍可從 groupStockAi 匯入這些純函式。
export { containsFuzzyStockIntent, extractSymbol } from "./stockAi/intent.js";
export { buildStockFollowupPrompt } from "./stockAi/prompt.js";
export { shouldTriggerStockAi } from "./stockAi/trigger.js";

// 股票 AI 協調層：判斷觸發時機、呼叫 Gemini/FinMind，並將 Bot 回覆寫入與推送至聊天室。
const BOT_EMAIL = process.env.STOCK_BOT_EMAIL || "stock-bot@chat.local";
const BOT_USERNAME_BASE = process.env.STOCK_BOT_USERNAME || "StockBot";

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
  let stockAiStatusStarted = false;

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
    const aiStartedAt = Date.now();
    let mcpToolReady = false;

    try {
      // 只在實際開始 Gemini／FinMind 查詢時顯示狀態，避免一般提示訊息產生無意義動畫。
      io.to(`room_${roomId}`).emit("stock_ai_status", {
        roomId,
        status: "thinking",
        message: "股票 AI 正在查詢 FinMind 資料並整理回覆…",
      });
      stockAiStatusStarted = true;

      const finMindMcpTool = await mcpTools.getGeminiTool();
      mcpToolReady = true;
      aiText = await generateAiText(
        buildStockFollowupPrompt(content, effectiveSymbol, relevantHistory),
        { tools: [finMindMcpTool] },
        {
          onSuccess: (metrics) => {
            logger.info(`LLM_METRIC ${JSON.stringify({
              event: "stock_ai_completed",
              model: GEMINI_MODEL,
              roomId,
              stockSymbol: effectiveSymbol,
              mcpToolReady,
              ...metrics,
            })}`);
          },
          onError: (metrics) => {
            logger.error(`LLM_METRIC ${JSON.stringify({
              event: "stock_ai_failed",
              model: GEMINI_MODEL,
              roomId,
              stockSymbol: effectiveSymbol,
              mcpToolReady,
              ...metrics,
            })}`);
          },
        }
      );
    } catch (aiError) {
      logger.error("群組股票 MCP AI 回覆失敗", {
        message: aiError?.message || String(aiError),
        name: aiError?.name,
        code: aiError?.code || aiError?.status,
        stack: aiError?.stack,
      });
      replyPath = "fallback";
      aiText = isTransientGeminiOverload(aiError)
        ? "目前 AI 服務請求量較高，請稍後再試一次。"
        : "目前無法透過 FinMind MCP 取得股票資料，請稍後重試。";
    }

    if (!aiText) {
      replyPath = "fallback";
      aiText = "目前無法透過 FinMind MCP 取得股票資料，請稍後重試。";
    }

    logger.info(`LLM_FLOW ${JSON.stringify({
      event: "stock_ai_reply",
      model: GEMINI_MODEL,
      roomId,
      stockSymbol: effectiveSymbol,
      replyPath,
      mcpToolReady,
      totalLatencyMs: Date.now() - aiStartedAt,
    })}`);

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
  } finally {
    if (stockAiStatusStarted) {
      io.to(`room_${roomId}`).emit("stock_ai_status", {
        roomId,
        status: "idle",
      });
    }
  }
};
