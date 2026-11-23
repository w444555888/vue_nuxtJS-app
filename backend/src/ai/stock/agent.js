import { generateAiText } from "../core/gemini.js";
import { getFinMindGeminiTool } from "../tools/finmind.js";
import { buildStockFollowupPrompt } from "./prompt.js";
import { validateStockInput, validateStockOutput } from "../guardrails/stockGuardrails.js";

export const runStockAgent = async ({ content, effectiveSymbol, history = [], observability = {} }) => {
  const input = validateStockInput(content);
  if (!input.allowed) {
    return {
      text: "無法處理此股票問題，請重新提供明確且不包含系統指令的股票代號或問題。",
      replyPath: "guardrail",
      mcpToolReady: false,
    };
  }

  const finMindMcpTool = await getFinMindGeminiTool();
  const text = await generateAiText(
    buildStockFollowupPrompt(content, effectiveSymbol, history),
    { tools: [finMindMcpTool] },
    observability,
  );

  const output = validateStockOutput(text);
  if (!output.allowed) {
    return {
      text: "目前無法確認可靠資料來源，因此不提供保證報酬或無法驗證的投資結論。以上資訊僅供參考，非投資建議。",
      replyPath: "guardrail",
      mcpToolReady: true,
    };
  }

  return { text, replyPath: "gemini-finmind-mcp", mcpToolReady: true };
};
