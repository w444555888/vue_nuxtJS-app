// 股票意圖判斷：僅用於尚未進入股票對話時，避免股票 Bot 打擾一般群聊。
const STOCK_INTENT_KEYWORDS = [
  // 市場、行情與交易
  "股票", "股價", "台股", "上市", "上櫃", "興櫃", "大盤", "指數", "加權", "櫃買",
  "漲跌", "收盤", "開盤", "成交", "量價", "k線", "技術線圖", "均線", "多少", "幾塊",
  "價格", "報價", "最新", "目前", "現價", "昨收", "今開", "最高", "最低", "漲",
  "跌", "漲幅", "跌幅", "走勢", "趨勢", "狀態", "行情", "盤勢", "量能", "成交量",
  "成交值", "委買", "委賣", "內盤", "外盤", "量縮", "量增", "爆量",
  // 籌碼與交易制度
  "籌碼", "法人", "主力", "外資", "投信", "自營商", "買賣超", "買超", "賣超", "三大法人",
  "融資", "融券", "借券", "券資比", "資券", "當沖", "零股", "八大行庫", "官股",
  // 股利、財務與基本面
  "除權息", "除息", "除權", "配股", "配息", "股息", "殖利率", "股利", "本益比", "股價淨值比",
  "營收", "月增", "年增", "財報", "現金流", "自由現金流", "毛利率", "營益率", "淨利率",
  "技術面", "基本面", "消息面",
  // 分析與投資決策
  "目標價", "合理價", "估值", "高估", "低估", "買點", "賣點", "進場", "出場", "停利",
  "停損", "支撐", "壓力", "突破", "回測", "回檔", "套牢", "解套", "填息", "區間",
  "風險", "建議", "分析", "評估", "可以買", "要不要買", "值不值得", "可不可以進場",
  // 事件與題材
  "產業鏈", "供應鏈", "新聞", "公告", "題材",
];

const ENGLISH_STOCK_INTENT_REGEX =
  /\b(?:stock|quote|shares|taiex|pe|pb|yield|price|up|down|trend|volume|eps|mom|yoy)\b/i;
const SYMBOL_REGEX = /(?:^|\D)(\d{4})(?:\D|$)/;

/** 判斷文字是否包含股票相關關鍵字。 */
export const containsFuzzyStockIntent = (text) => {
  const source = String(text || "").trim();
  const normalized = source.toLowerCase().replace(/\s+/g, "");

  return Boolean(normalized) && (
    STOCK_INTENT_KEYWORDS.some((keyword) => normalized.includes(keyword)) ||
    ENGLISH_STOCK_INTENT_REGEX.test(source)
  );
};

/** 從訊息中提取第一個 4 碼台股代號。 */
export const extractSymbol = (content) => {
  const match = String(content || "").match(SYMBOL_REGEX);
  return match?.[1] || null;
};

/** 判斷訊息是否含有 4 碼台股代號。 */
export const containsStockSymbol = (content) => SYMBOL_REGEX.test(String(content || ""));
