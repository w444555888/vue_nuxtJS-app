/** 將近期問答摘要格式化為 Gemini 可讀的對話脈絡。 */
const formatStockSessionHistory = (history = []) => {
  if (!Array.isArray(history) || history.length === 0) {
    return "無（這是本輪股票對話的第一個問題）";
  }

  return history
    .map((turn, index) => `第 ${index + 1} 輪問題：${turn.question}\n第 ${index + 1} 輪回答摘要：${turn.reply}`)
    .join("\n");
};

/**
 * 建構股票 AI 的系統規則與本輪問題。
 * 即時／歷史數據必須由 FinMind MCP 取得，不能以模型內部知識補數字。
 */
export const buildStockFollowupPrompt = (content, trackedSymbol, history = []) => {
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
