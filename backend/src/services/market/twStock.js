const REQUEST_TIMEOUT_MS = 3000;

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

const fetchWithTimeout = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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
    return twseQuote;
  }

  const tpexQuote = await fetchMisQuote(symbol, "otc", "TPEx");
  if (tpexQuote) {
    return tpexQuote;
  }

  throw createError(`查無台股代號 ${symbol} 的行情資料`, 404);
};