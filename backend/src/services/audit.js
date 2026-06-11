import prisma from "../prisma.js";

const getClientIp = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    // X-Forwarded-For 可能包含多個 IP，取第一個（原始客戶端 IP）
    return forwardedFor.split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || null;
};

export const getAuditContextFromRequest = (req) => ({
  endpoint: req.originalUrl || req.url,
  method: req.method,
  ip: getClientIp(req),
  userAgent: req.headers["user-agent"] || null,
});

export const writeAuditLog = async ({
  action,
  result,
  userId = null,
  reason = null,
  resource = null,
  metadata = null,
  endpoint = null,
  method = null,
  ip = null,
  userAgent = null,
}) => {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        result,
        userId,
        reason,
        resource,
        metadata,
        endpoint,
        method,
        ip,
        userAgent,
      },
    });
  } catch (error) {
    // 審計日誌寫入失敗不應影響主要業務流程，因此僅記錄錯誤，不拋出
    console.error("Audit log write failed:", error.message);
  }
};
