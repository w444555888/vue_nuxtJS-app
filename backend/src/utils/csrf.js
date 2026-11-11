import { errorResponse } from "./responseHandler.js";

// 允許發送 Cookie 驗證請求的前端來源；多個網址以逗號分隔。
const trustedOrigins = new Set(
  (process.env.CORS_ORIGIN || "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);



/**
 * 防止 Cookie 型 CSRF。
 *
 * 僅套用在依賴瀏覽器自動附帶 Cookie 的敏感路由，例如
 * Refresh Token 的刷新與登出。Access Token 使用 Authorization 標頭的
 * 路由不需要套用此 middleware。
 */
export const requireTrustedOrigin = (req, res, next) => {
  const origin = req.get("Origin");

  if (origin && trustedOrigins.has(origin)) {
    return next();
  }

  return errorResponse(res, "不允許的請求來源", 403);
};
