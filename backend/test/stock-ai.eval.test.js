import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";
import { containsFuzzyStockIntent, extractSymbol } from "../src/ai/stock/intent.js";
import { buildStockFollowupPrompt } from "../src/ai/stock/prompt.js";
import { shouldTriggerStockAi } from "../src/ai/stock/trigger.js";
import {
  isStockChartRequest,
  parseFinMindPriceTable,
  renderCandlestickSvg,
  resolveStockChartRange,
} from "../src/ai/stock/chart.js";

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

test("K 線圖請求可被辨識", () => {
  assert.equal(isStockChartRequest("請幫我畫 2330 近三個月 K 線圖"), true);
  assert.equal(isStockChartRequest("2454（聯發科）近三個月的 K 線圖"), true);
  assert.equal(isStockChartRequest("幫我畫 2454 近三個月股價走勢圖"), true);
  assert.equal(isStockChartRequest("比較 2330 與 2317 並畫圖"), false);
  assert.equal(isStockChartRequest("查 2330 今天收盤價"), false);
});

test("K 線圖日期預設近三個月並限制最多一年", () => {
  const now = new Date("2026-11-27T12:00:00.000Z");
  assert.deepEqual(resolveStockChartRange("2330 近三個月 K 線圖", now), {
    startDate: "2026-08-27",
    endDate: "2026-11-27",
  });
  assert.deepEqual(resolveStockChartRange("2330 2026-08-01 至 2026-08-31 K 線圖", now), {
    startDate: "2026-08-01",
    endDate: "2026-08-31",
  });
  assert.equal(
    resolveStockChartRange("2330 K 線圖", new Date("2026-01-01T18:00:00.000Z")).endDate,
    "2026-01-02",
  );
  assert.equal(resolveStockChartRange("2330 近一年 K 線圖", now).startDate, "2025-11-27");
  assert.throws(
    () => resolveStockChartRange("2330 近兩年 K 線圖", now),
    /最多支援一年/,
  );
});

test("解析 FinMind 日價 Markdown 欄位並依日期排序", () => {
  const rows = parseFinMindPriceTable([
    "### TaiwanStockPrice",
    "| date | stock_id | open | max | min | close | Trading_Volume |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    "| 2026-01-02 | 2330 | 101 | 105 | 99 | 104 | 1,200 |",
    "| 2026-01-01 | 2330 | 100 | 102 | 98 | 101 | 900 |",
  ].join("\n"));

  assert.deepEqual(rows, [
    { date: "2026-01-01", open: 100, high: 102, low: 98, close: 101, volume: 900 },
    { date: "2026-01-02", open: 101, high: 105, low: 99, close: 104, volume: 1200 },
  ]);
});

test("K 線圖可輸出含均線與成交量的 SVG", () => {
  const svg = renderCandlestickSvg({
    symbol: "2330",
    startDate: "2026-01-01",
    endDate: "2026-01-02",
    rows: [
      { date: "2026-01-01", open: 100, high: 102, low: 98, close: 101, volume: 900 },
      { date: "2026-01-02", open: 101, high: 105, low: 99, close: 104, volume: 1200 },
    ],
  });

  assert.match(svg, /<svg/);
  assert.match(svg, /MA5/);
  assert.match(svg, /MA20/);
  assert.match(svg, /成交量/);
  assert.match(svg, /2026-01-01/);
});

test("Prompt 保留近期對話脈絡", () => {
  const prompt = buildStockFollowupPrompt("那成交量呢", "2330", [
    { question: "2330 收盤價", reply: "請參考 FinMind" },
  ]);

  assert.match(prompt, /第 1 輪問題：2330 收盤價/);
  assert.match(prompt, /第 1 輪回答摘要：請參考 FinMind/);
});