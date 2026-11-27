import * as echarts from "echarts";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import { getMCPClient } from "../../../mcp/client.js";
import { uploadImageBuffer } from "../../utils/cloudinary.js";
import logger from "../../utils/logger.js";

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

const MAX_CHART_DAYS = 366;
const CHART_WIDTH = 1200;
const CHART_HEIGHT = 760;
const CHART_COLORS = {
  background: "#0b1220",
  panel: "#111b2e",
  grid: "#26344b",
  text: "#d8e1ef",
  muted: "#8fa0b8",
  up: "#f05252",
  down: "#20b486",
  ma5: "#fbbf24",
  ma20: "#60a5fa",
};

const CHINESE_COUNTS = {
  一: 1,
  二: 2,
  兩: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
  十二: 12,
};

/** 將阿拉伯數字或支援的中文數字轉成數值。 */
const parseCount = (value) => {
  if (/^\d+$/.test(value)) return Number(value);
  return CHINESE_COUNTS[value] || null;
};

/** 驗證字串是否為真實有效的 YYYY-MM-DD 日期。 */
const isValidIsoDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = dayjs.utc(value, "YYYY-MM-DD", true);
  return parsed.isValid() && parsed.format("YYYY-MM-DD") === value;
};

/** 將輸入的時間點轉成台灣時區當日零時。 */
const getTaiwanToday = (date) => {
  return dayjs(date).tz("Asia/Taipei").startOf("day");
};

/** 往前減指定月數，dayjs會依目標月份調整月底日期。 */
const subtractCalendarMonths = (date, months) => {
  return date.subtract(months, "month");
};

/** 判斷訊息是否要求單股圖表；多個股票代號交由比較流程處理。 */
export const isStockChartRequest = (content) => {
  const text = String(content || "").toLowerCase().replace(/\s+/g, "");
  const symbols = [...text.matchAll(/(?:^|\D)(\d{4})(?=\D|$)/g)];
  if (symbols.length > 1) return false;

  return /(?:k線(?:走勢)?圖|k棒圖|kbar(?:圖|chart)?|candlestick(?:chart)?|蠟燭圖|技術線圖|股價(?:走勢)?圖|走勢圖|(?:幫我|幫忙)?(?:做成|畫成|產生|生成)?(?:一張)?(?:圖表|圖)|畫個圖|請畫圖)/i.test(text);
};

/** 依明確日期或自然語言期間，計算 FinMind 查詢用的起訖日。 */
export const resolveStockChartRange = (content, now = new Date()) => {
  const text = String(content || "").replace(/\s+/g, "");
  const explicitRange = text.match(/(\d{4}-\d{2}-\d{2})(?:至|到|~|～)(\d{4}-\d{2}-\d{2})/);
  let start;
  const today = getTaiwanToday(now);
  let end = today;

  if (explicitRange) {
    const [, startDate, endDate] = explicitRange;
    if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate) || startDate > endDate) {
      throw new Error("K 線圖日期區間無效，請使用 YYYY-MM-DD 至 YYYY-MM-DD。");
    }
    start = dayjs.tz(startDate, "YYYY-MM-DD", "Asia/Taipei");
    end = dayjs.tz(endDate, "YYYY-MM-DD", "Asia/Taipei");
    if (end.isAfter(today, "day")) {
      throw new Error("K 線圖的結束日期不能晚於今天。");
    }
  } else {
    const period = text.match(/近(半年|十二|\d{1,3}|[一二兩三四五六七八九十]+)(天|日|週|周|個月|月|年)?/);
    const amountText = period?.[1] || "三";
    const unit = period?.[2] || "個月";
    const amount = amountText === "半年" ? 6 : parseCount(amountText);

    if (!amount || amount < 1) {
      throw new Error("無法辨識 K 線圖時間範圍，請指定例如「近三個月」或日期區間。");
    }

    start = end;
    if (unit === "年") {
      start = subtractCalendarMonths(start, amount * 12);
    } else if (unit === "個月" || unit === "月" || amountText === "半年") {
      start = subtractCalendarMonths(start, amount);
    } else {
      const days = unit === "週" || unit === "周" ? amount * 7 : amount;
      start = start.subtract(days, "day");
    }
  }

  const dayCount = end.diff(start, "day") + 1;
  if (dayCount > MAX_CHART_DAYS) {
    throw new Error("目前 K 線圖最多支援一年資料，請縮短查詢區間。");
  }
  if (dayCount < 1) {
    throw new Error("K 線圖日期區間無效。");
  }

  return {
    startDate: start.format("YYYY-MM-DD"),
    endDate: end.format("YYYY-MM-DD"),
  };
};

/** 將一列 Markdown表格拆成欄位並還原跳脫的直線符號。 */
const splitMarkdownTableRow = (line) => line
  .trim()
  .replace(/^\|/, "")
  .replace(/\|$/, "")
  .split(/(?<!\\)\|/)
  .map((cell) => cell.trim().replaceAll("\\|", "|"));

/** 將含千分位逗號的欄位轉為有限數字，無效值回傳 null。 */
const toFiniteNumber = (value) => {
  const parsed = Number(String(value || "").replaceAll(",", "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};

/** 從 FinMind回傳的 Markdown中解析、驗證並排序 OHLCV日線資料。 */
export const parseFinMindPriceTable = (markdown) => {
  const lines = String(markdown || "").split(/\r?\n/);
  let headerIndex = -1;
  let headers = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line.startsWith("|") || !line.endsWith("|")) continue;
    const candidate = splitMarkdownTableRow(line).map((cell) => cell.toLowerCase());
    if (["date", "open", "max", "min", "close"].every((field) => candidate.includes(field))) {
      headerIndex = index;
      headers = candidate;
      break;
    }
  }

  if (headerIndex < 0) {
    throw new Error("FinMind 回傳資料缺少 K 線所需欄位。");
  }

  const rows = [];
  for (const line of lines.slice(headerIndex + 1)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
      if (rows.length) break;
      continue;
    }

    const cells = splitMarkdownTableRow(trimmed);
    if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
    const record = Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""]));
    const row = {
      date: record.date,
      open: toFiniteNumber(record.open),
      high: toFiniteNumber(record.max),
      low: toFiniteNumber(record.min),
      close: toFiniteNumber(record.close),
      volume: toFiniteNumber(record.trading_volume ?? record.volume) ?? 0,
    };

    if (
      isValidIsoDate(row.date) &&
      [row.open, row.high, row.low, row.close].every(Number.isFinite) &&
      row.high >= row.low
    ) {
      rows.push(row);
    }
  }

  rows.sort((a, b) => a.date.localeCompare(b.date));
  if (!rows.length) {
    throw new Error("FinMind 沒有回傳可繪製的 K 線資料。");
  }
  return rows;
};

/** 依收盤價計算指定交易日週期的簡單移動平均。 */
const movingAverage = (rows, period) => rows.map((row, index) => {
  if (index + 1 < period) return null;
  const windowRows = rows.slice(index + 1 - period, index + 1);
  return windowRows.reduce((total, item) => total + item.close, 0) / period;
});

/** 使用 ECharts SSR產生包含日K、移動平均與成交量的 SVG圖表。 */
export const renderCandlestickSvg = ({ symbol, rows, startDate, endDate }) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("沒有 K 線資料可繪製。");
  }

  const dates = rows.map((row) => row.date);
  const ma5 = movingAverage(rows, 5);
  const ma20 = movingAverage(rows, 20);
  const volumeData = rows.map((row) => ({
    value: row.volume,
    itemStyle: {
      color: row.close >= row.open ? CHART_COLORS.up : CHART_COLORS.down,
    },
  }));
  const chart = echarts.init(null, null, {
    renderer: "svg",
    ssr: true,
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
  });

  try {
    chart.setOption({
      animation: false,
      backgroundColor: CHART_COLORS.background,
      textStyle: {
        color: CHART_COLORS.text,
        fontFamily: "Arial, sans-serif",
      },
      title: {
        text: `${symbol} 日 K 線`,
        subtext: `${startDate} ～ ${endDate}  |  ${rows.length} 個交易日  |  FinMind`,
        left: 28,
        top: 14,
        textStyle: { color: CHART_COLORS.text, fontSize: 22, fontWeight: 700 },
        subtextStyle: { color: CHART_COLORS.muted, fontSize: 13 },
      },
      legend: {
        data: ["MA5", "MA20", "成交量"],
        top: 62,
        right: 34,
        textStyle: { color: CHART_COLORS.text },
        itemWidth: 18,
        itemHeight: 10,
      },
      grid: [
        { left: 76, right: 34, top: 112, height: "54%", containLabel: false },
        { left: 76, right: 34, top: "75%", height: "14%", containLabel: false },
      ],
      xAxis: [
        {
          type: "category",
          data: dates,
          boundaryGap: true,
          axisLine: { lineStyle: { color: CHART_COLORS.grid } },
          axisTick: { show: false },
          axisLabel: {
            color: CHART_COLORS.muted,
            hideOverlap: true,
            formatter: (value) => value.slice(5),
          },
          splitLine: { show: false },
        },
        {
          type: "category",
          gridIndex: 1,
          data: dates,
          boundaryGap: true,
          axisLine: { lineStyle: { color: CHART_COLORS.grid } },
          axisTick: { show: false },
          axisLabel: {
            color: CHART_COLORS.muted,
            hideOverlap: true,
            formatter: (value) => value.slice(5),
          },
          splitLine: { show: false },
        },
      ],
      yAxis: [
        {
          scale: true,
          splitNumber: 6,
          axisLabel: { color: CHART_COLORS.muted },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { lineStyle: { color: CHART_COLORS.grid } },
        },
        {
          gridIndex: 1,
          scale: true,
          splitNumber: 2,
          axisLabel: { show: false },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: "K線",
          type: "candlestick",
          data: rows.map((row) => [row.open, row.close, row.low, row.high]),
          itemStyle: {
            color: CHART_COLORS.up,
            color0: CHART_COLORS.down,
            borderColor: CHART_COLORS.up,
            borderColor0: CHART_COLORS.down,
          },
        },
        {
          name: "MA5",
          type: "line",
          data: ma5,
          showSymbol: false,
          connectNulls: false,
          lineStyle: { color: CHART_COLORS.ma5, width: 2 },
          z: 3,
        },
        {
          name: "MA20",
          type: "line",
          data: ma20,
          showSymbol: false,
          connectNulls: false,
          lineStyle: { color: CHART_COLORS.ma20, width: 2 },
          z: 3,
        },
        {
          name: "成交量",
          type: "bar",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: volumeData,
          barMaxWidth: 12,
        },
      ],
    });
    return chart.renderToSVGString({ useViewBox: true });
  } finally {
    chart.dispose();
  }
};

/** 查詢 FinMind日價、產生 K線 SVG並上傳 Cloudinary，回傳聊天室訊息資料。 */
export const createFinMindStockChart = async ({ symbol, content, now = new Date() }) => {
  const { startDate, endDate } = resolveStockChartRange(content, now);
  const client = await getMCPClient();
  const result = await client.callTool({
    name: "query_dataset",
    arguments: {
      dataset: "TaiwanStockPrice",
      data_id: symbol,
      start_date: startDate,
      end_date: endDate,
    },
  });

  logger.info(`FINMIND_MCP_RESPONSE ${JSON.stringify({
    event: "finmind_mcp_response",
    tool: "query_dataset",
    dataset: "TaiwanStockPrice",
    dataId: symbol,
    startDate,
    endDate,
    isError: Boolean(result?.isError),
    content: result?.content ?? null,
  })}`);

  if (result?.isError) {
    const details = result.content?.filter((item) => item?.type === "text").map((item) => item.text).join("\n");
    throw new Error(details || "FinMind K 線資料查詢失敗。");
  }

  const markdown = result?.content
    ?.filter((item) => item?.type === "text")
    .map((item) => item.text)
    .join("\n") || "";
  const rows = parseFinMindPriceTable(markdown);
  const svg = renderCandlestickSvg({ symbol, rows, startDate, endDate });
  const upload = await uploadImageBuffer(Buffer.from(svg, "utf8"), {
    folder: "stock-charts",
    public_id: `stock-${symbol}-${Date.now()}`,
    resource_type: "image",
    format: "svg",
  });

  if (!upload?.secure_url) {
    throw new Error("K 線圖已產生，但圖片儲存服務未回傳可用網址。");
  }

  return {
    text: `${symbol} 日 K 線圖（${rows[0].date} 至 ${rows[rows.length - 1].date}，共 ${rows.length} 個交易日）。資料來源：FinMind。以上資訊僅供參考，非投資建議。`,
    imageUrl: upload.secure_url,
    replyPath: "finmind-kline-chart",
    mcpToolReady: true,
  };
};