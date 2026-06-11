import jwt from "jsonwebtoken";
import { getAuditContextFromRequest, writeAuditLog } from "../services/audit.js";

// JWT Access Token 驗證
export const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    const context = getAuditContextFromRequest(req);
    void writeAuditLog({
      action: "AUTH_ACCESS_DENIED",
      result: "FAILURE",
      reason: "Missing access token",
      resource: "auth",
      ...context,
    });
    return res.status(401).json({ error: "沒有 token，無法訪問" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      username: decoded.username
    };
    next();
  } catch (error) {
    const context = getAuditContextFromRequest(req);
    void writeAuditLog({
      action: "AUTH_ACCESS_DENIED",
      result: "FAILURE",
      reason: "Invalid or expired access token",
      resource: "auth",
      ...context,
    });
    return res.status(401).json({ error: "Access Token 無效或已過期" });
  }
};
