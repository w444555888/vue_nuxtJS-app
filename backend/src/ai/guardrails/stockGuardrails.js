const REDIRECT_PATTERNS = /忽略.{0,20}(規則|指令|prompt)|洩漏.{0,20}(prompt|api.?key|金鑰)|系統管理員|developer message/i;

export const validateStockInput = (content) => {
  const text = String(content || "").trim();
  if (!text) {
    return { allowed: false, reason: "empty" };
  }
  if (text.length > 1000) {
    return { allowed: false, reason: "length" };
  }
  if (REDIRECT_PATTERNS.test(text)) {
    return { allowed: false, reason: "prompt_injection" };
  }
  return { allowed: true, reason: null };
};

export const validateStockOutput = (text) => {
  const source = String(text || "").trim();
  if (!source) {
    return { allowed: false, reason: "empty" };
  }
  if (/保證.{0,8}(獲利|報酬)|一定會.{0,8}(漲|賺)/i.test(source)) {
    return { allowed: false, reason: "unverified_profit_claim" };
  }
  return { allowed: true, reason: null };
};
