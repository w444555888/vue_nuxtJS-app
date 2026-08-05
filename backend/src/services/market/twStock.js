const REQUEST_TIMEOUT_MS = 5000;
const FINMIND_REQUEST_TIMEOUT_MS = 10000;
const FINMIND_CACHE_TTL_MS = 10 * 60 * 1000;
const FINMIND_BASE_URL =
  process.env.FINMIND_BASE_URL || "https://api.finmindtrade.com/api/v4";
const FINMIND_API_TOKEN = process.env.FINMIND_API_TOKEN || "";

const finmindCache = new Map();
let hasWarnedMissingFinmindToken = false;

const createError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const toNumber = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).replace(/,/g, "").replace(/%/g, "").trim();
  if (!normalized || normalized === "-" || normalized === "--") {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const roundToTwo = (value) => {
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.round(value * 100) / 100;
};

const toIsoDate = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
};

const pickFirstValue = (record, keys) => {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = record?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return value;
    }
  }

  return null;
};

const getRecordSymbol = (record) => {
  const raw = pickFirstValue(record, [
    "stock_id",
    "StockId",
    "data_id",
    "DataId",
    "Code",
    "symbol",
    "Symbol",
  ]);
  return raw ? String(raw).trim() : null;
};

const getRecordDate = (record) => {
  return pickFirstValue(record, ["date", "Date", "datetime", "Datetime"]);
};

const getLatestRecord = (list, symbol = null) => {
  if (!Array.isArray(list) || list.length === 0) {
    return null;
  }

  const scoped = symbol
    ? list.filter((item) => String(getRecordSymbol(item) || "") === String(symbol))
    : list;

  if (scoped.length === 0) {
    return null;
  }

  return scoped
    .slice()
    .sort((a, b) => {
      const aTime = Date.parse(String(getRecordDate(a) || ""));
      const bTime = Date.parse(String(getRecordDate(b) || ""));
      const aSafe = Number.isFinite(aTime) ? aTime : 0;
      const bSafe = Number.isFinite(bTime) ? bTime : 0;
      return bSafe - aSafe;
    })[0];
};

const getDateNDaysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

const buildQueryString = (params = {}) => {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    search.append(key, String(value));
  }

  return search.toString();
};

const fetchWithTimeout = async (
  url,
  { timeoutMs = REQUEST_TIMEOUT_MS, headers = {} } = {}
) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...headers,
      },
    });

    if (!response.ok) {
      throw createError(`行情服務連線失敗 (${response.status})`, 502);
    }

    return response.json();
  } catch (error) {
    if (error.name === "AbortError") {
      throw createError("行情服務逾時，請稍後再試", 504);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

const getCachedData = (cacheKey) => {
  const cached = finmindCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (Date.now() >= cached.expiresAt) {
    finmindCache.delete(cacheKey);
    return null;
  }

  return cached.data;
};

const setCachedData = (cacheKey, data) => {
  finmindCache.set(cacheKey, {
    data,
    expiresAt: Date.now() + FINMIND_CACHE_TTL_MS,
  });
};

const fetchFinMindData = async (dataset, params = {}) => {
  const cleanParams = {
    dataset,
    ...params,
  };

  if (FINMIND_API_TOKEN) {
    cleanParams.token = FINMIND_API_TOKEN;
  } else if (!hasWarnedMissingFinmindToken) {
    hasWarnedMissingFinmindToken = true;
    console.warn(
      "FINMIND_API_TOKEN 未設定，FinMind 請求將套用未登入額度限制。"
    );
  }

  const cacheIdentityParams = { ...cleanParams };
  delete cacheIdentityParams.token;
  const cacheKey = `finmind:${dataset}:${buildQueryString(cacheIdentityParams)}`;

  const cached = getCachedData(cacheKey);
  if (cached) {
    return cached;
  }

  const queryString = buildQueryString(cleanParams);
  const url = `${FINMIND_BASE_URL}/data?${queryString}`;

  const data = await fetchWithTimeout(url, {
    timeoutMs: FINMIND_REQUEST_TIMEOUT_MS,
    headers: FINMIND_API_TOKEN
      ? { Authorization: `Bearer ${FINMIND_API_TOKEN}` }
      : {},
  });

  if (data?.status && Number(data.status) !== 200) {
    throw createError(
      data?.msg || `FinMind 資料查詢失敗（status=${data.status}）`,
      502
    );
  }

  const list = Array.isArray(data?.data) ? data.data : [];
  setCachedData(cacheKey, list);
  return list;
};

const getStockInfo = async (symbol) => {
  const list = await fetchFinMindData("TaiwanStockInfo", { data_id: symbol });
  return getLatestRecord(list, symbol);
};

const getLatestStockPrice = async (symbol, days = 60) => {
  const list = await fetchFinMindData("TaiwanStockPrice", {
    data_id: symbol,
    start_date: getDateNDaysAgo(days),
  });
  return getLatestRecord(list, symbol);
};

const getLatestStockPer = async (symbol, days = 180) => {
  const list = await fetchFinMindData("TaiwanStockPER", {
    data_id: symbol,
    start_date: getDateNDaysAgo(days),
  });
  return getLatestRecord(list, symbol);
};

const parseQuote = ({ symbol, infoRecord, priceRecord, perRecord }) => {
  const market =
    String(pickFirstValue(infoRecord, ["market", "Market"]) || "").toUpperCase() ||
    null;
  const name =
    String(pickFirstValue(infoRecord, ["stock_name", "stockName", "name", "Name"]) || "") ||
    null;

  const dayOpen = toNumber(pickFirstValue(priceRecord, ["open", "OpeningPrice"]));
  const dayHigh = toNumber(pickFirstValue(priceRecord, ["max", "HighestPrice"]));
  const dayLow = toNumber(pickFirstValue(priceRecord, ["min", "LowestPrice"]));
  const dayClose = toNumber(pickFirstValue(priceRecord, ["close", "ClosingPrice"]));
  const dayChange = toNumber(pickFirstValue(priceRecord, ["spread", "Change"]));
  const tradeVolumeDay = toNumber(
    pickFirstValue(priceRecord, ["Trading_Volume", "TradeVolume", "volume"])
  );
  const tradeValueDay = toNumber(
    pickFirstValue(priceRecord, ["Trading_money", "TradeValue", "trade_value"])
  );
  const transactionCount = toNumber(
    pickFirstValue(priceRecord, ["Trading_turnover", "Transaction", "trade_turnover"])
  );

  const price = dayClose;
  if (!symbol || price === null) {
    return null;
  }

  const previousClose =
    dayChange !== null ? roundToTwo(price - dayChange) : null;
  let change = dayChange;
  if (change === null && previousClose !== null) {
    change = roundToTwo(price - previousClose);
  }

  let changePercent = null;
  if (previousClose !== null && previousClose !== 0 && change !== null) {
    changePercent = roundToTwo((change / previousClose) * 100);
  }

  return {
    symbol,
    market,
    name,
    price,
    previousClose,
    change,
    changePercent,
    volume: tradeVolumeDay,
    asOf: toIsoDate(getRecordDate(priceRecord)),
    peRatio: toNumber(pickFirstValue(perRecord, ["PER", "PEratio", "pe_ratio"])),
    dividendYield: toNumber(
      pickFirstValue(perRecord, ["dividend_yield", "DividendYield", "yield"])
    ),
    pbRatio: toNumber(pickFirstValue(perRecord, ["PBR", "PBratio", "pb_ratio"])),
    dayOpen,
    dayHigh,
    dayLow,
    dayClose,
    dayChange,
    tradeVolumeDay,
    tradeValueDay,
    transactionCount,
    valuationDate: getRecordDate(perRecord) || null,
    dayTradeDate: getRecordDate(priceRecord) || null,
    source: "FinMind TaiwanStockPrice + TaiwanStockPER",
  };
};

export const normalizeTwStockSymbol = (input) => {
  if (!input || typeof input !== "string") {
    throw createError("股票代號格式不正確", 400);
  }

  const normalizedInput = input.toUpperCase().trim();
  const withSuffixMatch = normalizedInput.match(/(\d{4})(?:\.(?:TW|TWO))?/);
  const symbol = withSuffixMatch?.[1] || null;

  if (!symbol) {
    throw createError("目前僅支援 4 碼台股代號，例如 2330", 400);
  }

  return symbol;
};

export const getTwStockQuote = async (inputSymbol) => {
  const symbol = normalizeTwStockSymbol(inputSymbol);
  const [infoRecord, priceRecord, perRecord] = await Promise.all([
    getStockInfo(symbol),
    getLatestStockPrice(symbol),
    getLatestStockPer(symbol),
  ]);

  const quote = parseQuote({ symbol, infoRecord, priceRecord, perRecord });
  if (!quote) {
    throw createError(`查無台股代號 ${symbol} 的行情資料`, 404);
  }

  return quote;
};

// ===== 融資融券相關 =====
export const getMarginData = async (symbol) => {
  try {
    const list = await fetchFinMindData("TaiwanStockMarginPurchaseShortSale", {
      data_id: symbol,
      start_date: getDateNDaysAgo(90),
    });
    const record = getLatestRecord(list, symbol);

    if (!record) {
      return null;
    }

    return {
      symbol,
      marginBuyBalance: toNumber(
        pickFirstValue(record, [
          "MarginPurchaseTodayBalance",
          "MarginPurchaseBalance",
          "margin_purchase_today_balance",
          "margin_purchase_balance",
        ])
      ),
      marginSellBalance: toNumber(
        pickFirstValue(record, [
          "ShortSaleTodayBalance",
          "ShortSaleBalance",
          "short_sale_today_balance",
          "short_sale_balance",
        ])
      ),
      shortSellBalance: toNumber(
        pickFirstValue(record, [
          "ShortSale",
          "ShortSaleToday",
          "short_sale",
          "short_sale_today",
        ])
      ),
      marginRatio: toNumber(
        pickFirstValue(record, [
          "MarginPurchaseUseRate",
          "margin_purchase_use_rate",
          "MarginPurchaseLimit",
          "margin_purchase_limit",
        ])
      ),
      date: getRecordDate(record) || null,
    };
  } catch (error) {
    return null;
  }
};

// 借券賣出股數
export const getBorrowableShares = async (symbol) => {
  try {
    const list = await fetchFinMindData("TaiwanStockSecuritiesLending", {
      data_id: symbol,
      start_date: getDateNDaysAgo(90),
    });
    const record = getLatestRecord(list, symbol);

    if (!record) {
      return null;
    }

    return {
      symbol,
      borrowableShares: toNumber(
        pickFirstValue(record, [
          "SecuritiesLendingBalance",
          "securities_lending_balance",
          "BorrowableShares",
        ])
      ),
      borrowedShares: toNumber(
        pickFirstValue(record, [
          "SecuritiesLendingSale",
          "securities_lending_sale",
          "BorrowedShares",
        ])
      ),
      date: getRecordDate(record) || null,
    };
  } catch (error) {
    return null;
  }
};

// ===== 法人持股相關 =====
export const getLegalEntityTopHoldings = async () => {
  try {
    const list = await fetchFinMindData("TaiwanStockInstitutionalInvestorsBuySell", {
      start_date: getDateNDaysAgo(10),
    });
    const latestDate = getRecordDate(getLatestRecord(list));
    const latest = latestDate
      ? list.filter((item) => String(getRecordDate(item) || "") === String(latestDate))
      : list;
    return latest.slice(0, 50);
  } catch (error) {
    return [];
  }
};

export const getLegalEntitySectorDistribution = async () => {
  try {
    return await getLegalEntityTopHoldings();
  } catch (error) {
    return [];
  }
};

// ===== 大盤相關 =====
export const getIndexData = async () => {
  try {
    const list = await fetchFinMindData("TaiwanStockTotalReturnIndex", {
      data_id: "TAIEX",
      start_date: getDateNDaysAgo(30),
    });
    return getLatestRecord(list);
  } catch (error) {
    return null;
  }
};

export const getTopTradeVolume20 = async () => {
  try {
    const list = await fetchFinMindData("TaiwanStockPrice", {
      start_date: getDateNDaysAgo(7),
    });
    const latestDate = getRecordDate(getLatestRecord(list));
    if (!latestDate) {
      return [];
    }

    return list
      .filter((item) => String(getRecordDate(item) || "") === String(latestDate))
      .sort(
        (a, b) =>
          (toNumber(b?.Trading_Volume) || 0) - (toNumber(a?.Trading_Volume) || 0)
      )
      .slice(0, 20);
  } catch (error) {
    return [];
  }
};

export const getCrossMarketInfo = async () => {
  try {
    const [taiexList, tpexList] = await Promise.all([
      fetchFinMindData("TaiwanStockTotalReturnIndex", {
        data_id: "TAIEX",
        start_date: getDateNDaysAgo(30),
      }),
      fetchFinMindData("TaiwanStockTotalReturnIndex", {
        data_id: "TPEx",
        start_date: getDateNDaysAgo(30),
      }),
    ]);

    return {
      TAIEX: getLatestRecord(taiexList),
      TPEx: getLatestRecord(tpexList),
    };
  } catch (error) {
    return null;
  }
};

// ===== 中期趨勢相關 =====
export const getMonthlyTradeData = async (symbol) => {
  try {
    const list = await fetchFinMindData("TaiwanStockPrice", {
      data_id: symbol,
      start_date: getDateNDaysAgo(45),
    });

    if (!Array.isArray(list) || list.length === 0) {
      return null;
    }

    const sorted = list
      .slice()
      .sort((a, b) => Date.parse(String(getRecordDate(b) || "")) - Date.parse(String(getRecordDate(a) || "")));
    const latestMonth = String(getRecordDate(sorted[0]) || "").slice(0, 7);
    const monthRows = sorted.filter(
      (item) => String(getRecordDate(item) || "").slice(0, 7) === latestMonth
    );

    if (monthRows.length === 0) {
      return null;
    }

    const highs = monthRows.map((item) => toNumber(item?.max)).filter(Number.isFinite);
    const lows = monthRows.map((item) => toNumber(item?.min)).filter(Number.isFinite);
    const volumes = monthRows
      .map((item) => toNumber(item?.Trading_Volume))
      .filter(Number.isFinite);
    const values = monthRows
      .map((item) => toNumber(item?.Trading_money))
      .filter(Number.isFinite);
    const latest = monthRows[0];

    return {
      symbol,
      monthlyClose: toNumber(latest?.close),
      monthlyHigh: highs.length > 0 ? Math.max(...highs) : null,
      monthlyLow: lows.length > 0 ? Math.min(...lows) : null,
      monthlyVolume: volumes.length > 0 ? volumes.reduce((sum, n) => sum + n, 0) : null,
      monthlyValue: values.length > 0 ? values.reduce((sum, n) => sum + n, 0) : null,
      date: getRecordDate(latest) || null,
    };
  } catch (error) {
    return null;
  }
};

export const getYearlyTradeData = async (symbol) => {
  try {
    const list = await fetchFinMindData("TaiwanStockPrice", {
      data_id: symbol,
      start_date: getDateNDaysAgo(400),
    });

    if (!Array.isArray(list) || list.length === 0) {
      return null;
    }

    const sorted = list
      .slice()
      .sort((a, b) => Date.parse(String(getRecordDate(b) || "")) - Date.parse(String(getRecordDate(a) || "")));
    const latestYear = String(getRecordDate(sorted[0]) || "").slice(0, 4);
    const yearRows = sorted.filter(
      (item) => String(getRecordDate(item) || "").slice(0, 4) === latestYear
    );

    if (yearRows.length === 0) {
      return null;
    }

    const highs = yearRows.map((item) => toNumber(item?.max)).filter(Number.isFinite);
    const lows = yearRows.map((item) => toNumber(item?.min)).filter(Number.isFinite);
    const volumes = yearRows
      .map((item) => toNumber(item?.Trading_Volume))
      .filter(Number.isFinite);
    const values = yearRows
      .map((item) => toNumber(item?.Trading_money))
      .filter(Number.isFinite);
    const latest = yearRows[0];

    return {
      symbol,
      yearlyClose: toNumber(latest?.close),
      yearlyHigh: highs.length > 0 ? Math.max(...highs) : null,
      yearlyLow: lows.length > 0 ? Math.min(...lows) : null,
      yearlyVolume: volumes.length > 0 ? volumes.reduce((sum, n) => sum + n, 0) : null,
      yearlyValue: values.length > 0 ? values.reduce((sum, n) => sum + n, 0) : null,
      year: latestYear || null,
    };
  } catch (error) {
    return null;
  }
};

export const getDailyAvgPrice = async (symbol) => {
  try {
    const list = await fetchFinMindData("TaiwanStockPrice", {
      data_id: symbol,
      start_date: getDateNDaysAgo(30),
    });
    const record = getLatestRecord(list, symbol);

    if (!record) {
      return null;
    }

    const closes = list
      .map((item) => toNumber(item?.close))
      .filter(Number.isFinite);
    const avgClose =
      closes.length > 0
        ? roundToTwo(closes.reduce((sum, n) => sum + n, 0) / closes.length)
        : null;

    return {
      symbol,
      dailyClose: toNumber(record?.close),
      monthlyAvgPrice: avgClose,
      date: getRecordDate(record) || null,
    };
  } catch (error) {
    return null;
  }
};

// ===== 特殊風險狀態 =====
export const getAnomalousStocks = async () => {
  try {
    return await fetchFinMindData("TaiwanStockDayTradingSuspension", {
      start_date: getDateNDaysAgo(30),
    });
  } catch (error) {
    return [];
  }
};

export const getPriceVolatility = async (symbol) => {
  try {
    const list = await fetchFinMindData("TaiwanStockPrice", {
      data_id: symbol,
      start_date: getDateNDaysAgo(30),
    });
    const record = getLatestRecord(list, symbol);

    if (!record) {
      return null;
    }

    const closePrice = toNumber(record?.close);
    const spread = toNumber(record?.spread);
    const previousClose =
      closePrice !== null && spread !== null ? closePrice - spread : null;
    const priceChangePercent =
      previousClose && previousClose !== 0 && spread !== null
        ? roundToTwo((spread / previousClose) * 100)
        : null;

    return {
      symbol,
      priceChange: spread,
      priceChangePercent,
      date: getRecordDate(record) || null,
    };
  } catch (error) {
    return null;
  }
};

export const getSuspendedSecurities = async () => {
  try {
    return await fetchFinMindData("TaiwanStockSuspended", {
      start_date: getDateNDaysAgo(90),
    });
  } catch (error) {
    return [];
  }
};

export const getDividendAnnouncements = async () => {
  try {
    return await fetchFinMindData("TaiwanStockDividend", {
      start_date: getDateNDaysAgo(365),
    });
  } catch (error) {
    return [];
  }
};

// ===== API 選擇器：根據用戶查詢關鍵字決定要呼叫哪些 API =====
export const selectAndFetchAPIsForContext = async (symbol, userQuery) => {
  const queryLower = String(userQuery || "").toLowerCase();
  const result = {
    base: null,
    margin: null,
    borrowable: null,
    monthly: null,
    yearly: null,
    volatility: null,
    index: null,
    topVolume20: null,
    crossMarket: null,
    legalEntityTop: null,
    dividendInfo: null,
  };

  try {
    // 基礎行情（總是查）
    result.base = await getTwStockQuote(symbol);
  } catch (error) {
    console.error(`基礎行情查詢失敗 (${symbol}):`, error?.message);
  }

  // 融資融券 - 關鍵字：融資、融券、借券、法人、主力
  if (/融資|融券|借券|法人|主力|買賣超/.test(queryLower)) {
    try {
      result.margin = await getMarginData(symbol);
      result.borrowable = await getBorrowableShares(symbol);
    } catch (error) {
      console.error(`融資融券查詢失敗 (${symbol}):`, error?.message);
    }
  }

  // 中期趨勢 - 關鍵字：月線、趨勢、長期、技術面、月成交
  if (/月線|趨勢|長期|技術面|月成交|中期/.test(queryLower)) {
    try {
      result.monthly = await getMonthlyTradeData(symbol);
    } catch (error) {
      console.error(`月成交查詢失敗 (${symbol}):`, error?.message);
    }
  }

  // 長期數據 - 關鍵字：年線、年成交、長期走勢、歷史
  if (/年線|年成交|長期走勢|歷史/.test(queryLower)) {
    try {
      result.yearly = await getYearlyTradeData(symbol);
    } catch (error) {
      console.error(`年成交查詢失敗 (${symbol}):`, error?.message);
    }
  }

  // 波動率 - 關鍵字：波動、漲幅、跌幅、升降
  if (/波動|漲幅|跌幅|升降/.test(queryLower)) {
    try {
      result.volatility = await getPriceVolatility(symbol);
    } catch (error) {
      console.error(`波動率查詢失敗 (${symbol}):`, error?.message);
    }
  }

  // 大盤相關 - 關鍵字：大盤、指數、加權、行情、盤勢、大盤走勢
  if (/大盤|指數|加權|盤勢|大盤走勢|行情整體/.test(queryLower)) {
    try {
      result.index = await getIndexData();
      result.topVolume20 = await getTopTradeVolume20();
      result.crossMarket = await getCrossMarketInfo();
    } catch (error) {
      console.error(`大盤查詢失敗:`, error?.message);
    }
  }

  // 法人相關 - 關鍵字：外資、投信、自營商、法人、買超、賣超、三大法人
  if (/外資|投信|自營商|買超|賣超|三大法人/.test(queryLower)) {
    try {
      result.legalEntityTop = await getLegalEntityTopHoldings();
    } catch (error) {
      console.error(`法人持股查詢失敗:`, error?.message);
    }
  }

  // 除權息相關 - 關鍵字：除息、除權、配息、股利、殖利率、填息
  if (/除息|除權|配息|股利|殖利率|填息/.test(queryLower)) {
    try {
      result.dividendInfo = await getDividendAnnouncements();
    } catch (error) {
      console.error(`除權息查詢失敗:`, error?.message);
    }
  }

  return result;
};