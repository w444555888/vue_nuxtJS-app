let geminiClient;
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

export const extractGeminiText = (response) => {
  if (typeof response?.text === "string" && response.text.trim()) {
    return response.text.trim();
  }

  const parts = response?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return "";
  }

  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("\n")
    .trim();
};

export const getGeminiClient = async () => {
  if (!geminiClient) {
    const { GoogleGenAI } = await import("@google/genai");
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GOOGLE_API_KEY,
    });
  }

  return geminiClient;
};

/** Gemini 標準錯誤代碼  */
const GEMINI_ERROR_STATUS_MAP = {
  invalid_request: 400,
  invalid_argument: 400,
  failed_precondition: 400,
  out_of_range: 416,
  parameter_unknown: 400,
  authentication: 401,
  unauthenticated: 401,
  permission_denied: 403,
  not_found: 404,
  model_not_found: 404,
  already_exists: 409,
  aborted: 409,
  rate_limit_exceeded: 429,
  quota_exceeded: 429,
  too_many_requests: 429,
  resource_exhausted: 429,
  cancelled: 499,
  api_error: 500,
  internal: 500,
  unimplemented: 501,
  service_unavailable: 503,
  unavailable: 503,
  deadline_exceeded: 504,
};

// 可重試的錯誤：短暫過載、限流或逾時，依指數輪詢重試通常可成功。
const RETRYABLE_HTTP_STATUSES = new Set([429, 500, 503, 504]);

/** 從 Gemini 錯誤物件（或其 JSON 訊息）解析出 HTTP 狀態碼與代碼名稱。 */
const parseGeminiError = (error) => {
  let httpStatus = Number(error?.status) || Number(error?.code) || null;
  let codeName = String(error?.error?.status || error?.status || error?.code || "").toLowerCase();

  const rawMessage = String(error?.message || error || "");
  try {
    const parsed = JSON.parse(rawMessage);
    const inner = parsed?.error || parsed;
    if (inner) {
      httpStatus = Number(inner.code) || httpStatus;
      codeName = String(inner.status || codeName).toLowerCase();
    }
  } catch {
    
  }

  if (!httpStatus && GEMINI_ERROR_STATUS_MAP[codeName]) {
    httpStatus = GEMINI_ERROR_STATUS_MAP[codeName];
  }

  return { httpStatus, codeName, message: rawMessage };
};

/** 判斷 Gemini 錯誤是否可重試（429 限流／500 內部錯誤／503 過載／504 逾時）。 */
export const isTransientGeminiOverload = (error) => {
  const { httpStatus, codeName, message } = parseGeminiError(error);
  return (
    RETRYABLE_HTTP_STATUSES.has(httpStatus) ||
    /rate_limit_exceeded|quota_exceeded|too_many_requests|resource_exhausted|service_unavailable|unavailable|deadline_exceeded|high demand/i.test(
      codeName || message,
    )
  );
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const GEMINI_RETRY_ATTEMPTS = 2;
const GEMINI_RETRY_BASE_DELAY_MS = 1000;

// 共用的 Gemini 文字生成入口；股票服務可透過 config 傳入 MCP tools。
// 遇到可重試錯誤（429/500/503/504）時，依指數輪詢（含隨機抖動）自動重試。
export const generateAiText = async (contents, config = {}) => {
  const ai = await getGeminiClient();

  let lastError;
  for (let attempt = 0; attempt < GEMINI_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const result = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config,
      });
      return extractGeminiText(result);
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === GEMINI_RETRY_ATTEMPTS - 1;
      if (isLastAttempt || !isTransientGeminiOverload(error)) {
        throw error;
      }
      const backoffMs = GEMINI_RETRY_BASE_DELAY_MS * 2 ** attempt + Math.random() * 300;
      await wait(backoffMs);
    }
  }

  throw lastError;
};
