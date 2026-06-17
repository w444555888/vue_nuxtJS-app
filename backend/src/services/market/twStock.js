const REQUEST_TIMEOUT_MS = 3000;
const OPENAPI_REQUEST_TIMEOUT_MS = 8000;
const OPENAPI_CACHE_TTL_MS = 10 * 60 * 1000;
const OPENAPI_BASE_URL = "https://openapi.twse.com.tw/v1";

const openApiCache = new Map();

const createError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const toNumber = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).replace(/,/g, "").trim();
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

const formatAsOf = (record) => {
  const epochMs = toNumber(record?.tlong);
  if (epochMs && epochMs > 0) {
    return new Date(epochMs).toISOString();
  }

  return null;
};

const parseQuote = (record, market) => {
  const symbol = String(record?.c || "").trim();
  const name = String(record?.n || "").trim() || null;

  const lastTradePrice = toNumber(record?.z);
  const previousClose = toNumber(record?.y);
  const fallbackPrice = toNumber(record?.o);

  const price =
    lastTradePrice !== null
      ? lastTradePrice
      : previousClose !== null
      ? previousClose
      : fallbackPrice;

  if (!symbol || price === null) {
    return null;
  }

  let change = null;
  let changePercent = null;
  if (previousClose !== null && previousClose !== 0) {
    change = roundToTwo(price - previousClose);
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
    volume: toNumber(record?.v),
    asOf: formatAsOf(record),
    source: "TWSE MIS",
  };
};

const fetchWithTimeout = async (url, timeoutMs = REQUEST_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
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

const fetchMisQuote = async (symbol, marketPrefix, marketName) => {
  const query = `${marketPrefix}_${symbol}.tw`;
  const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${encodeURIComponent(query)}&json=1&delay=0`;

  const data = await fetchWithTimeout(url);
  const record = Array.isArray(data?.msgArray)
    ? data.msgArray.find((item) => String(item?.c || "") === symbol)
    : null;

  if (!record) {
    return null;
  }

  return parseQuote(record, marketName);
};

const getCachedOpenApiData = (cacheKey) => {
  const cached = openApiCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (Date.now() >= cached.expiresAt) {
    openApiCache.delete(cacheKey);
    return null;
  }

  return cached.data;
};

const setCachedOpenApiData = (cacheKey, data) => {
  openApiCache.set(cacheKey, {
    data,
    expiresAt: Date.now() + OPENAPI_CACHE_TTL_MS,
  });
};

const fetchOpenApiList = async (path) => {
  const cacheKey = `openapi:${path}`;
  const cached = getCachedOpenApiData(cacheKey);
  if (cached) {
    return cached;
  }

  const url = `${OPENAPI_BASE_URL}${path}`;
  const data = await fetchWithTimeout(url, OPENAPI_REQUEST_TIMEOUT_MS);
  const list = Array.isArray(data) ? data : [];

  setCachedOpenApiData(cacheKey, list);

  return list;
};

const findOpenApiRecordByCode = (list, symbol) => {
  if (!Array.isArray(list) || !symbol) {
    return null;
  }

  return (
    list.find((item) => String(item?.Code || "").trim() === symbol) || null
  );
};

const enrichQuoteWithOpenApi = async (quote) => {
  if (!quote?.symbol) {
    return quote;
  }

  try {
    const [valuationList, dayTradeList] = await Promise.all([
      fetchOpenApiList("/exchangeReport/BWIBBU_ALL"),
      fetchOpenApiList("/exchangeReport/STOCK_DAY_ALL"),
    ]);

    const valuation = findOpenApiRecordByCode(valuationList, quote.symbol);
    const dayTrade = findOpenApiRecordByCode(dayTradeList, quote.symbol);

    return {
      ...quote,
      peRatio: toNumber(valuation?.PEratio),
      dividendYield: toNumber(valuation?.DividendYield),
      pbRatio: toNumber(valuation?.PBratio),
      dayOpen: toNumber(dayTrade?.OpeningPrice),
      dayHigh: toNumber(dayTrade?.HighestPrice),
      dayLow: toNumber(dayTrade?.LowestPrice),
      dayClose: toNumber(dayTrade?.ClosingPrice),
      dayChange: toNumber(dayTrade?.Change),
      tradeVolumeDay: toNumber(dayTrade?.TradeVolume),
      tradeValueDay: toNumber(dayTrade?.TradeValue),
      transactionCount: toNumber(dayTrade?.Transaction),
      valuationDate: valuation?.Date || null,
      dayTradeDate: dayTrade?.Date || null,
      source: "TWSE MIS + TWSE OpenAPI",
    };
  } catch (error) {
    // OpenAPI 欄位屬於增強資訊；若失敗仍保留 MIS 即時報價。
    return quote;
  }
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

  const twseQuote = await fetchMisQuote(symbol, "tse", "TWSE");
  if (twseQuote) {
    return enrichQuoteWithOpenApi(twseQuote);
  }

  const tpexQuote = await fetchMisQuote(symbol, "otc", "TPEx");
  if (tpexQuote) {
    return enrichQuoteWithOpenApi(tpexQuote);
  }

  throw createError(`查無台股代號 ${symbol} 的行情資料`, 404);
};

// ===== 融資融券相關 =====
export const getMarginData = async (symbol) => {
  try {
    const list = await fetchOpenApiList("/exchangeReport/MI_MARGN");
    const record = findOpenApiRecordByCode(list, symbol);

    if (!record) {
      return null;
    }

    return {
      symbol,
      marginBuyBalance: toNumber(record?.MarginBuy),
      marginSellBalance: toNumber(record?.MarginSell),
      shortSellBalance: toNumber(record?.ShortSale),
      marginRatio: toNumber(record?.MarginBalance),
      date: record?.Date || null,
    };
  } catch (error) {
    return null;
  }
};

// 借券賣出股數
export const getBorrowableShares = async (symbol) => {
  try {
    const list = await fetchOpenApiList("/SBL/TWT96U");
    const record = findOpenApiRecordByCode(list, symbol);

    if (!record) {
      return null;
    }

    return {
      symbol,
      borrowableShares: toNumber(record?.BorrowableShares),
      borrowedShares: toNumber(record?.BorrowedShares),
      date: record?.Date || null,
    };
  } catch (error) {
    return null;
  }
};

// ===== 法人持股相關 =====
export const getLegalEntityTopHoldings = async () => {
  try {
    return await fetchOpenApiList("/fund/MI_QFIIS_sort_20");
  } catch (error) {
    return [];
  }
};

export const getLegalEntitySectorDistribution = async () => {
  try {
    return await fetchOpenApiList("/fund/MI_QFIIS_cat");
  } catch (error) {
    return [];
  }
};

// ===== 大盤相關 =====
export const getIndexData = async () => {
  try {
    const list = await fetchOpenApiList("/exchangeReport/MI_INDEX");
    return list && Array.isArray(list) ? list[0] || null : null;
  } catch (error) {
    return null;
  }
};

export const getTopTradeVolume20 = async () => {
  try {
    return await fetchOpenApiList("/exchangeReport/MI_INDEX20");
  } catch (error) {
    return [];
  }
};

export const getCrossMarketInfo = async () => {
  try {
    const list = await fetchOpenApiList("/exchangeReport/MI_INDEX4");
    return list && Array.isArray(list) ? list[0] || null : null;
  } catch (error) {
    return null;
  }
};

// ===== 中期趨勢相關 =====
export const getMonthlyTradeData = async (symbol) => {
  try {
    const list = await fetchOpenApiList("/exchangeReport/FMSRFK_ALL");
    const record = findOpenApiRecordByCode(list, symbol);

    if (!record) {
      return null;
    }

    return {
      symbol,
      monthlyClose: toNumber(record?.ClosingPrice),
      monthlyHigh: toNumber(record?.HighestPrice),
      monthlyLow: toNumber(record?.LowestPrice),
      monthlyVolume: toNumber(record?.TradeVolume),
      monthlyValue: toNumber(record?.TradeValue),
      date: record?.Date || null,
    };
  } catch (error) {
    return null;
  }
};

export const getYearlyTradeData = async (symbol) => {
  try {
    const list = await fetchOpenApiList("/exchangeReport/FMNPTK_ALL");
    const record = findOpenApiRecordByCode(list, symbol);

    if (!record) {
      return null;
    }

    return {
      symbol,
      yearlyClose: toNumber(record?.ClosingPrice),
      yearlyHigh: toNumber(record?.HighestPrice),
      yearlyLow: toNumber(record?.LowestPrice),
      yearlyVolume: toNumber(record?.TradeVolume),
      yearlyValue: toNumber(record?.TradeValue),
      year: record?.Year || null,
    };
  } catch (error) {
    return null;
  }
};

export const getDailyAvgPrice = async (symbol) => {
  try {
    const list = await fetchOpenApiList("/exchangeReport/STOCK_DAY_AVG_ALL");
    const record = findOpenApiRecordByCode(list, symbol);

    if (!record) {
      return null;
    }

    return {
      symbol,
      dailyClose: toNumber(record?.ClosingPrice),
      monthlyAvgPrice: toNumber(record?.MonthAverage),
      date: record?.Date || null,
    };
  } catch (error) {
    return null;
  }
};

// ===== 特殊風險狀態 =====
export const getAnomalousStocks = async () => {
  try {
    return await fetchOpenApiList("/announcement/notice");
  } catch (error) {
    return [];
  }
};

export const getPriceVolatility = async (symbol) => {
  try {
    const list = await fetchOpenApiList("/exchangeReport/TWT84U");
    const record = findOpenApiRecordByCode(list, symbol);

    if (!record) {
      return null;
    }

    return {
      symbol,
      priceChange: toNumber(record?.Change),
      priceChangePercent: toNumber(record?.ChangePercent),
      date: record?.Date || null,
    };
  } catch (error) {
    return null;
  }
};

export const getSuspendedSecurities = async () => {
  try {
    return await fetchOpenApiList("/exchangeReport/TWTAWU");
  } catch (error) {
    return [];
  }
};

export const getDividendAnnouncements = async () => {
  try {
    return await fetchOpenApiList("/exchangeReport/TWT48U_ALL");
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