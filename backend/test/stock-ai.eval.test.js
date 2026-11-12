import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";
import { containsFuzzyStockIntent, extractSymbol } from "../src/services/stockAi/intent.js";
import { buildStockFollowupPrompt } from "../src/services/stockAi/prompt.js";
import { shouldTriggerStockAi } from "../src/services/stockAi/trigger.js";

// 固定題庫：不呼叫外部模型或 FinMind，驗證股票 AI 的觸發規則與 Prompt 護欄。
const intentCases = [
  ["查 2330 今天收盤價", true],
  ["台積電的營收年增率", true],
  ["外資今天買超哪些股票", true],
  ["0050 的殖利率是多少", true],
  ["大盤今天走勢如何", true],
  ["EPS 與本益比", true],
  ["stock quote for 2330", true],
  ["請問聊天室怎麼建立", false],
  ["明天晚上要吃什麼", false],
];

for (const [question, expected] of intentCases) {
  test(`股票意圖：${question}`, () => {
    assert.equal(containsFuzzyStockIntent(question), expected);
  });
}

const symbolCases = [
  ["2330 收盤價", "2330"],
  ["請比較 0050 與 2317", "0050"],
  ["股票代號 1101", "1101"],
  ["沒有股票代號", null],
];

for (const [question, expected] of symbolCases) {
  test(`股票代號解析：${question}`, () => {
    assert.equal(extractSymbol(question), expected);
  });
}

test("Prompt 要求使用 FinMind 工具與資料來源", () => {
  const prompt = buildStockFollowupPrompt("2330 收盤價", "2330");
  assert.match(prompt, /FinMind 官方 MCP 工具/);
  assert.match(prompt, /資料來源 FinMind/);
  assert.match(prompt, /查詢資料日期/);
});

test("Prompt 禁止杜撰數字", () => {
  const prompt = buildStockFollowupPrompt("2330 收盤價", "2330");
  assert.match(prompt, /不要杜撰數字/);
});

test("Prompt 固定要求投資免責聲明", () => {
  const prompt = buildStockFollowupPrompt("2330 可以買嗎", "2330");
  assert.match(prompt, /以上資訊僅供參考，非投資建議/);
});

test("Prompt 帶入股票代號作為 data_id", () => {
  const prompt = buildStockFollowupPrompt("查股價", "2330");
  assert.match(prompt, /data_id：2330/);
});

test("未提供股票代號時 Prompt 明確標示未知", () => {
  const prompt = buildStockFollowupPrompt("今天大盤如何", null);
  assert.match(prompt, /目前追蹤股票代號：未知/);
  assert.match(prompt, /本輪個股查詢 data_id：尚未提供/);
});

test("股票代號可觸發比較問題", () => {
  assert.equal(shouldTriggerStockAi("請比較 2330 和 2317", "eval-room-compare"), true);
});

test("Prompt 保留近期對話脈絡", () => {
  const prompt = buildStockFollowupPrompt("那成交量呢", "2330", [
    { question: "2330 收盤價", reply: "請參考 FinMind" },
  ]);

  assert.match(prompt, /第 1 輪問題：2330 收盤價/);
  assert.match(prompt, /第 1 輪回答摘要：請參考 FinMind/);
});